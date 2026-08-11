import { CONFIG } from "./config";
import { getLocalDate } from "./ingest";

// Function to calculate estimated BMR if not available
export function calculateBMR(weight: number, height: number, age: number, gender: string): number {
  if (!weight || !height || !age || !gender) return CONFIG.MIN_KCAL_FALLBACK / CONFIG.MIN_EI_BMR_RATIO; 
  // Mifflin-St Jeor Equation
  let bmr = (10 * weight) + (6.25 * height) - (5 * age);
  return gender.toLowerCase() === 'male' ? bmr + 5 : bmr - 161;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[half];
  return (sorted[half - 1] + sorted[half]) / 2.0;
}

export interface DayAggregation {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  meals: number;
  date: Date;
}

export function validateNutritionDays(
  dailySums: Record<string, DayAggregation>, 
  minKcal: number
) {
  const validDays: DayAggregation[] = [];
  const excludedDays: { date: Date, reason: string }[] = [];
  let weekendDaysCount = 0;

  for (const dayStr of Object.keys(dailySums)) {
    const dayData = dailySums[dayStr];
    const isAnomalous = dayData.kcal > CONFIG.MAX_KCAL_PER_DAY;
    const isSufficientEnergy = dayData.kcal >= minKcal;
    
    if (!isAnomalous && isSufficientEnergy && dayData.meals >= CONFIG.MIN_MEALS_PER_DAY) {
      validDays.push(dayData);
      if (isWeekend(dayData.date)) weekendDaysCount++;
    } else {
      excludedDays.push({ 
        date: dayData.date, 
        reason: isAnomalous ? 'anomalous' : 'below_threshold' 
      });
    }
  }

  validDays.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  return { validDays, excludedDays, weekendDaysCount };
}

export function aggregateNutritionDays(nutritionLogs: any[], timezone: string = "Europe/Moscow"): Record<string, DayAggregation> {
  const dailySums: Record<string, DayAggregation> = {};

  for (const log of nutritionLogs) {
    // Determine the local date string (YYYY-MM-DD) for grouping
    // Assuming date is a Date object. We should format it into the target timezone.
    const dateObj = new Date(log.date);
    const dateStr = new Intl.DateTimeFormat('en-CA', { 
      timeZone: timezone, 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).format(dateObj); // returns YYYY-MM-DD

    if (!dailySums[dateStr]) {
      // Use the middle of the day in local time for the Date object
      dailySums[dateStr] = {
        kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, meals: 0,
        date: new Date(`${dateStr}T12:00:00Z`)
      };
    }

    const day = dailySums[dateStr];
    day.kcal += log.calories || 0;
    day.protein += log.protein || 0;
    day.carbs += log.carbs || 0;
    day.fat += log.fat || 0;
    day.fiber += log.fiber || 0;
    day.meals += 1;
  }

  return dailySums;
}
