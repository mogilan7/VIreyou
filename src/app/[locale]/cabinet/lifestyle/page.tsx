/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import Sidebar from "@/components/dashboard/Sidebar";
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import { Apple, Activity, Bed, GlassWater, Cigarette, Flame, ChevronDown } from 'lucide-react';

export const dynamic = 'force-dynamic';

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
    vitamin_A: { norm: 900, unit: 'мкг' }, vitamin_D: { norm: 15, unit: 'мкг' }, vitamin_E: { norm: 15, unit: 'мг' }, vitamin_K: { norm: 120, unit: 'мкг' },
    vitamin_B1: { norm: 1.2, unit: 'мг' }, vitamin_B2: { norm: 1.3, unit: 'мг' }, vitamin_B3: { norm: 16, unit: 'мг' }, vitamin_B5: { norm: 5, unit: 'мг' },
    vitamin_B6: { norm: 1.3, unit: 'мг' }, vitamin_B7: { norm: 30, unit: 'мкг' }, vitamin_B9: { norm: 400, unit: 'мкг' }, vitamin_B12: { norm: 2.4, unit: 'мкг' },
    vitamin_C: { norm: 90, unit: 'мг' }, calcium: { norm: 1000, unit: 'мг' }, iron: { norm: 12, unit: 'мг' }, magnesium: { norm: 400, unit: 'мг' },
    phosphorus: { norm: 700, unit: 'мг' }, potassium: { norm: 4700, unit: 'мг' }, sodium: { norm: 1500, unit: 'мг' }, zinc: { norm: 11, unit: 'мг' },
    copper: { norm: 0.9, unit: 'мг' }, manganese: { norm: 2.3, unit: 'мг' }, selenium: { norm: 55, unit: 'мкг' }, iodine: { norm: 150, unit: 'мкг' }
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

        const userId = user.id;

        // Фиксация дат для фильтрации
        let fromDate = new Date();
        fromDate.setHours(0, 0, 0, 0);
        let toDate = new Date();
        toDate.setHours(23, 59, 59, 999);

        if (fromStr) fromDate = new Date(fromStr);
        if (toStr) {
            toDate = new Date(toStr);
            toDate.setHours(23, 59, 59, 999);
        }

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        // Fetch Logs from Prisma
        const [nutritionToday, activityToday, sleepToday, hydrationToday, habitsToday, nutritionWeek, activityWeek, sleepWeek, hydrationWeek] = await Promise.all([
            prisma.nutritionLog.findMany({ where: { user_id: userId, created_at: { gte: fromDate, lte: toDate } }, orderBy: { created_at: 'desc' } }),
            prisma.activityLog.findMany({ where: { user_id: userId, created_at: { gte: fromDate, lte: toDate } }, orderBy: { created_at: 'desc' } }),
            prisma.sleepLog.findMany({ where: { user_id: userId, created_at: { gte: fromDate, lte: toDate } }, orderBy: { created_at: 'desc' } }),
            prisma.hydrationLog.findMany({ where: { user_id: userId, created_at: { gte: fromDate, lte: toDate } }, orderBy: { created_at: 'desc' } }),
            prisma.habitLog.findMany({ where: { user_id: userId, created_at: { gte: fromDate, lte: toDate } }, orderBy: { created_at: 'desc' } }),
            // Списки за 7 дней
            prisma.nutritionLog.findMany({ where: { user_id: userId, created_at: { gte: weekAgo } }, orderBy: { created_at: 'desc' } }),
            prisma.activityLog.findMany({ where: { user_id: userId, created_at: { gte: weekAgo } }, orderBy: { created_at: 'desc' } }),
            prisma.sleepLog.findMany({ where: { user_id: userId, created_at: { gte: weekAgo } }, orderBy: { created_at: 'desc' } }),
            prisma.hydrationLog.findMany({ where: { user_id: userId, created_at: { gte: weekAgo } }, orderBy: { created_at: 'desc' } })
        ]);

        // Calculate Aggregates
        const totalWater = hydrationToday.reduce((acc: number, h: any) => acc + h.volume_ml, 0);
        const lastSleep = sleepToday[0];
        const lastActivity = activityToday[0];
        const totalCalories = nutritionToday.reduce((sum: number, n: any) => sum + Number(n.calories || 0), 0);
        const totalSteps = activityToday.reduce((sum: number, a: any) => sum + (a.steps || 0), 0);

        return (
            <div className="min-h-screen font-sans flex transition-colors duration-300">
                <Sidebar role="client" profileName={user?.user_metadata?.full_name || "Пользователь"} />

                <main className="flex-1 w-full lg:ml-64 p-4 md:p-8 overflow-x-hidden pt-24 lg:pt-8 bg-slate-50 dark:bg-slate-950">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                            <div>
                                <h1 className="text-3xl font-bold dark:text-slate-100 text-brand-text mb-1">Образ жизни</h1>
                                <p className="text-sm text-gray-500 dark:text-slate-400">Мониторинг вашего питания, активности и сна на основе данных из Telegram-бота.</p>
                            </div>

                            {/* Фильтр Периода */}
                            <form action="" method="GET" className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-xl shadow-sm">
                                <div className="flex items-center gap-1">
                                    <input type="date" name="from" defaultValue={fromStr || fromDate.toISOString().split('T')[0]} className="bg-slate-50 dark:bg-slate-800 border-0 rounded-lg p-1.5 text-xs dark:text-slate-200" />
                                </div>
                                <span className="text-gray-400">-</span>
                                <div className="flex items-center gap-1">
                                    <input type="date" name="to" defaultValue={toStr || toDate.toISOString().split('T')[0]} className="bg-slate-50 dark:bg-slate-800 border-0 rounded-lg p-1.5 text-xs dark:text-slate-200" />
                                </div>
                                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 px-3 rounded-lg">Применить</button>
                            </form>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                            {/* Water Card */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                                            <GlassWater size={24} />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400">💧 Гидратация</p>
                                            <h3 className="text-2xl font-bold dark:text-slate-100">{totalWater} <span className="text-sm font-normal text-gray-400">мл</span></h3>
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min((totalWater / 2000) * 100, 100)}%` }}></div>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1">Норма: 2000 мл</p>
                                </div>

                                {/* Список неделя */}
                                <details className="group mt-4 pt-2 border-t border-slate-100 dark:border-white/5">
                                    <summary className="text-[10px] text-blue-500 cursor-pointer list-none flex items-center justify-between">
                                        🗓️ За неделю <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
                                    </summary>
                                    <div className="mt-2 space-y-1 max-h-24 overflow-y-auto text-[11px] text-gray-500 dark:text-slate-400">
                                        {hydrationWeek.map((h: any) => (
                                            <div key={h.id} className="flex justify-between">{new Date(h.created_at).toLocaleDateString([], {day:'2-digit', month:'2-digit'})}: <span>{h.volume_ml} мл</span></div>
                                        ))}
                                    </div>
                                </details>
                            </div>

                            {/* Sleep Card */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500">
                                        <Bed size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">🛌 Сон</p>
                                        <h3 className="text-xl font-bold dark:text-slate-100">
                                            {lastSleep && lastSleep.duration_hrs ? `${Math.floor(lastSleep.duration_hrs)}ч ${Math.round((lastSleep.duration_hrs % 1) * 60)}м` : "—"}
                                        </h3>
                                        {lastSleep?.deep_hrs && <p className="text-[10px] text-gray-400">Глубокий: {Math.floor(lastSleep.deep_hrs)}ч {Math.round((lastSleep.deep_hrs % 1) * 60)}м</p>}
                                    </div>
                                </div>

                                <details className="group mt-4 pt-2 border-t border-slate-100 dark:border-white/5">
                                    <summary className="text-[10px] text-blue-500 cursor-pointer list-none flex items-center justify-between">
                                        🗓️ За неделю <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
                                    </summary>
                                    <div className="mt-2 space-y-1 max-h-24 overflow-y-auto text-[11px] text-gray-500 dark:text-slate-400">
                                        {sleepWeek.map((s: any) => (
                                            <div key={s.id} className="flex justify-between">{new Date(s.created_at).toLocaleDateString([], {day:'2-digit', month:'2-digit'})}: <span>{s.duration_hrs?.toFixed(1)}ч</span></div>
                                        ))}
                                    </div>
                                </details>
                            </div>

                            {/* Activity Card */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 rounded-xl bg-green-500/10 text-green-500">
                                        <Activity size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">🏃‍♂️ Активность</p>
                                        <h3 className="text-xl font-bold dark:text-slate-100">{totalSteps} <span className="text-sm font-normal text-gray-400">шагов</span></h3>
                                        {lastActivity?.calories_burned && <p className="text-[10px] text-orange-500">🔥 {lastActivity.calories_burned} ккал</p>}
                                    </div>
                                </div>

                                <details className="group mt-4 pt-2 border-t border-slate-100 dark:border-white/5">
                                    <summary className="text-[10px] text-blue-500 cursor-pointer list-none flex items-center justify-between">
                                        🗓️ За неделю <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
                                    </summary>
                                    <div className="mt-2 space-y-1 max-h-24 overflow-y-auto text-[11px] text-gray-500 dark:text-slate-400">
                                        {activityWeek.map((a: any) => (
                                            <div key={a.id} className="flex justify-between">{new Date(a.created_at).toLocaleDateString([], {day:'2-digit', month:'2-digit'})}: <span>{a.steps || 0}</span></div>
                                        ))}
                                    </div>
                                </details>
                            </div>

                            {/* Nutrition Card */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="p-3 rounded-xl bg-red-500/10 text-red-500">
                                        <Apple size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">🍎 Питание</p>
                                        <h3 className="text-xl font-bold dark:text-slate-100">{totalCalories} <span className="text-sm font-normal text-gray-400">ккал</span></h3>
                                    </div>
                                </div>

                                {/* Краткий отчет КБЖУ со скроллом */}
                                <details className="group mt-2 mb-2">
                                    <summary className="text-[11px] text-blue-500 cursor-pointer list-none flex items-center justify-between font-semibold">
                                        📊 Отчет по всем нутриентам <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
                                    </summary>
                                    <div className="mt-1 space-y-1 max-h-40 overflow-y-auto text-xs text-gray-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl">
                                        {Object.entries(NUTRITION_NORMS).map(([key, config]: any) => {
                                            const val = nutritionToday.reduce((sum: number, n: any) => sum + Number(n[key] || 0), 0);
                                            const pct = (val / config.norm) * 100;
                                            let emoji = '🔴';
                                            if (pct >= 80) emoji = '🟢';
                                            else if (pct >= 50) emoji = '🟡';
                                            return (
                                                <div key={key} className="flex justify-between items-center text-[10px] pb-1 border-b border-slate-100 dark:border-white/5 last:border-0">
                                                    <span>{emoji} {NUTRIENT_NAMES[key]}</span>
                                                    <span>{val.toFixed(1)} / {config.norm} ({pct.toFixed(0)}%)</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </details>

                                <details className="group mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
                                    <summary className="text-[10px] text-blue-500 cursor-pointer list-none flex items-center justify-between">
                                        🗓️ За неделю <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
                                    </summary>
                                    <div className="mt-2 space-y-1 max-h-24 overflow-y-auto text-[11px] text-gray-500 dark:text-slate-400">
                                        {nutritionWeek.filter((n: any, i: number, arr: any[]) => arr.findIndex((x: any) => new Date(x.created_at).toLocaleDateString() === new Date(n.created_at).toLocaleDateString()) === i).map((n: any) => {
                                            const dayCal = nutritionWeek.filter((x: any) => new Date(x.created_at).toLocaleDateString() === new Date(n.created_at).toLocaleDateString()).reduce((sum: number, x: any) => sum + (x.calories || 0), 0);
                                            return (
                                                <div key={n.id} className="flex justify-between">{new Date(n.created_at).toLocaleDateString([], {day:'2-digit', month:'2-digit'})}: <span>{dayCal} ккал</span></div>
                                            );
                                        })}
                                    </div>
                                </details>
                            </div>
                        </div>

                        {/* Logs Detailed Lists */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold mb-4 dark:text-slate-200">🥗 Последние приемы пищи</h3>
                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                    {nutritionToday.length === 0 ? <p className="text-gray-400 text-sm">Трапез не зафиксировано за период</p> :
                                        nutritionToday.map((n: any) => (
                                            <div key={n.id} className="p-4 rounded-xl border border-slate-50 dark:border-white/5 bg-slate-50/50 dark:bg-slate-800/20">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <p className="text-sm font-semibold dark:text-slate-300">{n.dish || "Без названия"}</p>
                                                        {n.grams && <p className="text-[10px] text-gray-400">{n.grams} г</p>}
                                                    </div>
                                                    <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                </div>
                                                <p className="text-xs text-gray-500 mb-2 truncate">{n.description}</p>
                                                <div className="flex gap-4 text-[10px] text-gray-500">
                                                    <span>🔥 {n.calories} ккал</span>
                                                    <span>🥩 Б: {n.protein}г</span>
                                                    <span>🥑 Ж: {n.fat}г</span>
                                                    <span>🍞 У: {n.carbs}г</span>
                                                </div>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold mb-4 dark:text-slate-200">🚭 Вредные привычки за сегодня</h3>
                                <div className="space-y-3">
                                    {habitsToday.length === 0 ? <p className="text-gray-400 text-sm">Привычки не зафиксированы за период</p> :
                                        habitsToday.map((h: any) => (
                                            <div key={h.id} className="flex gap-3 items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30">
                                                <Cigarette size={18} className="text-amber-500 flex-shrink-0" />
                                                <div className="flex-1">
                                                    <p className="text-sm dark:text-slate-300">{h.habit_key}</p>
                                                    <p className="text-[10px] text-gray-400">{new Date(h.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                                </div>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        </div>

                    </div>
                </main>
            </div>
        );
    } catch (err: any) {
        return <div className="p-8 text-center text-red-500">Ошибка: {err.message}</div>;
    }
}
