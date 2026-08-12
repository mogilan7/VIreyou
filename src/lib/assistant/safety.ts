export interface SafetyResult {
  isSafe: boolean;
  violations: string[];
}

export function validateLLMOutput(text: string): SafetyResult {
  const violations: string[] = [];
  const lowerText = text.toLowerCase();

  // 1. Mandatory word check
  if (!lowerText.includes('организм')) {
    violations.push('MISSING_MANDATORY_WORD_ORGANISM');
  }

  // 2. Prohibited exact words / diet culture
  const prohibitedWords = [
    'диета', 'похудени', 'сжигани', 'жиросжиган', 'скинуть', 'должна', 'обязана'
  ];
  for (const word of prohibitedWords) {
    if (lowerText.includes(word)) {
      violations.push(`PROHIBITED_WORD_${word.toUpperCase()}`);
    }
  }

  // 3. Prohibited quantitative assessments for calories and micronutrient percentages
  // E.g., "1500 ккал", "20%", "на 200 мг", "дефицит 30%"
  const calorieRegex = /\d+\s*(ккал|kcal|калорий)/;
  if (calorieRegex.test(lowerText)) {
    violations.push('QUANTITATIVE_CALORIE_ASSESSMENT_FORBIDDEN');
  }

  const percentageRegex = /\d+\s*%/;
  if (percentageRegex.test(lowerText)) {
    violations.push('PERCENTAGE_NORM_FORBIDDEN');
  }

  const dosageRegex = /\d+\s*(мг|mg|мкг|mcg|ме|iu)/;
  if (dosageRegex.test(lowerText)) {
    violations.push('DOSAGE_OR_EXACT_METRIC_FORBIDDEN');
  }

  // 4. Weight and body changes
  const weightWords = ['вес', 'снижение веса', 'похудели', 'набор массы'];
  if (weightWords.some(w => lowerText.includes(w))) {
    violations.push('WEIGHT_MENTION_FORBIDDEN');
  }

  // 5. Compensation / workout to eat
  const compensationWords = ['отработка', 'компенсация', 'отработать', 'заслужить'];
  if (compensationWords.some(w => lowerText.includes(w))) {
    violations.push('COMPENSATORY_BEHAVIOR_FORBIDDEN');
  }

  // 6. Direct causality instead of correlation
  const causalWords = ['из-за этого', 'поэтому вы', 'привело к'];
  if (causalWords.some(w => lowerText.includes(w))) {
    violations.push('DIRECT_CAUSALITY_FORBIDDEN');
  }

  return {
    isSafe: violations.length === 0,
    violations
  };
}

export function safetyGate(ctx: any, lang: string): { block: boolean, reason?: string } {
  // Temporary stub since safetyGate was missing
  return { block: false };
}
