"use client";

import React, { useState } from 'react';
import HRVChart from './HRVChart';
import VO2Chart from './VO2Chart';
import BioAgeRadar from './BioAgeRadar';
import HabitHeatmap from './HabitHeatmap';
import SleepPhasesChart from './SleepPhasesChart';
import { useRouter } from 'next/navigation';
import { useDashboardTheme } from '../ThemeContext';

interface DashboardViewsProps {
    profile: {
        full_name: string;
        id: string;
    };
    testResults: any[];
    healthData: any; // Using any for simplicity in demo, should ideally use HealthData type from Prisma
}

export default function DashboardViews({ profile, testResults, healthData }: DashboardViewsProps) {
    const router = useRouter();
    const { theme } = useDashboardTheme();
    const [activeView, setActiveView] = useState<'overview' | 'diagnostics'>('overview');

    const handleDiagnosticClick = () => {
        router.push('/ru/diagnostics');
    };

    const getLatestTest = (type: string) => {
        return testResults.find(r => r.test_type === type);
    };

    // Helper to get color classes based on score severity 
    // This replicates the behavior of `testConfig` on `ResultsGrid.tsx` but using Aeterna theme colors
    const getSeverityClasses = (testType: string, score: number | undefined | null) => {
        if (score === undefined || score === null) return theme === 'dark' ? 'bg-slate-700 text-white/40' : 'bg-brand-sage/20 text-brand-gray/40';

        const colorMode = theme === 'dark' ? 'teal-400' : 'brand-leaf';

        switch (testType) {
            case 'nicotine':
                return score >= 7 ? 'bg-red-500/20 text-red-500' // High dependence (>= 7)
                    : score >= 4 ? 'bg-amber-400/20 text-amber-400' // Medium
                        : `bg-${colorMode}/20 text-${colorMode}`;
            case 'RU-AUDIT':
            case 'alcohol':
                return score >= 16 ? 'bg-red-500/20 text-red-500' // High risk/Harmful
                    : score >= 8 ? 'bg-amber-400/20 text-amber-400' // Hazardous
                        : `bg-${colorMode}/20 text-${colorMode}`; // Low risk
            case 'mini-cog':
                return score < 3 ? 'bg-red-500/20 text-red-500' // Warning
                    : score === 3 || score === 4 ? 'bg-amber-400/20 text-amber-400'
                        : `bg-${colorMode}/20 text-${colorMode}`; // 5
            case 'score':
                return score >= 5 ? 'bg-red-500/20 text-red-500' // High/Very High risk (>= 5%)
                    : score >= 1 ? 'bg-amber-400/20 text-amber-400' // Moderate risk (1-4%)
                        : `bg-${colorMode}/20 text-${colorMode}`; // Low (< 1%)
            case 'insomnia':
                return score >= 15 ? 'bg-red-500/20 text-red-500' // Clinical insomnia
                    : score >= 8 ? 'bg-amber-400/20 text-amber-400'
                        : `bg-${colorMode}/20 text-${colorMode}`;
            case 'circadian':
                // Doesn't strictly have a bad/good, usually just types (Lark, Owl, etc).
                return `bg-${colorMode}/20 text-${colorMode}`;
            default:
                return `bg-${colorMode}/20 text-${colorMode}`;
        }
    };

    const miniCog = getLatestTest('mini-cog');
    const scoreRisk = getLatestTest('score');
    const nicotine = getLatestTest('nicotine');
    const alcohol = getLatestTest('RU-AUDIT') || getLatestTest('alcohol'); // Fallback for older data
    const insomnia = getLatestTest('insomnia');
    const circadian = getLatestTest('circadian');

    const accentColor = theme === 'dark' ? 'text-teal-400' : 'text-brand-leaf';
    const accentBg = theme === 'dark' ? 'bg-teal-400' : 'bg-brand-leaf';
    const activeNavBorder = theme === 'dark' ? 'after:bg-teal-400' : 'after:bg-brand-leaf';

    return (
        <div className="max-w-7xl mx-auto font-sans dark:text-slate-50 text-brand-text transition-colors duration-300">
            {/* HEADER */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 border-b dark:border-slate-800 border-brand-sage/40 pb-6">
                <div>
                    <h1 className="text-sm font-medium opacity-50 uppercase tracking-widest mb-1">Health Intelligence</h1>
                    <h2 className="text-2xl font-bold">{profile.full_name || 'User'}</h2>
                </div>

                <nav className="flex gap-8 text-sm font-medium">
                    <button
                        onClick={() => setActiveView('overview')}
                        className={`relative pb-2 transition-all opacity-50 ${activeView === 'overview' ? `opacity-100 ${accentColor} after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] ${activeNavBorder}` : 'hover:opacity-100'}`}
                    >
                        Обзор
                    </button>
                    <button
                        onClick={() => setActiveView('diagnostics')}
                        className={`relative pb-2 transition-all opacity-50 ${activeView === 'diagnostics' ? `opacity-100 ${accentColor} after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] ${activeNavBorder}` : 'hover:opacity-100'}`}
                    >
                        Диагностика & Тесты
                    </button>
                    <button className="pb-2 opacity-20 cursor-not-allowed">
                        План терапии
                    </button>
                </nav>

                <div className="flex gap-12">
                    <div className="text-center md:text-left">
                        <p className="text-[10px] uppercase opacity-50 mb-1">Биологический возраст</p>
                        <p className="text-3xl font-light tracking-tight"><span className={`font-bold ${accentColor}`}>{healthData?.biological_age_calc || 40}</span> <span className="text-sm opacity-40">/ {healthData?.biological_age_actual || 44}</span></p>
                    </div>
                    <div className="text-center md:text-left">
                        <p className="text-[10px] uppercase opacity-50 mb-1">Longevity Index</p>
                        <div className="flex items-center gap-3">
                            <p className="text-3xl font-bold">{healthData?.longevity_score || 88}<span className="text-base font-medium opacity-50">%</span></p>
                            <div className="w-12 h-2 dark:bg-slate-700 bg-brand-sage/30 rounded-full overflow-hidden">
                                <div className={`h-full ${accentBg}`} style={{ width: `${healthData?.longevity_score || 88}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* VIEW 1: OVERVIEW */}
            {
                activeView === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
                        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Сон */}
                            <div className="dark:bg-slate-800 bg-white border dark:border-white/5 border-brand-sage/30 rounded-2xl p-6 shadow-md transition-colors duration-300">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-semibold dark:text-slate-300 text-brand-text">Сон & HRV</h3>
                                    <span className={`text-xs px-2 py-1 dark:bg-slate-700 bg-brand-leaf/10 rounded ${accentColor}`}>Deep Recovery</span>
                                </div>
                                <div className="h-48 mb-6">
                                    <HRVChart />
                                </div>
                                <div className="flex justify-between text-xs opacity-60">
                                    <span>Фазы сна (ч)</span>
                                    <span className={`${accentColor} italic`}>Gold Standard: 8.0h</span>
                                </div>
                                <div className="h-16 mt-2">
                                    <SleepPhasesChart />
                                </div>
                            </div>

                            {/* Питание */}
                            <div className="dark:bg-slate-800 bg-white border dark:border-white/5 border-brand-sage/30 rounded-2xl p-6 shadow-md transition-colors duration-300">
                                <h3 className="font-semibold dark:text-slate-300 text-brand-text mb-6">Нутриентный статус</h3>
                                <div className="flex justify-around items-center mb-8">
                                    <div className="relative w-32 h-32 flex items-center justify-center">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="dark:text-slate-700 text-brand-sage/20" />
                                            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="364.4" strokeDashoffset="120" className={theme === 'dark' ? 'text-teal-400' : 'text-brand-leaf'} />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                            <span className="text-xs opacity-50">Окно</span>
                                            <span className="text-xl font-bold">16:8</span>
                                        </div>
                                    </div>
                                    <div className="text-sm space-y-2">
                                        <p className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${accentBg}`}></span> Фаза голодания: 11:20</p>
                                        <p className="text-xs opacity-40">Окно: {healthData?.fasting_window || "16:8"}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="opacity-60">Нутрицевтическая плотность</span>
                                            <span className="font-medium">{healthData?.nutrient_density_pct || 92}%</span>
                                        </div>
                                        <div className="w-full h-1.5 dark:bg-slate-700 bg-brand-sage/20 rounded-full">
                                            <div className={`h-full ${accentBg} w-[${healthData?.nutrient_density_pct || 92}%]`}></div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="flex justify-between text-[10px] mb-1 opacity-50">
                                                <span>ИНДЕКС САХАРА</span>
                                                <span>LOW</span>
                                            </div>
                                            <div className="w-full h-1 dark:bg-slate-700 bg-brand-sage/20 rounded-full">
                                                <div className={`h-full ${accentBg} w-[30%]`}></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[10px] mb-1 opacity-50">
                                                <span>КЛЕТЧАТКА</span>
                                                <span>32g</span>
                                            </div>
                                            <div className="w-full h-1 dark:bg-slate-700 bg-brand-sage/20 rounded-full">
                                                <div className={`h-full ${accentBg} w-[85%]`}></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Активность */}
                            <div className="dark:bg-slate-800 bg-white border dark:border-white/5 border-brand-sage/30 rounded-2xl p-6 shadow-md transition-colors duration-300">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-semibold dark:text-slate-300 text-brand-text">Метаболический фитнес</h3>
                                    <div className="text-right">
                                        <p className="text-xs opacity-50">VO2 MAX</p>
                                        <p className={`text-xl font-bold ${accentColor}`}>{healthData?.vo2_max || 52.4}</p>
                                    </div>
                                </div>
                                <div className="h-40 mb-4">
                                    <VO2Chart />
                                </div>
                                <div className="grid grid-cols-5 gap-1">
                                    <div className="h-10 dark:bg-slate-700/50 bg-brand-sage/10 rounded flex items-end p-1 overflow-hidden" title="Zone 1">
                                        <div className="w-full bg-slate-500 h-[20%] opacity-40"></div>
                                    </div>
                                    <div className="h-10 dark:bg-slate-700/50 bg-brand-sage/10 rounded flex items-end p-1 overflow-hidden" title="Zone 2">
                                        <div className={`w-full ${accentBg} h-[90%]`}></div>
                                    </div>
                                    <div className="h-10 dark:bg-slate-700/50 bg-brand-sage/10 rounded flex items-end p-1 overflow-hidden" title="Zone 3">
                                        <div className={`w-full ${accentBg} h-[40%] opacity-60`}></div>
                                    </div>
                                    <div className="h-10 dark:bg-slate-700/50 bg-brand-sage/10 rounded flex items-end p-1 overflow-hidden" title="Zone 4">
                                        <div className="w-full bg-amber-400 h-[15%]"></div>
                                    </div>
                                    <div className="h-10 dark:bg-slate-700/50 bg-brand-sage/10 rounded flex items-end p-1 overflow-hidden" title="Zone 5">
                                        <div className="w-full bg-amber-400 h-[5%]"></div>
                                    </div>
                                </div>
                                <div className="flex justify-between text-[10px] mt-1 opacity-40 uppercase">
                                    <span>Z1</span>
                                    <span>Aerobic Base (Z2)</span>
                                    <span>Z5</span>
                                </div>
                            </div>

                            {/* Биомаркеры */}
                            <div className="dark:bg-slate-800 bg-white border dark:border-white/5 border-brand-sage/30 rounded-2xl p-6 shadow-md overflow-hidden transition-colors duration-300">
                                <h3 className="font-semibold dark:text-slate-300 text-brand-text mb-4">Critical Biomarkers</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-[10px] uppercase opacity-40 border-b dark:border-slate-700 border-brand-sage/30">
                                                <th className="text-left pb-2 font-medium">Маркер</th>
                                                <th className="text-right pb-2 font-medium">Значение</th>
                                                <th className="text-right pb-2 font-medium">Оптимум</th>
                                                <th className="text-right pb-2 font-medium">Статус</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-slate-700/50 divide-brand-sage/20">
                                            <tr>
                                                <td className="py-3 font-medium">Глюкоза</td>
                                                <td className="text-right">{healthData?.glucose || 4.8}</td>
                                                <td className="text-right opacity-50">4.2–5.1</td>
                                                <td className="text-right"><span className={`w-2 h-2 inline-block rounded-full ${accentBg}`}></span></td>
                                            </tr>
                                            <tr>
                                                <td className="py-3 font-medium">Ферритин</td>
                                                <td className="text-right">{healthData?.ferritin || 112}</td>
                                                <td className="text-right opacity-50">80–150</td>
                                                <td className="text-right"><span className={`w-2 h-2 inline-block rounded-full ${accentBg}`}></span></td>
                                            </tr>
                                            <tr>
                                                <td className="py-3 font-medium">Кортизол (утр)</td>
                                                <td className="text-right text-amber-400">{healthData?.cortisol || 540}</td>
                                                <td className="text-right opacity-50">150–450</td>
                                                <td className="text-right"><span className="w-2 h-2 inline-block rounded-full bg-amber-400"></span></td>
                                            </tr>
                                            <tr>
                                                <td className="py-3 font-medium">Витамин D3</td>
                                                <td className="text-right">{healthData?.vitamin_d3 || 68}</td>
                                                <td className="text-right opacity-50">60–100</td>
                                                <td className="text-right"><span className={`w-2 h-2 inline-block rounded-full ${accentBg}`}></span></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* SIDEBAR */}
                        <aside className="space-y-6">
                            {/* Habit Tracker Heatmap */}
                            <div className="dark:bg-slate-800 bg-white border dark:border-white/5 border-brand-sage/30 rounded-2xl p-6 shadow-md transition-colors duration-300">
                                <h3 className="text-sm font-semibold dark:text-slate-300 text-brand-text mb-4">Habit Stability (30d)</h3>
                                <div className="mb-4">
                                    <HabitHeatmap />
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="opacity-60">Alcohol Free</span>
                                        <span className={accentColor}>28/30</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="opacity-60">Supplements</span>
                                        <span className={accentColor}>30/30</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="opacity-60">Meditation</span>
                                        <span className="text-amber-400">18/30</span>
                                    </div>
                                </div>
                            </div>

                            {/* Longevity Recommendations */}
                            <div className="dark:bg-slate-800/50 bg-brand-sage/5 border border-dashed dark:border-slate-600 border-brand-sage/40 rounded-2xl p-6 shadow-md transition-colors duration-300">
                                <h3 className={`text-xs font-bold uppercase tracking-tighter ${accentColor} mb-3`}>AI Recommendation</h3>
                                <p className="text-sm leading-relaxed opacity-80 italic">
                                    "Уровень кортизола превышает оптимум на 20%. Рекомендуется добавить 15 мин низкоинтенсивной прогулки после ужина и перенести прием магния на 21:00."
                                </p>
                            </div>
                        </aside>
                    </div>
                )
            }

            {/* VIEW 2: DIAGNOSTICS */}
            {
                activeView === 'diagnostics' && (
                    <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="dark:bg-slate-800 bg-white border dark:border-white/5 border-brand-sage/30 rounded-2xl p-8 shadow-md lg:col-span-1 transition-colors duration-300">
                                <h3 className="text-sm font-bold dark:text-slate-300 text-brand-text uppercase mb-8">Системный Биовозраст</h3>
                                <div className="h-72">
                                    <BioAgeRadar />
                                </div>
                            </div>

                            <div className="lg:col-span-2 space-y-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                                    {[
                                        { label: 'Сердечно-сосуд.', value: '46', color: 'text-amber-500', status: 'В зоне риска' },
                                        { label: 'Гибкость', value: '35', color: accentColor },
                                        { label: 'Реакция', value: '35', color: accentColor },
                                        { label: 'Координация', value: '30', color: accentColor },
                                        { label: 'Вестиб. апп.', value: '60', color: 'text-amber-500' },
                                        { label: 'Кожа', value: '35', color: accentColor },
                                        { label: 'Суставы', value: '37', color: accentColor },
                                    ].map((stat, i) => (
                                        <div key={i} className="p-4 dark:bg-slate-900/40 bg-brand-sage/10 rounded-xl border dark:border-white/5 border-brand-sage/20 transition-colors duration-300">
                                            <p className="text-[10px] opacity-40 uppercase mb-2">{stat.label}</p>
                                            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                                            {stat.status && <p className={`text-[10px] ${stat.color}/80 mt-1`}>{stat.status}</p>}
                                        </div>
                                    ))}
                                </div>

                                <div className="dark:bg-slate-800 bg-white border dark:border-white/5 border-brand-sage/30 rounded-2xl p-6 shadow-md overflow-hidden transition-colors duration-300">
                                    <h3 className="text-sm font-bold uppercase opacity-40 mb-6">Лабораторная панель (Анализы)</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-[10px] opacity-30 border-b dark:border-slate-700 border-brand-sage/30 transition-colors duration-300">
                                                    <th className="text-left pb-4 font-medium uppercase">Маркер</th>
                                                    <th className="text-right pb-4 font-medium uppercase">Результат</th>
                                                    <th className="text-right pb-4 font-medium uppercase">Оптимум Longevity</th>
                                                    <th className="text-right pb-4 font-medium uppercase">Статус</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[
                                                    { name: 'Инсулин (натощак)', res: `${healthData?.insulin || 4.2} мкЕд/мл`, opt: '3.0–5.5', status: 'teal' },
                                                    { name: 'ЛПНП (Холестерин)', res: `${healthData?.ldl_cholesterol || 2.1} ммоль/л`, opt: '< 1.8', status: 'amber' },
                                                    { name: 'СРБ (Ультрачувствительный)', res: `${healthData?.crp || 0.4} мг/л`, opt: '< 0.5', status: 'teal' },
                                                    { name: 'Гомоцистеин', res: `${healthData?.homocysteine || 7.2} мкмоль/л`, opt: '5.0–7.5', status: 'teal' },
                                                ].map((row, i) => (
                                                    <tr key={i} className="border-b dark:border-slate-700/30 border-brand-sage/10 transition-colors duration-300">
                                                        <td className="py-3 font-medium">{row.name}</td>
                                                        <td className="text-right font-mono">{row.res}</td>
                                                        <td className="text-right opacity-50">{row.opt}</td>
                                                        <td className="text-right">
                                                            <span className={`w-1.5 h-1.5 inline-block rounded-full ${row.status === 'teal' ? accentBg : 'bg-amber-400'}`}></span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Questionnaires Grid */}
                        <div className="dark:bg-slate-800 bg-white border dark:border-white/5 border-brand-sage/30 rounded-2xl p-8 shadow-md transition-colors duration-300">
                            <h3 className="text-sm font-bold uppercase opacity-40 mb-8">Скрининги и Индексы</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[
                                    { name: 'Mini-Cog', data: miniCog, total: '/5', type: 'mini-cog' },
                                    { name: 'SCORE (ССЗ)', data: scoreRisk, total: '%', type: 'score' },
                                    { name: 'Никотин', data: nicotine, total: '', type: 'nicotine' },
                                    { name: 'Алкоголь (AUDIT)', data: alcohol, total: '', type: 'RU-AUDIT' },
                                    { name: 'Бессонница (ISI)', data: insomnia, total: '', type: 'insomnia' },
                                    { name: 'Циркадные ритмы', data: circadian, total: '', type: 'circadian' },
                                ].map((item, i) => (
                                    <div key={i} className="p-4 dark:bg-slate-900/50 bg-brand-sage/10 rounded-xl flex items-center gap-4 transition-colors duration-300">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${getSeverityClasses(item.type, item.data?.score)}`}>
                                            {item.data ? `${item.data.score}${item.total}` : '-'}
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold">{item.name}</p>
                                            <p className="text-[10px] opacity-40 line-clamp-1">{item.data ? item.data.interpretation : 'Нет данных'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
