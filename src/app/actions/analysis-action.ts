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

export async function generateStage2Analysis() {
  if (!apiKey) {
    throw new Error("OpenAI API Key is missing");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated" };
  }

  const userId = user.id;

  // --- 1. Date Range ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  // --- 2. Fetch Data ---
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

  // --- 3. Process Questionnaire Results DYNAMICALLY ---
  const latestResultsMap: Record<string, any> = {};
  testResults?.forEach((res) => {
    // We only keep the LATEST result for each test type except the analysis itself
    if (res.test_type !== "stage-2-analysis" && !latestResultsMap[res.test_type]) {
      latestResultsMap[res.test_type] = res;
    }
  });

  const questionnaireContext = Object.entries(latestResultsMap)
    .map(([type, res]) => {
      const name = TEST_NAMES[type] || type;
      return `- ${name}: Результат ${res.score || "не указан"}, Интерпретация: ${res.interpretation || "отсутствует"}`;
    })
    .join("\n");

  // --- 4. Process Lifestyle Logs ---
  const n = nutritionLogs.length || 1;
  const nutritionAgg = {
    avgCalories: nutritionLogs.reduce((acc, l) => acc + (l.calories || 0), 0) / n,
    avgProtein: nutritionLogs.reduce((acc, l) => acc + (l.protein || 0), 0) / n,
    avgSugar: nutritionLogs.reduce((acc, l) => acc + (l.added_sugar || 0), 0) / n,
    avgFiber: nutritionLogs.reduce((acc, l) => acc + (l.fiber || 0), 0) / n,
  };
  const activityAgg = {
    avgSteps: activityLogs.reduce((acc, l) => acc + (l.steps || 0), 0) / (activityLogs.length || 1),
    avgActiveMin: activityLogs.reduce((acc, l) => acc + (l.active_minutes || 0), 0) / (activityLogs.length || 1),
  };
  const sleepAgg = {
    avgHours: sleepLogs.reduce((acc, l) => acc + (l.duration_hrs || 0), 0) / (sleepLogs.length || 1),
    avgHRV: sleepLogs.reduce((acc, l) => acc + (l.hrv || 0), 0) / (sleepLogs.length || 1),
  };

  // Anthropometry
  const bioAgeData = latestResultsMap["bio-age"]?.raw_data || latestResultsMap["systemic-bio-age"]?.raw_data || {};
  const waist = bioAgeData.waist || profile?.welcome_data?.waist || "н/д";
  const weight = bioAgeData.weight || profile?.welcome_data?.weight || "н/д";
  
  let age = "н/д";
  if (profile?.date_of_birth) {
    const dob = new Date(profile.date_of_birth);
    age = String(new Date().getFullYear() - dob.getFullYear());
  }

  // --- 5. Data Context for AI ---
  const dataContext = `
ДАННЫЕ ПРОФИЛЯ:
- Возраст: ${age}, Пол: ${profile?.gender === "female" ? "Женский" : "Мужской"}
- Рост: ${profile?.height || "н/д"} см, Вес: ${weight} кг
- Объем талии: ${waist} см

РЕЗУЛЬТАТЫ ВСЕХ ОПРОСНИКОВ И ТЕСТОВ (КЛИНИЧЕСКИЕ РИСКИ):
${questionnaireContext || "Данные опросников отсутствуют. Требуется заполнение."}

ОБРАЗ ЖИЗНИ (СРЕДНЕЕ ЗА 7 ДНЕЙ):
- Калории: ${Math.round(nutritionAgg.avgCalories)} ккал, Белки: ${Math.round(nutritionAgg.avgProtein)} г
- Добавленный сахар: ${Math.round(nutritionAgg.avgSugar)} г/день
- Клетчатка: ${Math.round(nutritionAgg.avgFiber)} г/день
- Активность: ${Math.round(activityAgg.avgSteps)} шагов/день, ${Math.round(activityAgg.avgActiveMin)} мин/день
- Сон: ${sleepAgg.avgHours.toFixed(1)} ч, HRV: ${Math.round(sleepAgg.avgHRV)} мс
  `;

  const systemPrompt = `
Роль: Ты — Эксперт-аналитик Anti-Age медицины и системный врач.
Задача: Провести комплексную интерпретацию состояния клиента, объединив клинические риски из опросов с текущим образом жизни.

Твои выводы должны быть СИНТЕТИЧЕСКИМИ:
- Например: "Высокий риск по шкале SCORE (опрос) при низком уровне Омега-3 и высокой доле сахара в рационе (дневник) указывает на необходимость липидограммы с расчетом индекса атерогенности."
- Или: "Признаки бессонницы (опрос) коррелируют с низким HRV в дневнике, что требует проверки кортизола."

ФОРМАТ ОТВЕТА (Строгий, профессиональный, без вводных слов):
Интерпретация данных:
(Здесь ты ОБЯЗАТЕЛЬНО должен упомянуть ключевые результаты из РЕЗУЛЬТАТЫ ВСЕХ ОПРОСНИКОВ И ТЕСТОВ и как они связаны с образом жизни)

Список необходимых анализов:
(Только конкретные позиции)

Обоснование:
(Почему это назначено, ссылаясь на конкретные цифры из ОПРОСНИКОВ и ДНЕВНИКА)

Дополнительные исследования:
(Инструментальная диагностика или доп. тесты при необходимости)
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: dataContext },
      ],
      temperature: 0.2,
    });

    const interpretation = response.choices[0]?.message?.content || "";

    // Save result
    const { error: saveError } = await supabase
      .from("test_results")
      .insert({
        user_id: userId,
        test_type: "stage-2-analysis",
        score: 0,
        interpretation: interpretation,
        raw_data: {
          dataSnapshot: dataContext,
          generatedAt: new Date().toISOString()
        },
      });

    if (saveError) throw new Error(saveError.message);

    revalidatePath("/[locale]/cabinet", "page");
    return { success: true, interpretation };
  } catch (error: any) {
    console.error("Analysis Action Fatal Error:", error);
    return { success: false, error: error.message };
  }
}
