import React from 'react';
import Sidebar from "@/components/dashboard/Sidebar";
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import { Apple, Activity, Bed, GlassWater, Cigarette, Flame } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function LifestylePage() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return <div className="p-8 text-center text-red-500">Авторизация не удалась.</div>;
        }

        const userId = user.id;

        // Fetch Logs from Prisma
        const [nutrition, activity, sleep, hydration, habits] = await Promise.all([
            prisma.nutritionLog.findMany({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, take: 5 }),
            prisma.activityLog.findMany({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, take: 5 }),
            prisma.sleepLog.findMany({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, take: 5 }),
            prisma.hydrationLog.findMany({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, take: 24 }), // Последние за сутки
            prisma.habitLog.findMany({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, take: 10 })
        ]);

        // Calculate Totals for Today (brief)
        const todayWater = hydration.reduce((acc, h) => acc + h.volume_ml, 0);
        const lastSleep = sleep[0];
        const lastActivity = activity[0];
        const lastNutrition = nutrition[0];

        return (
            <div className="min-h-screen font-sans flex transition-colors duration-300">
                <Sidebar role="client" profileName={user?.user_metadata?.full_name || "Пользователь"} />

                <main className="flex-1 w-full lg:ml-64 p-4 md:p-8 overflow-x-hidden pt-24 lg:pt-8 bg-slate-50 dark:bg-slate-950">
                    <div className="max-w-7xl mx-auto">
                        <h1 className="text-3xl font-bold dark:text-slate-100 text-brand-text mb-2">Образ жизни</h1>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mb-8">Мониторинг вашего питания, активности и сна на основе данных из Telegram-бота.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                            {/* Water Card */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                                        <GlassWater size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">💧 Гидратация</p>
                                        <h3 className="text-2xl font-bold dark:text-slate-100">{todayWater} <span className="text-sm font-normal text-gray-400">мл</span></h3>
                                    </div>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                                    <div 
                                        className="bg-blue-500 h-2 rounded-full transition-all" 
                                        style={{ width: `${Math.min((todayWater / 2000) * 100, 100)}%` }}
                                    ></div>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">Норма: 2000 мл</p>
                            </div>

                            {/* Sleep Card */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500">
                                        <Bed size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">🛌 Сон</p>
                                        <h3 className="text-2xl font-bold dark:text-slate-100">
                                            {lastSleep && lastSleep.duration_hrs ? `${Math.floor(lastSleep.duration_hrs)}ч ${Math.round((lastSleep.duration_hrs % 1) * 60)}м` : "Нет данных"}
                                        </h3>
                                    </div>
                                </div>
                                {lastSleep?.deep_hrs && (
                                    <p className="text-xs text-gray-500">Глубокий: {Math.floor(lastSleep.deep_hrs)}ч {Math.round((lastSleep.deep_hrs % 1) * 60)}м</p>
                                )}
                            </div>

                            {/* Activity Card */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 rounded-xl bg-green-500/10 text-green-500">
                                        <Activity size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">🏃‍♂️ Активность</p>
                                        <h3 className="text-2xl font-bold dark:text-slate-100">
                                            {lastActivity?.steps ? `${lastActivity.steps}` : "—"} <span className="text-sm font-normal text-gray-400">шагов</span>
                                        </h3>
                                    </div>
                                </div>
                                {lastActivity?.calories_burned && (
                                    <div className="flex items-center gap-1 text-xs text-orange-500">
                                        <Flame size={14} /> <span>{lastActivity.calories_burned} ккал сожжено</span>
                                    </div>
                                )}
                            </div>

                            {/* Nutrition Summary Card */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 rounded-xl bg-red-500/10 text-red-500">
                                        <Apple size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">🍎 Питание</p>
                                        <h3 className="text-2xl font-bold dark:text-slate-100">
                                            {lastNutrition?.calories ? `${lastNutrition.calories}` : "—"} <span className="text-sm font-normal text-gray-400">ккал</span>
                                        </h3>
                                    </div>
                                </div>
                                {lastNutrition && (
                                    <p className="text-xs text-gray-400 truncate">{lastNutrition.description}</p>
                                )}
                            </div>
                        </div>

                        {/* Logs Detailed Lists */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Nutrition Log */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold mb-4 dark:text-slate-200">🥗 Последние приемы пищи</h3>
                                <div className="space-y-4">
                                    {nutrition.length === 0 ? <p className="text-gray-400 text-sm">Трапез не зафиксировано</p> :
                                        nutrition.map(n => (
                                            <div key={n.id} className="p-4 rounded-xl border border-slate-50 dark:border-white/5 bg-slate-50/50 dark:bg-slate-800/20">
                                                <div className="flex justify-between items-start mb-2">
                                                    <p className="text-sm font-semibold dark:text-slate-300">{n.description || "Описание отсутствует"}</p>
                                                    <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleDateString()}</span>
                                                </div>
                                                <div className="flex gap-4 text-xs text-gray-500">
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

                            {/* Habits Log */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold mb-4 dark:text-slate-200">🚭 Вредные привычки & Заметки</h3>
                                <div className="space-y-3">
                                    {habits.length === 0 ? <p className="text-gray-400 text-sm">Привычки не зафиксированы</p> :
                                        habits.map(h => (
                                            <div key={h.id} className="flex gap-3 items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30">
                                                <Cigarette size={18} className="text-amber-500 flex-shrink-0" />
                                                <div className="flex-1">
                                                    <p className="text-sm dark:text-slate-300">{h.description}</p>
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
