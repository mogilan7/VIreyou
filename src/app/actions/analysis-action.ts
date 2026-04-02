"use server";

import OpenAI from "openai";
import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const apiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey });

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

  // --- 1. Date Range Definition (Last 7 days, excluding today) ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  // --- 2. Data Fetching ---
  
  // Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  // Questionnaire Results
  const { data: testResults } = await supabase
    .from("test_results")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  // Lifestyle Logs (7 Days Snapshot)
  const lifestyleQuery = {
    where: {
      user_id: userId,
      date: {
        gte: sevenDaysAgo,
        lte: yesterday,
      },
    },
  };

  const [nutritionLogs, activityLogs, sleepLogs, hydrationLogs, habitLogs] = await Promise.all([
    prisma.nutritionLog.findMany(lifestyleQuery),
    prisma.activityLog.findMany(lifestyleQuery),
    prisma.sleepLog.findMany(lifestyleQuery),
    prisma.hydrationLog.findMany(lifestyleQuery),
    prisma.habitLog.findMany(lifestyleQuery),
  ]);

  // --- 3. Data Processing / Aggregation ---

  // Nutrition Aggregation
  const n = nutritionLogs.length || 1;
  const nutritionAgg = {
    avgCalories: nutritionLogs.reduce((acc, l) => acc + (l.calories || 0), 0) / n,
    avgProtein: nutritionLogs.reduce((acc, l) => acc + (l.protein || 0), 0) / n,
    avgCarbs: nutritionLogs.reduce((acc, l) => acc + (l.carbs || 0), 0) / n,
    avgFat: nutritionLogs.reduce((acc, l) => acc + (l.fat || 0), 0) / n,
    avgSugar: nutritionLogs.reduce((acc, l) => acc + (l.added_sugar || 0), 0) / n,
    avgFiber: nutritionLogs.reduce((acc, l) => acc + (l.fiber || 0), 0) / n,
    avgOmega3: nutritionLogs.reduce((acc, l) => acc + (l.omega_3 || 0), 0) / n,
    vitaminsPresent: nutritionLogs.some(l => l.vitamin_D || l.vitamin_B12 || l.magnesium), // Simple check
  };

  // Activity Aggregation
  const a = activityLogs.length || 1;
  const activityAgg = {
    avgSteps: activityLogs.reduce((acc, l) => acc + (l.steps || 0), 0) / a,
    avgActiveMin: activityLogs.reduce((acc, l) => acc + (l.active_minutes || 0), 0) / a,
  };

  // Sleep Aggregation
  const s = sleepLogs.length || 1;
  const sleepAgg = {
    avgWait: sleepLogs.reduce((acc, l) => acc + (l.duration_hrs || 0), 0) / s,
    avgDeep: sleepLogs.reduce((acc, l) => acc + (l.deep_hrs || 0), 0) / s,
    avgHRV: sleepLogs.reduce((acc, l) => acc + (l.hrv || 0), 0) / s,
    avgRHR: sleepLogs.reduce((acc, l) => acc + (l.resting_heart_rate || 0), 0) / s,
  };

  // Hydration
  const h = hydrationLogs.length || 1;
  const hydrationAgg = {
    avgWater: hydrationLogs.reduce((acc, l) => acc + (l.volume_ml || 0), 0) / h,
  };

  // Habits
  const habitSummary = habitLogs.reduce((acc: Record<string, number>, curr) => {
    acc[curr.habit_key] = (acc[curr.habit_key] || 0) + (curr.completed ? 1 : 0);
    return acc;
  }, {});

  // Group questionnaire results
  const latestResults: Record<string, any> = {};
  testResults?.forEach((res) => {
    if (!latestResults[res.test_type]) {
      latestResults[res.test_type] = res;
    }
  });

  // Anthropometry
  const bioAgeData = latestResults["bio-age"]?.raw_data || latestResults["systemic-bio-age"]?.raw_data || {};
  const waist = bioAgeData.waist || profile?.welcome_data?.waist || "не указано";
  const hips = bioAgeData.hips || profile?.welcome_data?.hips || "не указано";
  const weight = bioAgeData.weight || profile?.welcome_data?.weight || "не указано";
  const height = bioAgeData.height || profile?.height || "не указано";
  
  let age = "не указано";
  if (profile?.date_of_birth) {
    const dob = new Date(profile.date_of_birth);
    age = String(new Date().getFullYear() - dob.getFullYear());
  }

  // --- 4. Construct AI Data Context ---
  const dataContext = `
ДАННЫЕ КЛИЕНТА (ОБЗОР):
- Имя: ${profile?.full_name || "Клиент"}
- Возраст: ${age}, Пол: ${profile?.gender === "female" ? "Женский" : "Мужской"}
- Рост: ${height} см, Вес: ${weight} кг
- Объем талии: ${waist} см, Объем бедер: ${hips} см

СНИМОК ОБРАЗА ЖИЗНИ ЗА ПОСЛЕДНИЕ 7 ДНЕЙ:
- Питание (КБЖУ): Кал: ${Math.round(nutritionAgg.avgCalories)}, Б: ${Math.round(nutritionAgg.avgProtein)}, Ж: ${Math.round(nutritionAgg.avgFat)}, У: ${Math.round(nutritionAgg.avgCarbs)}
- Сахар (добавленный): ${Math.round(nutritionAgg.avgSugar)} г/день
- Клетчатка: ${Math.round(nutritionAgg.avgFiber)} г/день
- Омега-3: ${nutritionAgg.avgOmega3.toFixed(1)} г/день
- Витамины/Минералы: ${nutritionAgg.vitaminsPresent ? "Зафиксирован прием/наличие в логах" : "Данные отсутствуют"}
- Активность: Средние шаги: ${Math.round(activityAgg.avgSteps)}, Активные минуты: ${Math.round(activityAgg.avgActiveMin)}
- Сон: Средняя длительность: ${sleepAgg.avgWait.toFixed(1)} ч, Глубокий сон: ${sleepAgg.avgDeep.toFixed(1)} ч
- Сердечно-сосудистые (сон): Ср. HRV: ${Math.round(sleepAgg.avgHRV)}, Ср. Пульс покоя: ${Math.round(sleepAgg.avgRHR)}
- Гидратация: ${Math.round(hydrationAgg.avgWater)} мл/день
- Привычки: ${Object.entries(habitSummary).map(([k, v]) => `${k} (${v}/7 дейн)`).join(", ") || "Нет данных"}

РЕЗУЛЬТАТЫ ОПРОСНИКОВ:
- Mini-Cog: ${latestResults["mini-cog"]?.score || "н/д"} баллов
- SCORE (Риск ССЗ): ${latestResults["score"]?.score || "н/д"}%
- Индекс бессонницы: ${latestResults["insomnia"]?.score || "н/д"}
- SARC-F (Саркопения): ${latestResults["sarc-f"]?.score || "н/д"}
- IPSS/МИЭФ-5: ${latestResults["ipss"]?.score || "н/д"} / ${latestResults["mief-5"]?.score || "н/д"}
  `;

  const systemPrompt = `
Промт: Аналитическая система Anti-Age диагностики
Роль: Ты — экспертная система клинической поддержки. Твоя задача — сопоставить данные анкет и ГЛУБОКИЙ АНАЛИЗ ДНЕВНИКА за последние 7 дней для формирования плана обследования.

Инструкция:
1. Метаболизм: Если ОТ > 80/94 ИЛИ добавленный сахар > 30г ИЛИ активность < 7000 шагов -> Глюкоза, Инсулин, HbA1c.
2. Дефициты: Если белок < 0.8г/кг веса (исходя из дневника) -> Общий белок, Альбумин. Если сон < 7ч ИЛИ HRV < 40 -> Кортизол (слюна), Магний, В12.
3. Микронутриенты: Проверь наличие витаминов/минералов в рационе. При их отсутствии в логах - назначь проверку дефицитов.
4. Сердечно-сосудистые: При высоком пульсе покоя (>70) ИЛИ риске SCORE -> Липидограмма расширенная.

ФОРМАТ ОТВЕТА (Строго аналитический, без воды):
Интерпретация данных:
...
Список необходимых анализов:
...
Обоснование:
...
Дополнительные исследования:
...
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: dataContext },
      ],
      temperature: 0.3,
    });

    const interpretation = response.choices[0]?.message?.content || "";

    // Save
    const { error: saveError } = await supabase
      .from("test_results")
      .insert({
        user_id: userId,
        test_type: "stage-2-analysis",
        score: 0,
        interpretation: interpretation,
        raw_data: {
          dataContext,
          generatedAt: new Date().toISOString(),
          period: { from: sevenDaysAgo, to: yesterday }
        },
      });

    if (saveError) throw new Error(saveError.message);

    revalidatePath("/[locale]/cabinet", "page");
    return { success: true, interpretation };
  } catch (error: any) {
    console.error("Analysis Action Error:", error);
    return { success: false, error: error.message };
  }
}
