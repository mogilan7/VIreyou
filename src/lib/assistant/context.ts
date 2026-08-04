import prisma from "../prisma";

export interface LifestyleContext {
  user: {
    age: number | null;
    gender: string | null;
    weightKg: number | null;
    goalKcal: number | null;
    lang: string;
    conditionsFlags: string[];
  };
  window: { days: number };
  sleep: { avgHours: number | null; nights: number };
  activity: { avgSteps: number | null; activeMinPerWeek: number | null; strengthDays: number };
  hydration: { avgMl: number | null };
  nutrition: {
    avgKcal: number | null;
    avgProteinG: number | null;
    avgFiberG: number | null;
    addedSugarPctKcal: number | null;
  };
}

function deriveConditionFlags(user: any): string[] {
  // Placeholder for deriving flags like 'pregnant', 'eating_disorder', 'minor', etc.
  const flags: string[] = [];
  if (user.age && user.age < 18) flags.push("minor");
  // Assuming these flags might come from somewhere else in the future
  return flags;
}

function sumActiveMinutes(activityLogs: any[], days: number): number {
  return activityLogs.reduce((acc, log) => acc + (log.active_minutes || 0), 0);
}

function countStrengthDays(activityLogs: any[]): number {
  // Simplification: assume any active minutes > 0 count as some form of physical activity day for now, 
  // or we could check for specific keywords in notes, but we'll use active minutes > 30 as a proxy.
  return activityLogs.filter(log => (log.active_minutes || 0) >= 30).length;
}

function addedSugarShare(nutritionLogs: any[]): number | null {
  let totalKcal = 0;
  let totalAddedSugarKcal = 0; // 1g sugar = 4 kcal
  for (const log of nutritionLogs) {
    totalKcal += log.calories || 0;
    totalAddedSugarKcal += (log.added_sugar || 0) * 4;
  }
  if (totalKcal === 0) return null;
  return (totalAddedSugarKcal / totalKcal) * 100;
}

export async function aggregateUserContext(userId: string, days = 7): Promise<LifestyleContext> {
  const since = new Date(new Date().getTime() - days * 24 * 60 * 60 * 1000);

  const [user, sleep, activity, hydration, nutrition] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.sleepLog.findMany({ where: { user_id: userId, date: { gte: since } } }),
    prisma.activityLog.findMany({ where: { user_id: userId, date: { gte: since } } }),
    prisma.hydrationLog.findMany({ where: { user_id: userId, date: { gte: since } } }),
    prisma.nutritionLog.findMany({ where: { user_id: userId, date: { gte: since } } }),
  ]);

  const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

  return {
    user: {
      age: user?.age ?? null,
      gender: user?.gender ?? null,
      weightKg: user?.weight ?? null,
      goalKcal: user?.target_calories ?? null,
      lang: user?.language ?? 'ru',
      conditionsFlags: deriveConditionFlags(user),
    },
    window: { days },
    sleep: { 
      avgHours: avg(sleep.map(s => s.duration_hrs || 0).filter(h => h > 0)), 
      nights: sleep.length 
    },
    activity: {
      avgSteps: avg(activity.map(a => a.steps || 0).filter(s => s > 0)),
      activeMinPerWeek: sumActiveMinutes(activity, days),
      strengthDays: countStrengthDays(activity),
    },
    hydration: { 
      avgMl: avg(hydration.map(h => h.volume_ml || 0).filter(v => v > 0)) 
    },
    nutrition: {
      avgKcal: avg(nutrition.map(n => n.calories || 0).filter(c => c > 0)),
      avgProteinG: avg(nutrition.map(n => n.protein || 0).filter(p => p > 0)),
      avgFiberG: avg(nutrition.map(n => n.fiber || 0).filter(f => f > 0)),
      addedSugarPctKcal: addedSugarShare(nutrition),
    },
  };
}
