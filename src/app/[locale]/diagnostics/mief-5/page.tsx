"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Activity, 
  Info, 
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { saveTestResult } from '@/actions/save-test';
import { createClient } from '@/utils/supabase/client';

export default function Mief5Page() {
    const t = useTranslations('MIEF5');

    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [showResults, setShowResults] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [saveErrorString, setSaveErrorString] = useState<string | null>(null);

    const resultsRef = useRef<HTMLDivElement>(null);
    const supabase = createClient();

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setIsAuthenticated(!!session);
        };
        checkAuth();
    }, []);

    const QUESTIONS = [
        { id: 1 },
        { id: 2 },
        { id: 3 },
        { id: 4 },
        { id: 5 }
    ];

    // Fetch and format options
    const rawOptions = useMemo(() => {
        try {
            return {
                q1_q4: (t.raw('options.q1_q4') as string[]).map((label, i) => ({ value: i + 1, label })),
                q5: (t.raw('options.q5') as string[]).map((label, i) => ({ value: i + 1, label }))
            };
        } catch (e) {
            console.error("Failed to load options", e);
            return { q1_q4: [], q5: [] };
        }
    }, [t]);

    const handleAnswer = (questionId: number, value: number) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    };

    const resetForm = () => {
        setAnswers({});
        setShowResults(false);
        setSaveStatus('idle');
        setSaveErrorString(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const progress = Object.keys(answers).length;
    const isComplete = progress === QUESTIONS.length;

    useEffect(() => {
        if (isComplete && !showResults) {
            const timer = setTimeout(() => {
                setShowResults(true);
                resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isComplete, showResults]);

    const totalScore = useMemo(() => {
        if (!isComplete) return 0;
        return Object.values(answers).reduce((acc, curr) => acc + curr, 0);
    }, [answers, isComplete]);

    const handleSave = async () => {
        if (!isAuthenticated) {
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 4000);
            return;
        }
        if (!isAuthenticated || !isComplete) return;
        setIsSaving(true);
        setSaveStatus('idle');
        setSaveErrorString(null);

        const res = await saveTestResult({
            testType: 'mief-5',
            score: totalScore,
            interpretation: `МИЭФ-5: Суммарный балл ${totalScore}`,
            rawData: { answers, score: totalScore }
        });

        setIsSaving(false);
        if (res?.success) {
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } else {
            setSaveStatus('error');
            setSaveErrorString(res?.error || 'Unknown error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    };

    const interpretationLevel = useMemo(() => {
        if (!isComplete) return null;
        if (totalScore >= 21) return 'none';
        if (totalScore >= 16) return 'light';
        if (totalScore >= 11) return 'medium';
        return 'heavy';
    }, [totalScore, isComplete]);

    const INTERPRETATION_STYLES = {
        none: {
            colorClass: "text-emerald-700",
            bgClass: "bg-emerald-50",
            borderClass: "border-emerald-200",
            iconClass: "text-emerald-500",
            icon: ShieldCheck
        },
        light: {
            colorClass: "text-amber-700",
            bgClass: "bg-amber-50",
            borderClass: "border-amber-200",
            iconClass: "text-amber-500",
            icon: Info
        },
        medium: {
            colorClass: "text-orange-700",
            bgClass: "bg-orange-50",
            borderClass: "border-orange-200",
            iconClass: "text-orange-500",
            icon: AlertTriangle
        },
        heavy: {
            colorClass: "text-rose-700",
            bgClass: "bg-rose-50",
            borderClass: "border-rose-200",
            iconClass: "text-rose-500",
            icon: AlertCircle
        }
    };

    const activeStyle = interpretationLevel ? INTERPRETATION_STYLES[interpretationLevel] : null;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans text-slate-800 pt-32">
            <div className="w-full max-w-3xl bg-white rounded-3xl shadow-xl overflow-hidden transition-all duration-500 relative">
                
                {/* Back button */}
                <div className="absolute left-6 top-6 z-10">
                    <Link href="/diagnostics" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 transition-colors text-sm font-bold">
                        <ArrowLeft size={16} /> Назад
                    </Link>
                </div>

                {/* Sticky Header with Progress */}
                <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm mt-16 p-4">
                    <div className="flex justify-between items-center mb-2">
                        <h1 className="text-lg md:text-xl font-bold text-slate-800">{t('title')}</h1>
                        <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                            {progress} / {QUESTIONS.length}
                        </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                            className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" 
                            style={{ width: `${(progress / QUESTIONS.length) * 100}%` }}
                        ></div>
                    </div>
                </div>

                <div className="p-6 md:p-8 space-y-6">
                    
                    {/* Intro Card */}
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <div className="flex items-start space-x-4">
                            <div className="bg-indigo-100 p-3 rounded-2xl text-indigo-600 shrink-0">
                                <Info className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 mb-2">{t('aboutTitle')}</h3>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    {t('aboutDesc')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Questions List */}
                    <div className="space-y-4">
                        {QUESTIONS.map((q, index) => {
                            const currentOptions = rawOptions[q.id === 5 ? 'q5' : 'q1_q4'] || [];
                            const isSelected = answers[q.id] !== undefined;
                            
                            return (
                                <div 
                                    key={q.id} 
                                    className={`bg-white rounded-2xl p-4 md:p-5 border transition-all duration-300 ${
                                        isSelected 
                                            ? 'border-indigo-200 bg-indigo-50/20' 
                                            : 'border-slate-100 hover:border-indigo-100'
                                    }`}
                                >
                                    <div className="flex flex-col gap-4">
                                        <div>
                                            <div className="text-xs font-bold text-indigo-400 mb-1 uppercase tracking-wider">
                                                Вопрос {index + 1}
                                            </div>
                                            <h3 className="text-base font-medium text-slate-800 leading-snug">
                                                {t(`questions.q${q.id}`)}
                                            </h3>
                                        </div>
                                        
                                        <div className="flex flex-col gap-2">
                                            {currentOptions.map(opt => {
                                                const selected = answers[q.id] === opt.value;
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => handleAnswer(q.id, opt.value)}
                                                        className={`text-left p-3.5 rounded-xl border transition-all text-sm font-medium flex items-center justify-between group ${
                                                            selected
                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-[1.01]'
                                                                : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50'
                                                        }`}
                                                    >
                                                        <span>{opt.label}</span>
                                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-4 transition-colors ${
                                                            selected ? 'border-white bg-white' : 'border-slate-300 group-hover:border-indigo-400'
                                                        }`}>
                                                            {selected && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Scroll prompt */}
                    {!isComplete && progress > 0 && (
                        <div className="flex justify-center items-center gap-2 text-slate-400 text-xs animate-pulse">
                            <ChevronDown size={16} />
                            <span>Ответьте на все вопросы для отображения результата</span>
                        </div>
                    )}

                    {/* Results View */}
                    {showResults && interpretationLevel && activeStyle && (
                        <div ref={resultsRef} className="pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-bottom-5 duration-700">
                            <div className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-3xl p-6 md:p-8 border border-indigo-100">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                            <CheckCircle2 className="w-7 h-7 text-indigo-500" />
                                            Результаты
                                        </h2>
                                        <p className="text-slate-500 mt-1">Оценка симптомов МИЭФ-5</p>
                                    </div>
                                    <div className="text-center bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm w-full md:w-auto">
                                        <div className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Суммарный балл</div>
                                        <div className="text-3xl font-black text-slate-900 mt-1">{totalScore} <span className="text-sm text-slate-300 font-medium">/ 25</span></div>
                                    </div>
                                </div>

                                {/* Блок Интерпретации */}
                                <div className={`mb-8 p-5 rounded-2xl border ${activeStyle.borderClass} ${activeStyle.bgClass} flex items-start gap-4 transition-all animate-in fade-in slide-in-from-top-3`}>
                                    <div className={`bg-white p-3 rounded-xl shadow-sm shrink-0 ${activeStyle.iconClass}`}>
                                        <activeStyle.icon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className={`text-lg font-bold ${activeStyle.colorClass} mb-1.5`}>
                                            {t(`interpretation.${interpretationLevel}.label`)}
                                        </h3>
                                        <p className="text-sm text-slate-700 leading-relaxed">
                                            {t(`interpretation.${interpretationLevel}.desc`)}
                                        </p>
                                    </div>
                                </div>

                                {/* Interpretation Summary Table */}
                                <div className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm mt-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
                                    <h3 className="text-base font-bold text-slate-800 mb-4">{t('interpretationTitle')}</h3>
                                    <div className="space-y-3">
                                        {['none', 'light', 'medium', 'heavy'].map((key) => {
                                            const style = INTERPRETATION_STYLES[key as keyof typeof INTERPRETATION_STYLES];
                                            return (
                                                <div key={key} className={`flex flex-col sm:flex-row justify-between items-center p-4 rounded-xl border ${style.borderClass} ${style.bgClass} transition-all duration-300 hover:shadow-sm gap-2`}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`p-1.5 rounded-lg bg-white shadow-sm ${style.iconClass}`}>
                                                            <style.icon className="w-4 h-4" />
                                                        </div>
                                                        <div className={`font-semibold ${style.colorClass} text-sm`}>
                                                            {t(`interpretation.${key}.label`)}
                                                        </div>
                                                    </div>
                                                    <div className={`font-bold ${style.colorClass} text-sm bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm`}>
                                                        {t(`interpretation.${key}.range`)} {t('pointsLabel')}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="mt-6 bg-slate-50 rounded-2xl p-5 border border-slate-100 flex items-start gap-4">
                                    <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        {t('disclaimer')}
                                    </p>
                                </div>

                                <div className="mt-8 flex flex-col gap-3">
                                    <div className="flex flex-col gap-3 w-full">
            <button 
                                            onClick={handleSave}
                                            disabled={isSaving || saveStatus === 'success'}
                                            className={`inline-flex items-center justify-center px-6 py-4 rounded-2xl font-bold transition-all shadow-lg w-full ${
                                                saveStatus === 'success' 
                                                ? 'bg-green-600 text-white shadow-green-200' 
                                                : saveStatus === 'error'
                                                ? 'bg-red-600 text-white shadow-red-200'
                                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                                            }`}
                                        >
                                            {isSaving ? (
                                                <><Loader2 className="mr-2 w-5 h-5 animate-spin" /> Сохранение...</>
                                            ) : saveStatus === 'success' ? (
                                                <><CheckCircle2 className="mr-2 w-5 h-5" /> Сохранено</>
                                            ) : (
                                                <><Save className="mr-2 w-5 h-5" /> Сохранить в мед архив</>
                                            )}
                                        </button>
                                    
            {!isAuthenticated && (
                <div className="text-center text-xs text-slate-500 font-medium">
                   <a href="/ru/login" target="_blank" className="text-indigo-600 hover:underline font-bold">Войдите</a>, чтобы результаты сохранились в медархиве
                </div>
            )}
          </div>

                                    <button 
                                        onClick={resetForm}
                                        className="inline-flex items-center justify-center px-6 py-4 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-2xl transition-all shadow-lg"
                                    >
                                        <RotateCcw className="mr-2 w-5 h-5" />
                                        Пройти заново
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
