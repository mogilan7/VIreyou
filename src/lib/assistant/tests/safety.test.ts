import { describe, it, expect } from 'vitest';
import { validateLLMOutput, safetyGate } from '../safety';

describe('Safety Validator Tests (LLM Post-Check)', () => {
  it('1. should pass a valid, warm review with organism', () => {
    const text = 'Я замечаю, что ваш организм сегодня показал хорошую реакцию. Вы отлично справились со сном.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it('2. should warn (not block) if missing the word "организм"', () => {
    const text = 'Я вижу, что сегодня показатели отличные. Сон был глубоким.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(true);
    expect(result.warnings).toContain('MISSING_MANDATORY_WORD_ORGANISM');
  });

  it('3. should reject quantitative daily calorie assessments', () => {
    const text = 'Ваш организм потребил 1500 ккал сегодня. Это норма.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(false);
    expect(result.violations).toContain('QUANTITATIVE_CALORIE_ASSESSMENT_FORBIDDEN');
  });

  it('4. should reject nutrient percentage norms', () => {
    const text = 'Ваш организм получил 44% нормы железа.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(false);
    expect(result.violations).toContain('PERCENTAGE_NORM_FORBIDDEN');
  });

  it('5. should reject personal dosages addressed to user', () => {
    const text = 'Организм нуждается в 200 мг магния дополнительно.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(false);
    expect(result.violations).toContain('DOSAGE_OR_EXACT_METRIC_FORBIDDEN');
  });

  it('6. should reject prescription instructions', () => {
    const text = 'Принимайте 500 мг омега-3 ежедневно.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(false);
    expect(result.violations).toContain('DOSAGE_OR_EXACT_METRIC_FORBIDDEN');
  });

  it('7. should reject diet culture words', () => {
    const text = 'Чтобы похудение шло быстрее, ваш организм должна отдыхать.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(false);
    expect(result.violations).toContain('PROHIBITED_WORD_ПОХУДЕНИ');
    expect(result.violations).toContain('PROHIBITED_WORD_ДОЛЖНА');
  });

  it('8. should reject weight loss and gain claims', () => {
    const text = 'Это поможет вам добиться снижения веса быстрее.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(false);
    expect(result.violations).toContain('WEIGHT_MENTION_FORBIDDEN');
  });

  it('9. should reject standalone weight mentions', () => {
    const text = 'Ваш вес изменился за последние дни.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(false);
    expect(result.violations).toContain('WEIGHT_MENTION_FORBIDDEN');
  });

  it('10. should reject compensatory behavior', () => {
    const text = 'Теперь нужно отработать вчерашний торт на тренировке.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(false);
    expect(result.violations).toContain('COMPENSATORY_BEHAVIOR_FORBIDDEN');
  });

  it('11. should warn (not block) on direct causality claims', () => {
    const text = 'Вы ели поздно, из-за этого вы спали плохо. Организм восстановится.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(true);
    expect(result.warnings).toContain('DIRECT_CAUSALITY_WARNING');
  });

  it('12. should reject medical diagnosis claims', () => {
    const text = 'У вас диагностирован синдром хронической усталости.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(false);
    expect(result.violations).toContain('DIAGNOSIS_FORBIDDEN');
  });

  // False positive checks requested by user
  it('13. false positive check: "весь день" must pass', () => {
    const text = 'Весь день организм сохранял стабильный ритм и энергию.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(true);
    expect(result.violations).not.toContain('WEIGHT_MENTION_FORBIDDEN');
  });

  it('14. false positive check: "привести сон в порядок" must pass', () => {
    const text = 'Попробуем привести сон в порядок и дать организму ресурс.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(true);
    expect(result.violations).not.toContain('WEIGHT_MENTION_FORBIDDEN');
  });

  it('15. false positive check: "весна" must pass', () => {
    const text = 'Весна — отличное время, чтобы организм получал больше прогулок на солнце.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(true);
    expect(result.violations).not.toContain('WEIGHT_MENTION_FORBIDDEN');
  });

  it('16. false positive check: "покрытие 71%" must pass', () => {
    const text = 'Покрытие 71% за неделю позволяет организму увидеть устойчивый тренд.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(true);
    expect(result.violations).not.toContain('PERCENTAGE_NORM_FORBIDDEN');
  });

  it('17. false positive check: "белок 1,2 г на кг" must pass', () => {
    const text = 'Ориентир по питанию — белок 1,2 г на кг массы для поддержки мышц.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(true);
    expect(result.violations).not.toContain('DOSAGE_OR_EXACT_METRIC_FORBIDDEN');
  });

  it('18. false positive check: nutrient content in food (omega-3 and mg) must pass', () => {
    const text = 'В порции лосося содержится омега-3 1,6 г, а в шпинате — около 150 мг магния для организма.';
    const result = validateLLMOutput(text);
    expect(result.isSafe).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it('19. fallback template must pass safety checks without violations', () => {
    const fallback = 'Сегодня без подробного разбора: данные дня сохранены, завтра посмотрим на них вместе 💛';
    const result = validateLLMOutput(fallback);
    expect(result.isSafe).toBe(true);
    expect(result.violations.length).toBe(0);
  });
});

describe('Safety Gate Tests (Pre-Check)', () => {
  it('20. should block emergency chest pain with 112/103', () => {
    const result = safetyGate({}, 'У меня острая боль в груди и тяжело дышать');
    expect(result.block).toBe(true);
    expect(result.reason).toBe('CHEST_PAIN');
    expect(result.message).toContain('112 / 103');
  });

  it('21. should block emergency shortness of breath at rest', () => {
    const result = safetyGate({}, 'Внезапная одышка в покое, тяжело дышать');
    expect(result.block).toBe(true);
    expect(result.reason).toBe('BREATHING_DIFFICULTY');
  });

  it('22. should block crisis and self-harm thoughts with adult helpline', () => {
    const result = safetyGate({}, 'Мне очень плохо, не хочу жить');
    expect(result.block).toBe(true);
    expect(result.reason).toBe('CRISIS_SUPPORT');
    expect(result.message).toContain('8-800-333-44-34');
  });

  it('23. should provide international emergency number for EN users without RU numbers', () => {
    const result = safetyGate({ user: { lang: 'en' } }, 'Severe crushing chest pain');
    expect(result.block).toBe(true);
    expect(result.reason).toBe('CHEST_PAIN');
    expect(result.message).toContain('112 or your local emergency number');
    expect(result.message).not.toContain('103');
  });

  it('24. should provide international crisis helpline for EN users without RU numbers', () => {
    const result = safetyGate({ user: { lang: 'en' } }, 'I cannot go on, thoughts of suicide');
    expect(result.block).toBe(true);
    expect(result.reason).toBe('CRISIS_SUPPORT');
    expect(result.message).toContain('988');
    expect(result.message).not.toContain('8-800');
  });

  it('25. should block eating disorder triggers gently', () => {
    const result = safetyGate({}, 'У меня панический страх еды и вызываю рвоту после ужина');
    expect(result.block).toBe(true);
    expect(result.reason).toBe('EATING_DISORDER_FLAG');
  });

  it('26. should pass safe questions about sleep and activity', () => {
    const result = safetyGate({}, 'Как мне улучшить глубокий сон и восстановить силы?');
    expect(result.block).toBe(false);
  });
});
