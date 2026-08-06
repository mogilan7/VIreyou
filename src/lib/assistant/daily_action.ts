import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "../../lib/prisma";
import type { LifestyleContext } from "./context";
import type { Findings } from "./rules";
import { Pattern, detectPatterns } from "./patterns";
import { safetyGate } from "./safety";
import { pickReliableFocus, buildKnowledge, validateGrounding, KNOWLEDGE_INSTRUCTION, assessReliability, applyReliability } from "./grounding";

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

  // 2. Adjust findings for reliability and select insight (Pattern or Finding)
  const r = assessReliability(ctx);
  const adjustedL1 = applyReliability(findings.l1, r);
  const adjustedFindings: Findings = { l1: adjustedL1, l2: findings.l2, l3: findings.l3 };
  
  const patterns = detectPatterns(adjustedFindings, ctx);
  const focus = await pickReliableFocus(adjustedFindings, patterns, ctx, recentAreas, prisma);

  if (!focus) {
      // Should not send onboarding today due to cooldown
      return null;
  }

  // 3. Fetch full KNOWLEDGE from DB
  const knowledge = await buildKnowledge(prisma, focus, ctx.user.lang);
  if (!knowledge) {
      console.error("No knowledge found in DB for focus:", focus);
      return null;
  }

  // 4. Generate with LLM (with retry loop for grounding validation)
  const system = `${SYSTEM_PROMPT}\n\n${KNOWLEDGE_INSTRUCTION}`;
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { temperature: 0.6, responseMimeType: "application/json" }
  });

  const payload = {
      area: focus.areaOrId,
      whyShort: knowledge.whyShort,
      whyFull: knowledge.whyFull,
      actionIdea: knowledge.actionIdea,
      currentValue: focus.value,
      targetValue: focus.target
  };

  let out: DailyActionContent;
  
  try {
      let result = await model.generateContent([
          { text: system },
          { text: JSON.stringify(payload) }
      ]);
      let jsonRes = JSON.parse(result.response.text());
      out = { teaser: jsonRes.teaser, expansion: jsonRes.expansion };

      let check = validateGrounding(out.teaser + "\n" + out.expansion, { findings: adjustedL1, knowledge });
      
      if (!check.ok) {
          console.warn("Grounding issues detected:", check.issues, "- Retrying generation...");
          
          // One retry
          result = await model.generateContent([
              { text: system },
              { text: JSON.stringify(payload) }
          ]);
          jsonRes = JSON.parse(result.response.text());
          out = { teaser: jsonRes.teaser, expansion: jsonRes.expansion };
          check = validateGrounding(out.teaser + "\n" + out.expansion, { findings: adjustedL1, knowledge });
          
          if (!check.ok) {
              console.warn("Grounding issues persisted after retry:", check.issues, "- Falling back to curated text.");
              // Fallback without free generation
              out = { teaser: knowledge.whyShort, expansion: knowledge.whyFull + "\n\n" + knowledge.actionIdea };
          }
      }

      // Log the action
      await prisma.dailyActionLog.create({
          data: {
              userId: ctx.user.id,
              area: focus.areaOrId,
              value: focus.value || null,
              target: focus.target || null
          }
      });

      return out;
  } catch (e) {
      console.error("Daily Action generation failed", e);
      return null;
  }
}
