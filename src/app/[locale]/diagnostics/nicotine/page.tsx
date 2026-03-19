"use client";

import React, { useState, useEffect } from 'react';
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { saveTestResult } from "@/actions/save-test";
import {
    ChevronRight,
    RefreshCcw,
    AlertCircle,
    CheckCircle2,
    Info,
    Heart,
    ShieldCheck,
    Zap,
    TrendingDown,
    ListTree,
    ArrowLeft,
    Loader2,
    CheckCircle
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function NicotineCalculatorPage() {
    const t = useTranslations('NicotineCalculator');
    const [currentStep, setCurrentStep] = useState<'welcome' | 'test' | 'result'>('welcome');
    const [questionIdx, setQuestionIdx] = useState(0);
    const [totalScore, setTotalScore] = useState(0);

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    useEffect(() => {
        const checkAuth = async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            setIsAuthenticated(!!session);
        };
        checkAuth();
    }, []);

    const questions = [
        {
            id: 1,
            text: t('q1Text'),
            options: [
                { text: t('q1O1'), points: 3 },
                { text: t('q1O2'), points: 2 },
                { text: t('q1O3'), points: 1 },
                { text: t('q1O4'), points: 0 }
            ]
        },
        {
            id: 2,
            text: t('q2Text'),
            options: [
                { text: t('q2O1'), points: 1 },
                { text: t('q2O2'), points: 0 }
            ]
        },
        {
            id: 3,
            text: t('q3Text'),
            options: [
                { text: t('q3O1'), points: 1 },
                { text: t('q3O2'), points: 0 }
            ]
        },
        {
            id: 4,
            text: t('q4Text'),
            options: [
                { text: t('q4O1'), points: 0 },
                { text: t('q4O2'), points: 1 },
                { text: t('q4O3'), points: 2 },
                { text: t('q4O4'), points: 3 }
            ]
        },
        {
            id: 5,
            text: t('q5Text'),
            options: [
                { text: t('q5O1'), points: 1 },
                { text: t('q5O2'), points: 0 }
            ]
        },
        {
            id: 6,
            text: t('q6Text'),
            options: [
                { text: t('q6O1'), points: 1 },
                { text: t('q6O2'), points: 0 }
            ]
        }
    ];

    const scoreLevels = [
        { range: [0, 2], label: t('resLevel1'), color: "bg-green-500", text: "text-green-600" },
        { range: [3, 4], label: t('resLevel2'), color: "bg-blue-500", text: "text-blue-600" },
        { range: [5, 5], label: t('resLevel3'), color: "bg-yellow-500", text: "text-yellow-600" },
        { range: [6, 7], label: t('resLevel4'), color: "bg-orange-500", text: "text-orange-600" },
        { range: [8, 10], label: t('resLevel5'), color: "bg-red-500", text: "text-red-600" }
    ];

    const getInterpretation = (score: number) => {
        if (score <= 2) return {
            level: t('resLevel1'),
            color: "text-green-600",
            fill: "bg-green-600",
            bg: "bg-green-50",
            border: "border-green-200",
            desc: t('resDesc1'),
            strategy: t('resStrategy1'),
            advice: t('resAdvice1')
        };
        if (score <= 4) return {
            level: t('resLevel2'),
            color: "text-blue-600",
            fill: "bg-blue-600",
            bg: "bg-blue-50",
            border: "border-blue-200",
            desc: t('resDesc2'),
            strategy: t('resStrategy2'),
            advice: t('resAdvice2')
        };
        if (score === 5) return {
            level: t('resLevel3'),
            color: "text-yellow-600",
            fill: "bg-yellow-500",
            bg: "bg-yellow-50",
            border: "border-yellow-200",
            desc: t('resDesc3'),
            strategy: t('resStrategy3'),
            advice: t('resAdvice3')
        };
        if (score <= 7) return {
            level: t('resLevel4'),
            color: "text-orange-600",
            fill: "bg-orange-600",
            bg: "bg-orange-50",
            border: "border-orange-200",
            desc: t('resDesc4'),
            strategy: t('resStrategy4'),
            advice: t('resAdvice4')
        };
        return {
            level: t('resLevel5'),
            color: "text-red-600",
            fill: "bg-red-600",
            bg: "bg-red-50",
            border: "border-red-200",
            desc: t('resDesc5'),
            strategy: t('resStrategy5'),
            advice: t('resAdvice5')
        };
    };

    const startTest = () => {
        setTotalScore(0);
        setQuestionIdx(0);
        setCurrentStep('test');
        setSaveStatus('idle');
    };

    const handleOptionSelect = (points: number) => {
        const newScore = totalScore + points;
        setTotalScore(newScore);

        if (questionIdx < questions.length - 1) {
            setTimeout(() => setQuestionIdx(questionIdx + 1), 300);
        } else {
            setCurrentStep('result');
        }
    };

    const reset = () => {
        setCurrentStep('welcome');
        setSaveStatus('idle');
    };

    const handleSaveResult = async () => {
        if (!isAuthenticated) {
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 4000);
            return;
        }
        if (!isAuthenticated) return;
        setIsSaving(true);
        setSaveStatus('idle');
        const resultDetails = getInterpretation(totalScore);

        const res = await saveTestResult({
            testType: 'nicotine',
            score: totalScore,
            interpretation: resultDetails.level,
            rawData: { completed: true, points: totalScore }
        });

        if (res.success) {
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } else {
            console.error(res.error);
            setSaveStatus('error');
        }
        setIsSaving(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 pt-32 pb-20 px-4 md:px-8 font-sans text-brand-text relative overflow-hidden flex items-center justify-center">
            {/* Background Blob */}
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 -z-10" />

            <div className="max-w-2xl w-full">
                <Link href="/diagnostics" className="inline-flex items-center gap-2 text-brand-gray hover:text-indigo-600 transition-colors mb-8 font-medium">
                    <ArrowLeft size={16} /> {t('back')}
                </Link>

                <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl overflow-hidden border border-white">

                    {/* Header */}
                    <div className="bg-brand-forest p-6 text-white relative isolate overflow-hidden">
                        {/* Decorative background glass shape inside header */}
                        <div className="absolute top-0 right-0 p-8 opacity-20 transform translate-x-10 -translate-y-10 rotate-12 pointer-events-none">
                            <ShieldCheck className="w-32 h-32 text-white" />
                        </div>

                        <div className="flex items-center gap-3 mb-2 relative z-10">
                            <Zap className="w-8 h-8 text-indigo-300" />
                            <h1 className="text-2xl font-bold font-serif">{t('title')}</h1>
                        </div>
                        <p className="text-brand-sage/80 text-sm relative z-10 max-w-md">
                            {t('subtitle')}
                        </p>

                        {currentStep === 'test' && (
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-black/20 z-10">
                                <div
                                    className="h-full bg-indigo-400 transition-all duration-500 ease-out"
                                    style={{ width: `${((questionIdx + 1) / questions.length) * 100}%` }}
                                />
                            </div>
                        )}
                    </div>

                    <div className="p-6 md:p-10">
                        {currentStep === 'welcome' && (
                            <div className="text-center space-y-6 animate-in fade-in duration-500">
                                <div className="bg-indigo-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <ShieldCheck className="text-indigo-600 w-12 h-12" />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-800">{t('introTitle')}</h2>
                                <p className="text-slate-600 leading-relaxed text-lg">
                                    {t('introDesc')}
                                </p>
                                <div className="grid grid-cols-2 gap-4 text-left pt-4">
                                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center gap-3">
                                        <Zap className="text-amber-500 shrink-0" size={20} />
                                        <span className="text-sm font-medium text-slate-700">{t('feature1')}</span>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center gap-3">
                                        <TrendingDown className="text-green-500 shrink-0" size={20} />
                                        <span className="text-sm font-medium text-slate-700">{t('feature2')}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={startTest}
                                    className="w-full mt-8 bg-brand-forest hover:bg-brand-leaf text-white font-bold py-5 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 group text-xl"
                                >
                                    {t('start')}
                                    <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        )}

                        {currentStep === 'test' && (
                            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                                <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-4">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{t('progressText')}</span>
                                        <span className="text-slate-400 text-sm">{t('questionText')} {questionIdx + 1} {t('outOfText')} {questions.length}</span>
                                    </div>
                                    <div className="text-3xl font-serif text-slate-200 font-black">
                                        {questionIdx + 1}/{questions.length}
                                    </div>
                                </div>

                                <div className="min-h-[100px] flex md:items-center">
                                    <h3 className="text-2xl font-bold text-slate-800 leading-tight">
                                        {questions[questionIdx].text}
                                    </h3>
                                </div>

                                <div className="grid gap-4">
                                    {questions[questionIdx].options.map((option, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleOptionSelect(option.points)}
                                            className="text-left p-5 rounded-2xl border-2 border-slate-100 hover:border-indigo-400 hover:bg-indigo-50/50 hover:shadow-md transition-all text-slate-700 font-medium flex justify-between items-center group focus:outline-none focus:ring-4 focus:ring-indigo-500/20 active:scale-[0.98]"
                                        >
                                            <span className="pr-4">{option.text}</span>
                                            <div className="w-6 h-6 rounded-full border-2 border-slate-200 group-hover:border-indigo-500 flex items-center justify-center shrink-0">
                                                <div className="w-3 h-3 rounded-full bg-indigo-600 scale-0 group-hover:scale-100 transition-transform" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {currentStep === 'result' && (
                            <div className="space-y-8 animate-in fade-in zoom-in duration-500">
                                {(() => {
                                    const result = getInterpretation(totalScore);
                                    return (
                                        <>
                                            {/* Visual Result Gauge */}
                                            <div className="text-center pb-4">
                                                <div className="relative inline-flex items-center justify-center mb-6">
                                                    <svg className="w-32 h-32 transform -rotate-90">
                                                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
                                                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent"
                                                            strokeDasharray={364}
                                                            strokeDashoffset={364 - (364 * totalScore) / 10}
                                                            className={`${result.color} transition-all duration-1000 ease-out`}
                                                            strokeLinecap="round" />
                                                    </svg>
                                                    <div className="absolute flex flex-col items-center">
                                                        <span className={`text-4xl font-black ${result.color}`}>{totalScore}</span>
                                                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-1">{t('pointsText')}</span>
                                                    </div>
                                                </div>
                                                <h2 className={`text-3xl font-black ${result.color} mb-3 font-serif`}>{result.level}</h2>
                                                <div className={`inline-block px-5 py-1.5 rounded-full ${result.bg} ${result.color} font-bold text-sm tracking-wide border ${result.border}`}>
                                                    {result.strategy}
                                                </div>
                                            </div>

                                            <div className={`${result.bg} ${result.border} border rounded-2xl p-6 shadow-sm`}>
                                                <div className="flex items-start gap-4">
                                                    <div className={`p-2.5 rounded-xl ${result.fill} text-white shrink-0 shadow-sm`}>
                                                        <AlertCircle size={24} />
                                                    </div>
                                                    <p className={`text-slate-800 font-medium text-lg leading-relaxed pt-1`}>{result.desc}</p>
                                                </div>
                                            </div>

                                            {/* Action Plan */}
                                            <div className="bg-white border-2 border-slate-100 rounded-3xl p-6 shadow-sm">
                                                <div className="flex items-center gap-3 font-bold text-slate-800 text-xl border-b border-slate-100 pb-4 mb-5 font-serif">
                                                    <CheckCircle2 className="text-green-500" size={28} />
                                                    {t('actionPlan')}
                                                </div>
                                                <p className="text-slate-700 leading-relaxed font-medium mb-6">
                                                    {result.advice}
                                                </p>
                                                <div className="flex items-start md:items-center gap-3 text-sm text-slate-600 bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl">
                                                    <Info size={20} className="text-indigo-500 shrink-0 mt-0.5 md:mt-0" />
                                                    <span className="font-medium text-indigo-900/80">{t('actionNote')}</span>
                                                </div>
                                            </div>

                                            {/* Scale Explanation */}
                                            <div className="bg-slate-50/80 rounded-3xl p-6 border border-slate-100">
                                                <div className="flex items-center gap-2 mb-5 text-slate-800 font-bold font-serif text-lg">
                                                    <ListTree size={20} className="text-brand-leaf" />
                                                    {t('scaleIntro')}
                                                </div>
                                                <div className="space-y-2">
                                                    {scoreLevels.map((lvl, i) => {
                                                        const isCurrent = totalScore >= lvl.range[0] && totalScore <= lvl.range[1];
                                                        return (
                                                            <div
                                                                key={i}
                                                                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isCurrent ? 'bg-white border-indigo-200 shadow-sm ring-1 ring-indigo-500/10' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-2.5 h-2.5 rounded-full ${lvl.color}`} />
                                                                    <span className={`text-sm font-semibold ${isCurrent ? 'text-slate-900' : 'text-slate-600'}`}>
                                                                        {lvl.label}
                                                                    </span>
                                                                </div>
                                                                <span className={`text-xs font-bold px-2 py-1 rounded-md ${isCurrent ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>
                                                                    {lvl.range[0] === lvl.range[1] ? lvl.range[0] : `${lvl.range[0]}–${lvl.range[1]}`} {t('pointsText')}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Motivation Block */}
                                            <div className="bg-brand-forest text-white rounded-3xl p-6 relative overflow-hidden text-center sm:text-left mt-8">
                                                <div className="relative z-10">
                                                    <h4 className="flex items-center justify-center sm:justify-start gap-2 font-bold mb-3 text-brand-sage uppercase text-xs tracking-widest">
                                                        <Heart size={16} className="fill-brand-sage/20" />
                                                        {t('motivationIntro')}
                                                    </h4>
                                                    <p className="text-sm font-medium leading-relaxed opacity-95" dangerouslySetInnerHTML={{ __html: t('motivationText') }} />
                                                </div>
                                                <div className="absolute top-0 right-0 p-4 opacity-[0.03] hidden sm:block pointer-events-none">
                                                    <TrendingDown size={100} />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                                                <div className="flex flex-col gap-3 w-full">
            <button
                                                        onClick={handleSaveResult}
                                                        disabled={isSaving || saveStatus === 'success'}
                                                        className={`flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-bold transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-md
                                                            ${saveStatus === 'success' ? 'bg-brand-sage text-white' : 'bg-brand-leaf text-white hover:bg-brand-forest'}`}
                                                    >
                                                        {isSaving ? (
                                                            <><Loader2 size={20} className="animate-spin" /> {t('saving')}</>
                                                        ) : saveStatus === 'success' ? (
                                                            <><CheckCircle size={20} /> {t('saved')}</>
                                                        ) : (
                                                            <>{t('saveBtn')}</>
                                                        )}
                                                    </button>
                                                
            {!isAuthenticated && (
                <div className="text-center text-xs text-slate-500 font-medium">
                   <a href="/ru/login" target="_blank" className="text-indigo-600 hover:underline font-bold">Войдите</a>, чтобы результаты сохранились в медархиве
                </div>
            )}
          </div>

                                                <button
                                                    onClick={reset}
                                                    className={`py-4 px-6 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 ${!isAuthenticated ? 'md:col-span-2' : ''}`}
                                                >
                                                    <RefreshCcw size={20} />
                                                    {t('restart')}
                                                </button>
                                            </div>

                                            {saveStatus === 'error' && (
                                                <p className="text-red-500 text-sm text-center font-medium mt-2">{t('errorSaving')}</p>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
