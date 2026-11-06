import { CRISIS_CONTACTS } from './config';

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
  { reason: 'CHEST_PAIN', regex: /(?<![а-яёa-z0-9])(?:бол[ьи]\s+в\s+груди|давит\s+в\s+груди|жжет\s+в\s+груди|приступ|инфаркт|инсульт|chest\s+pain|heart\s+attack|stroke)(?![а-яёa-z0-9])/iu },
  { reason: 'BREATHING_DIFFICULTY', regex: /(?<![а-яёa-z0-9])(?:одышк[а-яё]*\s+в\s+покое|задыхаю[а-яё]*|тяжело\s+дышать|shortness\s+of\s+breath|cannot\s+breathe|hard\s+to\s+breathe)(?![а-яёa-z0-9])/iu },
  { reason: 'LOSS_OF_CONSCIOUSNESS', regex: /(?<![а-яёa-z0-9])(?:теря[юлла]*\s+сознани[ея]|обморок[а-яё]*|faint(?:ed|ing)?|lost\s+consciousness|passing\s+out)(?![а-яёa-z0-9])/iu },
  { reason: 'HEAVY_BLEEDING', regex: /(?<![а-яёa-z0-9])(?:кровотечен[а-яё]*|severe\s+bleeding|heavy\s+bleeding)(?![а-яёa-z0-9])/iu }
];

const CRISIS_PATTERNS = [
  /(?<![а-яёa-z0-9])(?:суицид[а-яё]*|не\s+хочу\s+жить|покончить\s+с\s+собой|навредить\s+себе|самоповрежден[а-яё]*|suicid[a-z]*|kill\s+myself|want\s+to\s+die|self-harm|end\s+my\s+life)(?![а-яёa-z0-9])/iu
];

const ED_PATTERNS = [
  /(?<![а-яёa-z0-9])(?:булими[а-яё]*|анорекси[а-яё]*|вызыва[ют]*\s+рвоту|панический\s+страх\s+еды|bulimi[a-z]*|anorexi[a-z]*|purging|fear\s+of\s+eating)(?![а-яёa-z0-9])/iu
];

/**
 * Pre-model safety filter. Checks for medical red flags, self-harm, and special medical conditions.
 */
export function safetyGate(ctx?: any, textOrLang?: string, explicitText?: string): SafetyGateResult {
  const inputText = explicitText || (typeof textOrLang === 'string' && textOrLang.length > 5 ? textOrLang : (ctx?.userText || ''));
  const lang = (ctx?.user?.lang || (typeof textOrLang === 'string' && textOrLang.length <= 5 ? textOrLang : 'ru')) || 'ru';
  const isEn = lang === 'en';

  const contacts = isEn ? CRISIS_CONTACTS.en : CRISIS_CONTACTS.ru;

  // 1. Emergency Red Flags
  for (const item of EMERGENCY_PATTERNS) {
    if (item.regex.test(inputText)) {
      const emergencyNum = contacts.emergency;
      return {
        block: true,
        reason: item.reason,
        emergencyNumber: emergencyNum,
        message: isEn
          ? `These symptoms may require immediate medical assistance. Call emergency services immediately (112 or your local emergency number). Do not wait for it to pass. I am an AI lifestyle assistant and cannot replace a medical professional.`
          : `Судя по описанию, эти симптомы могут требовать неотложной помощи. Немедленно вызовите скорую помощь (112 или местный номер экстренной службы). Не ждите, пока пройдёт. Я — ИИ-ассистент по образу жизни и не заменяю медицинскую помощь.`
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
          ? `If you are feeling overwhelmed or having thoughts of self-harm, please know that you are not alone. Please reach out to ${contacts.crisisDescription}.`
          : `Если вы переживаете тяжёлый момент или думаете о причинении себе вреда, пожалуйста, не оставайтесь наедине с этим. ${contacts.crisisDescription} (круглосуточно).`
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
 * Strips leading question restatements from LLM output.
 * E.g. "Вопрос о дозировке омега-3 требует индивидуального подхода." -> stripped
 * "Вы спрашиваете, сколько нужно пить воды..." -> stripped
 * "Что касается вашего вопроса о сне..." -> stripped
 */
export function stripLeadingQuestionRestatement(text: string): { text: string; wasStripped: boolean; strippedPhrase?: string } {
  if (!text) return { text: '', wasStripped: false };
  const trimmed = text.trim();

  const restatementRegex = /^(?:(?:вы\s+(?:спрашиваете|спросили|упомянули|интересуетесь|хотите\s+узнать)[^\n.!?,;:]*|что\s+касается\s+[^\n.!?,;:]+|отвечая\s+на\s+[^\n.!?,;:]+|вопрос\s+(?:о|об|про|[^\n.!?,;:]+)\s*(?:требует|заключается|состоит|является|важен)[^\n.!?,;:]*|вопрос\s+(?:о|об|про)[^\n.!?,;:]+|(?:это\s+)?(?:хороший|интересный|важный|отличный)\s+вопрос[^\n.!?,;:]*|regarding\s+(?:your\s+)?question[^\n.!?,;:]*|as\s+for\s+(?:your\s+)?question[^\n.!?,;:]*|you(?:'re|\s+are)?\s+asking[^\n.!?,;:]*|(?:this\s+is\s+a\s+)?good\s+question[^\n.!?,;:]*)[?.!:\n,]\s*)/iu;

  const match = trimmed.match(restatementRegex);
  if (match) {
    const strippedPhrase = match[0].trim();
    const restOfText = trimmed.slice(match[0].length).trim();
    return {
      text: restOfText,
      wasStripped: true,
      strippedPhrase
    };
  }

  return { text: trimmed, wasStripped: false };
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

  // Question restatement check: warning only, post-processing strips it
  const restatementRegex = /^(?:(?:вы\s+(?:спрашиваете|спросили|упомянули|интересуетесь|хотите\s+узнать)[^\n.!?,;:]*|что\s+касается\s+[^\n.!?,;:]+|отвечая\s+на\s+[^\n.!?,;:]+|вопрос\s+(?:о|об|про|[^\n.!?,;:]+)\s*(?:требует|заключается|состоит|является|важен)[^\n.!?,;:]*|вопрос\s+(?:о|об|про)[^\n.!?,;:]+|(?:это\s+)?(?:хороший|интересный|важный|отличный)\s+вопрос[^\n.!?,;:]*|regarding\s+(?:your\s+)?question[^\n.!?,;:]*|as\s+for\s+(?:your\s+)?question[^\n.!?,;:]*|you(?:'re|\s+are)?\s+asking[^\n.!?,;:]*|(?:this\s+is\s+a\s+)?good\s+question[^\n.!?,;:]*)[?.!:\n,]\s*)/iu;
  if (restatementRegex.test(text.trim())) {
    warnings.push('QUESTION_RESTATEMENT_WARNING');
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
