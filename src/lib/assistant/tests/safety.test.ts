import { describe, it, expect } from 'vitest';
import { validateLLMOutput } from '../safety';

describe('Safety Validator Tests (LLM Post-Check)', () => {
  it('should pass a valid, warm review', () => {
    const text = 'Я замечаю, что ваш организм сегодня показал хорошую реакцию. Вы отлично справились со сном.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it('should reject if missing the mandatory word "организм"', () => {
    const text = 'Я вижу, что сегодня показатели отличные. Сон был глубоким.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(false);
    expect(result.violations).toContain('MISSING_MANDATORY_WORD_ORGANISM');
  });

  it('should reject quantitative calorie assessments', () => {
    const text = 'Ваш организм потребил 1500 ккал сегодня. Это норма.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(false);
    expect(result.violations).toContain('QUANTITATIVE_CALORIE_ASSESSMENT_FORBIDDEN');
  });

  it('should reject percentage norms', () => {
    const text = 'Ваш организм получил 44% нормы железа.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(false);
    expect(result.violations).toContain('PERCENTAGE_NORM_FORBIDDEN');
  });

  it('should reject dosages', () => {
    const text = 'Организм нуждается в 200 мг магния дополнительно.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(false);
    expect(result.violations).toContain('DOSAGE_OR_EXACT_METRIC_FORBIDDEN');
  });

  it('should reject diet culture words', () => {
    const text = 'Чтобы похудение шло быстрее, ваш организм должна отдыхать.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(false);
    expect(result.violations).toContain('PROHIBITED_WORD_ПОХУДЕНИ');
    expect(result.violations).toContain('PROHIBITED_WORD_ДОЛЖНА');
  });

  it('should reject weight mentions', () => {
    const text = 'Это поможет вам добиться снижения веса быстрее.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(false);
    expect(result.violations).toContain('WEIGHT_MENTION_FORBIDDEN');
  });

  it('should reject compensatory behavior', () => {
    const text = 'Теперь нужно отработать вчерашний торт на тренировке.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(false);
    expect(result.violations).toContain('COMPENSATORY_BEHAVIOR_FORBIDDEN');
  });

  it('should reject direct causality claims', () => {
    const text = 'Вы ели поздно, из-за этого вы спали плохо.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(false);
    expect(result.violations).toContain('DIRECT_CAUSALITY_FORBIDDEN');
  });
});
