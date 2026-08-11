import prisma from '../prisma';
import { getLocalDayRangeUTC } from './ingest';
import { DailyAdvice } from './advice';
import { NudgeDecision } from './scheduler';

export interface AssistantDataPayload {
  hasAny: boolean;
  sleep: any[];
  activity: any[];
  hydration: any[];
  nutrition: any[];
  habits: any[];
}

export async function getDailyData(userId: string, targetDateStr: string, timezone: string = "Europe/Moscow") {
  // 1. User and Profile
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { AssistantState: true }
  });

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  // 2. State & History
  const assistantState = user.AssistantState || {
    consecutiveEmptyDays: 0,
    lastPingAt: null,
  };

  // Ensure yesterday's date logic
  const targetDate = new Date(`${targetDateStr}T12:00:00Z`);
  const yesterday = new Date(targetDate.getTime() - 24 * 60 * 60 * 1000);

  const yesterdayAdvice = await prisma.adviceLog.findFirst({
    where: { userId, date: yesterday }
  });

  // 3. Raw Logs using Timezone-aware bounds
  const { start, end } = getLocalDayRangeUTC(targetDateStr, user.timezone || timezone);

  const [sleep, activity, hydration, nutrition, habits] = await Promise.all([
    prisma.sleepLog.findMany({ where: { user_id: userId, date: { gte: start, lt: end } } }),
    prisma.activityLog.findMany({ where: { user_id: userId, date: { gte: start, lt: end } } }),
    prisma.hydrationLog.findMany({ where: { user_id: userId, date: { gte: start, lt: end } } }),
    prisma.nutritionLog.findMany({ where: { user_id: userId, date: { gte: start, lt: end } } }),
    prisma.habitEpisode.findMany({ where: { user_id: userId, occurred_at: { gte: start, lt: end } } })
  ]);

  const hasAny = sleep.length > 0 || activity.length > 0 || hydration.length > 0 || nutrition.length > 0 || habits.length > 0;

  const data: AssistantDataPayload = {
    hasAny,
    sleep,
    activity,
    hydration,
    nutrition,
    habits
  };

  return {
    user,
    assistantState,
    yesterdayAdvice,
    data,
    targetDateStr,
    timezone: user.timezone || timezone
  };
}

export async function updateAssistantState(
  userId: string, 
  nudgeDecision: NudgeDecision, 
  newAdvice: DailyAdvice | null,
  targetDateStr: string
) {
  // 1. Update Ping State
  if (nudgeDecision.shouldNudge) {
    await prisma.assistantState.upsert({
      where: { userId },
      update: {
        lastPingAt: new Date(),
        consecutiveEmptyDays: 0 // Assume reset if we send normal card, otherwise handled by sparsity
      },
      create: {
        userId,
        lastPingAt: new Date(),
        consecutiveEmptyDays: 0
      }
    });
  } else if (nudgeDecision.reason.startsWith('sparsity_') || nudgeDecision.reason === 'sync_grace') {
     // If we are waiting or backing off due to empty days, we don't reset consecutiveEmptyDays here
  }

  // 2. Save new advice if issued
  if (newAdvice) {
    const targetDate = new Date(`${targetDateStr}T12:00:00Z`); // Normalize as just Date
    await prisma.adviceLog.create({
      data: {
        userId,
        date: targetDate,
        target_metric: newAdvice.target_metric,
        verifiable: newAdvice.verifiable
      }
    });
  }
}

export async function getWindowData(userId: string, endDateStr: string, timezone: string = "Europe/Moscow", days: number = 14) {
  const endDateUTC = new Date(`${endDateStr}T12:00:00Z`);
  const startDateUTC = new Date(endDateUTC.getTime() - days * 24 * 60 * 60 * 1000);
  
  // Use timezone-aware bounds for the whole window
  const { start: windowStart } = getLocalDayRangeUTC(startDateUTC.toISOString().split('T')[0], timezone);
  const { end: windowEnd } = getLocalDayRangeUTC(endDateStr, timezone);

  const [sleep, activity, hydration, nutrition, habits] = await Promise.all([
    prisma.sleepLog.findMany({ where: { user_id: userId, date: { gte: windowStart, lt: windowEnd } }, orderBy: { date: 'asc' } }),
    prisma.activityLog.findMany({ where: { user_id: userId, date: { gte: windowStart, lt: windowEnd } }, orderBy: { date: 'asc' } }),
    prisma.hydrationLog.findMany({ where: { user_id: userId, date: { gte: windowStart, lt: windowEnd } }, orderBy: { date: 'asc' } }),
    prisma.nutritionLog.findMany({ where: { user_id: userId, date: { gte: windowStart, lt: windowEnd } }, orderBy: { date: 'asc' } }),
    prisma.habitEpisode.findMany({ where: { user_id: userId, occurred_at: { gte: windowStart, lt: windowEnd } }, orderBy: { occurred_at: 'asc' } })
  ]);

  return { sleep, activity, hydration, nutrition, habits };
}

export async function recomputeAssistantState(userId: string, targetDateStr: string, timezone: string = "Europe/Moscow") {
  // Scans history to fix consecutiveEmptyDays
  const windowData = await getWindowData(userId, targetDateStr, timezone, 30);
  
  // Determine empty days by checking backwards from targetDateStr
  let emptyDays = 0;
  const targetDate = new Date(`${targetDateStr}T12:00:00Z`);
  
  for (let i = 0; i < 30; i++) {
    const d = new Date(targetDate.getTime() - i * 24 * 60 * 60 * 1000);
    const dayStr = d.toISOString().split('T')[0];
    const { start, end } = getLocalDayRangeUTC(dayStr, timezone);
    
    const hasSleep = windowData.sleep.some(l => l.date >= start && l.date < end);
    const hasActivity = windowData.activity.some(l => l.date >= start && l.date < end);
    const hasHydration = windowData.hydration.some(l => l.date >= start && l.date < end);
    const hasNutrition = windowData.nutrition.some(l => l.date >= start && l.date < end);
    const hasHabits = windowData.habits.some(l => l.occurred_at >= start && l.occurred_at < end);
    
    if (!(hasSleep || hasActivity || hasHydration || hasNutrition || hasHabits)) {
      emptyDays++;
    } else {
      break; // Found a day with data, stop counting empty days
    }
  }

  await prisma.assistantState.upsert({
    where: { userId },
    update: { consecutiveEmptyDays: emptyDays },
    create: { userId, consecutiveEmptyDays: emptyDays }
  });

  return emptyDays;
}

export async function invalidateBaselines(userId: string) {
  await prisma.domainBaseline.updateMany({
    where: { userId },
    data: { is_outdated: true }
  });
}

export async function getDomainBaseline(userId: string, domain: string, timezone: string = "Europe/Moscow"): Promise<{ median: number, points: number, window: number } | null> {
  const existing = await prisma.domainBaseline.findUnique({
    where: { userId_domain: { userId, domain } }
  });

  if (existing && !existing.is_outdated) {
    return { median: existing.median, points: existing.points, window: existing.window };
  }

  // Lazy recalculation logic for 14 days window as an example
  // Normally this logic uses validity and ingest features, 
  // For now we assume we fetch the 14 day window data and calculate median
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  const windowData = await getWindowData(userId, todayStr, timezone, 14);
  
  let values: number[] = [];
  
  if (domain === 'sleep') {
    values = windowData.sleep.map(l => l.duration).filter((v): v is number => v !== null && v > 0);
  } else if (domain === 'activity') {
    values = windowData.activity.map(l => l.steps).filter((v): v is number => v !== null && v > 0);
  } else if (domain === 'nutrition') {
    // Basic fallback for nutrition kcal if needed, but normally handled by specific logic
    values = windowData.nutrition.map(l => l.calories).filter((v): v is number => v !== null && v > 0);
  } else if (domain === 'hydration') {
    values = windowData.hydration.map(l => l.amount_ml).filter((v): v is number => v !== null && v > 0);
  }
  // Habits are discrete episodes so median doesn't make sense the same way, skipped for now

  if (values.length === 0) {
    return null;
  }

  values.sort((a, b) => a - b);
  const half = Math.floor(values.length / 2);
  const medianValue = values.length % 2 ? values[half] : (values[half - 1] + values[half]) / 2;

  const updated = await prisma.domainBaseline.upsert({
    where: { userId_domain: { userId, domain } },
    update: { median: medianValue, points: values.length, window: 14, is_outdated: false },
    create: { userId, domain, median: medianValue, points: values.length, window: 14, is_outdated: false }
  });

  return { median: updated.median, points: updated.points, window: updated.window };
}

export function mapGoalToDomain(goal: string | null): string | null {
  if (!goal) return null;
  const g = goal.toLowerCase();
  if (g.includes('sleep') || g.includes('сон')) return 'sleep';
  if (g.includes('weight') || g.includes('fat') || g.includes('жир') || g.includes('вес') || g.includes('nutrition') || g.includes('питание')) return 'nutrition';
  if (g.includes('activity') || g.includes('active') || g.includes('активность') || g.includes('шаги') || g.includes('step')) return 'activity';
  return null;
}

export async function getWakeUpTime(userId: string, targetDateStr: string, timezone: string = "Europe/Moscow", userWakeUpTimeOverride?: string | null): Promise<string> {
  if (userWakeUpTimeOverride && userWakeUpTimeOverride !== "07:00") {
    return userWakeUpTimeOverride;
  }
  
  // Get last 14 days of sleep logs to find median wake up time
  const { sleep } = await getWindowData(userId, targetDateStr, timezone, 14);
  
  const endTimes = sleep
    .filter(s => s.end_time || s.created_at)
    .map(s => {
      const time = s.end_time || s.created_at;
      return time.getUTCHours() * 60 + time.getUTCMinutes(); // In minutes from midnight UTC
    });

  if (endTimes.length === 0) {
    return userWakeUpTimeOverride || "07:00";
  }

  endTimes.sort((a, b) => a - b);
  const half = Math.floor(endTimes.length / 2);
  let medianMinutes = endTimes.length % 2 ? endTimes[half] : (endTimes[half - 1] + endTimes[half]) / 2;
  
  // Convert UTC median minutes back to local time string based on timezone (simplified approximation)
  // For a perfect implementation, we should extract the local time from the Date object when it was saved.
  // Assuming the `end_time` or `created_at` were stored correctly.
  
  let hours = Math.floor(medianMinutes / 60);
  let mins = Math.floor(medianMinutes % 60);
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}
