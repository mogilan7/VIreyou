import prisma from "../prisma";

export interface LifestyleContext {
  user: {
    id: string;
    age: number | null;
    gender: string | null;
    weightKg: number | null;
    goalKcal: number | null;
    lang: string;
    conditionsFlags: string[];
  };
  window: { days: number };
  
  // Level 1: Behavioral Logs
  l1: {
    sleep: { avgHours: number | null; nights: number };
    activity: { avgSteps: number | null; activeMinPerWeek: number | null; strengthDays: number };
    hydration: { avgMl: number | null };
    nutrition: {
      loggedDays: number;
      avgKcal: number | null;
      avgProteinG: number | null;
      avgFiberG: number | null;
      addedSugarPctKcal: number | null;
      iron: number | null;
      vitaminD: number | null;
      avgSodiumMg: number | null;
      avgSatFatPct: number | null;
      avgTransFatPct: number | null;
    };
    habits: {
      smoking: boolean;
      alcohol: boolean;
    };
  };

  // Level 2: Wearables Physiology
  l2: {
    hrv: { currentAvg: number | null; baselineAvg: number | null };
    restingHr: { currentAvg: number | null; baselineAvg: number | null };
  };

  // Level 3: Clinical Biomarkers
  l3: {
    biomarkers: Array<{ key: string; name: string; status: string | null; date: Date }>;
  };
}

function deriveConditionFlags(user: any): string[] {
  const flags: string[] = [];
  if (user.age && user.age < 18) flags.push("minor");
  return flags;
}

export async function aggregateUserContext(userId: string, days = 7): Promise<LifestyleContext> {
  const now = new Date();
  const currentSince = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const [user, sleepCurrent, activity, hydration, nutrition, habits, biomarkers, healthData] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.sleepLog.findMany({ where: { user_id: userId, date: { gte: currentSince } } }),
    prisma.activityLog.findMany({ where: { user_id: userId, date: { gte: currentSince } } }),
    prisma.hydrationLog.findMany({ where: { user_id: userId, date: { gte: currentSince } } }),
    prisma.nutritionLog.findMany({ where: { user_id: userId, date: { gte: currentSince } } }),
    prisma.habitLog.findMany({ where: { user_id: userId, date: { gte: currentSince } } }),
    prisma.biomarkerResult.findMany({ 
      where: { user_id: userId, recorded_at: { gte: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000) } },
      orderBy: { recorded_at: 'desc' },
      take: 20
    }),
    prisma.healthData.findUnique({ where: { user_id: userId } })
  ]);

  const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

  // Parse Habits
  const hasSmoking = habits.some(h => h.habit_key === 'smoking' && h.completed);
  const hasAlcohol = habits.some(h => h.habit_key === 'alcohol' && h.completed);

  return {
    user: {
      id: userId,
      age: user?.age ?? null,
      gender: user?.gender ?? null,
      weightKg: user?.weight ?? null,
      goalKcal: user?.target_calories ?? null,
      lang: user?.language ?? 'ru',
      conditionsFlags: deriveConditionFlags(user),
    },
    window: { days },
    
    l1: {
      sleep: { 
        avgHours: avg(sleepCurrent.map(s => s.duration_hrs || 0).filter(h => h > 0)), 
        nights: sleepCurrent.length 
      },
      activity: {
        avgSteps: avg(activity.map(a => a.steps || 0).filter(s => s > 0)),
        activeMinPerWeek: activity.reduce((acc, log) => acc + (log.active_minutes || 0), 0),
        strengthDays: activity.filter(log => (log.active_minutes || 0) >= 30).length,
      },
      hydration: { 
        avgMl: avg(hydration.map(h => h.volume_ml || 0).filter(v => v > 0)) 
      },
      nutrition: {
        loggedDays: new Set(nutrition.map(n => n.date.toISOString().split('T')[0])).size,
        avgKcal: avg(nutrition.map(n => n.calories || 0).filter(c => c > 0)),
        avgProteinG: avg(nutrition.map(n => n.protein || 0).filter(p => p > 0)),
        avgFiberG: avg(nutrition.map(n => n.fiber || 0).filter(f => f > 0)),
        addedSugarPctKcal: avg(nutrition.map(n => (n.added_sugar && n.calories) ? ((n.added_sugar * 4) / n.calories) * 100 : null).filter(x => x !== null) as number[]),
        iron: avg(nutrition.map(n => n.iron || 0).filter(x => x > 0)),
        vitaminD: avg(nutrition.map(n => n.vitamin_D || 0).filter(x => x > 0)),
        avgSodiumMg: avg(nutrition.map(n => n.sodium || 0).filter(x => x > 0)),
        avgSatFatPct: null, // Saturated fat is not tracked yet
        avgTransFatPct: avg(nutrition.map(n => (n.trans_fat && n.calories) ? ((n.trans_fat * 9) / n.calories) * 100 : null).filter(x => x !== null) as number[]),
      },
      habits: {
        smoking: hasSmoking,
        alcohol: hasAlcohol,
      }
    },

    l2: {
      hrv: {
        currentAvg: avg(sleepCurrent.map(s => s.hrv || 0).filter(v => v > 0)),
        baselineAvg: healthData?.baseline_hrv ?? null,
      },
      restingHr: {
        currentAvg: avg(sleepCurrent.map(s => s.resting_heart_rate || 0).filter(v => v > 0)),
        baselineAvg: healthData?.baseline_resting_hr ?? null,
      }
    },

    l3: {
      biomarkers: biomarkers.map(b => ({
        key: b.marker_key,
        name: b.marker_name,
        status: b.status,
        date: b.recorded_at
      }))
    }
  };
}
