import { CONFIG } from './config';
import { median } from './validity';

export interface Deviation {
  domain: string;
  type: 'spike' | 'trend' | 'repeat';
  direction: 'up' | 'down';
  value: number;
  baseline: number;
}

export function detectDeviations(
  todayValue: number | null | undefined, 
  historicalValues: number[], 
  domain: string,
  isTargetBased: false,
  target?: never
): Deviation | null;
export function detectDeviations(
  todayValue: number | null | undefined, 
  historicalValues: number[], 
  domain: string,
  isTargetBased: true,
  target: number
): Deviation | null;
export function detectDeviations(
  todayValue: number | null | undefined, 
  historicalValues: number[], 
  domain: string,
  isTargetBased: boolean,
  target?: number
): Deviation | null {
  if (todayValue == null) return null;

  if (isTargetBased && target != null) {
    const diff = todayValue - target;
    // 30% deviation from target
    if (Math.abs(diff) > target * 0.3) {
      return {
        domain,
        type: 'spike',
        direction: diff > 0 ? 'up' : 'down',
        value: todayValue,
        baseline: target
      };
    }
    return null;
  }

  // Baseline based deviation
  const validHistory = historicalValues.filter(v => v > 0);
  if (validHistory.length < CONFIG.MIN_BASELINE_POINTS) return null;

  const baselineMedian = median(validHistory);
  // Calculate Standard Deviation
  const variance = validHistory.reduce((acc, val) => acc + Math.pow(val - baselineMedian, 2), 0) / validHistory.length;
  const sd = Math.sqrt(variance) || (baselineMedian * 0.1); // Fallback to 10% if variance is 0

  const diff = todayValue - baselineMedian;
  if (Math.abs(diff) > CONFIG.SPIKE_SD * sd) {
    return {
      domain,
      type: 'spike',
      direction: diff > 0 ? 'up' : 'down',
      value: todayValue,
      baseline: baselineMedian
    };
  }

  return null;
}

export interface CrossDomainPair {
  triggerDomain: string;
  triggerCondition: (val: any) => boolean;
  effectDomain: string;
  effectCondition: (val: any, baseline: number) => boolean;
  experimentIdea: string;
}

export const KNOWN_LINKS: Record<string, CrossDomainPair> = {
  'alcohol_sleep': {
    triggerDomain: 'alcohol',
    triggerCondition: (val) => val === true,
    effectDomain: 'hrv',
    effectCondition: (val, baseline) => val < baseline * 0.9, // 10% drop
    experimentIdea: 'Давайте попробуем на этой неделе воздержаться от алкоголя и посмотрим, как это отразится на восстановлении во время сна.'
  },
  'late_dinner_sleep': {
    triggerDomain: 'late_dinner',
    triggerCondition: (val) => val === true,
    effectDomain: 'resting_heart_rate',
    effectCondition: (val, baseline) => val > baseline * 1.05, // 5% increase
    experimentIdea: 'Предлагаю сдвинуть ужин на 2 часа раньше обычного и понаблюдать за пульсом во сне.'
  }
};

export function detectCrossDomainLinks(
  pairs: Array<{ triggerValue: any, effectValue: number }>, 
  effectBaseline: number,
  linkType: string
) {
  const link = KNOWN_LINKS[linkType];
  if (!link) return null;

  let matches = 0;
  let totalTriggers = 0;

  for (const p of pairs) {
    if (link.triggerCondition(p.triggerValue)) {
      totalTriggers++;
      if (link.effectCondition(p.effectValue, effectBaseline)) {
        matches++;
      }
    }
  }

  if (totalTriggers >= CONFIG.MIN_PAIRS && (matches / totalTriggers) >= 0.8) {
    return {
      link: linkType,
      confidence: matches / totalTriggers,
      occurrences: totalTriggers
    };
  }
  return null;
}
