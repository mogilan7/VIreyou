/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import { deleteNutritionLog } from './actions';
import LifestyleDashboard from "@/components/dashboard/LifestyleDashboard";

export const dynamic = 'force-dynamic';

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
    vitamin_A: { norm: 900, unit: 'мкг' }, vitamin_D: { norm: 15, unit: 'мкг' }, vitamin_E: { norm: 15, unit: 'мг' }, vitamin_K: { norm: 120, unit: 'мкг' },
    vitamin_B1: { norm: 1.2, unit: 'мг' }, vitamin_B2: { norm: 1.3, unit: 'мг' }, vitamin_B3: { norm: 16, unit: 'мг' }, vitamin_B5: { norm: 5, unit: 'мг' },
    vitamin_B6: { norm: 1.3, unit: 'мг' }, vitamin_B7: { norm: 30, unit: 'мкг' }, vitamin_B9: { norm: 400, unit: 'мкг' }, vitamin_B12: { norm: 2.4, unit: 'мкг' },
    vitamin_C: { norm: 90, unit: 'мг' }, calcium: { norm: 1000, unit: 'мг' }, iron: { norm: 12, unit: 'мг' }, magnesium: { norm: 400, unit: 'мг' },
    phosphorus: { norm: 700, unit: 'мг' }, potassium: { norm: 4700, unit: 'мг' }, sodium: { norm: 1500, unit: 'мг' }, zinc: { norm: 11, unit: 'мг' },
    copper: { norm: 0.9, unit: 'мг' }, manganese: { norm: 2.3, unit: 'мг' }, selenium: { norm: 55, unit: 'мкг' }, iodine: { norm: 150, unit: 'мкг' }
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

export default async function LifestylePage({ searchParams }: { searchParams: Promise<{ from?: string, to?: string }> }) {
    try {
        const resolvedParams = await searchParams;
        const fromStr = resolvedParams.from;
        const toStr = resolvedParams.to;

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return <div className="p-8 text-center text-red-500">Авторизация не удалась.</div>;
        }

        const publicUser = await prisma.user.findUnique({ where: { email: user.email! } });
        const userId = publicUser ? publicUser.id : user.id;

        const userTz = publicUser?.timezone || 'Europe/Moscow';
        
        const getTzMidnightUTC = (dateStr: string | null, offsetDays: number, isEnd: boolean) => {
            const base = dateStr ? new Date(`${dateStr}T12:00:00Z`) : new Date();
            const tzStr = base.toLocaleString('en-US', { timeZone: userTz, hour12: false });
            const tzDate = new Date(tzStr); 
            const offsetMs = tzDate.getTime() - base.getTime();
            let midnightUtc = new Date(tzDate.setHours(0, 0, 0, 0) - offsetMs);
            if (offsetDays) midnightUtc = new Date(midnightUtc.getTime() + offsetDays * 86400000);
            if (isEnd) return new Date(midnightUtc.getTime() + 86400000 - 1);
            return midnightUtc;
        };

        // Фиксация дат для фильтрации
        let fromDate = getTzMidnightUTC(fromStr || null, 0, false);
        let toDate = getTzMidnightUTC(toStr || null, 0, true);
        const weekAgo = getTzMidnightUTC(null, -7, false);
        const monthAgo = getTzMidnightUTC(null, -30, false);

        // Fetch Logs from Prisma
        const [
            nutritionToday, activityToday, sleepToday, hydrationToday, habitsToday, 
            nutritionWeek, activityWeek, habitsWeek, sleepWeek, hydrationWeek,
            habitsMonth
        ] = await Promise.all([
            prisma.nutritionLog.findMany({ where: { user_id: userId, created_at: { gte: fromDate, lte: toDate } }, orderBy: { created_at: 'desc' } }),
            prisma.activityLog.findMany({ where: { user_id: userId, created_at: { gte: fromDate, lte: toDate } }, orderBy: { created_at: 'desc' } }),
            prisma.sleepLog.findMany({ where: { user_id: userId, created_at: { gte: fromDate, lte: toDate } }, orderBy: { created_at: 'desc' } }),
            prisma.hydrationLog.findMany({ where: { user_id: userId, created_at: { gte: fromDate, lte: toDate } }, orderBy: { created_at: 'desc' } }),
            prisma.habitLog.findMany({ where: { user_id: userId, created_at: { gte: fromDate, lte: toDate } }, orderBy: { created_at: 'desc' } }),
            // Списки за 7 дней
            prisma.nutritionLog.findMany({ where: { user_id: userId, created_at: { gte: weekAgo } }, orderBy: { created_at: 'desc' } }),
            prisma.activityLog.findMany({ where: { user_id: userId, created_at: { gte: weekAgo } }, orderBy: { created_at: 'desc' } }),
            prisma.habitLog.findMany({ where: { user_id: userId, created_at: { gte: weekAgo } }, orderBy: { created_at: 'desc' } }),
            prisma.sleepLog.findMany({ where: { user_id: userId, created_at: { gte: weekAgo } }, orderBy: { created_at: 'desc' } }),
            prisma.hydrationLog.findMany({ where: { user_id: userId, created_at: { gte: weekAgo } }, orderBy: { created_at: 'desc' } }),
            // Список за 30 дней для тепловой карты
            prisma.habitLog.findMany({ where: { user_id: userId, created_at: { gte: monthAgo } }, orderBy: { created_at: 'asc' } })
        ]);

        // Calculate Aggregates
        const totalWater = hydrationToday.reduce((acc: number, h: any) => acc + h.volume_ml, 0);
        const lastSleep = sleepToday[0];
        const lastActivity = activityToday[0];
        const totalCalories = nutritionToday.reduce((sum: number, n: any) => sum + Number(n.calories || 0), 0);
        const totalSteps = activityToday.reduce((sum: number, a: any) => sum + (a.steps || 0), 0);

        const data = {
            nutritionToday, activityToday, sleepToday, hydrationToday, habitsToday,
            nutritionWeek, activityWeek, habitsWeek, sleepWeek, hydrationWeek,
            habitsMonth,
            totalWater, lastSleep, lastActivity, totalCalories, totalSteps,
            nutritionNorms: NUTRITION_NORMS,
            nutrientNames: NUTRIENT_NAMES
        }

        return (
            <LifestyleDashboard 
                data={data}
                userMetadata={user?.user_metadata}
                userTz={userTz}
                deleteNutritionLog={deleteNutritionLog}
                fromStr={fromStr}
                toStr={toStr}
                currentFromDate={fromDate}
            />
        );
    } catch (err: any) {
        return <div className="p-8 text-center text-red-500">Ошибка: {err.message}</div>;
    }
}
