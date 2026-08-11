import { describe, it, expect } from 'vitest';
import { validateNutritionDays, calculateBMR, isWeekend, DayAggregation } from '../validity';
import { CONFIG } from '../config';

describe('Validity Layer Tests', () => {
  it('should calculate BMR correctly', () => {
    // Male: 10*70 + 6.25*175 - 5*30 + 5 = 700 + 1093.75 - 150 + 5 = 1648.75
    const maleBmr = calculateBMR(70, 175, 30, 'male');
    expect(maleBmr).toBeCloseTo(1648.75);

    // Female: 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25
    const femaleBmr = calculateBMR(60, 165, 25, 'female');
    expect(femaleBmr).toBeCloseTo(1345.25);
  });

  it('should fall back to minimum fallback BMR if data is missing', () => {
    const fallbackBmr = calculateBMR(0, 0, 0, '');
    expect(fallbackBmr).toEqual(CONFIG.MIN_KCAL_FALLBACK / CONFIG.MIN_EI_BMR_RATIO);
  });

  it('should correctly identify weekends', () => {
    const sunday = new Date('2026-08-09T10:00:00Z');
    const monday = new Date('2026-08-10T10:00:00Z');
    const saturday = new Date('2026-08-15T10:00:00Z');

    expect(isWeekend(sunday)).toBe(true);
    expect(isWeekend(saturday)).toBe(true);
    expect(isWeekend(monday)).toBe(false);
  });

  it('День с одной записью на 300 ккал не попадает в расчёт и не увеличивает покрытие', () => {
    const minKcal = 1500 * 0.6; // 900
    const dailySums: Record<string, DayAggregation> = {
      '2026-08-01': { kcal: 300, protein: 10, carbs: 20, fat: 5, fiber: 2, meals: 1, date: new Date('2026-08-01T12:00:00Z') }
    };

    const result = validateNutritionDays(dailySums, minKcal);
    expect(result.validDays.length).toBe(0);
    expect(result.excludedDays.length).toBe(1);
    expect(result.excludedDays[0].reason).toBe('below_threshold');
  });

  it('should exclude anomalous days > MAX_KCAL', () => {
    const minKcal = 1500 * 0.6; // 900
    const dailySums: Record<string, DayAggregation> = {
      '2026-08-01': { kcal: 7000, protein: 100, carbs: 200, fat: 50, fiber: 20, meals: 3, date: new Date('2026-08-01T12:00:00Z') }
    };

    const result = validateNutritionDays(dailySums, minKcal);
    expect(result.validDays.length).toBe(0);
    expect(result.excludedDays.length).toBe(1);
    expect(result.excludedDays[0].reason).toBe('anomalous');
  });

  it('should include valid days', () => {
    const minKcal = 1500 * 0.6; // 900
    const dailySums: Record<string, DayAggregation> = {
      '2026-08-01': { kcal: 1800, protein: 100, carbs: 150, fat: 60, fiber: 25, meals: 3, date: new Date('2026-08-01T12:00:00Z') },
      '2026-08-02': { kcal: 1200, protein: 60, carbs: 100, fat: 40, fiber: 15, meals: 2, date: new Date('2026-08-02T12:00:00Z') }, // SUNDAY
    };

    const result = validateNutritionDays(dailySums, minKcal);
    expect(result.validDays.length).toBe(2);
    expect(result.excludedDays.length).toBe(0);
    expect(result.weekendDaysCount).toBe(2); // Saturday and Sunday
  });
});
