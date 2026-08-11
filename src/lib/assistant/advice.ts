import prisma from '../prisma';

export interface DailyAdvice {
  id: string;
  target_metric: string;
  verifiable: boolean;
  content: string;
}

// 8. Выбор совета
// "Выбирается из вчерашних данных, выполним сегодня, проверяем завтрашними данными."
export async function getAdviceForToday(
  userId: string,
  deviations: any[]
): Promise<DailyAdvice | null> {
  // Simplistic selection of advice based on deviations
  if (deviations.length === 0) {
    return {
      id: 'adv_hydration',
      target_metric: 'water_ml',
      verifiable: true,
      content: 'Попробуйте выпить стакан воды перед обедом.'
    };
  }

  const firstDeviation = deviations[0];
  if (firstDeviation.domain === 'sleep') {
    return {
      id: 'adv_sleep_early',
      target_metric: 'sleep_duration',
      verifiable: true,
      content: 'Попробуйте сегодня лечь на 15 минут раньше.'
    };
  }

  return {
    id: 'adv_general',
    target_metric: firstDeviation.domain,
    verifiable: true,
    content: `Обратите внимание на ${firstDeviation.domain} сегодня.`
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
    // Check if the data for this metric exists today
    const val = todayData[yesterdayAdvice.target_metric];
    if (val !== undefined && val !== null) {
      // Check if it was better (simplistic threshold)
      return { success: true, qualitativeNeeded: false };
    }
  }

  // Data not available or not verifiable -> qualitative fallback
  return { 
    success: false, 
    qualitativeNeeded: true, 
    qualitativeQuestion: `Получилось ли выполнить вчерашний совет: ${yesterdayAdvice.target_metric}?`
  };
}
