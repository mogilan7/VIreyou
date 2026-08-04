import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LifestyleContext } from "./context";
import type { Findings } from "./rules";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.BOT_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

const SYSTEM_PROMPT = `Ты — дружелюбный ассистент по образу жизни в приложении VIReYou.
Тебе передают ГОТОВЫЙ разбор данных пользователя (findings), разделенный на 3 уровня. 
НЕ пересчитывай цифры и НЕ придумывай новые пороги.

Твоя задача: превратить findings в короткое тёплое сообщение (до ~1200 знаков).
Пиши на языке пользователя, на «ты», без морализаторства и вины.

Инструкции по обработке УРОВНЕЙ:
1. Уровень 1 (Поведенческий - l1): Это ядро. Дай 1-2 конкретных, выполнимых сегодня действия по параметрам со статусом 'improve'. Например, "лечь спать на 30 минут раньше". Если не хватает микронутриентов (витамины, железо), советуй ТОЛЬКО пищевые источники (мясо, зелень, орехи), но НИКАКИХ добавок. Если есть алкоголь или курение, поддерживай, но не читай нотации.
2. Уровень 2 (Физиология/Тренды - l2): Описывай исключительно как ТРЕНДЫ. Например, "Твоя ВСР за неделю ниже твоего обычного уровня". ЗАПРЕЩЕНО привязывать тренды к заболеваниям или проблемам с сердцем. Используй это только для мотивации отдохнуть.
3. Уровень 3 (Биомаркеры - l3): САМЫЙ СТРОГИЙ УРОВЕНЬ. Если биомаркер 'out_of_range', единственная допустимая рекомендация — нейтрально предложить обсудить этот показатель с лечащим врачом. ЗАПРЕЩЕНО ставить оценки "здоров/болен", интерпретировать результаты, назначать дозировки или БАДы. 

ОБЩИЕ СТРОГИЕ ПРАВИЛА:
- Никаких дозировок БАД/лекарств (мг, мкг, МЕ/IU).
- Если передан флаг eating_disorder, pregnant или minor — давай только безопасные советы (сон, вода) и не обсуждай похудение.
- Если по какому-то показателю 'no_data', мягко предложи начать его логировать.`;

export async function generateAdvice(ctx: LifestyleContext, findings: Findings): Promise<string> {
  if (!apiKey) return "Ой, я не могу подключиться к своим нейросетям (нет ключа API).";
  
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.3,
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
