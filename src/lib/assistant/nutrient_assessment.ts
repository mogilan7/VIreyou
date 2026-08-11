import prisma from "../../lib/prisma";
import { 
  MIN_EI_BMR_RATIO, 
  MIN_KCAL_FALLBACK, 
  MIN_MEALS_PER_DAY, 
  MAX_KCAL_PER_DAY,
  GATING,
  WEEKDAY_SKEW_THRESHOLD,
  STALENESS_DAYS
} from "./config";

// Function to calculate estimated BMR if not available
function calculateBMR(weight: number, height: number, age: number, gender: string): number {
  if (!weight || !height || !age || !gender) return MIN_KCAL_FALLBACK / 0.6; // Default to something reasonable
  // Mifflin-St Jeor Equation
  let bmr = (10 * weight) + (6.25 * height) - (5 * age);
  return gender.toLowerCase() === 'male' ? bmr + 5 : bmr - 161;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

// Retrieves valid days for the nutrient assessment within the window
export async function getValidDays(userId: string, windowDays: number = 14) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const tz = user.timezone || "Europe/Moscow";
  const getLocalDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: tz });

  const bmr = calculateBMR(user.weight || 0, user.height || 0, user.age || 0, user.gender || 'unknown');
  const minKcal = Math.max(bmr * MIN_EI_BMR_RATIO, MIN_KCAL_FALLBACK);

  const [nutritionLogs, hydrationLogs] = await Promise.all([
    prisma.nutritionLog.findMany({
      where: { user_id: userId, date: { gte: windowStart } },
      orderBy: { date: 'asc' }
    }),
    prisma.hydrationLog.findMany({
      where: { user_id: userId, date: { gte: windowStart } }
    })
  ]);

  // Aggregate nutrition logs by day (YYYY-MM-DD)
  const dailySums: Record<string, { kcal: number, protein: number, carbs: number, fat: number, fiber: number, meals: number, date: Date }> = {};
  
  for (const log of nutritionLogs) {
    const dayStr = getLocalDate(log.date);
    if (!dailySums[dayStr]) {
       dailySums[dayStr] = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, meals: 0, date: log.date };
    }
    dailySums[dayStr].kcal += log.calories || 0;
    dailySums[dayStr].protein += log.protein || 0;
    dailySums[dayStr].carbs += log.carbs || 0;
    dailySums[dayStr].fat += log.fat || 0;
    dailySums[dayStr].fiber += log.fiber || 0;
    dailySums[dayStr].meals += 1;
  }

  const validDays = [];
  const excludedDays = [];
  let weekendDaysCount = 0;

  for (const dayStr of Object.keys(dailySums)) {
    const dayData = dailySums[dayStr];
    const isAnomalous = dayData.kcal > MAX_KCAL_PER_DAY;
    const isSufficientEnergy = dayData.kcal >= minKcal;
    
    if (!isAnomalous && isSufficientEnergy && dayData.meals >= MIN_MEALS_PER_DAY) {
      validDays.push(dayData);
      if (isWeekend(dayData.date)) weekendDaysCount++;
    } else {
      excludedDays.push({ date: dayData.date, reason: isAnomalous ? 'anomalous' : 'insufficient' });
    }
  }

  // Habits logic
  const habitLogs = await prisma.habitLog.findMany({
    where: { user_id: userId, date: { gte: windowStart } }
  });

  const habitsCount: Record<string, number> = {};
  for (const log of habitLogs) {
    if (log.completed) {
      habitsCount[log.habit_key] = (habitsCount[log.habit_key] || 0) + 1;
    }
  }

  // Water logic
  const dailyWaterSums: Record<string, number> = {};
  for (const log of hydrationLogs) {
    const dayStr = getLocalDate(log.date);
    dailyWaterSums[dayStr] = (dailyWaterSums[dayStr] || 0) + log.volume_ml;
  }
  const validWaterDays = Object.values(dailyWaterSums).filter(v => v > 0);
  let averageWater = null;
  if (validWaterDays.length > 0) {
    averageWater = Math.round(validWaterDays.reduce((a, b) => a + b, 0) / validWaterDays.length);
  }

  validDays.sort((a,b) => a.date.getTime() - b.date.getTime());

  return {
    bmr,
    validDays,
    excludedDays,
    weekendDaysCount,
    habitsCount,
    validWaterDaysCount: validWaterDays.length,
    averageWater,
    coverage: validDays.length / windowDays,
    lastEntryDate: validDays.length > 0 ? validDays[validDays.length - 1].date : null
  };
}

export async function generateNutrientAssessment(userId: string, windowDays: number = 14, forceShow: boolean = false) {
  const { bmr, validDays, excludedDays, weekendDaysCount, habitsCount, coverage, lastEntryDate, validWaterDaysCount, averageWater } = await getValidDays(userId, windowDays);
  
  const validDaysCount = validDays.length;
  
  // Gating flags
  const macrosSufficient = validDaysCount >= GATING.MACROS;
  const fiberMineralsSufficient = validDaysCount >= GATING.FIBER_MINERALS;
  const microsVitaminsSufficient = validDaysCount >= GATING.MICROS_VITAMINS && weekendDaysCount > 0;
  
  const flags = {
    weekday_skew: validDaysCount > 0 && weekendDaysCount / validDaysCount < WEEKDAY_SKEW_THRESHOLD,
    stale: lastEntryDate ? (new Date().getTime() - lastEntryDate.getTime()) / (1000 * 60 * 60 * 24) > STALENESS_DAYS : true,
    no_weekend_day: weekendDaysCount === 0
  };

  // Calculate means if sufficient
  let macrosValue = null;
  if (macrosSufficient) {
    const sum = validDays.reduce((acc, d) => ({
      kcal: acc.kcal + d.kcal,
      protein: acc.protein + d.protein,
      carbs: acc.carbs + d.carbs,
      fat: acc.fat + d.fat
    }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    // Fallback to BMR if target_calories is missing
    const targetKcal = user?.target_calories || Math.round(bmr * 1.2); 
    
    macrosValue = {
      kcal: Math.round(sum.kcal / validDaysCount),
      protein: Math.round(sum.protein / validDaysCount),
      carbs: Math.round(sum.carbs / validDaysCount),
      fat: Math.round(sum.fat / validDaysCount),
      target_kcal: Math.round(targetKcal),
      target_protein: Math.round(user?.target_protein || ((targetKcal * 0.20) / 4)), 
      target_carbs: Math.round(user?.target_carbs || ((targetKcal * 0.50) / 4)), 
      target_fat: Math.round(user?.target_fat || ((targetKcal * 0.30) / 9)), 
    };
  }

  // Compile contract
  const contract = {
    window: windowDays,
    valid_days: validDaysCount,
    valid_weekend_days: weekendDaysCount,
    coverage,
    flags,
    habits: habitsCount,
    nutrients: {
      macros: {
        sufficient: macrosSufficient,
        days_required: GATING.MACROS,
        value: macrosValue,
        descriptive: forceShow ? "descriptive_data" : null
      },
      fiber_minerals: {
        sufficient: fiberMineralsSufficient,
        days_required: GATING.FIBER_MINERALS,
        value: fiberMineralsSufficient ? "calculated_median" : null,
        descriptive: forceShow ? "descriptive_data" : null
      },
      micros_vitamins: {
        sufficient: microsVitaminsSufficient,
        days_required: GATING.MICROS_VITAMINS,
        value: microsVitaminsSufficient ? "calculated_median" : null,
        descriptive: forceShow ? "descriptive_data" : null
      },
      water: {
        sufficient: validWaterDaysCount >= GATING.MACROS,
        days_required: GATING.MACROS,
        value: validWaterDaysCount >= GATING.MACROS ? { average_ml: averageWater, target_ml: 2000 } : null
      }
    },
    disclosure: `Взято ${validDaysCount} дней из ${windowDays} · последняя запись ${flags.stale ? 'давно' : 'недавно'}.`
  };

  if (forceShow) {
    await prisma.disclosureLog.create({
      data: { userId }
    });
  }

  // Cache it
  await prisma.nutrientCalc.upsert({
    where: { userId },
    update: { data: contract, window: windowDays },
    create: { userId, data: contract, window: windowDays }
  });

  return contract;
}
