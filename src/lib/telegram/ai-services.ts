import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
import OpenAI, { toFile } from "openai";
import fs from "fs";
import path from "path";
import ffmpeg from "ffmpeg-static";

const apiKey = process.env.BOT_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey });

/**
 * Распознает еду по фотографии или описанию.
 */
export async function analyzeFoodWithAI(imageBase64?: string, description?: string, referenceDate?: string) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const todayStr = referenceDate || new Date().toISOString().split('T')[0];

  const prompt = `Ты — эксперт-нутрициолог и ИИ-аналитик питания.
Проанализируй предоставленные данные (фото и/или текст) и верни подробный отчет о КБЖУ, клетчатке, витаминах и минералах.

**КОНТЕКСТ:**
Сегодняшняя дата: ${todayStr}.
Используй её как СТРОГУЮ точку отсчета для "сегодня", "вчера", "позавчера" и любых относительных дат.

Верни СТРОГО JSON-объект следующего формата:
{
  "status": "SUCCESS",
  "description": "Краткое описание блюда, его состава и пользы.",
  "dish": "Название блюда",
  "grams": 250,
  "calories": 350.0,
  "protein": 15.5,
  "carbs": 42.0,
  "fat": 12.0,
  "fiber": 4.5,
  "sugar_fast": 5.0,
  "trans_fat": 0.0,
  "cholesterol": 15.0,
  "added_sugar": 0.0,
  "omega_3": 1.2,
  "omega_6": 3.4,
  "water": 100,
  "vitamin_A": 900, "vitamin_D": 15, "vitamin_E": 15, "vitamin_K": 120,
  "vitamin_B1": 1.2, "vitamin_B2": 1.3, "vitamin_B3": 16, "vitamin_B5": 5, "vitamin_B6": 1.3, "vitamin_B7": 30, "vitamin_B9": 400, "vitamin_B12": 2.4, "vitamin_C": 90,
  "calcium": 1000, "iron": 12, "magnesium": 400, "phosphorus": 700, "potassium": 4700, "sodium": 1500, "zinc": 11, "copper": 0.9, "manganese": 2.3, "selenium": 55, "iodine": 150,
  "date_offset_days": 0,
  "habit_key": "Алкоголь" | "Курение" | "Сахар" | null
}
Если указано фото — опирайся на него в приоритете.`;

  const messages: any[] = [{ role: "system", content: prompt }];
  const userContent: any[] = [];
  if (description) userContent.push({ type: "text", text: `Описание пользователя: "${description}"` });
  if (imageBase64) userContent.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } });

  messages.push({ role: "user", content: userContent });

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: messages,
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  return JSON.parse(response.choices[0]?.message?.content || "{}");
}

/**
 * Читает скриншоты показателей здоровья.
 */
export async function analyzeScreenshotWithAI(imageBase64: string, referenceDate?: string) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");
  const todayStr = referenceDate || new Date().toISOString().split('T')[0];
  const prompt = `Ты — система распознавания медицинских и фитнес-скриншотов. Твоя задача — извлечь показатели здоровья и вернуть их в СТРОГО структурированном виде.

Верни СТРОГО JSON:
{
  "status": "SUCCESS",
  "type": "SLEEP" | "ACTIVITY" | "UNKNOWN",
  "description": "Краткое описание на языке скриншота (например: 'Сон 7 часов 20 минут' или 'Активность за день: 5000 шагов').",
  "metrics": {},
  "date_offset_days": 0
}

**ПРАВИЛА ДЛЯ METRICS (в зависимости от type):**

1. Если type "SLEEP":
   - "duration_hrs": число (часы),
   - "deep_hrs": число (часы),
   - "rem_hrs": число (часы),
   - "light_hrs": число (часы),
   - "hrv": число (мс),
   - "resting_heart_rate": число (уд/мин).

2. Если type "ACTIVITY":
   - "steps": целое число,
   - "active_minutes": активные минуты / время тренировки (целое число),
   - "calories_burned": сожженные калории (число).

Если на скриншоте нет нужных данных, верни type "UNKNOWN".`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }] }
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  return JSON.parse(response.choices[0]?.message?.content || "{}");
}

import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

export async function transcribeVoiceWithAI(file_path: string): Promise<string> {
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");
  const wavPath = file_path.replace(/\.[^/.]+$/, "") + ".wav";
  try {
    await execAsync(`"${ffmpeg}" -i "${file_path}" "${wavPath}" -y -loglevel error`);
    const file = await toFile(await fs.promises.readFile(wavPath), "voice.wav");
    const transcription = await openai.audio.transcriptions.create({ file, model: "whisper-1" });
    return transcription.text;
  } finally {
    if (fs.existsSync(wavPath)) await fs.promises.unlink(wavPath);
  }
}

/**
 * Анализирует текст пользователя для определения категории здоровья.
 */
export async function analyzeTextWithAI(text: string, referenceDate?: string) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");
  const todayStr = referenceDate || new Date().toISOString().split('T')[0];
  const prompt = `Ты — профессиональный ИИ-аналитик здоровья. Твоя задача — классифицировать сообщение и извлечь показатели в структурированный JSON.
Сегодняшняя дата: ${todayStr}. Используй её как точку отсчета для "сегодня", "вчера" (date_offset_days: -1) и т.д.

Верни СТРОГО JSON:
{
  "status": "SUCCESS" | "ERROR",
  "type": "NUTRITION" | "SLEEP" | "ACTIVITY" | "HABIT",
  "description": "Краткое описание на языке пользователя.",
  "data": { ... },
  "date_offset_days": 0,
  "habit_key": "Алкоголь" | "Курение" | null
}

**ПРАВИЛА ДЛЯ DATA (обязательно заполни все поля внутри JSON-объекта 'data'):**
- NUTRITION: { "dish": "название", "calories": 350, "protein": 15, "carbs": 40, "fat": 12, "grams": 250, "fiber": 5 }
  При типе NUTRITION Обязательно ОЦЕНИВАЙ КБЖУ (калории, белки, жиры, углеводы) на основе описания еды. 
  Если в еде есть Алкоголь, укажи "habit_key": "Алкоголь" на верхнем уровне.
- SLEEP: { "duration_hrs": 8, "deep_hrs": 1.5, "rem_hrs": 2, "light_hrs": 4.5, "hrv": 60, "resting_heart_rate": 55 }
- ACTIVITY: { "steps": 5000, "active_minutes": 30, "calories_burned": 250 }
- HABIT: { "habit_key": "Алкоголь" | "Курение" | "Сахар" }
  ВНИМАНИЕ: Если type: "HABIT", поле 'habit_key' должно быть ОБЯЗАТЕЛЬНО заполнено и в корневом объекте, и внутри объекта 'data'.

Если суть сообщения непонятна, верни status "ERROR".`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "system", content: prompt }, { role: "user", content: `Текст: "${text}"` }],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  return JSON.parse(response.choices[0]?.message?.content || "{}");
}

/**
 * Генерирует рекомендации по питанию на основе дневного рациона и базы знаний.
 */
export async function analyzeDailyNutritionWithAI(nutrients: any, userProfile: any, lang: string = 'ru') {
    if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

    const isEn = lang === 'en';
    
    const promptEn = `Role: You are a highly qualified AI nutritionist and expert in preventive medicine. Your task is to analyze the user's daily diet, identify nutrient deficiencies, and provide recommendations for replenishment, based exclusively on the provided knowledge base (PDF documents attached to your system context).

Knowledge Base Instructions:
1. Standards: Use physiological standards for nutrients. Consider user's gender (${userProfile.gender}) and age (${userProfile.age}).
2. Interaction: Consider nutrient synergies (e.g., Vitamin C + Iron).
3. Selection: Suggest 2-3 specific superfoods from the documents to cover identified gaps.

Algorithm:
1. Compare user data with standards.
2. List deficiencies.
3. Provide food recommendations.
4. Add interaction notes.

Report Format:
1. Status: Summary of what is normal and what is critical.
2. Food Recommendations: Specific products and the metrics they improve.
3. Important Note: Synergies and bioavailability advice.

Constraints:
- Respond STRICTLY in English.
- Tone: Academic precision with practical utility.
- IMPORTANT: You MUST mention the names of all the PDF files from the knowledge base you referenced, preferably right next to the recommendation.`;

    const promptRu = `Role: Ты — высококвалифицированный ИИ-нутрициолог и эксперт по превентивной медицине. Твоя задача — анализировать рацион пользователя за день, выявлять дефициты нутриентов и давать рекомендации по их восполнению, опираясь исключительно на предоставленную базу знаний.

Алгоритм работы:
1. Анализ данных: Сравни полученные от пользователя значения с физиологическими нормами РФ. Учитывай пол (${userProfile.gender}) и возраст (${userProfile.age}).
2. Выявление отклонений: Четко перечисли показатели ниже нормы.
3. Подбор блюд: Предложи 2–3 продукта-суперфуда из источников.
4. Учет синергии: Сочетай нутриенты правильно (например, железо + витамин С).

Формат отчета:
1. Статус: Краткое резюме (что в норме, а что критично).
2. Рекомендация по продуктам: Конкретные продукты и какой дефицит они закрывают.
3. Важное примечание: Совет по сочетаемости.

Важно: ОБЯЗАТЕЛЬНО укажи названия файлов из базы знаний (справочника), на которые ты сослался в своей рекомендации (желательно прямо рядом с самой рекомендацией). Отвечай СТРОГО на русском языке.
Tone of Voice: Академическая точность и практическая польза.`;

    const userContextEn = `User Context:
Gender: ${userProfile.gender}
Age: ${userProfile.age}
Weight: ${userProfile.weight} kg

Daily Nutrient Totals (JSON):
${JSON.stringify(nutrients, null, 2)}`;

    const userContextRu = `Данные пользователя:
Пол: ${userProfile.gender}
Возраст: ${userProfile.age}
Вес: ${userProfile.weight} кг

Дневной рацион (КБЖУ и нутриенты):
${JSON.stringify(nutrients, null, 2)}`;

    const assistantId = process.env.OPENAI_ASSISTANT_ID;
    if (!assistantId) throw new Error("OPENAI_ASSISTANT_ID is missing");

    // 1. Create a Thread
    const thread = await openai.beta.threads.create();

    // 2. Add Message
    await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: isEn ? userContextEn : userContextRu
    });

    // 3. Run and Poll
    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
        assistant_id: assistantId,
        additional_instructions: isEn ? promptEn : promptRu
    });

    if (run.status === "completed") {
        const messages = await openai.beta.threads.messages.list(thread.id);
        const lastMessage = messages.data.find(m => m.role === "assistant");
        const content = lastMessage?.content[0];
        
        if (content?.type === "text") {
            return content.text.value;
        }
    }

    return isEn ? "Failed to generate recommendations." : "Не удалось сгенерировать рекомендации.";
}

/**
 * Оценивает продукт в супермаркете по фото этикетки, учитывая то, что пользователь уже съел сегодня.
 */
export async function analyzeProductLabelWithAI(imageBase64: string, currentNutrients: any, lang: string = 'ru') {
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const prompt = `Ты — строгий ИИ-нутрициолог. Пользователь прислал фото продукта из магазина (этикетка состава или БЖУ).
Тебе также передан JSON с тем, что пользователь УЖЕ съел за сегодня.

Твоя задача:
1. Распознать состав продукта на фото (ищи скрытый сахар, Е-добавки, трансжиры).
2. Оценить БЖУ продукта.
3. Сопоставить это с тем, что пользователь уже съел сегодня.
4. Вынести вердикт: стоит ли это покупать?

Верни СТРОГО JSON-объект:
{
  "status": "SUCCESS" | "UNKNOWN",
  "verdict": "BUY" | "LIMIT" | "AVOID",
  "title": "Краткое название продукта",
  "reason": "Объяснение на ${lang === 'en' ? 'английском' : 'русском'} языке, почему стоит или не стоит брать продукт (максимум 3-4 предложения). Упомяни контекст текущего дня (например, 'у вас уже перебор по жирам').",
  "hidden_nasties": ["список вредных добавок, если есть"]
}
Если на фото не еда или текст не читается, верни status "UNKNOWN".

ТЕКУЩИЕ НУТРИЕНТЫ ЗА СЕГОДНЯ:
${JSON.stringify(currentNutrients, null, 2)}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }] }
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  return JSON.parse(response.choices[0]?.message?.content || "{}");
}

/**
 * Проактивно предлагает варианты приемов пищи на остаток дня.
 */
export async function getProactiveNutritionAdvice(currentNutrients: any, userProfile: any, lang: string = 'ru') {
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const prompt = `Ты — проактивный ИИ-коуч по здоровью. Сейчас середина или конец дня.
У тебя есть данные о том, что пользователь уже съел.
Рассчитай дельту до физиологической нормы (учитывай пол: ${userProfile.gender}, возраст: ${userProfile.age}).

Твоя задача — предложить 1-2 конкретных варианта приема пищи (обед или ужин), чтобы ИДЕАЛЬНО закрыть остаток нормы по КБЖУ и особенно по микронутриентам (витаминам/минералам), которых не хватает.

Ответ должен быть в формате ободряющего сообщения для мессенджера (Telegram).
Используй эмодзи. Отвечай на ${lang === 'en' ? 'английском' : 'русском'} языке.
Не делай текст слишком длинным. Сразу к делу: чего не хватает и что съесть.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Мой рацион за сегодня:\n${JSON.stringify(currentNutrients, null, 2)}\nЧто мне съесть дальше?` }
    ],
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || "";
}
