"use server";

import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey });

export async function generateDiagnosticReport(formData: any, locale: string = 'ru') {
  if (!apiKey) {
    throw new Error("OpenAI API Key is missing");
  }

  const isEn = locale === 'en';

  const bmi = formData.height && formData.weight 
    ? (formData.weight / Math.pow(formData.height / 100, 2)).toFixed(1)
    : (isEn ? "not specified" : "не указан");

  const systemPrompt = isEn 
    ? `You are an expert in preventive medicine and healthy longevity. Your task is to analyze client data and provide a reasoned list of necessary blood biomarkers.
    
    ANALYSIS RULES:
    1. Basic screening: CBC (with differential + ESR) + Biochemistry (protein, glucose, creatinine, bilirubin, ALT, AST).
    2. Iron metabolism: If fatigue, hair loss, or diet (vegan/vegetarian), add ferritin, transferrin, and % saturation.
    3. Carbohydrate metabolism: If BMI > 25 or age 45+, add HbA1c and HOMA-IR index.
    4. Lipid profile: LDL, HDL, TG, non-HDL. If 40+, add Lipoprotein(a).
    5. Kidney/Liver: Creatinine (with eGFR calculation), urea, uric acid. GGT, Alk Phos.
    6. Thyroid: TSH and Free T4.
    7. Vitamins: Vitamin D (25-OH) is mandatory.
    8. Men 45-50+: PSA total.

    RESPONSE FORMAT:
    - Use Markdown.
    - Start with a brief summary of the condition.
    - List of tests by category.
    - Rationale for each block.
    - Preparation recommendations.
    
    CRITICAL: Respond in ${isEn ? 'English' : 'Russian'}.` 
    : `Ты — эксперт в области превентивной медицины и здорового долголетия. Твоя задача — проанализировать данные клиента и составить обоснованный список необходимых показателей крови.
    
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
    - Рекомендации по подготовке.
    
    ВАЖНО: Отвечай только на ${isEn ? 'английском' : 'русском'} языке.`;

  const userQuery = isEn
    ? `Client Data:
    - Gender: ${formData.sex === 'male' ? 'Male' : 'Female'}, Age: ${formData.age} years.
    - Anthropometry: Height ${formData.height}cm, Weight ${formData.weight}kg (BMI: ${bmi}), Waist ${formData.waist}cm, Hips ${formData.hips}cm.
    - Lifestyle: Smoking: ${formData.smoking}, Alcohol: ${formData.alcohol}, Activity: ${formData.activity}, Diet: ${formData.diet}, Region: ${formData.region}.
    - Complaints: ${formData.symptoms.join(', ') || 'No specific complaints'}.
    - Chronic diseases: ${formData.chronic || 'None'}.
    - Current meds: ${formData.meds || 'None'}.
    - Heredity: ${formData.heredity || 'Not specified'}.`
    : `Данные клиента:
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

    const content = response.choices[0]?.message?.content || (isEn ? "Failed to get response from AI." : "Не удалось получить ответ от ИИ.");

    return content;
  } catch (error: any) {
    console.error("Diagnostic Report Error:", error);
    throw new Error(error.message || (isEn ? "Error generating report" : "Ошибка при генерации отчета"));
  }
}
