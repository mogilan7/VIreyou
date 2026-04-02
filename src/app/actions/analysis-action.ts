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

  // 1. Fetch User Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  // 2. Fetch Questionnaire Results (test_results)
  const { data: testResults } = await supabase
    .from("test_results")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  // 3. Fetch Nutrition Logs (last 30 days for better sugar/protein extraction)
  const nutritionLogs = await prisma.nutritionLog.findMany({
    where: { user_id: userId },
    orderBy: { date: "desc" },
    take: 30,
  });

  // 4. Group test results by type (latest only)
  const latestResults: Record<string, any> = {};
  testResults?.forEach((res) => {
    if (!latestResults[res.test_type]) {
      latestResults[res.test_type] = res;
    }
  });

  // Extract anthropometric data from Bio-Age or Profile
  const bioAgeData = latestResults["bio-age"]?.raw_data || latestResults["systemic-bio-age"]?.raw_data || {};
  const waist = bioAgeData.waist || profile?.welcome_data?.waist || "не указано";
  const hips = bioAgeData.hips || profile?.welcome_data?.hips || "не указано";
  const weight = bioAgeData.weight || profile?.welcome_data?.weight || "не указано";
  const height = bioAgeData.height || profile?.height || "не указано";
  
  // Calculate age from profile or welcome_data
  let age = "не указано";
  if (profile?.date_of_birth) {
    const dob = new Date(profile.date_of_birth);
    age = String(new Date().getFullYear() - dob.getFullYear());
  } else if (profile?.welcome_data?.age) {
    age = profile.welcome_data.age;
  }

  // TDEE Index
  const tdee = latestResults["energy"]?.score || "не указано";

  // Nutrition trends
  const avgSugar = nutritionLogs.reduce((acc, log) => acc + (log.added_sugar || 0), 0) / (nutritionLogs.length || 1);
  const avgProtein = nutritionLogs.reduce((acc, log) => acc + (log.protein || 0), 0) / (nutritionLogs.length || 1);
  const sugarExcess = avgSugar > 50 ? "избыток сахара" : "в норме";
  const proteinStatus = avgProtein < 60 ? "дефицит белка" : "в норме";

  // Construct Data Context for AI
  const dataContext = `
ВХОДНЫЕ ДАННЫЕ КЛИЕНТА:
- Имя: ${profile?.full_name || user.user_metadata?.full_name || "Клиент"}
- Возраст: ${age}
- Пол: ${profile?.gender === "female" ? "Женский" : "Мужской"}
- Рост: ${height} см
- Вес: ${weight} кг
- Объем талии: ${waist} см
- Объем бедер: ${hips} см
- Индекс TDEE: ${tdee} ккал
- Питание: ${sugarExcess}, ${proteinStatus} (на основе последних 30 дней)

РЕЗУЛЬТАТЫ ОПРОСНИКОВ:
- Mini-Cog (Когниции): ${latestResults["mini-cog"]?.score || "не пройдено"} баллов (${latestResults["mini-cog"]?.interpretation || "-"})
- SCORE (Риск ССЗ): ${latestResults["score"]?.score || "не пройдено"}% (${latestResults["score"]?.interpretation || "-"})
- Индекс бессонницы: ${latestResults["insomnia"]?.score || "не пройдено"} баллов (${latestResults["insomnia"]?.interpretation || "-"})
- Циркадные ритмы: ${latestResults["circadian"]?.interpretation || "не пройдено"}
- SARC-F (Саркопения): ${latestResults["sarc-f"]?.score || "не пройдено"} баллов (${latestResults["sarc-f"]?.interpretation || "-"})
- RUS-AUDIT (Алкоголь): ${latestResults["RU-AUDIT"]?.score || latestResults["alcohol"]?.score || "не пройдено"} баллов
- Тест Фагерстрема (Никотин): ${latestResults["nicotine"]?.score || "не пройдено"} баллов
- Шкала Грина (Менопауза): ${latestResults["greene-scale"]?.score || "не пройдено"} баллов
- IPSS (Простата): ${latestResults["ipss"]?.score || "не пройдено"} баллов
- МИЭФ-5 (Эрекция): ${latestResults["mief-5"]?.score || "не пройдено"} баллов
  `;

  const systemPrompt = `
Промт: Аналитическая система Anti-Age диагностики
Роль: Ты — экспертная система клинической поддержки. Твоя задача — сопоставить данные анкет и дневника клиента с протоколами из Базы Знаний для формирования индивидуального плана лабораторного обследования.

Инструкция по использованию источников:
При анализе рисков и назначении анализов ты должен опираться на следующие документы (протоколы):
1. Метаболизм: При ОТ > 80/94 см или избытке сахара -> Глюкоза, Инсулин (HOMA/Caro), HbA1c, липидограмма.
2. Дефициты: При дефиците белка -> Общий белок, Альбумин. При когнитивных жалобах (Mini-Cog < 3) -> Гомоцистеин, В12, Фолаты. При слабости/ТТГ -> ТТГ, Т4 своб, йод, селен.
3. Гендер: 
   - Мужчины: МИЭФ-5 < 21 -> Тестостерон общ, ГСПГ, Липидный профиль.
   - Женщины: Шкала Грина (менопауза) -> ФСГ, ЛГ, Эстрадиол, ТТГ.
4. Онко/Кости: Возраст 45+ или риск SARC-F -> Витамин D (25-OH), Кальций общ, Фосфор, Остеокальцин. При курении (10+ лет) -> протоколы онконастороженности.

АЛГОРИТМ КРОСС-АНАЛИЗА:
(Используй логику, описанную выше, для формирования ответа)

ФОРМАТ ОТВЕТА АССИСТЕНТА (ОБЯЗАТЕЛЬНО):
Интерпретация данных:
(Краткий аналитический вывод)

Список необходимых анализов:
(Сгруппировать по панелям: Метаболическая, Гормональная, Витаминная)

Обоснование:
(Для каждой позиции укажи связь с данными клиента)

Дополнительные исследования:
(УЗИ, ЭКГ и др. на основе документов по функциональной диагностике)

Стиль: Аналитический, экспертный, без воды. Используй только терминологию из Базы Знаний.
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: dataContext },
      ],
      temperature: 0.3, // Lower temperature for more clinical/analytical output
    });

    const interpretation = response.choices[0]?.message?.content || "";

    // Save Result
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
        },
      });

    if (saveError) {
      console.error("Error saving analysis:", saveError);
      return { success: false, error: saveError.message };
    }

    revalidatePath("/[locale]/cabinet", "page");

    return { success: true, interpretation };
  } catch (error: any) {
    console.error("Analysis Action Error:", error);
    return { success: false, error: error.message };
  }
}
