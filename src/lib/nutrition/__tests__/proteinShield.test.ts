import { describe, it, expect } from 'vitest';
import { calcProteinShield, ProteinInput } from '../proteinShield';

describe('calcProteinShield', () => {
  it('кейс 1: ж, 30 лет, 60 кг, 168 см, кардио (moderate), похудение (lose), почки «нет»', () => {
    const input: ProteinInput = {
      sex: 'female',
      age: 30,
      weightKg: 60,
      heightCm: 168,
      activity: 'moderate',
      goal: 'lose',
      kidneyDisease: 'no',
    };
    const res = calcProteinShield(input);
    expect(res.status).toBe('ok');
    expect(res.gramsLow).toBe(70);
    expect(res.gramsHigh).toBe(95);
    expect(res.gPerKgLow).toBe(1.2);
    expect(res.gPerKgHigh).toBe(1.6);
  });

  it('кейс 2: ж, 67 лет, 70 кг, 162 см, мало движения (low), поддержание (maintain), почки «нет»', () => {
    const input: ProteinInput = {
      sex: 'female',
      age: 67,
      weightKg: 70,
      heightCm: 162,
      activity: 'low',
      goal: 'maintain',
      kidneyDisease: 'no',
      mealsPerDay: 3,
    };
    const res = calcProteinShield(input);
    expect(res.status).toBe('ok');
    expect(res.gramsLow).toBe(70);
    expect(res.gramsHigh).toBe(85);
    expect(res.gPerKgLow).toBe(1.0);
    expect(res.gPerKgHigh).toBe(1.2);
    expect(res.perMealLow).toBe(25);
    expect(res.perMealHigh).toBe(30);
  });

  it('кейс 3: м, 50 лет, 110 кг, 175 см, мало движения (low), похудение (lose), «не знаю»', () => {
    const input: ProteinInput = {
      sex: 'male',
      age: 50,
      weightKg: 110,
      heightCm: 175,
      activity: 'low',
      goal: 'lose',
      kidneyDisease: 'unknown',
    };
    const res = calcProteinShield(input);
    expect(res.status).toBe('ok');
    expect(res.bmi).toBe(35.9);
    expect(res.usedAdjustedWeight).toBe(true);
    expect(res.referenceWeightKg).toBe(77);
    expect(res.gramsLow).toBe(90);
    expect(res.gramsHigh).toBe(125);
    expect(res.notes.some(n => n.includes('почек'))).toBe(true);
  });

  it('кейс 4: м, 50 лет, 80 кг, 180 см, любые, почки «да»', () => {
    const input: ProteinInput = {
      sex: 'male',
      age: 50,
      weightKg: 80,
      heightCm: 180,
      activity: 'moderate',
      goal: 'maintain',
      kidneyDisease: 'yes',
    };
    const res = calcProteinShield(input);
    expect(res.status).toBe('see_doctor');
    expect(res.gramsLow).toBeUndefined();
    expect(res.gramsHigh).toBeUndefined();
    expect(res.notes.length).toBeGreaterThan(0);
    expect(res.sources).toContain('protage');
  });

  it('кейс 5: м, 25 лет, 90 кг, 185 см, тяжёлый труд (heavy), нарастить мышцы (gain_muscle)', () => {
    const input: ProteinInput = {
      sex: 'male',
      age: 25,
      weightKg: 90,
      heightCm: 185,
      activity: 'heavy',
      goal: 'gain_muscle',
      kidneyDisease: 'no',
    };
    const res = calcProteinShield(input);
    expect(res.status).toBe('ok');
    expect(res.gramsLow).toBe(110);
    expect(res.gramsHigh).toBe(145);
    expect(res.gPerKgLow).toBe(1.2);
    expect(res.gPerKgHigh).toBe(1.6);
  });

  it('кейс 6: границы — возраст 17 и 111, вес 29 и 301 вызывают ошибку валидации', () => {
    const base: ProteinInput = {
      sex: 'female',
      age: 30,
      weightKg: 60,
      heightCm: 168,
      activity: 'moderate',
      goal: 'maintain',
      kidneyDisease: 'no',
    };

    expect(() => calcProteinShield({ ...base, age: 17 })).toThrow();
    expect(() => calcProteinShield({ ...base, age: 111 })).toThrow();
    expect(() => calcProteinShield({ ...base, weightKg: 29 })).toThrow();
    expect(() => calcProteinShield({ ...base, weightKg: 301 })).toThrow();
    expect(() => calcProteinShield({ ...base, heightCm: 119 })).toThrow();
    expect(() => calcProteinShield({ ...base, heightCm: 231 })).toThrow();
  });
});
