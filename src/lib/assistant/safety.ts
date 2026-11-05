export interface SafetyResult {
  isSafe: boolean;
  violations: string[];
  warnings: string[];
}

export interface SafetyGateResult {
  block: boolean;
  reason?: string;
  message?: string;
  emergencyNumber?: string;
}

/**
 * Emergency pattern detection (Pre-check)
 */
const EMERGENCY_PATTERNS = [
  { reason: 'CHEST_PAIN', regex: /(?<![а-яёa-z0-9])(?:бол[ьи]\s+в\s+груди|давит\s+в\s+груди|жжет\s+в\s+груди|приступ|инфаркт|инсульт)(?![а-яёa-z0-9])/iu },
  { reason: 'BREATHING_DIFFICULTY', regex: /(?<![а-яёa-z0-9])(?:одышк[а-яё]*\s+в\s+покое|задыхаю[а-яё]*|тяжело\s+дышать)(?![а-яёa-z0-9])/iu },
  { reason: 'LOSS_OF_CONSCIOUSNESS', regex: /(?<![а-яёa-z0-9])(?:теря[юлла]*\s+сознани[ея]|обморок[а-яё]*)(?![а-яёa-z0-9])/iu },
  { reason: 'HEAVY_BLEEDING', regex: /(?<![а-яёa-z0-9])кровотечен[а-яё]*(?![а-яёa-z0-9])/iu }
];

const CRISIS_PATTERNS = [
  /(?<![а-яёa-z0-9])(?:суицид[а-яё]*|не\s+хочу\s+жить|покончить\s+с\s+собой|навредить\s+себе|самоповрежден[а-яё]*)(?![а-яёa-z0-9])/iu
];

const ED_PATTERNS = [
  /(?<![а-яёa-z0-9])(?:булими[а-яё]*|анорекси[а-яё]*|вызыва[ют]*\s+рвоту|панический\s+страх\s+еды)(?![а-яёa-z0-9])/iu
];

/**
 * Pre-model safety filter. Checks for medical red flags, self-harm, and special medical conditions.
 */
export function safetyGate(ctx?: any, textOrLang?: string, explicitText?: string): SafetyGateResult {
  const inputText = explicitText || (typeof textOrLang === 'string' && textOrLang.length > 5 ? textOrLang : (ctx?.userText || ''));
  const lang = (ctx?.user?.lang || (typeof textOrLang === 'string' && textOrLang.length <= 5 ? textOrLang : 'ru')) || 'ru';
  const isEn = lang === 'en';

  // 1. Emergency Red Flags
  for (const item of EMERGENCY_PATTERNS) {
    if (item.regex.test(inputText)) {
      const emergencyNum = isEn ? '911 / 112' : '112 / 103';
      return {
        block: true,
        reason: item.reason,
        emergencyNumber: emergencyNum,
        message: isEn
          ? `These symptoms may require immediate medical assistance. Please contact emergency services right away (${emergencyNum}) or seek urgent medical care. I am an AI lifestyle assistant and cannot replace a medical professional.`
          : `Судя по описанию, эти симптомы могут требовать неотложной помощи. Пожалуйста, немедленно обратитесь в службу экстренной помощи (${emergencyNum}) или к врачу. Я — ИИ-ассистент по образу жизни и не заменяю медицинскую помощь.`
      };
    }
  }

  // 2. Self-Harm / Crisis Support
  for (const pattern of CRISIS_PATTERNS) {
    if (pattern.test(inputText)) {
      return {
        block: true,
        reason: 'CRISIS_SUPPORT',
        message: isEn
          ? `If you are feeling overwhelmed or having thoughts of self-harm, please know that you are not alone. Please reach out to a crisis helpline: in the US/Canada call or text 988, in the UK call 111, in international areas visit findahelpline.com.`
          : `Если вы переживаете тяжёлый момент или думаете о причинении себе вреда, пожалуйста, не оставайтесь наедине с этим. Обратитесь на бесплатную горячую линию психологической помощи: 8-800-200-01-22 или 8-800-200-47-03 (круглосуточно).`
      };
    }
  }

  // 3. Eating Disorder (ED) Signs
  for (const pattern of ED_PATTERNS) {
    if (pattern.test(inputText)) {
      return {
        block: true,
        reason: 'EATING_DISORDER_FLAG',
        message: isEn
          ? `We notice signs that may relate to an eating disorder. In this situation, digital calorie and weight tracking can be counterproductive. We gently suggest discussing your relationship with food with a qualified healthcare specialist.`
          : `Мы бережно относимся к вашему состоянию. При подобных симптомах строгий подсчёт и контроль могут принести вред. Рекомендуем мягко обсудить это со специалистом (психотерапевтом или врачом).`
      };
    }
  }

  // 4. Special Groups / Medical Context Flags
  const conditionFlags = ctx?.user?.conditionsFlags || ctx?.special_groups || [];
  if (Array.isArray(conditionFlags) && conditionFlags.length > 0) {
    const hasCriticalGroup = conditionFlags.some((f: string) => 
      ['pregnancy', 'kidney_disease', 'diabetes_insulin', 'anticoagulants', 'cvd'].includes(f)
    );
    if (hasCriticalGroup && ctx?.isClinicalQuery) {
      return {
        block: true,
        reason: 'SPECIAL_GROUP_CONSERVATIVE',
        message: isEn
          ? `Due to your individual health status, any specific lifestyle changes should be agreed upon with your supervising physician.`
          : `С учётом ваших индивидуальных особенностей здоровья любые изменения в питании и нагрузке важно согласовывать с лечащим врачом.`
      };
    }
  }

  return { block: false };
}

/**
 * Post-model safety filter. Verifies LLM output against safety guidelines and brand voice rules.
 */
export function validateLLMOutput(text: string, options?: { contract?: any }): SafetyResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  const lowerText = text.toLowerCase();

  // 1. Mandatory word check (WARNING only, not blocking)
  if (!lowerText.includes('организм')) {
    warnings.push('MISSING_MANDATORY_WORD_ORGANISM');
  }

  // 2. Prohibited exact words / diet culture using Cyrillic-safe lookaround
  const prohibitedPatterns = [
    { key: 'ДИЕТА', regex: /(?<![а-яёa-z0-9])диет[а-яё]*(?![а-яёa-z0-9])/iu },
    { key: 'ПОХУДЕНИ', regex: /(?<![а-яёa-z0-9])похуде[а-яё]*(?![а-яёa-z0-9])/iu },
    { key: 'СЖИГАНИ', regex: /(?<![а-яёa-z0-9])сжиган[а-яё]*(?![а-яёa-z0-9])/iu },
    { key: 'ЖИРОСЖИГАН', regex: /(?<![а-яёa-z0-9])жиросжиган[а-яё]*(?![а-яёa-z0-9])/iu },
    { key: 'СКИНУТЬ', regex: /(?<![а-яёa-z0-9])скинуть(?![а-яёa-z0-9])/iu },
    { key: 'ДОЛЖНА', regex: /(?<![а-яёa-z0-9])должна(?![а-яёa-z0-9])/iu },
    { key: 'ОБЯЗАНА', regex: /(?<![а-яёa-z0-9])обязана(?![а-яёa-z0-9])/iu }
  ];

  for (const { key, regex } of prohibitedPatterns) {
    if (regex.test(text)) {
      violations.push(`PROHIBITED_WORD_${key}`);
    }
  }

  // 3. Prohibited quantitative calorie assessment for daily evaluation
  // E.g. "потребил 1500 ккал сегодня. Это норма."
  const dailyCalorieRegex = /(?<![а-яёa-z0-9])\d+\s*(?:ккал|kcal|калорий)\s+(?:сегодня|вчера|за\s+день)(?![а-яёa-z0-9])|(?<![а-яёa-z0-9])\d+\s*(?:ккал|kcal|калорий)[^\n.!?]*\b(?:это\s+норма|дефицит|профицит|отработать|сожгли|сжечь)(?![а-яёa-z0-9])|(?<![а-яёa-z0-9])(?:потребил[а-яё]*|съел[а-яё]*)\s+\d+\s*(?:ккал|kcal|калорий)\s+сегодня(?![а-яёa-z0-9])/iu;
  if (dailyCalorieRegex.test(text)) {
    violations.push('QUANTITATIVE_CALORIE_ASSESSMENT_FORBIDDEN');
  }

  // Percentage norm forbidden (only when evaluated against nutrient norms, e.g. "44% нормы")
  // "покрытие 71%" is allowed
  const percentageNormRegex = /(?<![а-яёa-z0-9])\d+\s*%\s*(?:от\s+)?норм[а-яё]*(?![а-яёa-z0-9])/iu;
  if (percentageNormRegex.test(text)) {
    violations.push('PERCENTAGE_NORM_FORBIDDEN');
  }

  // Dosages addressed to a person (prescriptions / clinical dosages)
  // E.g. "принимайте 500 мг", "нуждается в 200 мг магния дополнительно"
  // Informational numbers like "белок 1,2 г на кг" or "содержит 150 мг" are allowed
  const dosageRegex = /(?<![а-яёa-z0-9])(?:нуждает[а-яё]*\s+в|добав(?:ить|ьте)?|принима(?:ть|й|йте)?|пейте|пей|капайте|колите|дозировк[а-яё]*|в\s+дозе|в\s+дозировке|курс|назнач[а-яё]*)\s+[^.!?\n]*?\d+(?:[.,]\d+)?\s*(?:мг|mg|мкг|mcg|ме|iu|таблет[а-яё]*|капсул[а-яё]*)/iu;
  const dosageDailyRegex = /(?<![а-яёa-z0-9])\d+(?:[.,]\d+)?\s*(?:мг|mg|мкг|mcg|ме|iu|таблет[а-яё]*|капсул[а-яё]*)\s+(?:дополнительно|в\s+сутки|в\s+день|утром|вечером|до\s+еды|после\s+еды|во\s+время\s+еды|ежедневно)(?![а-яёa-z0-9])/iu;
  if (dosageRegex.test(text) || dosageDailyRegex.test(text)) {
    violations.push('DOSAGE_OR_EXACT_METRIC_FORBIDDEN');
  }

  // Prohibited medical diagnoses
  const diagnosisRegex = /(?<![а-яёa-z0-9])(?:у\s+вас\s+(?:диагностирован[а-яё]*|диагноз|заболевание)|ставлю\s+диагноз|это\s+симптом\s+(?:диабета|болезни|рака|инфаркта))(?![а-яёa-z0-9])/iu;
  if (diagnosisRegex.test(text)) {
    violations.push('DIAGNOSIS_FORBIDDEN');
  }

  // 4. Weight and body changes (exact word "вес" or body mass phrases)
  // "весь", "привести", "весна", "равновесие", "провести" are NOT matched
  const weightRegex = /(?<![а-яёa-z0-9])вес(?![а-яёa-z0-9])|(?<![а-яёa-z0-9])(?:снижени[а-яё]*\s+веса|набор[а-яё]*\s+веса|набрать\s+вес|сбросить\s+вес|лишн[а-яё]*\s+вес[а-яё]*|контрол[а-яё]*\s+веса|колебани[а-яё]*\s+веса|вес[а-яё]*\s+тел[а-яё]*|похудел[а-яё]*|набор[а-яё]*\s+массы)(?![а-яёa-z0-9])/iu;
  if (weightRegex.test(text)) {
    violations.push('WEIGHT_MENTION_FORBIDDEN');
  }

  // 5. Compensation / workout to eat
  const compensationRegex = /(?<![а-яёa-z0-9])(?:отработ(?:ка|ать|ан)|компенсаци[а-яё]*|заслужить\s+еду)(?![а-яёa-z0-9])/iu;
  if (compensationRegex.test(text)) {
    violations.push('COMPENSATORY_BEHAVIOR_FORBIDDEN');
  }

  // 6. Direct causality instead of correlation (WARNING only, not blocking)
  const causalRegex = /(?<![а-яёa-z0-9])(?:из-за\s+этого|поэтому\s+вы|привело\s+к)(?![а-яёa-z0-9])/iu;
  if (causalRegex.test(text)) {
    warnings.push('DIRECT_CAUSALITY_WARNING');
  }

  return {
    isSafe: violations.length === 0,
    violations,
    warnings
  };
}

export function extractAllNumbers(obj: any): Set<number> {
  const nums = new Set<number>();
  
  function traverse(item: any) {
    if (item === null || item === undefined) return;
    
    if (typeof item === 'number') {
      nums.add(item);
    } else if (typeof item === 'string') {
      const matches = item.match(/\d+/g);
      if (matches) {
        matches.forEach(m => nums.add(parseInt(m, 10)));
      }
    } else if (Array.isArray(item)) {
      item.forEach(traverse);
    } else if (typeof item === 'object') {
      Object.values(item).forEach(traverse);
    }
  }
  
  traverse(obj);
  return nums;
}

export function verifyNumbers(text: string, contract: any): { valid: boolean; invalidNumbers: number[] } {
  const textMatches = text.match(/\d+/g);
  if (!textMatches) {
    return { valid: true, invalidNumbers: [] };
  }
  
  const generatedNumbers = Array.from(new Set(textMatches.map(m => parseInt(m, 10))));
  const contractNumbers = extractAllNumbers(contract);
  
  const invalidNumbers: number[] = [];
  
  for (const num of generatedNumbers) {
    if (!contractNumbers.has(num)) {
      invalidNumbers.push(num);
    }
  }
  
  return {
    valid: invalidNumbers.length === 0,
    invalidNumbers
  };
}
