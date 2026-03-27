import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import fs from "fs";
import path from "path";
import cron from "node-cron";

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'connection_limit=30&pool_timeout=40';
}

import prisma from "../src/lib/prisma";
import { analyzeFoodWithAI, analyzeScreenshotWithAI, transcribeVoiceWithAI, analyzeTextWithAI } from "../src/lib/telegram/ai-services";
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

const BOT_VERSION = "1.2.1"; // Updated to verify the fix
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
// Команды
// ----------------------------------------------------
bot.command('start', async (ctx: any) => {
  const args = ctx.message.text.split(' ');
  const payload = args[1];

  let email = payload;
  if (payload) {
      try {
          // Telegram Deep Link (start=...) не поддерживает символ @ и точки.
          // Поэтому мы ожидаем email в base64 от платформы.
          const decoded = Buffer.from(payload, 'base64').toString('utf8');
          if (decoded.includes('@')) {
              email = decoded;
          }
      } catch (e) {
          console.log("Not base64 or failed decoding, using raw:", payload);
      }
  }

  if (!email) {
    // Проверяем авторизацию еще раз (для запуска без аргументов)
    const user = ctx.state.user;
    if (user) {
         if (!user.language) {
             return sendLanguagePrompt(ctx);
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
    
    if (!(updatedUser as any).language) {
      return sendLanguagePrompt(ctx);
    }
    sendWelcomeMenu(ctx, updatedUser);
  } catch (error) {
    console.error("Start command error:", error);
    ctx.reply(t(ctx.state.lang, 'Auth.linkError'));
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

  try {
      if (fs.existsSync(imagePath)) {
          await ctx.replyWithPhoto({ source: fs.createReadStream(imagePath) }, {
              caption: caption,
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                  [Markup.button.callback(t(lang, 'Menu.recommendations'), 'menu_checklist')],
                  [Markup.button.callback(t(lang, 'Menu.nutrition'), 'menu_nutrition')],
                  [Markup.button.callback(t(lang, 'Menu.activity'), 'menu_activity')],
                  [Markup.button.callback(t(lang, 'Menu.sleep'), 'menu_sleep')],
                  [Markup.button.callback(t(lang, 'Menu.water'), 'menu_water')],
                  [Markup.button.callback(t(lang, 'Menu.habits'), 'menu_habits')],
                  [Markup.button.webApp(t(lang, 'Menu.dashboard'), lang === 'en' ? 'https://vireyou.com/en/cabinet/lifestyle' : 'https://vireyou.com/ru/cabinet/lifestyle')],
                  [Markup.button.callback(t(lang, 'Menu.settings'), 'menu_settings')]
              ])
          });
      } else {
           await ctx.reply(caption, {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                  [Markup.button.callback(t(lang, 'Menu.recommendations'), 'menu_checklist')],
                  [Markup.button.callback(t(lang, 'Menu.nutrition'), 'menu_nutrition')],
                  [Markup.button.callback(t(lang, 'Menu.activity'), 'menu_activity')],
                  [Markup.button.callback(t(lang, 'Menu.sleep'), 'menu_sleep')],
                  [Markup.button.callback(t(lang, 'Menu.water'), 'menu_water')],
                  [Markup.button.callback(t(lang, 'Menu.habits'), 'menu_habits')],
                  [Markup.button.webApp(t(lang, 'Menu.dashboard'), lang === 'en' ? 'https://vireyou.com/en/cabinet/lifestyle' : 'https://vireyou.com/ru/cabinet/lifestyle')],
                  [Markup.button.callback(t(lang, 'Menu.settings'), 'menu_settings')]
              ])
          });
      }
  } catch (err) {
      console.error("Send Menu error:", err);
  }
}

/**
 * Сохраняет расширенные данные о питании в базу данных.
 */
async function saveFoodLog(userId: string, foodData: any) {
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
  if (foodData.date_offset_days !== undefined && foodData.date_offset_days !== 0) {
      data.created_at = new Date(Date.now() + Number(foodData.date_offset_days) * 86400000);
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

    tempLog[user.id] = { 
        type: parsedData.type, 
        data: parsedData.data, 
        description: parsedData.description,
        date_offset_days: parsedData.date_offset_days,
        habit_key: parsedData.habit_key 
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
            text += t(lang, 'Nutrition.detectedHabit', { habit: parsedData.habit_key });
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
        text = t(lang, 'Habits.saved', { habit: d.habit_key, desc: parsedData.description });
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
// Обработка ФОТО (Еда или Скриншоты)
// ----------------------------------------------------
bot.on('photo', async (ctx: any) => {
  const photo = ctx.message.photo[ctx.message.photo.length - 1]; // Самое большое
  const tempPath = path.join('/tmp', `photo_${photo.file_id}.jpg`);
  const lang = ctx.state.lang || 'ru';

  await ctx.reply(t(lang, 'Processing.photoWait'));

  try {
    await downloadTelegramFile(photo.file_id, tempPath);
    const base64 = await fileToBase64(tempPath);

    // Сначала пробуем распознать как скриншот
    const screenshotData = await analyzeScreenshotWithAI(base64);

    if (screenshotData.status === "SUCCESS" && screenshotData.type !== "UNKNOWN") {
        await sendConfirmationMessage(ctx, {
            type: screenshotData.type,
            data: screenshotData.metrics,
            description: screenshotData.description
        });
    } else {
        // Пробуем распознать как еду
        const foodData = await analyzeFoodWithAI(base64, ctx.message.caption);

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

    const parsedData = await analyzeTextWithAI(text);
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
          const parsedData = await analyzeTextWithAI(`Корректировка показателей. Предыдущее состояние: ${previousData}. Правки пользователя: "${text}". Пересчитай показатели заново и верни JSON.`);

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

  // Обычный анализ
  await ctx.reply(t(lang, 'Processing.textWait'));
  try {
      const parsedData = await analyzeTextWithAI(text);
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
        if (cached.date_offset_days) {
            date = new Date(Date.now() + Number(cached.date_offset_days) * 86400000);
        }

        if (cached.type === "NUTRITION") {
            await saveFoodLog(user.id, cached.data);
            
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

        if (!latestAiRec) {
            return ctx.reply(t(lang, 'Checklist.emptyTitle'));
        }

        const recommendedTests = (latestAiRec.raw_data as any)?.recommendedTests || [];
        if (recommendedTests.length === 0) {
             return ctx.reply(t(lang, 'Checklist.emptyTests'));
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

bot.action('main_menu', async (ctx: any) => {
    ctx.answerCbQuery();
    const user = ctx.state.user;
    const lang = ctx.state.lang || 'ru';
    if (!user) return ctx.reply(t(lang, 'Auth.notLinked'));
    await sendWelcomeMenu(ctx, user);
});

// Утреннее напоминание (Cron запускается каждый час в 00 минут)
cron.schedule('0 * * * *', async () => {
    console.log("[CRON] Проверка утренних напоминаний...");
    const now = new Date();
    try {
        const users = await prisma.user.findMany({
            where: { telegram_id: { not: null } }
        });

        for (const user of users) {
             const userTz = user.timezone || 'Europe/Moscow';
             const lang = (user as any).language || 'ru';
             const userTime = now.toLocaleTimeString('ru-RU', { 
                 timeZone: userTz, 
                 hour: '2-digit', 
                 minute: '2-digit' 
             });

             if (userTime !== '09:00') continue;

             const results = await prisma.test_results.findMany({
                 where: { user_id: user.id },
                 orderBy: { created_at: 'desc' }
             });

             const aiRecs = results.filter((r: any) => r.test_type === 'ai-recommendation');
             if (aiRecs.length === 0) continue;

             const recommendedTests = (aiRecs[0].raw_data as any)?.recommendedTests || [];
             if (recommendedTests.length === 0) continue;

             const incompleteTests = recommendedTests.filter((tid: string) => {
                  const aliases = TEST_ALIASES[tid] || [tid];
                  return !results.some((r: any) => aliases.includes(r.test_type));
             });
             if (incompleteTests.length > 0) {
                  const items = incompleteTests.map((tId: string) => {
                      const testNameObj = TEST_NAMES[tId];
                      const name = testNameObj ? (testNameObj[lang] || testNameObj['ru']) : tId;
                      return `• ${name}`;
                  }).join('\n');

                  await bot.telegram.sendMessage(
                      user.telegram_id!,
                      t(lang, 'Reminders.morningGreeting', { name: user.full_name || (lang === 'en' ? 'Client' : 'клиент'), tests: items }),
                      { parse_mode: 'Markdown' }
                  );
             }
        }
    } catch (error) {
        console.error("[CRON] Ошибка утреннего напоминания:", error);
    }
});

// ----------------------------------------------------
// Вечерний Опрос (Cron в 21:00 ежедневно)
// ----------------------------------------------------
// Периодические задачи: Вечерний Опрос и Отчеты (объединены для оптимизации)
// ----------------------------------------------------
cron.schedule('* * * * *', async () => {
    const now = new Date();

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

             // --- Вечерний Опрос ---
             if (user.reminder_time1 === currentTime || 
                 user.reminder_time2 === currentTime || 
                 user.reminder_time3 === currentTime) {
                 
                 bot.telegram.sendMessage(
                     user.telegram_id!,
                     t(lang, 'Reminders.eveningGreeting', { name: user.full_name || (lang === 'en' ? 'Client' : 'клиент') }),
                     Markup.inlineKeyboard([
                         [Markup.button.callback(lang === 'en' ? '💧 Drank 250ml' : '💧 Выпил 250мл', 'water_250')],
                         [Markup.button.callback(lang === 'en' ? '💧 Drank 500ml' : '💧 Выпил 500мл', 'water_500')],
                         [Markup.button.callback(t(lang, 'Habits.checkBtn'), 'habits_check')]
                     ])
                 );
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
        [Markup.button.callback(t(lang, 'Settings.languageBtn'), 'settings_language')]
    ]));
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
