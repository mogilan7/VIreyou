"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  HeartPulse, 
  BrainCircuit, 
  Activity, 
  ThermometerSun, 
  Info, 
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { saveTestResult } from '@/actions/save-test';
import { createClient } from '@/utils/supabase/client';

export default function GreeneScalePage() {
    const t = useTranslations('GreeneScale');
    const tCommon = useTranslations('Common');

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

    // --- Static data mapped to Translations ---
    const QUESTIONS = [
        { id: 1, domain: "anxiety", category: "psychological" },
        { id: 2, domain: "anxiety", category: "psychological" },
        { id: 3, domain: "anxiety", category: "psychological" },
        { id: 4, domain: "anxiety", category: "psychological" },
        { id: 5, domain: "anxiety", category: "psychological" },
        { id: 6, domain: "anxiety", category: "psychological" },
        { id: 7, domain: "depression", category: "psychological" },
        { id: 8, domain: "depression", category: "psychological" },
        { id: 9, domain: "depression", category: "psychological" },
        { id: 10, domain: "depression", category: "psychological" },
        { id: 11, domain: "depression", category: "psychological" },
        { id: 12, domain: "somatic", category: "somatic" },
        { id: 13, domain: "somatic", category: "somatic" },
        { id: 14, domain: "somatic", category: "somatic" },
        { id: 15, domain: "somatic", category: "somatic" },
        { id: 16, domain: "somatic", category: "somatic" },
        { id: 17, domain: "somatic", category: "somatic" },
        { id: 18, domain: "somatic", category: "somatic" },
        { id: 19, domain: "vasomotor", category: "vasomotor" },
        { id: 20, domain: "vasomotor", category: "vasomotor" },
        { id: 21, domain: "sexual", category: "sexual" }
    ];

    const DOMAINS = {
        anxiety: { title: t('domains.anxiety'), icon: BrainCircuit, color: "bg-blue-500", max: 18 },
        depression: { title: t('domains.depression'), icon: Activity, color: "bg-indigo-500", max: 15 },
        somatic: { title: t('domains.somatic'), icon: HeartPulse, color: "bg-emerald-500", max: 21 },
        vasomotor: { title: t('domains.vasomotor'), icon: ThermometerSun, color: "bg-orange-500", max: 6 },
        sexual: { title: t('domains.sexual'), icon: HeartPulse, color: "bg-rose-500", max: 3 }
    };

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

    const scores = useMemo(() => {
        if (!isComplete) return null;

        const result: Record<string, number> = {
            anxiety: 0,
            depression: 0,
            somatic: 0,
            vasomotor: 0,
            sexual: 0,
            total: 0,
            psychological: 0
        };

        QUESTIONS.forEach(q => {
            const score = answers[q.id] || 0;
            result[q.domain] += score;
            result.total += score;
            if (q.category === "psychological") {
                result.psychological += score;
            }
        });

        return result;
    }, [answers, isComplete]);

    const handleSave = async () => {
        if (!isAuthenticated || !scores) return;
        setIsSaving(true);
        setSaveStatus('idle');
        setSaveErrorString(null);

        const res = await saveTestResult({
            testType: 'greene-scale',
            score: scores.total,
            interpretation: `Шкала Грина: Общий балл ${scores.total}`,
            rawData: { answers, scores }
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

    const renderScoreBar = (domainKey: string, score: number) => {
        const domainInfo = DOMAINS[domainKey as keyof typeof DOMAINS];
        const percentage = Math.round((score / domainInfo.max) * 100);
        const Icon = domainInfo.icon;

        return (
            <div key={domainKey} className="mb-4">
                <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center space-x-2 text-slate-700 font-medium">
                        <Icon className="w-4 h-4 text-slate-500" />
                        <span className="text-sm">{domainInfo.title}</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                        {score} <span className="text-slate-400 font-normal">/ {domainInfo.max}</span>
                    </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                        className={`h-2.5 rounded-full ${domainInfo.color} transition-all duration-1000 ease-out`} 
                        style={{ width: `${percentage}%` }}
                    ></div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans text-slate-800 pt-32">
            <div className="w-full max-w-3xl bg-white rounded-3xl shadow-xl overflow-hidden transition-all duration-500 relative">
                
                {/* Back button */}
                <div className="absolute left-6 top-6 z-10">
                    <Link href="/diagnostics" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 transition-colors text-sm font-bold">
                        <ArrowLeft size={16} /> {t('back')}
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
                        {QUESTIONS.map((q, index) => (
                            <div 
                                key={q.id} 
                                className={`bg-white rounded-2xl p-4 md:p-5 border transition-all duration-300 ${
                                    answers[q.id] !== undefined 
                                        ? 'border-indigo-200 bg-indigo-50/20' 
                                        : 'border-slate-100 hover:border-indigo-100'
                                }`}
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="text-xs font-bold text-indigo-400 mb-1 uppercase tracking-wider">
                                            Симптом {index + 1}
                                        </div>
                                        <h3 className="text-base font-medium text-slate-800">
                                            {t(`questions.q${q.id}`)}
                                        </h3>
                                    </div>
                                    
                                    <div className="flex w-full md:w-auto bg-slate-100/60 p-1 rounded-xl">
                                        {[0, 1, 2, 3].map(val => {
                                            const isSelected = answers[q.id] === val;
                                            return (
                                                <button
                                                    key={val}
                                                    onClick={() => handleAnswer(q.id, val)}
                                                    className={`flex-1 md:flex-none md:w-14 py-2 text-sm font-bold rounded-lg transition-all ${
                                                        isSelected
                                                            ? 'bg-indigo-600 text-white shadow-md'
                                                            : 'text-slate-600 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    {val}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Scroll prompt */}
                    {!isComplete && progress > 0 && (
                        <div className="flex justify-center items-center gap-2 text-slate-400 text-xs animate-pulse">
                            <ChevronDown size={16} />
                            <span>Ответьте на все вопросы для отображения результата</span>
                        </div>
                    )}

                    {/* Results View */}
                    {showResults && scores && (
                        <div ref={resultsRef} className="pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-bottom-5 duration-700">
                            <div className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-3xl p-6 md:p-8 border border-indigo-100">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                            <CheckCircle2 className="w-7 h-7 text-indigo-500" />
                                            {t('resultsTitle')}
                                        </h2>
                                        <p className="text-slate-500 mt-1">{t('resultsDesc')}</p>
                                    </div>
                                    <div className="text-center bg-white px-6 py-4 rounded-2xl w-full md:w-auto border border-slate-100 shadow-sm">
                                        <div className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{t('totalScore')}</div>
                                        <div className="text-4xl font-black text-slate-900 mt-1">{scores.total} <span className="text-lg text-slate-300 font-medium">/ 63</span></div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Psychological Group */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                        <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2 flex justify-between">
                                            {t('psychological')}
                                            <span className="text-indigo-600 text-sm">{scores.psychological} / 33</span>
                                        </h3>
                                        {renderScoreBar('anxiety', scores.anxiety)}
                                        {renderScoreBar('depression', scores.depression)}
                                    </div>

                                    {/* Physical Group */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                        <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
                                            {t('somatic')}
                                        </h3>
                                        {renderScoreBar('somatic', scores.somatic)}
                                        {renderScoreBar('vasomotor', scores.vasomotor)}
                                        {renderScoreBar('sexual', scores.sexual)}
                                    </div>
                                </div>

                                <div className="mt-6 bg-amber-50 rounded-2xl p-5 border border-amber-100 flex items-start gap-4">
                                    <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-800 leading-relaxed">
                                        {t('disclaimer')}
                                    </p>
                                </div>

                                <div className="mt-8 flex flex-col gap-3">
                                    {isAuthenticated && (
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
                                                <><Loader2 className="mr-2 w-5 h-5 animate-spin" /> {t('saving')}</>
                                            ) : saveStatus === 'success' ? (
                                                <><CheckCircle2 className="mr-2 w-5 h-5" /> {t('saved')}</>
                                            ) : (
                                                <><Save className="mr-2 w-5 h-5" /> {t('saveBtn')}</>
                                            )}
                                        </button>
                                    )}

                                    {saveStatus === 'error' && (
                                        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs text-center justify-center">
                                            <AlertCircle className="w-4 h-4" />
                                            <span>Ошибка сохранения: {saveErrorString || 'Попробуйте еще раз'}</span>
                                        </div>
                                    )}

                                    <button 
                                        onClick={resetForm}
                                        className="inline-flex items-center justify-center px-6 py-4 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-2xl transition-all shadow-lg"
                                    >
                                        <RotateCcw className="mr-2 w-5 h-5" />
                                        {t('restart')}
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
