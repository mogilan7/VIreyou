import { buildInsightsContract } from './daily_review_insights';
import prisma from "../../lib/prisma";
import { CONFIG } from "./config";
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
  // windowStart = start of local day CONFIG.BASELINE_WINDOW days ago
  const windowAgo = new Date(now.getTime() - CONFIG.BASELINE_WINDOW * 24 * 60 * 60 * 1000);
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
    hrv: { sufficient: false, points: 0, needed: CONFIG.MIN_BASELINE_POINTS },
    resting_heart_rate: { sufficient: false, points: 0, needed: CONFIG.MIN_BASELINE_POINTS }
  };

  // HRV median (unique days)
  const hrvDays = new Set(sleep.filter(s => s.hrv && s.hrv > 0).map(s => getLocalDate(s.date)));
  data_sufficiency.hrv.points = hrvDays.size;
  if (hrvDays.size >= CONFIG.MIN_BASELINE_POINTS) {
    const sorted = Array.from(hrvDays).map(d => sleep.find(s => getLocalDate(s.date) === d)!.hrv).sort((a,b) => (a||0)-(b||0)) as number[];
    baselines.hrv = { median: sorted[Math.floor(sorted.length / 2)], points: hrvDays.size, unit: "ms" };
    data_sufficiency.hrv.sufficient = true;
  }

  // RHR median (unique days)
  const rhrDays = new Set(sleep.filter(s => s.resting_heart_rate && s.resting_heart_rate > 0).map(s => getLocalDate(s.date)));
  data_sufficiency.resting_heart_rate.points = rhrDays.size;
  if (rhrDays.size >= CONFIG.MIN_BASELINE_POINTS) {
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
  if (waterAmounts.length >= CONFIG.MIN_BASELINE_POINTS) {
    baselines.water_ml = { median: median(waterAmounts), points: waterAmounts.length, unit: "ml" };
  }

  // Save/Update in DB for tracking
  for (const domain of Object.keys(baselines)) {
    await prisma.domainBaseline.upsert({
      where: { userId_domain: { userId, domain } },
      update: {
        median: baselines[domain].median,
        points: baselines[domain].points,
        window: CONFIG.BASELINE_WINDOW,
      },
      create: {
        userId,
        domain,
        median: baselines[domain].median,
        points: baselines[domain].points,
        window: CONFIG.BASELINE_WINDOW,
      }
    });
  }

  return { baselines, data_sufficiency };
}

// --- Deviation Detection ---

export function detectDeviations(todayData: any, baselines: any, targets: any) {
  const deviations = [];
   // Trigger threshold

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
    if (Math.abs(diff) > CONFIG.SPIKE_SD * sd) {
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
    if (Math.abs(diff) > CONFIG.SPIKE_SD * sd) {
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
  // Use the new deterministic insights builder
  const contract = await buildInsightsContract(userId);
  return contract;
}
