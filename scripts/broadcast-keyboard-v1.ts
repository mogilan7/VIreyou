import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { Telegraf, Markup } from "telegraf";
import { PrismaClient } from "@prisma/client";

const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN is not set.");
    process.exit(1);
}

const bot = new Telegraf(botToken);
const prisma = new PrismaClient();

function getPersistentKeyboard(lang: string = "ru") {
    const isEn = lang === "en";
    return Markup.keyboard([
        [isEn ? "🍽 Log Food" : "🍽 Записать еду", isEn ? "💧 Water +250 ml" : "💧 Вода +250 мл"],
        [isEn ? "📋 Menu" : "📋 Меню", isEn ? "⭐ Subscription" : "⭐ Подписка"]
    ]).resize().persistent();
}

const textRu = `Мы обновили бота 🌿\n\nВнизу теперь четыре кнопки: записать еду, добавить воду, открыть меню и подписку. Кабинет — кнопка слева от поля ввода.\n\nА ещё можно просто писать или наговаривать своими словами: «выпил литр воды», «гулял 30 минут», «спал 7 часов» — бот всё запишет.`;

const textEn = `We updated the bot 🌿\n\nThere are now four quick-access buttons below: log food, add water, open menu, and subscription. Cabinet is the button to the left of the input field.\n\nYou can also simply text or send a voice note in your own words: "drank 1 liter of water", "walked 30 minutes", "slept 7 hours" — the bot will log everything.`;

async function main() {
    const args = process.argv.slice(2);
    const isDryRun = args.includes("--dry-run");
    const targetIdx = args.indexOf("--target");
    const targetTgId = targetIdx !== -1 ? args[targetIdx + 1] : null;

    console.log("=== Broadcast Keyboard v1 ===");
    console.log(`Mode: ${isDryRun ? "DRY-RUN (no messages will be sent)" : (targetTgId ? `SINGLE TARGET (${targetTgId})` : "LIVE BROADCAST")}`);

    const allUsers = await prisma.user.findMany({
        where: {
            telegram_id: targetTgId ? targetTgId : { not: null }
        },
        select: {
            id: true,
            full_name: true,
            telegram_id: true,
            telegram_username: true,
            language: true,
            keyboard_version: true
        }
    });

    const isTest = (u: any) => {
        const tg = (u.telegram_id || "").toLowerCase();
        const un = (u.telegram_username || "").toLowerCase();
        const fn = (u.full_name || "").toLowerCase();
        return tg.includes("test") || tg.includes("unknown") || un.includes("test_val") || fn.includes("test_val");
    };

    const eligible = allUsers.filter(u => {
        if (!u.telegram_id) return false;
        if (targetTgId) return u.telegram_id === targetTgId;
        if (isTest(u)) return false;
        return u.keyboard_version === null || u.keyboard_version < 1;
    });

    console.log(`\nFound ${eligible.length} recipient(s):\n`);
    eligible.forEach((u, i) => {
        console.log(` ${i + 1}. [id: ${u.id}] ${u.full_name || "Без имени"} (@${u.telegram_username || "no_username"}) [tg_id: ${u.telegram_id}] [lang: ${u.language || "ru"}]`);
    });

    if (isDryRun) {
        console.log("\n[DRY-RUN COMPLETE] No messages were sent.");
        await prisma.$disconnect();
        return;
    }

    if (!targetTgId && !args.includes("--send-all")) {
        console.log("\n[SAFETY GUARD] To broadcast to ALL users, provide the --send-all flag.");
        console.log("To send a test message to a single user: npx tsx scripts/broadcast-keyboard-v1.ts --target <telegram_id>");
        await prisma.$disconnect();
        return;
    }

    console.log(`\nStarting send to ${eligible.length} user(s)...\n`);
    let sentCount = 0;
    let blockedCount = 0;
    let errorCount = 0;

    for (const u of eligible) {
        const lang = u.language === "en" ? "en" : "ru";
        const messageText = lang === "en" ? textEn : textRu;
        const keyboard = getPersistentKeyboard(lang);

        try {
            await bot.telegram.sendMessage(u.telegram_id!, messageText, {
                reply_markup: keyboard.reply_markup
            });

            await prisma.user.update({
                where: { id: u.id },
                data: { keyboard_version: 1 }
            });

            sentCount++;
            console.log(`[SUCCESS] Sent to ${u.full_name} (${u.telegram_id})`);
        } catch (err: any) {
            const errDesc = err?.response?.description || err?.message || String(err);
            if (err?.response?.error_code === 403 || errDesc.includes("bot was blocked") || errDesc.includes("user is deactivated")) {
                blockedCount++;
                console.warn(`[BLOCKED 403] User ${u.full_name} (${u.telegram_id}) blocked the bot. Skipping.`);
            } else {
                errorCount++;
                console.error(`[ERROR] Failed to send to ${u.full_name} (${u.telegram_id}):`, errDesc);
            }
        }

        // 100ms pause
        await new Promise(r => setTimeout(r, 100));
    }

    console.log("\n=== Broadcast Summary ===");
    console.log(`Successfully sent: ${sentCount}`);
    console.log(`Blocked (403):     ${blockedCount}`);
    console.log(`Errors:            ${errorCount}`);

    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error("Fatal error:", e);
    await prisma.$disconnect();
    process.exit(1);
});
