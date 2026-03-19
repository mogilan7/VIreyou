import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
import OpenAI from "openai";
import fs from "fs";
import path from "path";

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
Проанализируй предоставленные данные (фото и/или текст) и верни подробный отчет о КБЖУ, клетчатке и витаминах/микроэлементах.

**Требования к ответу:**
Верни СТРОГО JSON-объект следующего формата:
{
  "calories": 350.0,
  "protein": 15.5,
  "carbs": 42.0,
  "fat": 12.0,
  "fiber": 4.5,
  "vitamins_minerals": {
    "Витамин C": "25 мг",
    "Калий": "400 мг",
    "Магний": "50 мг"
  },
  "description": "Краткое описание блюда, его состава и пользы.",
  "status": "SUCCESS"
}

Если данных недостаточно для распознавания, верни "status": "FAILED" и в "description" напиши, что пошло не так.
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
    // Для сна: "duration_hrs", "deep_hrs", "rem_hrs"
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

/**
 * Переводит голосовое сообщение в текст.
 * @param file_path Локальный путь к аудиофайлу (.ogg).
 */
export async function transcribeVoiceWithAI(file_path: string): Promise<string> {
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(file_path),
    model: "whisper-1",
  });

  return transcription.text;
}
