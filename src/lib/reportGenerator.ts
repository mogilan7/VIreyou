/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";

export const NUTRITION_NORMS: any = {
    protein: { norm: 80, unit: 'г' },
    fat: { norm: 70, unit: 'г' },
    carbs: { norm: 250, unit: 'г' },
    fiber: { norm: 30, unit: 'г' },
    sugar_fast: { norm: 50, unit: 'г' },
    trans_fat: { norm: 2, unit: 'г' },
    cholesterol: { norm: 300, unit: 'мг' },
    omega_3: { norm: 1.6, unit: 'г' },
    omega_6: { norm: 17, unit: 'г' },
    vitamin_A: { norm: 900, unit: 'мкг' }, vitamin_D: { norm: 15, unit: 'мкг' }, vitamin_E: { norm: 15, unit: 'мг' }, vitamin_K: { norm: 120, unit: 'мкг' },
    vitamin_B1: { norm: 1.2, unit: 'мг' }, vitamin_B2: { norm: 1.3, unit: 'мг' }, vitamin_B3: { norm: 16, unit: 'мг' }, vitamin_B5: { norm: 5, unit: 'мг' },
    vitamin_B6: { norm: 1.3, unit: 'мг' }, vitamin_B7: { norm: 30, unit: 'мкг' }, vitamin_B9: { norm: 400, unit: 'мкг' }, vitamin_B12: { norm: 2.4, unit: 'мкг' },
    vitamin_C: { norm: 90, unit: 'мг' }, calcium: { norm: 1000, unit: 'мг' }, iron: { norm: 12, unit: 'мг' }, magnesium: { norm: 400, unit: 'мг' },
    phosphorus: { norm: 700, unit: 'мг' }, potassium: { norm: 4700, unit: 'мг' }, sodium: { norm: 1500, unit: 'мг' }, zinc: { norm: 11, unit: 'мг' },
    copper: { norm: 0.9, unit: 'мг' }, manganese: { norm: 2.3, unit: 'мг' }, selenium: { norm: 55, unit: 'мкг' }, iodine: { norm: 150, unit: 'мкг' }
};

export const NUTRIENT_NAMES: any = {
    protein: 'Белки', fat: 'Жиры', carbs: 'Углеводы', fiber: 'Клетчатка',
    sugar_fast: 'Простые углеводы', trans_fat: 'Трансжиры', cholesterol: 'Холестерин',
    omega_3: 'Омега-3', omega_6: 'Омега-6',
    vitamin_A: 'Витамин A', vitamin_D: 'Витамин D', vitamin_E: 'Витамин E', vitamin_K: 'Витамин K',
    vitamin_B1: 'Витамин B1', vitamin_B2: 'Витамин B2', vitamin_B3: 'Витамин B3',
    vitamin_B5: 'Витамин B5', vitamin_B6: 'Витамин B6', vitamin_B7: 'Витамин B7',
    vitamin_B9: 'Витамин B9', vitamin_B12: 'Витамин B12', vitamin_C: 'Витамин C',
    calcium: 'Кальций', iron: 'Железо', magnesium: 'Магний', phosphorus: 'Фосфор',
    potassium: 'Калий', sodium: 'Натрий', zinc: 'Цинк', copper: 'Медь',
    manganese: 'Марганец', selenium: 'Селен', iodine: 'Йод',
    calories: 'Калории'
};

export async function generatePeriodicReport(userId: string, days: number = 7, clientName?: string, selectedDates?: string[]) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");
    const userTz = user.timezone || 'Europe/Moscow';

    // Helper to find exact UTC time for midnight in the user's timezone
    const getTzMidnightUTC = (dateStr: string | null, offsetDays: number, isEnd: boolean) => {
        const base = dateStr ? new Date(`${dateStr}T12:00:00Z`) : new Date();
        const tzStr = base.toLocaleString('en-US', { timeZone: userTz, hour12: false });
        const tzDate = new Date(tzStr); // parses as server local time
        const offsetMs = tzDate.getTime() - base.getTime();
        
        let midnightUtc = new Date(tzDate.setHours(0, 0, 0, 0) - offsetMs);
        if (offsetDays) midnightUtc = new Date(midnightUtc.getTime() + offsetDays * 86400000);
        if (isEnd) return new Date(midnightUtc.getTime() + 86400000 - 1);
        return midnightUtc;
    };

    // If selectedDates is provided, we use the max and min of those dates for our DB query boundary.
    // Otherwise we use the last `days` days.
    let startDate: Date;
    let endDate: Date;
    
    if (selectedDates && selectedDates.length > 0) {
        const sortedDates = [...selectedDates].sort();
        startDate = getTzMidnightUTC(sortedDates[0], 0, false);
        endDate = getTzMidnightUTC(sortedDates[sortedDates.length - 1], 0, true);
    } else {
        endDate = getTzMidnightUTC(null, 0, true);
        startDate = getTzMidnightUTC(null, -days + 1, false);
    }

    const [nutritionLogs, activityLogs, sleepLogs, hydrationLogs, habitLogs] = await Promise.all([
        prisma.nutritionLog.findMany({ where: { user_id: userId, created_at: { gte: startDate, lte: endDate } } }),
        prisma.activityLog.findMany({ where: { user_id: userId, created_at: { gte: startDate, lte: endDate } } }),
        prisma.sleepLog.findMany({ where: { user_id: userId, created_at: { gte: startDate, lte: endDate } } }),
        prisma.hydrationLog.findMany({ where: { user_id: userId, created_at: { gte: startDate, lte: endDate } } }),
        prisma.habitLog.findMany({ where: { user_id: userId, created_at: { gte: startDate, lte: endDate } } })
    ]);

    // Filter logs if selectedDates is provided
    let filteredNutrition = nutritionLogs;
    let filteredActivity = activityLogs;
    let filteredSleep = sleepLogs;
    let filteredHydration = hydrationLogs;
    let filteredHabits = habitLogs;

    if (selectedDates && selectedDates.length > 0) {
        const isSelected = (dateStr: string | Date | null | undefined) => {
            if (!dateStr) return false;
            // Handle ISO string or Date object securely
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return false;
            const yyyyMmDd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return selectedDates.includes(yyyyMmDd);
        };
        filteredNutrition = nutritionLogs.filter((l: any) => isSelected(l.created_at || l.date));
        filteredActivity = activityLogs.filter((l: any) => isSelected(l.created_at || l.date));
        filteredSleep = sleepLogs.filter((l: any) => isSelected(l.created_at));
        filteredHydration = hydrationLogs.filter((l: any) => isSelected(l.created_at));
        filteredHabits = habitLogs.filter((l: any) => isSelected(l.created_at));
    }

    // Denominator for average and habit calculations
    const denominator = selectedDates && selectedDates.length > 0 ? selectedDates.length : days;

    // --- Aggregation ---

    const nutritionSum: any = { calories: 0 };
    for (const key of Object.keys(NUTRITION_NORMS)) {
        nutritionSum[key] = 0;
    }

    filteredNutrition.forEach((log: any) => {
        nutritionSum.calories += Number(log.calories || 0);
        for (const key of Object.keys(NUTRITION_NORMS)) {
            if (log[key] !== null && log[key] !== undefined) {
                nutritionSum[key] += Number(log[key]);
            }
        }
    });

    const totalSteps = filteredActivity.reduce((sum: number, a: any) => sum + (a.steps || 0), 0);
    const avgSteps = filteredActivity.length > 0 ? totalSteps / denominator : 0;
    const totalCalBurned = filteredActivity.reduce((sum: number, a: any) => sum + (a.calories_burned || 0), 0);

    const avgSleepDuration = filteredSleep.length > 0 
        ? filteredSleep.reduce((sum: number, s: any) => sum + (s.duration_hrs || 0), 0) / denominator 
        : 0;

    const totalWater = filteredHydration.reduce((sum: number, h: any) => sum + (h.volume_ml || 0), 0);
    const avgWater = totalWater / denominator;

    const habitCounts: Record<string, { completed: number, total: number }> = {};
    filteredHabits.forEach((h: any) => {
        if (!habitCounts[h.habit_key]) {
            habitCounts[h.habit_key] = { completed: 0, total: 0 };
        }
        if (h.completed) habitCounts[h.habit_key].completed += 1;
        habitCounts[h.habit_key].total += 1;
    });

    // --- Format Markdown ---
    let markdown = `# 📊 Отчет по образу жизни за ${selectedDates && selectedDates.length > 0 ? selectedDates.length : days} дней\n`;
    markdown += `**ФИО**: ${clientName || user.full_name || "Не указано"}\n`;
    markdown += `**Период**: ${startDate.toLocaleDateString('ru-RU')} — ${endDate.toLocaleDateString('ru-RU')}`;
    if (selectedDates && selectedDates.length > 0) {
        markdown += ` *(выбрано дней: ${selectedDates.length})*`;
    }
    markdown += `\n\n`;

    markdown += `## 📋 Выполнение рекомендаций (Привычки)\n`;
    if (Object.keys(habitCounts).length === 0) {
        markdown += `Данные о привычках не зафиксированы.\n\n`;
    } else {
        for (const [key, counts] of Object.entries(habitCounts)) {
            const pct = (counts.completed / denominator) * 100;
            let emoji = '🔴';
            if (pct >= 80) emoji = '🟢';
            else if (pct >= 50) emoji = '🟡';
            markdown += `${emoji} **${key}**: ${counts.completed} / ${denominator} дн (${pct.toFixed(0)}%)\n`;
        }
        markdown += `\n`;
    }

    markdown += `## 🏃‍♂️ Активность и Сон\n`;
    markdown += `• **Средние шаги/день**: ${avgSteps.toFixed(0)} шагов\n`;
    markdown += `• **Всего сожжено**: ${totalCalBurned.toFixed(0)} ккал\n`;
    markdown += `• **Средний сон**: ${avgSleepDuration.toFixed(1)} ч\n`;
    markdown += `• **Гидратация (ср/день)**: ${avgWater.toFixed(0)} мл\n\n`;

    markdown += `## 🍎 Питание и Микроэлементы\n`;
    markdown += `• **Всего калорий**: ${nutritionSum.calories.toFixed(0)} ккал\n`;
    markdown += `• **Средние калории/день**: ${(nutritionSum.calories / denominator).toFixed(0)} ккал\n\n`;

    markdown += `| Элемент | Всего | Норма за ${days}д | % от нормы |\n`;
    markdown += `|---|---|---|---|\n`;

    for (const [key, config] of Object.entries(NUTRITION_NORMS) as any) {
        const periodNorm = config.norm * days;
        const pct = (nutritionSum[key] / periodNorm) * 100;
        let emoji = '🔴';
        if (pct >= 80) emoji = '🟢';
        else if (pct >= 50) emoji = '🟡';
        markdown += `| ${emoji} ${NUTRIENT_NAMES[key]} | ${nutritionSum[key].toFixed(1)} ${config.unit} | ${periodNorm.toFixed(1)} ${config.unit} | ${pct.toFixed(0)}% |\n`;
    }

    // --- Format JSON ---
    const aiJson = {
        userId,
        userName: user.full_name,
        periodDays: days,
        selectedDatesCount: selectedDates ? selectedDates.length : null,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        metrics: {
            activity: { totalSteps, avgSteps, totalCalBurned },
            sleep: { avgDuration: avgSleepDuration },
            hydration: { totalVolume: totalWater, avgVolume: avgWater },
            nutrition: {
                totalCalories: nutritionSum.calories,
                avgCalories: nutritionSum.calories / denominator,
                totals: nutritionSum,
                norms: NUTRITION_NORMS
            },
            habits: habitCounts
        }
    };

    return {
        markdown,
        json: JSON.stringify(aiJson, null, 2)
    };
}
