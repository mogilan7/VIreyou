const fs = require('fs');

let content = fs.readFileSync('scripts/telegram-bot.ts', 'utf8');

// 1. Add recordTopicMentions to import
content = content.replace(
  'import { generateDailyReview, generateNutrientReview } from "../src/lib/assistant/generate";',
  'import { generateDailyReview, generateNutrientReview, recordTopicMentions } from "../src/lib/assistant/generate";'
);

// 2. Fix the first place (user context /report)
// Wait, in /report, it's:
// const [dailyText, nutrientText] = await Promise.all([
//   generateDailyReview(user.id),
//   generateNutrientReview(user.id, false)
// ]);
content = content.replace(
  `    const [dailyText, nutrientText] = await Promise.all([
      generateDailyReview(user.id),
      generateNutrientReview(user.id, false)
    ]);`,
  `    const [dailyResult, nutrientText] = await Promise.all([
      generateDailyReview(user.id),
      generateNutrientReview(user.id, false)
    ]);
    const dailyText = typeof dailyResult === 'string' ? dailyResult : dailyResult.text;`
);

// We need to record mentions after sending. But /report doesn't record mentions natively. Wait, the old code DID record mentions in /report because `generateDailyReview` recorded them! If the user ran /report, it would record.
// If the user wants to record mentions after /report, we should do it. But maybe only /review_test and CRON should record them. Let's record them for /report as well.
content = content.replace(
  `    const combinedText = \`*Ежедневный свод (Сон, Активность, Гидратация)*\\n\\n\${dailyText}\\n\\n---\\n\\n*Нутриентный профиль (Долгосрочные тренды)*\\n\\n\${nutrientText}\`;

    // Remove loading message
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id).catch(() => {});

    console.log(\`[ASSISTANT LOG] User: \${user.id}, Daily + Nutrient Review generated\`);`,
  `    const combinedText = \`*Ежедневный свод (Сон, Активность, Гидратация)*\\n\\n\${dailyText}\\n\\n---\\n\\n*Нутриентный профиль (Долгосрочные тренды)*\\n\\n\${nutrientText}\`;

    // Remove loading message
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id).catch(() => {});

    if (dailyResult && typeof dailyResult === 'object' && dailyResult.contract) {
        await recordTopicMentions(user.id, dailyResult.contract);
    }
    console.log(\`[ASSISTANT LOG] User: \${user.id}, Daily + Nutrient Review generated\`);`
);


// 3. Fix /review_test
content = content.replace(
  `        const { generateDailyReview } = await import('../src/lib/assistant/generate');
        const now = new Date();
        const userTz = user.timezone || 'Europe/Moscow';
        const todayStr = getLocalDate(now, userTz);

        ctx.reply(\`Запрашиваю данные и оцениваю Scheduler...\\n📅 Дата: \${todayStr} (\${userTz})\`);

        const review = await generateDailyReview(user.id);
        await ctx.reply(review, { parse_mode: "HTML" });`,
  `        const { generateDailyReview, recordTopicMentions } = await import('../src/lib/assistant/generate');
        const now = new Date();
        const userTz = user.timezone || 'Europe/Moscow';
        const todayStr = getLocalDate(now, userTz);

        ctx.reply(\`Запрашиваю данные и оцениваю Scheduler...\\n📅 Дата: \${todayStr} (\${userTz})\`);

        const reviewData = await generateDailyReview(user.id);
        await ctx.reply(reviewData.text, { parse_mode: "HTML" });
        if (reviewData.contract) {
            await recordTopicMentions(user.id, reviewData.contract);
        }`
);


// 4. Fix Cron
content = content.replace(
  `                        const review = await generateDailyReview(u.id);
                        await bot.telegram.sendMessage(u.telegram_id!.toString(), review, { parse_mode: "HTML" });
                        
                        await prisma.assistantState.upsert({`,
  `                        const reviewData = await generateDailyReview(u.id);
                        await bot.telegram.sendMessage(u.telegram_id!.toString(), reviewData.text, { parse_mode: "HTML" });
                        if (reviewData.contract) {
                            const { recordTopicMentions } = await import('../src/lib/assistant/generate');
                            await recordTopicMentions(u.id, reviewData.contract);
                        }
                        
                        await prisma.assistantState.upsert({`
);


// 5. Add /clear_topics
content = content.replace(
  `bot.command('review_test', async (ctx: any) => {`,
  `bot.command('clear_topics', async (ctx: any) => {
    const user = ctx.state.user;
    if (!user) return;
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0,0,0,0);
        const res = await prisma.topicMention.deleteMany({
            where: { user_id: user.id, created_at: { gte: startOfDay } }
        });
        ctx.reply(\`Очищено \${res.count} упоминаний за сегодня.\`);
    } catch(e) {
        ctx.reply("Ошибка при очистке");
    }
});

bot.command('review_test', async (ctx: any) => {`
);

fs.writeFileSync('scripts/telegram-bot.ts', content);
