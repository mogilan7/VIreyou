"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import HRVChart from './HRVChart';
import VO2Chart from './VO2Chart';
import BioAgeRadar from './BioAgeRadar';
import HabitHeatmap from './HabitHeatmap';
import SleepPhasesChart from './SleepPhasesChart';
import { useRouter } from 'next/navigation';
import { useDashboardTheme } from '../ThemeContext';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Edit2, Trash2, Check, X as CloseIcon, Loader2, ArrowUpRight, ArrowDownRight, Wand2, RefreshCw, Activity } from 'lucide-react';
import { generateStage2Analysis, fetchAnalysisPreData } from '@/app/actions/analysis-action';
import AnalysisResultCard from './AnalysisResultCard';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const biomarkersConfig: Record<string, { name: string; unit: string; opt: string; min?: number; max?: number }> = {
    glucose: { name: 'Глюкоза', unit: 'ммоль/л', opt: '4.2–5.1', min: 4.2, max: 5.1 },
    ferritin: { name: 'Ферритин', unit: 'нг/мл', opt: '80–150', min: 80, max: 150 },
    cortisol: { name: 'Кортизол (утр)', unit: 'нмоль/л', opt: '150–450', min: 150, max: 450 },
    vitamin_d3: { name: 'Витамин D3', unit: 'нг/мл', opt: '60–100', min: 60, max: 100 },
    insulin: { name: 'Инсулин (натощак)', unit: 'мкЕд/мл', opt: '3.0–5.5', min: 3.0, max: 5.5 },
    ldl_cholesterol: { name: 'ЛПНП (Холестерин)', unit: 'ммоль/л', opt: '< 1.8', max: 1.8 },
    crp: { name: 'СРБ (Ультрачувствительный)', unit: 'мг/л', opt: '< 0.5', max: 0.5 },
    homocysteine: { name: 'Гомоцистеин', unit: 'мкмоль/л', opt: '5.0–7.5', min: 5.0, max: 7.5 },
};

interface DashboardViewsProps {
    profile: {
        full_name: string;
        id: string;
        email?: string;
    };
    testResults: any[];
    healthData: any;
    biomarkerResults?: any[];
    nutritionLogs?: any[];
    sleepLogs?: any[];
    activityLogs?: any[];
    habitLogs?: any[];
    hydrationLogs?: any[];
    user?: any;
}

const renderTextWithLinks = (text: string) => {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }
        parts.push(
            <a key={match.index} href={match[2]} className="text-brand-mint font-bold hover:underline transition-all">
                {match[1]}
            </a>
        );
        lastIndex = linkRegex.lastIndex;
    }
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }
    return parts.length > 0 ? parts : text;
};

export default function DashboardViews({ profile, testResults, healthData, biomarkerResults = [], nutritionLogs = [], sleepLogs = [], activityLogs = [], habitLogs = [], hydrationLogs = [], user }: DashboardViewsProps) {
    const router = useRouter();
    const { theme } = useDashboardTheme();
    const t = useTranslations('Dashboard.Analysis');
    
    // Theme-based variables
    const accentColor = theme === 'dark' ? 'text-teal-400' : 'text-brand-leaf';
    const accentBg = theme === 'dark' ? 'bg-teal-400' : 'bg-brand-leaf';
    const activeNavBorder = theme === 'dark' ? 'after:bg-teal-400' : 'after:bg-brand-leaf';

    // Stage 2 Analysis State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isPreparing, setIsPreparing] = useState(false);
    const [stagedData, setStagedData] = useState<any>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    const handlePrepareAnalysis = async () => {
        setIsPreparing(true);
        setAnalysisError(null);
        try {
            const result = await fetchAnalysisPreData();
            if (result.success) {
                setStagedData(result.data);
            } else {
                setAnalysisError(result.error || 'Failed to prepare data');
            }
        } catch (err: any) {
            setAnalysisError(err.message || 'Error occurred during preparation');
        } finally {
            setIsPreparing(false);
        }
    };

    const handleRunAnalysis = async () => {
        setIsAnalyzing(true);
        setAnalysisError(null);
        try {
            const result = await generateStage2Analysis();
            if (result.success) {
                toast.success(t('saveSuccess'));
                setStagedData(null);
                router.refresh();
            } else {
                setAnalysisError(result.error || 'Failed to run analysis');
            }
        } catch (err: any) {
            console.error(err);
            setAnalysisError(err.message || 'Error occurred during analysis');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const [activeView, setActiveView] = useState<'overview' | 'diagnostics' | 'recommendations'>('overview');
    const [showAllMarkers, setShowAllMarkers] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedMarkers, setSelectedMarkers] = useState<string[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const diaryScrollRef = React.useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);
    const [scrollRatio, setScrollRatio] = useState(0);

    const handleDownloadAIContext = () => {
        if (!stagedData) return;
        const dataStr = JSON.stringify(stagedData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-context-${profile.id.substring(0,6)}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleScroll = () => {
        if (!diaryScrollRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = diaryScrollRef.current;
        setCanScrollLeft(scrollLeft > 10);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
        setScrollRatio(scrollLeft / (scrollWidth - clientWidth || 1));
    };

    React.useEffect(() => {
        const container = diaryScrollRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
            handleScroll(); // Initial check
            window.addEventListener('resize', handleScroll);
            return () => {
                container.removeEventListener('scroll', handleScroll);
                window.removeEventListener('resize', handleScroll);
            };
        }
    }, []);

    const scrollDiary = (direction: 'left' | 'right') => {
        if (!diaryScrollRef.current) return;
        const container = diaryScrollRef.current;
        const scrollAmount = container.clientWidth; // прокрутка целыми "страницами"
        container.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        });
    };


    const getMarkerStatus = (key: string, value: number) => {
        const config = biomarkersConfig[key];
        if (!config) return 'teal';

        let isAbnormal = false;
        if (config.min !== undefined && value < config.min) isAbnormal = true;
        if (config.max !== undefined && value > config.max) isAbnormal = true;

        return isAbnormal ? 'amber' : 'teal';
    };

    // Merge hardcoded config with dynamic markers from the JSON field
    const allMarkers = React.useMemo(() => {
        const merged: Record<string, { name: string; value: any; unit: string; opt: string; status: string; trend?: 'up' | 'down' }> = {};

        // 1. Initialized with an empty set.
        // The table will only show results that have been confirmed and stored in history.

        // 2. Identify the lates value for EVERY biomarker from history (BiomarkerResult table)
        // Group all historical results by marker_key
        const grouped: Record<string, any[]> = {};
        biomarkerResults.forEach(res => {
            if (!grouped[res.marker_key]) grouped[res.marker_key] = [];
            grouped[res.marker_key].push(res);
        });

        Object.entries(grouped).forEach(([key, results]) => {
            // Sort by recorded_at descending
            const sorted = [...results].sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
            const latest = sorted[0];

            if (latest) {
                const config = biomarkersConfig[key];
                const markerName = config?.name || latest.marker_name || key;
                const markerUnit = latest.unit || config?.unit || '';
                const markerOpt = latest.reference_range || config?.opt || '-';

                // Determine status based on config or default logic
                let status = 'teal';
                if (config) {
                    status = getMarkerStatus(key, latest.value);
                } else if (latest.status) {
                    status = latest.status.toLowerCase() === 'abnormal' ? 'amber' : 'teal';
                }

                merged[key] = {
                    name: markerName,
                    value: latest.value,
                    unit: markerUnit,
                    opt: markerOpt,
                    status: status
                };

                // Trend: Compare with previous unique entry point
                if (sorted.length >= 2) {
                    const previous = sorted[1];
                    if (latest.value > previous.value) merged[key].trend = 'up';
                    else if (latest.value < previous.value) merged[key].trend = 'down';
                }
            }
        });

        return merged;
    }, [healthData, biomarkersConfig, biomarkerResults]);

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
            case 'sarc-f':
                return score >= 4 ? 'bg-red-500/20 text-red-500' // High risk (>= 4)
                    : `bg-${colorMode}/20 text-${colorMode}`;
            case 'energy':
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
    const sarcF = getLatestTest('sarc-f');
    const energy = getLatestTest('energy');
    const bioAge = getLatestTest('systemic-bio-age') || getLatestTest('bio-age'); 
    const bioAgeRaw = getLatestTest('systemic-bio-age')?.rawData || {}; // Contains { cardio: 30, ... }

    const radarData = [
        { subject: 'ССС', A: bioAgeRaw.cardio || 46, fullMark: 65 },
        { subject: 'Мышцы', A: bioAgeRaw.flexibility || 35, fullMark: 65 },
        { subject: 'Реакция', A: bioAgeRaw.reaction || 35, fullMark: 65 },
        { subject: 'Коорд.', A: bioAgeRaw.coordination || 30, fullMark: 65 },
        { subject: 'Вестиб.', A: bioAgeRaw.vestibular || 60, fullMark: 65 },
        { subject: 'Кожа', A: bioAgeRaw.skin || 35, fullMark: 65 },
        { subject: 'Суставы', A: bioAgeRaw.joints || 37, fullMark: 65 },
    ];

    const toggleMarkerSelection = (key: string) => {
        setSelectedMarkers(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const handleDeleteMarkers = async () => {
        if (selectedMarkers.length === 0) return;
        if (!confirm(`Вы уверены, что хотите удалить выбранные показатели (${selectedMarkers.length})?`)) return;

        setIsDeleting(true);
        try {
            const response = await fetch('/api/cabinet/health-data/delete-markers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markerKeys: selectedMarkers })
            });

            if (response.ok) {
                // Success - reset state and refresh
                setSelectedMarkers([]);
                setIsEditMode(false);
                router.refresh();
            } else {
                const data = await response.json();
                alert(`Ошибка: ${data.error}`);
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Произошла ошибка при удалении');
        } finally {
            setIsDeleting(false);
        }
    };

    const renderRecommendations = () => {
        const latestAiRec = testResults?.find((r: any) => r.test_type === 'ai-recommendation');
        const latestAnalysis = testResults?.find((r: any) => r.test_type === 'stage-2-analysis');
        const recommendedTests = latestAiRec?.rawData?.recommendedTests || [];
        const TEST_ALIASES: Record<string, string[]> = {
            'alcohol': ['RU-AUDIT', 'alcohol'],
            'systemic-bio-age': ['bio-age', 'systemic-bio-age'],
            'bio-age': ['systemic-bio-age', 'bio-age']
        };
        const completedCount = recommendedTests.filter((tid: string) => {
            const aliases = TEST_ALIASES[tid] || [tid];
            return testResults.some((r: any) => aliases.includes(r.test_type));
        }).length;
        const totalCount = recommendedTests.length;
        const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        const nextDate = latestAiRec?.created_at ? new Date(new Date(latestAiRec.created_at).getTime() + 8 * 24 * 60 * 60 * 1000).toLocaleDateString('ru-RU') : 'Не определена';
        const report = latestAiRec?.rawData?.report || latestAiRec?.interpretation || '';

        const TEST_NAMES: Record<string, string> = {
            'systemic-bio-age': 'Системный Биовозраст',
            'insomnia': 'Индекс бессонницы',
            'circadian': 'Циркадные ритмы',
            'energy': 'Калькулятор TDEE',
            'nicotine': 'Тест Фагерстрема',
            'alcohol': 'RUS-AUDIT',
            'sarc-f': 'SARC-F',
            'greene-scale': 'Шкала Грина',
            'ipss': 'IPSS',
            'mief-5': 'МИЭФ-5',
            'score': 'SCORE'
        };

        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b dark:border-slate-800 border-brand-sage/40 pb-6">
                    <div>
                        <h2 className="text-xl font-bold dark:text-slate-100 text-brand-text mb-1">План терапии и Назначения</h2>
                        <p className="text-xs opacity-60">Четыре шага к вашей системе долголетия</p>
                    </div>
                    
                    {totalCount > 0 && (
                        <div className="mt-4 md:mt-0 flex flex-col items-start md:items-end gap-1">
                            <div className="flex items-center gap-2 text-xs font-bold text-brand-forest dark:text-teal-400">
                                <span>Выполнение рекомендаций:</span>
                                <span>{completedCount}/{totalCount} ({pct}%)</span>
                            </div>
                            <div className="w-48 h-2 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden border dark:border-white/5 border-slate-200">
                                <div className={`h-full ${accentBg} transition-all duration-500`} style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">
                                Следующий этап Анализ: <span className="text-brand-forest dark:text-teal-400 font-bold">{nextDate}</span>
                            </p>
                        </div>
                    )}
                </div>

                {/* Шкала Дневника Мониторинга (30 дней) */}
                {latestAiRec && (
                    <div className="p-6 dark:bg-slate-800 bg-white border dark:border-white/5 border-brand-sage/30 rounded-2xl shadow-md space-y-4 transition-all">
                        <div className="flex items-center justify-between gap-2 border-b dark:border-white/5 border-brand-sage/20 pb-2 mb-2">
                            <div>
                                <h4 className="text-sm font-bold dark:text-slate-100 text-brand-text mb-1">Дневник мониторинга в ТГ-боте (30 дней)</h4>
                                <p className="text-[10px] opacity-60">Заполняйте данные ежедневно для перехода к этапу «Анализ»</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button 
                                    onClick={() => scrollDiary('left')}
                                    disabled={!canScrollLeft}
                                    className={`p-1.5 rounded-full dark:bg-slate-700 bg-slate-100 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer ${!canScrollLeft ? 'opacity-30 cursor-not-allowed' : ''}`}
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <button 
                                    onClick={() => scrollDiary('right')}
                                    disabled={!canScrollRight}
                                    className={`p-1.5 rounded-full dark:bg-slate-700 bg-slate-100 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer ${!canScrollRight ? 'opacity-30 cursor-not-allowed' : ''}`}
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                        
                        <div ref={diaryScrollRef} className="grid grid-flow-col items-center gap-2 md:gap-3 auto-cols-[calc((100%-32px)/5)] md:auto-cols-[calc((100%-72px)/7)] overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory w-full">
                            {Array.from({ length: 30 }).map((_, i) => {
                                const dayDate = new Date(new Date(latestAiRec.created_at).getTime() + i * 24 * 60 * 60 * 1000);
                                const formattedDate = dayDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
                                
                                const isSameDay = (log: any) => {
                                    const d = new Date(log.date || log.created_at || log);
                                    return d.getDate() === dayDate.getDate() && d.getMonth() === dayDate.getMonth() && d.getFullYear() === dayDate.getFullYear();
                                };
                                
                                const hasNutrition = (nutritionLogs || []).some(isSameDay);
                                const hasSleep = (sleepLogs || []).some(isSameDay);
                                const hasActivity = (activityLogs || []).some(isSameDay);
                                const hasHabits = (habitLogs || []).some(isSameDay) || (hydrationLogs || []).some(isSameDay);
                                
                                const count = [hasNutrition, hasSleep, hasActivity, hasHabits].filter(Boolean).length;
                                
                                let bgColor = "bg-slate-100 dark:bg-slate-700/40 text-slate-400";
                                if (count === 4 || count === 3) bgColor = "bg-green-500 text-white";
                                else if (count >= 1) bgColor = "bg-amber-400 text-white";
                                
                                const isFuture = dayDate > new Date();
                                
                                return (
                                    <div key={i} className={`flex flex-col items-center gap-1 min-w-0 snap-start ${isFuture ? 'opacity-30' : ''}`}>
                                        <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs ${bgColor} shadow-sm border dark:border-white/5`}>
                                            Д{i+1}
                                        </div>
                                        <span className="text-[8px] opacity-50">{formattedDate}</span>
                                        <div className="flex gap-0.5 mt-0.5">
                                            <span className={`w-1 h-1 rounded-full ${hasNutrition ? 'bg-green-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
                                            <span className={`w-1 h-1 rounded-full ${hasSleep ? 'bg-green-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
                                            <span className={`w-1 h-1 rounded-full ${hasActivity ? 'bg-green-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
                                            <span className={`w-1 h-1 rounded-full ${hasHabits ? 'bg-green-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Прогресс-бар навигации */}
                        <div className="w-full px-1 mt-2">
                            <div className="w-full h-[3px] bg-slate-100 dark:bg-slate-700/30 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full ${accentBg} transition-all duration-150`} 
                                    style={{ width: `${(scrollRatio || 0) * 100}%` }} 
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-6">
                    {/* Этап 01 - Диалог */}
                    <div className="p-6 dark:bg-slate-800 bg-white border dark:border-white/5 border-brand-sage/30 rounded-2xl shadow-md flex flex-col md:flex-row gap-6 items-start transition-all hover:shadow-lg">
                        <div className="text-5xl font-serif text-brand-sage/40 dark:text-teal-400/20 font-bold md:w-20 pt-1">01</div>
                        <div className="flex-1 w-full">
                            <h4 className="text-lg font-bold mb-1 dark:text-slate-100 text-brand-text">Диалог</h4>
                            <p className="text-xs opacity-60 mb-4">Первичный запрос и обсуждение ваших ожиданий от программы.</p>
                            
                            <div className="mt-2">
                                {latestAiRec ? (
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border dark:border-white/5 border-brand-sage/10 shadow-sm overflow-y-auto max-h-[300px]">
                                        <p className="text-[10px] font-bold text-brand-forest dark:text-teal-400 mb-2">Последняя консультация ИИ</p>
                                        <div className="prose prose-xs sm:prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {report}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-6 border border-dashed rounded-xl border-slate-200 dark:border-slate-700">
                                        <p className="text-xs opacity-50 italic text-center">Консультаций не найдено. Пройдите диалог.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Этап 02 - Анализ */}
                    <div className="p-6 dark:bg-slate-800 bg-white border dark:border-white/5 border-brand-sage/30 rounded-2xl shadow-md flex flex-col md:flex-row gap-6 items-start transition-all hover:shadow-lg">
                        <div className="text-5xl font-serif text-brand-sage/30 dark:text-slate-700/40 font-bold md:w-20 pt-1">02</div>
                        <div className="flex-1 w-full">
                            <h4 className="text-lg font-bold mb-1 dark:text-slate-100 text-brand-text">{t('title')}</h4>
                            <p className="text-xs opacity-60 mb-4">{t('description')}</p>
                            
                            <div className="mt-4">
                                {stagedData ? (
                                    <div className="space-y-6 p-6 rounded-2xl bg-brand-sage/5 dark:bg-slate-900/40 border border-brand-sage/20 dark:border-white/5 animate-in fade-in zoom-in-95 duration-300">
                                        <div className="flex justify-between items-center mb-2">
                                            <h5 className="font-bold text-sm dark:text-slate-100">{t('stagedTitle')}</h5>
                                            <div className="flex gap-4 items-center">
                                                {profile.email === 'mogilev.andrey@gmail.com' && (
                                                    <button 
                                                        onClick={handleDownloadAIContext} 
                                                        className="text-[10px] text-brand-forest dark:text-teal-400 font-bold border border-brand-sage/40 dark:border-teal-400/30 px-2 py-0.5 rounded hover:bg-brand-sage/10 dark:hover:bg-teal-400/10 transition-colors"
                                                        title="Admin Only: Download AI Context Payload"
                                                    >
                                                        Скачать AI Контекст
                                                    </button>
                                                )}
                                                <button 
                                                  onClick={() => setStagedData(null)}
                                                  className="text-[10px] text-slate-400 hover:text-red-400"
                                                >
                                                  {t('cancelBtn')}
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-[10px] opacity-60 mb-6">{t('stagedSubtitle')}</p>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          {/* Nutrition Pillar */}
                                          <div className="p-4 bg-white/50 dark:bg-slate-800/80 rounded-2xl border border-brand-sage/10 shadow-sm flex flex-col">
                                            <div className="flex items-center gap-2 mb-3">
                                              <span className="text-lg">🥗</span>
                                              <p className="text-[10px] font-bold text-brand-forest dark:text-teal-400 uppercase tracking-wider">{t('nutrition')}</p>
                                              <span className="ml-auto text-[9px] px-1.5 py-0.5 bg-brand-sage/10 rounded">{stagedData.metrics.nutrition.days}дн</span>
                                            </div>
                                            <div className="flex justify-between items-center mb-2 px-1">
                                              <span className="text-[12px] font-medium">{stagedData.metrics.nutrition.avgCalories} ккал</span>
                                              <span className="text-[10px] opacity-40">в день</span>
                                            </div>
                                            <div className="flex-1 max-h-[140px] overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                                              {stagedData.metrics.nutrition.nutrients.map((n: any, idx: number) => (
                                                <div key={idx} className="flex justify-between items-center text-[11px] py-1 border-b border-brand-sage/5 last:border-0 hover:bg-brand-sage/5 px-1 rounded transition-colors">
                                                  <span className="opacity-60">{n.name}</span>
                                                  <span className="font-medium">{n.val} {n.unit}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>

                                          <div className="space-y-4">
                                            {/* Sleep Pillar */}
                                            <div className="p-4 bg-white/50 dark:bg-slate-800/80 rounded-2xl border border-brand-sage/10 shadow-sm">
                                              <div className="flex items-center gap-2 mb-3">
                                                <span className="text-lg">🌙</span>
                                                <p className="text-[10px] font-bold text-brand-forest dark:text-teal-400 uppercase tracking-wider">{t('sleep')}</p>
                                                <span className="ml-auto text-[9px] px-1.5 py-0.5 bg-brand-sage/10 rounded">{stagedData.metrics.sleep.days}дн</span>
                                              </div>
                                              <div className="grid grid-cols-2 gap-2 text-[11px]">
                                                <div className="p-2 bg-brand-sage/5 rounded-lg flex flex-col">
                                                  <span className="opacity-50 text-[9px] mb-1">Всего</span>
                                                  <span className="font-bold">{stagedData.metrics.sleep.avgHours.toFixed(1)}ч</span>
                                                </div>
                                                <div className="p-2 bg-brand-sage/5 rounded-lg flex flex-col">
                                                  <span className="opacity-50 text-[9px] mb-1">Глубокий</span>
                                                  <span className="font-bold">{stagedData.metrics.sleep.avgDeep.toFixed(1)}ч</span>
                                                </div>
                                                <div className="p-2 bg-brand-sage/5 rounded-lg flex flex-col">
                                                  <span className="opacity-50 text-[9px] mb-1">HRV (ср)</span>
                                                  <span className="font-bold">{Math.round(stagedData.metrics.sleep.avgHRV)} мс</span>
                                                </div>
                                                <div className="p-2 bg-brand-sage/5 rounded-lg flex flex-col">
                                                  <span className="opacity-50 text-[9px] mb-1">ЧСС</span>
                                                  <span className="font-bold">{Math.round(stagedData.metrics.sleep.avgRHR || 60)} уд</span>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Activity Pillar */}
                                            <div className="p-4 bg-white/50 dark:bg-slate-800/80 rounded-2xl border border-brand-sage/10 shadow-sm">
                                              <div className="flex items-center gap-2 mb-2">
                                                <span className="text-lg">🏃</span>
                                                <p className="text-[10px] font-bold text-brand-forest dark:text-teal-400 uppercase tracking-wider">Физ-активность</p>
                                                <span className="ml-auto text-[9px] px-1.5 py-0.5 bg-brand-sage/10 rounded">{stagedData.metrics.activity.days}дн</span>
                                              </div>
                                              <div className="flex justify-between items-center py-1">
                                                <span className="text-[11px] opacity-60">Шаги (среднее)</span>
                                                <span className="text-[12px] font-bold">{Math.round(stagedData.metrics.activity.avgSteps)}</span>
                                              </div>
                                              <div className="flex justify-between items-center py-1">
                                                <span className="text-[11px] opacity-60">Активные мин.</span>
                                                <span className="text-[12px] font-bold">{stagedData.metrics.activity.avgActiveMin}</span>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Hydration Pillar */}
                                          <div className="p-4 bg-white/50 dark:bg-slate-800/80 rounded-2xl border border-brand-sage/10 shadow-sm">
                                            <div className="flex items-center gap-2 mb-3">
                                              <span className="text-lg">💧</span>
                                              <p className="text-[10px] font-bold text-brand-forest dark:text-teal-400 uppercase tracking-wider">Гидратация</p>
                                              <span className="ml-auto text-[9px] px-1.5 py-0.5 bg-brand-sage/10 rounded">{stagedData.metrics.hydration.days}дн</span>
                                            </div>
                                            <div className="flex items-end gap-1 mb-2">
                                              <span className="text-xl font-bold">{stagedData.metrics.hydration.avgVolume}</span>
                                              <span className="text-[10px] opacity-50 mb-1">мл / день</span>
                                            </div>
                                            <div className="w-full bg-brand-sage/10 h-1.5 rounded-full overflow-hidden">
                                              <div 
                                                className="bg-teal-500 h-full transition-all duration-1000" 
                                                style={{ width: `${Math.min(100, (stagedData.metrics.hydration.avgVolume / 2000) * 100)}%` }}
                                              />
                                            </div>
                                          </div>

                                          {/* Habits Pillar */}
                                          <div className="p-4 bg-white/50 dark:bg-slate-800/80 rounded-2xl border border-brand-sage/10 shadow-sm flex flex-col group hover:border-brand-mint/50 transition-all">
                                            <div className="flex items-center gap-2 mb-3">
                                              <span className="text-lg group-hover:scale-110 transition-transform">⚡</span>
                                              <p className="text-[10px] font-bold text-brand-forest dark:text-teal-400 uppercase tracking-wider">Привычки / Фокус</p>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 mb-2">
                                              {stagedData.metrics.habits.list.length > 0 ? (
                                                stagedData.metrics.habits.list.map((habit: string, i: number) => (
                                                  <span key={i} className="text-[9px] px-2 py-0.5 bg-brand-forest/80 dark:bg-brand-mint/20 text-white dark:text-brand-mint rounded-full border border-transparent dark:border-brand-mint/30 transition-all hover:bg-brand-forest dark:hover:bg-brand-mint/40">
                                                    {habit}
                                                  </span>
                                                ))
                                              ) : (
                                                <p className="text-[10px] opacity-30 italic">Привычки не отмечены</p>
                                              )}
                                            </div>
                                            <div className="mt-auto pt-2 border-t border-brand-sage/5">
                                                <p className="text-[9px] opacity-50 flex justify-between">
                                                    <span>Всего выполнений:</span>
                                                    <span className="font-bold text-brand-forest dark:text-teal-400">{stagedData.metrics.habits.completedCount}</span>
                                                </p>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Profile summary banner */}
                                        <div className="mt-4 p-5 bg-gradient-to-r from-brand-forest/5 to-transparent dark:from-brand-mint/5 dark:to-transparent rounded-2xl border border-brand-sage/20 dark:border-white/5 flex flex-wrap gap-8 items-center">
                                          <div>
                                            <p className="text-[9px] uppercase font-bold opacity-40 mb-1 tracking-widest">Возраст</p>
                                            <div className="flex items-baseline gap-1">
                                                <p className="text-xl font-bold text-brand-forest dark:text-brand-mint">{stagedData.age}</p>
                                                <span className="text-[10px] opacity-40">лет</span>
                                            </div>
                                          </div>
                                          <div>
                                            <p className="text-[9px] uppercase font-bold opacity-40 mb-1 tracking-widest">Текущий вес</p>
                                            <div className="flex items-baseline gap-1">
                                                <p className="text-xl font-bold text-brand-forest dark:text-brand-mint">{stagedData.metrics.anthropometry.weight}</p>
                                                <span className="text-[10px] opacity-40">кг</span>
                                            </div>
                                          </div>
                                          <div>
                                            <p className="text-[9px] uppercase font-bold opacity-40 mb-1 tracking-widest">Обхват талии</p>
                                            <div className="flex items-baseline gap-1">
                                                <p className="text-xl font-bold text-brand-forest dark:text-brand-mint">{stagedData.metrics.anthropometry.waist}</p>
                                                <span className="text-[10px] opacity-40">см</span>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="px-4 py-2 bg-brand-mint/10 border border-brand-mint/20 rounded-xl flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full bg-brand-mint animate-pulse" />
                                          <p className="text-[10px] font-medium text-brand-forest dark:text-brand-mint">
                                            ИИ проанализирует не только средние, но и **полную структуру вашего сна и активности** за все 7 дней.
                                          </p>
                                        </div>

                                        <div className="pt-4 flex flex-col gap-3">
                                          <button 
                                              onClick={handleRunAnalysis}
                                              disabled={isAnalyzing}
                                              className="w-full py-4 bg-brand-forest dark:bg-brand-mint text-white dark:text-brand-forest rounded-2xl font-bold text-sm shadow-xl shadow-brand-forest/20 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70"
                                          >
                                              {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />}
                                              {isAnalyzing ? t('loading') : t('confirmBtn')}
                                          </button>
                                        </div>
                                    </div>
                                ) : latestAnalysis ? (
                                    <div className="space-y-4">
                                        <AnalysisResultCard content={latestAnalysis.interpretation} />
                                        <button 
                                            onClick={handlePrepareAnalysis}
                                            disabled={isAnalyzing || isPreparing}
                                            className="w-full mt-2 flex items-center justify-center gap-2 py-3 border border-brand-forest/20 dark:border-brand-mint/20 rounded-xl text-xs font-bold text-brand-forest dark:text-brand-mint hover:bg-brand-sage/10 dark:hover:bg-brand-mint/5 transition-all disabled:opacity-50"
                                        >
                                            {isAnalyzing || isPreparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                            {isAnalyzing || isPreparing ? t('loading') : t('reRunBtn')}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-2xl border-brand-sage/30 dark:border-white/10 bg-slate-50/30 dark:bg-slate-900/20">
                                        <div className="p-3 bg-brand-sage/10 rounded-full mb-3">
                                            <Wand2 className="w-6 h-6 text-brand-forest/40" />
                                        </div>
                                        <p className="text-xs text-slate-400 text-center mb-6 max-w-[240px]">
                                            {t('noData')}
                                        </p>
                                        <button 
                                            onClick={handlePrepareAnalysis}
                                            disabled={isPreparing}
                                            className="px-6 py-3 bg-brand-forest dark:bg-brand-mint text-white dark:text-brand-forest rounded-xl font-bold text-sm shadow-lg shadow-brand-forest/20 flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70"
                                        >
                                            {isPreparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                                            {isPreparing ? t('loading') : t('runBtn')}
                                        </button>
                                        {analysisError && (
                                            <p className="text-[10px] text-red-500 mt-4 font-medium">{analysisError}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Этап 03 - Ориентиры */}
                    <div className="p-6 dark:bg-slate-800 bg-white border dark:border-white/5 border-brand-sage/30 rounded-2xl shadow-md flex flex-col md:flex-row gap-6 items-start transition-all hover:shadow-lg">
                        <div className="text-5xl font-serif text-brand-sage/30 dark:text-slate-700/40 font-bold md:w-20 pt-1">03</div>
                        <div className="flex-1 w-full">
                            <h4 className="text-lg font-bold mb-1 dark:text-slate-100 text-brand-text">Ориентиры</h4>
                            <p className="text-xs opacity-60 mb-2">Выбор конкретных точек воздействия для достижения целей.</p>
                            <div className="mt-3 flex">
                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium bg-slate-500/10 px-2 py-1 rounded">В разработке</span>
                            </div>
                        </div>
                    </div>

                    {/* Этап 04 - Система */}
                    <div className="p-6 dark:bg-slate-800 bg-white border dark:border-white/5 border-brand-sage/30 rounded-2xl shadow-md flex flex-col md:flex-row gap-6 items-start transition-all hover:shadow-lg">
                        <div className="text-5xl font-serif text-brand-sage/30 dark:text-slate-700/40 font-bold md:w-20 pt-1">04</div>
                        <div className="flex-1 w-full">
                            <h4 className="text-lg font-bold mb-1 dark:text-slate-100 text-brand-text">Система</h4>
                            <p className="text-xs opacity-60 mb-2">Рекомендации, процедуры и поддержка на пути к результату.</p>
                            <div className="mt-3 flex">
                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium bg-slate-500/10 px-2 py-1 rounded">В разработке</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto font-sans dark:text-slate-50 text-brand-text transition-colors duration-300">
            {/* HEADER */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 border-b dark:border-slate-800 border-brand-sage/40 pb-6">
                <div>
                    <h1 className="text-sm font-medium opacity-50 uppercase tracking-widest mb-1">Health Intelligence</h1>
                    <div className="h-8"></div> {/* Spacer node */}
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
                    <button
                        onClick={() => setActiveView('recommendations')}
                        className={`relative pb-2 transition-all opacity-50 ${activeView === 'recommendations' ? `opacity-100 ${accentColor} after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] ${activeNavBorder}` : 'hover:opacity-100'}`}
                    >
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
                                           {/* Питание */}
                            <div className="dark:bg-slate-800 bg-white border dark:border-white/5 border-brand-sage/30 rounded-2xl p-6 shadow-md transition-colors duration-300">
                                <h3 className="font-semibold dark:text-slate-300 text-brand-text mb-6">Цели и Нутриенты</h3>
                                
                                {user?.target_calories ? (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">СУТОЧНАЯ ЦЕЛЬ</p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className={`text-4xl font-black ${accentColor}`}>{user.target_calories}</span>
                                                    <span className="text-xs font-bold opacity-40">ккал</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">ЦЕЛЬ</p>
                                                <p className="text-xs font-bold">{user.goal === 'lose_weight' ? 'Снижение веса' : user.goal === 'gain_muscle' ? 'Набор массы' : 'Поддержание'}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="p-3 dark:bg-slate-900/50 bg-brand-sage/10 rounded-xl border dark:border-white/5 border-brand-sage/20">
                                                <p className="text-[9px] uppercase tracking-tighter opacity-40 mb-1 text-center">БЕЛКИ</p>
                                                <p className="text-lg font-bold text-center">{user.target_protein}г</p>
                                            </div>
                                            <div className="p-3 dark:bg-slate-900/50 bg-brand-sage/10 rounded-xl border dark:border-white/5 border-brand-sage/20">
                                                <p className="text-[9px] uppercase tracking-tighter opacity-40 mb-1 text-center">ЖИРЫ</p>
                                                <p className="text-lg font-bold text-center">{user.target_fat}г</p>
                                            </div>
                                            <div className="p-3 dark:bg-slate-900/50 bg-brand-sage/10 rounded-xl border dark:border-white/5 border-brand-sage/20">
                                                <p className="text-[9px] uppercase tracking-tighter opacity-40 mb-1 text-center">УГЛЕВОДЫ</p>
                                                <p className="text-lg font-bold text-center">{user.target_carbs}г</p>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t dark:border-white/5 border-brand-sage/30">
                                            <div className="flex justify-between text-xs mb-2">
                                                <span className="opacity-60">Нутрицевтическая плотность</span>
                                                <span className="font-medium">{healthData?.nutrient_density_pct || 92}%</span>
                                            </div>
                                            <div className="w-full h-1.5 dark:bg-slate-700 bg-brand-sage/20 rounded-full">
                                                <div className={`h-full ${accentBg}`} style={{ width: `${healthData?.nutrient_density_pct || 92}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
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
                                                    <div className={`h-full ${accentBg}`} style={{ width: `${healthData?.nutrient_density_pct || 92}%` }}></div>
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
                                    </>
                                )}
                            </div>text-[10px] mb-1 opacity-50">
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
                                            {Object.entries(allMarkers)
                                                .filter(([, data]) => data.status === 'amber')
                                                .map(([key, data]) => (
                                                    <tr key={key}>
                                                        <td className="py-3 font-medium">{data.name}</td>
                                                        <td className="text-right text-amber-400">{data.value} {data.unit}</td>
                                                        <td className="text-right opacity-50">{data.opt}</td>
                                                        <td className="text-right"><span className="w-2 h-2 inline-block rounded-full bg-amber-400"></span></td>
                                                    </tr>
                                                ))
                                            }
                                            {Object.entries(allMarkers)
                                                .filter(([, data]) => data.status === 'teal')
                                                .slice(0, Math.max(0, 4 - Object.entries(allMarkers).filter(([, data]) => data.status === 'amber').length))
                                                .map(([key, data]) => (
                                                    <tr key={key}>
                                                        <td className="py-3 font-medium">{data.name}</td>
                                                        <td className="text-right">{data.value} {data.unit}</td>
                                                        <td className="text-right opacity-50">{data.opt}</td>
                                                        <td className="text-right"><span className={`w-2 h-2 inline-block rounded-full ${accentBg}`}></span></td>
                                                    </tr>
                                                ))
                                            }
                                            {Object.keys(allMarkers).length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="py-8 text-center opacity-30 italic">Нет данных для отображения</td>
                                                </tr>
                                            )}
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
                                    &quot;Уровень кортизола превышает оптимум на 20%. Рекомендуется добавить 15 мин низкоинтенсивной прогулки после ужина и перенести прием магния на 21:00.&quot;
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
                                    <BioAgeRadar data={radarData} />
                                </div>
                            </div>

                            <div className="lg:col-span-2 space-y-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                                    {[
                                        { label: 'Сердечно-сосуд.', value: bioAgeRaw.cardio || '46' },
                                        { label: 'Мышцы', value: bioAgeRaw.flexibility || '35' },
                                        { label: 'Реакция', value: bioAgeRaw.reaction || '35' },
                                        { label: 'Координация', value: bioAgeRaw.coordination || '30' },
                                        { label: 'Вестиб. апп.', value: bioAgeRaw.vestibular || '60' },
                                        { label: 'Кожа', value: bioAgeRaw.skin || '35' },
                                        { label: 'Суставы', value: bioAgeRaw.joints || '37' },
                                    ].map((stat, i) => {
                                        const numValue = Number(stat.value);
                                        const chronAge = healthData?.biological_age_actual || 40;
                                        const isHigh = numValue >= chronAge + 10;
                                        const isWarning = numValue >= chronAge + 4;
                                        
                                        const color = isHigh ? 'text-red-500 dark:text-red-400' : isWarning ? 'text-amber-500 dark:text-amber-400' : accentColor;
                                        const status = isHigh ? 'Критично' : isWarning ? 'В зоне риска' : '';

                                        return (
                                            <div key={i} className="p-4 dark:bg-slate-900/40 bg-brand-sage/10 rounded-xl border dark:border-white/5 border-brand-sage/20 transition-colors duration-300">
                                                <p className="text-[10px] opacity-40 uppercase mb-2">{stat.label}</p>
                                                <p className={`text-2xl font-bold ${color}`}>{stat.value}</p>
                                                {status && <p className={`text-[10px] opacity-80 mt-1 ${color}`}>{status}</p>}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="dark:bg-slate-800 bg-white border dark:border-white/5 border-brand-sage/30 rounded-2xl p-6 shadow-md overflow-hidden transition-colors duration-300">
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex items-center gap-4">
                                            <h3 className="text-sm font-bold uppercase opacity-40">Лабораторная панель (Анализы)</h3>
                                            <button
                                                onClick={() => {
                                                    setIsEditMode(!isEditMode);
                                                    setSelectedMarkers([]);
                                                }}
                                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all
                                                    ${isEditMode
                                                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                                        : 'bg-slate-500/10 text-slate-500 border border-transparent hover:bg-slate-500/20'}`}
                                            >
                                                {isEditMode ? <><CloseIcon size={12} /> Отмена</> : <><Edit2 size={12} /> Редактировать</>}
                                            </button>

                                            {isEditMode && selectedMarkers.length > 0 && (
                                                <button
                                                    onClick={handleDeleteMarkers}
                                                    disabled={isDeleting}
                                                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] font-bold uppercase tracking-wider hover:bg-red-500/20 transition-all disabled:opacity-50"
                                                >
                                                    {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                                    Удалить ({selectedMarkers.length})
                                                </button>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setShowAllMarkers(!showAllMarkers)}
                                            className={`text-xs flex items-center gap-1 ${accentColor} hover:opacity-80 transition-opacity`}
                                        >
                                            {showAllMarkers ? (
                                                <><ChevronUp size={14} /> Свернуть</>
                                            ) : (
                                                <><ChevronDown size={14} /> Показать все</>
                                            )}
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-[10px] opacity-30 border-b dark:border-slate-700 border-brand-sage/30 transition-colors duration-300">
                                                    {isEditMode && <th className="text-left pb-4 w-10"></th>}
                                                    <th className="text-left pb-4 font-medium uppercase">Маркер</th>
                                                    <th className="text-right pb-4 font-medium uppercase">Результат</th>
                                                    <th className="text-right pb-4 font-medium uppercase">Оптимум Longevity</th>
                                                    <th className="text-right pb-4 font-medium uppercase">Статус</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(allMarkers)
                                                    .slice(0, showAllMarkers ? undefined : 4)
                                                    .map(([key, data]) => {
                                                        const status = (data as any).status;
                                                        const isSelected = selectedMarkers.includes(key);
                                                        const trend = (data as any).trend;
                                                        return (
                                                            <tr key={key} className="border-b dark:border-slate-700/30 border-brand-sage/10 transition-colors duration-300 hover:bg-slate-50/50 dark:hover:bg-white/5">
                                                                {isEditMode && (
                                                                    <td className="py-3">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isSelected}
                                                                            onChange={() => toggleMarkerSelection(key)}
                                                                            className="w-4 h-4 rounded border-brand-sage/30 text-teal-500 focus:ring-teal-500/20"
                                                                        />
                                                                    </td>
                                                                )}
                                                                <td className="py-3 font-medium flex items-center gap-2">
                                                                    {(data as any).name}
                                                                    {trend === 'up' && <ArrowUpRight size={14} className="text-amber-500" />}
                                                                    {trend === 'down' && <ArrowDownRight size={14} className="text-teal-500" />}
                                                                </td>
                                                                <td className={`text-right font-mono ${status === 'amber' ? 'text-amber-400' : ''}`}>{(data as any).value} {(data as any).unit}</td>
                                                                <td className="text-right opacity-50">{(data as any).opt}</td>
                                                                <td className="text-right">
                                                                    <span className={`w-1.5 h-1.5 inline-block rounded-full ${status === 'teal' ? accentBg : 'bg-amber-400'}`}></span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                }
                                                {Object.keys(allMarkers).length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="py-12 text-center opacity-30 italic">Список анализов пуст. Загрузите документы в архиве.</td>
                                                    </tr>
                                                )}
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
                                    { name: 'SARC-F (Мышцы)', data: sarcF, total: '', type: 'sarc-f' },
                                    { name: 'Расход энергии', data: energy, total: ' ккал', type: 'energy' },
                                    { name: 'Био-Возраст', data: bioAge, total: ' лет', type: 'bio-age' },
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

            {activeView === 'recommendations' && renderRecommendations()}

        </div>
    );
}
