import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { Telegraf } from "telegraf";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
    log: ['error'],
    datasourceUrl: process.env.DATABASE_URL
});
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

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

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function generateMarathonDailyReport() {
    try {
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

        const participantSummaries = [];
        for (const p of participants) {
            await delay(100); // Small pause to avoid pool saturation
            const nutritionLogs = await prisma.nutritionLog.findMany({
                where: { user_id: p.id, date: { gte: startOfDay, lte: endOfDay } }
            });
            const nutSum: any = {};
            for (const key of Object.keys(NUTRITION_NORMS)) {
                nutSum[key] = nutritionLogs.reduce((s, log: any) => s + Number(log[key] || 0), 0);
            }
            participantSummaries.push(nutSum);
        }

        const nutrientGroups = {
            min: ['trans_fat', 'sugar_fast', 'sodium'],
            balance: ['vitamin_A', 'vitamin_D', 'vitamin_E', 'vitamin_K', 'fat', 'calcium', 'iron', 'zinc', 'selenium', 'iodine', 'phosphorus'],
            max: ['protein', 'fiber', 'omega_3', 'potassium', 'magnesium', 'vitamin_C', 'vitamin_B1', 'vitamin_B2', 'vitamin_B3', 'vitamin_B5', 'vitamin_B6', 'vitamin_B7', 'vitamin_B9', 'vitamin_B12']
        };

        const avgScores: { name: string, pct: number, emoji: string }[] = [];
        for (const [key, config] of Object.entries(NUTRITION_NORMS) as any) {
            const totalSum = participantSummaries.reduce((s, pSum) => s + (pSum[key] || 0), 0);
            const avgVal = totalSum / participants.length;
            const pct = (avgVal / config.norm) * 100;
            const name = NUTRIENT_NAMES[key] || key;
            
            let emoji = '🟢';
            if (nutrientGroups.min.includes(key)) {
                if (pct <= 50) emoji = '🟢';
                else if (pct <= 100) emoji = '🟡';
                else emoji = '🔴';
            } else if (nutrientGroups.balance.includes(key)) {
                if (pct >= 80 && pct <= 115) emoji = '🟢';
                else if (pct < 80) emoji = '🔴';
                else emoji = '🟡';
            } else if (nutrientGroups.max.includes(key)) {
                if (pct >= 85) emoji = '🟢';
                else emoji = '🟡';
            } else continue;

            avgScores.push({ name, pct, emoji });
        }

        avgScores.sort((a, b) => {
            if (a.emoji === '🔴' && b.emoji !== '🔴') return -1;
            if (b.emoji === '🔴' && a.emoji !== '🔴') return 1;
            return a.pct - b.pct;
        });

        const dateStr = yest.toLocaleDateString('ru-RU');
        let report = `📊 **Итоги марафона за ${dateStr}** 🚀\n\nВчера наши участники показали отличные результаты! Вот статистика по группе:\n\n`;

        report += `⚠️ **Топ-5 дефицитов и зон роста**:\n`;
        avgScores.slice(0, 5).forEach((item, index) => {
            report += `${index + 1}. ${item.emoji} **${item.name}**: ~${item.pct.toFixed(0)}% от нормы\n`;
        });

        report += `\n✨ Продолжаем в том же духе! Сегодня отличный день, чтобы побить вчерашние рекорды.`;

        return report;
    } catch (error) {
        console.error("Report generation error:", error);
        return null;
    }
}

async function main() {
    console.log("🚀 Starting manual marathon report distribution (STABILIZED)...");
    try {
        const report = await generateMarathonDailyReport();
        if (!report) {
            console.log("❌ No report generated (no data).");
            return;
        }

        const participants = await prisma.squadParticipant.findMany({
            where: { squad: { is_active: true } },
            include: { user: true }
        });

        for (const p of participants) {
            if (p.user.telegram_id) {
                try {
                    const name = p.user.full_name || 'участник';
                    const personalizedReport = report.replace('Итоги марафона', `${name}, вот итоги марафона`);
                    await bot.telegram.sendMessage(p.user.telegram_id, personalizedReport, { parse_mode: 'Markdown' });
                    console.log(`✅ Sent to ${name}`);
                } catch (e) {
                    console.error(`❌ Failed to send to ${p.user.id}`);
                }
            }
        }
    } catch (e) {
        console.error("Main execution error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
