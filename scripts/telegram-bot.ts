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

  let name = 'клиент';
  try {
      const profile = await prisma.profiles.findUnique({ where: { id: user.id } });
      if (profile?.full_name) {
          name = profile.full_name;
      } else if (user.full_name) {
          name = user.full_name;
      }
  } catch (e) {
      console.log("Profile fetch failed:", e);
  }

  const caption = `🧬 **Главное меню**\n\nРад Вас видеть, ${name}!\nЯ помогу Вам контролировать образ жизни для достижения максимального долголетия.\n\n Выберите раздел:`;

  try {
      if (fs.existsSync(imagePath)) {
          await ctx.replyWithPhoto({ source: fs.createReadStream(imagePath) }, {
              caption: caption,
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                  [Markup.button.callback('🍎 Анализ питания', 'menu_nutrition')],
                  [Markup.button.callback('🏃‍♂️ Физическая активность', 'menu_activity')],
                  [Markup.button.callback('🛌 Анализ сна', 'menu_sleep')],
                  [Markup.button.callback('💧 Вода', 'menu_water')],
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
                  [Markup.button.callback('💧 Вода', 'menu_water')],
                  [Markup.button.callback('🚭 Вредные привычки', 'menu_habits')],
                  [Markup.button.callback('⚙️ Настройки', 'menu_settings')]
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
  return prisma.nutritionLog.create({ data });
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
            await saveFoodLog(user.id, foodData);

            ctx.reply(`🍎 Проанализировал блюдо: **${foodData.dish || 'Без названия'}** (${foodData.grams || '?'}г):\n\n🔥 Калории: ${foodData.calories} ккал\n🥩 Белки: ${foodData.protein}г\n🍞 Углеводы: ${foodData.carbs}г\n🥑 Жиры: ${foodData.fat}г\n🥬 Клетчатка: ${foodData.fiber || 0}г\n\n📝 ${foodData.description}\n\n✅ Данные сохранены!`);
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
        await saveFoodLog(user.id, foodData);

        ctx.reply(`🍎 Распознал описание для: **${foodData.dish || 'Без названия'}** (${foodData.grams || '?'}г):\n\n🔥 Калории: ${foodData.calories} ккал\n🥩 Белки: ${foodData.protein}г\n🍞 Углеводы: ${foodData.carbs}г\n🥑 Жиры: ${foodData.fat}г\n🥬 Клетчатка: ${foodData.fiber || 0}г\n\n📝 ${foodData.description}\n\n✅ Сохранено!`);
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

bot.hears(/^(\d+)\s*(мл|ml|миллилитров)$/i, async (ctx: any) => {
    const volume = parseInt(ctx.match[1]);
    const user = ctx.state.user;

    if (!user) return ctx.reply("❌ Пользователь не привязан.");

    await prisma.hydrationLog.create({
        data: { user_id: user.id, volume_ml: volume }
    });

    return ctx.reply(`✅ Записано: **+${volume} мл** выпитой воды! 💦`);
});

bot.on('text', async (ctx: any) => {
  const text = ctx.message.text;

  await ctx.reply("⏳ Анализирую состав блюда...");

  try {
    const foodData = await analyzeFoodWithAI(undefined, text);

    if (foodData.status === "SUCCESS") {
        const user = ctx.state.user;
        await saveFoodLog(user.id, foodData);

        ctx.reply(`🍎 Распознал описание для: **${foodData.dish || 'Без названия'}** (${foodData.grams || '?'}г):\n\n🔥 Калории: ${foodData.calories} ккал\n🥩 Белки: ${foodData.protein}г\n🍞 Углеводы: ${foodData.carbs}г\n🥑 Жиры: ${foodData.fat}г\n🥬 Клетчатка: ${foodData.fiber || 0}г\n\n📝 ${foodData.description}\n\n✅ Сохранено!`);
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
bot.action('menu_water', async (ctx: any) => {
    ctx.answerCbQuery();
    await ctx.reply("💧 **Регистрация воды**\n\nСколько миллилитров (мл) вы выпили?\n\nВыберите из пресетов ниже, либо просто напишите в чат (например: `200мл`).", 
        Markup.inlineKeyboard([
            [Markup.button.callback('💧 250 мл', 'water_250')],
            [Markup.button.callback('💧 500 мл', 'water_500')],
            [Markup.button.callback('💧 750 мл', 'water_750')]
        ])
    );
});

bot.action('water_750', async (ctx: any) => {
    const user = await prisma.user.findFirst({ where: { telegram_id: ctx.from.id.toString() } });
    if (!user) return ctx.answerCbQuery("Пользователь не найден.");
    
    await prisma.hydrationLog.create({
        data: { user_id: user.id, volume_ml: 750 }
    });
    ctx.answerCbQuery("✅ +750мл успешно сохранено!");
    ctx.reply("💧 Отлично! Выпито +750мл.");
});

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

const NUTRITION_NORMS: any = {
    protein: { norm: 80, unit: 'г' },
    fat: { norm: 70, unit: 'г' },
    carbs: { norm: 250, unit: 'г' },
    fiber: { norm: 30, unit: 'г' },
    sugar_fast: { norm: 50, unit: 'г' },
    trans_fat: { norm: 2, unit: 'г' },
    cholesterol: { norm: 300, unit: 'мг' },
    added_sugar: { norm: 50, unit: 'г' },
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
    sugar_fast: 'Быстрый сахар', trans_fat: 'Трансжиры', cholesterol: 'Холестерин',
    added_sugar: 'Добавленный сахар', omega_3: 'Омега-3', omega_6: 'Омега-6',
    vitamin_A: 'Витамин A', vitamin_D: 'Витамин D', vitamin_E: 'Витамин E', vitamin_K: 'Витамин K',
    vitamin_B1: 'Витамин B1', vitamin_B2: 'Витамин B2', vitamin_B3: 'Витамин B3',
    vitamin_B5: 'Витамин B5', vitamin_B6: 'Витамин B6', vitamin_B7: 'Витамин B7',
    vitamin_B9: 'Витамин B9', vitamin_B12: 'Витамин B12', vitamin_C: 'Витамин C',
    calcium: 'Кальций', iron: 'Железо', magnesium: 'Магний', phosphorus: 'Фосфор',
    potassium: 'Калий', sodium: 'Натрий', zinc: 'Цинк', copper: 'Медь',
    manganese: 'Марганец', selenium: 'Селен', iodine: 'Йод'
};

async function generateDailyReport(userId: string) {
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

    let report = `📊 **Отчет по нутриентам за ${today.toLocaleDateString('ru-RU')}**\n\n`;
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

    report += `🔥 **Калории**: ${kbtu.calories.toFixed(1)} ккал\n\n`;

    for (const [key, config] of Object.entries(NUTRITION_NORMS) as any) {
        const pct = (sum[key] / config.norm) * 100;
        let emoji = '🔴';
        if (pct >= 80) emoji = '🟢';
        else if (pct >= 50) emoji = '🟡';
        
        report += `${emoji} **${NUTRIENT_NAMES[key]}**: ${sum[key].toFixed(1)} / ${config.norm} ${config.unit} (${pct.toFixed(0)}%)\n`;
    }

    if (!hasData) {
        report += "Пока нет данных за сегодня. Отправьте фото еды или описание!";
    }

    return report;
}

bot.action('menu_nutrition', async (ctx: any) => {
    ctx.answerCbQuery();
    await ctx.reply("🍎 **Анализ питания**\n\nОтправьте мне **фото блюда**, текстовое или голосовое описание.\n\nЯ рассчитаю калории, БЖУ, клетчатку и микроэлементы!", 
        Markup.inlineKeyboard([
            [Markup.button.callback('📊 Отчет за сегодня', 'get_nutrition_report')]
        ])
    );
});

bot.action('get_nutrition_report', async (ctx: any) => {
    const user = await prisma.user.findFirst({ where: { telegram_id: ctx.from.id.toString() } });
    if (!user) return ctx.answerCbQuery("Пользователь не найден.");
    
    ctx.answerCbQuery();
    const report = await generateDailyReport(user.id);
    ctx.reply(report, { parse_mode: 'Markdown' });
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


bot.catch((err: any, ctx: any) => {
    console.error(`[TelegrafError] for ${ctx.updateType || 'unknown'}:`, err.message || err);
});

// Запуск

console.log("Starting Telegram Bot (Long Polling)...");
bot.launch({ dropPendingUpdates: true }).then(() => {
    console.log("✅ Bot is polling for updates");
}).catch(err => {
    console.error("Bot launch failed:", err);
});

// Обеспечиваем корректное завершение
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
