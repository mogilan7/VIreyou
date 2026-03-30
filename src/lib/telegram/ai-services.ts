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
 * @param imageBase64 Опциональное изображение в base64.
 * @param description Опциональное текстовое описание.
 * @param referenceDate Текущая дата пользователя (YYYY-MM-DD, DayOfWeek) для корректного расчета смещения.
 */
export async function analyzeFoodWithAI(imageBase64?: string, description?: string, referenceDate?: string) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const todayStr = referenceDate || new Date().toISOString().split('T')[0];

  const prompt = `Ты — эксперт-нутрициолог и ИИ-аналитик питания.
Проанализируй предоставленные данные (фото и/или текст) и верни подробный отчет о КБЖУ, клетчатке, витаминах и минералах.

**КОНТЕКСТ:**
Сегодняшняя дата: ${todayStr}.
Используй её как СТРОГУЮ точку отсчета для "сегодня", "вчера", "позавчера" и любых относительных дат.
Если пользователь упоминает день недели (например, "в прошлый понедельник"), рассчитай смещение относительно ${todayStr}.

**Требования к ответу:**
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

  // Витамины (число в мкг у Vit A,D,K,B7,B9,B12, остальные в мг. СТРОГО ЧИСЛА). Включай ВСЕ поля, даже если значение равно 0.
  "vitamin_A": 900,
  "vitamin_D": 15,
  "vitamin_E": 15,
  "vitamin_K": 120,
  "vitamin_B1": 1.2,
  "vitamin_B2": 1.3,
  "vitamin_B3": 16,
  "vitamin_B5": 5,
  "vitamin_B6": 1.3,
  "vitamin_B7": 30,
  "vitamin_B9": 400,
  "vitamin_B12": 2.4,
  "vitamin_C": 90,

  // Минералы (число в мг, селен в мкг, йод в мкг. СТРОГО ЧИСЛА). Включай ВСЕ поля, даже если значение равно 0.
  "calcium": 1000,
  "iron": 12,
  "magnesium": 400,
  "phosphorus": 700,
  "potassium": 4700,
  "sodium": 1500,
  "zinc": 11,
  "copper": 0.9,
  "manganese": 2.3,
  "selenium": 55,
  "iodine": 150,

  // Метаданные для бота (ОБЯЗАТЕЛЬНО)
  "date_offset_days": 0, // СТРОГО ЧИСЛО. 0 для сегодня, -1 для данных за вчера, если пользователь прямо говорит "Вчера", "Позавчера" и т.д.
  "habit_key": "Алкоголь" | "Курение" | "Сахар" | null // Если зафиксированы вредные привычки, укажи краткую категорию. ДЛЯ ЛЮБОГО АЛКОГОЛЯ (пиво, вино и т.д.) ОБЯЗАТЕЛЬНО ставь "Алкоголь".
}

**Правила приближения и оценки (Граммовка):**
1. Если пользователь использует общие понятия ("порция", "тарелка", "миска", "стакан", "кусочек"), **всегда делай оценку веса по средним стандартам** (например: порция гарнира = 180г, порция супа = 300г, кусок хлеба = 30г).
2. **Запрещено** возвращать "status": "FAILED" только из-за отсутствия точной граммовки. Сделай наилучшее предположение на основе блюда.
3. Возвращай "status": "FAILED" только если данных вообще нет (например, сообщение "я поел") или они абсолютно нечитаемы.

Если указано фото — опирайся на него в приоритете.`;

  const messages: any[] = [{ role: "system", content: prompt }];

  const userContent: any[] = [];
  if (description) {
    userContent.push({ type: "text", text: `Описание пользователя: "${description}"` });
  }
  if (imageBase64) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
    });
  }

  messages.push({ role: "user", content: userContent });

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: messages,
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content || "{}";
  return JSON.parse(content);
}

/**
 * Читает скриншоты показателей здоровья (сон, шаги, активность).
 * @param imageBase64 Изображение в base64.
 * @param referenceDate Текущая дата пользователя.
 */
export async function analyzeScreenshotWithAI(imageBase64: string, referenceDate?: string) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const todayStr = referenceDate || new Date().toISOString().split('T')[0];

  const prompt = `Ты — система распознавания медицинских и фитнес-скриншотов (Apple Health, Garmin, Oura engine и т.д.).
Твоя задача — извлечь точные метрики из изображения.

**КОНТЕКСТ:**
Сегодняшняя дата: ${todayStr}.

**Требования к ответу:**
Верни СТРОГО JSON-объект следующего формата:
{
  "type": "SLEEP" | "ACTIVITY" | "UNKNOWN",
  "metrics": {
    // Для сна: "duration_hrs", "deep_hrs", "rem_hrs", "light_hrs", "hrv", "resting_heart_rate"
    // Для активности: "steps", "active_minutes", "calories_burned"
  },
  "description": "Краткое описание найденного",
  "status": "SUCCESS",
  "date_offset_days": 0 // 0 если на скриншоте данные за сегодня, -1 если за вчера. Если не очевидно, ставь 0.
}
Если тип определить не удалось, верни type: "UNKNOWN".`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: prompt },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content || "{}";
  return JSON.parse(content);
}


import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

export async function transcribeVoiceWithAI(file_path: string): Promise<string> {
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const wavPath = file_path.replace(/\.[^/.]+$/, "") + ".wav";
  console.log(`[VOICE] Converting ${file_path} to ${wavPath} via ffmpeg...`);
  
  try {
    await execAsync(`"${ffmpeg}" -i "${file_path}" "${wavPath}" -y -loglevel error`);
    console.log(`[VOICE] Conversion successful`);
  } catch (err) {
    console.error(`[VOICE] ffmpeg conversion failed:`, err);
    throw err;
  }

  try {
    console.log(`[VOICE] Preparing file with toFile for Whisper...`);
    const file = await toFile(await fs.promises.readFile(wavPath), "voice.wav");
    console.log(`[VOICE] Submitting to Whisper API...`);
    
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
    });

    console.log(`[VOICE] Whisper API responded successfully`);
    return transcription.text;
  } finally {
    if (fs.existsSync(wavPath)) {
      await fs.promises.unlink(wavPath);
      console.log(`[VOICE] Cleaned up temporary WAV file: ${wavPath}`);
    }
  }
}

/**
 * Анализирует текст пользователя для определения категории здоровья (Питание, Сон, Активность, Привычки).
 * @param text Текст пользователя.
 * @param referenceDate Текущая дата пользователя (YYYY-MM-DD, DayOfWeek) для корректного расчета смещения.
 */
export async function analyzeTextWithAI(text: string, referenceDate?: string) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const todayStr = referenceDate || new Date().toISOString().split('T')[0];

  const prompt = `Ты — ИИ-аналитик здоровья и нутрициолог.
Определи тип данных из текста пользователя. СТРОГО один из типов:
1. "NUTRITION" - Питание или напитки (КБЖУ). Сюда ОТНОСЯТСЯ алкогольные напитки (вино, пиво, водка и т.д.), если указан объем (бокал, бутылка, 100г), чтобы рассчитать калории.
2. "SLEEP" - Показатели сна.
3. "ACTIVITY" - Шаги, спорт, тренировки.
4. "HABIT" - Вредные привычки (Алкоголь, курение, сахар). Относи сюда ТОЛЬКО если это общий факт (например, "я пью алкоголь по выходным") или привычки, а не конкретное употребление напитков с дозой.

**КОНТЕКСТ:**
Сегодняшняя дата: ${todayStr}.
Используй её как СТРОГУЮ точку отсчета для слов "сегодня", "вчера", "позавчера", дней недели и любых относительных дат.

Верни СТРОГО JSON-объект формата:
{
  "status": "SUCCESS",
  "type": "NUTRITION" | "SLEEP" | "ACTIVITY" | "HABIT",
  "description": "Краткое описание (что обнаружено).",
  "date_offset_days": 0, // СТРОГО ЧИСЛО. 0 для сегодня, -1 для "вчера", -2 для "позавчера". Рассчитывай это число относительно переданной даты ${todayStr}. Если пользователь говорит "вчера", то date_offset_days ВСЕГДА равен -1.
  "habit_key": "Алкоголь" | "Курение" | "Сахар" | null, // Если это алкогольный напиток или табак, укажи категорию здесь, ДАЖЕ ЕСЛИ ТИП — NUTRITION!
  "data": {
    // ДЛЯ NUTRITION заполни СЛЕДУЮЩИЕ ПОЛЯ (ОБЯЗАТЕЛЬНО):
    "dish": "Название еды/напитка",
    "grams": 300, // Число (оценка веса)
    "calories": 150.0,
    "protein": 0.5,
    "carbs": 12.0,
    "fat": 0.0,
    "fiber": 0.0,
    "sugar_fast": 0.0,
    "trans_fat": 0.0,
    "cholesterol": 0.0,
    "added_sugar": 0.0,
    "omega_3": 0.0,
    "omega_6": 0.0,
    "water": 250,

    // ДЛЯ SLEEP: { duration_hrs, deep_hrs, rem_hrs, light_hrs, hrv, resting_heart_rate }
    // ДЛЯ ACTIVITY: { steps, active_minutes, calories_burned }
    // ДЛЯ HABIT: { habit_key: "Краткое название" }
  }
}

Примеры: 
- "Пиво 330г" -> type: "NUTRITION", habit_key: "Алкоголь", data: { dish: "Пиво", grams: 330, ... }
- "Я выкурил сигарету" -> type: "HABIT", habit_key: "Курение", data: { habit_key: "Курение" }
- "Вчера я прошел 7000 шагов" -> type: "ACTIVITY", date_offset_days: -1, data: { steps: 7000 }

Правило Оценки Граммовки (для NUTRITION): если указана "порция" или "кусок", сделай адекватное среднее предположение.
Для ЛЮБОГО упоминания алкоголя (пиво, бокал вина и т.д.) ОБЯЗАТЕЛЬНО ставь habit_key: "Алкоголь".`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Текст пользователя: "${text}"` }
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content || "{}";
  return JSON.parse(content);
}

/**
 * Генерирует рекомендации по питанию на основе дневного рациона и базы знаний.
 */
export async function analyzeDailyNutritionWithAI(nutrients: any, userProfile: any) {
    if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

    const prompt = `Role: Ты — высококвалифицированный ИИ-нутрициолог и эксперт по превентивной медицине. Твоя задача — анализировать рацион пользователя за день, выявлять дефициты нутриентов и давать рекомендации по их восполнению, опираясь исключительно на предоставленную базу знаний.

Knowledge Base (Обязательные источники):
Для формирования отчета и рекомендаций используй данные только из следующих файлов:
1. Нормативы и общие принципы: «Презентация Ших Е.В..pdf», «Презентация. Критические нутриенты 1.pdf», «Презентация. Критические нутриенты 2.pdf», «Презентация. Критические нутриенты 3.pdf».
2. Жирорастворимые витамины: «Презентация. Витамин А.pdf», «Витамин D.pdf», «Презентация. Витамин Е и К .pdf».
3. Водорастворимые витамины: «Презентация 1. Водорастворимые витамины .pdf», «Презентация 2. Водорастворимые витамины .pdf», «Презентация 3. Водорастворимые витамины.pdf».
4. Омега-3 и жирные кислоты: «Презентация. Омега-3. Часть 1.pdf», «Презентация. Омега-3. Часть 2.pdf», «Презентация. Омега-3. Часть 3.pdf».
5. Взаимодействие и биодоступность: «Взаимодействие нутриентов.pdf».
6. Антивозрастные стратегии и стресс: «Презентация. Фармакология антиэйджинга.pdf», «Презентация. Профилактика возраст ассоциированных заболеваний.pdf», «Презентация. Социальный джетлаг. Какие выбрать микронутриенты .pdf».

Алгоритм работы:
1. Анализ данных: Сравни полученные от пользователя значения КЖБУ, витаминов и минералов с физиологическими нормами РФ (МР 2.3.1.0253-21), указанными в источниках.
2. Выявление отклонений: Четко перечисли показатели, которые ниже нормы. Учитывай возраст и пол пользователя.
3. Подбор блюд: Предложи 2–3 блюда или продукта-суперфуда из источников.
   Пример: Если дефицит Витамина А и Омега-3 — предлагай печень трески (источник: «Презентация. Омега-3. Часть 2.pdf»).
   Пример: Если дефицит магния — предлагай тыквенные семечки или шпинат (источник: «Презентация. Критические нутриенты 2.pdf»).
4. Учет синергии (из файла «Взаимодействие нутриентов.pdf»):
   * Если рекомендуешь продукты с железом, добавь совет употребить их с витамином С, но отдельно от кальция.
   * Если рекомендуешь магний, упомяни важность витамина В6 для его удержания в клетках.

Формат отчета:
1. Статус: Краткое резюме (что в норме, а что критично).
2. Рекомендация по продуктам: Конкретные продукты/блюда с указанием, какой именно дефицит они закрывают.
3. Важное примечание: Совет по сочетаемости (биоактивность и синергия).

Важно: НЕ указывай названия PDF-файлов или источников в итоговом ответе. Просто давай рекомендации как эксперт.

Tone of Voice: Академическая точность в сочетании с практической пользой. Не используй общие советы из интернета, только факты из вышеуказанных документов.`;

    const userContext = `Данные пользователя:
Пол: ${userProfile.gender || 'не указан'}
Возраст: ${userProfile.age || 'не указан'}
Вес: ${userProfile.weight || 'не указан'} кг

Дневной рацион (суммарные нутриенты):
${JSON.stringify(nutrients, null, 2)}`;

    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            { role: "system", content: prompt },
            { role: "user", content: userContext }
        ],
        temperature: 0.3,
    });

    return response.choices[0]?.message?.content || "Не удалось сгенерировать рекомендации.";
}
