import prisma from "../../lib/prisma";
import { BASELINE_WINDOW, MIN_BASELINE_POINTS, SPIKE_SD, REPEAT_THRESHOLD } from "./config";

// --- Baseline Engine ---

function median(values: number[]): number {
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const half = Math.floor(values.length / 2);
  if (values.length % 2) return values[half];
  return (values[half - 1] + values[half]) / 2.0;
}

export async function getDomainBaselines(userId: string) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - BASELINE_WINDOW * 24 * 60 * 60 * 1000);

  const [sleep, activity, water, nutrition] = await Promise.all([
    prisma.sleepLog.findMany({ where: { user_id: userId, date: { gte: windowStart } } }),
    prisma.activityLog.findMany({ where: { user_id: userId, date: { gte: windowStart } } }),
    prisma.hydrationLog.findMany({ where: { user_id: userId, date: { gte: windowStart } } }),
    prisma.nutritionLog.findMany({ where: { user_id: userId, date: { gte: windowStart } } }),
  ]);

  const baselines: any = {};

  // Sleep duration median
  const sleepDurations = sleep.map(s => {
    if (!s.sleep_start || !s.sleep_end) return 0;
    let duration = (s.sleep_end.getTime() - s.sleep_start.getTime()) / (1000 * 60);
    if (duration < 0) duration += 24 * 60; // crossed midnight
    return duration;
  }).filter(d => d > 0);
  
  if (sleepDurations.length >= MIN_BASELINE_POINTS) {
    baselines.sleep_duration = { median: median(sleepDurations), points: sleepDurations.length, unit: "min" };
  }

  // Activity steps median
  const steps = activity.map(a => a.steps || 0).filter(s => s > 0);
  if (steps.length >= MIN_BASELINE_POINTS) {
    baselines.steps = { median: median(steps), points: steps.length, unit: "steps" };
  }

  // Water median
  const waterAmounts = water.map(w => w.amount_ml).filter(a => a > 0);
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

  return baselines;
}

// --- Deviation Detection ---

export function detectDeviations(todayData: any, baselines: any) {
  const deviations = [];
  
  // Sleep deviation (spike detection)
  if (todayData.sleep_duration && baselines.sleep_duration) {
    // A simplified spike detection (assume SD = median * 0.2 for now, ideally calculate real SD)
    const sd = baselines.sleep_duration.median * 0.2; 
    const diff = todayData.sleep_duration - baselines.sleep_duration.median;
    if (Math.abs(diff) > SPIKE_SD * sd) {
      deviations.push({
        domain: "sleep",
        type: "spike",
        magnitude_sd: Math.abs(diff) / sd,
        direction: diff > 0 ? "up" : "down"
      });
    }
  }

  // Activity deviation
  if (todayData.steps && baselines.steps) {
    const sd = baselines.steps.median * 0.3; // Approx SD for steps
    const diff = todayData.steps - baselines.steps.median;
    if (Math.abs(diff) > SPIKE_SD * sd) {
      deviations.push({
        domain: "activity",
        type: "spike",
        magnitude_sd: Math.abs(diff) / sd,
        direction: diff > 0 ? "up" : "down"
      });
    }
  }

  return deviations;
}

// --- Card Generator ---
export async function generateDailyReviewCard(userId: string) {
  const baselines = await getDomainBaselines(userId);
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  yesterday.setHours(0,0,0,0);
  const todayEnd = new Date(yesterday.getTime() + 2 * 24 * 60 * 60 * 1000);

  // Fetch recent data (yesterday and today)
  const [sleep, activity, water, nutrition] = await Promise.all([
    prisma.sleepLog.findMany({ where: { user_id: userId, date: { gte: yesterday, lt: todayEnd } } }),
    prisma.activityLog.findMany({ where: { user_id: userId, date: { gte: yesterday, lt: todayEnd } } }),
    prisma.hydrationLog.findMany({ where: { user_id: userId, date: { gte: yesterday, lt: todayEnd } } }),
    prisma.nutritionLog.findMany({ where: { user_id: userId, date: { gte: yesterday, lt: todayEnd } } }),
  ]);

  const todayData: any = {};
  if (sleep.length) todayData.sleep_duration = (sleep[0].sleep_end?.getTime()! - sleep[0].sleep_start?.getTime()!) / (1000 * 60);
  if (activity.length) todayData.steps = activity[0].steps;
  if (water.length) todayData.water_ml = water[0].amount_ml;

  const deviations = detectDeviations(todayData, baselines);
  
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
    baselines,
    today: todayData,
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
