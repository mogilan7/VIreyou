"use client";

import React, { useState } from 'react';
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { saveTestResult } from "@/actions/save-test";
import {
    Activity,
    AlertCircle,
    CheckCircle,
    RotateCcw,
    Info,
    ChevronRight,
    ChevronLeft,
    Loader2,
    ArrowLeft,
    ClipboardCheck,
    UserCircle,
    BarChart3
} from 'lucide-react';

export default function SarcFPage() {
    const t = useTranslations('SarcfCalculator');
    const [currentStep, setCurrentStep] = useState(-1); // -1 is the intro screen
    const [answers, setAnswers] = useState<number[]>(Array(5).fill(-1));
    const [showResult, setShowResult] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const questions = [
        {
            id: 'strength',
            title: t('q1Title'),
            text: t('q1Text'),
            options: [
                { label: t('q1O0'), value: 0 },
                { label: t('q1O1'), value: 1 },
                { label: t('q1O2'), value: 2 }
            ]
        },
        {
            id: 'assistance',
            title: t('q2Title'),
            text: t('q2Text'),
            options: [
                { label: t('q2O0'), value: 0 },
                { label: t('q2O1'), value: 1 },
                { label: t('q2O2'), value: 2 }
            ]
        },
        {
            id: 'rise',
            title: t('q3Title'),
            text: t('q3Text'),
            options: [
                { label: t('q3O0'), value: 0 },
                { label: t('q3O1'), value: 1 },
                { label: t('q3O2'), value: 2 }
            ]
        },
        {
            id: 'climb',
            title: t('q4Title'),
            text: t('q4Text'),
            options: [
                { label: t('q4O0'), value: 0 },
                { label: t('q4O1'), value: 1 },
                { label: t('q4O2'), value: 2 }
            ]
        },
        {
            id: 'falls',
            title: t('q5Title'),
            text: t('q5Text'),
            options: [
                { label: t('q5O0'), value: 0 },
                { label: t('q5O1'), value: 1 },
                { label: t('q5O2'), value: 2 }
            ]
        }
    ];

    const handleSelect = (value: number) => {
        const newAnswers = [...answers];
        newAnswers[currentStep] = value;
        setAnswers(newAnswers);

        if (currentStep < questions.length - 1) {
            setTimeout(() => setCurrentStep(currentStep + 1), 300);
        } else {
            setShowResult(true);
        }
    };

    const totalScore = answers.reduce((sum, val) => sum + (val !== -1 ? val : 0), 0);
    
    const getResultConfig = (score: number) => {
        if (score >= 4) {
            return {
                color: "text-red-700 bg-red-50 border-red-200",
                icon: <AlertCircle className="w-12 h-12 text-red-500 mb-2" />,
                title: t('resHighLabel'),
                description: t('resHighDesc'),
                recommendation: t('resHighRec')
            };
        } else {
            return {
                color: "text-brand-forest bg-[#E8F1EB] border-brand-sage/50",
                icon: <CheckCircle className="w-12 h-12 text-brand-leaf mb-2" />,
                title: t('resNormalLabel'),
                description: t('resNormalDesc'),
                recommendation: t('resNormalRec')
            };
        }
    };

    const resultConfig = getResultConfig(totalScore);

    const handleSaveResult = async () => {
        setIsSaving(true);
        setSaveStatus('idle');
        const res = await saveTestResult({
            testType: 'sarc-f',
            score: totalScore,
            interpretation: resultConfig.title,
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

    const reset = () => {
        setCurrentStep(-1);
        setAnswers(Array(5).fill(-1));
        setShowResult(false);
        setSaveStatus('idle');
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
                        <div className="absolute top-0 right-0 p-8 opacity-20 transform translate-x-10 -translate-y-10 rotate-12 pointer-events-none">
                            <Activity className="w-32 h-32 text-white" />
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
                                <div className="space-y-4">
                                    <p className="text-brand-gray text-lg leading-relaxed">
                                        {t('intro1')}
                                    </p>
                                    <p className="text-brand-gray text-lg leading-relaxed">
                                        {t('intro2')}
                                    </p>
                                </div>
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
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-brand-leaf font-bold text-sm uppercase tracking-wider">
                                            {t('question')} {currentStep + 1} {t('outOf')} {questions.length}
                                        </span>
                                        <span className="bg-brand-sage/20 text-brand-forest text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                                            {questions[currentStep].title}
                                        </span>
                                    </div>
                                    <h2 className="text-xl md:text-2xl font-semibold text-brand-forest leading-tight">
                                        {questions[currentStep].text}
                                    </h2>
                                </div>

                                <div className="grid gap-3">
                                    {questions[currentStep].options.map((option, idx) => {
                                        const isSelected = answers[currentStep] === option.value;
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => handleSelect(option.value)}
                                                className={`group flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${isSelected
                                                    ? 'border-brand-leaf bg-[#E8F1EB]'
                                                    : 'border-slate-100 hover:border-brand-leaf/50 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className={`font-medium ${isSelected ? 'text-brand-forest' : 'text-slate-700'}`}>
                                                        {option.label}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-[10px] px-2 py-1 rounded-lg font-bold ${isSelected ? 'bg-brand-leaf text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                        {option.value}
                                                    </span>
                                                    <ChevronRight className={`w-5 h-5 transform transition-transform ${isSelected ? 'text-brand-leaf translate-x-1' : 'text-slate-300 group-hover:text-brand-leaf group-hover:translate-x-1'}`} />
                                                </div>
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

                                <div className={`p-6 rounded-3xl border-2 ${resultConfig.color} space-y-3 shadow-sm`}>
                                    <div className="flex items-center gap-3 font-bold text-lg">
                                        {totalScore >= 4 ? <AlertCircle className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
                                        {resultConfig.title}
                                    </div>
                                    <p className="leading-relaxed font-medium">
                                        {resultConfig.description}
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-6 rounded-3xl space-y-4 border border-slate-100">
                                    <h3 className="font-bold text-brand-forest flex items-center gap-2">
                                        <UserCircle className="w-5 h-5 text-brand-leaf" /> {t('recLabel')}
                                    </h3>
                                    <p className="text-slate-600 leading-relaxed italic">
                                        "{resultConfig.recommendation}"
                                    </p>
                                </div>

                                {/* Save Button */}
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
                                        {saveStatus === 'error' && t('saveError')}
                                        {isSaving && t('saving')}
                                        {!isSaving && saveStatus === 'idle' && t('saveToVault')}
                                    </button>
                                </div>

                                {/* Interpretation Legend */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4" /> {t('legendTitle')}
                                    </h3>
                                    <div className="grid gap-2">
                                        <div className={`p-3 rounded-2xl border transition-colors flex items-center justify-between ${totalScore < 4 ? 'border-brand-leaf ring-2 ring-brand-sage bg-white' : 'border-slate-100 bg-slate-50/50'}`}>
                                            <span className={`text-sm font-bold ${totalScore < 4 ? 'text-brand-forest' : 'text-slate-600'}`}>{t('legendNormal')}</span>
                                            {totalScore < 4 && <span className="text-[10px] bg-brand-leaf text-white px-2 py-1 rounded-full font-bold">{t('yourLevel')}</span>}
                                        </div>
                                        <div className={`p-3 rounded-2xl border transition-colors flex items-center justify-between ${totalScore >= 4 ? 'border-brand-leaf ring-2 ring-brand-sage bg-white' : 'border-slate-100 bg-slate-50/50'}`}>
                                            <span className={`text-sm font-bold ${totalScore >= 4 ? 'text-brand-forest' : 'text-slate-600'}`}>{t('legendHigh')}</span>
                                            {totalScore >= 4 && <span className="text-[10px] bg-brand-leaf text-white px-2 py-1 rounded-full font-bold">{t('yourLevel')}</span>}
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
