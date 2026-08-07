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

  const bmr = calculateBMR(user.weight || 0, user.height || 0, user.age || 0, user.gender || 'unknown');
  const minKcal = Math.max(bmr * MIN_EI_BMR_RATIO, MIN_KCAL_FALLBACK);

  const nutritionLogs = await prisma.nutritionLog.findMany({
    where: { user_id: userId, date: { gte: windowStart } },
    orderBy: { date: 'asc' }
  });

  // Group by date (assuming nutritionLogs are per entry, we need to sum per day)
  // Or if nutritionLogs are already aggregated per day, we check them directly.
  // Assuming they are daily aggregates for this user:
  
  const validDays = [];
  const excludedDays = [];
  let weekendDaysCount = 0;

  for (const log of nutritionLogs) {
    // We assume log has kcal and meals_count fields or we count them
    // If meals count is not in DB, we'd have to approximate or update schema.
    // For now, let's assume valid if kcal > minKcal and kcal < MAX_KCAL_PER_DAY
    const kcal = (log as any).calories || (log as any).kcal || 0; // Replace with actual field
    const isAnomalous = kcal > MAX_KCAL_PER_DAY;
    const isSufficientEnergy = kcal >= minKcal;
    
    // Check meals count (stub: assuming 3 meals for now if kcal > minKcal, in reality check Meal table)
    const mealsCount = 3; 
    
    if (!isAnomalous && isSufficientEnergy && mealsCount >= MIN_MEALS_PER_DAY) {
      validDays.push(log);
      if (log.date && isWeekend(log.date)) weekendDaysCount++;
    } else {
      excludedDays.push({ date: log.date, reason: isAnomalous ? 'anomalous' : 'insufficient' });
    }
  }

  return {
    validDays,
    excludedDays,
    weekendDaysCount,
    coverage: validDays.length / windowDays,
    lastEntryDate: validDays.length > 0 ? validDays[validDays.length - 1].date : null
  };
}

export async function generateNutrientAssessment(userId: string, windowDays: number = 14, forceShow: boolean = false) {
  const { validDays, excludedDays, weekendDaysCount, coverage, lastEntryDate } = await getValidDays(userId, windowDays);
  
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

  // Compile contract
  const contract = {
    window: windowDays,
    valid_days: validDaysCount,
    valid_weekend_days: weekendDaysCount,
    coverage,
    flags,
    nutrients: {
      macros: {
        sufficient: macrosSufficient,
        days_required: GATING.MACROS,
        value: macrosSufficient ? "calculated_mean" : null, // TODO: Compute actual mean
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
