import { PrismaClient } from "@prisma/client";
import { LifestyleContext } from "./context";
import { Finding, Findings } from "./rules";

// ────────────────────────────────────────────────────────────────────────────
// 0. Бренд-константы
// ────────────────────────────────────────────────────────────────────────────
export const ALLOWED_EMOJI = new Set([
  "🌿", "🌱", "🌸", "☀️", "✨", "☺️", "🥰", "🤍", "🫶", "✅", "🍃", "🤲", "💖", "🎢", "💫"
]);

export const BRAND_FORBIDDEN = [
  "диета", "похудение", "сжигание жира", "должна", "обязана", "правильный образ жизни",
  "купи", "закажи", "скидка", "успей", "секрет", "лайфхак", "гайд", "топ-5", "срочно",
  "чудо-средство", "разгон метаболизма",
];

// «продающие» хук-вопросы и CTA, которых голос бренда избегает
const MARKETING_HOOKS = [
  /^\s*хотите\b.*\?/i, /подарите себе/i, /не упусти/i, /всего за/i, /закажите/i,
];

// мед-красные-флаги: дозировки и претензия на диагноз
const MED_REDFLAGS = [
  /\b\d+\s?(мг|мкг|г|ме|iu)\b/i, /диагноз/i, /вылечит/i, /болезн/i, /здоров(а|ы)?\b/i,
];

// ────────────────────────────────────────────────────────────────────────────
// 1. Gate правдоподобия
// ────────────────────────────────────────────────────────────────────────────
export interface Reliability { nutrition: boolean; sleep: boolean }

async function shouldSendOnboarding(prisma: any, userId: string): Promise<boolean> {
  const logs = await prisma.dailyActionLog.findMany({
    where: { userId, area: "onboarding" },
    orderBy: { created_at: "desc" },
    take: 7
  });
  
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  
  if (logs.length === 0) return true; // First time
  
  const lastSent = logs[0].created_at.getTime();
  const daysSinceLast = (now - lastSent) / dayMs;
  
  if (logs.length < 3) {
      // First 2-3 days: send daily
      return daysSinceLast >= 0.9;
  } else if (logs.length < 7) {
      // Next: every 3 days
      return daysSinceLast >= 2.9;
  } else {
      // After ~7 ignored, pause indefinitely
      return false;
  }
}


const NUTRITION_CATS = new Set([
  "protein", "iron", "fiber", "vitaminD", "added_sugar", "sodium", "saturated_fat", "trans_fat", "hydration"
]);

/** Данные считаем надёжными только при правдоподобном объёме логирования. */
export function assessReliability(ctx: LifestyleContext): Reliability {
  const kcal = ctx?.l1?.nutrition?.avgKcal;
  const loggedDays = ctx?.l1?.nutrition?.loggedDays;
  const nutrition =
    typeof kcal === "number" && kcal >= 1000 &&
    typeof loggedDays === "number" && loggedDays >= 3;

  const nights = ctx?.l1?.sleep?.nights ?? 0;
  const sleep = nights >= 3;                              // не «недосып» по 1–2 ночам

  return { nutrition, sleep };
}

/**
 * Понижаем ненадёжные findings до 'low_confidence' — по ним НЕ утверждаем дефицит/норму,
 * а мягко зовём логировать полнее. Работает и для 'improve', и для 'excess'/'good' по питанию.
 */
export function applyReliability(findings: Finding[], r: Reliability): Finding[] {
  return findings.map((f) => {
    const cat = f.category;
    const isNutrition = NUTRITION_CATS.has(cat);
    if (isNutrition && !r.nutrition) return { ...f, status: "low_confidence" };
    if (cat === "sleep" && !r.sleep) return { ...f, status: "low_confidence" };
    return f;
  });
}

/**
 * Выбор фокуса дня с учётом надёжности: пропускаем low_confidence; если надёжного фокуса нет —
 * отдаём мягкое приглашение логировать полнее (kind: 'log_more').
 */
export async function pickReliableFocus(adjustedFindings: Findings, patterns: any[], ctx: LifestyleContext, recentAreas: Set<string>, prisma: any) {
  const adjustedL1 = adjustedFindings.l1;

  // Filter out recently sent patterns
  const availablePatterns = patterns?.filter((p) => !recentAreas.has(p.id));
  const pat = availablePatterns?.find((p) => p.severity === "medium" || p.severity === "high");
  if (pat) return { kind: "pattern", pattern: pat, areaOrId: pat.id, value: pat.value };

  // Filter out recently sent findings
  const pool = adjustedL1.filter(
    (f) => (f.status === "improve" || f.status === "excess") && !recentAreas.has(f.category)
  );
  if (pool.length > 0) {
    const dayIdx = Math.floor(Date.now() / 86_400_000);
    const selected = pool[dayIdx % pool.length];
    return { kind: "finding", finding: selected, areaOrId: selected.category, value: selected.value, target: selected.target };
  }

  // Check Onboarding State (empty)
  const allNoData = adjustedL1.length === 0 || adjustedL1.every(f => f.status === "no_data");
  if (allNoData) {
      const sendOnboarding = await shouldSendOnboarding(prisma, ctx.user.id);
      if (sendOnboarding) return { kind: "onboarding", areaOrId: "onboarding" };
      return null;
  }

  // Check Incomplete Logging State
  const hasLowConf = adjustedL1.some((f) => f.status === "low_confidence");
  if (hasLowConf) return { kind: "log_more", areaOrId: "log_more" };

  return { kind: "general", areaOrId: "general" };
}

// ────────────────────────────────────────────────────────────────────────────
// 2. KNOWLEDGE из полного whyFull (единственный источник фактов)
// ────────────────────────────────────────────────────────────────────────────
export const KNOWLEDGE_INSTRUCTION =
  "Опирайся ТОЛЬКО на KNOWLEDGE как на источник медицинских фактов. " +
  "Не добавляй новых утверждений, механизмов, эффектов, продуктов и чисел, которых нет в KNOWLEDGE " +
  "или в FINDINGS. Числа бери только из FINDINGS. Метафоры и тёплый тон — можно; новые факты — нет.";

/** Тянем полный курируемый текст, а не тонкий шаблон. */
export async function buildKnowledge(prisma: any, focus: any, lang = "ru") {
  if (focus.kind === "pattern") {
    const p = await prisma.patternContent.findFirst({
      where: { patternId: focus.pattern.id, lang },
    });
    return p ? { title: focus.pattern.id, whyShort: p.whyShort, whyFull: p.whyFull, actionIdea: p.actionIdea } : null;
  }
  if (focus.kind === "finding") {
    const cat = focus.finding.category;
    let kind = focus.finding.status === "excess" ? "excess" : "deficit";
    const t = await prisma.tipContent.findUnique({
      where: { area_kind_lang: { area: cat, kind, lang } },
    });
    // Fallback to general area if not found
    if (!t) {
       const g = await prisma.tipContent.findUnique({ where: { area_kind_lang: { area: "general", kind: "general", lang } } });
       return g ? { title: "general", whyShort: g.whyShort, whyFull: g.whyFull, actionIdea: g.actionIdea } : null;
    }
    return t ? { title: cat, whyShort: t.whyShort, whyFull: t.whyFull, actionIdea: t.actionIdea } : null;
  }
  if (focus.kind === "onboarding") {
    return {
      title: "onboarding",
      whyShort: lang === 'en' ? "Your body is always talking — we just need to listen. A few taps a day, and I'll show you what it's saying." : "Организм всегда говорит — просто его нужно слышать. Пара касаний в день, и я смогу показать, что он вам подсказывает.",
      whyFull: lang === 'en' ? "I'm still getting to know you—there isn't enough data yet, so it's too early for an analysis. This isn't about strict discipline or tracking tables; it's about paying a little attention to yourself. Start with one thing: log a glass of water or a single meal. This is how the dialogue with your body begins 🌿" : "Пока я вас только узнаю — данных ещё нет, и разбор делать рано. Это не про дисциплину и не про таблицы — это про маленькое внимание к себе. Начните с одного: отметьте стакан воды или один приём пищи. С этого и собирается диалог с организмом 🌿",
      actionIdea: lang === 'en' ? "Today, log just one thing—water or one meal. That's enough to get started." : "Сегодня занесите одно — воду или один приём пищи. Этого достаточно для старта.",
    };
  }
  if (focus.kind === "log_more") {
    return {
      title: "log_more",
      whyShort: lang === 'en' ? "To give you accurate insights, I need to see the full picture." : "Чтобы разбор был точным, важно видеть картину целиком.",
      whyFull: lang === 'en' ? "There isn't enough data today to draw conclusions about deficits. This isn't about strict tracking—it's about basing insights on real context rather than half a day." : "Пока данных за день немного, и по ним рано делать выводы о дефиците. Это не про строгий учёт — это про то, чтобы разбор опирался на реальную картину, а не на половину дня.",
      actionIdea: lang === 'en' ? "Try logging your meals completely today so tomorrow's analysis is spot on." : "Сегодня попробуйте занести приёмы пищи полнее — так завтрашний разбор будет точнее.",
    };
  }
  // general
  const g = await prisma.tipContent.findUnique({ where: { area_kind_lang: { area: "general", kind: "general", lang } } });
  return g ? { title: "general", whyShort: g.whyShort, whyFull: g.whyFull, actionIdea: g.actionIdea } : null;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Пост-валидатор grounding
// ────────────────────────────────────────────────────────────────────────────
export interface GroundingResult { ok: boolean; issues: string[] }

/** Все числа, которые модели РАЗРЕШЕНО упоминать: из findings и из knowledge. */
function collectAllowedNumbers(findings: any[], knowledge: any): Set<string> {
  const s = new Set<string>(["1", "2", "3"]); // тривиальные счётные («1 приём пищи»)
  const push = (txt: any) => String(txt ?? "").match(/\d+(?:[.,]\d+)?/g)?.forEach((n) => s.add(n.replace(",", ".")));
  findings?.forEach((f) => { push(f.value); push(f.target); push(f.message); });
  if (knowledge) { push(knowledge.whyShort); push(knowledge.whyFull); push(knowledge.actionIdea); }
  return s;
}

/**
 * Проверяем сгенерированный текст (teaser + expansion) против источников.
 * Возвращает список проблем — на любой из них лучше перегенерировать или отдать шаблон.
 */
export function validateGrounding(
  output: string,
  ctx: { findings: Finding[]; knowledge: any }
): GroundingResult {
  const issues: string[] = [];
  const lower = output.toLowerCase();

  // 3.1 Числа не из источника
  const allowed = collectAllowedNumbers(ctx.findings, ctx.knowledge);
  const nums = output.match(/\d+(?:[.,]\d+)?/g) ?? [];
  for (const n of nums) {
    if (!allowed.has(n.replace(",", "."))) issues.push(`число не из источника: ${n}`);
  }

  // 3.2 Эмодзи вне одобренного набора
  const emojis = output.match(/\p{Extended_Pictographic}/gu) ?? [];
  for (const e of emojis) {
    if (!ALLOWED_EMOJI.has(e)) issues.push(`эмодзи вне бренд-набора: ${e}`);
  }

  // 3.3 Запрещённые слова бренда
  for (const w of BRAND_FORBIDDEN) {
    if (lower.includes(w)) issues.push(`запрещённое слово: ${w}`);
  }

  // 3.4 Мед-красные-флаги (дозы, диагноз, «болезнь/здоров»)
  for (const re of MED_REDFLAGS) {
    if (re.test(output)) issues.push(`мед-red-flag: ${re}`);
  }

  // 3.5 Маркетинговые хуки/CTA
  for (const re of MARKETING_HOOKS) {
    if (re.test(output)) issues.push(`маркетинговый хук: ${re}`);
  }

  // 3.6 Признак бренда: слово «организм» желательно присутствует
  if (!/организм/i.test(output)) issues.push("нет слова-маркера «организм»");

  return { ok: issues.length === 0, issues };
}
