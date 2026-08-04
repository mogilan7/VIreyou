import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LifestyleContext } from "./context";
import type { Finding } from "./rules";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.BOT_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

const SYSTEM_PROMPT = `Ты — дружелюбный ассистент по образу жизни в приложении VIReYou.
Тебе передают ГОТОВЫЙ разбор данных пользователя (findings) — цифры и статусы
уже проверены системой. НЕ пересчитывай их и НЕ придумывай новые пороги или числа.

Твоя задача: превратить findings в короткое тёплое сообщение (до ~1200 знаков):
1. Сначала отметь 1–2 вещи, которые уже в норме (status = good).
2. Затем 1–3 конкретных действия на СЕГОДНЯ по тем, где status = improve,
   отсортированным по severity. Действия должны быть выполнимы за день
   (напр. «лечь на 30 минут раньше», «добавить 2000 шагов вечерней прогулкой»).
3. Пиши на языке пользователя, на «ты», без морализаторства и вины.

СТРОГО ЗАПРЕЩЕНО:
- ставить диагнозы, трактовать биомаркеры как болезнь;
- называть лекарства, БАДы в дозировках, отменять назначения врача;
- советовать снижение калорий/веса, если передан флаг eating_disorder,
  pregnant или minor — в этом случае давай только нейтральные советы
  (сон, вода, прогулка) и мягко предложи обратиться к специалисту;
- придумывать данные, которых нет в findings (для no_data — предложи начать логировать).`;

export async function generateAdvice(ctx: LifestyleContext, findings: Finding[]): Promise<string> {
  if (!apiKey) return "Ой, я не могу подключиться к своим нейросетям (нет ключа API).";
  
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.4,
    }
  });

  const content = JSON.stringify({
    lang: ctx.user.lang,
    flags: ctx.user.conditionsFlags,
    findings,
  });

  try {
    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: `Входные данные:\n${content}` }
    ]);
    return result.response.text();
  } catch (error) {
    console.error("Failed to generate advice:", error);
    return "Произошла ошибка при формировании разбора. Пожалуйста, попробуй позже.";
  }
}
