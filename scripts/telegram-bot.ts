import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import fs from "fs";
import path from "path";
import cron from "node-cron";
import prisma from "../src/lib/prisma";
import { analyzeFoodWithAI, analyzeScreenshotWithAI, transcribeVoiceWithAI } from "../src/lib/telegram/ai-services";


const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  console.error("TELEGRAM_BOT_TOKEN is not set in .env");
  process.exit(1);
}

const bot = new Telegraf(botToken);

/**
 * Скачивает файл по его TG file_id.
 */
async function downloadTelegramFile(fileId: string, destPath: string) {
  const fileLink = await bot.telegram.getFileLink(fileId);
  const response = await axios({
    url: fileLink.href,
    method: 'GET',
    responseType: 'stream',
  });

  return new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

/**
 * Вспомогательный хелпер для конвертации файла в base64.
 */
function fileToBase64(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return buffer.toString("base64");
}

// ----------------------------------------------------
// Middleware: Проверка авторизации
// ----------------------------------------------------
bot.use(async (ctx: any, next) => {
  const tgId = ctx.from?.id.toString();
  
  if (tgId) {
    const user = await prisma.user.findFirst({
      where: { telegram_id: tgId },
    });
    if (user) {
      ctx.state.user = user;
    }
  }

  if (ctx.message && ctx.message.text && ctx.message.text.startsWith('/start')) {
    return next(); // Разрешаем /start
  }

  if (!ctx.state.user) {
    return ctx.reply("⚠️ Вы не привязали свой аккаунт. Пожалуйста, отправьте команду `/start <ваш_email>` или привяжите Telegram в личном кабинете на сайте.");
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
         return sendWelcomeMenu(ctx, user);
    }
    return ctx.reply("👋 Привет! Я твой ассистент по долголетию.\n\nЧтобы привязать аккаунт, отправь команду:\n`/start ваш_email@example.com` или привяжи меня в личном кабинете на платформе.");
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return ctx.reply("❌ Пользователь с таким email не найден на платформе.");
    }

    const updatedUser = await prisma.user.update({
      where: { email },
      data: { telegram_id: ctx.from.id.toString() },
    });

    ctx.reply("✅ Аккаунт привязан успешно!");
    sendWelcomeMenu(ctx, updatedUser);
  } catch (error) {
    console.error("Start command error:", error);
    ctx.reply("❌ Произошла ошибка при авторизации.");
  }
});

// Вспомогательная функция для отображения меню
async function sendWelcomeMenu(ctx: any, user: any) {
  const imagePath = path.join(__dirname, '../public/bot_assistant_avatar.png');
  const caption = `🧬 **Главное меню**\n\nРад Вас видеть, ${user.full_name || 'клиент'}!\nЯ помогу Вам контролировать образ жизни для достижения максимального долголетия.\n\n Выберите раздел:`;

  try {
      if (fs.existsSync(imagePath)) {
          await ctx.replyWithPhoto({ source: fs.createReadStream(imagePath) }, {
              caption: caption,
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                  [Markup.button.callback('🍎 Анализ питания', 'menu_nutrition')],
                  [Markup.button.callback('🏃‍♂️ Физическая активность', 'menu_activity')],
                  [Markup.button.callback('🛌 Анализ сна', 'menu_sleep')],
                  [Markup.button.callback('🚭 Вредные привычки', 'menu_habits')],
                  [Markup.button.callback('⚙️ Настройки', 'menu_settings')]
              ])
          });
      } else {
           await ctx.reply(caption, {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                  [Markup.button.callback('🍎 Анализ питания', 'menu_nutrition')],
                  [Markup.button.callback('🏃‍♂️ Физическая активность', 'menu_activity')],
                  [Markup.button.callback('🛌 Анализ сна', 'menu_sleep')],
                  [Markup.button.callback('🚭 Вредные привычки', 'menu_habits')],
                  [Markup.button.callback('⚙️ Настройки', 'menu_settings')]
              ])
          });
      }
  } catch (err) {
      console.error("Send Menu error:", err);
  }
}


// ----------------------------------------------------
// Обработка ФОТО (Еда или Скриншоты)
// ----------------------------------------------------
bot.on('photo', async (ctx: any) => {
  const photo = ctx.message.photo[ctx.message.photo.length - 1]; // Самое большое
  const tempPath = path.join('/tmp', `photo_${photo.file_id}.jpg`);

  await ctx.reply("⏳ Фото получено, анализирую...");

  try {
    await downloadTelegramFile(photo.file_id, tempPath);
    const base64 = fileToBase64(tempPath);

    // Сначала пробуем распознать как скриншот
    const screenshotData = await analyzeScreenshotWithAI(base64);

    if (screenshotData.status === "SUCCESS" && screenshotData.type !== "UNKNOWN") {
      // Это скриншот показателей
      const user = ctx.state.user;
      
      if (screenshotData.type === "SLEEP") {
          await prisma.sleepLog.create({
              data: {
                  user_id: user.id,
                  duration_hrs: screenshotData.metrics.duration_hrs,
                  deep_hrs: screenshotData.metrics.deep_hrs,
                  rem_hrs: screenshotData.metrics.rem_hrs,
                  notes: screenshotData.description,
              }
          });
          ctx.reply(`📊 Обнаружен скриншот сна!\n\n💤 Длительность: ${screenshotData.metrics.duration_hrs || 0}ч\n🔴 Глубокий: ${screenshotData.metrics.deep_hrs || 0}ч\n🔵 REM: ${screenshotData.metrics.rem_hrs || 0}ч\n\n📝 ${screenshotData.description}\n✅ Сохранено в журнал.`);
      } else if (screenshotData.type === "ACTIVITY") {
          await prisma.activityLog.create({
              data: {
                  user_id: user.id,
                  steps: screenshotData.metrics.steps,
                  active_minutes: screenshotData.metrics.active_minutes,
                  calories_burned: screenshotData.metrics.calories_burned,
                  notes: screenshotData.description,
              }
          });
          ctx.reply(`🏃‍♂️ Обнаружен скриншот активности!\n\n👣 Шаги: ${screenshotData.metrics.steps || 0}\n🔥 Калории: ${screenshotData.metrics.calories_burned || 0}\n⏱ Активные минуты: ${screenshotData.metrics.active_minutes || 0}\n\n📝 ${screenshotData.description}\n✅ Сохранено в журнал.`);
      }
    } else {
        // Пробуем распознать как еду
        const foodData = await analyzeFoodWithAI(base64, ctx.message.caption);

        if (foodData.status === "SUCCESS") {
            const user = ctx.state.user;
            await prisma.nutritionLog.create({
                data: {
                    user_id: user.id,
                    calories: foodData.calories,
                    protein: foodData.protein,
                    carbs: foodData.carbs,
                    fat: foodData.fat,
                    fiber: foodData.fiber,
                    vitamins_minerals: foodData.vitamins_minerals,
                    description: foodData.description,
                }
            });

            ctx.reply(`🍎 Проанализировал ваше блюдо:\n\n🔥 Калории: ${foodData.calories} ккал\n🥩 Белки: ${foodData.protein}г\n🍞 Углеводы: ${foodData.carbs}г\n🥑 Жиры: ${foodData.fat}г\n🥬 Клетчатка: ${foodData.fiber || 0}г\n\n📝 ${foodData.description}\n\n✅ Данные сохранены!`);
        } else {
            ctx.reply("🤔 Извините, я не уверен, что это еда или скриншот фитнес-приложений. Пожалуйста, опишите текстом или голосом.");
        }
    }
  } catch (error) {
    console.error("Photo Error:", error);
    ctx.reply("❌ Ошибка при обработке фото ИИ. Попробуйте еще раз.");
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
});

// ----------------------------------------------------
// Обработка ГОЛОСА
// ----------------------------------------------------
bot.on('voice', async (ctx: any) => {
  const voice = ctx.message.voice;
  const tempPath = path.join('/tmp', `voice_${voice.file_id}.ogg`);

  await ctx.reply("🎙️ Запись скачивается, расшифровываю...");

  try {
    await downloadTelegramFile(voice.file_id, tempPath);
    const text = await transcribeVoiceWithAI(tempPath);

    await ctx.reply(`📝 Расшифровка: "${text}"\n\n⏳ Анализирую состав...`);

    const foodData = await analyzeFoodWithAI(undefined, text);

    if (foodData.status === "SUCCESS") {
        const user = ctx.state.user;
        await prisma.nutritionLog.create({
            data: {
                user_id: user.id,
                calories: foodData.calories,
                protein: foodData.protein,
                carbs: foodData.carbs,
                fat: foodData.fat,
                fiber: foodData.fiber,
                vitamins_minerals: foodData.vitamins_minerals,
                description: foodData.description,
            }
        });

        ctx.reply(`🍎 Распознал описание:\n\n🔥 Калории: ${foodData.calories} ккал\n🥩 Белки: ${foodData.protein}г\n🍞 Углеводы: ${foodData.carbs}г\n🥑 Жиры: ${foodData.fat}г\n🥬 Клетчатка: ${foodData.fiber || 0}г\n\n📝 ${foodData.description}\n\n✅ Сохранено!`);
    } else {
        ctx.reply("🤔 Не удалось распознать еду из голосового сообщения. Попробуйте сформулировать иначе.");
    }

  } catch (error) {
    console.error("Voice Error:", error);
    ctx.reply("❌ Ошибка при обработке голоса.");
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
});

// ----------------------------------------------------
// Обработка ТЕКСТА
// ----------------------------------------------------
bot.on('text', async (ctx: any) => {
  const text = ctx.message.text;

  await ctx.reply("⏳ Анализирую состав блюда...");

  try {
    const foodData = await analyzeFoodWithAI(undefined, text);

    if (foodData.status === "SUCCESS") {
        const user = ctx.state.user;
        await prisma.nutritionLog.create({
            data: {
                user_id: user.id,
                calories: foodData.calories,
                protein: foodData.protein,
                carbs: foodData.carbs,
                fat: foodData.fat,
                fiber: foodData.fiber,
                vitamins_minerals: foodData.vitamins_minerals,
                description: foodData.description,
            }
        });

        ctx.reply(`🍎 Распознал описание:\n\n🔥 Калории: ${foodData.calories} ккал\n🥩 Белки: ${foodData.protein}г\n🍞 Углеводы: ${foodData.carbs}г\n🥑 Жиры: ${foodData.fat}г\n🥬 Клетчатка: ${foodData.fiber || 0}г\n\n📝 ${foodData.description}\n\n✅ Сохранено!`);
    } else {
        ctx.reply("🤔 Не уверен, что это описание еды. Пожалуйста, отправьте фото или более подробное описание.");
    }
  } catch (error) {
    console.error("Text Error:", error);
    ctx.reply("❌ Ошибка при обработке текста.");
  }
});

// ----------------------------------------------------
// Вечерний Опрос (Cron в 21:00 ежедневно)
// ----------------------------------------------------
cron.schedule('* * * * *', async () => {
    // Получаем текущее время в формате HH:MM по Москве
    const now = new Date();
    const currentTime = now.toLocaleTimeString('ru-RU', { 
        timeZone: 'Europe/Moscow', 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    try {
        const users = await prisma.user.findMany({
            where: {
                telegram_id: { not: null },
                OR: [
                    { reminder_time1: currentTime },
                    { reminder_time2: currentTime },
                    { reminder_time3: currentTime }
                ]
            }
        });


        for (const user of users) {
             bot.telegram.sendMessage(
                 user.telegram_id!,
                 `🌙 Добрый вечер, ${user.full_name || 'клиент'}!\nПожалуйста, отметьте водный режим и привычки за текущий день.`,
                 Markup.inlineKeyboard([
                     [Markup.button.callback('💧 Выпил 250мл', 'water_250')],
                     [Markup.button.callback('💧 Выпил 500мл', 'water_500')],
                     [Markup.button.callback('🚭 Отметить вредные привычки', 'habits_check')]
                 ])
             );
        }
    } catch (error) {
        console.error("[CRON] Ошибка опроса:", error);
    }
});

// Обработчики кнопок
bot.action('water_250', async (ctx: any) => {
    // В inline-кнопках ctx.from.id — это тот, кто нажал
    const user = await prisma.user.findFirst({ where: { telegram_id: ctx.from.id.toString() } });
    if (!user) return ctx.answerCbQuery("Пользователь не найден.");
    
    await prisma.hydrationLog.create({
        data: { user_id: user.id, volume_ml: 250 }
    });
    ctx.answerCbQuery("✅ +250мл успешно сохранено!");
    ctx.reply("💧 Отлично! Выпито +250мл.");
});

bot.action('water_500', async (ctx: any) => {
    const user = await prisma.user.findFirst({ where: { telegram_id: ctx.from.id.toString() } });
    if (!user) return ctx.answerCbQuery("Пользователь не найден.");
    
    await prisma.hydrationLog.create({
        data: { user_id: user.id, volume_ml: 500 }
    });
    ctx.answerCbQuery("✅ +500мл успешно сохранено!");
    ctx.reply("💧 Отлично! Выпито +500мл.");
});

bot.action('habits_check', async (ctx: any) => {
    ctx.answerCbQuery();
    ctx.reply("🚭 Пожалуйста, напишите текстом или голосом, какие привычки вы хотите отметить (например, 'курил сегодня' или 'без алкоголя').");
});

bot.action('menu_nutrition', async (ctx: any) => {
    ctx.answerCbQuery();
    ctx.reply("🍎 **Анализ питания**\n\nОтправьте мне **фото блюда**, текстовое или голосовое описание.\n\nЯ рассчитаю калории, БЖУ, клетчатку и микроэлементы!");
});

bot.action('menu_activity', async (ctx: any) => {
    ctx.answerCbQuery();
    ctx.reply("🏃‍♂️ **Физическая активность**\n\nОтправьте мне **скриншот** активности или опишите тренировку словами.");
});

bot.action('menu_sleep', async (ctx: any) => {
    ctx.answerCbQuery();
    ctx.reply("🛌 **Анализ сна**\n\nПришлите **скриншот** фаз сна или напишите о вашем отдыхе текстом.");
});

bot.action('menu_habits', async (ctx: any) => {
    ctx.answerCbQuery();
    ctx.reply("🚭 **Вредные привычки**\n\nОпишите ваши успехи или отказы сегодня. Например: 'Сегодня без сладкого и алкоголя'.");
});

bot.action('menu_settings', async (ctx: any) => {
    ctx.answerCbQuery();
    ctx.reply("⚙️ **Настройки напоминаний**\n\nВыберите количество напоминаний в день, которые вы хотите получать (по времени Москвы):", Markup.inlineKeyboard([
        [Markup.button.callback('1️⃣ Одно время', 'set_count_1')],
        [Markup.button.callback('2️⃣ Два времени', 'set_count_2')],
        [Markup.button.callback('3️⃣ Три времени', 'set_count_3')],
        [Markup.button.callback('📵 Выключить', 'set_count_0')]
    ]));
});

// --- Обработчики Настроек ---

bot.action('set_count_1', async (ctx: any) => {
    ctx.answerCbQuery();
    ctx.reply("🕒 Выберите время для напоминания:", Markup.inlineKeyboard([
        [Markup.button.callback('09:00', 'save_time_1_0900'), Markup.button.callback('18:00', 'save_time_1_1800')],
        [Markup.button.callback('21:00', 'save_time_1_2100'), Markup.button.callback('22:00', 'save_time_1_2200')]
    ]));
});

bot.action('set_count_2', async (ctx: any) => {
    ctx.answerCbQuery();
    ctx.reply("🕒 Выберите комбинацию времени:", Markup.inlineKeyboard([
        [Markup.button.callback('09:00 и 21:00', 'save_time_2_preset1')],
        [Markup.button.callback('10:00 и 20:00', 'save_time_2_preset2')]
    ]));
});

bot.action('set_count_3', async (ctx: any) => {
    ctx.answerCbQuery();
    ctx.reply("🕒 Выберите комбинацию времени:", Markup.inlineKeyboard([
        [Markup.button.callback('09:00, 15:00 и 21:00', 'save_time_3_preset1')],
        [Markup.button.callback('08:00, 14:00 и 20:00', 'save_time_3_preset2')]
    ]));
});

bot.action('set_count_0', async (ctx: any) => {
    const user = ctx.state.user;
    await prisma.user.update({
        where: { id: user.id },
        data: { reminder_time1: null, reminder_time2: null, reminder_time3: null }
    });
    ctx.answerCbQuery();
    ctx.reply("🔕 Напоминания выключены. Вся информация собирается при ваших ручных отправках фото/текста.");
});

// Сохранение Пресетов
const presetSave = async (ctx: any, t1: string | null, t2: string | null, t3: string | null, text: string) => {
    const user = ctx.state.user;
    try {
        await prisma.user.update({
            where: { id: user.id },
            data: { reminder_time1: t1, reminder_time2: t2, reminder_time3: t3 }
        });
        ctx.answerCbQuery();
        ctx.reply(`✅ **Настройки сохранены!**\n\n${text}`);
    } catch (e) {
        console.error("Save time error:", e);
        ctx.reply("❌ Ошибка при сохранении настроек.");
    }
};

bot.action('save_time_1_0900', (ctx: any) => presetSave(ctx, "09:00", null, null, "Напоминание установлено на **09:00**"));
bot.action('save_time_1_1800', (ctx: any) => presetSave(ctx, "18:00", null, null, "Напоминание установлено на **18:00**"));
bot.action('save_time_1_2100', (ctx: any) => presetSave(ctx, "21:00", null, null, "Напоминание установлено на **21:00**"));
bot.action('save_time_1_2200', (ctx: any) => presetSave(ctx, "22:00", null, null, "Напоминание установлено на **22:00**"));

bot.action('save_time_2_preset1', (ctx: any) => presetSave(ctx, "09:00", "21:00", null, "Напоминания установлены на **09:00** и **21:00**"));
bot.action('save_time_2_preset2', (ctx: any) => presetSave(ctx, "10:00", "20:00", null, "Напоминания установлены на **10:00** и **20:00**"));

bot.action('save_time_3_preset1', (ctx: any) => presetSave(ctx, "09:00", "15:00", "21:00", "Напоминания установлены на **09:00**, **15:00** и **21:00**"));
bot.action('save_time_3_preset2', (ctx: any) => presetSave(ctx, "08:00", "14:00", "20:00", "Напоминания установлены на **08:00**, **14:00** и **20:00**"));


// Запуск

console.log("Starting Telegram Bot (Long Polling)...");
bot.launch().then(() => {
    console.log("✅ Bot is polling for updates");
}).catch(err => {
    console.error("Bot launch failed:", err);
});

// Обеспечиваем корректное завершение
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
