import fs from 'fs';
import path from 'path';
import prisma from '../prisma';
import { getGeminiModel } from '../gemini';
import { safetyGate, validateLLMOutput, verifyNumbers, extractAllNumbers } from './safety';

export interface OrchestratorInput {
  userId: string;
  mode: 'ask' | 'daily_review';
  userQuery?: string;
  lang?: 'ru' | 'en';
}

export interface OrchestratorOutput {
  message: string;
  usedCardIds: string[];
  isFallback: boolean;
  messageId?: string;
  isKnowledgeGap?: boolean;
}

const MISSING_CARD_RESPONSE_RU = 'В базе пока нет проверенных данных по этому вопросу. Записал его — специалист посмотрит 💛';
const MISSING_CARD_RESPONSE_EN = 'Our knowledge base does not currently have verified data on this question. I have saved it for our specialist to review 💛';

/**
 * Loads the Brand Voice system instruction from markdown.
 */
function loadBrandVoicePrompt(): string {
  try {
    const candidatePaths = [
      path.join(__dirname, 'prompts', 'brand_voice.md'),
      path.join(process.cwd(), 'src', 'lib', 'assistant', 'prompts', 'brand_voice.md'),
      path.join(process.cwd(), 'longevity-portal', 'src', 'lib', 'assistant', 'prompts', 'brand_voice.md')
    ];
    for (const promptPath of candidatePaths) {
      if (fs.existsSync(promptPath)) {
        return fs.readFileSync(promptPath, 'utf8');
      }
    }
  } catch (err) {
    console.warn('[ORCHESTRATOR] Could not load brand_voice.md, using built-in prompt:', err);
  }

  return `Вы — персональный ИИ-ассистент VIReYou. Обращение строго на «вы» или безлично. Без «ты». Формула ответа: Наблюдение -> Механизм одной фразой -> Одно маленькое действие. Утверждения только из переданных карточек.`;
}

/**
 * Deterministically collects user lifestyle metrics over the past 14 days,
 * calculating averages strictly over days with recorded data and reporting coverage.
 */
async function collectAnonymizedContext(userId: string, lang: 'ru' | 'en') {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      age: true,
      gender: true,
      height: true,
      weight: true,
      activity_level: true,
      goal: true,
      special_groups: true,
      health_consent_version: true
    }
  });

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 14);

  // Fetch logs
  const [nutrition, sleep, activity, hydration, tests] = await Promise.all([
    prisma.nutritionLog.findMany({
      where: { user_id: userId, created_at: { gte: fourteenDaysAgo } },
      select: { created_at: true, calories: true, protein: true, carbs: true, fat: true, fiber: true, plants: true }
    }),
    prisma.sleepLog.findMany({
      where: { user_id: userId, created_at: { gte: fourteenDaysAgo } },
      select: { created_at: true, duration_hrs: true, deep_hrs: true, hrv: true, resting_heart_rate: true }
    }),
    prisma.activityLog.findMany({
      where: { user_id: userId, created_at: { gte: fourteenDaysAgo } },
      select: { created_at: true, steps: true, active_minutes: true }
    }),
    prisma.hydrationLog.findMany({
      where: { user_id: userId, created_at: { gte: fourteenDaysAgo } },
      select: { created_at: true, volume_ml: true }
    }),
    prisma.$queryRawUnsafe<any[]>(`
      SELECT test_type, score, interpretation, created_at
      FROM test_results
      WHERE user_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT 5
    `, userId).catch(() => [])
  ]);

  const getDayKey = (d: Date | string | null | undefined) => {
    if (!d) return null;
    const date = new Date(d);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  };

  // Nutrition aggregation
  const nutritionDays = new Set<string>();
  let totalCalories = 0;
  let totalProtein = 0;
  let totalFiber = 0;
  const plants = new Set<string>();

  nutrition.forEach(n => {
    const day = getDayKey(n.created_at);
    if (day) nutritionDays.add(day);
    totalCalories += Number(n.calories || 0);
    totalProtein += Number(n.protein || 0);
    totalFiber += Number(n.fiber || 0);
    if (Array.isArray(n.plants)) {
      n.plants.forEach((p: string) => plants.add(p.toLowerCase().trim()));
    }
  });

  const nutritionLoggedDays = nutritionDays.size;
  const avgCalories = nutritionLoggedDays > 0 ? Math.round(totalCalories / nutritionLoggedDays) : null;
  const avgProtein = nutritionLoggedDays > 0 ? Math.round((totalProtein / nutritionLoggedDays) * 10) / 10 : null;
  const avgFiber = nutritionLoggedDays > 0 ? Math.round((totalFiber / nutritionLoggedDays) * 10) / 10 : null;

  // Sleep aggregation
  const sleepDays = new Set<string>();
  let totalSleepHrs = 0;
  let hrvSum = 0;
  let hrvCount = 0;

  sleep.forEach(s => {
    const day = getDayKey(s.created_at);
    if (day) sleepDays.add(day);
    totalSleepHrs += Number(s.duration_hrs || 0);
    if (s.hrv) {
      hrvSum += Number(s.hrv);
      hrvCount++;
    }
  });

  const sleepLoggedDays = sleepDays.size;
  const avgSleep = sleepLoggedDays > 0 ? Math.round((totalSleepHrs / sleepLoggedDays) * 10) / 10 : null;
  const avgHrv = hrvCount > 0 ? Math.round(hrvSum / hrvCount) : null;

  // Activity aggregation
  const activityDays = new Set<string>();
  let totalSteps = 0;

  activity.forEach(a => {
    const day = getDayKey(a.created_at);
    if (day) activityDays.add(day);
    totalSteps += Number(a.steps || 0);
  });

  const activityLoggedDays = activityDays.size;
  const avgSteps = activityLoggedDays > 0 ? Math.round(totalSteps / activityLoggedDays) : null;

  // Hydration aggregation
  const hydrationDays = new Set<string>();
  let totalWater = 0;

  hydration.forEach(h => {
    const day = getDayKey(h.created_at);
    if (day) hydrationDays.add(day);
    totalWater += Number(h.volume_ml || 0);
  });

  const hydrationLoggedDays = hydrationDays.size;
  const avgWater = hydrationLoggedDays > 0 ? Math.round(totalWater / hydrationLoggedDays) : null;

  const anonymizedProfile = {
    age: user?.age || null,
    gender: user?.gender || null,
    height: user?.height || null,
    weight: user?.weight || null,
    activity_level: user?.activity_level || null,
    goal: user?.goal || null,
    special_groups: user?.special_groups || []
  };

  const metricsSummary = {
    period_days: 14,
    nutrition: {
      logged_days: nutritionLoggedDays,
      coverage_pct: Math.round((nutritionLoggedDays / 14) * 100),
      avg_calories_per_logged_day: avgCalories,
      avg_protein_g_per_logged_day: avgProtein,
      avg_fiber_g_per_logged_day: avgFiber,
      unique_plants_count: plants.size
    },
    sleep: {
      logged_days: sleepLoggedDays,
      coverage_pct: Math.round((sleepLoggedDays / 14) * 100),
      avg_duration_hrs: avgSleep,
      avg_night_hrv_ms: avgHrv
    },
    activity: {
      logged_days: activityLoggedDays,
      coverage_pct: Math.round((activityLoggedDays / 14) * 100),
      avg_steps_per_logged_day: avgSteps
    },
    hydration: {
      logged_days: hydrationLoggedDays,
      avg_volume_ml_per_logged_day: avgWater
    },
    tests: tests.map(t => ({
      test_type: t.test_type,
      score: t.score ? Number(t.score) : null,
      interpretation: t.interpretation
    }))
  };

  return {
    anonymizedProfile,
    metricsSummary
  };
}

/**
 * Main Stage 1 Lifestyle Assistant Orchestrator.
 * Single deterministic Gemini 2.5 Flash call without Function Calling.
 */
export async function runAssistantOrchestrator(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const { userId, mode, userQuery = '', lang = 'ru' } = input;
  const isEn = lang === 'en';

  // 1. Pre-model Safety Filter
  if (userQuery) {
    const gateCheck = safetyGate({ userText: userQuery, user: { lang } });
    if (gateCheck.block) {
      const fallbackMsg = gateCheck.message || (isEn
        ? 'Please consult a medical professional or emergency services regarding these symptoms.'
        : 'При данных симптомах, пожалуйста, обратитесь за медицинской или экстренной помощью.');

      const saved = await prisma.assistantMessage.create({
        data: {
          user_id: userId,
          message: fallbackMsg,
          prompt_version: 'v1.0-stage1-safety-gate',
          used_card_ids: [],
          model: 'safety-filter'
        }
      });

      return {
        message: fallbackMsg,
        usedCardIds: [],
        isFallback: true,
        messageId: saved.id
      };
    }
  }

  // 2. Collect anonymized user context
  const context = await collectAnonymizedContext(userId, lang);

  // 3. Fetch all active approved knowledge cards for this language
  const cards = await prisma.knowledgeCard.findMany({
    where: {
      is_active: true,
      status: 'approved',
      lang: lang
    },
    select: {
      id: true,
      domain: true,
      layer: true,
      claim: true,
      contraindications: true,
      related_content: true
    }
  });

  const cardsContext = cards.map(c => 
    `[ID: ${c.id}] (Domain: ${c.domain}, Layer: ${c.layer})
Claim: ${c.claim}
Contraindications: ${c.contraindications || 'None'}
Related: ${c.related_content || 'None'}`
  ).join('\n\n');

  // 4. Assemble system prompt and user prompt
  const brandVoice = loadBrandVoicePrompt();

  const systemInstruction = `${brandVoice}

---
СТРОГИЕ ПРАВИЛА ИСПОЛЬЗОВАНИЯ БАЗЫ ЗНАНИЙ:
1. Вы имеете доступ ТОЛЬКО к приведённым ниже проверенным карточкам базы знаний.
2. Любые утверждения, советы и механизмы должны прямо опираться на эти карточки.
3. Если среди карточек НЕТ подходящей карточки, содержащей проверенный ответ на вопрос пользователя:
   - Вы ОБЯЗАНЫ вернуть ровно следующий ответ:
     "${isEn ? MISSING_CARD_RESPONSE_EN : MISSING_CARD_RESPONSE_RU}"
   - В самом конце отдельной строкой укажите:
     [NO_MATCHING_CARD]
4. Если карточки есть и они отвечают на вопрос:
   - Составьте ответ по формуле: Наблюдение -> Механизм одной фразой -> Одно маленькое действие.
   - В самом конце отдельной строкой укажите идентификаторы использованных карточек:
     [USED_CARDS: id1, id2]
5. Не начинайте ответ с пересказа вопроса (запрещены «Вы спрашиваете…», «Вы упомянули…», «Что касается вопроса…»). Первая фраза сразу по сути.
6. Если в использованной карточке упомянут калькулятор или тест портала (например, «Белковый щит» или тест водного баланса), обязательно назовите его и приведите точную ссылку из поля Related карточки (например, «Белковый щит: https://vireyou.com/ru/diagnostics/protein»).
7. Если у использованной карточки есть противопоказания (Contraindications), обязательно упомяните главное ограничение одной короткой нейтральной строкой (например, «при болезни почек норму белка определяет врач»).
8. Если вопрос задан про определенный возраст или группу, а карточка относится к другой (например, вопрос про 60 лет, а данные карточки для 65+), прямо укажите, для кого приведены эти данные (например: «Для людей старше 65 лет эксперты рекомендуют...»).

---
ДОСТУПНЫЕ КАРТОЧКИ БАЗЫ ЗНАНИЙ:
${cardsContext.length > 0 ? cardsContext : '(В базе знаний пока нет активных карточек)'}`;

  const userPrompt = `
ОБЕЗЛИЧЕННЫЙ ПРОФИЛЬ ЧЕЛОВЕКА:
${JSON.stringify(context.anonymizedProfile, null, 2)}

ДАННЫЕ И МЕТРИКИ (ЗА 14 ДНЕЙ, СРЕДНИЕ ТОЛЬКО ПО ДНЯМ С ЗАПИСЯМИ):
${JSON.stringify(context.metricsSummary, null, 2)}

${mode === 'ask' ? `ВОПРОС ЧЕЛОВЕКА: "${userQuery}"` : `ЗАДАЧА: Сформируйте вечерний разбор дня с учётом показателей и покрытия записей.`}
`;

  // 5. Single LLM call (Gemini 2.5 Flash, low temperature for strict adherence)
  try {
    const model = getGeminiModel('gemini-2.5-flash', 0.2, false, systemInstruction);
    const result = await model.generateContent(userPrompt);
    const rawResponse = result.response.text().trim();

    // 6. Parse used cards metadata
    const noCardMatch = /\[NO_MATCHING_CARD\]/i.test(rawResponse);
    const usedCardsMatch = rawResponse.match(/\[USED_CARDS:\s*([^\]]+)\]/i);

    let usedCardIds: string[] = [];
    if (usedCardsMatch && usedCardsMatch[1]) {
      usedCardIds = usedCardsMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    }

    // Clean bracket tags and any leading question restatement from user-facing message
    let cleanMessage = rawResponse
      .replace(/\[NO_MATCHING_CARD\]/gi, '')
      .replace(/\[USED_CARDS:[^\]]+\]/gi, '')
      .trim();

    cleanMessage = cleanMessage
      .replace(/^(?:Вы спрашиваете[^\n.!?]*[?.!]\s*|Вы упомянули[^\n.!?]*[?.!]\s*|Что касается вашего вопроса[^\n.!?]*[?.!]\s*|Отвечая на ваш вопрос[^\n.!?]*[?.!]\s*)/iu, '')
      .trim();

    // Check if it's a knowledge gap
    const isMissing = noCardMatch || 
                      cleanMessage.includes('В базе пока нет проверенных данных') || 
                      cleanMessage.includes('does not currently have verified data') ||
                      usedCardIds.length === 0 && mode === 'ask';

    if (isMissing) {
      cleanMessage = isEn ? MISSING_CARD_RESPONSE_EN : MISSING_CARD_RESPONSE_RU;
      
      // Record gap to database for Valya
      if (mode === 'ask' && userQuery) {
        await prisma.knowledgeGap.create({
          data: {
            user_id: userId,
            question: userQuery,
            lang: lang,
            status: 'new'
          }
        }).catch(err => console.error('[ORCHESTRATOR] Error logging knowledge gap:', err));
      }

      const saved = await prisma.assistantMessage.create({
        data: {
          user_id: userId,
          message: cleanMessage,
          prompt_version: 'v1.0-stage1',
          used_card_ids: [],
          model: 'gemini-2.5-flash'
        }
      });

      return {
        message: cleanMessage,
        usedCardIds: [],
        isFallback: false,
        isKnowledgeGap: true,
        messageId: saved.id
      };
    }

    // 7. Post-model Safety Validation & Number Verification
    const safetyCheck = validateLLMOutput(cleanMessage);
    const numbersContract = {
      ...context.metricsSummary,
      ...context.anonymizedProfile,
      relevantCards: cards
        .filter(c => usedCardIds.includes(c.id) || usedCardIds.length === 0)
        .map(c => ({
          claim: c.claim,
          contraindications: c.contraindications
        }))
    };
    const numbersCheck = verifyNumbers(cleanMessage, numbersContract);

    if (!safetyCheck.isSafe || !numbersCheck.valid) {
      console.warn('[ORCHESTRATOR] Safety/Numbers check failed:', {
        violations: safetyCheck.violations,
        invalidNumbers: numbersCheck.invalidNumbers
      });

      const fallbackMsg = mode === 'ask'
        ? (isEn
            ? 'I cannot provide this recommendation with sufficient confidence based on verified data 💛'
            : 'Не могу дать точный ответ на основе проверенных данных базы 💛')
        : (isEn
            ? 'Data saved for today. Let us look at your trends together tomorrow 💛'
            : 'Сегодня без подробного разбора: данные дня сохранены, завтра посмотрим на них вместе 💛');

      const saved = await prisma.assistantMessage.create({
        data: {
          user_id: userId,
          message: fallbackMsg,
          prompt_version: 'v1.0-stage1-fallback',
          used_card_ids: usedCardIds,
          model: 'gemini-2.5-flash'
        }
      });

      return {
        message: fallbackMsg,
        usedCardIds,
        isFallback: true,
        messageId: saved.id
      };
    }

    // 8. Save and return successful response
    const saved = await prisma.assistantMessage.create({
      data: {
        user_id: userId,
        message: cleanMessage,
        prompt_version: 'v1.0-stage1',
        used_card_ids: usedCardIds,
        model: 'gemini-2.5-flash'
      }
    });

    return {
      message: cleanMessage,
      usedCardIds,
      isFallback: false,
      messageId: saved.id
    };

  } catch (error) {
    console.error('[ORCHESTRATOR] Error generating response:', error);

    const fallbackMsg = isEn
      ? 'Data saved for today. Let us look at your trends together tomorrow 💛'
      : 'Сегодня без подробного разбора: данные дня сохранены, завтра посмотрим на них вместе 💛';

    const saved = await prisma.assistantMessage.create({
      data: {
        user_id: userId,
        message: fallbackMsg,
        prompt_version: 'v1.0-stage1-error-fallback',
        used_card_ids: [],
        model: 'gemini-2.5-flash'
      }
    });

    return {
      message: fallbackMsg,
      usedCardIds: [],
      isFallback: true,
      messageId: saved.id
    };
  }
}
