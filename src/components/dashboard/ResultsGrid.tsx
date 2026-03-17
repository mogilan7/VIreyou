"use client";

import React, { useState } from 'react';
import {
    Activity,
    Moon,
    Brain,
    HeartPulse,
    GlassWater,
    ShieldAlert,
    Calendar,
    ChevronDown,
    ChevronUp,
    Cigarette,
    Flame,
    LayoutGrid,
    List,
    LayoutList,
    Clock,
    RefreshCcw,
    Info,
    TrendingUp,
    TrendingDown,
    Minus,
    Trash2
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useDashboardTheme } from "./ThemeContext";
import { Link, useRouter } from "@/i18n/routing";

const StatusBadge = ({ severity }: { severity: string }) => {
    const styles: Record<string, string> = {
        'text-teal-400': "bg-teal-400/10 text-teal-400 border-teal-400/20",
        'text-amber-400': "bg-amber-400/10 text-amber-400 border-amber-400/20",
        'text-red-500': "bg-red-500/10 text-red-500 border-red-500/20"
    };

    const labels: Record<string, string> = {
        'text-teal-400': "Норма",
        'text-amber-400': "Внимание",
        'text-red-500': "Риск"
    };

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[severity] || styles['text-teal-400']}`}>
            {labels[severity] || "Норма"}
        </span>
    );
};

const TrendIcon = ({ current, previous }: { current: number, previous: number }) => {
    if (current < previous) return <span title="Улучшение"><TrendingDown className="w-4 h-4 text-teal-400" /></span>;
    if (current > previous) return <span title="Ухудшение"><TrendingUp className="w-4 h-4 text-amber-500" /></span>;
    return <span title="Без изменений"><Minus className="w-4 h-4 text-slate-500" /></span>;
};

interface TestResult {
    id: string;
    test_type: string;
    score: number;
    interpretation: string;
    created_at: string;
}

export default function ResultsGrid({ results }: { results: TestResult[] }) {
    const t = useTranslations('Dashboard.Results');
    const { theme } = useDashboardTheme();
    const [expandedCard, setExpandedCard] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const router = useRouter();

    const grouped = results.reduce((acc, result) => {
        if (!acc[result.test_type]) {
            acc[result.test_type] = [];
        }
        acc[result.test_type].push(result);
        return acc;
    }, {} as Record<string, TestResult[]>);

    const handleDeleteTest = async (testType: string) => {
        if (!confirm('Удалить все результаты этого теста?')) return;
        setIsDeleting(testType);
        try {
            const response = await fetch('/api/cabinet/results/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ testType })
            });
            if (response.ok) {
                router.refresh();
            } else {
                const data = await response.json();
                alert(`Ошибка: ${data.error}`);
            }
        } catch (error) {
            alert('Ошибка при удалении');
        } finally {
            setIsDeleting(null);
        }
    };

    const handleDeleteIndividual = async (id: string) => {
        if (!confirm('Удалить эту запись?')) return;
        setIsDeleting(id);
        try {
            const response = await fetch('/api/cabinet/results/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resultId: id })
            });
            if (response.ok) {
                router.refresh();
            } else {
                const data = await response.json();
                alert(`Ошибка: ${data.error}`);
            }
        } catch (error) {
            alert('Ошибка при удалении');
        } finally {
            setIsDeleting(null);
        }
    };

    const getTestConfig = (type: string, score: number) => {
        let severity: 'ok' | 'warn' | 'danger' = 'ok';

        switch (type) {
            case 'bio-age':
            case 'systemic-bio-age':
            case 'greene-scale':
                return {
                    icon: type === 'greene-scale' ? <Brain className="w-6 h-6 dark:text-teal-400 text-brand-leaf" /> : <Activity className="w-6 h-6 dark:text-teal-400 text-brand-leaf" />,
                    color: 'dark:bg-teal-400/10 bg-brand-leaf/10 dark:border-teal-400/30 border-brand-leaf/30 dark:text-teal-400 text-brand-leaf',
                    severityColor: 'dark:text-teal-400 text-brand-leaf',
                    statusColor: 'dark:bg-teal-400 bg-brand-leaf'
                };

            case 'score':
                if (score >= 10) severity = 'danger';
                else if (score >= 1) severity = 'warn';
                else severity = 'ok';
                break;

            case 'insomnia':
                if (score >= 15) severity = 'danger';
                else if (score >= 8) severity = 'warn';
                else severity = 'ok';
                break;

            case 'mini-cog':
                if (score <= 2) severity = 'danger';
                else if (score === 3 || score === 4) severity = 'warn';
                else severity = 'ok';
                break;

            case 'circadian':
                if (score <= 41) severity = 'warn';
                else severity = 'ok';
                break;

            case 'RU-AUDIT':
            case 'alcohol':
                if (score >= 16) severity = 'danger';
                else if (score >= 8) severity = 'warn';
                else severity = 'ok';
                break;

            case 'nicotine':
                if (score >= 7) severity = 'danger';
                else if (score >= 4) severity = 'warn';
                else severity = 'ok';
                break;

            case 'energy':
                severity = 'ok';
                break;
            case 'sarc-f':
                if (score >= 4) severity = 'danger';
                else severity = 'ok';
                break;

            default:
                return {
                    icon: <ShieldAlert className="w-6 h-6 dark:text-slate-400 text-brand-gray" />,
                    color: 'dark:bg-slate-700/50 bg-brand-sage/20 dark:border-white/5 border-brand-sage/30 dark:text-slate-400 text-brand-gray',
                    severityColor: 'dark:text-slate-400 text-brand-gray',
                    statusColor: 'dark:bg-slate-400 bg-brand-gray'
                };
        }

        if (severity === 'danger') {
            return {
                icon: getIcon(type, "text-red-500"),
                color: 'bg-red-500/10 border-red-500/30 text-red-500',
                severityColor: 'text-red-500',
                statusColor: 'bg-red-500'
            };
        } else if (severity === 'warn') {
            return {
                icon: getIcon(type, "text-amber-400"),
                color: 'bg-amber-400/10 border-amber-400/30 text-amber-500',
                severityColor: 'text-amber-400',
                statusColor: 'bg-amber-400'
            };
        } else {
            return {
                icon: getIcon(type, "dark:text-teal-400 text-brand-leaf"),
                color: 'dark:bg-teal-400/10 bg-brand-leaf/10 dark:border-teal-400/30 border-brand-leaf/30 dark:text-teal-400 text-brand-leaf',
                severityColor: 'dark:text-teal-400 text-brand-leaf',
                statusColor: 'dark:bg-teal-400 bg-brand-leaf'
            };
        }
    };

    const getIcon = (type: string, colorClass: string) => {
        switch (type) {
            case 'bio-age':
            case 'systemic-bio-age': return <Activity className={`w-6 h-6 ${colorClass}`} />;
            case 'score': return <HeartPulse className={`w-6 h-6 ${colorClass}`} />;
            case 'insomnia': return <Moon className={`w-6 h-6 ${colorClass}`} />;
            case 'mini-cog': return <Brain className={`w-6 h-6 ${colorClass}`} />;
            case 'circadian': return <Activity className={`w-6 h-6 ${colorClass}`} />;
            case 'RU-AUDIT': return <GlassWater className={`w-6 h-6 ${colorClass}`} />;
            case 'nicotine': return <Cigarette className={`w-6 h-6 ${colorClass}`} />;
            case 'energy': return <Flame className={`w-6 h-6 ${colorClass}`} />;
            case 'sarc-f': return <Activity className={`w-6 h-6 ${colorClass}`} />;
            default: return <ShieldAlert className={`w-6 h-6 text-brand-gray`} />;
        }
    };

    return (
        <div className="space-y-6">
            {/* View Toggle */}
            <div className="flex justify-between items-center mb-6">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <LayoutList className="w-3.5 h-3.5" />
                    Параметр и результат
                </div>
                <div className={`border rounded-xl p-1 flex shadow-md transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-800 border-white/5' : 'bg-white border-brand-sage/30'}`}>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`py-1.5 px-3 rounded-lg transition-all flex items-center gap-2 text-xs font-semibold ${viewMode === 'grid' ? (theme === 'dark' ? 'bg-teal-400/20 text-teal-400' : 'bg-brand-leaf/10 text-brand-leaf') : (theme === 'dark' ? 'text-slate-400 hover:bg-slate-700/50' : 'text-brand-gray hover:bg-brand-sage/20')}`}
                    >
                        <LayoutGrid size={14} /> Карточками
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`py-1.5 px-3 rounded-lg transition-all flex items-center gap-2 text-xs font-semibold ${viewMode === 'list' ? (theme === 'dark' ? 'bg-teal-400/20 text-teal-400' : 'bg-brand-leaf/10 text-brand-leaf') : (theme === 'dark' ? 'text-slate-400 hover:bg-slate-700/50' : 'text-brand-gray hover:bg-brand-sage/20')}`}
                    >
                        <List size={14} /> Списком
                    </button>
                </div>
            </div>

            {/* Results Container */}
            <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch" : "flex flex-col gap-4 items-stretch w-full"}>
                {Object.entries(grouped).map(([testType, testResultsList]) => {
                    const testResults = testResultsList;
                    const isExpanded = expandedCard === testType;
                    const latestResult = testResults[0];
                    const historicalResults = testResults.slice(1);

                    const config = getTestConfig(latestResult.test_type, latestResult.score || 0);
                    const testName = t(`testNames.${latestResult.test_type as keyof typeof t}`) || latestResult.test_type;
                    const isGrid = viewMode === 'grid';

                    return (
                        <div
                            key={testType}
                            className={`border rounded-2xl overflow-hidden transition-all duration-300 group flex flex-col ${isExpanded ? 'shadow-lg' : 'shadow-md'} ${isGrid ? (isExpanded ? 'md:col-span-2 lg:col-span-2' : '') : ''} h-fit ${theme === 'dark' ? 'bg-slate-800 border-white/5 hover:border-teal-400/20' : 'bg-white border-brand-sage/30 hover:border-brand-leaf/30'}`}
                        >
                            {/* Header/Main Row */}
                            <div
                                onClick={() => setExpandedCard(isExpanded ? null : testType)}
                                className={`flex cursor-pointer transition-colors select-none flex-1 pr-4 sm:pr-6 ${isGrid ? 'flex-col p-6' : 'items-center p-5'} ${theme === 'dark' ? 'hover:bg-slate-800/80' : 'hover:bg-brand-sage/5'}`}
                            >
                                {/* Status Indicator Slider */}
                                <div className={`${isGrid ? 'h-1.5 w-full mb-5' : 'w-1.5 self-stretch mr-5'} rounded-full ${config.statusColor}`} />

                                <div className={`flex-1 ${isGrid ? 'flex flex-col h-full' : 'grid grid-cols-1 md:grid-cols-2 gap-4 items-center w-full'}`}>
                                    <div className={isGrid ? 'mb-6 flex-1' : ''}>
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className={`p-2 rounded-xl border ${config.color} shrink-0`}>
                                                {config.icon}
                                            </div>
                                            <h3 className={`font-bold text-lg leading-tight transition-colors ${theme === 'dark' ? 'text-slate-200 group-hover:text-teal-400' : 'text-brand-text group-hover:text-brand-leaf'}`}>{testName}</h3>
                                        </div>
                                        <div className={`flex items-center gap-2 mt-2 ${isGrid ? 'flex-wrap' : ''}`}>
                                            <span className={`font-bold text-xl px-3 py-1 rounded-lg shrink-0 ${config.severityColor} ${theme === 'dark' ? 'bg-slate-900' : 'bg-brand-sage/20'}`}>{latestResult.score}</span>
                                            <span className={`text-sm italic line-clamp-2 ${config.severityColor}`}>— {latestResult.interpretation}</span>
                                        </div>
                                    </div>

                                    <div className={`flex items-center ${isGrid ? 'justify-between mt-auto pt-5 border-t' : 'justify-end gap-3 md:gap-6'} ${theme === 'dark' ? 'border-white/5' : 'border-brand-sage/30'}`}>
                                        <div className="flex items-center gap-4">
                                            <StatusBadge severity={config.severityColor} />
                                            <div className={`p-1.5 rounded-full transition-colors ${theme === 'dark' ? 'text-slate-400 hover:bg-slate-700 bg-slate-900/50' : 'text-brand-gray hover:bg-brand-sage/20 bg-brand-sage/10'}`}>
                                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className={`${isGrid ? 'flex' : 'hidden md:flex'} items-center text-xs font-bold gap-1.5 uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-brand-gray/60'}`}>
                                                <Calendar className="w-3.5 h-3.5" />
                                                {new Date(latestResult.created_at).toLocaleDateString()}
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteTest(latestResult.test_type); }}
                                                disabled={isDeleting === latestResult.test_type}
                                                className={`p-2 rounded-xl border transition-all active:scale-95 ${theme === 'dark' ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' : 'bg-red-50 border-red-100 text-red-500 hover:bg-red-100'} ${isDeleting === latestResult.test_type ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                title="Удалить все результаты этого типа"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Accordion Content */}
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[1000px] border-t dark:border-white/5 border-brand-sage/30 dark:bg-slate-900/40 bg-brand-sage/5' : 'max-h-0'}`}>
                                <div className="p-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                                        <h4 className="text-[10px] font-bold dark:text-slate-400 text-brand-gray flex items-center gap-2 uppercase tracking-widest">
                                            <Clock className="w-3.5 h-3.5" />
                                            История прохождений
                                        </h4>
                                        <Link
                                            href={`/diagnostics/${latestResult.test_type === 'RU-AUDIT' ? 'alcohol' : latestResult.test_type}` as any}
                                            className="flex items-center justify-center gap-2 text-xs font-bold dark:text-teal-400 text-brand-leaf dark:hover:text-teal-300 hover:text-brand-leaf/80 transition-colors py-1.5 px-4 rounded-lg dark:bg-teal-400/10 bg-brand-leaf/10 dark:hover:bg-teal-400/20 hover:bg-brand-leaf/20 border dark:border-teal-400/20 border-brand-leaf/20"
                                        >
                                            <RefreshCcw className="w-3.5 h-3.5" />
                                            Пройти тест
                                        </Link>
                                    </div>

                                    {historicalResults.length > 0 ? (
                                        <div className="dark:bg-slate-800 bg-white border dark:border-white/5 border-brand-sage/30 rounded-xl overflow-hidden transition-colors duration-300">
                                            <table className="w-full text-left text-xs dark:text-slate-300 text-brand-gray">
                                                <thead className="dark:bg-slate-900/50 bg-brand-sage/10 dark:text-slate-500 text-brand-gray border-b dark:border-white/5 border-brand-sage/30 uppercase tracking-tighter">
                                                    <tr>
                                                        <th className="px-4 py-3 font-bold">Дата</th>
                                                        <th className="px-4 py-3 font-bold text-right">Балл</th>
                                                        <th className="px-4 py-3 font-bold text-center">Тр.</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y dark:divide-white/5 divide-brand-sage/20">
                                                    {historicalResults.map((record: TestResult, idx: number) => {
                                                        return (
                                                            <tr key={idx} className="dark:hover:bg-slate-700/30 hover:bg-brand-sage/5 transition-colors">
                                                                <td className="px-4 py-3.5 font-medium">{new Date(record.created_at).toLocaleDateString()}</td>
                                                                <td className="px-4 py-3.5 dark:text-slate-100 text-brand-text font-bold text-right">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <div className={`w-1.5 h-1.5 rounded-full ${getTestConfig(record.test_type, record.score).statusColor}`} />
                                                                        {record.score}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3.5 flex justify-center items-center gap-3">
                                                                    <TrendIcon current={record.score} previous={idx < historicalResults.length - 1 ? historicalResults[idx + 1].score : record.score} />
                                                                    <button
                                                                        onClick={() => handleDeleteIndividual(record.id)}
                                                                        disabled={isDeleting === record.id}
                                                                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-brand-gray/40 hover:text-red-500 transition-colors"
                                                                        title="Удалить запись"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                        {isDeleting === record.id && '...'}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <p className="text-sm dark:text-slate-500 text-brand-gray italic text-center py-6 dark:bg-slate-800 bg-white rounded-xl border dark:border-white/5 border-brand-sage/30">
                                            Вы еще не сдавали этот тест повторно.
                                        </p>
                                    )}

                                    <div className="mt-5 p-3 px-4 dark:bg-teal-400/5 bg-brand-leaf/5 rounded-xl flex items-center gap-3 border dark:border-teal-400/10 border-brand-leaf/10">
                                        <Info className="w-4 h-4 dark:text-teal-400 text-brand-leaf shrink-0" />
                                        <p className="text-[11px] dark:text-slate-400 text-brand-gray/80 leading-tight font-medium">
                                            Показатели носят ознакомительный характер. Рекомендуем обсудить динамику со специалистом.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
