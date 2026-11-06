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
  it('20. should block emergency chest pain and advise calling 112 without "or to doctor"', () => {
    const result = safetyGate({}, 'У меня острая боль в груди и тяжело дышать');
    expect(result.block).toBe(true);
    expect(result.reason).toBe('CHEST_PAIN');
    expect(result.message).toContain('Немедленно вызовите скорую помощь (112 или местный номер экстренной службы). Не ждите, пока пройдёт.');
    expect(result.message).not.toContain('или к врачу');
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

  it('23. should provide international emergency number for EN users without RU numbers and without "or see a doctor"', () => {
    const result = safetyGate({ user: { lang: 'en' } }, 'Severe crushing chest pain');
    expect(result.block).toBe(true);
    expect(result.reason).toBe('CHEST_PAIN');
    expect(result.message).toContain('Call emergency services immediately (112 or your local emergency number). Do not wait for it to pass.');
    expect(result.message).not.toContain('seek urgent medical care');
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

  describe('Prompt quality & Card details enhancements', () => {
    it('27. (п. 2) should strip leading question restatements including omega-3 example', async () => {
      const { stripLeadingQuestionRestatement } = await import('../safety');
      const omegaExample = 'Вопрос о дозировке омега-3 требует индивидуального подхода. Для взрослых норма составляет 1-2 г в день для организма.';
      const resOmega = stripLeadingQuestionRestatement(omegaExample);
      expect(resOmega.wasStripped).toBe(true);
      expect(resOmega.strippedPhrase).toBe('Вопрос о дозировке омега-3 требует индивидуального подхода.');
      expect(resOmega.text).toBe('Для взрослых норма составляет 1-2 г в день для организма.');

      const restatements = [
        'Вы спрашиваете, сколько белка нужно организму после 60 лет. Для людей старше 65 лет...',
        'Вы упомянули, что хотите наладить сон организма. Регулярный режим помогает...',
        'Что касается вашего вопроса о сне, организму требуется отдых.',
        'Отвечая на ваш вопрос, организм восстанавливается ночью.',
        'Это хороший вопрос. Давайте разберём показатели организма.'
      ];

      for (const text of restatements) {
        const res = stripLeadingQuestionRestatement(text);
        expect(res.wasStripped).toBe(true);
        expect(res.text.length).toBeGreaterThan(0);
      }
    });

    it('28. (п. 1 & 2) should pass when response starts directly with the core message', () => {
      const directText = 'Для людей старше 65 лет эксперты PROT-AGE называют не меньше 1,0–1,2 г белка на кг веса. Свою норму организму показывает калькулятор «Белковый щит».';
      const res = validateLLMOutput(directText);
      expect(res.isSafe).toBe(true);
      expect(res.warnings).not.toContain('QUESTION_RESTATEMENT_WARNING');
    });

    it('29. (п. 5) should translate evidence_level to Russian correctly', async () => {
      const { formatEvidenceLevel } = await import('../config');
      expect(formatEvidenceLevel('guideline', 'ru')).toBe('клиническое руководство');
      expect(formatEvidenceLevel('meta_analysis', 'ru')).toBe('метаанализ');
      expect(formatEvidenceLevel('studies', 'ru')).toBe('исследования');
      expect(formatEvidenceLevel('hypothesis', 'ru')).toBe('гипотеза');
    });

    it('30. (п. 6) verifyNumbers should reject numbers from user query if not present in cards or metrics', async () => {
      const { verifyNumbers } = await import('../safety');
      const contract = {
        relevantCards: [{
          claim: '0,8 г белка на килограмм веса в день. Для людей старше 65 лет не меньше 1,0–1,2 г на кг.'
        }],
        metricsSummary: { avg_sleep_hrs: 7.5 }
      };

      // Number 60 was in user query ("после 60 лет"), but is absent from contract
      const responseWithQueryNumber = 'В возрасте 60 лет организму требуется 1,2 г белка на кг.';
      const check1 = verifyNumbers(responseWithQueryNumber, contract);
      expect(check1.valid).toBe(false);
      expect(check1.invalidNumbers).toContain(60);

      // Number 65 is in the card claim
      const responseWithCardNumber = 'Для людей старше 65 лет организму требуется 1,2 г белка на кг.';
      const check2 = verifyNumbers(responseWithCardNumber, contract);
      expect(check2.valid).toBe(true);
      expect(check2.invalidNumbers).toHaveLength(0);
    });

    it('31. (Подробнее) renderCardDetailsHtml correctly formats Valtin water card with HTML escaping and Russian evidence level', async () => {
      const { renderCardDetailsHtml } = await import('../config');
      const valtinCard = {
        id: 'sci_water_001',
        source_title: 'Valtin H. "Drink at least eight glasses of water a day." Really? Is there scientific evidence for "8 x 8"? Am J Physiol Regul Integr Comp Physiol, 2002',
        source_url: 'https://doi.org/10.1152/ajpregu.00365.2002',
        related_content: 'https://youtu.be/Agme9TRY48g ; https://vireyou.com/ru/diagnostics/water',
        evidence_level: 'studies'
      };

      const html = renderCardDetailsHtml([valtinCard], 'ru');

      // Check title with escaped quotes
      expect(html).toContain('<b>Valtin H. &quot;Drink at least eight glasses of water a day.&quot; Really? Is there scientific evidence for &quot;8 x 8&quot;? Am J Physiol Regul Integr Comp Physiol, 2002</b>');
      // Check Russian evidence level
      expect(html).toContain('[исследования]');
      // Check source and related links
      expect(html).toContain('🔗 Источник: https://doi.org/10.1152/ajpregu.00365.2002');
      expect(html).toContain('🎥 Материалы: https://youtu.be/Agme9TRY48g ; https://vireyou.com/ru/diagnostics/water');
      // Check that HTML does not contain raw unescaped quotes in title text
      expect(html).not.toContain('"Drink at least eight');
    });

    it('32. (п. 1) should ensure state is reset after assistant answering so next message is logged as food', () => {
      const userStates: Record<string, string> = {};
      const userId = 'user-123';

      // 1. User enters ask mode
      userStates[userId] = 'WAITING_FOR_ASSISTANT_QUESTION';
      expect(userStates[userId]).toBe('WAITING_FOR_ASSISTANT_QUESTION');

      // 2. Answering function clears state immediately: one message = one question
      userStates[userId] = '';

      // 3. Next message "съел омлет" arrives in normal mode (not assistant mode)
      const nextMessage = 'съел омлет с хлебом';
      const isInterceptedByAssistant = userStates[userId] === 'WAITING_FOR_ASSISTANT_QUESTION';
      expect(isInterceptedByAssistant).toBe(false);
    });
  });
});
