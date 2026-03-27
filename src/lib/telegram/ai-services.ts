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
 */
export async function analyzeFoodWithAI(imageBase64?: string, description?: string) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const prompt = `Ты — эксперт-нутрициолог и ИИ-аналитик питания.
Проанализируй предоставленные данные (фото и/или текст) и верни подробный отчет о КБЖУ, клетчатке, витаминах и минералах.

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
 */
export async function analyzeScreenshotWithAI(imageBase64: string) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const prompt = `Ты — система распознавания медицинских и фитнес-скриншотов (Apple Health, Garmin, Oura и т.д.).
Твоя задача — извлечь точные метрики из изображения.

**Требования к ответу:**
Верни СТРОГО JSON-объект следующего формата:
{
  "type": "SLEEP" | "ACTIVITY" | "UNKNOWN",
  "metrics": {
    // Для сна: "duration_hrs", "deep_hrs", "rem_hrs", "light_hrs", "hrv", "resting_heart_rate"
    // Для активности: "steps", "active_minutes", "calories_burned"
  },
  "description": "Краткое описание найденного",
  "status": "SUCCESS"
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
 */
export async function analyzeTextWithAI(text: string) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const prompt = `Ты — ИИ-аналитик здоровья и нутрициолог.
Определи тип данных из текста пользователя. СТРОГО один из типов:
1. "NUTRITION" - Питание или напитки (КБЖУ). Сюда ОТНОСЯТСЯ алкогольные напитки (вино, пиво, водка и т.д.), если указан объем (бокал, бутылка, 100г), чтобы рассчитать калории.
2. "SLEEP" - Показатели сна.
3. "ACTIVITY" - Шаги, спорт, тренировки.
4. "HABIT" - Вредные привычки (Алкоголь, курение, сахар). Относи сюда ТОЛЬКО если это общий факт (например, "я пью алкоголь по выходным") или привычки, а не конкретное употребление напитков с дозой.

Верни СТРОГО JSON-объект формата:
{
  "status": "SUCCESS",
  "type": "NUTRITION" | "SLEEP" | "ACTIVITY" | "HABIT",
  "description": "Краткое описание (что обнаружено).",
  "date_offset_days": 0,
  "habit_key": "Алкоголь" | "Курение" | "Сахар" | null, // Если это алкогольный напиток или табак, укажи категорию здесь, ДАЖЕ ЕСЛИ ТИП — NUTRITION!
  "data": {
    // ДЛЯ NUTRITION заполни объект полностью (как для анализа еды).
    // ДЛЯ SLEEP: { duration_hrs, deep_hrs, rem_hrs, light_hrs, hrv, resting_heart_rate }
    // ДЛЯ ACTIVITY: { steps, active_minutes, calories_burned }
    // ДЛЯ HABIT: { habit_key: "Краткое название" }
  }
}

Правило Оценки Граммовки (для NUTRITION): если указана "порция" или "кусок", сделай адекватное среднее предположение (не сдавайся на FAILED).
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
