"use client";

import React, { useState, useEffect } from 'react';
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { saveTestResult } from "@/actions/save-test";
import {
    ClipboardCheck,
    AlertCircle,
    Info,
    ChevronRight,
    ChevronLeft,
    RotateCcw,
    GlassWater,
    Activity,
    UserCircle,
    BarChart3,
    Loader2,
    CheckCircle,
    ArrowLeft
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function AlcoholCalculatorPage() {
    const t = useTranslations('AlcoholCalculator');
    const [currentStep, setCurrentStep] = useState(-1); // -1 is the intro screen
    const [answers, setAnswers] = useState<number[]>(Array(10).fill(-1));
    const [showResult, setShowResult] = useState(false);

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

    // Reconstruct questions array from translations
    const questions = [
        {
            id: 1, text: t('q1Text'),
            options: [
                { label: t('q1O1'), score: 0 }, { label: t('q1O2'), score: 1 },
                { label: t('q1O3'), score: 2 }, { label: t('q1O4'), score: 3 },
                { label: t('q1O5'), score: 4 }
            ]
        },
        {
            id: 2, text: t('q2Text'), info: t('q2Info'),
            options: [
                { label: t('q2O1'), score: 0 }, { label: t('q2O2'), score: 1 },
                { label: t('q2O3'), score: 2 }, { label: t('q2O4'), score: 3 },
                { label: t('q2O5'), score: 4 }
            ]
        },
        {
            id: 3, text: t('q3Text'),
            options: [
                { label: t('q3O1'), score: 0 }, { label: t('q3O2'), score: 1 },
                { label: t('q3O3'), score: 2 }, { label: t('q3O4'), score: 3 },
                { label: t('q3O5'), score: 4 }
            ]
        },
        {
            id: 4, text: t('q4Text'),
            options: [
                { label: t('q4O1'), score: 0 }, { label: t('q4O2'), score: 1 },
                { label: t('q4O3'), score: 2 }, { label: t('q4O4'), score: 3 },
                { label: t('q4O5'), score: 4 }
            ]
        },
        {
            id: 5, text: t('q5Text'),
            options: [
                { label: t('q5O1'), score: 0 }, { label: t('q5O2'), score: 1 },
                { label: t('q5O3'), score: 2 }, { label: t('q5O4'), score: 3 },
                { label: t('q5O5'), score: 4 }
            ]
        },
        {
            id: 6, text: t('q6Text'),
            options: [
                { label: t('q6O1'), score: 0 }, { label: t('q6O2'), score: 1 },
                { label: t('q6O3'), score: 2 }, { label: t('q6O4'), score: 3 },
                { label: t('q6O5'), score: 4 }
            ]
        },
        {
            id: 7, text: t('q7Text'),
            options: [
                { label: t('q7O1'), score: 0 }, { label: t('q7O2'), score: 1 },
                { label: t('q7O3'), score: 2 }, { label: t('q7O4'), score: 3 },
                { label: t('q7O5'), score: 4 }
            ]
        },
        {
            id: 8, text: t('q8Text'),
            options: [
                { label: t('q8O1'), score: 0 }, { label: t('q8O2'), score: 1 },
                { label: t('q8O3'), score: 2 }, { label: t('q8O4'), score: 3 },
                { label: t('q8O5'), score: 4 }
            ]
        },
        {
            id: 9, text: t('q9Text'),
            options: [
                { label: t('q9O1'), score: 0 }, { label: t('q9O2'), score: 2 },
                { label: t('q9O3'), score: 4 }
            ]
        },
        {
            id: 10, text: t('q10Text'),
            options: [
                { label: t('q10O1'), score: 0 }, { label: t('q10O2'), score: 2 },
                { label: t('q10O3'), score: 4 }
            ]
        }
    ];

    const interpretationLevels = [
        { range: "0–7", label: t('res1Label'), desc: t('res1Desc'), color: "bg-[#E8F1EB] text-brand-forest" },
        { range: "8–15", label: t('res2Label'), desc: t('res2Desc'), color: "bg-yellow-100 text-yellow-800" },
        { range: "16–19", label: t('res3Label'), desc: t('res3Desc'), color: "bg-orange-100 text-orange-800" },
        { range: "20+", label: t('res4Label'), desc: t('res4Desc'), color: "bg-red-100 text-red-800" }
    ];

    const getResultDetails = (score: number) => {
        if (score <= 7) return {
            level: t('res1Label'),
            color: "text-brand-forest bg-[#E8F1EB] border-brand-sage/50",
            description: t('res1FullDesc'),
            recommendation: t('res1Rec')
        };
        if (score <= 15) return {
            level: t('res2Label'),
            color: "text-yellow-700 bg-yellow-50 border-yellow-200",
            description: t('res2FullDesc'),
            recommendation: t('res2Rec')
        };
        if (score <= 19) return {
            level: t('res3Label'),
            color: "text-orange-700 bg-orange-50 border-orange-200",
            description: t('res3FullDesc'),
            recommendation: t('res3Rec')
        };
        return {
            level: t('res4Label'),
            color: "text-red-700 bg-red-50 border-red-200",
            description: t('res4FullDesc'),
            recommendation: t('res4Rec')
        };
    };

    const handleSelect = (score: number) => {
        const newAnswers = [...answers];
        newAnswers[currentStep] = score;
        setAnswers(newAnswers);

        if (currentStep < questions.length - 1) {
            setTimeout(() => setCurrentStep(currentStep + 1), 300);
        } else {
            setShowResult(true);
        }
    };

    const totalScore = answers.reduce((acc, curr) => acc + (curr !== -1 ? curr : 0), 0);
    const result = getResultDetails(totalScore);

    const reset = () => {
        setCurrentStep(-1);
        setAnswers(Array(10).fill(-1));
        setShowResult(false);
        setSaveStatus('idle');
    };

    const handleSaveResult = async () => {
        if (!isAuthenticated) return;
        setIsSaving(true);
        setSaveStatus('idle');
        const res = await saveTestResult({
            testType: 'RU-AUDIT',
            score: totalScore,
            interpretation: result.level,
            rawData: { answers }
        });
        if (res.success) {
            setSaveStatus('success');
        } else {
            console.error(res.error);
            setSaveStatus('error');
        }
        setIsSaving(false);
    };

    const progress = currentStep === -1 ? 0 : ((currentStep) / questions.length) * 100;

    return (
        <div className="min-h-screen bg-slate-50 pt-32 pb-20 px-4 md:px-8 font-sans text-brand-text relative overflow-hidden">
            {/* Background Blob */}
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-brand-sage/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 -z-10" />

            <div className="max-w-2xl mx-auto">
                <Link href="/diagnostics" className="inline-flex items-center gap-2 text-brand-gray hover:text-brand-leaf transition-colors mb-8 font-medium">
                    <ArrowLeft size={16} /> {t('back')}
                </Link>

                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl overflow-hidden border border-white">
                    {/* Header */}
                    <div className="bg-brand-forest p-6 text-white relative isolate overflow-hidden">
                        {/* Decorative background glass shape inside header */}
                        <div className="absolute top-0 right-0 p-8 opacity-20 transform translate-x-10 -translate-y-10 rotate-12 pointer-events-none">
                            <GlassWater className="w-32 h-32 text-white" />
                        </div>

                        <div className="flex items-center gap-3 mb-2 relative z-10">
                            <ClipboardCheck className="w-8 h-8 text-brand-sage" />
                            <h1 className="text-2xl font-bold font-serif">{t('title')}</h1>
                        </div>
                        <p className="text-brand-sage/80 text-sm relative z-10 max-w-md">
                            {t('subtitle')}
                        </p>
                        {!showResult && currentStep >= 0 && (
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-black/20 z-10">
                                <div
                                    className="h-full bg-brand-leaf transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        )}
                    </div>

                    <div className="p-6 md:p-10">
                        {/* Intro Screen */}
                        {currentStep === -1 && (
                            <div className="space-y-6 animate-in fade-in duration-500">
                                <p className="text-brand-gray text-lg leading-relaxed">
                                    {t('intro1')}
                                </p>
                                <p className="text-brand-gray text-lg leading-relaxed">
                                    {t('intro2')}
                                </p>
                                <div className="pt-4">
                                    <button
                                        onClick={() => setCurrentStep(0)}
                                        className="w-full bg-brand-forest text-white py-4 rounded-xl font-bold text-lg hover:bg-brand-leaf transition-all shadow-lg active:scale-95"
                                    >
                                        {t('start')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Question Screen */}
                        {currentStep >= 0 && !showResult && (
                            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                                <div>
                                    <span className="text-brand-leaf font-bold text-sm uppercase tracking-wider mb-2 block">
                                        {t('question')} {currentStep + 1} {t('outOf')} {questions.length}
                                    </span>
                                    <h2 className="text-xl md:text-2xl font-semibold text-brand-forest leading-tight">
                                        {questions[currentStep].text}
                                    </h2>
                                    {questions[currentStep].info && (
                                        <div className="mt-4 p-3 bg-brand-sage/20 border border-brand-sage/50 text-brand-forest rounded-xl flex gap-3 text-sm items-start">
                                            <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                            <p className="font-medium">{questions[currentStep].info}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-3">
                                    {questions[currentStep].options.map((option, idx) => {
                                        const isSelected = answers[currentStep] === option.score;
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => handleSelect(option.score)}
                                                className={`group flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${isSelected
                                                    ? 'border-brand-leaf bg-[#E8F1EB]'
                                                    : 'border-slate-100 hover:border-brand-leaf/50 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <span className={`font-medium ${isSelected ? 'text-brand-forest' : 'text-slate-700'}`}>
                                                    {option.label}
                                                </span>
                                                <ChevronRight className={`w-5 h-5 transform transition-transform ${isSelected ? 'text-brand-leaf translate-x-1' : 'text-slate-300 group-hover:text-brand-leaf group-hover:translate-x-1'}`} />
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="flex justify-between items-center pt-4">
                                    <button
                                        onClick={() => setCurrentStep(currentStep - 1)}
                                        className={`flex items-center gap-2 text-sm font-semibold transition-colors ${currentStep === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-brand-gray hover:text-brand-forest'}`}
                                        disabled={currentStep === 0}
                                    >
                                        <ChevronLeft className="w-4 h-4" /> {t('prev')}
                                    </button>
                                    <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                                        {Math.round(progress)}% {t('completed')}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Result Screen */}
                        {showResult && (
                            <div className="space-y-8 animate-in fade-in duration-700">
                                <div className="text-center space-y-4">
                                    <div className="inline-block p-4 rounded-full bg-[#E8F1EB] mb-2">
                                        <Activity className="w-12 h-12 text-brand-leaf" />
                                    </div>
                                    <h2 className="text-3xl font-bold font-serif text-brand-forest">{t('resultLabel')}</h2>
                                    <div className="flex justify-center items-baseline gap-2">
                                        <span className="text-5xl font-black text-brand-leaf">{totalScore}</span>
                                        <span className="text-brand-gray font-medium">{t('points')}</span>
                                    </div>
                                </div>

                                <div className={`p-6 rounded-3xl border-2 ${result.color} space-y-3 shadow-sm`}>
                                    <div className="flex items-center gap-2 font-bold text-lg">
                                        <AlertCircle className="w-6 h-6" />
                                        {result.level}
                                    </div>
                                    <p className="leading-relaxed font-medium">
                                        {result.description}
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-6 rounded-3xl space-y-4 border border-slate-100">
                                    <h3 className="font-bold text-brand-forest flex items-center gap-2">
                                        <UserCircle className="w-5 h-5 text-brand-leaf" /> {t('recLabel')}
                                    </h3>
                                    <p className="text-slate-600 leading-relaxed italic">
                                        "{result.recommendation}"
                                    </p>
                                </div>

                                {/* Save Button */}
                                {isAuthenticated && (
                                    <div className="py-2">
                                        <button
                                            onClick={handleSaveResult}
                                            disabled={isSaving || saveStatus === 'success'}
                                            className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg text-white
                                                ${saveStatus === 'success' ? 'bg-brand-sage' : 'bg-brand-forest hover:bg-brand-leaf active:scale-95'}`}
                                        >
                                            {isSaving && <Loader2 className="w-5 h-5 animate-spin" />}
                                            {saveStatus === 'success' && <CheckCircle className="w-5 h-5" />}
                                            {saveStatus === 'success' && t('saved')}
                                            {saveStatus === 'error' && (t('saveError') || "Error")}
                                            {isSaving && t('saving')}
                                            {!isSaving && saveStatus === 'idle' && t('saveToVault')}
                                        </button>
                                    </div>
                                )}


                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4" /> {t('interpretation')}
                                    </h3>
                                    <div className="grid gap-2">
                                        {interpretationLevels.map((item, idx) => {
                                            const min = parseInt(item.range.split('–')[0]);
                                            const max = item.range.includes('+') ? 99 : parseInt(item.range.split('–')[1]);
                                            const isCurrentTier = totalScore >= min && totalScore <= max;

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`flex flex-col md:flex-row md:items-center justify-between p-3 rounded-2xl border transition-colors ${isCurrentTier ? 'border-brand-leaf ring-2 ring-brand-sage bg-white' : 'border-slate-100 bg-slate-50/50'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className={`px-2 py-1 rounded-lg text-xs font-bold w-12 text-center ${item.color}`}>
                                                            {item.range}
                                                        </span>
                                                        <div>
                                                            <p className={`text-sm font-bold ${isCurrentTier ? 'text-brand-forest' : 'text-slate-600'}`}>
                                                                {item.label}
                                                            </p>
                                                            <p className="text-[11px] text-slate-400">{item.desc}</p>
                                                        </div>
                                                    </div>
                                                    {isCurrentTier && (
                                                        <div className="hidden md:block">
                                                            <span className="text-[10px] bg-brand-leaf text-white px-2 py-1 rounded-full font-bold">
                                                                {t('yourLevel')}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 pt-6">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                                        {t('infoScale')}
                                    </h4>
                                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] md:text-xs">
                                        <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                            <p className="font-bold text-slate-700">{t('infoVodka')}</p>
                                            <p className="text-slate-400">{t('infoVodkaVol')}</p>
                                        </div>
                                        <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                            <p className="font-bold text-slate-700">{t('infoWine')}</p>
                                            <p className="text-slate-400">{t('infoWineVol')}</p>
                                        </div>
                                        <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                            <p className="font-bold text-slate-700">{t('infoBeer')}</p>
                                            <p className="text-slate-400">{t('infoBeerVol')}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 pt-4">
                                    <button
                                        onClick={reset}
                                        className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 hover:text-slate-800 transition-colors"
                                    >
                                        <RotateCcw className="w-5 h-5" /> {t('restart')}
                                    </button>
                                    <p className="text-[10px] text-center text-slate-400 uppercase leading-tight px-4 mt-2">
                                        {t('methodology')} {t('disclaimer')}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
