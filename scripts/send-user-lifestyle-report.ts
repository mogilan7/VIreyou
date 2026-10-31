import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { Telegraf } from "telegraf";
import prisma from "../src/lib/prisma";
import { generatePeriodicReport } from "../src/lib/reportGenerator";

const args = process.argv.slice(2).filter(a => !a.includes("dotenv_config_path") && !a.startsWith("-"));
const targetEmail = args[0] || "cleverval23@gmail.com";

async function main() {
  console.log(`[REPORT] Поиск пользователя: ${targetEmail}...`);
  
  const user = await prisma.user.findFirst({
    where: { email: { equals: targetEmail, mode: "insensitive" } }
  });

  if (!user) {
    throw new Error(`Пользователь с email ${targetEmail} не найден в базе данных!`);
  }

  if (!user.telegram_id) {
    throw new Error(`У пользователя ${user.full_name || targetEmail} нет привязанного telegram_id!`);
  }

  console.log(`[REPORT] Пользователь найден: ${user.full_name || "Без имени"} (ID: ${user.id}, telegram_id: ${user.telegram_id})`);
  
  const days = 7;
  const lang = (user as any).language || "ru";
  console.log(`[REPORT] Генерация отчета образа жизни за ${days} дней (язык: ${lang})...`);
  
  const report = await generatePeriodicReport(user.id, days, user.full_name || undefined, undefined, lang);
  console.log(`[REPORT] Отчет сгенерирован, длина: ${report.markdown.length} символов.`);

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN не задан в переменных окружения!");
  }

  const bot = new Telegraf(botToken);

  console.log(`[REPORT] Отправка отчета в Telegram пользователю ${user.telegram_id}...`);
  let sentMessage;
  try {
    sentMessage = await bot.telegram.sendMessage(user.telegram_id, report.markdown, {
      parse_mode: "Markdown"
    });
    console.log(`[REPORT] ✅ Отчет успешно доставлен (Markdown, message_id: ${sentMessage.message_id})`);
  } catch (err: any) {
    console.warn(`[REPORT] ⚠️ Не удалось отправить с parse_mode=Markdown (${err?.message}). Пробуем обычным текстом...`);
    sentMessage = await bot.telegram.sendMessage(user.telegram_id, report.markdown);
    console.log(`[REPORT] ✅ Отчет успешно доставлен обычным текстом (message_id: ${sentMessage.message_id})`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { last_report_date: new Date() } as any
  });
  console.log(`[REPORT] Поле last_report_date обновлено.`);
}

main()
  .then(() => {
    console.log("[REPORT] Завершено успешно.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[REPORT] ❌ Ошибка выполнения:", err);
    process.exit(1);
  });
