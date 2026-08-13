const fs = require('fs');

const content = `import prisma from '../prisma';

export interface DailyAdvice {
  id: string;
  target_metric: string;
  verifiable: boolean;
  content: string;
}

// 8. Выбор совета
// Приоритет выбора при пустых deviations: 
// 1. домен с trend_7d: worsening
// 2. домен заявленной цели
// 3. метрика дальше всего от целевого значения (baseline)
export async function getAdviceForToday(
  userId: string,
  deviations: any[],
  domain_states?: Record<string, any>,
  targetData?: any,
  baselines?: Record<string, any>
): Promise<DailyAdvice | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  
  // 1. If we have a clear deviation, use it.
  if (deviations && deviations.length > 0) {
    const firstDev = deviations[0];
    const isSleep = firstDev.metric.includes('sleep');
    return {
      id: isSleep ? 'adv_sleep_early' : 'adv_general',
      target_metric: firstDev.metric,
      verifiable: true,
      content: isSleep ? 'Попробуйте сегодня лечь на 15 минут раньше.' : \`Обратите внимание на \${firstDev.metric} сегодня.\`
    };
  }

  // 2. No deviations. Look for worsening domains
  if (domain_states) {
     const worsening = Object.keys(domain_states).filter(k => domain_states[k].trend_7d === 'worsening');
     if (worsening.length > 0) {
         return {
             id: 'adv_worsening',
             target_metric: worsening[0],
             verifiable: true,
             content: \`Ваш показатель \${worsening[0]} начал снижаться. Постарайтесь уделить ему внимание сегодня.\`
         };
     }
  }
  
  // 3. Stated goal (fallback to steps if goal string includes activity/steps, or water, etc.)
  const goalStr = (user?.goal || "").toLowerCase();
  let goalDomain = null;
  if (goalStr.includes('сон') || goalStr.includes('sleep')) goalDomain = 'sleep_duration';
  else if (goalStr.includes('шаг') || goalStr.includes('активн') || goalStr.includes('activity')) goalDomain = 'steps';
  else if (goalStr.includes('вес') || goalStr.includes('weight')) goalDomain = 'kcal';
  
  if (goalDomain && baselines && baselines[goalDomain]) {
      return {
          id: 'adv_goal',
          target_metric: goalDomain,
          verifiable: true,
          content: \`Держите фокус на вашей главной цели: \${goalDomain}.\`
      };
  }
  
  // 4. Furthest from target (percent from baseline)
  if (targetData && baselines) {
      let furthestMetric = 'water';
      let maxDiffPercent = 0;
      Object.keys(baselines).forEach(m => {
          if (targetData[m] !== undefined && baselines[m].median > 0) {
              const diffPercent = Math.abs(targetData[m] - baselines[m].median) / baselines[m].median;
              if (diffPercent > maxDiffPercent) {
                  maxDiffPercent = diffPercent;
                  furthestMetric = m;
              }
          }
      });
      
      return {
          id: 'adv_furthest',
          target_metric: furthestMetric,
          verifiable: true,
          content: \`Постарайтесь сегодня подтянуть \${furthestMetric}, он немного отстал от вашей нормы.\`
      };
  }

  // Final fallback
  return {
    id: 'adv_hydration',
    target_metric: 'water',
    verifiable: true,
    content: 'Попробуйте выпить стакан воды перед обедом.'
  };
}

export async function checkYesterdayAdvice(
  userId: string,
  yesterdayDate: Date,
  todayData: any
): Promise<{ success: boolean, qualitativeNeeded: boolean, qualitativeQuestion?: string } | null> {
  const yesterdayAdvice = await prisma.adviceLog.findFirst({
    where: { userId, date: yesterdayDate }
  });

  if (!yesterdayAdvice) return null;

  if (yesterdayAdvice.verifiable) {
    const val = todayData[yesterdayAdvice.target_metric];
    if (val !== undefined && val !== null) {
      return { success: true, qualitativeNeeded: false };
    }
  }

  return { 
    success: false, 
    qualitativeNeeded: true, 
    qualitativeQuestion: \`Получилось ли выполнить вчерашний совет: \${yesterdayAdvice.target_metric}?\`
  };
}
`;
fs.writeFileSync('src/lib/assistant/advice.ts', content);
