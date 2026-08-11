import prisma from "../../lib/prisma";
import { BASELINE_WINDOW, MIN_BASELINE_POINTS, SPIKE_SD, REPEAT_THRESHOLD } from "./config";
import { getLocalDate as getLocalDateStr, getLocalDayRangeUTC } from "./ingest";

// --- Baseline Engine ---

function median(values: number[]): number {
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const half = Math.floor(values.length / 2);
  if (values.length % 2) return values[half];
  return (values[half - 1] + values[half]) / 2.0;
}

export async function getDomainBaselines(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const tz = user?.timezone || "Europe/Moscow";
  const now = new Date();
  const todayStr = getLocalDateStr(now, tz);
  // windowStart = start of local day BASELINE_WINDOW days ago
  const windowAgo = new Date(now.getTime() - BASELINE_WINDOW * 24 * 60 * 60 * 1000);
  const windowAgoStr = getLocalDateStr(windowAgo, tz);
  const { start: windowStart } = getLocalDayRangeUTC(windowAgoStr, tz);

  const [sleep, activity, water, nutrition] = await Promise.all([
    prisma.sleepLog.findMany({ where: { user_id: userId, date: { gte: windowStart } } }),
    prisma.activityLog.findMany({ where: { user_id: userId, date: { gte: windowStart } } }),
    prisma.hydrationLog.findMany({ where: { user_id: userId, date: { gte: windowStart } } }),
    prisma.nutritionLog.findMany({ where: { user_id: userId, date: { gte: windowStart } } }),
  ]);
  // tz already obtained above — use in getLocalDate below

  const getLocalDate = (d: Date) => getLocalDateStr(d, tz);

  const baselines: any = {};
  const data_sufficiency: any = {
    hrv: { sufficient: false, points: 0, needed: MIN_BASELINE_POINTS },
    resting_heart_rate: { sufficient: false, points: 0, needed: MIN_BASELINE_POINTS }
  };

  // HRV median (unique days)
  const hrvDays = new Set(sleep.filter(s => s.hrv && s.hrv > 0).map(s => getLocalDate(s.date)));
  data_sufficiency.hrv.points = hrvDays.size;
  if (hrvDays.size >= MIN_BASELINE_POINTS) {
    const sorted = Array.from(hrvDays).map(d => sleep.find(s => getLocalDate(s.date) === d)!.hrv).sort((a,b) => (a||0)-(b||0)) as number[];
    baselines.hrv = { median: sorted[Math.floor(sorted.length / 2)], points: hrvDays.size, unit: "ms" };
    data_sufficiency.hrv.sufficient = true;
  }

  // RHR median (unique days)
  const rhrDays = new Set(sleep.filter(s => s.resting_heart_rate && s.resting_heart_rate > 0).map(s => getLocalDate(s.date)));
  data_sufficiency.resting_heart_rate.points = rhrDays.size;
  if (rhrDays.size >= MIN_BASELINE_POINTS) {
    const sorted = Array.from(rhrDays).map(d => sleep.find(s => getLocalDate(s.date) === d)!.resting_heart_rate).sort((a,b) => (a||0)-(b||0)) as number[];
    baselines.resting_heart_rate = { median: sorted[Math.floor(sorted.length / 2)], points: rhrDays.size, unit: "bpm" };
    data_sufficiency.resting_heart_rate.sufficient = true;
  }

  // Water median
  const waterByDay: Record<string, number> = {};
  water.forEach(w => {
    const d = getLocalDate(w.date);
    waterByDay[d] = (waterByDay[d] || 0) + (w.volume_ml || 0);
  });
  const waterAmounts = Object.values(waterByDay).filter(a => a > 0);
  if (waterAmounts.length >= MIN_BASELINE_POINTS) {
    baselines.water_ml = { median: median(waterAmounts), points: waterAmounts.length, unit: "ml" };
  }

  // Save/Update in DB for tracking
  for (const domain of Object.keys(baselines)) {
    await prisma.domainBaseline.upsert({
      where: { userId_domain: { userId, domain } },
      update: {
        median: baselines[domain].median,
        points: baselines[domain].points,
        window: BASELINE_WINDOW,
      },
      create: {
        userId,
        domain,
        median: baselines[domain].median,
        points: baselines[domain].points,
        window: BASELINE_WINDOW,
      }
    });
  }

  return { baselines, data_sufficiency };
}

// --- Deviation Detection ---

export function detectDeviations(todayData: any, baselines: any, targets: any) {
  const deviations = [];
  const SPIKE_SD = 1.5; // Trigger threshold

  // Sleep deviation (target-based: 7-8 hours)
  if (todayData.sleep_duration_hrs) {
    if (todayData.sleep_duration_hrs < 7) { 
      deviations.push({
        domain: "sleep",
        type: "spike",
        direction: "down"
      });
    } else if (todayData.sleep_duration_hrs > 9) {
      deviations.push({
        domain: "sleep",
        type: "spike",
        direction: "up"
      });
    }
  }

  // Activity deviation (target-based)
  if (todayData.steps && targets.steps) {
    const diff = todayData.steps - targets.steps;
    if (Math.abs(diff) > targets.steps * 0.3) { // 30% deviation
      deviations.push({
        domain: "activity",
        type: "spike",
        direction: diff > 0 ? "up" : "down"
      });
    }
  }

  // Water deviation (target-based)
  if (todayData.water_ml && targets.water_ml) {
    const diff = todayData.water_ml - targets.water_ml;
    if (diff < -500) {
      deviations.push({
        domain: "water",
        type: "spike",
        direction: "down"
      });
    }
  }

  // HRV deviation (baseline-based)
  if (todayData.hrv && baselines.hrv) {
    const sd = baselines.hrv.median * 0.1; // Approx SD 10%
    const diff = todayData.hrv - baselines.hrv.median;
    if (Math.abs(diff) > SPIKE_SD * sd) {
      deviations.push({
        domain: "hrv",
        type: "spike",
        direction: diff > 0 ? "up" : "down"
      });
    }
  }

  // RHR deviation (baseline-based)
  if (todayData.resting_heart_rate && baselines.resting_heart_rate) {
    const sd = baselines.resting_heart_rate.median * 0.05; // Approx SD 5%
    const diff = todayData.resting_heart_rate - baselines.resting_heart_rate.median;
    if (Math.abs(diff) > SPIKE_SD * sd) {
      deviations.push({
        domain: "resting_heart_rate",
        type: "spike",
        direction: diff > 0 ? "up" : "down"
      });
    }
  }

  return deviations;
}

// --- Card Generator ---
export async function generateDailyReviewCard(userId: string) {
  const { baselines, data_sufficiency } = await getDomainBaselines(userId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const tz = user?.timezone || "Europe/Moscow";
  const getLocalDate = (d: Date) => getLocalDateStr(d, tz);

  const now = new Date();
  // Use timezone-aware day boundaries for yesterday and today
  const todayStr = getLocalDateStr(now, tz);
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getLocalDateStr(yesterdayDate, tz);
  const { start: yesterday } = getLocalDayRangeUTC(yesterdayStr, tz);
  const { end: todayEnd } = getLocalDayRangeUTC(todayStr, tz);

  // Fetch recent data (yesterday and today)
  const [sleep, activity, water, nutrition] = await Promise.all([
    prisma.sleepLog.findMany({ where: { user_id: userId, date: { gte: yesterday, lt: todayEnd } } }),
    prisma.activityLog.findMany({ where: { user_id: userId, date: { gte: yesterday, lt: todayEnd } } }),
    prisma.hydrationLog.findMany({ where: { user_id: userId, date: { gte: yesterday, lt: todayEnd } } }),
    prisma.nutritionLog.findMany({ where: { user_id: userId, date: { gte: yesterday, lt: todayEnd } } }),
  ]);

  const todayData: any = {};
  
  const allDates = [...sleep, ...activity].map(x => getLocalDate(x.date));
  if (allDates.length > 0) {
    allDates.sort();
    const latestDateStr = allDates[allDates.length - 1];

    const todaySleep = sleep.filter(s => getLocalDate(s.date) === latestDateStr);
    const todayActivity = activity.filter(a => getLocalDate(a.date) === latestDateStr);

    if (todaySleep.length && (todaySleep[0] as any).duration_hrs) {
      todayData.sleep_duration_hrs = (todaySleep[0] as any).duration_hrs;
      if (todaySleep[0].hrv) todayData.hrv = todaySleep[0].hrv;
      if (todaySleep[0].resting_heart_rate) todayData.resting_heart_rate = todaySleep[0].resting_heart_rate;
    }
    if (todayActivity.length) {
      if (todayActivity[0].steps) todayData.steps = todayActivity[0].steps;
      if (todayActivity[0].active_minutes) todayData.active_minutes = todayActivity[0].active_minutes;
    }
  }

  const targets = {
    steps: user?.target_steps || 10000,
    active_minutes: user?.target_active_minutes || 30,
    sleep_duration_hrs: "7-8"
  };

  const deviations = detectDeviations(todayData, baselines, targets);
  
  // Degradation Ladder
  let ladderState = "level_1_full";
  let emptyStreak = 0;
  
  const hasTodayData = Object.keys(todayData).length > 0;
  
  const lastAdvice = await prisma.adviceLog.findFirst({
    where: { userId },
    orderBy: { date: 'desc' }
  });

  const state = await prisma.engagementState.findFirst({ where: { userId, domain: 'general' } });
  if (state) {
     emptyStreak = hasTodayData ? 0 : state.empty_streak + 1;
     await prisma.engagementState.update({
       where: { id: state.id },
       data: { empty_streak: emptyStreak, status: emptyStreak > 3 ? 'decaying' : 'stable' }
     });
  } else {
     await prisma.engagementState.create({
       data: { userId, domain: 'general', empty_streak: hasTodayData ? 0 : 1, status: 'stable' }
     });
  }

  if (hasTodayData) {
     ladderState = "level_1_full";
  } else if (lastAdvice && lastAdvice.date.getTime() >= yesterday.getTime()) {
     ladderState = "level_2_check_yesterday";
  } else if (baselines.sleep_duration && baselines.sleep_duration.points >= 7) {
     ladderState = "level_3_retrospective";
  } else if (emptyStreak > 1 && emptyStreak < 4) {
     ladderState = "level_4_subjective";
  } else if (emptyStreak >= 4 && emptyStreak < 7) {
     ladderState = "level_5_context";
  } else {
     ladderState = "level_6_nudge";
  }

  // Pick praise and problem area
  let praise = null;
  let problem = null;
  
  if (deviations.length > 0) {
      const up = deviations.find(d => d.direction === 'up');
      const down = deviations.find(d => d.direction === 'down');
      if (up) praise = up;
      if (down) problem = down;
  }

  const contract = {
    date: new Date().toISOString().split('T')[0],
    ladder_state: ladderState,
    data_sufficiency,
    baselines,
    today: todayData,
    targets,
    deviations,
    yesterday_advice: lastAdvice ? lastAdvice.target_metric : null,
    engagement: { empty_streak: emptyStreak },
    card_blocks: {
      block_1_check: ladderState === 'level_2_check_yesterday' ? true : false,
      block_2_praise: praise,
      block_3_problem: problem,
      block_4_action: true
    }
  };

  return contract;
}
