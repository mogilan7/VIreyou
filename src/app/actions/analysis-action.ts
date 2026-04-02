"use server";

import OpenAI from "openai";
import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  const { data: testResults } = await supabase.from("test_results").select("*").eq("user_id", userId).order("created_at", { ascending: false });

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

  const questionnaires = Object.entries(latestResultsMap).map(([type, res]) => ({
    type,
    name: TEST_NAMES[type] || type,
    score: res.score,
    interpretation: res.interpretation,
  }));

  // 4. Aggregates
  const n = nutritionLogs.length || 1;
  const metrics = {
    nutrition: {
      avgCalories: nutritionLogs.reduce((acc, l) => acc + (l.calories || 0), 0) / n,
      avgProtein: nutritionLogs.reduce((acc, l) => acc + (l.protein || 0), 0) / n,
      avgSugar: nutritionLogs.reduce((acc, l) => acc + (l.added_sugar || 0), 0) / n,
      avgFiber: nutritionLogs.reduce((acc, l) => acc + (l.fiber || 0), 0) / n,
    },
    activity: {
      avgSteps: activityLogs.reduce((acc, l) => acc + (l.steps || 0), 0) / (activityLogs.length || 1),
      avgActiveMin: activityLogs.reduce((acc, l) => acc + (l.active_minutes || 0), 0) / (activityLogs.length || 1),
    },
    sleep: {
      avgHours: sleepLogs.reduce((acc, l) => acc + (l.duration_hrs || 0), 0) / (sleepLogs.length || 1),
      avgHRV: sleepLogs.reduce((acc, l) => acc + (l.hrv || 0), 0) / (sleepLogs.length || 1),
    },
    anthropometry: {
      waist: (latestResultsMap["bio-age"]?.raw_data || latestResultsMap["systemic-bio-age"]?.raw_data || profile?.welcome_data || {}).waist || "н/д",
      weight: (latestResultsMap["bio-age"]?.raw_data || latestResultsMap["systemic-bio-age"]?.raw_data || profile?.welcome_data || {}).weight || "н/д",
      height: profile?.height || "н/д",
    }
  };

  const age = profile?.date_of_birth ? String(new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()) : "н/д";

  // Formatted dataContext
  const dataContext = `
ДАННЫЕ ПРОФИЛЯ:
- Возраст: ${age}, Пол: ${profile?.gender === "female" ? "Женский" : "Мужской"}
- Рост: ${metrics.anthropometry.height} см, Вес: ${metrics.anthropometry.weight} кг
- Объем талии: ${metrics.anthropometry.waist} см

РЕЗУЛЬТАТЫ ОПРОСНИКОВ:
${questionnaires.map(q => `- ${q.name}: Результат ${q.score || "н/д"}, Интерпретация: ${q.interpretation || "н/д"}`).join("\n")}

ОБРАЗ ЖИЗНИ ЗА 7 ДНЕЙ:
- Калории: ${Math.round(metrics.nutrition.avgCalories)} ккал, Белки: ${Math.round(metrics.nutrition.avgProtein)} г/день
- Сахар: ${Math.round(metrics.nutrition.avgSugar)} г/день, Клетчатка: ${Math.round(metrics.nutrition.avgFiber)} г/день
- Активность: ${Math.round(metrics.activity.avgSteps)} шагов/день, ${Math.round(metrics.activity.avgActiveMin)} мин/день
- Сон: ${metrics.sleep.avgHours.toFixed(1)} ч, HRV: ${Math.round(metrics.sleep.avgHRV)} мс
  `;

  return { 
    userId, 
    dataContext, 
    questionnaires, 
    metrics, 
    age, 
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
Роль: Ты — Эксперт-аналитик Anti-Age медицины и системный врач.
Задача: Провести комплексную синтетическую интерпретацию здоровья на основе данных опросов и 7-дневного дневника.

ФОРМАТ ОТВЕТА:
Интерпретация данных:
...
Список необходимых анализов:
...
Обоснование:
...
Дополнительные исследования:
...
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
