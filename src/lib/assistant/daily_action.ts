import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "../../lib/prisma";
import type { LifestyleContext } from "./context";
import type { Findings } from "./rules";
import { Pattern, detectPatterns } from "./patterns";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.BOT_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export type DailyActionContent = {
  teaser: string;
  expansion: string;
};

const SYSTEM_PROMPT = `Ты — копирайтер VIReyou. Твоя задача — сгенерировать ежедневное пуш-уведомление (Teaser) и его подробное раскрытие (Expansion) на основе выбранного инсайта. 
Голос: тёплый заботливый эксперт, никаких "дашбордов", фокус на организм и антитеза. 

Входные данные содержат:
1. area: область для проработки (например, sleep, protein)
2. whyShort, whyFull, actionIdea: контент из нашей базы знаний
3. currentValue: текущее значение метрики (если применимо)
4. targetValue: целевое значение метрики (если применимо)

ОГРАНИЧЕНИЯ:
- НЕ пересчитывай цифры. 
- НЕ используй слова: диета, похудение, сжигание жира, правильный образ жизни, лайфхак.
- Teaser должен быть коротким (до 150 символов), интригующим, тёплым (с одним эмодзи), чтобы человек захотел прочитать подробнее. 
- Expansion должно быть объемом ~300-500 символов: объяснение механизма через метафору + одно простое действие (actionIdea). 
- Обязательно обращайся на "вы". 

Выведи строго JSON объект:
{
  "teaser": "Текст тизера",
  "expansion": "Текст расширенного сообщения"
}`;

import { safetyGate } from "./safety";

export async function generateDailyAction(ctx: LifestyleContext, findings: Findings): Promise<DailyActionContent | null> {
  if (!apiKey) {
    console.error("No LLM API key configured");
    return null;
  }
  const gate = safetyGate(ctx, ctx.user.lang);
  if (gate.block) {
    // Medical flags present, we shouldn't push hard lifestyle changes
    return null;
  }

  // 1. Get recent logs to avoid repetition
  const recentLogs = await prisma.dailyActionLog.findMany({
    where: { userId: ctx.user.id },
    orderBy: { created_at: "desc" },
    take: 5
  });
  const recentAreas = new Set(recentLogs.map(l => l.area));

  // 2. Select insight (Pattern or Finding)
  const patterns = detectPatterns(findings, ctx);
  let selectedInsight: { isPattern: boolean, areaOrId: string, value?: number, target?: string, kind: string } | null = null;
  
  // Try pattern first
  for (const p of patterns) {
    if (!recentAreas.has(p.id)) {
      selectedInsight = { isPattern: true, areaOrId: p.id, kind: p.severity };
      break;
    }
  }

  // Fallback to L1
  if (!selectedInsight) {
    const l1Candidates = findings.l1.filter(f => f.status === "improve" || f.status === "excess");
    for (const c of l1Candidates) {
      if (!recentAreas.has(c.category)) {
         selectedInsight = { isPattern: false, areaOrId: c.category, value: c.value, target: c.target, kind: c.status };
         break;
      }
    }
  }
  
  // Fallback to general if nothing actionable or everything was recently sent
  if (!selectedInsight) {
    selectedInsight = { isPattern: false, areaOrId: "general", kind: "general" };
  }

  // 3. Fetch from DB
  let knowledge: any = null;
  if (selectedInsight.isPattern) {
    knowledge = await prisma.patternContent.findFirst({
      where: { patternId: selectedInsight.areaOrId, lang: ctx.user.lang }
    });
  } else {
    knowledge = await prisma.tipContent.findFirst({
      where: { area: selectedInsight.areaOrId, lang: ctx.user.lang, kind: selectedInsight.kind }
    });
    // Fallback if not found for specific kind
    if (!knowledge) {
        knowledge = await prisma.tipContent.findFirst({
            where: { area: "general", lang: ctx.user.lang }
        });
    }
  }

  if (!knowledge) {
      return null;
  }

  // 4. Generate with LLM
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { temperature: 0.6, responseMimeType: "application/json" }
  });

  const payload = {
      area: selectedInsight.areaOrId,
      whyShort: knowledge.whyShort,
      whyFull: knowledge.whyFull,
      actionIdea: knowledge.actionIdea,
      currentValue: selectedInsight.value,
      targetValue: selectedInsight.target
  };

  try {
      const result = await model.generateContent([
          { text: SYSTEM_PROMPT },
          { text: JSON.stringify(payload) }
      ]);
      const jsonRes = JSON.parse(result.response.text());
      
      // Log the action
      await prisma.dailyActionLog.create({
          data: {
              userId: ctx.user.id,
              area: selectedInsight.areaOrId,
              value: selectedInsight.value,
              target: selectedInsight.target
          }
      });

      return {
          teaser: jsonRes.teaser,
          expansion: jsonRes.expansion
      };
  } catch (e) {
      console.error("Daily Action generation failed", e);
      return null;
  }
}
