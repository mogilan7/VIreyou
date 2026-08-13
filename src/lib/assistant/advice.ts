import prisma from '../prisma';

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
  const metricNames: Record<string, string> = { sleep_duration: 'сна', steps: 'шагов', water: 'воды', hrv: 'вариабельности пульса', kcal: 'питания', rhr: 'пульса в покое' };
  
  // Map outcome metrics to behavioral targets
  const behaviorMapping: Record<string, { target: string, text: string }> = {
    hrv: { target: 'sleep_duration', text: 'Постарайтесь сегодня лечь спать немного раньше, чтобы поддержать восстановление.' },
    rhr: { target: 'sleep_duration', text: 'Дополнительные полчаса сна сегодня помогут пульсу вернуться в норму.' },
    sleep: { target: 'sleep_duration', text: 'Попробуйте сегодня лечь на 15 минут раньше.' },
    sleep_duration: { target: 'sleep_duration', text: 'Попробуйте сегодня лечь на 15 минут раньше.' }
  };

  // 1. If we have a clear deviation, use it.
  if (deviations && deviations.length > 0) {
    const firstDev = deviations[0];
    const mapping = behaviorMapping[firstDev.metric];
    const mName = metricNames[firstDev.metric] || firstDev.metric;
    
    return {
      id: mapping ? 'adv_behavioral' : 'adv_general',
      target_metric: mapping ? mapping.target : firstDev.metric,
      verifiable: true,
      content: mapping ? mapping.text : `Постарайтесь сегодня чуть улучшить показатель ${mName}.`
    };
  }

  // 2. No deviations. Look for worsening domains
  if (domain_states) {
     const worsening = Object.keys(domain_states).filter(k => domain_states[k].trend_7d === 'worsening');
     if (worsening.length > 0) {
         const mName = metricNames[worsening[0]] || worsening[0];
         const mapping = behaviorMapping[worsening[0]];
         return {
             id: mapping ? 'adv_behavioral' : 'adv_worsening',
             target_metric: mapping ? mapping.target : worsening[0],
             verifiable: true,
             content: mapping ? mapping.text : `Ваш показатель ${mName} начал снижаться. Постарайтесь уделить ему внимание сегодня.`
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
      const mName = metricNames[goalDomain] || goalDomain;
      return {
          id: 'adv_goal',
          target_metric: goalDomain,
          verifiable: true,
          content: `Держите фокус на вашей главной цели: ${mName}.`
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
      
      const mName = metricNames[furthestMetric] || furthestMetric;
      const mapping = behaviorMapping[furthestMetric];
      return {
          id: mapping ? 'adv_behavioral' : 'adv_furthest',
          target_metric: mapping ? mapping.target : furthestMetric,
          verifiable: true,
          content: mapping ? mapping.text : `Постарайтесь сегодня подтянуть показатель ${mName}, он немного отстал от вашей нормы.`
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
    qualitativeQuestion: `Получилось ли выполнить вчерашний совет: ${yesterdayAdvice.target_metric}?`
  };
}
