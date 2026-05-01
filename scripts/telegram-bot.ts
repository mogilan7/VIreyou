import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import fs from "fs";
import path from "path";
import cron from "node-cron";
import jwt from "jsonwebtoken";

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'connection_limit=30&pool_timeout=40';
}

import prisma from "../src/lib/prisma";
import { analyzeFoodWithAI, analyzeScreenshotWithAI, transcribeVoiceWithAI, analyzeTextWithAI, analyzeDailyNutritionWithAI, analyzeProductLabelWithAI, getProactiveNutritionAdvice } from "../src/lib/telegram/ai-services";
import { generatePeriodicReport } from "../src/lib/reportGenerator";

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
    GOAL: 'ONBOARDING_GOAL'
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
    return next();
});

// ----------------------------------------------------
// Команды
// ----------------------------------------------------
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

  // Automatic user creation for seamless Telegram onboarding
  if (!ctx.state.user && (refId || squadId)) {
      const autoEmail = `tg_${ctx.from.id}@vireyou.com`;
      let newUser = await prisma.user.findUnique({ where: { email: autoEmail } });
      
      if (!newUser) {
          newUser = await prisma.user.create({
              data: {
                  email: autoEmail,
                  telegram_id: ctx.from.id.toString(),
                  role: 'client',
                  full_name: ctx.from.first_name || 'Спортсмен',
                  language: detectTimezoneFromLang(ctx.from.language_code) === 'Europe/Moscow' ? 'ru' : 'en',
                  timezone: detectTimezoneFromLang(ctx.from.language_code),
                  referrer_id: refId || null,
                  subscription_expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days free trial
              }
          });
      }
      ctx.state.user = newUser;
      ctx.state.lang = newUser.language || 'ru';
  }

  // 2. Иначе интерпретируем payload как email (для связки аккаунтов)
  let email = null;
  if (payload && !refId && !squadId && payload !== 'marathon') {
      email = payload;
      try {
          const decoded = Buffer.from(payload, 'base64').toString('utf8');
          if (decoded.includes('@')) {
              email = decoded;
          }
      } catch (e) {
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
          } catch (e) {
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
    return ctx.reply(t(ctx.state.lang, 'Auth.welcomeUnlinked'));
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
                } catch (e) {
                    console.error("Failed to edit channel message:", e);
                }
            }
        }
    } catch (e) {
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
    } catch (e) {
        ctx.reply("Ошибка получения статистики.");
    }
});

bot.command('marathon_test', async (ctx: any) => {
    const lang = ctx.state.lang || 'ru';
    const report = await generateMarathonDailyReport();
    if (!report) return ctx.reply("Нет данных для отчета или участников.");
    ctx.reply(report, { parse_mode: 'Markdown' });
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
    } catch (e) {
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
    } catch (e) {
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
    } catch (e) {
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
    } catch (e) {
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
    } catch (e) {
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
  } catch (e) {
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
  const data: any = { user_id: userId };
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
      await prisma.habitLog.create({
          data: {
              user_id: userId,
              habit_key: foodData.habit_key,
              completed: true,
              created_at: logDate,
              date: logDate
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
        data: parsedData.data, 
        description: parsedData.description,
        date_offset_days: parsedData.date_offset_days,
        habit_key: parsedData.habit_key,
        localToday: localToday
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
            dur: d.duration_hrs || 0, deep: d.deep_hrs || 0, rem: d.rem_hrs || 0, light: d.light_hrs || 0,
            hr: d.resting_heart_rate || '--', hrv: d.hrv || '--', desc: parsedData.description
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
            description: screenshotData.description
        });
    } else {
        // Пробуем распознать как еду
        const foodData = await analyzeFoodWithAI(base64, ctx.message.caption, getUserLocalDate(ctx.state.user?.timezone), lang);

        if (foodData.status === "SUCCESS") {
            await sendConfirmationMessage(ctx, {
                type: "NUTRITION",
                data: foodData,
                description: foodData.description,
                date_offset_days: foodData.date_offset_days
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

    const parsedData = await analyzeTextWithAI(text, getUserLocalDate(ctx.state.user?.timezone), lang);
    console.log(`[VOICE] AI Analysis status: ${parsedData.status}`);

    if (parsedData.status === "SUCCESS") {
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

    await prisma.hydrationLog.create({
        data: { user_id: user.id, volume_ml: volume }
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
      userStates[user.id] = ''; // Сброс статуса
      try {
           if (!text.includes('/')) {
               return ctx.reply("❌ Invalid timezone format.");
           }
           await prisma.user.update({
               where: { id: user.id },
               data: { timezone: text } as any
           });
           return ctx.reply(t(lang, 'Settings.tzSaved', { tzName: text }));
      } catch (e) {
           return ctx.reply(t(lang, 'Settings.tzError'));
      }
  }

  // Обработка правок (LOG_EDIT)
  if (userStates[user.id] === 'LOG_EDIT' && tempLog[user.id]) {
      await ctx.reply(t(lang, 'Processing.editWait'));
      try {
          const previousData = JSON.stringify(tempLog[user.id].data);
          const parsedData = await analyzeTextWithAI(`Корректировка показателей. Предыдущее состояние: ${previousData}. Правки пользователя: "${text}". Пересчитай показатели заново и верни JSON.`, getUserLocalDate(ctx.state.user?.timezone), lang);

          if (parsedData.status === "SUCCESS") {
              userStates[user.id] = ''; // Сброс статуса
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
      return;
  }

  // Обычный анализ
  await ctx.reply(t(lang, 'Processing.textWait'));
  try {
      const parsedData = await analyzeTextWithAI(text, getUserLocalDate(ctx.state.user?.timezone), lang);
      if (parsedData.status === "SUCCESS") {
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
    if (!user || !tempLog[user.id]) return ctx.reply(t(lang, 'Confirmation.error'));

    const cached = tempLog[user.id];
    try {
        let date = new Date();
        if (cached.date_offset_days && cached.localToday) {
            date = calculateTargetDate(cached.localToday, Number(cached.date_offset_days));
        }

        if (cached.type === "NUTRITION") {
            await saveFoodLog(user.id, cached.data, cached.localToday);
            
            if (cached.habit_key) {
                await prisma.habitLog.create({
                    data: {
                        user_id: user.id,
                        habit_key: cached.habit_key,
                        completed: true,
                        created_at: date,
                        date: date
                    }
                });
            }
        } else if (cached.type === "SLEEP") {
            const sleepData: any = {
                user_id: user.id,
                duration_hrs: cached.data.duration_hrs ? Number(cached.data.duration_hrs) : 0,
                deep_hrs: cached.data.deep_hrs ? Number(cached.data.deep_hrs) : 0,
                rem_hrs: cached.data.rem_hrs ? Number(cached.data.rem_hrs) : 0,
                light_hrs: cached.data.light_hrs ? Number(cached.data.light_hrs) : 0,
                hrv: cached.data.hrv ? Number(cached.data.hrv) : null,
                resting_heart_rate: cached.data.resting_heart_rate ? Number(cached.data.resting_heart_rate) : null,
                notes: cached.description,
                created_at: date
            };
            await prisma.sleepLog.create({
                data: sleepData
            });
        } else if (cached.type === "ACTIVITY") {
            await prisma.activityLog.create({
                data: {
                    user_id: user.id,
                    steps: cached.data.steps ? Number(cached.data.steps) : 0,
                    active_minutes: cached.data.active_minutes ? Number(cached.data.active_minutes) : 0,
                    calories_burned: cached.data.calories_burned ? Number(cached.data.calories_burned) : 0,
                    notes: cached.description,
                    created_at: date
                }
            });
        } else if (cached.type === "HABIT") {
            await prisma.habitLog.create({
                data: {
                    user_id: user.id,
                    habit_key: cached.data.habit_key || 'Привычка',
                    completed: true,
                    created_at: date,
                    date: date
                }
            });
        }

        delete tempLog[user.id];
        await ctx.reply(t(lang, 'Confirmation.success'));
    } catch (e) {
        console.error("Save Log Error:", e);
        await ctx.reply(t(lang, 'Confirmation.error'));
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

        const profile = await prisma.profiles.findUnique({ where: { id: user.id } }) || { gender: 'unknown', age: 30 };
        
        const advice = await getProactiveNutritionAdvice(currentNutrients, profile, lang);
        await ctx.reply(advice, { parse_mode: 'Markdown' });
    } catch (e) {
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
        const { getSquadLeaderboard } = await import('../src/lib/squads/squadService');
        
        // Find if user is in an active squad
        const participant = await prisma.squadParticipant.findFirst({
            where: { user_id: user.id },
            include: { squad: true },
            orderBy: { joined_at: 'desc' }
        });
        
        if (participant && participant.squad.is_active) {
            const leaderboard = await getSquadLeaderboard(participant.squad_id);
            const inviteLink = `https://t.me/vireyou_bot?start=sq_${participant.squad_id}`;
            await ctx.reply(`${leaderboard}\n\n🔗 Пригласить друзей: <code>${inviteLink}</code>`, { parse_mode: 'HTML' });
        } else {
            await ctx.reply(lang === 'en' 
                ? "You don't have an active Squad. Do you want to create one?" 
                : "У вас нет активного марафона (Сквада). Хотите создать?",
                Markup.inlineKeyboard([
                    [Markup.button.callback(lang === 'en' ? "➕ Create Squad" : "➕ Создать Сквад", 'create_squad')]
                ])
            );
        }
    } catch (e) {
        console.error(e);
        await ctx.reply(lang === 'en' ? "Error loading squad." : "Ошибка загрузки сквада.");
    }
});

bot.action('create_squad', async (ctx: any) => {
    ctx.answerCbQuery();
    const user = ctx.state.user;
    if (!user) return;
    const lang = ctx.state.lang || 'ru';

    try {
        const { createSquad } = await import('../src/lib/squads/squadService');
        const squadName = `Squad of ${user.full_name || 'User'}`;
        const newSquad = await createSquad(user.id, squadName);
        
        const inviteLink = `https://t.me/vireyou_bot?start=sq_${newSquad.id}`;
        
        await ctx.reply(lang === 'en' 
            ? `✅ Squad created!\n\nInvite link:\n<code>${inviteLink}</code>` 
            : `✅ Марафон успешно создан!\n\nОтправьте эту ссылку друзьям:\n<code>${inviteLink}</code>`, 
            { parse_mode: 'HTML' });
            
    } catch (e) {
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
        const results = await prisma.test_results.findMany({
            where: { user_id: user.id },
            orderBy: { created_at: 'desc' }
        });

        const aiRecs = results.filter((r: any) => r.test_type === 'ai-recommendation');
        const latestAiRec = aiRecs.length > 0 ? aiRecs[0] : null;

        const keyboard = {
            inline_keyboard: [
                [{ text: t(lang, 'Checklist.nutritionReco'), callback_data: 'menu_nutrition_reco' }],
                [{ text: t(lang, 'Checklist.cabinetBtn'), url: `https://vireyou.com/${lang}/cabinet` }],
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
                    [{ text: t(lang, 'Checklist.cabinetBtn'), url: `https://vireyou.com/${lang}/cabinet` }],
                    [{ text: t(lang, 'Settings.back'), callback_data: "main_menu" }]
                ]
            }
        });

    } catch (e) {
        console.error("Checklist Error:", e);
        await ctx.reply(t(lang, 'Confirmation.error'));
    }
});

bot.action('menu_nutrition_reco', async (ctx: any) => {
    ctx.answerCbQuery();
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    if (!user) return ctx.reply(t(lang, 'Auth.notLinked'));

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

        // Fetch user profile for age/gender
        const authUser = await (prisma as any).users.findFirst({
            where: { email: { equals: user.email, mode: 'insensitive' } }
        });
        
        let profile = null;
        if (authUser) {
            profile = await (prisma as any).profiles.findUnique({ where: { id: authUser.id } });
        }

        const userProfile = {
            gender: profile?.gender === 'male' ? 'Мужской' : (profile?.gender === 'female' ? 'Женский' : 'не указан'),
            age: profile?.date_of_birth ? Math.floor((new Date().getTime() - new Date(profile.date_of_birth).getTime()) / 31557600000) : 'не указан',
            weight: (profile as any)?.weight || 'не указан'
        };

        // Call AI
        console.log(`[NutritionAnalysis] User: ${ctx.from?.id}, Lang: ${lang}, Action: Fetching daily recommendations`);
        const recommendation = await analyzeDailyNutritionWithAI(activeTotals, userProfile, lang);

        await ctx.reply(recommendation, { parse_mode: 'Markdown' });

    } catch (e) {
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
    } catch (e) {
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

    if (mskTime === '03:00') {
        try {
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
                    include: { user: true }
                });

                // Check if yesterday was the last day
                const isLastDay = yesterday.toDateString() === new Date(squad.end_date).toDateString();
                
                for (const p of participants) {
                    if (p.user.telegram_id) {
                        const lang = (p.user as any).language || 'ru';
                        const name = p.user.full_name || 'друг';
                        
                        // Generate group summary report personalized for this user
                        const groupSummary = await generateMarathonDailyReport(name);

                        if (groupSummary) {
                            let msg = groupSummary;
                            if (isLastDay) {
                                const thankYou = lang === 'en' 
                                    ? `\n\n🎉 **Marathon Completed!**\nThank you for participating, ${name}! Your contribution made this marathon special. Tomorrow you will receive your detailed personal report for all 7 days. 💪✨`
                                    : `\n\n🎉 **Марафон завершен!**\nСпасибо за участие, ${name}! Твой вклад сделал этот марафон особенным. Завтра ты получишь свой подробный персональный отчет за все 7 дней. 💪✨`;
                                msg += thankYou;
                            }

                            try {
                                await bot.telegram.sendMessage(p.user.telegram_id, msg, { parse_mode: 'Markdown' });
                            } catch (e) {
                                console.error(`[CRON] Failed to send group summary to ${p.user.id}:`, e);
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
                    include: { user: true }
                });

                for (const p of participants) {
                    if (p.user.telegram_id) {
                        try {
                            const { markdown } = await generatePeriodicReport(p.user_id, 7, p.user.full_name || undefined);
                            await bot.telegram.sendMessage(p.user.telegram_id, markdown, { parse_mode: 'Markdown' });
                        } catch (e) {
                            console.error(`[CRON] Failed to send final report to ${p.user.id}:`, e);
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

// Обработчики кнопок
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

bot.action('water_750', async (ctx: any) => {
    const user = await prisma.user.findFirst({ where: { telegram_id: ctx.from.id.toString() } });
    if (!user) return ctx.answerCbQuery("Пользователь не найден.");
    const lang = (user as any).language || 'ru';
    
    await prisma.hydrationLog.create({
        data: { user_id: user.id, volume_ml: 750 }
    });
    ctx.answerCbQuery(t(lang, 'Water.saved', { vol: 750 }));
    ctx.reply(t(lang, 'Water.text', { vol: 750 }));
});

bot.action('water_250', async (ctx: any) => {
    const user = await prisma.user.findFirst({ where: { telegram_id: ctx.from.id.toString() } });
    if (!user) return ctx.answerCbQuery("Пользователь не найден.");
    const lang = (user as any).language || 'ru';
    
    await prisma.hydrationLog.create({
        data: { user_id: user.id, volume_ml: 250 }
    });
    ctx.answerCbQuery(t(lang, 'Water.saved', { vol: 250 }));
    ctx.reply(t(lang, 'Water.text', { vol: 250 }));
});

bot.action('water_500', async (ctx: any) => {
    const user = await prisma.user.findFirst({ where: { telegram_id: ctx.from.id.toString() } });
    if (!user) return ctx.answerCbQuery("Пользователь не найден.");
    const lang = (user as any).language || 'ru';
    
    await prisma.hydrationLog.create({
        data: { user_id: user.id, volume_ml: 500 }
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

    const dateStr = today.toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU');
    let report = t(lang, 'Nutrition.reportTitle', { date: dateStr });
    let hasData = false;

    // Считаем КБЖУ отдельно
    const kbtu: any = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    logs.forEach((log: any) => {
        kbtu.calories += Number(log.calories || 0);
        kbtu.protein += Number(log.protein || 0);
        kbtu.carbs += Number(log.carbs || 0);
        kbtu.fat += Number(log.fat || 0);
        kbtu.fiber += Number(log.fiber || 0);
    });

    if (logs.length > 0) hasData = true;

    report += t(lang, 'Nutrition.calLine', { cal: kbtu.calories.toFixed(1) });

    for (const [key, config] of Object.entries(NUTRITION_NORMS) as any) {
        const pct = (sum[key] / config.norm) * 100;
        let emoji = '🔴';
        if (pct >= 80) emoji = '🟢';
        else if (pct >= 50) emoji = '🟡';
        
        const nutrientName = lang === 'en' ? 
            (key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ')) : 
            (NUTRIENT_NAMES[key] || key);

        report += `${emoji} **${nutrientName}**: ${sum[key].toFixed(1)} / ${config.norm} ${config.unit} (${pct.toFixed(0)}%)\n`;
    }

    if (!hasData) {
        report += t(lang, 'Nutrition.noDataToday');
    }

    return report;
}

/**
 * Генерирует анонимный отчет по марафону для канала.
 */
export async function generateMarathonDailyReport(name?: string) {
    console.log("[MARATHON] Generating daily report...");
    try {
        // Fetch all unique users in active squads
        const activeSquadParticipants = await prisma.squadParticipant.findMany({
            where: { squad: { is_active: true } },
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
            // 1. Check all 4 diaries (Nutrition, Sleep, Water, Activity)
            const [nutrition, sleep, water, activity] = await Promise.all([
                prisma.nutritionLog.findFirst({ where: { user_id: p.id, created_at: { gte: startOfDay, lte: endOfDay } } }),
                prisma.sleepLog.findFirst({ where: { user_id: p.id, created_at: { gte: startOfDay, lte: endOfDay } } }),
                prisma.hydrationLog.findFirst({ where: { user_id: p.id, created_at: { gte: startOfDay, lte: endOfDay } } }),
                prisma.activityLog.findFirst({ where: { user_id: p.id, created_at: { gte: startOfDay, lte: endOfDay } } })
            ]);

            if (nutrition && sleep && water && activity) countDiaries++;

            // 2. Water 2L
            const hydrationLogs = await prisma.hydrationLog.findMany({
                where: { user_id: p.id, created_at: { gte: startOfDay, lte: endOfDay } }
            });
            const totalWater = hydrationLogs.reduce((s, l) => s + l.volume_ml, 0);
            if (totalWater >= 2000) countWater2L++;

            // 3. Sleep 7-8h
            const sleepLogs = await prisma.sleepLog.findMany({
                where: { user_id: p.id, created_at: { gte: startOfDay, lte: endOfDay } }
            });
            // Берем либо среднее, либо максимальное. Пользователь обычно присылает один лог утром за прошлую ночь.
            const totalSleep = sleepLogs.reduce((s, l) => s + (l.duration_hrs || 0), 0);
            if (totalSleep >= 7 && totalSleep <= 8) countSleep7_8++;

            // 4. Steps 10k + Active 30m
            const activityLogs = await prisma.activityLog.findMany({
                where: { user_id: p.id, created_at: { gte: startOfDay, lte: endOfDay } }
            });
            const totalSteps = activityLogs.reduce((s, l) => s + (l.steps || 0), 0);
            const totalActive = activityLogs.reduce((s, l) => s + (l.active_minutes || 0), 0);
            if (totalSteps >= 10000 && totalActive >= 30) countSteps10kActive30++;

            // 5. Nutrients (for deficiencies calculation)
            const nutritionLogs = await prisma.nutritionLog.findMany({
                where: { user_id: p.id, created_at: { gte: startOfDay, lte: endOfDay } }
            });
            const nutSum: any = {};
            for (const key of Object.keys(NUTRITION_NORMS)) {
                nutSum[key] = nutritionLogs.reduce((s, log: any) => s + Number(log[key] || 0), 0);
            }
            return nutSum;
        }));

        // Nutrient deficiency calculation (existing logic)
        const avgScores: { key: string, name: string, pct: number }[] = [];
        for (const [key, config] of Object.entries(NUTRITION_NORMS) as any) {
            const totalSum = participantSummaries.reduce((s, pSum) => s + (pSum[key] || 0), 0);
            const avgVal = totalSum / participants.length;
            const pct = (avgVal / config.norm) * 100;
            avgScores.push({
                key,
                name: (ruMessages as any).Bot?.NUTRIENT_NAMES?.[key] || (NUTRIENT_NAMES as any)[key] || key,
                pct: Math.min(pct, 200)
            });
        }
        avgScores.sort((a, b) => a.pct - b.pct);
        const top5Deficiencies = avgScores.slice(0, 5);

        const lang: string = 'ru'; // Default to ru for group summary
        const dateStr = yest.toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU');
        let report = name 
            ? (lang === 'en' ? `📊 **Marathon results for ${dateStr} for ${name}** 🚀\n\n` : `📊 **${name}, вот итоги марафона за ${dateStr}** 🚀\n\nВчера наши участники показали отличные результаты! Вот статистика по группе:`)
            : t(lang, 'Marathon.reportHeader', { date: dateStr });

        report += "\n";
        
        // Add new metrics
        report += t(lang, 'Marathon.metricDiaries', { count: countDiaries }) + "\n";
        report += t(lang, 'Marathon.metricActivity', { count: countSteps10kActive30 }) + "\n";
        report += t(lang, 'Marathon.metricWater', { count: countWater2L }) + "\n";
        report += t(lang, 'Marathon.metricSleep', { count: countSleep7_8 }) + "\n";

        // Add deficiencies
        report += t('ru', 'Marathon.topDeficiencies');
        top5Deficiencies.forEach((item, index) => {
            let emoji = '🔴';
            if (item.pct >= 50) emoji = '🟡';
            if (item.pct >= 80) emoji = '🟢';
            report += `${index + 1}. ${emoji} **${item.name}**: ~${item.pct.toFixed(0)}% от нормы\n`;
        });

        report += t('ru', 'Marathon.reportFooter');

        return report;
    } catch (error) {
        console.error("[MARATHON] Report generation error:", error);
        return null;
    }
}

bot.action('menu_nutrition', async (ctx: any) => {
    ctx.answerCbQuery();
    const lang = ctx.state.lang || 'ru';
    await ctx.reply(t(lang, 'Nutrition.prompt'));
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
    await ctx.reply(t(lang, 'Settings.mainText'), Markup.inlineKeyboard([
        [Markup.button.callback(t(lang, 'Settings.rem1'), 'set_count_1')],
        [Markup.button.callback(t(lang, 'Settings.rem2'), 'set_count_2')],
        [Markup.button.callback(t(lang, 'Settings.rem3'), 'set_count_3')],
        [Markup.button.callback(t(lang, 'Settings.rem0'), 'set_count_0')],
        [Markup.button.callback(`${t(lang, 'Settings.timezone')} (${tzPref})`, 'menu_timezone')],
        [Markup.button.callback(t(lang, 'Settings.languageBtn'), 'settings_language')],
        [Markup.button.callback(t(lang, 'Settings.profileBtn'), 'menu_profile')]
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
    
    await ctx.reply(t(lang, 'Settings.tzPrompt'), Markup.inlineKeyboard([
        [Markup.button.callback(t(lang, 'Settings.tzMsk'), 'set_tz_moscow')],
        [Markup.button.callback(t(lang, 'Settings.tzYek'), 'set_tz_yekt')],
        [Markup.button.callback(t(lang, 'Settings.tzNov'), 'set_tz_novt')],
        [Markup.button.callback(t(lang, 'Settings.tzVla'), 'set_tz_vlat')],
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
    } catch (e) {
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
        data: { reminder_time1: null, reminder_time2: null, reminder_time3: null }
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
            data: { reminder_time1: t1, reminder_time2: t2, reminder_time3: t3 }
        });
        ctx.answerCbQuery();
        const msg = lang === 'en' ? textEn : textRu;
        ctx.reply(t(lang, 'Settings.remSaved', { time: msg }));
    } catch (e) {
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
