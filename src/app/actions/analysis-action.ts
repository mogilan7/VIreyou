"use server";

import OpenAI from "openai";
import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { QUESTIONNAIRE_INTERPRETATIONS } from "@/lib/clinical/interpretations";

const apiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey });

const TEST_NAMES: Record<string, string> = {
  'systemic-bio-age': 'Системный Биовозраст',
  'bio-age': 'Системный Биовозраст',
  'insomnia': 'Индекс бессонницы',
  'circadian': 'Циркадные ритмы',
  'energy': 'Калькулятор TDEE',
  'nicotine': 'Тест Фагерстрема (Никотин)',
  'alcohol': 'RUS-AUDIT (Алкоголь)',
  'RU-AUDIT': 'RUS-AUDIT (Алкоголь)',
  'sarc-f': 'SARC-F (Саркопения)',
  'greene-scale': 'Шкала Грина (Климакс)',
  'ipss': 'IPSS (Простата)',
  'mief-5': 'МИЭФ-5 (Эректильная функция)',
  'score': 'SCORE (Риск ССЗ)',
  'mini-cog': 'Тест Mini-Cog (Память/Когниции)'
};

/**
 * Shared logic for gathering user data context for analysis.
 */
async function getAggregatedAnalysisData(userId: string) {
  const supabase = await createClient();

  // 1. Date Range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  // 2. Fetch Data
  const [profile, testResults, healthData] = await Promise.all([
    prisma.profiles.findUnique({ where: { id: userId } }),
    prisma.test_results.findMany({ where: { user_id: userId }, orderBy: { created_at: 'desc' } }),
    prisma.healthData.findUnique({ where: { user_id: userId } }),
  ]);

  const lifestyleQuery = {
    where: { user_id: userId, date: { gte: sevenDaysAgo, lte: yesterday } },
  };

  const [nutritionLogs, activityLogs, sleepLogs, hydrationLogs, habitLogs] = await Promise.all([
    prisma.nutritionLog.findMany(lifestyleQuery),
    prisma.activityLog.findMany(lifestyleQuery),
    prisma.sleepLog.findMany(lifestyleQuery),
    prisma.hydrationLog.findMany(lifestyleQuery),
    prisma.habitLog.findMany(lifestyleQuery),
  ]);

  // 3. Questionnaires
  const latestResultsMap: Record<string, any> = {};
  testResults?.forEach((res) => {
    if (res.test_type !== "stage-2-analysis" && !latestResultsMap[res.test_type]) {
      latestResultsMap[res.test_type] = res;
    }
  });

  const questionnaires = Object.entries(latestResultsMap).map(([type, res]) => {
    const interpretationData = QUESTIONNAIRE_INTERPRETATIONS[type];
    let clinicalLabel = res.interpretation;
    
    if (interpretationData && res.score !== null) {
      const score = Number(res.score);
      const matched = interpretationData.thresholds.find((t: any) => {
        const minOk = t.min === undefined || score >= t.min;
        const maxOk = t.max === undefined || score <= t.max;
        return minOk && maxOk;
      });
      if (matched) clinicalLabel = `${matched.label} (Риск: ${matched.risk})`;
    }

    return {
      type,
      name: TEST_NAMES[type] || type,
      score: res.score,
      interpretation: clinicalLabel,
    };
  });

  // 4. Daily Logs Structure (7 days)
  const dailyLogs: any[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];

    const dayNutri = nutritionLogs.filter(l => l.date.toISOString().split('T')[0] === dateStr);
    const dayActiv = activityLogs.find(l => l.date.toISOString().split('T')[0] === dateStr);
    const daySleep = sleepLogs.find(l => l.date.toISOString().split('T')[0] === dateStr);
    const dayWater = hydrationLogs.filter(l => l.date.toISOString().split('T')[0] === dateStr).reduce((acc, l) => acc + l.volume_ml, 0);
    const dayHabits = habitLogs.filter(l => l.date.toISOString().split('T')[0] === dateStr);

    dailyLogs.push({
      date: dateStr,
      nutrition: {
        calories: dayNutri.reduce((acc, l) => acc + (l.calories || 0), 0),
        protein: dayNutri.reduce((acc, l) => acc + (l.protein || 0), 0),
        vits: dayNutri.reduce((acc: any, l) => {
          ['vitamin_D', 'magnesium', 'zinc', 'vitamin_B12'].forEach(v => {
             if ((l as any)[v]) acc[v] = (acc[v] || 0) + (l as any)[v];
          });
          return acc;
        }, {})
      },
      activity: {
        steps: dayActiv?.steps || 0,
        activeMin: dayActiv?.active_minutes || 0,
      },
      sleep: {
        duration: daySleep?.duration_hrs || 0,
        deep: daySleep?.deep_hrs || 0,
        rem: daySleep?.rem_hrs || 0,
        light: daySleep?.light_hrs || 0,
        hrv: daySleep?.hrv || 0,
        rhr: daySleep?.resting_heart_rate || 0
      },
      water: dayWater,
      habits: dayHabits.map(h => `${h.habit_key}: ${h.completed ? '✅' : '❌'}`).join(', ')
    });
  }

  // 5. Aggregates with Filtering (Only Active Days)
  const activeNutrition = nutritionLogs.filter(l => (l.calories || 0) > 0);
  const activeActivity = activityLogs.filter(l => (l.steps || 0) > 0 || (l.active_minutes || 0) > 0);
  const activeSleep = sleepLogs.filter(l => (l.duration_hrs || 0) > 0);

  // COUNT UNIQUE DAYS (to avoid '21дн' if multiple logs per day)
  const nutriDays = new Set(activeNutrition.map(l => l.date.toISOString().split('T')[0])).size;
  const activityDays = new Set(activeActivity.map(l => l.date.toISOString().split('T')[0])).size;
  const sleepDays = new Set(activeSleep.map(l => l.date.toISOString().split('T')[0])).size;

  const nNutri = activeNutrition.length || 1;
  const nActiv = activeActivity.length || 1;
  const nSleep = activeSleep.length || 1;

  const activeHydration = hydrationLogs.filter(l => (l.volume_ml || 0) > 0);
  const hydrationDays = new Set(activeHydration.map(l => l.date.toISOString().split('T')[0])).size;

  const nutrientKeys = [
    'calories', 'protein', 'carbs', 'fat', 'fiber', 'added_sugar', 'vitamin_D', 'vitamin_B12', 
    'magnesium', 'zinc', 'omega_3', 'omega_6', 'calcium', 'iron', 'vitamin_A', 'vitamin_C', 
    'vitamin_E', 'vitamin_K', 'vitamin_B1', 'vitamin_B2', 'vitamin_B3', 'vitamin_B6', 
    'sodium', 'potassium', 'cholesterol'
  ];

  const nutrientTotals = activeNutrition.reduce((acc: any, l) => {
    nutrientKeys.forEach(k => {
      if ((l as any)[k]) acc[k] = (acc[k] || 0) + (l as any)[k];
    });
    return acc;
  }, {});

  const structuredNutrients = nutrientKeys
    .filter(k => (nutrientTotals[k] || 0) > 0)
    .map(k => ({
      name: k.replace('vitamin_', 'Вит. ').replace('calories', 'Калории').replace('protein', 'Белок').replace('carbs', 'Углеводы').replace('fat', 'Жиры').replace('fiber', 'Клетчатка').replace('added_sugar', 'Сахар (доб.)').replace('magnesium', 'Магний').replace('zinc', 'Цинк').replace('omega_3', 'Омега-3').replace('omega_6', 'Омега-6').replace('calcium', 'Кальций').replace('iron', 'Железо').replace('sodium', 'Натрий').replace('potassium', 'Калий').replace('cholesterol', 'Холестерин'),
      val: Math.round(nutrientTotals[k] / (nutriDays || 1)),
      unit: k === 'calories' ? 'ккал' : (k.includes('vitamin') || ['magnesium', 'zinc', 'iron', 'calcium', 'sodium', 'potassium', 'cholesterol'].includes(k) ? 'мг' : 'г')
    }));

  const metrics = {
    nutrition: {
      days: nutriDays,
      avgCalories: Math.round(nutrientTotals['calories'] / (nutriDays || 1)),
      avgProtein: Math.round(nutrientTotals['protein'] / (nutriDays || 1)),
      nutrients: structuredNutrients
    },
    activity: {
      days: activityDays,
      avgSteps: Math.round(activeActivity.reduce((acc, l) => acc + (l.steps || 0), 0) / (activityDays || 1)),
      avgActiveMin: Math.round(activeActivity.reduce((acc, l) => acc + (l.active_minutes || 0), 0) / (activityDays || 1)),
    },
    sleep: {
      days: sleepDays,
      avgHours: activeSleep.reduce((acc, l) => acc + (l.duration_hrs || 0), 0) / (sleepDays || 1),
      avgDeep: activeSleep.reduce((acc, l) => acc + (l.deep_hrs || 0), 0) / (sleepDays || 1),
      avgHRV: activeSleep.reduce((acc, l) => acc + (l.hrv || 0), 0) / (sleepDays || 1),
      avgRHR: activeSleep.reduce((acc, l) => acc + (l.resting_heart_rate || 0), 0) / (sleepDays || 1),
    },
    hydration: {
      days: hydrationDays,
      avgVolume: Math.round(activeHydration.reduce((acc, l) => acc + (l.volume_ml || 0), 0) / (hydrationDays || 1)),
    },
    habits: {
      completedCount: habitLogs.filter(h => h.completed).length,
      list: Array.from(new Set(habitLogs.filter(h => h.completed).map(h => h.habit_key)))
    },
    anthropometry: {
      waist: (latestResultsMap["bio-age"]?.raw_data || latestResultsMap["systemic-bio-age"]?.raw_data || profile?.welcome_data || {}).waist || "н/д",
      weight: (latestResultsMap["bio-age"]?.raw_data || latestResultsMap["systemic-bio-age"]?.raw_data || profile?.welcome_data || {}).weight || "н/д",
      height: profile?.height || "н/д",
    }
  };


  // Age calculation fix
  let ageValue = "н/д";
  try {
    const dob = profile?.date_of_birth;
    if (dob) {
      const birthDate = dob instanceof Date ? dob : new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
      ageValue = String(age);
    } else if (profile?.welcome_data && (profile.welcome_data as any).age) {
      ageValue = String((profile.welcome_data as any).age);
    } else if (healthData?.biological_age_actual) {
      ageValue = String(healthData.biological_age_actual);
    }
  } catch (e) {
    console.error("Age calculation error:", e);
  }

  // Daily Log Context String
  const dailyLogContext = dailyLogs.map(day => `
[${day.date}]
- Питание: ${day.nutrition.calories} ккал, Белок: ${day.nutrition.protein}г. Витамины: ${JSON.stringify(day.nutrition.vits)}
- Активность: ${day.activity.steps} шагов, ${day.activity.activeMin} мин активн.
- Сон: ${day.sleep.duration}ч (Глуб: ${day.sleep.deep}ч, REM: ${day.sleep.rem}ч, HRV: ${day.sleep.hrv}мс, ЧСС: ${day.sleep.rhr})
- Вода: ${day.water} мл
- Привычки: ${day.habits || 'нет данных'}
  `).join("\n");

  // Formatted dataContext
  const dataContext = `
ДАННЫЕ ПРОФИЛЯ:
- Возраст: ${ageValue}, Пол: ${profile?.gender === "female" ? "Женский" : "Мужской"}
- Рост: ${metrics.anthropometry.height} см, Вес: ${metrics.anthropometry.weight} кг
- Объем талии: ${metrics.anthropometry.waist} см

РЕЗУЛЬТАТЫ ОПРОСНИКОВ (с клинической интерпретацией):
${questionnaires.map(q => `- ${q.name}: ${q.score || "н/д"} баллов. Интерпретация: ${q.interpretation || "н/д"}`).join("\n")}

ДЕТАЛЬНАЯ СТРУКТУРА ОБРАЗА ЖИЗНИ ЗА 7 ДНЕЙ:
${dailyLogContext}

МАКРОНУТРИЕНТЫ (среднее):
- Калории: ${metrics.nutrition.avgCalories} ккал, Белки: ${metrics.nutrition.avgProtein} г/день
- Нутриенты: ${structuredNutrients.map(n => `${n.name}: ${n.val}${n.unit}`).join(", ")}
  `;

  return { 
    userId, 
    dataContext, 
    questionnaires, 
    metrics, 
    age: ageValue, 
    gender: profile?.gender, 
    fullName: profile?.full_name,
    period: { from: sevenDaysAgo, to: yesterday } 
  };
}

/**
 * Fetch stage-2 analysis pre-data for user confirmation.
 */
export async function fetchAnalysisPreData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "User not authenticated" };

  try {
    const data = await getAggregatedAnalysisData(user.id);
    return { success: true, data };
  } catch (err: any) {
    console.error("Fetch Analysis Data Error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Execute AI stage-2 analysis after user confirmation.
 */
export async function generateStage2Analysis() {
  if (!apiKey) throw new Error("OpenAI API Key is missing");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "User not authenticated" };

  try {
    const { dataContext, userId, period } = await getAggregatedAnalysisData(user.id);

    const systemPrompt = `
Роль: Вы — ведущий ИИ-аналитик платформы vireyou.com, специализирующийся на системной медицине долголетия и функциональной диагностике. Ваша миссия — трансформировать данные образа жизни пользователя в персонализированную стратегию лабораторного скрининга, используя внутреннюю базу знаний и стандарты превентивной медицины 2025–2026 годов.

Философский фундамент: Вы рассматриваете тело пользователя как «главный актив». Ваша цель — помочь организму перейти из состояния «выживания» (дефицит ресурсов) в состояние «развития» (оптимизация и рост). Вы не ставите медицинские диагнозы, а оцениваете «биологические ресурсы» и риски.

РУКОВОДСТВО ПО ИНТЕРПРЕТАЦИИ ОПРОСНИКОВ (Знания 2025):
- SARC-F: >=4 — высокий риск саркопении.
- IPSS: 8-19 умеренная, >=20 тяжелая патология простаты.
- МИЭФ-5: <21 — наличие ЭД.
- SCORE: >5% — высокий риск ССЗ.
- Mini-Cog: <=2 — высокий риск когнитивных нарушений.
- ISI: >=15 — клиническая бессонница.

Инструкции по анализу данных:
1. Дневник питания: Оценивайте гликемическую нагрузку, плотность нутриентов и наличие провоспалительных факторов (трансжиры, избыток соли).
2. Дневник активности: Анализируйте баланс между нагрузкой (Зона 2, силовые, HIIT) и восстановлением. Используйте VO2 Max как ключевой индикатор функционального возраста.
3. Дневник сна: Оценивайте регулярность и продолжительность как предикторы системного воспаления и гормонального баланса.
4. Анамнез: Учитывайте генетические риски (семейная история) и текущие субъективные жалобы как сигналы для таргетной проверки систем (ЖКТ, щитовидная железа, сердечно-сосудистая система).

Алгоритм формирования рекомендаций:
Шаг 1: Идентификация метаболического контекста. На основе частоты потребления сахара и уровня активности определите необходимость проверки углеводного обмена (HbA1c, инсулин).
Шаг 2: Оценка воспалительного статуса. При жалобах на усталость или плохом сне назначьте hs-CRP как маркер «inflammaging».
Шаг 3: Сердечно-сосудистая стратификация. При наличии факторов риска (BMI > 25, семейный анамнез) предложите анализ на ApoB и Lp(a).
Шаг 4: Нутритивная поддержка. На основе данных о рационе предложите проверку дефицитов (витамин D, B12, ферритин, магний).
Шаг 5: Проверка подготовки к тестам. Напоминайте пользователю о правилах: 12-часовой фаст, отсутствие тренировок за 48 часов, отказ от алкоголя за 24 часа.

Формат ответа:
Представьте рекомендации в виде структурированного отчета «Персональный диагностический трек»:

### Сводный анализ ресурсов
(Краткое резюме текущего состояния на основе дневников: где теряется энергия)

### Таблица рекомендованных анализов
| Название теста | Обоснование на основе вашего образа жизни/симптомов | Целевая зона долголетия 2025 |
| :--- | :--- | :--- |
| ... | ... | ... |

### Приоритетность
Разделите анализы на «Критические» (базовый чек-ап) и «Углубленные» (для тонкой настройки).

Тон и стиль: Профессиональный, научно обоснованный, но доступный. Избегайте алармизма. Используйте формулировки «оптимизация ресурса», «биологическая устойчивость», «метаболическая гибкость».
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: dataContext },
      ],
      temperature: 0.2,
    });

    const interpretation = response.choices[0]?.message?.content || "";

    const { error: saveError } = await supabase
      .from("test_results")
      .insert({
        user_id: userId,
        test_type: "stage-2-analysis",
        score: 0,
        interpretation: interpretation,
        raw_data: { dataSnapshot: dataContext, generatedAt: new Date().toISOString(), period },
      });

    if (saveError) throw new Error(saveError.message);

    revalidatePath("/[locale]/cabinet", "page");
    return { success: true, interpretation };
  } catch (error: any) {
    console.error("Analysis Execution Error:", error);
    return { success: false, error: error.message };
  }
}
