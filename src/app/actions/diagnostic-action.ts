"use server";

import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey });

export async function generateDiagnosticReport(formData: any) {
  if (!apiKey) {
    throw new Error("OpenAI API Key is missing");
  }

  const bmi = formData.height && formData.weight 
    ? (formData.weight / Math.pow(formData.height / 100, 2)).toFixed(1)
    : "не указан";

  const systemPrompt = `Ты — эксперт в области превентивной медицины и здорового долголетия. Твоя задача — проанализировать данные клиента и составить обоснованный список необходимых показателей крови.
    
    ПРАВИЛА АНАЛИЗА:
    1. Базовый скрининг: Клинический анализ крови (лейкоформула + СОЭ) + Биохимия (белок, глюкоза, креатинин, билирубин, АЛТ, АСТ).
    2. Обмен железа: Если есть усталость, выпадение волос или диета (веган/вегетарианец), добавь ферритин, трансферрин и % насыщения.
    3. Углеводный обмен: Если BMI > 25 или возраст 45+, добавь HbA1c и индекс HOMA-IR.
    4. Липидный профиль: ЛПНП, ЛПВП, ТГ, не-ЛПВП. Если 40+, добавь Липопротеин(а).
    5. Почки/Печень: Креатинин (с расчетом СКФ), мочевина, мочевая кислота. ГГТ, ЩФ.
    6. Щитовидная железа: ТТГ и Т4 свободный.
    7. Витамины: Витамин D (25-OH) обязательно.
    8. Мужчины 45-50+: ПСА общий.

    ФОРМАТ ОТВЕТА:
    - Используй Markdown.
    - Сначала дай краткое резюме состояния.
    - Список анализов по категориям.
    - Обоснование для каждого блока.
    - Рекомендации по подготовке.`;

  const userQuery = `Данные клиента:
    - Пол: ${formData.sex === 'male' ? 'Мужской' : 'Женский'}, Возраст: ${formData.age} лет.
    - Антропометрия: Рост ${formData.height}см, Вес ${formData.weight}кг (ИМТ: ${bmi}), Талия ${formData.waist}см, Бедра ${formData.hips}см.
    - Образ жизни: Курение: ${formData.smoking}, Алкоголь: ${formData.alcohol}, Активность: ${formData.activity}, Диета: ${formData.diet}, Регион: ${formData.region}.
    - Жалобы: ${formData.symptoms.join(', ') || 'Нет специфических жалоб'}.
    - Хронические заболевания: ${formData.chronic || 'Нет'}.
    - Принимаемые препараты: ${formData.meds || 'Нет'}.
    - Наследственность: ${formData.heredity || 'Не указана'}.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userQuery }
      ],
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || "Не удалось получить ответ от ИИ.";
  } catch (error: any) {
    console.error("Diagnostic Report Error:", error);
    throw new Error(error.message || "Ошибка при генерации отчета");
  }
}
