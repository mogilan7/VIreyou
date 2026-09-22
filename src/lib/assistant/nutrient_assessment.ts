import prisma from "../../lib/prisma";
import { CONFIG } from "./config";

const WEEKDAY_SKEW_THRESHOLD = 0.2;
const STALENESS_DAYS = 3;

// Function to calculate estimated BMR if not available
function calculateBMR(weight: number, height: number, age: number, gender: string): number {
  if (!weight || !height || !age || !gender) return CONFIG.MIN_KCAL_FALLBACK / 0.6; // Default to something reasonable
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
  const minKcal = Math.max(bmr * CONFIG.MIN_EI_BMR_RATIO, CONFIG.MIN_KCAL_FALLBACK);

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
  const dailySums: Record<string, { kcal: number, protein: number, carbs: number, fat: number, fiber: number, iron: number, magnesium: number, sodium: number, iodine: number, meals: number, date: Date }> = {};
  
  for (const log of nutritionLogs) {
    const dayStr = getLocalDate(log.date);
    if (!dailySums[dayStr]) {
       dailySums[dayStr] = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, meals: 0, date: log.date, vitamin_A: 0, vitamin_D: 0, vitamin_E: 0, vitamin_K: 0, vitamin_B1: 0, vitamin_B2: 0, vitamin_B3: 0, vitamin_B5: 0, vitamin_B6: 0, vitamin_B7: 0, vitamin_B9: 0, vitamin_B12: 0, vitamin_C: 0, calcium: 0, iron: 0, magnesium: 0, phosphorus: 0, potassium: 0, sodium: 0, zinc: 0, copper: 0, manganese: 0, selenium: 0, iodine: 0 };
    }
    dailySums[dayStr].kcal += log.calories || 0;
    dailySums[dayStr].protein += log.protein || 0;
    dailySums[dayStr].carbs += log.carbs || 0;
    dailySums[dayStr].fat += log.fat || 0;
    dailySums[dayStr].fiber += log.fiber || 0;
    dailySums[dayStr].vitamin_A += log.vitamin_A || 0;
    dailySums[dayStr].vitamin_D += log.vitamin_D || 0;
    dailySums[dayStr].vitamin_E += log.vitamin_E || 0;
    dailySums[dayStr].vitamin_K += log.vitamin_K || 0;
    dailySums[dayStr].vitamin_B1 += log.vitamin_B1 || 0;
    dailySums[dayStr].vitamin_B2 += log.vitamin_B2 || 0;
    dailySums[dayStr].vitamin_B3 += log.vitamin_B3 || 0;
    dailySums[dayStr].vitamin_B5 += log.vitamin_B5 || 0;
    dailySums[dayStr].vitamin_B6 += log.vitamin_B6 || 0;
    dailySums[dayStr].vitamin_B7 += log.vitamin_B7 || 0;
    dailySums[dayStr].vitamin_B9 += log.vitamin_B9 || 0;
    dailySums[dayStr].vitamin_B12 += log.vitamin_B12 || 0;
    dailySums[dayStr].vitamin_C += log.vitamin_C || 0;
    dailySums[dayStr].calcium += log.calcium || 0;
    dailySums[dayStr].iron += log.iron || 0;
    dailySums[dayStr].magnesium += log.magnesium || 0;
    dailySums[dayStr].phosphorus += log.phosphorus || 0;
    dailySums[dayStr].potassium += log.potassium || 0;
    dailySums[dayStr].sodium += log.sodium || 0;
    dailySums[dayStr].zinc += log.zinc || 0;
    dailySums[dayStr].copper += log.copper || 0;
    dailySums[dayStr].manganese += log.manganese || 0;
    dailySums[dayStr].selenium += log.selenium || 0;
    dailySums[dayStr].iodine += log.iodine || 0;
    dailySums[dayStr].meals += 1;
  }

  const validDays = [];
  const excludedDays = [];
  let weekendDaysCount = 0;

  for (const dayStr of Object.keys(dailySums)) {
    const dayData = dailySums[dayStr];
    const isAnomalous = dayData.kcal > CONFIG.MAX_KCAL_PER_DAY;
    const isSufficientEnergy = dayData.kcal >= minKcal;
    
    if (!isAnomalous && isSufficientEnergy && dayData.meals >= CONFIG.MIN_MEALS_PER_DAY) {
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
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const { bmr, validDays, excludedDays, weekendDaysCount, habitsCount, coverage, lastEntryDate, validWaterDaysCount, averageWater } = await getValidDays(userId, windowDays);
  
  const validDaysCount = validDays.length;
  
  // Gating flags
  const macrosSufficient = validDaysCount >= CONFIG.THRESHOLD_MACRO;
  const fiberMineralsSufficient = validDaysCount >= CONFIG.THRESHOLD_MINERALS;
  const microsVitaminsSufficient = validDaysCount >= CONFIG.THRESHOLD_MICRO && weekendDaysCount > 0;
  
  const flags = {
    weekday_skew: validDaysCount > 0 && weekendDaysCount / validDaysCount < WEEKDAY_SKEW_THRESHOLD,
    stale: lastEntryDate ? (new Date().getTime() - lastEntryDate.getTime()) / (1000 * 60 * 60 * 24) > STALENESS_DAYS : true,
    no_weekend_day: weekendDaysCount === 0
  };

  // Calculate means if sufficient
  let macrosValue = null;
  let fiberMineralsValue = null;
  let microsVitaminsValue = null;
  if (macrosSufficient) {
    const sum = validDays.reduce((acc, d) => ({
      kcal: acc.kcal + d.kcal,
      fiber: acc.fiber + (d.fiber || 0),
      protein: acc.protein + d.protein,
      carbs: acc.carbs + d.carbs,
      fat: acc.fat + d.fat,
      vitamin_A: acc.vitamin_A + (d.vitamin_A || 0),
      vitamin_D: acc.vitamin_D + (d.vitamin_D || 0),
      vitamin_E: acc.vitamin_E + (d.vitamin_E || 0),
      vitamin_K: acc.vitamin_K + (d.vitamin_K || 0),
      vitamin_B1: acc.vitamin_B1 + (d.vitamin_B1 || 0),
      vitamin_B2: acc.vitamin_B2 + (d.vitamin_B2 || 0),
      vitamin_B3: acc.vitamin_B3 + (d.vitamin_B3 || 0),
      vitamin_B5: acc.vitamin_B5 + (d.vitamin_B5 || 0),
      vitamin_B6: acc.vitamin_B6 + (d.vitamin_B6 || 0),
      vitamin_B7: acc.vitamin_B7 + (d.vitamin_B7 || 0),
      vitamin_B9: acc.vitamin_B9 + (d.vitamin_B9 || 0),
      vitamin_B12: acc.vitamin_B12 + (d.vitamin_B12 || 0),
      vitamin_C: acc.vitamin_C + (d.vitamin_C || 0),
      calcium: acc.calcium + (d.calcium || 0),
      iron: acc.iron + (d.iron || 0),
      magnesium: acc.magnesium + (d.magnesium || 0),
      phosphorus: acc.phosphorus + (d.phosphorus || 0),
      potassium: acc.potassium + (d.potassium || 0),
      sodium: acc.sodium + (d.sodium || 0),
      zinc: acc.zinc + (d.zinc || 0),
      copper: acc.copper + (d.copper || 0),
      manganese: acc.manganese + (d.manganese || 0),
      selenium: acc.selenium + (d.selenium || 0),
      iodine: acc.iodine + (d.iodine || 0)
    }), { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, vitamin_A: 0, vitamin_D: 0, vitamin_E: 0, vitamin_K: 0, vitamin_B1: 0, vitamin_B2: 0, vitamin_B3: 0, vitamin_B5: 0, vitamin_B6: 0, vitamin_B7: 0, vitamin_B9: 0, vitamin_B12: 0, vitamin_C: 0, calcium: 0, iron: 0, magnesium: 0, phosphorus: 0, potassium: 0, sodium: 0, zinc: 0, copper: 0, manganese: 0, selenium: 0, iodine: 0 });
    
    // Fallback to BMR if target_calories is missing
    const targetKcal = user?.target_calories || Math.round(bmr * 1.2); 
    
    fiberMineralsValue = fiberMineralsSufficient ? { fiber: Math.round(sum.fiber / validDaysCount) } : null;
    if (microsVitaminsSufficient) {
      microsVitaminsValue = {
        vitamin_A: Math.round(sum.vitamin_A / validDaysCount),
        vitamin_D: Math.round(sum.vitamin_D / validDaysCount),
        vitamin_E: Math.round(sum.vitamin_E / validDaysCount),
        vitamin_K: Math.round(sum.vitamin_K / validDaysCount),
        vitamin_B1: Math.round(sum.vitamin_B1 / validDaysCount),
        vitamin_B2: Math.round(sum.vitamin_B2 / validDaysCount),
        vitamin_B3: Math.round(sum.vitamin_B3 / validDaysCount),
        vitamin_B5: Math.round(sum.vitamin_B5 / validDaysCount),
        vitamin_B6: Math.round(sum.vitamin_B6 / validDaysCount),
        vitamin_B7: Math.round(sum.vitamin_B7 / validDaysCount),
        vitamin_B9: Math.round(sum.vitamin_B9 / validDaysCount),
        vitamin_B12: Math.round(sum.vitamin_B12 / validDaysCount),
        vitamin_C: Math.round(sum.vitamin_C / validDaysCount),
        calcium: Math.round(sum.calcium / validDaysCount),
        iron: Math.round(sum.iron / validDaysCount),
        magnesium: Math.round(sum.magnesium / validDaysCount),
        phosphorus: Math.round(sum.phosphorus / validDaysCount),
        potassium: Math.round(sum.potassium / validDaysCount),
        sodium: Math.round(sum.sodium / validDaysCount),
        zinc: Math.round(sum.zinc / validDaysCount),
        copper: Math.round(sum.copper / validDaysCount),
        manganese: Math.round(sum.manganese / validDaysCount),
        selenium: Math.round(sum.selenium / validDaysCount),
        iodine: Math.round(sum.iodine / validDaysCount)
      };
    }

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

  const habitTranslations: Record<string, string> = {
    'Alcohol': 'Алкоголь',
    'Smoking': 'Курение',
    'Sugar': 'Избыток сахара/Сладкое'
  };

  const translatedHabits: Record<string, number> = {};
  for (const [key, count] of Object.entries(habitsCount)) {
    const translatedKey = habitTranslations[key] || (key === 'Привычка' ? 'Неизвестная привычка' : key);
    translatedHabits[translatedKey] = (translatedHabits[translatedKey] || 0) + (count as number);
  }

  // Compile contract
  const contract = {
    user_info: {
      name: user?.full_name || 'Пользователь',
      gender: user?.gender || 'unknown'
    },
    window: windowDays,
    valid_days: validDaysCount,
    valid_weekend_days: weekendDaysCount,
    coverage,
    flags,
    habits: translatedHabits,
    nutrients: {
      macros: {
        sufficient: macrosSufficient,
        days_required: CONFIG.THRESHOLD_MACRO,
        value: macrosValue,
        descriptive: forceShow ? "descriptive_data" : null
      },
      fiber_minerals: {
        sufficient: fiberMineralsSufficient,
        days_required: CONFIG.THRESHOLD_MINERALS,
        value: fiberMineralsValue,
        descriptive: forceShow ? "descriptive_data" : null
      },
      micros_vitamins: {
        sufficient: microsVitaminsSufficient,
        days_required: CONFIG.THRESHOLD_MICRO,
        value: microsVitaminsValue,
        descriptive: forceShow ? "descriptive_data" : null
      },
      water: {
        sufficient: validWaterDaysCount >= CONFIG.THRESHOLD_MACRO,
        days_required: CONFIG.THRESHOLD_MACRO,
        value: validWaterDaysCount >= CONFIG.THRESHOLD_MACRO ? { average_ml: averageWater, target_ml: Math.round(user?.target_water || 2600) } : null
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
