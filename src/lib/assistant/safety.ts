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

export function verifyNumbers(text: string, contract: any): { valid: boolean, invalidNumbers: number[] } {
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
