import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import fs from "fs";
import path from "path";
import cron from "node-cron";
import jwt from "jsonwebtoken";
import crypto from "crypto";

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'connection_limit=2&pool_timeout=40';
}

process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err);
});

import prisma from "../src/lib/prisma";
import { analyzeFoodWithAI, getIngredientNutrientsWithAI, calculateTotalNutrients, analyzeScreenshotWithAI, transcribeVoiceWithAI, analyzeTextWithAI, analyzeDailyNutritionWithAI, analyzeProductLabelWithAI, getProactiveNutritionAdvice, determineTimezoneFromCity, generateSupportResponse } from "../src/lib/telegram/ai-services";
import { generatePeriodicReport } from "../src/lib/reportGenerator";
import { aggregateUserContext } from "../src/lib/assistant/context";
import { evaluateLifestyle } from "../src/lib/assistant/rules";
import { safetyGate, postValidate } from "../src/lib/assistant/safety";
import { generateDailyReview, generateNutrientReview } from "../src/lib/assistant/generate";
import { calculateAllUserBaselines } from "../src/lib/assistant/baselines";
import { generateDailyAction } from "../src/lib/assistant/daily_action";

const ruMessages = JSON.parse(fs.readFileSync(path.join(__dirname, '../messages/ru.json'), 'utf8'));
const enMessages = JSON.parse(fs.readFileSync(path.join(__dirname, '../messages/en.json'), 'utf8'));

export function t(locale: string, pathStr: string, params: Record<string, any> = {}): string {
  const msgs: any = locale === 'en' ? enMessages?.Bot : ruMessages?.Bot;
  if (!msgs) return pathStr;
  const keys = pathStr.split('.');
  let result = msgs;
  for(const k of keys) {
    if(!result) return pathStr;
    result = result[k];
  }
  if (typeof result !== 'string') return pathStr;
  let finalStr = result;
  for (const [k, v] of Object.entries(params)) {
    finalStr = finalStr.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return finalStr;
}

/**
 * Переводит технический ключ привычки для отображения пользователю.
 */
function formatHabitName(key: string, lang: string): string {
    const mapping: Record<string, Record<string, string>> = {
        'Alcohol': { ru: '🍷 Алкоголь', en: '🍷 Alcohol' },
        'Smoking': { ru: '🚬 Курение', en: '🚬 Smoking' },
        'Sugar': { ru: '🍰 Сахар/Сладости', en: '🍰 Sugar/Sweets' },
        'Алкоголь': { ru: '🍷 Алкоголь', en: '🍷 Alcohol' },
        'Курение': { ru: '🚬 Курение', en: '🚬 Smoking' },
        'Сахар': { ru: '🍰 Сахар/Сладости', en: '🍰 Sugar/Sweets' }
    };
    return mapping[key]?.[lang] || key;
}

// Global Error Handlers for Stability
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception thrown:', err);
});



const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  console.error("TELEGRAM_BOT_TOKEN is not set in .env");
  process.exit(1);
}

const BOT_VERSION = "1.2.3"; // Consistent date parsing relative to user local time
console.log(`[START] MemoBot ${BOT_VERSION} starting...`);
const bot = new Telegraf(botToken);

function markdownToHtml(md: string): string {
    if (!md) return "";
    return md
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\*\*(?!\s)([^\n*]+?)(?<!\s)\*\*/g, "<b>$1</b>")
        .replace(/\*(?!\s)([^\n*]+?)(?<!\s)\*/g, "<b>$1</b>")
        .replace(/__(?!\s)([^\n_]+?)(?<!\s)__/g, "<u>$1</u>")
        .replace(/_(?!\s)([^\n_]+?)(?<!\s)_/g, "<i>$1</i>")
        .replace(/`(?!\s)([^\n`]+?)(?<!\s)`/g, "<code>$1</code>");
}

const originalSendMessage = bot.telegram.sendMessage.bind(bot.telegram);
bot.telegram.sendMessage = async (chatId: any, text: any, extra: any) => {
    if (extra && extra.parse_mode === 'Markdown') {
        text = markdownToHtml(text);
        extra.parse_mode = 'HTML';
    }
    return originalSendMessage(chatId, text, extra);
};

const originalEditMessageText = bot.telegram.editMessageText.bind(bot.telegram);
bot.telegram.editMessageText = async (chatId: any, messageId: any, inlineMessageId: any, text: any, extra: any) => {
    if (extra && extra.parse_mode === 'Markdown') {
        text = markdownToHtml(text);
        extra.parse_mode = 'HTML';
    }
    return originalEditMessageText(chatId, messageId, inlineMessageId, text, extra);
};



/**
 * Скачивает файл по его TG file_id.
 */
async function downloadTelegramFile(fileId: string, destPath: string) {
  console.log(`[DOWNLOAD] Getting file link for ${fileId}`);
  const fileLink = await bot.telegram.getFileLink(fileId);
  console.log(`[DOWNLOAD] URL: ${fileLink.href}`);

  const response = await axios({
    url: fileLink.href,
    method: 'GET',
    responseType: 'stream',
  });

  return new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(destPath);
    console.log(`[DOWNLOAD] Starting pipe to ${destPath}`);
    response.data.pipe(writer);
    
    response.data.on('error', (err: any) => {
      console.error(`[DOWNLOAD] Read stream error:`, err);
      reject(err);
    });

    writer.on('finish', () => {
      console.log(`[DOWNLOAD] Finish writing file ${destPath}`);
      resolve();
    });
    
    writer.on('error', (err: any) => {
      console.error(`[DOWNLOAD] Write stream error:`, err);
      reject(err);
    });
  });
}

/**
 * Вспомогательный хелпер для конвертации файла в base64.
 */
async function fileToBase64(filePath: string): Promise<string> {
  const buffer = await fs.promises.readFile(filePath);
  return buffer.toString("base64");
}

// Временное хранилище для подтверждения (Питание, Сон, Активность)
const tempLog: Record<string, any> = {};
const userStates: Record<string, string> = {};

const ONBOARDING_STATES = {
    NAME: 'ONBOARDING_NAME',
    GENDER: 'ONBOARDING_GENDER',
    AGE: 'ONBOARDING_AGE',
    WEIGHT: 'ONBOARDING_WEIGHT',
    HEIGHT: 'ONBOARDING_HEIGHT',
    ACTIVITY: 'ONBOARDING_ACTIVITY',
    GOAL: 'ONBOARDING_GOAL',
    CITY: 'ONBOARDING_CITY'
};

// ----------------------------------------------------
// Middleware: Проверка авторизации
// ----------------------------------------------------
bot.use(async (ctx: any, next) => {
  const tgId = ctx.from?.id.toString();
  
  // Default language 
  ctx.state.lang = 'ru';

  if (tgId) {
    const user = await prisma.user.findFirst({
      where: { telegram_id: tgId },
    });
    if (user) {
      ctx.state.user = user;
      ctx.state.lang = (user as any).language || 'ru';
      
      // Update username if changed
      if (ctx.from?.username && (user as any).telegram_username !== ctx.from.username) {
        await prisma.user.update({
          where: { id: user.id },
          data: { telegram_username: ctx.from.username }
        });
      }
    }
  }

  // Handle explicit language selection if it comes early
  if (ctx.callbackQuery && ctx.callbackQuery.data.startsWith('set_lang_')) {
    return next();
  }

  if (ctx.message && ctx.message.text && ctx.message.text.startsWith('/start')) {
    return next(); // Разрешаем /start
  }

  if (!ctx.state.user) {
    return ctx.reply(t(ctx.state.lang, 'Auth.notLinked'));
  }

  return next();
});

// ----------------------------------------------------
// Перехват форвардов для настройки канала марафона
// ----------------------------------------------------
bot.on('message', async (ctx: any, next) => {
    const user = ctx.state.user;
    if (user && userStates[user.id] === 'WAITING_FOR_CHANNEL_FORWARD') {
        if (ctx.message.forward_from_chat && ctx.message.forward_from_chat.type === 'channel') {
            const channelId = ctx.message.forward_from_chat.id.toString();
            const lang = ctx.state.lang || 'ru';
            await prisma.systemSetting.upsert({
                where: { key: 'marathon_channel_id' },
                update: { value: channelId },
                create: { key: 'marathon_channel_id', value: channelId }
            });
            userStates[user.id] = '';
            return ctx.reply(t(lang, 'Marathon.channelLinked', { id: channelId }), { parse_mode: 'Markdown' });
        }
    }

    // Обработка ответа админа на сообщение пользователя
    if (user && user.role === 'admin' && ctx.message.reply_to_message && ctx.message.reply_to_message.from?.id === bot.botInfo?.id) {
        const repliedText = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption || "";
        const match = repliedText.match(/ID:\s*(\d+)/);
        if (match) {
            const targetTelegramId = match[1];
            try {
                if (ctx.message.text) {
                    await bot.telegram.sendMessage(targetTelegramId, `👨‍💻 <b>Ответ оператора:</b>\n\n${ctx.message.text}`, { parse_mode: 'HTML' });
                } else if (ctx.message.photo || ctx.message.video || ctx.message.document) {
                    await bot.telegram.sendMessage(targetTelegramId, `👨‍💻 <b>Ответ оператора:</b>`, { parse_mode: 'HTML' });
                    await bot.telegram.copyMessage(targetTelegramId, ctx.chat.id, ctx.message.message_id);
                }
                return ctx.reply('✅ Ответ отправлен пользователю.');
            } catch (e: any) {
                console.error("Failed to send admin reply", e);
                return ctx.reply('❌ Ошибка при отправке ответа пользователю.');
            }
        }
    }

    return next();
});

// ----------------------------------------------------
// Команды
// ----------------------------------------------------

// --- AI Assistant ---
async function showLifestyleAnalysis(ctx: any) {
  const user = ctx.state.user;
  if (!user) return;
  
  const hasAccess = await checkSubscriptionLevel(ctx, user, 'pro');
  if (!hasAccess) return;

  await ctx.sendChatAction("typing");

  try {
    const context = await aggregateUserContext(user.id, 7);
    const lang = user.language || 'ru';
    const gate = safetyGate(context, lang);
    if (gate.block) {
      return ctx.reply(gate.message || (lang === 'en' ? "Safety error." : "Ошибка безопасности."));
    }

    const safeText = await generateNutrientReview(user.id, false);

    // Временно логируем в консоль вместо БД (так как таблица AssistantMessage еще не создана)
    console.log(`[ASSISTANT LOG] User: ${user.id}, Findings:`, findings);

    const btnUp = lang === 'en' ? "👍 Helpful" : "👍 Полезно";
    const btnDown = lang === 'en' ? "👎 Inaccurate" : "👎 Не точно";

    const htmlText = markdownToHtml(safeText);

    await ctx.reply(htmlText, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback(btnUp, "advice_up"), Markup.button.callback(btnDown, "advice_down")]
      ])
    });

    await prisma.assistantMessage.create({
      data: {
        user_id: user.id,
        message: safeText
      }
    });

    return;
  } catch (e: any) {
    console.error("Lifestyle analysis error:", e);
    return ctx.reply(user.language === 'en' ? "An error occurred while analyzing data. Please try again later." : "Произошла ошибка при анализе данных. Попробуй позже.");
  }
}

bot.command("analyze", async (ctx: any) => showLifestyleAnalysis(ctx));
bot.action("lifestyle_analyze", async (ctx: any) => {
  await ctx.answerCbQuery().catch(() => {});
  return showLifestyleAnalysis(ctx);
});

bot.action("advice_up", async (ctx: any) => {
  const lang = ctx.state.user?.lang || 'ru';
  
  if (ctx.from?.id) {
    const telegramId = String(ctx.from.id);
    const user = await prisma.user.findFirst({ where: { telegram_id: telegramId } });
    if (user) {
      const lastMessage = await prisma.assistantMessage.findFirst({
        where: { user_id: user.id },
        orderBy: { created_at: 'desc' }
      });
      if (lastMessage) {
        await prisma.assistantMessage.update({
          where: { id: lastMessage.id },
          data: { feedback: "up" }
        });
      }
    }
  }

  await ctx.answerCbQuery(lang === 'en' ? "Thanks for your feedback! 👍" : "Спасибо за отзыв! 👍").catch(() => {});
});

bot.action("advice_down", async (ctx: any) => {
  const lang = ctx.state.user?.lang || 'ru';

  if (ctx.from?.id) {
    const telegramId = String(ctx.from.id);
    const user = await prisma.user.findFirst({ where: { telegram_id: telegramId } });
    if (user) {
      const lastMessage = await prisma.assistantMessage.findFirst({
        where: { user_id: user.id },
        orderBy: { created_at: 'desc' }
      });
      if (lastMessage) {
        await prisma.assistantMessage.update({
          where: { id: lastMessage.id },
          data: { feedback: "down" }
        });
      }
    }
  }

  await ctx.answerCbQuery(lang === 'en' ? "Thanks for your feedback! We will take it into account. 👎" : "Спасибо за отзыв! Учтем. 👎").catch(() => {});
});

// --- Health Export Shortcut ---
async function handleAppleHealthLink(ctx: any) {
    try {
        const telegramId = String(ctx.from.id);
        let user = await prisma.user.findFirst({ where: { telegram_id: telegramId } });
        
        const lang = ctx.state?.lang || user?.language || 'ru';

        if (!user) {
            return ctx.reply(lang === 'en' ? 'Please register first using /start command.' : 'Сначала зарегистрируйтесь командой /start.');
        }

        // Create a 16-character hex token
        let token = user.health_export_token;
        if (!token) {
            token = crypto.randomBytes(8).toString('hex').toUpperCase();
            await prisma.user.update({
                where: { id: user.id },
                data: { health_export_token: token }
            });
        }

        // TODO: Replace with the actual English shortcut link when provided by the user
        const shortcutLinkRu = 'https://www.icloud.com/shortcuts/05a4fc92c6c04c83bb89c4be22045e44';
        const shortcutLinkEn = 'https://www.icloud.com/shortcuts/8df0593c18b14952926fd15bc3271777'; // TODO: Update when EN link is ready

        const msgRu = `🍏 **Интеграция с Apple Health**\n\n` +
                      `Ваш уникальный токен для безопасной передачи данных отправлен следующим сообщением (нажмите на него, чтобы скопировать).\n\n` +
                      `**Инструкция:**\n` +
                      `1. Скачайте Быструю команду (Shortcut) по ссылке: ${shortcutLinkRu}\n` +
                      `2. При установке вставьте ваш уникальный токен.\n` +
                      `3. Готово! Команда будет собирать ВСР, пульс во время сна и шаги и отправлять их в наш сервис.`;
                      
        const msgEn = `🍏 **Apple Health Integration**\n\n` +
                      `Your unique token for secure data transfer is sent in the next message (tap it to copy).\n\n` +
                      `**Instructions:**\n` +
                      `1. Download the Shortcut from this link: ${shortcutLinkEn}\n` +
                      `2. Paste your unique token during installation.\n` +
                      `3. All set! The shortcut will automatically collect HRV, sleeping heart rate, and steps, sending them to our service.`;

        const msg = lang === 'en' ? msgEn : msgRu;

        await ctx.reply(msg, { parse_mode: 'Markdown', disable_web_page_preview: true });
        await ctx.reply(`\`${token}\``, { parse_mode: 'Markdown' });
    } catch (e: any) {
        console.error("Health link error", e);
        const lang = ctx.state?.lang || 'ru';
        ctx.reply(lang === 'en' ? 'An error occurred while generating the token.' : 'Произошла ошибка при генерации токена.');
    }
}

bot.command('link', async (ctx: any) => {
    await handleAppleHealthLink(ctx);
});

bot.action('cmd_link', async (ctx: any) => {
    await ctx.answerCbQuery();
    await handleAppleHealthLink(ctx);
});

// --- Admin Stats ---
bot.command('stats', async (ctx: any) => {
    const user = ctx.state.user;
    if (!user || user.role !== 'admin') return;

    try {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const totalUsers = await prisma.user.count();
        const newUsers = await prisma.user.count({ where: { created_at: { gte: yesterday } } });
        
        const totalPro = await prisma.user.count({ where: { role: { in: ['PRO', 'admin', 'employee'] } } });
        const newPro = await prisma.user.count({ 
            where: { 
                role: { in: ['PRO', 'admin', 'employee'] },
                created_at: { gte: yesterday } 
            } 
        });

        const activeTrials = await prisma.user.count({
            where: {
                role: 'client',
                subscription_expires_at: { gt: now }
            }
        });

        const msg = `📊 **Статистика платформы:**\n\n👥 **Пользователи:**\n- Всего регистраций: **${totalUsers}**\n- Новых за 24ч: **+${newUsers}**\n\n💎 **Подписки:**\n- Активных PRO: **${totalPro}**\n- Новых PRO за 24ч: **+${newPro}**\n- Активных триалов: **${activeTrials}**`;

        ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (e: any) {
        console.error("Stats error", e);
        ctx.reply("Ошибка при сборе статистики.");
    }
});

bot.command('start', async (ctx: any) => {
  const args = ctx.message.text.split(' ');
  const payload = args[1];

  // 1. Сначала проверяем специальные команды ссылки
  if (payload === 'marathon') {
      const user = ctx.state.user;
      const lang = ctx.state.lang || 'ru';
      if (!user) {
          return ctx.reply(t(lang, 'Marathon.startInviteNeedLink'));
      }
      return await handleMarathonJoinLogic(ctx, user, lang);
  }

  let refId = null;
  let squadId = null;

  if (payload?.startsWith('ref_')) {
      refId = payload.replace('ref_', '');
  } else if (payload?.startsWith('sq_')) {
      squadId = payload.replace('sq_', '');
      // If joining a squad, the squad creator is the referrer
      const squad = await prisma.squad.findUnique({ where: { id: squadId } });
      if (squad) refId = squad.creator_id;
  }

  // Referral and User Handling Logic
  const handleUserReferral = async (currentUser: any, rId: string | null) => {
      if (!rId || rId === currentUser?.id) return currentUser;

      // If user doesn't have a referrer, try to set one
      if (currentUser && !currentUser.referrer_id) {
          const referrer = await prisma.user.findUnique({ where: { id: rId } });
          if (referrer && referrer.id !== currentUser.id) {
              console.log(`[AUTH] Updating referrer for existing user ${currentUser.id} -> ${referrer.id}`);
              return await prisma.user.update({
                  where: { id: currentUser.id },
                  data: { referrer_id: referrer.id }
              });
          }
      }
      return currentUser;
  };

  // Automatic user creation or update for seamless Telegram onboarding
  if (refId || squadId) {
      const tgId = ctx.from.id.toString();
      const autoEmail = `tg_${tgId}@vireyou.com`;
      
      let userRecord = await prisma.user.findFirst({ 
          where: { 
              OR: [
                  { telegram_id: tgId },
                  { email: autoEmail }
              ]
          } 
      });
      
      if (!userRecord) {
          userRecord = await prisma.user.create({ data: { id: crypto.randomUUID(),
                  email: autoEmail,
                  telegram_id: tgId,
                  role: 'client',
                  full_name: ctx.from.first_name || 'Спортсмен',
                  language: detectTimezoneFromLang(ctx.from.language_code) === 'Europe/Moscow' ? 'ru' : 'en',
                  timezone: detectTimezoneFromLang(ctx.from.language_code),
                  referrer_id: (refId && refId !== tgId) ? refId : null,
                  subscription_expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days free trial
              }
          });
      } else {
          // Check if we can update the referrer for an existing user
          userRecord = await handleUserReferral(userRecord, refId);
      }
      
      ctx.state.user = userRecord;
      ctx.state.lang = userRecord.language || 'ru';
  }

  // 2. Иначе интерпретируем payload как email (для связки аккаунтов)
  let email = null;
  let linkUserId = null;
  
  if (payload && payload.startsWith('link_')) {
      linkUserId = payload.replace('link_', '');
  } else if (payload && !refId && !squadId && payload !== 'marathon') {
      email = payload;
      try {
          const decoded = Buffer.from(payload, 'base64').toString('utf8');
          if (decoded.includes('@')) {
              email = decoded;
          }
      } catch (e: any) {
          console.log("Not base64 or failed decoding, using raw:", payload);
      }
  }

  // Helper to join squad if ID exists
  const joinSquadIfNeeded = async (user: any) => {
      if (squadId) {
          try {
              const { joinSquad } = await import('../src/lib/squads/squadService');
              const joined = await joinSquad(squadId, user.id);
              if (joined) {
                  await ctx.reply(ctx.state.lang === 'en' ? "✅ You successfully joined the Squad!" : "✅ Вы успешно присоединились к марафону (Скваду)!");
              } else {
                  await ctx.reply(ctx.state.lang === 'en' ? "ℹ️ You are already in this Squad." : "ℹ️ Вы уже участвуете в этом марафоне.");
              }
          } catch (e: any) {
              console.error(e);
          }
      }
  };

  if (!email) {
    // Проверяем авторизацию еще раз (для запуска без аргументов или после авторегистрации)
    const user = ctx.state.user;
    if (user) {
         await joinSquadIfNeeded(user);
         if (!user.language) {
             return sendLanguagePrompt(ctx);
         }
         
         // Trigger onboarding for new users or if physical params are missing
         if (!user.weight || !user.height) {
             return startOnboarding(ctx);
         }

         return sendWelcomeMenu(ctx, user);
    }
    
    // Unlinked user - offer WebApp for login/registration
    const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vireyou.com';
    return ctx.reply(
        "👋 Привет! Я твой ассистент по долголетию.\n\nДля работы со мной нужно привязать аккаунт.\nОткрой платформу прямо здесь в Telegram, чтобы автоматически зарегистрироваться и привязать профиль, либо введи команду вида:\n`/start твой_email@example.com`",
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Открыть платформу / Войти", web_app: { url: `${NEXT_PUBLIC_SITE_URL}/ru/login?from=telegram` } }]
                ]
            }
        }
    );
  }

  // Handle deep link from web platform
  if (linkUserId) {
    try {
        const user = await prisma.user.findUnique({ where: { id: linkUserId } });
        if (!user) {
            return ctx.reply("❌ Аккаунт не найден. Попробуйте еще раз с сайта.");
        }
        
        await prisma.user.update({
            where: { id: user.id },
            data: { telegram_id: ctx.from.id.toString(), telegram_username: ctx.from.username || null }
        });
        
        ctx.state.user = user;
        ctx.state.lang = user.language || 'ru';
        await ctx.reply("✅ Telegram успешно привязан! Добро пожаловать.");
        return sendWelcomeMenu(ctx, user);
    } catch (e: any) {
        console.error("Deep link error:", e);
        return ctx.reply("❌ Произошла ошибка при привязке. Пожалуйста, обратитесь в поддержку.");
    }
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return ctx.reply(t(ctx.state.lang, 'Auth.userNotFound'));
    }

    // Auto-detect timezone from Telegram language_code if not already set
    const autoTz = detectTimezoneFromLang(ctx.from.language_code);
    const updateData: any = { telegram_id: ctx.from.id.toString() };
    if (!(user as any).timezone || (user as any).timezone === 'Europe/Moscow') {
        updateData.timezone = autoTz;
    }

    const updatedUser = await prisma.user.update({
      where: { email },
      data: updateData,
    });

    ctx.state.user = updatedUser;
    ctx.state.lang = (updatedUser as any).language || 'ru';

    ctx.reply(t(ctx.state.lang, 'Auth.linkSuccess'));
    
    await joinSquadIfNeeded(updatedUser);

    if (!(updatedUser as any).language) {
      return sendLanguagePrompt(ctx);
    }
    sendWelcomeMenu(ctx, updatedUser);
  } catch (error) {
    console.error("Start command error:", error);
    ctx.reply(t(ctx.state.lang, 'Auth.linkError'));
  }
});

bot.command('profile', async (ctx: any) => {
    if (ctx.state.user) {
        await startOnboarding(ctx);
    } else {
        const lang = ctx.state.lang || 'ru';
        await ctx.reply(t(lang, 'Auth.notLinked'));
    }
});

// --- Marathon Commands ---

async function handleMarathonJoinLogic(ctx: any, user: any, lang: string) {
    if (user.is_marathon_participant) {
        return ctx.reply(t(lang, 'Marathon.alreadyJoined'));
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const count = await tx.user.count({ where: { is_marathon_participant: true } });
            
            let limit = 10; 
            const limitSetting = await tx.systemSetting.findUnique({ where: { key: 'marathon_limit' } });
            if (limitSetting) limit = parseInt(limitSetting.value);

            if (count >= limit) return { success: false, reason: 'full', limit };

            const updated = await tx.user.update({
                where: { id: user.id },
                data: { is_marathon_participant: true }
            });

            return { success: true, newCount: count + 1, limit };
        });

        if (!result.success) {
            return ctx.reply(t(lang, 'Marathon.joinLimitReached'));
        }

        ctx.reply(t(lang, 'Marathon.joinSuccess'));

        // If limit reached, update the channel post
        if (result.newCount && result.limit && result.newCount >= result.limit) {
            const channelIdSetting = await prisma.systemSetting.findUnique({ where: { key: 'marathon_channel_id' } });
            const msgIdSetting = await prisma.systemSetting.findUnique({ where: { key: 'marathon_broadcast_msg_id' } });
            
            if (channelIdSetting && msgIdSetting) {
                try {
                    await bot.telegram.editMessageText(
                        channelIdSetting.value,
                        parseInt(msgIdSetting.value),
                        undefined,
                        t(lang, 'Marathon.broadcastFullText', { limit: result.limit }),
                        { parse_mode: 'Markdown' }
                    );
                } catch (e: any) {
                    console.error("Failed to edit channel message:", e);
                }
            }
        }
    } catch (e: any) {
        console.error("Marathon join error:", e);
        ctx.reply(t(lang, 'Confirmation.error'));
    }
}

bot.command('marathon_join', async (ctx: any) => {
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    if (!user) return ctx.reply(t(lang, 'Auth.notLinked'));
    await handleMarathonJoinLogic(ctx, user, lang);
});

bot.command('marathon_leave', async (ctx: any) => {
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    if (!user) return;

    await prisma.user.update({
        where: { id: user.id },
        data: { is_marathon_participant: false }
    });
    ctx.reply(t(lang, 'Marathon.leaveSuccess'));
});

bot.command('marathon_setup', async (ctx: any) => {
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    if (!user || user.role !== 'admin') return;

    userStates[user.id] = 'WAITING_FOR_CHANNEL_FORWARD';
    ctx.reply(t(lang, 'Marathon.setupIntro'), { parse_mode: 'Markdown' });
});

bot.command('marathon_set_channel', async (ctx: any) => {
    const user = ctx.state.user;
    if (!user || user.role !== 'admin') return;
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply("Использование: /marathon_set_channel <ID>");
    
    const channelId = args[1];
    await prisma.systemSetting.upsert({
        where: { key: 'marathon_channel_id' },
        update: { value: channelId },
        create: { key: 'marathon_channel_id', value: channelId }
    });
    ctx.reply(`✅ Канал марафона установлен вручную: \`${channelId}\``, { parse_mode: 'Markdown' });
});

bot.command('marathon_id', async (ctx: any) => {
    ctx.reply(`ID этого чата: \`${ctx.chat.id}\``, { parse_mode: 'Markdown' });
});

bot.command('marathon_status', async (ctx: any) => {
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    if (!user) return;

    try {
        const count = await prisma.user.count({ where: { is_marathon_participant: true } });
        const limitSetting = await prisma.systemSetting.findUnique({ where: { key: 'marathon_limit' } });
        const channelSetting = await prisma.systemSetting.findUnique({ where: { key: 'marathon_channel_id' } });
        
        const limit = limitSetting ? limitSetting.value : '2';
        const channelId = channelSetting ? channelSetting.value : 'не настроен';

        ctx.reply(t(lang, 'Marathon.stats', { count, limit, channelId }), { parse_mode: 'Markdown' });
    } catch (e: any) {
        ctx.reply("Ошибка получения статистики.");
    }
});

bot.command('marathon_test', async (ctx: any) => {
    const lang = ctx.state.lang || 'ru';
    // const report = await generateMarathonDailyReport(undefined, undefined, lang);
    // if (!report) return ctx.reply("Нет данных для отчета или участников.");
    // ctx.reply(report, { parse_mode: 'Markdown' });
});

bot.command('marathon_invite', async (ctx: any) => {
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    if (!user || user.role !== 'admin') return;

    try {
        const usersToInvite = await prisma.user.findMany({
            where: {
                is_marathon_participant: false,
                telegram_id: { not: null }
            },
            take: 20
        });

        if (usersToInvite.length === 0) {
            return ctx.reply("Все пользователи уже участвуют в марафоне или не привязали Telegram.");
        }

        const buttons = usersToInvite.map(u => {
            const displayName = u.full_name && u.full_name !== 'клиент' 
                ? `${u.full_name} (${u.email})` 
                : u.email;
            return [
                Markup.button.callback(t(lang, 'Marathon.adminInviteBtn', { name: displayName }), `invite_user:${u.id}`)
            ];
        });

        ctx.reply(t(lang, 'Marathon.adminUsersTitle'), Markup.inlineKeyboard(buttons));
    } catch (e: any) {
        console.error("Marathon invite list error:", e);
        ctx.reply("Ошибка получения списка пользователей.");
    }
});

bot.action(/^invite_user:(.+)$/, async (ctx: any) => {
    const userId = ctx.match[1];
    const admin = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    
    if (!admin || admin.role !== 'admin') return ctx.answerCbQuery("Доступ запрещен");

    try {
        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!targetUser || !targetUser.telegram_id) return ctx.answerCbQuery("Пользователь не найден");

        // Send personal invite to target user
        await bot.telegram.sendMessage(targetUser.telegram_id, t(targetUser.language || 'ru', 'Marathon.invitationText'), 
            Markup.inlineKeyboard([
                [Markup.button.callback(t(targetUser.language || 'ru', 'Marathon.invitePersonal'), 'marathon_join_confirmed')]
            ])
        );

        ctx.answerCbQuery(t(lang, 'Marathon.adminInviteSent', { name: targetUser.full_name || targetUser.email }));
        ctx.editMessageText(t(lang, 'Marathon.adminInviteSent', { name: targetUser.full_name || targetUser.email }));
    } catch (e: any) {
        console.error("Invite send error:", e);
        ctx.answerCbQuery("Ошибка при отправке приглашения");
    }
});

bot.action('marathon_join_confirmed', async (ctx: any) => {
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    if (!user) return ctx.answerCbQuery(t(lang, 'Auth.notLinked'));
    await handleMarathonJoinLogic(ctx, user, lang);
    await ctx.answerCbQuery().catch(() => {});
});

bot.command('marathon_broadcast', async (ctx: any) => {
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    if (!user || user.role !== 'admin') return;

    try {
        const channelSetting = await prisma.systemSetting.findUnique({ where: { key: 'marathon_channel_id' } });
        if (!channelSetting) return ctx.reply("Канал для марафона не настроен. Используйте /marathon_setup");

        const limitSetting = await prisma.systemSetting.findUnique({ where: { key: 'marathon_limit' } });
        const limit = limitSetting ? limitSetting.value : '10';

        const me = await bot.telegram.getMe();
        const joinLink = `https://t.me/${me.username}?start=marathon`;

        const sentMsg = await bot.telegram.sendMessage(
            channelSetting.value,
            t(lang, 'Marathon.broadcastTitle') + "\n\n" + t(lang, 'Marathon.broadcastText', { limit }),
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.url(t(lang, 'Marathon.broadcastBtn'), joinLink)]
                ])
            }
        );

        await prisma.systemSetting.upsert({
            where: { key: 'marathon_broadcast_msg_id' },
            update: { value: sentMsg.message_id.toString() },
            create: { key: 'marathon_broadcast_msg_id', value: sentMsg.message_id.toString() }
        });

        ctx.reply("✅ Пост с приглашением опубликован в канале.");
    } catch (e: any) {
        console.error("Broadcast error:", e);
        ctx.reply("Ошибка при публикации в канал.");
    }
});

// Auto-detect timezone from Telegram language_code
function detectTimezoneFromLang(languageCode?: string): string {
    const map: Record<string, string> = {
        'ru': 'Europe/Moscow',
        'uk': 'Europe/Kiev',
        'be': 'Europe/Minsk',
        'kk': 'Asia/Almaty',
        'uz': 'Asia/Tashkent',
        'ky': 'Asia/Bishkek',
        'tg': 'Asia/Dushanbe',
        'az': 'Asia/Baku',
        'hy': 'Asia/Yerevan',
        'ka': 'Asia/Tbilisi',
        'tt': 'Europe/Moscow',
        'ba': 'Asia/Yekaterinburg',
        'en': 'UTC',
        'de': 'Europe/Berlin',
        'fr': 'Europe/Paris',
        'es': 'Europe/Madrid',
        'it': 'Europe/Rome',
        'pt': 'Europe/Lisbon',
        'pl': 'Europe/Warsaw',
        'cs': 'Europe/Prague',
        'ro': 'Europe/Bucharest',
        'tr': 'Europe/Istanbul',
        'ar': 'Asia/Riyadh',
        'he': 'Asia/Jerusalem',
        'zh': 'Asia/Shanghai',
        'ja': 'Asia/Tokyo',
        'ko': 'Asia/Seoul',
    };
    const code = (languageCode || '').split('-')[0].toLowerCase();
    return map[code] || 'Europe/Moscow';
}

/**
 * Получает текущую дату пользователя в формате YYYY-MM-DD, DayOfWeek
 */
function getUserLocalDate(timezone?: string): string {
    const tz = timezone || 'Europe/Moscow';
    const now = new Date();
    try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: tz
        });
        const dateStr = formatter.format(now); // "YYYY-MM-DD"
        const weekday = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: tz });
        return `${dateStr}, ${weekday}`;
    } catch (e: any) {
        return now.toISOString().split('T')[0];
    }
}

/**
 * Рассчитывает целевую дату на основе локальной даты пользователя и смещения.
 */
function calculateTargetDate(localTodayStr: string, offset: number): Date {
    const datePart = localTodayStr.split(',')[0].trim(); // "YYYY-MM-DD"
    const [year, month, day] = datePart.split('-').map(Number);
    const date = new Date();
    // Используем полдень для страховки от сдвигов часовых поясов при расчетах
    date.setFullYear(year, month - 1, day);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    return date;
}

async function sendLanguagePrompt(ctx: any) {
  const lang = ctx.state.lang || 'ru';
  await ctx.reply(t(lang, 'Auth.langPrompt'), Markup.inlineKeyboard([
      [Markup.button.callback('🇷🇺 Русский', 'set_lang_ru'), Markup.button.callback('🇬🇧 English', 'set_lang_en')]
  ]));
}

bot.action('set_lang_ru', async (ctx: any) => {
    ctx.answerCbQuery();
    await saveLanguageAndMenu(ctx, 'ru');
});

bot.action('set_lang_en', async (ctx: any) => {
    ctx.answerCbQuery();
    await saveLanguageAndMenu(ctx, 'en');
});

bot.action('settings_language', async (ctx: any) => {
    ctx.answerCbQuery();
    await sendLanguagePrompt(ctx);
});

async function saveLanguageAndMenu(ctx: any, lang: string) {
    const user = ctx.state.user;
    if (!user) return ctx.reply("❌ User not found.");
    
    const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { language: lang } as any
    });
    ctx.state.user = updatedUser;
    ctx.state.lang = lang;
    
    await ctx.reply(t(lang, 'Settings.langSaved'));
    await sendWelcomeMenu(ctx, updatedUser);
}

// ----------------------------------------------------
// ONBOARDING FUNCTIONS
// ----------------------------------------------------

async function startOnboarding(ctx: any) {
    const lang = ctx.state.lang || 'ru';
    const user = ctx.state.user;
    await ctx.reply(t(lang, 'Onboarding.welcome'));
    userStates[user.id] = ONBOARDING_STATES.NAME;
    await ctx.reply(t(lang, 'Onboarding.askName'));
}


bot.action(/^onboarding_gender:(.+)$/, async (ctx: any) => {
    const gender = ctx.match[1];
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    if (!user) return;
    
    tempLog[user.id] = { ...tempLog[user.id], gender };
    userStates[user.id] = ONBOARDING_STATES.AGE;
    await ctx.editMessageText(`${t(lang, 'Onboarding.askGender')} ${gender === 'male' ? '👨' : '👩'}`);
    await ctx.reply(t(lang, 'Onboarding.askAge'));
    await ctx.answerCbQuery();
});

bot.action(/^onboarding_act:(.+)$/, async (ctx: any) => {
    const activity = ctx.match[1];
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    if (!user) return;

    tempLog[user.id] = { ...tempLog[user.id], activity };
    userStates[user.id] = ONBOARDING_STATES.GOAL;
    
    await ctx.editMessageText(t(lang, 'Onboarding.askGoal'), Markup.inlineKeyboard([
        [Markup.button.callback(t(lang, 'Onboarding.goalLose'), 'onboarding_goal:lose_weight')],
        [Markup.button.callback(t(lang, 'Onboarding.goalMaintain'), 'onboarding_goal:maintain')],
        [Markup.button.callback(t(lang, 'Onboarding.goalGain'), 'onboarding_goal:gain_muscle')]
    ]));
    await ctx.answerCbQuery();
});

bot.action(/^onboarding_goal:(.+)$/, async (ctx: any) => {
    const goal = ctx.match[1];
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    if (!user) return;

    tempLog[user.id] = { ...tempLog[user.id], goal };
    userStates[user.id] = '';
    
    await ctx.reply(t(lang, 'Onboarding.calculating'));
    
    const data = tempLog[user.id];
    const kbju = calculateKBJU(data);
    
    try {
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                full_name: data.name,
                gender: data.gender,
                age: data.age,
                weight: data.weight,
                height: data.height,
                activity_level: data.activity,
                goal: data.goal,
                target_calories: kbju.calories,
                target_protein: kbju.protein,
                target_fat: kbju.fat,
                target_carbs: kbju.carbs
            }
        });
        
        ctx.state.user = updatedUser;
        
        await ctx.reply(t(lang, 'Onboarding.results', {
            calories: kbju.calories,
            protein: kbju.protein,
            fat: kbju.fat,
            carbs: kbju.carbs
        }), { parse_mode: 'Markdown' });
        
        await sendWelcomeMenu(ctx, updatedUser);
    } catch (e: any) {
        console.error("Onboarding save error:", e);
        await ctx.reply(t(lang, 'Confirmation.error'));
    }
    
    await ctx.answerCbQuery();
});

function calculateKBJU(params: any) {
    let bmr = 0;
    const { gender, age, weight, height, activity, goal } = params;
    
    if (gender === 'male') {
        bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
        bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    const activityMultipliers: Record<string, number> = {
        'sedentary': 1.2,
        'light': 1.375,
        'moderate': 1.55,
        'active': 1.725,
        'very_active': 1.9
    };

    const tdee = bmr * (activityMultipliers[activity] || 1.2);
    
    const goalAdjustments: Record<string, number> = {
        'lose_weight': -500,
        'maintain': 0,
        'gain_muscle': 500
    };

    const targetCalories = tdee + (goalAdjustments[goal] || 0);
    
    const targetProtein = weight * (goal === 'gain_muscle' ? 2.0 : 1.8);
    const targetFat = weight * 0.9;
    const targetCarbs = (targetCalories - (targetProtein * 4) - (targetFat * 9)) / 4;

    return {
        calories: Math.round(targetCalories),
        protein: Math.round(targetProtein),
        fat: Math.round(targetFat),
        carbs: Math.round(targetCarbs)
    };
}

/**
 * Проверяет уровень подписки пользователя.
 * @param requiredPlan - 'standard' (фото еды, анализ) или 'pro' (советник, марафон)
 * 
 * Логика:
 * - Триал (3 дня) = доступно всё
 * - 'standard' подписка = доступны standard-фичи, но не pro
 * - 'pro' подписка = доступно всё
 * - Нет подписки = ничего не доступно
 * 
 * Если доступа нет — отправляет CTA-сообщение и возвращает false.
 */
async function checkSubscriptionLevel(ctx: any, user: any, requiredPlan: 'standard' | 'pro'): Promise<boolean> {
  // Всегда читаем свежие данные из БД — иначе кэш ctx.state.user может быть устаревшим
  let freshUser = user;
  try {
    const fromDb = await prisma.user.findUnique({ where: { id: user.id } });
    if (fromDb) {
      freshUser = fromDb;
      ctx.state.user = fromDb; // обновляем кэш
    }
  } catch (e: any) {
    console.error("[Sub Check] Failed to refresh user from DB, using cached data", e);
  }

  console.log("[DEBUG] Check Sub:", { tgId: ctx.from.id, email: freshUser.email, expires: freshUser.subscription_expires_at });
  const hasActiveSub = freshUser.subscription_expires_at && new Date(freshUser.subscription_expires_at) > new Date();
  const createdDate = freshUser.created_at ? new Date(freshUser.created_at) : new Date();
  const daysSinceCreated = (new Date().getTime() - createdDate.getTime()) / (1000 * 3600 * 24);
  const isTrial = daysSinceCreated <= 3;

  // Во время триала — всё разрешено
  if (isTrial) return true;

  // Нет активной подписки
  if (!hasActiveSub) {
    const lang = ctx.state?.lang || 'ru';
    const secret = process.env.JWT_SECRET || process.env.YOOKASSA_SECRET_KEY || 'default_secret';
    const token = jwt.sign({ email: freshUser.email }, secret, { expiresIn: '1h' });
    const dashboardUrl = `https://vireyou.com/api/auth/telegram-login?token=${token}&locale=${lang}`;

    const msg = lang === 'en'
      ? `⏳ Your 3-day free trial has ended.\n\nTo continue using AI features — get a subscription.\n\n🔥 Standard — food photo recognition & product analysis.\n💎 Pro — everything in Standard + AI nutrition coach & group challenges.`
      : `⏳ Ваш бесплатный пробный период (3 дня) завершён.\n\nЧтобы продолжать пользоваться ИИ-функциями — оформите подписку.\n\n🔥 Standard — распознавание еды и анализ продуктов.\n💎 Pro — всё из Standard + ИИ-советник и командные челленджи.`;

    await ctx.reply(msg, Markup.inlineKeyboard([
      [Markup.button.webApp(lang === 'en' ? '💳 Choose a plan' : '💳 Выбрать тариф', dashboardUrl)]
    ]));
    return false;
  }

  // Есть подписка — проверяем уровень
  const userPlan: string = (freshUser.role === 'PRO' || freshUser.role === 'admin' || freshUser.role === 'employee') ? 'pro' : 'standard';

  if (requiredPlan === 'pro' && userPlan !== 'pro') {
    // У пользователя Standard, а нужен Pro
    const lang = ctx.state?.lang || 'ru';
    const secret = process.env.JWT_SECRET || process.env.YOOKASSA_SECRET_KEY || 'default_secret';
    const token = jwt.sign({ email: freshUser.email }, secret, { expiresIn: '1h' });
    const dashboardUrl = `https://vireyou.com/api/auth/telegram-login?token=${token}&locale=${lang}`;

    const msg = lang === 'en'
      ? `💎 This feature is available on the Pro plan only.\n\nYour current plan: Standard.\n\nUpgrade to Pro to unlock:\n• 🍽️ AI nutrition advisor («What to eat next?»)\n• 🏃 Group challenges & marathons`
      : `💎 Эта функция доступна только в тарифе Pro.\n\nВаш текущий тариф: Standard.\n\nUpgrade до Pro открывает:\n• 🍽️ ИИ-советник по питанию («Что съесть дальше?»)\n• 🏃 Командные челленджи и марафоны`;

    await ctx.reply(msg, Markup.inlineKeyboard([
      [Markup.button.webApp(lang === 'en' ? '💎 Upgrade to Pro' : '💎 Перейти на Pro', dashboardUrl)]
    ]));
    return false;
  }

  return true;
}

// Алиас для обратной совместимости (используется в обработчике фото)
async function checkSubscription(ctx: any, user: any): Promise<boolean> {
  return checkSubscriptionLevel(ctx, user, 'standard');
}

// Вспомогательная функция для тихих проверок доступа к PRO-функциям (для cron)
function hasProAccessSilent(user: any): boolean {
  const hasActiveSub = user.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();
  const createdDate = user.created_at ? new Date(user.created_at) : new Date();
  const daysSinceCreated = (new Date().getTime() - createdDate.getTime()) / (1000 * 3600 * 24);
  const isTrial = daysSinceCreated <= 3;
  if (isTrial) return true;
  if (!hasActiveSub) return false;
  const userPlan = (user.role === 'PRO' || user.role === 'admin' || user.role === 'employee') ? 'pro' : 'standard';
  return userPlan === 'pro';
}

// Вспомогательная функция для отображения меню
async function sendWelcomeMenu(ctx: any, user: any) {
  const imagePath = path.join(__dirname, '../public/bot_assistant_avatar.png');

  let name = 'клиент';
  try {
      let profile = null;
      const authUser = await prisma.users.findFirst({ 
          where: { email: { equals: user.email, mode: 'insensitive' } } 
      });
      if (authUser) {
          profile = await prisma.profiles.findUnique({ where: { id: authUser.id } });
      }

      if (profile?.full_name) {
          name = profile.full_name;
      } else if (user.full_name) {
          name = user.full_name;
      }
  } catch (e: any) {
      console.log("Profile fetch failed:", e);
  }

  const lang = ctx.state?.lang || 'ru';
  const caption = t(lang, 'Menu.caption', { name });

  const isPro = user.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();
  const createdDate = user.created_at ? new Date(user.created_at) : new Date();
  const daysSinceCreated = (new Date().getTime() - createdDate.getTime()) / (1000 * 3600 * 24);
  const isTrial = daysSinceCreated <= 3;

  const secret = process.env.JWT_SECRET || process.env.YOOKASSA_SECRET_KEY || 'default_secret';
  const token = jwt.sign({ email: user.email }, secret, { expiresIn: '1h' });
  const dashboardUrl = `https://vireyou.com/api/auth/telegram-login?token=${token}&locale=${lang}`;

  const menuButtons: any[][] = [
      [Markup.button.callback(t(lang, 'Menu.nutrition'), 'menu_nutrition')],
      [Markup.button.callback(t(lang, 'Menu.activity'), 'menu_activity')],
      [Markup.button.callback(t(lang, 'Menu.sleep'), 'menu_sleep')],
      [Markup.button.callback(t(lang, 'Menu.water'), 'menu_water')],
      [Markup.button.callback(t(lang, 'Menu.habits'), 'menu_habits')]
  ];

  if (isPro || isTrial) {
      menuButtons.push([Markup.button.callback('✨ PRO', 'menu_pro')]);
  }

  menuButtons.push([Markup.button.webApp(t(lang, 'Menu.dashboard'), dashboardUrl)]);
  menuButtons.push([Markup.button.callback(t(lang, 'Menu.settings'), 'menu_settings')]);

  try {
      if (fs.existsSync(imagePath)) {
          await ctx.replyWithPhoto({ source: fs.createReadStream(imagePath) }, {
              caption: caption,
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard(menuButtons)
          });
      } else {
           await ctx.reply(caption, {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard(menuButtons)
          });
      }
  } catch (err) {
      console.error("Send Menu error:", err);
  }
}

bot.action('menu_pro', async (ctx: any) => {
    ctx.answerCbQuery();
    const lang = ctx.state.lang || 'ru';
    await ctx.reply(lang === 'en' ? '🌟 PRO Functions' : '🌟 Функции PRO', 
        Markup.inlineKeyboard([
            [Markup.button.callback(lang === 'en' ? '🤖 AI Lifestyle Assistant' : '🤖 AI Ассистент Образа Жизни', 'lifestyle_analyze')],
            [Markup.button.callback(lang === 'en' ? '👥 My Marathon' : '👥 Мой Марафон', 'menu_my_squad')],
            [Markup.button.callback(lang === 'en' ? '🛒 Shop Assistant' : '🛒 Помощник в магазине', 'menu_shop_assistant')],
            [Markup.button.callback(lang === 'en' ? '🍽️ What to eat next?' : '🍽️ Что съесть дальше?', 'menu_what_to_eat')],
            [Markup.button.callback(lang === 'en' ? '⬅️ Back' : '⬅️ Назад', 'menu_main')]
        ])
    );
});

bot.action('menu_main', async (ctx: any) => {
    ctx.answerCbQuery();
    await sendWelcomeMenu(ctx, ctx.state.user);
});

/**
 * Сохраняет расширенные данные о питании в базу данных.
 */
async function saveFoodLog(userId: string, foodData: any, localTodayStr?: string) {
  const validKeys = [
    'calories', 'protein', 'carbs', 'fat', 'fiber', 'description',
    'dish', 'grams', 'sugar_fast', 'trans_fat', 'cholesterol', 'added_sugar', 'omega_3', 'omega_6', 'water',
    'vitamin_A', 'vitamin_D', 'vitamin_E', 'vitamin_K', 'vitamin_B1', 'vitamin_B2', 'vitamin_B3', 'vitamin_B5', 'vitamin_B6', 'vitamin_B7', 'vitamin_B9', 'vitamin_B12', 'vitamin_C',
    'calcium', 'iron', 'magnesium', 'phosphorus', 'potassium', 'sodium', 'zinc', 'copper', 'manganese', 'selenium', 'iodine'
  ];
  const data: any = { id: crypto.randomUUID(), user_id: userId };
  for (const key of validKeys) {
    if (foodData[key] !== undefined) {
      data[key] = foodData[key];
    }
  }
  // Обработка оффсета даты (например, "Вчера")
  if (foodData.date_offset_days !== undefined && foodData.date_offset_days !== 0 && localTodayStr) {
      data.created_at = calculateTargetDate(localTodayStr, Number(foodData.date_offset_days));
  }

  const log = await prisma.nutritionLog.create({ data });

  // Если есть вредная привычка
  if (foodData.habit_key) {
      const logDate = data.created_at || new Date();
      await prisma.habitLog.create({ data: { id: crypto.randomUUID(),
              user_id: userId,
              habit_key: foodData.habit_key,
              completed: true,
              created_at: logDate,
              date: logDate
          }
      });
  }

  // Сохраняем объем воды в HydrationLog для отображения на дашборде
  if (foodData.water && foodData.water > 0) {
      const logDate = data.created_at || new Date();
      await prisma.hydrationLog.create({ data: { id: crypto.randomUUID(),
              user_id: userId,
              date: logDate,
              volume_ml: Math.round(foodData.water),
              created_at: logDate
          }
      });
  }

  return log;
}

/**
 * Отправляет сообщение с кнопками подтверждения на основе распознанного типа.
 */
async function sendConfirmationMessage(ctx: any, parsedData: any) {
    const user = ctx.state.user;
    if (!user) return;

    console.log(`[DEBUG] parsedData for user ${user.id}:`, JSON.stringify(parsedData, null, 2));

    const localToday = getUserLocalDate(user.timezone);

    tempLog[user.id] = { 
        type: parsedData.type, 
        data: { ...parsedData.data, description: parsedData.description }, 
        description: parsedData.description,
        date_offset_days: parsedData.date_offset_days,
        habit_key: parsedData.habit_key,
        localToday: localToday,
        base64: parsedData.base64 || tempLog[user.id]?.base64
    };

    const lang = ctx.state.lang || 'ru';
    let text = "";
    if (parsedData.type === "NUTRITION") {
        const d = parsedData.data;
        text = t(lang, 'Nutrition.saved', { 
            dish: d.dish || (lang === 'en' ? 'Unknown' : 'Без названия'), 
            grams: d.grams || '?', cal: d.calories || 0, prot: d.protein || 0, carbs: d.carbs || 0, fat: d.fat || 0, desc: parsedData.description 
        });
        if (parsedData.habit_key) {
            text += t(lang, 'Nutrition.detectedHabit', { habit: formatHabitName(parsedData.habit_key, lang) });
        }
    } else if (parsedData.type === "SLEEP") {
        const d = parsedData.data;
        text = t(lang, 'Sleep.saved', {
            dur: d.duration_hrs ? Number(d.duration_hrs).toFixed(1) : 0, 
            deep: d.deep_hrs ? Number(d.deep_hrs).toFixed(1) : 0, 
            rem: d.rem_hrs ? Number(d.rem_hrs).toFixed(1) : 0, 
            light: d.light_hrs ? Number(d.light_hrs).toFixed(1) : 0,
            hr: d.resting_heart_rate ? Number(d.resting_heart_rate).toFixed(0) : '--', 
            hrv: d.hrv ? Number(d.hrv).toFixed(0) : '--', 
            desc: parsedData.description
        });
    } else if (parsedData.type === "ACTIVITY") {
        const d = parsedData.data;
        text = t(lang, 'Activity.saved', {
            steps: d.steps || 0, cal: d.calories_burned || 0, mins: d.active_minutes || 0, desc: parsedData.description
        });
    } else if (parsedData.type === "HABIT") {
        const d = parsedData.data;
        text = t(lang, 'Habits.saved', { habit: formatHabitName(d.habit_key || parsedData.habit_key, lang), desc: parsedData.description });
    }

    const dateOffset = parsedData.date_offset_days ? Number(parsedData.date_offset_days) : 0;
    if (dateOffset !== 0) {
        text += dateOffset < 0 ? t(lang, 'Misc.dateOffsetPrev') : t(lang, 'Misc.dateOffsetNext');
    }

    return ctx.reply(text, Markup.inlineKeyboard([
        [Markup.button.callback(t(lang, 'Confirmation.btnSave'), 'save_log_confirm')],
        [Markup.button.callback(t(lang, 'Confirmation.btnEdit'), 'edit_log_prompt')]
    ]));
}


// ----------------------------------------------------
// Обработка ФОТО (Еда или Скриншоты или Товары)
// ----------------------------------------------------
bot.on('photo', async (ctx: any) => {
  const user = ctx.state.user;
  const photo = ctx.message.photo[ctx.message.photo.length - 1]; // Самое большое
  const tempPath = path.join('/tmp', `photo_${photo.file_id}.jpg`);
  const lang = ctx.state.lang || 'ru';

  // Проверяем подписку перед вызовом платного AI
  if (!(await checkSubscription(ctx, user))) return;

  await ctx.reply(t(lang, 'Processing.photoWait'));

  try {
    await downloadTelegramFile(photo.file_id, tempPath);
    const base64 = await fileToBase64(tempPath);

    if (user && userStates[user.id] === 'WAITING_FOR_PRODUCT_PHOTO') {
        userStates[user.id] = ''; // Сброс состояния
        
        // Получаем съеденное за сегодня
        const localTodayStr = getUserLocalDate(user.timezone);
        const datePart = localTodayStr.split(',')[0].trim();
        const startOfDay = new Date(`${datePart}T00:00:00Z`); // Упрощенно
        const endOfDay = new Date(`${datePart}T23:59:59Z`);
        
        const logs = await prisma.nutritionLog.findMany({
            where: { user_id: user.id, created_at: { gte: startOfDay, lte: endOfDay } }
        });
        const currentNutrients = logs.reduce((acc: any, log: any) => {
            acc.calories += Number(log.calories || 0);
            acc.protein += Number(log.protein || 0);
            acc.fat += Number(log.fat || 0);
            acc.carbs += Number(log.carbs || 0);
            return acc;
        }, { calories: 0, protein: 0, fat: 0, carbs: 0 });

        const result = await analyzeProductLabelWithAI(base64, currentNutrients, lang);
        
        if (result.status === "SUCCESS") {
            let icon = "✅";
            if (result.verdict === "LIMIT") icon = "⚠️";
            if (result.verdict === "AVOID") icon = "❌";
            
            let replyText = `${icon} **${result.title}**\n\n${result.reason}`;
            if (result.hidden_nasties && result.hidden_nasties.length > 0) {
                replyText += `\n\n🚨 Скрытые угрозы: ${result.hidden_nasties.join(', ')}`;
            }
            await ctx.reply(replyText, { parse_mode: 'Markdown' });
            return; // Успешно обработали как товар
        }
        
        // Если как товар не распознано, пробуем общую логику (скриншот/еда) ниже
        console.log(`[PhotoDispatch] Label analysis failed for user ${user.id}, falling back to general analysis.`);
    }

    // Сначала пробуем распознать как скриншот
    const screenshotData = await analyzeScreenshotWithAI(base64, getUserLocalDate(ctx.state.user?.timezone), lang);

    if (screenshotData.status === "SUCCESS" && screenshotData.type !== "UNKNOWN") {
        await sendConfirmationMessage(ctx, {
            type: screenshotData.type,
            data: screenshotData.metrics,
            description: screenshotData.description,
            base64: base64
        });
    } else {
        // Пробуем распознать как еду
        const foodData = await analyzeFoodWithAI(base64, ctx.message.caption, getUserLocalDate(ctx.state.user?.timezone), lang);
        console.log("[STEP1] Recognition result:", JSON.stringify(foodData, null, 2));

        if (foodData.status === "NEEDS_CLARIFICATION") {
            userStates[user.id] = 'WAITING_FOR_FOOD_CLARIFICATION';
            tempLog[user.id] = { base64, caption: ctx.message.caption };
            await ctx.reply(foodData.clarification_question || (lang === 'en' ? "Please clarify." : "Уточните, пожалуйста."));
        } else if (foodData.status === "SUCCESS") {
            await ctx.reply(lang === 'en' ? "🔍 Calculating exact nutrients..." : "🔍 Ищу точные данные в базе...");
            const ingredientsData = await Promise.all((foodData.ingredients || []).map(async (item: any) => {
                let cleanName = item.name || "";
                if (/белый спирт|white spirit|уайт-спирит/i.test(cleanName)) {
                    cleanName = "этиловый спирт";
                }
                const dbData = await getIngredientNutrientsWithAI(cleanName);
                console.log(`[STEP2] DB lookup for "${cleanName}" (${item.grams}g):`, JSON.stringify(dbData));
                return { grams: item.grams, nutrientsPer100g: dbData };
            }));
            const totalNutrients = calculateTotalNutrients(ingredientsData);
            totalNutrients.dish = foodData.dish;
            totalNutrients.description = foodData.description;
            totalNutrients.date_offset_days = foodData.date_offset_days;
            totalNutrients.habit_key = foodData.habit_key;

            await sendConfirmationMessage(ctx, {
                type: "NUTRITION",
                data: totalNutrients,
                description: foodData.description,
                date_offset_days: foodData.date_offset_days,
                habit_key: foodData.habit_key,
                base64: base64
            });
        } else {
            await ctx.reply(t(lang, 'Processing.photoUnknown'));
        }
    }
  } catch (error) {
    console.error("Photo Error:", error);
    await ctx.reply(t(lang, 'Processing.photoError'));
  } finally {
    if (fs.existsSync(tempPath)) await fs.promises.unlink(tempPath);
  }
});

// ----------------------------------------------------
// Обработка ГОЛОСА
// ----------------------------------------------------
bot.on('voice', async (ctx: any) => {
  const voice = ctx.message.voice;
  const tempPath = path.join('/tmp', `voice_${voice.file_id}.ogg`);
  const lang = ctx.state.lang || 'ru';

  await ctx.reply(t(lang, 'Processing.voiceWait'));
  console.log(`[VOICE] Starting voice process, file_id: ${voice.file_id}`);

  try {
    await downloadTelegramFile(voice.file_id, tempPath);
    console.log(`[VOICE] File saved to ${tempPath}`);
    
    const text = await transcribeVoiceWithAI(tempPath);
    console.log(`[VOICE] Transcription text: ${text}`);
    await ctx.reply(t(lang, 'Processing.voiceTranscription', { text }));

    const user = ctx.state.user;

    // Если пользователь в режиме правки — перенаправляем текст в LOG_EDIT обработчик
    if (user && userStates[user.id] === 'LOG_EDIT' && tempLog[user.id]) {
        console.log(`[VOICE] Redirecting to LOG_EDIT handler`);
        await ctx.reply(t(lang, 'Processing.editWait'));
        try {
            const logData = tempLog[user.id];
            const previousData = JSON.stringify(logData.data);
            let parsedData;

            if (logData.type === "NUTRITION" && logData.base64) {
                const correctionText = `ПОПРАВКА ОТ ПОЛЬЗОВАТЕЛЯ к предыдущему анализу: "${text}". Предыдущий результат: ${previousData}. Пересчитай с учетом поправки. Если пользователь пишет, что вес или объем неверный, но не называет точную цифру — переоцени вес САМОСТОЯТЕЛЬНО (например, две маленькие голени весят ~150-200г, а не 450г).`;
                const foodData = await analyzeFoodWithAI(logData.base64, correctionText, getUserLocalDate(ctx.state.user?.timezone), lang);
                console.log(`[DEBUG] foodData from LOG_EDIT for user ${user.id}:`, JSON.stringify(foodData, null, 2));
                if (foodData.status === "SUCCESS") {
                    parsedData = {
                        status: "SUCCESS",
                        type: "NUTRITION",
                        description: foodData.description,
                        date_offset_days: foodData.date_offset_days,
                        habit_key: foodData.habit_key,
                        data: {
                            dish: foodData.dish,
                            ingredients: foodData.ingredients
                        }
                    };
                } else if (foodData.status === "NEEDS_CLARIFICATION") {
                    return ctx.reply(foodData.clarification_question || "Не удалось понять правки, уточните пожалуйста.");
                } else {
                    parsedData = { status: "ERROR", debug: foodData };
                }
            } else {
                parsedData = await analyzeTextWithAI(`Корректировка показателей. Предыдущее состояние: ${previousData}. Правки пользователя: "${text}". Пересчитай показатели заново и верни JSON. ВЕРНИ ВСЕ ИНГРЕДИЕНТЫ И ИХ ВЕСА (grams) из предыдущего состояния, изменив только то, что просит пользователь! Если пользователь оспаривает вес, но не дает точной цифры, ПЕРЕОЦЕНИ вес адекватно здравому смыслу (например, 2 маленькие голени = 150г)!`, getUserLocalDate(ctx.state.user?.timezone), lang);
            }

            if (parsedData.status === "SUCCESS") {
                userStates[user.id] = '';
                if (parsedData.type === "NUTRITION" && parsedData.data?.ingredients?.length) {
                    await ctx.reply(lang === 'en' ? "🔍 Calculating exact nutrients..." : "🔍 Ищу точные данные в базе...");
                    const ingredientsData = [];
                    for (const item of parsedData.data.ingredients) {
                        const dbData = await getIngredientNutrientsWithAI(item.name);
                        ingredientsData.push({ grams: item.grams, nutrientsPer100g: dbData });
                    }
                    const totalNutrients = calculateTotalNutrients(ingredientsData);
                    totalNutrients.dish = parsedData.data?.dish;
                    totalNutrients.description = parsedData.description;
                    totalNutrients.date_offset_days = parsedData.date_offset_days;
                    totalNutrients.habit_key = parsedData.habit_key;
                    parsedData.data = totalNutrients;
                }
                await sendConfirmationMessage(ctx, parsedData);
            } else {
                await ctx.reply(t(lang, 'Processing.editUnknown'));
            }
        } catch (err) {
            console.error("Voice Edit Error:", err);
            await ctx.reply(t(lang, 'Processing.editError'));
        }
        return;
    }

    const parsedData = await analyzeTextWithAI(text, getUserLocalDate(ctx.state.user?.timezone), lang);
    console.log(`[VOICE] AI Analysis status: ${parsedData.status}`);

    if (parsedData.status === "SUCCESS") {
        if (parsedData.type === "NUTRITION" && parsedData.data?.ingredients?.length) {
            await ctx.reply(lang === 'en' ? "🔍 Calculating exact nutrients..." : "🔍 Ищу точные данные в базе...");
            const ingredientsData = [];
            for (const item of parsedData.data.ingredients) {
                let cleanName = item.name || "";
                if (/белый спирт|white spirit|уайт-спирит/i.test(cleanName)) {
                    cleanName = "этиловый спирт";
                }
                const dbData = await getIngredientNutrientsWithAI(cleanName);
                console.log(`[VOICE-STEP2] DB lookup for "${cleanName}" (${item.grams}g):`, JSON.stringify(dbData));
                ingredientsData.push({ grams: item.grams, nutrientsPer100g: dbData });
            }
            const totalNutrients = calculateTotalNutrients(ingredientsData);
            totalNutrients.dish = parsedData.data?.dish;
            totalNutrients.description = parsedData.description;
            totalNutrients.date_offset_days = parsedData.date_offset_days;
            totalNutrients.habit_key = parsedData.habit_key;
            
            parsedData.data = totalNutrients;
        }
        await sendConfirmationMessage(ctx, parsedData);
    } else {
        await ctx.reply(t(lang, 'Processing.voiceUnknown'));
    }
  } catch (error) {
    console.error("Voice Error:", error);
    await ctx.reply(t(lang, 'Processing.voiceError'));
  } finally {
    if (fs.existsSync(tempPath)) await fs.promises.unlink(tempPath);
    console.log(`[VOICE] Finished process for ${voice.file_id}`);
  }
});

// ----------------------------------------------------
// Обработка ТЕКСТА
// ----------------------------------------------------

bot.hears(/^(\d+)\s*(мл|ml|миллилитров)$/i, async (ctx: any) => {
    const volume = parseInt(ctx.match[1]);
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';

    if (!user) return ctx.reply(t(lang, 'Auth.notLinked'));

    await prisma.hydrationLog.create({ data: { id: crypto.randomUUID(), user_id: user.id, volume_ml: volume }
    });

    return ctx.reply(t(lang, 'Water.saved', { vol: volume }));
});

bot.on('text', async (ctx: any) => {
  const text = ctx.message.text;
  const user = ctx.state.user;
  const lang = ctx.state.lang || 'ru';

  if (!user) return ctx.reply(t(lang, 'Auth.notLinked'));

  // Настройка Канала Марафона (через Forward) - Перенесено выше в основной bot.on('message')

  // Выбор Часового Пояса
  if (userStates[user.id] === 'WAITING_FOR_TIMEZONE') {
      if (text.length < 2) return ctx.reply('Пожалуйста, напишите название города корректно.');
      
      await ctx.reply("⏳ Настраиваем часовой пояс...");
      const city = text.trim();
      const tz = await determineTimezoneFromCity(city);
      
      userStates[user.id] = ''; // Сброс статуса
      try {
           await prisma.user.update({
               where: { id: user.id },
               data: { timezone: tz }
           });
           if (ctx.state.user) ctx.state.user.timezone = tz;
           return ctx.reply(`Ваш часовой пояс установлен на: ${tz}`);
      } catch (e: any) {
           return ctx.reply(t(lang, 'Settings.tzError'));
      }
  }

  // Обработка сообщения в Службу заботы
  if (userStates[user.id] === 'WAITING_FOR_SUPPORT_MESSAGE') {
      userStates[user.id] = ''; // Сброс статуса
      const supportText = ctx.message.text || ctx.message.caption || "<Медиафайл>";
      const usernameInfo = ctx.message.from.username ? `(@${ctx.message.from.username})` : "";
      
      const processingMsg = await ctx.reply(lang === 'en' ? "Let me check..." : "Минутку, думаю...");
      
      try {
          const aiResponse = await generateSupportResponse(supportText, user, lang);
          
          if (aiResponse.escalate) {
              const admins = await prisma.user.findMany({ where: { role: 'admin' } });
              for (const admin of admins) {
                  if (!admin.telegram_id) continue;
                  try {
                      await bot.telegram.sendMessage(
                          admin.telegram_id, 
                          `🚨 <b>Служба заботы (Эскалация)</b>\n\nОт: ${user.full_name || 'Пользователь'} ${usernameInfo}\nID: <code>${user.telegram_id}</code>\n\n<b>Саммари ИИ:</b> ${aiResponse.summary}\n\nСообщение:\n${supportText}`,
                          { parse_mode: 'HTML' }
                      );
                      if (ctx.message.message_id) {
                          await bot.telegram.forwardMessage(admin.telegram_id, ctx.chat.id, ctx.message.message_id);
                      }
                  } catch (e: any) {
                      console.error(`Failed to send support message to admin ${admin.id}`, e);
                  }
              }
              await bot.telegram.editMessageText(ctx.chat.id, processingMsg.message_id, undefined, aiResponse.reply || t(lang, 'Settings.supportSent'));
          } else {
              await bot.telegram.editMessageText(ctx.chat.id, processingMsg.message_id, undefined, aiResponse.reply, {
                  reply_markup: {
                      inline_keyboard: [[{ text: lang === 'en' ? '🙋‍♂️ Call Human' : '🙋‍♂️ Позвать человека', callback_data: `call_human:${ctx.message.message_id}` }]]
                  }
              });
          }
      } catch (e: any) {
          console.error("AI Support Error:", e);
          const admins = await prisma.user.findMany({ where: { role: 'admin' } });
          for (const admin of admins) {
              if (!admin.telegram_id) continue;
              try {
                  await bot.telegram.sendMessage(
                      admin.telegram_id, 
                      `🚨 <b>Служба заботы (Фолбэк)</b>\n\nОт: ${user.full_name || 'Пользователь'} ${usernameInfo}\nID: <code>${user.telegram_id}</code>\n\nСообщение:\n${supportText}`,
                      { parse_mode: 'HTML' }
                  );
              } catch (err) {}
          }
          await bot.telegram.editMessageText(ctx.chat.id, processingMsg.message_id, undefined, t(lang, 'Settings.supportSent'));
      }
      return;
  }

  // Обработка уточнения блюда
  if (userStates[user.id] === 'WAITING_FOR_FOOD_CLARIFICATION' && tempLog[user.id]) {
      await ctx.reply(lang === 'en' ? "🔍 Analyzing with your clarification..." : "🔍 Анализирую с учетом вашего уточнения...");
      try {
          const { base64, caption } = tempLog[user.id];
          const combinedCaption = (caption ? caption + "\n" : "") + "Уточнение пользователя: " + text;
          
          const foodData = await analyzeFoodWithAI(base64, combinedCaption, getUserLocalDate(ctx.state.user?.timezone), lang);
          
          if (foodData.status === "NEEDS_CLARIFICATION") {
               await ctx.reply(foodData.clarification_question || "Уточните еще раз.");
               tempLog[user.id].caption = combinedCaption;
               return;
          } else if (foodData.status === "SUCCESS") {
              userStates[user.id] = ''; // Сброс
              await ctx.reply(lang === 'en' ? "🔍 Calculating exact nutrients..." : "🔍 Ищу точные данные в базе...");
              const ingredientsData = [];
              for (const item of foodData.ingredients || []) {
                  const dbData = await getIngredientNutrientsWithAI(item.name);
                  ingredientsData.push({ grams: item.grams, nutrientsPer100g: dbData });
              }
              const totalNutrients = calculateTotalNutrients(ingredientsData);
              totalNutrients.dish = foodData.dish;
              totalNutrients.description = foodData.description;
              totalNutrients.date_offset_days = foodData.date_offset_days;
              totalNutrients.habit_key = foodData.habit_key;
  
              await sendConfirmationMessage(ctx, {
                  type: "NUTRITION",
                  data: totalNutrients,
                  description: foodData.description,
                  date_offset_days: foodData.date_offset_days,
                  habit_key: foodData.habit_key
              });
          } else {
              userStates[user.id] = '';
              await ctx.reply(t(lang, 'Processing.photoUnknown'));
          }
      } catch (err) {
          console.error("Clarification Error:", err);
          userStates[user.id] = '';
          await ctx.reply(t(lang, 'Processing.textError'));
      }
      return;
  }

  // Обработка правок (LOG_EDIT)
  if (userStates[user.id] === 'LOG_EDIT' && tempLog[user.id]) {
      await ctx.reply(t(lang, 'Processing.editWait'));
      try {
          const logData = tempLog[user.id];
          const previousData = JSON.stringify(logData.data);
          let parsedData;

          if (logData.type === "NUTRITION" && logData.base64) {
              const correctionText = `ПОПРАВКА ОТ ПОЛЬЗОВАТЕЛЯ к предыдущему анализу: "${text}". Предыдущий результат: ${previousData}. Пересчитай с учетом поправки. Если пользователь пишет, что вес или объем неверный, но не называет точную цифру — переоцени вес САМОСТОЯТЕЛЬНО (например, две маленькие голени весят ~150-200г, а не 450г).`;
              const foodData = await analyzeFoodWithAI(logData.base64, correctionText, getUserLocalDate(ctx.state.user?.timezone), lang);
              console.log(`[DEBUG] foodData from LOG_EDIT for user ${user.id}:`, JSON.stringify(foodData, null, 2));
              if (foodData.status === "SUCCESS") {
                  parsedData = {
                      status: "SUCCESS",
                      type: "NUTRITION",
                      description: foodData.description,
                      date_offset_days: foodData.date_offset_days,
                      habit_key: foodData.habit_key,
                      data: {
                          dish: foodData.dish,
                          ingredients: foodData.ingredients
                      }
                  };
              } else if (foodData.status === "NEEDS_CLARIFICATION") {
                  return ctx.reply(foodData.clarification_question || "Не удалось понять правки, уточните пожалуйста.");
              } else {
                  parsedData = { status: "ERROR", debug: foodData };
              }
          } else {
              parsedData = await analyzeTextWithAI(`Корректировка показателей. Предыдущее состояние: ${previousData}. Правки пользователя: "${text}". Пересчитай показатели заново и верни JSON. ВЕРНИ ВСЕ ИНГРЕДИЕНТЫ И ИХ ВЕСА (grams) из предыдущего состояния, изменив только то, что просит пользователь! Если пользователь оспаривает вес, но не дает точной цифры, ПЕРЕОЦЕНИ вес адекватно здравому смыслу (например, 2 маленькие голени = 150г)!`, getUserLocalDate(ctx.state.user?.timezone), lang);
          }

          if (parsedData.status === "SUCCESS") {
              userStates[user.id] = ''; // Сброс статуса
              if (parsedData.type === "NUTRITION" && parsedData.data?.ingredients?.length) {
                  await ctx.reply(lang === 'en' ? "🔍 Calculating exact nutrients..." : "🔍 Ищу точные данные в базе...");
                  const ingredientsData = [];
                  for (const item of parsedData.data.ingredients) {
                      const dbData = await getIngredientNutrientsWithAI(item.name);
                      ingredientsData.push({ grams: item.grams, nutrientsPer100g: dbData });
                  }
                  const totalNutrients = calculateTotalNutrients(ingredientsData);
                  totalNutrients.dish = parsedData.data?.dish;
                  totalNutrients.description = parsedData.description;
                  totalNutrients.date_offset_days = parsedData.date_offset_days;
                  totalNutrients.habit_key = parsedData.habit_key;
                  parsedData.data = totalNutrients;
              }
              await sendConfirmationMessage(ctx, parsedData);
          } else {
              await ctx.reply(t(lang, 'Processing.editUnknown'));
          }
      } catch (err) {
          await ctx.reply(t(lang, 'Processing.editError'));
      }
      return;
  }

  // --- ONBOARDING HANDLERS ---
  if (userStates[user.id]?.startsWith('ONBOARDING_')) {
      const state = userStates[user.id];
      if (state === ONBOARDING_STATES.NAME) {
          if (text.length < 2) return ctx.reply(t(lang, 'Onboarding.invalidName'));
          tempLog[user.id] = { ...tempLog[user.id], name: text };
          userStates[user.id] = ONBOARDING_STATES.GENDER;
          return ctx.reply(t(lang, 'Onboarding.askGender'), Markup.inlineKeyboard([
              [Markup.button.callback(t(lang, 'Onboarding.genderMale'), 'onboarding_gender:male')],
              [Markup.button.callback(t(lang, 'Onboarding.genderFemale'), 'onboarding_gender:female')]
          ]));
      }

      const num = parseFloat(text.replace(',', '.'));
      if (state === ONBOARDING_STATES.AGE) {
          if (isNaN(num) || num < 1 || num > 120) return ctx.reply(t(lang, 'Onboarding.invalidNumber'));
          tempLog[user.id].age = Math.round(num);
          userStates[user.id] = ONBOARDING_STATES.WEIGHT;
          return ctx.reply(t(lang, 'Onboarding.askWeight'));
      }
      if (state === ONBOARDING_STATES.WEIGHT) {
          if (isNaN(num) || num < 20 || num > 300) return ctx.reply(t(lang, 'Onboarding.invalidNumber'));
          tempLog[user.id].weight = num;
          userStates[user.id] = ONBOARDING_STATES.HEIGHT;
          return ctx.reply(t(lang, 'Onboarding.askHeight'));
      }
      if (state === ONBOARDING_STATES.HEIGHT) {
          if (isNaN(num) || num < 50 || num > 250) return ctx.reply(t(lang, 'Onboarding.invalidNumber'));
          tempLog[user.id].height = num;
          userStates[user.id] = ONBOARDING_STATES.ACTIVITY;
          return ctx.reply(t(lang, 'Onboarding.askActivity'), Markup.inlineKeyboard([
              [Markup.button.callback(t(lang, 'Onboarding.actSedentary'), 'onboarding_act:sedentary')],
              [Markup.button.callback(t(lang, 'Onboarding.actLight'), 'onboarding_act:light')],
              [Markup.button.callback(t(lang, 'Onboarding.actModerate'), 'onboarding_act:moderate')],
              [Markup.button.callback(t(lang, 'Onboarding.actActive'), 'onboarding_act:active')],
              [Markup.button.callback(t(lang, 'Onboarding.actVeryActive'), 'onboarding_act:very_active')]
          ]));
      }
      
      if (state === ONBOARDING_STATES.CITY) {
          if (text.length < 2) return ctx.reply('Пожалуйста, напишите название города корректно.');
          
          await ctx.reply("⏳ Настраиваем часовой пояс...");
          const city = text.trim();
          const tz = await determineTimezoneFromCity(city);
          
          tempLog[user.id] = { ...tempLog[user.id], city, timezone: tz };
          userStates[user.id] = '';
          
          await ctx.reply(t(lang, 'Onboarding.calculating'));
          
          const data = tempLog[user.id];
          const kbju = calculateKBJU(data);
          
          try {
              const updatedUser = await prisma.user.update({
                  where: { id: user.id },
                  data: {
                      full_name: data.name,
                      gender: data.gender,
                      age: data.age,
                      weight: data.weight,
                      height: data.height,
                      activity_level: data.activity,
                      goal: data.goal,
                      timezone: data.timezone,
                      target_calories: kbju.calories,
                      target_protein: kbju.protein,
                      target_fat: kbju.fat,
                      target_carbs: kbju.carbs
                  }
              });
              
              // Return updated user 
              ctx.state.user = updatedUser;

              const welcomeText = `${t(lang, 'Onboarding.success_1')}\n\n` +
                  `${t(lang, 'Onboarding.success_cal')} ${Math.round(kbju.calories)} ${t(lang, 'Onboarding.success_kcal')}\n` +
                  `${t(lang, 'Onboarding.success_p')} ${Math.round(kbju.protein)} ${t(lang, 'Onboarding.success_g')}\n` +
                  `${t(lang, 'Onboarding.success_f')} ${Math.round(kbju.fat)} ${t(lang, 'Onboarding.success_g')}\n` +
                  `${t(lang, 'Onboarding.success_c')} ${Math.round(kbju.carbs)} ${t(lang, 'Onboarding.success_g')}\n\n` +
                  `Ваш часовой пояс установлен на: ${data.timezone}\n\n` +
                  `${t(lang, 'Onboarding.success_2')}`;

              await ctx.reply(welcomeText);
              await sendWelcomeMenu(ctx, updatedUser);
          } catch (e: any) {
              console.error("Onboarding Save Error:", e);
              await ctx.reply(t(lang, 'Confirmation.error'));
          }
      }
      return;
  }

  // Обычный анализ
  await ctx.reply(t(lang, 'Processing.textWait'));
  try {
      const parsedData = await analyzeTextWithAI(text, getUserLocalDate(ctx.state.user?.timezone), lang);
      if (parsedData.status === "SUCCESS") {
          if (parsedData.type === "NUTRITION") {
              await ctx.reply(lang === 'en' ? "🔍 Calculating exact nutrients..." : "🔍 Ищу точные данные в базе...");
              const ingredientsData = [];
              for (const item of parsedData.data?.ingredients || []) {
                  let cleanName = item.name || "";
                  if (/белый спирт|white spirit|уайт-спирит/i.test(cleanName)) {
                      cleanName = "этиловый спирт";
                  }
                  const dbData = await getIngredientNutrientsWithAI(cleanName);
                  ingredientsData.push({ grams: item.grams, nutrientsPer100g: dbData });
              }
              const totalNutrients = calculateTotalNutrients(ingredientsData);
              totalNutrients.dish = parsedData.data?.dish;
              totalNutrients.description = parsedData.description;
              totalNutrients.date_offset_days = parsedData.date_offset_days;
              totalNutrients.habit_key = parsedData.habit_key;
              
              parsedData.data = totalNutrients; // replace the data with calculated nutrients
          }
          await sendConfirmationMessage(ctx, parsedData);
      } else {
          await ctx.reply(t(lang, 'Processing.textUnknown'));
      }
  } catch (err) {
      console.error("Text Error:", err);
      await ctx.reply(t(lang, 'Processing.textError'));
  }
});

// ----------------------------------------------------
// Обработка Callback Кнопок для Сохранения/Правки Питания
// ----------------------------------------------------

bot.action('save_log_confirm', async (ctx: any) => {
    ctx.answerCbQuery();
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    
    if (!user) {
        console.error("[SAVE_LOG] No user in ctx.state");
        return ctx.reply(t(lang, 'Confirmation.error'));
    }
    
    if (!tempLog[user.id]) {
        console.error(`[SAVE_LOG] No tempLog for user ${user.id}. Bot may have restarted. Keys in tempLog: ${Object.keys(tempLog).join(',')}`);
        return ctx.reply(lang === 'en' 
            ? "❌ The data was lost (bot restarted). Please send your message again." 
            : "❌ Данные потерялись (бот перезапустился). Пожалуйста, отправьте сообщение заново.");
    }

    const cached = tempLog[user.id];
    console.log(`[SAVE_LOG] Saving type=${cached.type} for user ${user.id}, data keys: ${Object.keys(cached.data || {}).join(',')}`);
    
    try {
        let date = new Date();
        if (cached.date_offset_days && cached.localToday) {
            date = calculateTargetDate(cached.localToday, Number(cached.date_offset_days));
        }

        if (cached.type === "NUTRITION") {
            await saveFoodLog(user.id, cached.data, cached.localToday);
            // Note: saveFoodLog already handles habit_key internally
        } else if (cached.type === "SLEEP") {
            const startOfDay = new Date(date);
            startOfDay.setHours(0,0,0,0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23,59,59,999);

            const existing = await prisma.sleepLog.findFirst({
                where: { user_id: user.id, created_at: { gte: startOfDay, lte: endOfDay } }
            });

            const sleepData: any = {
                user_id: user.id,
                duration_hrs: cached.data.duration_hrs !== undefined ? Number(cached.data.duration_hrs) : (existing?.duration_hrs || 0),
                deep_hrs: cached.data.deep_hrs !== undefined ? Number(cached.data.deep_hrs) : (existing?.deep_hrs || 0),
                rem_hrs: cached.data.rem_hrs !== undefined ? Number(cached.data.rem_hrs) : (existing?.rem_hrs || 0),
                light_hrs: cached.data.light_hrs !== undefined ? Number(cached.data.light_hrs) : (existing?.light_hrs || 0),
                hrv: cached.data.hrv !== undefined ? Number(cached.data.hrv) : (existing?.hrv || null),
                resting_heart_rate: cached.data.resting_heart_rate !== undefined ? Number(cached.data.resting_heart_rate) : (existing?.resting_heart_rate || null),
                notes: cached.description || existing?.notes,
                created_at: date
            };

            if (existing) {
                await prisma.sleepLog.update({ where: { id: existing.id }, data: sleepData });
            } else {
                sleepData.id = crypto.randomUUID(); await prisma.sleepLog.create({ data: sleepData });
            }
        } else if (cached.type === "ACTIVITY") {
            const startOfDay = new Date(date);
            startOfDay.setHours(0,0,0,0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23,59,59,999);

            const existing = await prisma.activityLog.findFirst({
                where: { user_id: user.id, created_at: { gte: startOfDay, lte: endOfDay } }
            });

            const activityData: any = {
                user_id: user.id,
                steps: cached.data.steps !== undefined ? Number(cached.data.steps) : (existing?.steps || 0),
                active_minutes: cached.data.active_minutes !== undefined ? Number(cached.data.active_minutes) : (existing?.active_minutes || 0),
                calories_burned: cached.data.calories_burned !== undefined ? Number(cached.data.calories_burned) : (existing?.calories_burned || 0),
                notes: cached.description || existing?.notes,
                created_at: date
            };

            if (existing) {
                await prisma.activityLog.update({ where: { id: existing.id }, data: activityData });
            } else {
                activityData.id = crypto.randomUUID(); await prisma.activityLog.create({ data: activityData });
            }
        } else if (cached.type === "HABIT") {
            await prisma.habitLog.create({ data: { id: crypto.randomUUID(),
                    user_id: user.id,
                    habit_key: cached.data.habit_key || 'Привычка',
                    completed: true,
                    created_at: date,
                    date: date
                }
            });
        }

        delete tempLog[user.id];
        console.log(`[SAVE_LOG] Successfully saved type=${cached.type} for user ${user.id}`);
        await ctx.reply(t(lang, 'Confirmation.success'));
    } catch (e: any) {
        console.error("Save Log Error:", e);
        // Send actual error details to admin for debugging
        const errMsg = e?.message || String(e);
        console.error(`[SAVE_LOG] Error details for user ${user.id}, type=${cached.type}: ${errMsg}`);
        await ctx.reply(`${t(lang, 'Confirmation.error')}\n\n🔧 Debug: ${errMsg.substring(0, 200)}`);
    }
});

bot.action('edit_log_prompt', async (ctx: any) => {
    ctx.answerCbQuery();
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    if (!user) return;
    
    userStates[user.id] = 'LOG_EDIT';
    await ctx.reply(t(lang, 'Confirmation.editPrompt'));
});

// ----------------------------------------------------
// Чек-лист Рекомендаций и Утреннее напоминание
// ----------------------------------------------------

bot.action('menu_shop_assistant', async (ctx: any) => {
    ctx.answerCbQuery();
    const user = ctx.state.user;
    if (!user) return;
    const lang = ctx.state.lang || 'ru';

    // Проверяем подписку
    if (!(await checkSubscription(ctx, user))) return;

    userStates[user.id] = 'WAITING_FOR_PRODUCT_PHOTO';
    await ctx.reply(lang === 'en' 
        ? "📸 Send me a photo of a product label or nutrition facts from the store." 
        : "📸 Пришлите фото этикетки продукта или его состава из магазина, и я скажу, стоит ли его брать.");
});

bot.action('menu_what_to_eat', async (ctx: any) => {
    ctx.answerCbQuery();
    const user = ctx.state.user;
    if (!user) return;
    const lang = ctx.state.lang || 'ru';

    // Советник — только Pro
    if (!(await checkSubscriptionLevel(ctx, user, 'pro'))) return;

    if (!user.age || !user.weight || !user.gender || !user.activity_level) {
        await ctx.reply(
            "Для точной ИИ-рекомендации по КБЖУ и нутриентам, пожалуйста, укажите ваши физические параметры. Это нужно сделать один раз."
        );
        userStates[user.id] = ONBOARDING_STATES.GENDER;
        tempLog[user.id] = { name: user.full_name || user.first_name || 'User' };
        
        return ctx.reply(t(lang, 'Onboarding.askGender'), Markup.inlineKeyboard([
            [Markup.button.callback('Мужчина 👨', 'onboarding_gender:male'), Markup.button.callback('Женщина 👩', 'onboarding_gender:female')]
        ]));
    }

    await ctx.reply(lang === 'en' ? "⏳ Analyzing your day..." : "⏳ Анализирую ваш рацион за сегодня...");

    try {
        const localTodayStr = getUserLocalDate(user.timezone);
        const datePart = localTodayStr.split(',')[0].trim();
        const startOfDay = new Date(`${datePart}T00:00:00Z`);
        const endOfDay = new Date(`${datePart}T23:59:59Z`);
        
        const logs = await prisma.nutritionLog.findMany({
            where: { user_id: user.id, created_at: { gte: startOfDay, lte: endOfDay } }
        });
        
        const currentNutrients = logs.reduce((acc: any, log: any) => {
            acc.calories += Number(log.calories || 0);
            acc.protein += Number(log.protein || 0);
            acc.fat += Number(log.fat || 0);
            acc.carbs += Number(log.carbs || 0);
            return acc;
        }, { calories: 0, protein: 0, fat: 0, carbs: 0 });

        const profile = {
            gender: user.gender === 'male' ? 'Мужской' : (user.gender === 'female' ? 'Женский' : 'не указан'),
            age: user.age || 'не указан',
            weight: user.weight || 'не указан',
            activity_level: user.activity_level || 'moderate',
            timezone: user.timezone || 'Europe/Moscow',
            target_calories: user.target_calories,
            target_protein: user.target_protein,
            target_fat: user.target_fat,
            target_carbs: user.target_carbs
        };
        const userTz = user.timezone || 'Europe/Moscow';
        const now = new Date();
        const currentTimeStr = now.toLocaleTimeString('ru-RU', { timeZone: userTz, hour: '2-digit', minute: '2-digit' });
        
        const advice = await getProactiveNutritionAdvice(currentNutrients, profile, currentTimeStr, lang);
        await ctx.reply(advice);
    } catch (e: any) {
        console.error("Proactive AI Error:", e);
        await ctx.reply(lang === 'en' ? "Failed to analyze." : "Ошибка анализа.");
    }
});

bot.action('menu_my_squad', async (ctx: any) => {
    ctx.answerCbQuery();
    const user = ctx.state.user;
    if (!user) return;
    const lang = ctx.state.lang || 'ru';
    
    try {
        const participations = await prisma.squadParticipant.findMany({
            where: { user_id: user.id, Squad: { is_active: true } },
            include: { Squad: true }
        });

        const buttons = participations.map(p => [
            Markup.button.callback(`${p.Squad.name}`, `view_squad_${p.Squad.id}`)
        ]);
        
        buttons.push([Markup.button.callback(lang === 'en' ? "➕ Create New Squad" : "➕ Создать новый Сквад", 'create_squad')]);

        const text = lang === 'en' 
            ? "👥 **Your Active Squads:**\nSelect a squad to view results or manage participants."
            : "👥 **Ваши активные Марафоны:**\nВыберите группу, чтобы посмотреть результаты или управлять участниками.";

        await ctx.reply(text, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        });
    } catch (e: any) {
        console.error(e);
        await ctx.reply(lang === 'en' ? "Error loading squads." : "Ошибка загрузки сквадов.");
    }
});

bot.action(/^view_squad_(.+)$/, async (ctx: any) => {
    ctx.answerCbQuery();
    const user = ctx.state.user;
    const squadId = ctx.match[1];
    const lang = ctx.state.lang || 'ru';

    try {
        const { getSquadLeaderboard } = await import('../src/lib/squads/squadService');
        const squad = await prisma.squad.findUnique({ where: { id: squadId } });
        if (!squad || !squad.is_active) return ctx.reply(lang === 'en' ? "Squad not found." : "Марафон не найден.");

        const leaderboard = await getSquadLeaderboard(squadId);
        const inviteLink = `https://t.me/vireyou_bot?start=sq_${squadId}`;
        
        const buttons = [];
        if (squad.creator_id === user.id) {
            buttons.push([Markup.button.callback(lang === 'en' ? "⚙️ Manage Participants" : "⚙️ Управление участниками", `manage_squad_${squadId}`)]);
        }
        buttons.push([Markup.button.callback(lang === 'en' ? "⬅️ Back to list" : "⬅️ К списку марафонов", 'menu_my_squad')]);

        await ctx.reply(`${leaderboard}\n\n🔗 ${lang === 'en' ? 'Invite link' : 'Пригласить друзей'}: <code>${inviteLink}</code>`, { 
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard(buttons)
        });
    } catch (e: any) {
        console.error(e);
        ctx.reply(lang === 'en' ? "Error." : "Ошибка.");
    }
});

bot.action(/^manage_squad_(.+)$/, async (ctx: any) => {
    ctx.answerCbQuery();
    const user = ctx.state.user;
    const squadId = ctx.match[1];
    const lang = ctx.state.lang || 'ru';

    try {
        const squad = await prisma.squad.findUnique({ where: { id: squadId } });
        if (!squad || squad.creator_id !== user.id) return ctx.reply("Denied.");

        const participants = await prisma.squadParticipant.findMany({
            where: { squad_id: squadId },
            include: { User: true }
        });

        const buttons = participants
            .filter(p => p.user_id !== user.id) // Cannot remove self (creator)
            .map(p => [
                Markup.button.callback(`❌ ${p.User.full_name || p.User.email || 'User'}`, `rem_p_${p.id}`)
            ]);
        
        buttons.push([Markup.button.callback(lang === 'en' ? "⬅️ Back" : "⬅️ Назад", `view_squad_${squadId}`)]);

        await ctx.reply(lang === 'en' ? "Select a participant to remove:" : "Выберите участника для удаления:", 
            Markup.inlineKeyboard(buttons));
    } catch (e: any) {
        console.error(e);
        ctx.reply("Error.");
    }
});

bot.action(/^rem_p_(.+)$/, async (ctx: any) => {
    const participantId = ctx.match[1];
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';

    try {
        const participant = await prisma.squadParticipant.findUnique({
            where: { id: participantId },
            include: { Squad: true }
        });

        if (!participant || participant.squad.creator_id !== user.id) {
            return ctx.answerCbQuery(lang === 'en' ? "Denied." : "Отказано.");
        }

        const squadId = participant.squad_id;
        const userIdToRemove = participant.user_id;

        const { removeParticipant } = await import('../src/lib/squads/squadService');
        await removeParticipant(squadId, userIdToRemove, user.id);
        
        ctx.answerCbQuery(lang === 'en' ? "Participant removed." : "Участник удален.");
        // Refresh management list
        const squad = await prisma.squad.findUnique({ where: { id: squadId } });
        const participants = await prisma.squadParticipant.findMany({
            where: { squad_id: squadId },
            include: { User: true }
        });
        const buttons = participants
            .filter(p => p.user_id !== user.id)
            .map(p => [Markup.button.callback(`❌ ${p.User.full_name || p.User.email || 'User'}`, `rem_p_${squadId}_${p.user_id}`)]);
        buttons.push([Markup.button.callback(lang === 'en' ? "⬅️ Back" : "⬅️ Назад", `view_squad_${squadId}`)]);
        
        await ctx.editMessageText(lang === 'en' ? "Select a participant to remove:" : "Выберите участника для удаления:", 
            Markup.inlineKeyboard(buttons));
    } catch (e: any) {
        console.error(e);
        ctx.answerCbQuery("Error: " + e.message);
    }
});

bot.action('create_squad', async (ctx: any) => {
    ctx.answerCbQuery();
    const user = ctx.state.user;
    if (!user) return;
    const lang = ctx.state.lang || 'ru';

    try {
        const { createSquad } = await import('../src/lib/squads/squadService');
        
        // Count existing squads to name it properly
        const squadCount = await prisma.squad.count({ where: { creator_id: user.id } });
        const squadName = lang === 'en' ? `Squad #${squadCount + 1} of ${user.full_name || 'User'}` : `Марафон #${squadCount + 1} (${user.full_name || 'User'})`;
        
        const newSquad = await createSquad(user.id, squadName);
        const inviteLink = `https://t.me/vireyou_bot?start=sq_${newSquad.id}`;
        
        await ctx.reply(lang === 'en' 
            ? `✅ Squad "${squadName}" created!\n\nInvite link:\n<code>${inviteLink}</code>` 
            : `✅ Марафон "${squadName}" успешно создан!\n\nОтправьте эту ссылку друзьям:\n<code>${inviteLink}</code>`, 
            { parse_mode: 'HTML' });
            
    } catch (e: any) {
        console.error(e);
        await ctx.reply(lang === 'en' ? "Failed to create." : "Ошибка создания.");
    }
});


const TEST_NAMES: Record<string, Record<string, string>> = {
    'systemic-bio-age': { ru: 'Системный Биовозраст', en: 'Systemic Biological Age' },
    'insomnia': { ru: 'Индекс бессонницы', en: 'Insomnia Index' },
    'circadian': { ru: 'Циркадные ритмы', en: 'Circadian Rhythms' },
    'energy': { ru: 'Калькулятор TDEE', en: 'TDEE Calculator' },
    'nicotine': { ru: 'Тест Фагерстрема', en: 'Fagerström Test' },
    'alcohol': { ru: 'RUS-AUDIT', en: 'AUDIT (Alcohol)' },
    'sarc-f': { ru: 'SARC-F', en: 'SARC-F' },
    'greene-scale': { ru: 'Шкала Грина', en: 'Greene Climacteric Scale' },
    'ipss': { ru: 'IPSS', en: 'IPSS (Prostate)' },
    'mief-5': { ru: 'МИЭФ-5', en: 'IIEF-5 (Male Health)' },
    'score': { ru: 'SCORE', en: 'SCORE (Cardio risk)' }
};

const TEST_ALIASES: Record<string, string[]> = {
    'alcohol': ['RU-AUDIT', 'alcohol'],
    'systemic-bio-age': ['bio-age', 'systemic-bio-age'],
    'bio-age': ['systemic-bio-age', 'bio-age']
};

const TEST_PATHS: Record<string, string> = {
    'systemic-bio-age': '/diagnostics/systemic-bio-age',
    'bio-age': '/diagnostics/bio-age',
    'alcohol': '/diagnostics/alcohol',
    'RU-AUDIT': '/diagnostics/alcohol',
    'insomnia': '/diagnostics/insomnia',
    'circadian': '/diagnostics/circadian',
    'energy': '/diagnostics/energy',
    'nicotine': '/diagnostics/nicotine',
    'sarc-f': '/diagnostics/sarc-f',
    'greene-scale': '/diagnostics/greene-scale',
    'ipss': '/diagnostics/ipss',
    'mief-5': '/diagnostics/mief-5',
    'score': '/diagnostics/score'
};

bot.action('menu_checklist', async (ctx: any) => {
    ctx.answerCbQuery();
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    if (!user) return ctx.reply(t(lang, 'Auth.notLinked'));

    try {
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        if (!uuidRegex.test(user.id)) return;
        const results = await prisma.test_results.findMany({
            where: { user_id: user.id },
            orderBy: { created_at: 'desc' }
        });

        const aiRecs = results.filter((r: any) => r.test_type === 'ai-recommendation');
        const latestAiRec = aiRecs.length > 0 ? aiRecs[0] : null;

        const keyboard = {
            inline_keyboard: [
                [{ text: t(lang, 'Checklist.nutritionReco'), callback_data: 'menu_nutrition_reco' }],
                [{ text: t(lang, 'Checklist.cabinetBtn'), web_app: { url: `https://vireyou.com/api/auth/telegram-login?token=${jwt.sign({ email: user.email }, process.env.JWT_SECRET || process.env.YOOKASSA_SECRET_KEY || 'default_secret', { expiresIn: '1h' })}&locale=${lang}` } }],
                [{ text: t(lang, 'Settings.back'), callback_data: "main_menu" }]
            ]
        };

        if (!latestAiRec) {
            return ctx.reply(t(lang, 'Checklist.emptyTitle'), { reply_markup: keyboard });
        }

        const recommendedTests = (latestAiRec.raw_data as any)?.recommendedTests || [];
        if (recommendedTests.length === 0) {
             return ctx.reply(t(lang, 'Checklist.emptyTests'), { reply_markup: keyboard });
        }

        let text = t(lang, 'Checklist.title');
        recommendedTests.forEach((tid: string) => {
             const aliases = TEST_ALIASES[tid] || [tid];
             const isCompleted = results.some((r: any) => aliases.includes(r.test_type));
             const testNameObj = TEST_NAMES[tid];
             const name = testNameObj ? (testNameObj[lang] || testNameObj['ru']) : tid;
             const path = TEST_PATHS[tid] || `/diagnostics/${tid}`;
             const link = `https://vireyou.com/${lang}${path}`;
             text += `${isCompleted ? '✅' : '🔴'} **${name}**\n   └ [${t(lang, 'Checklist.takeTest')}](${link})\n\n`;
        });

        text += t(lang, 'Checklist.instructionsHeader');
        text += t(lang, 'Checklist.instr1');
        text += t(lang, 'Checklist.instr2');
        text += t(lang, 'Checklist.instr3');
        text += t(lang, 'Checklist.instr4');
        text += t(lang, 'Checklist.instrFooter');

        await ctx.reply(text, { 
            parse_mode: 'Markdown', 
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [
                    [{ text: t(lang, 'Checklist.nutritionReco'), callback_data: 'menu_nutrition_reco' }],
                    [{ text: t(lang, 'Checklist.cabinetBtn'), web_app: { url: `https://vireyou.com/api/auth/telegram-login?token=${jwt.sign({ email: user.email }, process.env.JWT_SECRET || process.env.YOOKASSA_SECRET_KEY || 'default_secret', { expiresIn: '1h' })}&locale=${lang}` } }],
                    [{ text: t(lang, 'Settings.back'), callback_data: "main_menu" }]
                ]
            }
        });

    } catch (e: any) {
        console.error("Checklist Error:", e);
        await ctx.reply(t(lang, 'Confirmation.error'));
    }
});

bot.action('menu_nutrition_reco', async (ctx: any) => {
    ctx.answerCbQuery();
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    if (!user) return ctx.reply(t(lang, 'Auth.notLinked'));

    if (!user.age || !user.weight || !user.gender || !user.activity_level) {
        await ctx.reply(
            "Для точного расчёта вашей нормы КБЖУ и персональной рекомендации нам необходимо знать ваши физические параметры. Давайте заполним их (это нужно сделать один раз)."
        );
        userStates[user.id] = ONBOARDING_STATES.GENDER;
        tempLog[user.id] = { name: user.full_name || user.first_name || 'User' };
        
        return ctx.reply(t(lang, 'Onboarding.askGender'), Markup.inlineKeyboard([
            [Markup.button.callback('Мужчина 👨', 'onboarding_gender:male'), Markup.button.callback('Женщина 👩', 'onboarding_gender:female')]
        ]));
    }

    try {
        await ctx.reply(t(lang, 'Checklist.nutritionWait'));

        // Calculate today's start/end in user's timezone
        const userTz = user.timezone || 'Europe/Moscow';
        const now = new Date();
        const startOfDay = new Date(now.toLocaleString('en-US', { timeZone: userTz }));
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(startOfDay);
        endOfDay.setHours(23, 59, 59, 999);

        // Fetch logs for today
        const logs = await prisma.nutritionLog.findMany({
            where: {
                user_id: user.id,
                created_at: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        });

        if (logs.length === 0) {
            return ctx.reply(t(lang, 'Nutrition.noDataToday'));
        }

        // Aggregate nutrients
        const totals: any = {
            calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
            vitamin_A: 0, vitamin_D: 0, vitamin_E: 0, vitamin_K: 0,
            vitamin_B1: 0, vitamin_B2: 0, vitamin_B3: 0, vitamin_B5: 0, vitamin_B6: 0,
            vitamin_B7: 0, vitamin_B9: 0, vitamin_B12: 0, vitamin_C: 0,
            calcium: 0, iron: 0, magnesium: 0, phosphorus: 0, potassium: 0, sodium: 0,
            zinc: 0, copper: 0, manganese: 0, selenium: 0, iodine: 0,
            omega_3: 0, omega_6: 0
        };

        logs.forEach(log => {
            Object.keys(totals).forEach(k => {
                if (typeof (log as any)[k] === 'number') {
                    totals[k] += (log as any)[k] || 0;
                }
            });
        });

        // Convert totals for easier AI reading (only positive)
        const activeTotals: any = {};
        Object.entries(totals).forEach(([k, v]) => {
            if (v && (v as number) > 0) activeTotals[k] = (v as number).toFixed(2);
        });

        const userProfile = {
            gender: user.gender === 'male' ? 'Мужской' : (user.gender === 'female' ? 'Женский' : 'не указан'),
            age: user.age || 'не указан',
            weight: user.weight || 'не указан',
            activity_level: user.activity_level || 'moderate'
        };

        const currentTimeStr = now.toLocaleTimeString('ru-RU', { timeZone: userTz, hour: '2-digit', minute: '2-digit' });

        // Call AI
        console.log(`[NutritionAnalysis] User: ${ctx.from?.id}, Lang: ${lang}, Action: Fetching daily recommendations`);
        const recommendation = await analyzeDailyNutritionWithAI(activeTotals, userProfile, currentTimeStr, lang);

        await ctx.reply(recommendation);

    } catch (e: any) {
        console.error("Nutrition Reco Error:", e);
        await ctx.reply(t(lang, 'Confirmation.error'));
    }
});

bot.action('main_menu', async (ctx: any) => {
    ctx.answerCbQuery();
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    if (!user) return ctx.reply(t(lang, 'Auth.notLinked'));
    await sendWelcomeMenu(ctx, user);
});

/**
 * Получает список непройденных тестов для утреннего напоминания.
 */
async function getPendingTestsList(userId: string, lang: string): Promise<string> {
    try {
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        if (!uuidRegex.test(userId)) return "";
        const results = await prisma.test_results.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' }
        });

        const aiRecs = results.filter((r: any) => r.test_type === 'ai-recommendation');
        if (aiRecs.length === 0) return "";

        const recommendedTests = (aiRecs[0].raw_data as any)?.recommendedTests || [];
        if (recommendedTests.length === 0) return "";

        const incompleteTests = recommendedTests.filter((tid: string) => {
             const aliases = TEST_ALIASES[tid] || [tid];
             return !results.some((r: any) => aliases.includes(r.test_type));
        });

        if (incompleteTests.length === 0) return "";

        return incompleteTests.map((tId: string) => {
            const testNameObj = TEST_NAMES[tId];
            const name = testNameObj ? (testNameObj[lang] || testNameObj['ru']) : tId;
            return `• ${name}`;
        }).join('\n');
    } catch (e: any) {
        console.error("Error fetching pending tests:", e);
        return "";
    }
}


// ----------------------------------------------------
// Вечерний Опрос (Cron в 21:00 ежедневно)
// ----------------------------------------------------
// Периодические задачи: Вечерний Опрос и Отчеты (объединены для оптимизации)
// ----------------------------------------------------
cron.schedule('* * * * *', async () => {
    const now = new Date();
    
    // --- Marathon Daily Report (22:00 MSK) ---
    const mskTime = now.toLocaleTimeString('ru-RU', { 
        timeZone: 'Europe/Moscow', 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    // --- Daily Review (Module A) (09:00 User Time) ---
    try {
        const users = await prisma.user.findMany({
            where: { dailyReviewEnabled: true, telegram_id: { not: null } }
        });

        for (const u of users) {
            try {
                const userTz = u.timezone || 'Europe/Moscow';
                const userTime = now.toLocaleTimeString('en-US', {
                    timeZone: userTz,
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                // If it is 09:00 in the user's timezone, send the daily review
                if (userTime === '09:00') {
                    console.log(`[CRON] Sending Daily Review (Module A) to user ${u.id} in timezone ${userTz}...`);
                    const review = await generateDailyReview(u.id);
                    await bot.telegram.sendMessage(u.telegram_id!.toString(), review, { parse_mode: "HTML" });
                }
            } catch (e) {
                console.error(`[CRON] Failed daily review for ${u.id}:`, e);
            }
        }
    } catch (e) {
        console.error("[CRON] Daily Review error:", e);
    }

    if (mskTime === '03:00') {
        try {
            // --- Calculate AI Baselines ---
            await calculateAllUserBaselines();

            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const sDay = new Date(yesterday.setHours(0, 0, 0, 0));
            const eDay = new Date(yesterday.setHours(23, 59, 59, 999));

            // 1. --- Update Squad Scores ---
            console.log("[CRON] Updating Squad Scores...");
            const { calculateDailyScore } = await import('../src/lib/squads/squadService');
            const activeSquads = await prisma.squad.findMany({ where: { is_active: true } });
            
            for (const squad of activeSquads) {
                const squadParticipants = await prisma.squadParticipant.findMany({
                    where: { squad_id: squad.id }
                });
                for (const p of squadParticipants) {
                    const { score } = await calculateDailyScore(p.user_id, sDay, eDay);
                    if (score > 0) {
                        await prisma.squadParticipant.update({
                            where: { id: p.id },
                            data: { score: { increment: score } }
                        });
                    }
                }
            }

            // 2. --- Send Daily Reports to Each Participant ---
            for (const squad of activeSquads) {
                const participants = await prisma.squadParticipant.findMany({
                    where: { squad_id: squad.id },
                    include: { User: true }
                });

                // Check if yesterday was the last day
                const isLastDay = yesterday.toDateString() === new Date(squad.end_date).toDateString();
                
                for (const p of participants) {
                    if (p.User.telegram_id) {
                        const lang = (p.user as any).language || 'ru';
                        const name = p.User.full_name || 'друг';
                        
                        // Generate group summary report personalized for this user
                        const groupSummary = await generateMarathonDailyReport(name, squad.id, lang);

                        if (groupSummary) {
                            let msg = groupSummary;
                            if (isLastDay) {
                                const thankYou = lang === 'en' 
                                    ? `\n\n🎉 **Marathon Completed!**\nThank you for participating, ${name}! Your contribution made this marathon special. Tomorrow you will receive your detailed personal report for all 7 days. 💪✨`
                                    : `\n\n🎉 **Марафон завершен!**\nСпасибо за участие, ${name}! Твой вклад сделал этот марафон особенным. Завтра ты получишь свой подробный персональный отчет за все 7 дней. 💪✨`;
                                msg += thankYou;
                            }

                            try {
                                await bot.telegram.sendMessage(p.User.telegram_id, msg, { parse_mode: 'Markdown' });
                            } catch (e: any) {
                                console.error(`[CRON] Failed to send group summary to ${p.User.id}:`, e);
                            }
                        }
                    }
                }
            }

            // 3. --- Send Final 7-Day Detailed Reports (Next day after completion) ---
            const dayBeforeYesterday = new Date(yesterday);
            dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);
            
            // Find squads that ended 1 day ago (end_date was the day before yesterday)
            const endedSquads = await prisma.squad.findMany({
                where: { 
                    is_active: true,
                    end_date: {
                        lt: sDay // end_date is before yesterday start
                    }
                }
            });

            for (const squad of endedSquads) {
                const participants = await prisma.squadParticipant.findMany({
                    where: { squad_id: squad.id },
                    include: { User: true }
                });

                for (const p of participants) {
                    if (p.User.telegram_id) {
                        try {
                            const lang = (p.user as any).language || "ru";
                            const { markdown } = await generatePeriodicReport(p.user_id, 7, p.User.full_name || undefined, undefined, lang);
                            await bot.telegram.sendMessage(p.User.telegram_id, markdown, { parse_mode: 'Markdown' });
                        } catch (e: any) {
                            console.error(`[CRON] Failed to send final report to ${p.User.id}:`, e);
                        }
                    }
                }

                // Finally deactivate the squad after sending all reports
                await prisma.squad.update({
                    where: { id: squad.id },
                    data: { is_active: false }
                });
            }

        } catch (err) {
            console.error("[CRON] Marathon report error:", err);
        }
    }

    try {
        const users = await prisma.user.findMany({
            where: { telegram_id: { not: null } }
        });

        for (const user of users) {
             const userTz = user.timezone || 'Europe/Moscow';
             const lang = (user as any).language || 'ru';
             const currentTime = now.toLocaleTimeString('ru-RU', { 
                 timeZone: userTz, 
                 hour: '2-digit', 
                 minute: '2-digit' 
             });

             // --- Персональные напоминания на основе настроек пользователя ---
             if (user.reminder_time1 === currentTime || 
                 user.reminder_time2 === currentTime || 
                 user.reminder_time3 === currentTime) {
                 
                 // Определяем час в таймзоне пользователя
                 const userHour = parseInt(now.toLocaleTimeString('en-US', { 
                     timeZone: userTz, 
                     hour12: false, 
                     hour: '2-digit' 
                 }));

                 if (userHour >= 5 && userHour < 12) {
                     // УТРО: Приветствие + Список тестов
                     const pendingTests = await getPendingTestsList(user.id, lang);
                     const message = t(lang, 'Reminders.morningGreeting', { 
                         name: user.full_name || (lang === 'en' ? 'Client' : 'клиент'), 
                         tests: pendingTests || (lang === 'en' ? 'All tests completed! ✨' : 'Все тесты пройдены! ✨') 
                     });
                     await bot.telegram.sendMessage(user.telegram_id!, message, { parse_mode: 'Markdown' });
                 } else {
                     // ДЕНЬ / ВЕЧЕР: Вода + Привычки
                     const isEvening = userHour >= 18 || userHour < 5;
                     const message = t(lang, isEvening ? 'Reminders.eveningGreeting' : 'Reminders.morningGreeting', { 
                         name: user.full_name || (lang === 'en' ? 'Client' : 'клиент'),
                         tests: '' // not used in evening/afternoon generic
                     });
                     
                     await bot.telegram.sendMessage(
                         user.telegram_id!,
                         message,
                         Markup.inlineKeyboard([
                             [Markup.button.callback(lang === 'en' ? '💧 Drank 250ml' : '💧 Выпил 250мл', 'water_250')],
                             [Markup.button.callback(lang === 'en' ? '💧 Drank 500ml' : '💧 Выпил 500мл', 'water_500')],
                             [Markup.button.callback(t(lang, 'Habits.checkBtn'), 'habits_check')]
                         ])
                     );
                 }
             }

             // --- Утренний Daily Action (09:00) ---
             if (currentTime === '09:00' && (user as any).dailyActionEnabled) {
                 try {
                     const context = await aggregateUserContext(user.id, 7);
                     const findings = evaluateLifestyle(context);
                     const action = await generateDailyAction(context, findings);

                     if (action && action.teaser && action.expansion) {
                         // Cache expansion in memory or DB? No easy DB field for arbitrary payload, 
                         // but we can just use `tempLog` or a new dict for expansions to keep it simple,
                         // since it's ephemeral.
                         tempLog[`daily_action_${user.id}`] = action.expansion;

                         await bot.telegram.sendMessage(
                             user.telegram_id!,
                             action.teaser,
                             {
                                 parse_mode: 'HTML',
                                 ...Markup.inlineKeyboard([
                                     [Markup.button.callback(lang === 'en' ? '✨ Tell me more' : '✨ Подробнее', 'daily_action_expand')]
                                 ])
                             }
                         );
                         console.log(`[CRON] Daily action sent: ${user.full_name || user.email}`);
                     }
                 } catch (err: any) {
                     console.error(`[CRON] Error sending daily action for ${user.id}:`, err);
                 }
             }

             // --- Периодический Отчет (11:00) ---
             if (currentTime === '11:00') {
                 const period = (user as any).report_period_days || 7;
                 const lastReport = (user as any).last_report_date ? new Date((user as any).last_report_date) : null;
                 
                 let isDue = false;
                 if (!lastReport) {
                     isDue = true;
                 } else {
                     const diffDays = (now.getTime() - lastReport.getTime()) / (1000 * 60 * 60 * 24);
                     if (diffDays >= period) {
                         isDue = true;
                     }
                 }

                 if (isDue) {
                     try {
                         const report = await generatePeriodicReport(user.id, period, undefined, undefined, lang);
                         await bot.telegram.sendMessage(
                             user.telegram_id!,
                             report.markdown,
                             { parse_mode: 'Markdown' }
                         );
                         
                         await prisma.user.update({
                             where: { id: user.id },
                             data: { last_report_date: now } as any
                         });
                         console.log(`[CRON] Periodic report sent: ${user.full_name || user.email}`);
                     } catch (err: any) {
                         console.error(`[CRON] Error sending report for ${user.id}:`, err);
                     }
                 }
             }
        }
    } catch (error) {
        console.error("[CRON] Periodic task error:", error);
    }
});

bot.action('menu_water', async (ctx: any) => {
    ctx.answerCbQuery();
    const lang = ctx.state.lang || 'ru';
    await ctx.reply(t(lang, 'Water.prompt'), 
        Markup.inlineKeyboard([
            [Markup.button.callback(t(lang, 'Water.btn250'), 'water_250')],
            [Markup.button.callback(t(lang, 'Water.btn500'), 'water_500')],
            [Markup.button.callback(t(lang, 'Water.btn750'), 'water_750')]
        ])
    );
});

bot.action('daily_action_expand', async (ctx: any) => {
    const user = ctx.state.user;
    if (!user) return ctx.answerCbQuery();

    if (!hasProAccessSilent(user)) {
        const lang = user.language || 'ru';
        const msg = lang === 'en' ? "The full analysis is part of PRO 🤍... let me open PRO for you 🌿" : "Полный разбор — часть PRO 🤍… открою для вас PRO 🌿";
        return ctx.answerCbQuery(msg, { show_alert: true });
    }

    const expansion = tempLog[`daily_action_${user.id}`];
    if (expansion) {
        await ctx.answerCbQuery();
        await ctx.reply(markdownToHtml(expansion), { parse_mode: "HTML" });
        delete tempLog[`daily_action_${user.id}`];
    } else {
        const lang = user.language || 'ru';
        await ctx.answerCbQuery(lang === 'en' ? "Action already viewed or expired." : "Подробности уже просмотрены или устарели.");
    }
});

bot.action('water_750', async (ctx: any) => {
    const user = await prisma.user.findFirst({ where: { telegram_id: ctx.from.id.toString() } });
    if (!user) return ctx.answerCbQuery("Пользователь не найден.");
    const lang = (user as any).language || 'ru';
    
    await prisma.hydrationLog.create({ data: { id: crypto.randomUUID(), user_id: user.id, volume_ml: 750 }
    });
    ctx.answerCbQuery(t(lang, 'Water.saved', { vol: 750 }));
    ctx.reply(t(lang, 'Water.text', { vol: 750 }));
});

bot.action('water_250', async (ctx: any) => {
    const user = await prisma.user.findFirst({ where: { telegram_id: ctx.from.id.toString() } });
    if (!user) return ctx.answerCbQuery("Пользователь не найден.");
    const lang = (user as any).language || 'ru';
    
    await prisma.hydrationLog.create({ data: { id: crypto.randomUUID(), user_id: user.id, volume_ml: 250 }
    });
    ctx.answerCbQuery(t(lang, 'Water.saved', { vol: 250 }));
    ctx.reply(t(lang, 'Water.text', { vol: 250 }));
});

bot.action('water_500', async (ctx: any) => {
    const user = await prisma.user.findFirst({ where: { telegram_id: ctx.from.id.toString() } });
    if (!user) return ctx.answerCbQuery("Пользователь не найден.");
    const lang = (user as any).language || 'ru';
    
    await prisma.hydrationLog.create({ data: { id: crypto.randomUUID(), user_id: user.id, volume_ml: 500 }
    });
    ctx.answerCbQuery(t(lang, 'Water.saved', { vol: 500 }));
    ctx.reply(t(lang, 'Water.text', { vol: 500 }));
});

bot.action('habits_check', async (ctx: any) => {
    ctx.answerCbQuery();
    const lang = ctx.state.lang || 'ru';
    ctx.reply(t(lang, 'Habits.prompt'));
});

const NUTRITION_NORMS: any = {
    protein: { norm: 80, unit: 'г' },
    fat: { norm: 70, unit: 'г' },
    carbs: { norm: 250, unit: 'г' },
    fiber: { norm: 30, unit: 'г' },
    sugar_fast: { norm: 50, unit: 'г' },
    trans_fat: { norm: 2, unit: 'г' },
    cholesterol: { norm: 300, unit: 'мг' },
    omega_3: { norm: 1.6, unit: 'г' },
    omega_6: { norm: 17, unit: 'г' },
    vitamin_A: { norm: 900, unit: 'мкг' },
    vitamin_D: { norm: 15, unit: 'мкг' },
    vitamin_E: { norm: 15, unit: 'мг' },
    vitamin_K: { norm: 120, unit: 'мкг' },
    vitamin_B1: { norm: 1.2, unit: 'мг' },
    vitamin_B2: { norm: 1.3, unit: 'мг' },
    vitamin_B3: { norm: 16, unit: 'мг' },
    vitamin_B5: { norm: 5, unit: 'мг' },
    vitamin_B6: { norm: 1.3, unit: 'мг' },
    vitamin_B7: { norm: 30, unit: 'мкг' },
    vitamin_B9: { norm: 400, unit: 'мкг' },
    vitamin_B12: { norm: 2.4, unit: 'мкг' },
    vitamin_C: { norm: 90, unit: 'мг' },
    calcium: { norm: 1000, unit: 'мг' },
    iron: { norm: 12, unit: 'мг' },
    magnesium: { norm: 400, unit: 'мг' },
    phosphorus: { norm: 700, unit: 'мг' },
    potassium: { norm: 4700, unit: 'мг' },
    sodium: { norm: 1500, unit: 'мг' },
    zinc: { norm: 11, unit: 'мг' },
    copper: { norm: 0.9, unit: 'мг' },
    manganese: { norm: 2.3, unit: 'мг' },
    selenium: { norm: 55, unit: 'мкг' },
    iodine: { norm: 150, unit: 'мкг' }
};

const NUTRIENT_NAMES: any = {
    protein: 'Белки', fat: 'Жиры', carbs: 'Углеводы', fiber: 'Клетчатка',
    sugar_fast: 'Простые углеводы', trans_fat: 'Трансжиры', cholesterol: 'Холестерин',
    omega_3: 'Омега-3', omega_6: 'Омега-6',
    vitamin_A: 'Витамин A', vitamin_D: 'Витамин D', vitamin_E: 'Витамин E', vitamin_K: 'Витамин K',
    vitamin_B1: 'Витамин B1', vitamin_B2: 'Витамин B2', vitamin_B3: 'Витамин B3',
    vitamin_B5: 'Витамин B5', vitamin_B6: 'Витамин B6', vitamin_B7: 'Витамин B7',
    vitamin_B9: 'Витамин B9', vitamin_B12: 'Витамин B12', vitamin_C: 'Витамин C',
    calcium: 'Кальций', iron: 'Железо', magnesium: 'Магний', phosphorus: 'Фосфор',
    potassium: 'Калий', sodium: 'Натрий', zinc: 'Цинк', copper: 'Медь',
    manganese: 'Марганец', selenium: 'Селен', iodine: 'Йод'
};

async function generateDailyReport(userId: string, lang: string = 'ru') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const logs = await prisma.nutritionLog.findMany({
        where: {
            user_id: userId,
            date: { gte: today, lt: tomorrow }
        }
    });

    const sum: any = {};
    for (const key of Object.keys(NUTRITION_NORMS)) {
        sum[key] = 0;
    }

    logs.forEach(log => {
        const anyLog = log as any;
        for (const key of Object.keys(sum)) {
            if (anyLog[key] !== null && anyLog[key] !== undefined) {
                sum[key] += Number(anyLog[key]);
            }
        }
    });

    if (logs.length === 0) {
        return t(lang, 'Nutrition.noDataToday');
    }

    const dateStr = today.toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU');
    
    // Определение групп нутриентов
    const groups = {
        min: ['trans_fat', 'sugar_fast', 'sodium'],
        balance: ['vitamin_A', 'vitamin_D', 'vitamin_E', 'vitamin_K', 'fat', 'calcium', 'iron', 'zinc', 'selenium', 'iodine', 'phosphorus'],
        max: ['protein', 'fiber', 'omega_3', 'potassium', 'magnesium', 'vitamin_C', 'vitamin_B1', 'vitamin_B2', 'vitamin_B3', 'vitamin_B5', 'vitamin_B6', 'vitamin_B7', 'vitamin_B9', 'vitamin_B12', 'carbs', 'cholesterol', 'omega_6', 'copper', 'manganese']
    };

    const growthZones: string[] = [];
    const wellDone: string[] = [];
    const neededForRec: string[] = [];

    for (const [key, config] of Object.entries(NUTRITION_NORMS) as any) {
        const pct = (sum[key] / config.norm) * 100;
        const name = (lang === 'en' ? (key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ')) : (NUTRIENT_NAMES[key] || key));
        
        let emoji = '🟢';
        let status: 'ideal' | 'limit' | 'danger' | 'excess' | 'deficiency' | 'low' = 'ideal';

        if (groups.min.includes(key)) {
            if (pct <= 50) { emoji = '🟢'; status = 'ideal'; }
            else if (pct <= 100) { emoji = '🟡'; status = 'limit'; }
            else { emoji = '🔴'; status = 'danger'; }
        } else if (groups.balance.includes(key)) {
            if (pct >= 80 && pct <= 115) { emoji = '🟢'; status = 'ideal'; }
            else if (pct < 80) { emoji = '🔴'; status = 'deficiency'; }
            else { emoji = '🟡'; status = 'excess'; }
        } else {
            // Group Max
            if (pct >= 85) { emoji = '🟢'; status = 'ideal'; }
            else { emoji = '🟡'; status = 'low'; }
        }

        const line = `${emoji} **${name}**: ${pct.toFixed(0)}%`;
        
        if (emoji === '🟢') {
            wellDone.push(line);
        } else {
            growthZones.push(line);
            if (status === 'deficiency' || status === 'low' || status === 'danger') {
                neededForRec.push(name);
            }
        }
    }

    let report = `📊 **Отчет за ${dateStr}**\n\n`;

    if (growthZones.length > 0) {
        report += `📉 **Зоны роста (Дефициты и Переборы)**:\n${growthZones.join('\n')}\n\n`;
    }

    if (wellDone.length > 0) {
        report += `🌟 **Ты молодец!**:\n${wellDone.join('\n')}\n\n`;
    }

    // Блок 3: Рекомендация
    const foodRecommendations: Record<string, string> = {
        'Белки': 'куриную грудку, яйца или творог',
        'Клетчатка': 'овощной салат или отруби',
        'Омега-3': 'жирную рыбу или семена льна',
        'Калий': 'банан или запеченный картофель',
        'Магний': 'тыквенные семечки или горький шоколад',
        'Железо': 'говяжью печень или чечевицу',
        'Кальций': 'кунжут или сыр',
        'Витамин С': 'болгарский перец или киви',
        'Трансжиры': 'избегайте фастфуда и выпечки',
        'Простые углеводы': 'сократите сладости и газировку',
        'Натрий': 'используйте меньше соли'
    };

    if (neededForRec.length > 0) {
        const selected = neededForRec.slice(0, 2);
        const foods = selected.map(n => foodRecommendations[n] || 'разнообразные овощи и белок').join(' и ');
        report += `💡 **Рекомендация**: Завтра добавьте в рацион **${foods}**, чтобы исправить баланс.`;
    } else {
        report += `💡 **Рекомендация**: Рацион идеально сбалансирован! Продолжайте в том же духе.`;
    }

    return report;
}




/**
 * Генерирует анонимный отчет по марафону для канала.
 */
export async function generateMarathonDailyReport(name?: string, squadId?: string, lang: string = 'ru') {
    console.log(`[MARATHON] Generating daily report for squad: ${squadId || 'ALL'}... language: ${lang}`);
    try {
        const activeSquadParticipants = await prisma.squadParticipant.findMany({
            where: squadId 
                ? { squad_id: squadId } 
                : { Squad: { is_active: true } },
            select: { user_id: true },
            distinct: ['user_id']
        });
        
        const participantIds = activeSquadParticipants.map(sp => sp.user_id);
        const participants = await prisma.user.findMany({
            where: { id: { in: participantIds } }
        });

        if (participants.length === 0) return null;

        const now = new Date();
        const yest = new Date(now);
        yest.setDate(yest.getDate() - 1);
        const startOfDay = new Date(yest.setHours(0, 0, 0, 0));
        const endOfDay = new Date(yest.setHours(23, 59, 59, 999));

        let countDiaries = 0;
        let countWater2L = 0;
        let countSleep7_8 = 0;
        let countSteps10kActive30 = 0;

        const participantSummaries = await Promise.all(participants.map(async (p) => {
            const [nutrition, sleep, water, activity] = await Promise.all([
                prisma.nutritionLog.findFirst({ where: { user_id: p.id, created_at: { gte: startOfDay, lte: endOfDay } } }),
                prisma.sleepLog.findFirst({ where: { user_id: p.id, created_at: { gte: startOfDay, lte: endOfDay } } }),
                prisma.hydrationLog.findFirst({ where: { user_id: p.id, created_at: { gte: startOfDay, lte: endOfDay } } }),
                prisma.activityLog.findFirst({ where: { user_id: p.id, created_at: { gte: startOfDay, lte: endOfDay } } })
            ]);

            if (nutrition && sleep && water && activity) countDiaries++;

            const hydrationLogs = await prisma.hydrationLog.findMany({
                where: { user_id: p.id, created_at: { gte: startOfDay, lte: endOfDay } }
            });
            const totalWater = hydrationLogs.reduce((s, l) => s + l.volume_ml, 0);
            if (totalWater >= 2000) countWater2L++;

            const sleepLogs = await prisma.sleepLog.findMany({
                where: { user_id: p.id, created_at: { gte: startOfDay, lte: endOfDay } }
            });
            const totalSleep = sleepLogs.reduce((s, l) => s + (l.duration_hrs || 0), 0);
            if (totalSleep >= 7 && totalSleep <= 8) countSleep7_8++;

            const activityLogs = await prisma.activityLog.findMany({
                where: { user_id: p.id, created_at: { gte: startOfDay, lte: endOfDay } }
            });
            const totalSteps = activityLogs.reduce((s, l) => s + (l.steps || 0), 0);
            const totalActive = activityLogs.reduce((s, l) => s + (l.active_minutes || 0), 0);
            if (totalSteps >= 10000 && totalActive >= 30) countSteps10kActive30++;

            const nutritionLogs = await prisma.nutritionLog.findMany({
                where: { user_id: p.id, created_at: { gte: startOfDay, lte: endOfDay } }
            });
            const nutSum: any = {};
            for (const key of Object.keys(NUTRITION_NORMS)) {
                nutSum[key] = nutritionLogs.reduce((s, log: any) => s + Number(log[key] || 0), 0);
            }
            return nutSum;
        }));

        const groups = {
            min: ['trans_fat', 'sugar_fast', 'sodium'],
            balance: ['vitamin_A', 'vitamin_D', 'vitamin_E', 'vitamin_K', 'fat', 'calcium', 'iron', 'zinc', 'selenium', 'iodine', 'phosphorus'],
            max: ['protein', 'fiber', 'omega_3', 'potassium', 'magnesium', 'vitamin_C', 'vitamin_B1', 'vitamin_B2', 'vitamin_B3', 'vitamin_B5', 'vitamin_B6', 'vitamin_B7', 'vitamin_B9', 'vitamin_B12']
        };

        const growthZones: string[] = [];
        const wellDone: string[] = [];

        for (const [key, config] of Object.entries(NUTRITION_NORMS) as any) {
            const totalSum = participantSummaries.reduce((s, pSum) => s + (pSum[key] || 0), 0);
            const avgVal = totalSum / participants.length;
            const pct = (avgVal / config.norm) * 100;
            const nutrientName = t(lang, `NUTRIENT_NAMES.${key}`);
            
            let emoji = '🟢';
            if (groups.min.includes(key)) {
                if (pct <= 50) emoji = '🟢';
                else if (pct <= 100) emoji = '🟡';
                else emoji = '🔴';
            } else if (groups.balance.includes(key)) {
                if (pct >= 80 && pct <= 115) emoji = '🟢';
                else if (pct < 80) emoji = '🔴';
                else emoji = '🟡';
            } else if (groups.max.includes(key)) {
                if (pct >= 85) emoji = '🟢';
                else emoji = '🟡';
            } else {
                continue; 
            }

            const line = `${emoji} **${nutrientName}**: ~${pct.toFixed(0)}%`;
            if (emoji === '🟢') wellDone.push(line);
            else growthZones.push(line);
        }

        const dateStr = yest.toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU');
        let report = name 
            ? t(lang, 'Marathon.dailyTitle', { name, date: dateStr })
            : t(lang, 'Marathon.dailyTitleGlobal', { date: dateStr });

        report += `✅ **${t(lang, 'Marathon.activityDiscipline')}**:\n`;
        report += `${t(lang, 'Marathon.diariesCount', { count: countDiaries })}\n`;
        report += `${t(lang, 'Marathon.stepsCount', { count: countSteps10kActive30 })}\n\n`;
        
        report += `💧 **${t(lang, 'Marathon.hydration')}**:\n`;
        report += `${t(lang, 'Marathon.waterCount', { count: countWater2L })}\n\n`;
        
        report += `🛌 **${t(lang, 'Marathon.sleep')}**:\n`;
        report += `${t(lang, 'Marathon.sleepCount', { count: countSleep7_8 })}\n\n`;

        if (growthZones.length > 0) {
            report += `📉 **${t(lang, 'Marathon.growthZones')}**\n${growthZones.slice(0, 5).join('\n')}\n\n`;
        }
        
        if (wellDone.length > 0) {
            report += `🌟 **${t(lang, 'Marathon.wellDone')}**\n${wellDone.slice(0, 5).join('\n')}\n\n`;
        }

        report += t(lang, 'Marathon.recommendation');

        return report;
    } catch (error) {
        console.error("[MARATHON] Report generation error:", error);
        return null;
    }
}
bot.action('menu_nutrition', async (ctx: any) => {
    ctx.answerCbQuery();
    const lang = ctx.state.lang || 'ru';
    await ctx.reply(t(lang, 'Nutrition.prompt'), Markup.inlineKeyboard([
        [Markup.button.callback(t(lang, 'Nutrition.lifehackBtn'), 'lifehack_nutrition')]
    ]));
});

bot.action('lifehack_nutrition', async (ctx: any) => {
    const lang = ctx.state.lang || 'ru';
    await ctx.answerCbQuery(t(lang, 'Nutrition.lifehackAlert'), { show_alert: true });
});

bot.action('get_nutrition_report', async (ctx: any) => {
    const user = await prisma.user.findFirst({ where: { telegram_id: ctx.from.id.toString() } });
    if (!user) return ctx.answerCbQuery("Пользователь не найден.");
    const lang = (user as any).language || 'ru';
    
    ctx.answerCbQuery();
    const report = await generateDailyReport(user.id, lang);
    ctx.reply(report, { parse_mode: 'Markdown' });
});

bot.action('menu_activity', async (ctx: any) => {
    ctx.answerCbQuery();
    const lang = ctx.state.lang || 'ru';
    ctx.reply(t(lang, 'Activity.prompt'));
});

bot.action('menu_sleep', async (ctx: any) => {
    ctx.answerCbQuery();
    const lang = ctx.state.lang || 'ru';
    ctx.reply(t(lang, 'Sleep.prompt'));
});

bot.action('menu_habits', async (ctx: any) => {
    ctx.answerCbQuery();
    const lang = ctx.state.lang || 'ru';
    ctx.reply(t(lang, 'Habits.prompt'));
});

bot.action('menu_settings', async (ctx: any) => {
    ctx.answerCbQuery();
    const lang = ctx.state.lang || 'ru';
    const tzPref = ctx.state.user?.timezone || 'Europe/Moscow';
    const keyboard = {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback(t(lang, 'Settings.notificationsBtn'), 'menu_notifications')],
            [Markup.button.callback(lang === 'en' ? '🍏 Apple Health Setup' : '🍏 Интеграция с Apple Health', 'cmd_link')],
            [Markup.button.callback(`${t(lang, 'Settings.timezone')} (${tzPref})`, 'menu_timezone')],
            [Markup.button.callback(t(lang, 'Settings.languageBtn'), 'settings_language')],
            [Markup.button.callback(t(lang, 'Settings.profileBtn'), 'menu_profile')],
            [Markup.button.callback(t(lang, 'Settings.supportBtn'), 'support_care')]
        ])
    };

    try {
        await ctx.editMessageText(t(lang, 'Settings.mainText'), keyboard);
    } catch (e) {
        await ctx.reply(t(lang, 'Settings.mainText'), keyboard);
    }
});

bot.action('menu_notifications', async (ctx: any) => {
    ctx.answerCbQuery();
    const lang = ctx.state.lang || 'ru';
    await ctx.editMessageText(t(lang, 'Settings.notificationsPrompt'), {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback(t(lang, 'Settings.rem1'), 'set_count_1')],
            [Markup.button.callback(t(lang, 'Settings.rem2'), 'set_count_2')],
            [Markup.button.callback(t(lang, 'Settings.rem3'), 'set_count_3')],
            [Markup.button.callback(t(lang, 'Settings.rem0'), 'set_count_0')],
            [Markup.button.callback(lang === 'en' ? '🔙 Back' : '🔙 Назад', 'menu_settings')]
        ])
    });
});

bot.action('support_care', async (ctx: any) => {
    ctx.answerCbQuery();
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    if (user) {
        userStates[user.id] = 'WAITING_FOR_SUPPORT_MESSAGE';
    }
    await ctx.reply(t(lang, 'Settings.supportPrompt'), Markup.inlineKeyboard([
        [Markup.button.callback(t(lang, 'Settings.back'), 'menu_settings')]
    ]));
});

bot.action('menu_profile', async (ctx: any) => {
    ctx.answerCbQuery();
    await startOnboarding(ctx);
});

bot.action('menu_timezone', async (ctx: any) => {
    ctx.answerCbQuery();
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    if (user) {
        userStates[user.id] = 'WAITING_FOR_TIMEZONE';
    }
    
    await ctx.reply('Напишите название вашего города (например, Москва, Алматы, Новосибирск), чтобы я настроил ваш местный часовой пояс:', Markup.inlineKeyboard([
        [Markup.button.callback(t(lang, 'Settings.back'), 'menu_settings')]
    ]));
});

const setTimezone = async (ctx: any, tz: string, text: string) => {
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    if (user) userStates[user.id] = ''; // Сброс ожидания текста
    try {
        await prisma.user.update({
            where: { id: user.id },
            data: { timezone: tz } as any
        });
        ctx.answerCbQuery();
        ctx.reply(t(lang, 'Settings.tzSaved', { tzName: text }));
    } catch (e: any) {
        console.error("Save timezone error:", e);
        ctx.reply(t(lang, 'Settings.tzError'));
    }
};

bot.action('set_tz_moscow', (ctx: any) => setTimezone(ctx, 'Europe/Moscow', 'Москва (UTC+3)'));
bot.action('set_tz_yekt', (ctx: any) => setTimezone(ctx, 'Asia/Yekaterinburg', 'Екатеринбург (UTC+5)'));
bot.action('set_tz_novt', (ctx: any) => setTimezone(ctx, 'Asia/Novosibirsk', 'Новосибирск (UTC+7)'));
bot.action('set_tz_vlat', (ctx: any) => setTimezone(ctx, 'Asia/Vladivostok', 'Владивосток (UTC+10)'));

// --- Обработчики Настроек ---

bot.action('set_count_1', async (ctx: any) => {
    ctx.answerCbQuery();
    const lang = ctx.state.lang || 'ru';
    ctx.reply(t(lang, 'Settings.remTimePrompt'), Markup.inlineKeyboard([
        [Markup.button.callback('09:00', 'save_time_1_0900'), Markup.button.callback('18:00', 'save_time_1_1800')],
        [Markup.button.callback('21:00', 'save_time_1_2100'), Markup.button.callback('22:00', 'save_time_1_2200')]
    ]));
});

bot.action('set_count_2', async (ctx: any) => {
    ctx.answerCbQuery();
    const lang = ctx.state.lang || 'ru';
    const text = lang === 'en' ? 'Choose time combination:' : 'Выберите комбинацию времени:';
    ctx.reply(`🕒 ${text}`, Markup.inlineKeyboard([
        [Markup.button.callback('09:00 и 21:00', 'save_time_2_preset1')],
        [Markup.button.callback('10:00 и 20:00', 'save_time_2_preset2')]
    ]));
});

bot.action('set_count_3', async (ctx: any) => {
    ctx.answerCbQuery();
    const lang = ctx.state.lang || 'ru';
    const text = lang === 'en' ? 'Choose time combination:' : 'Выберите комбинацию времени:';
    ctx.reply(`🕒 ${text}`, Markup.inlineKeyboard([
        [Markup.button.callback('09:00, 15:00 и 21:00', 'save_time_3_preset1')],
        [Markup.button.callback('08:00, 14:00 и 20:00', 'save_time_3_preset2')]
    ]));
});

bot.action('set_count_0', async (ctx: any) => {
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    await prisma.user.update({
        where: { id: user.id },
        data: { reminder_time1: null, reminder_time2: null, reminder_time3: null, dailyActionEnabled: false }
    });
    ctx.answerCbQuery();
    ctx.reply(t(lang, 'Settings.remOff'));
});

// Сохранение Пресетов
const presetSave = async (ctx: any, t1: string | null, t2: string | null, t3: string | null, textRu: string, textEn: string) => {
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    try {
        await prisma.user.update({
            where: { id: user.id },
            data: { reminder_time1: t1, reminder_time2: t2, reminder_time3: t3, dailyActionEnabled: true }
        });
        ctx.answerCbQuery();
        const msg = lang === 'en' ? textEn : textRu;
        ctx.reply(t(lang, 'Settings.remSaved', { time: msg }));
    } catch (e: any) {
        console.error("Save time error:", e);
        ctx.reply(t(lang, 'Settings.tzError'));
    }
};

bot.action('save_time_1_0900', (ctx: any) => presetSave(ctx, "09:00", null, null, "09:00", "09:00"));
bot.action('save_time_1_1800', (ctx: any) => presetSave(ctx, "18:00", null, null, "18:00", "18:00"));
bot.action('save_time_1_2100', (ctx: any) => presetSave(ctx, "21:00", null, null, "21:00", "21:00"));
bot.action('save_time_1_2200', (ctx: any) => presetSave(ctx, "22:00", null, null, "22:00", "22:00"));

bot.action('save_time_2_preset1', (ctx: any) => presetSave(ctx, "09:00", "21:00", null, "09:00 и 21:00", "09:00 and 21:00"));
bot.action('save_time_2_preset2', (ctx: any) => presetSave(ctx, "10:00", "20:00", null, "10:00 и 20:00", "10:00 and 20:00"));

bot.action('save_time_3_preset1', (ctx: any) => presetSave(ctx, "09:00", "15:00", "21:00", "09:00, 15:00 и 21:00", "09:00, 15:00 and 21:00"));
bot.action('save_time_3_preset2', (ctx: any) => presetSave(ctx, "08:00", "14:00", "20:00", "08:00, 14:00 и 20:00", "08:00, 14:00 and 20:00"));


// Периодический Отчет (объединен с Вечерним Опросом в строках 672+)



bot.catch((err: any, ctx: any) => {

    console.error(`[TelegrafError] for ${ctx.updateType || 'unknown'}:`, err.message || err);
});

// Запуск

console.log("Starting Telegram Bot (Long Polling)...");
bot.launch({ dropPendingUpdates: true }).catch(err => {
    console.error("Bot launch failed:", err);
});
console.log("✅ Bot is polling for updates");

// Обеспечиваем корректное завершение
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

bot.action(/call_human:(.+)/, async (ctx: any) => {
    ctx.answerCbQuery();
    const messageId = ctx.match[1];
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    
    // We update the original message to remove the button and say "we're connecting you"
    await ctx.editMessageText(
        ctx.callbackQuery.message.text + (lang === 'en' ? '\n\n👨‍💻 Escalating to a human...' : '\n\n👨‍💻 Перевожу на оператора...'),
        { reply_markup: undefined }
    );

    const admins = await prisma.user.findMany({ where: { role: 'admin' } });
    const usernameInfo = ctx.from.username ? `(@${ctx.from.username})` : "";
    
    for (const admin of admins) {
        if (!admin.telegram_id) continue;
        try {
            await bot.telegram.sendMessage(
                admin.telegram_id, 
                `🚨 <b>Служба заботы (Запрос оператора)</b>\n\nОт: ${user.full_name || 'Пользователь'} ${usernameInfo}\nID: <code>${user.telegram_id}</code>\n\nПользователь нажал кнопку "Позвать человека".`,
                { parse_mode: 'HTML' }
            );
            // We forward the original message that triggered this
            if (messageId) {
                await bot.telegram.forwardMessage(admin.telegram_id, ctx.chat.id, parseInt(messageId));
            }
        } catch (e: any) {
            console.error(`Failed to send support message to admin ${admin.id}`, e);
        }
    }
});
