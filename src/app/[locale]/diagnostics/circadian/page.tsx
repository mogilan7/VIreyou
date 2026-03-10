"use client";
import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, RefreshCcw, Sun, Moon, Clock, Info, ArrowLeft, Activity, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { saveTestResult } from '@/actions/save-test';
import { createClient } from '@/utils/supabase/client';

export default function CircadianCalculatorPage() {
    const t = useTranslations('CircadianCalculator');
    const tCommon = useTranslations('Common');

    const questions = [
        {
            id: 1,
            text: t('q1Text'),
            options: [
                { text: t('q1A'), points: 5 },
                { text: t('q1B'), points: 4 },
                { text: t('q1C'), points: 3 },
                { text: t('q1D'), points: 2 },
                { text: t('q1E'), points: 1 }
            ]
        },
        {
            id: 2,
            text: t('q2Text'),
            options: [
                { text: t('q2A'), points: 5 },
                { text: t('q2B'), points: 4 },
                { text: t('q2C'), points: 3 },
                { text: t('q2D'), points: 2 },
                { text: t('q2E'), points: 1 }
            ]
        },
        {
            id: 3,
            text: t('q3Text'),
            options: [
                { text: t('q3A'), points: 4 },
                { text: t('q3B'), points: 3 },
                { text: t('q3C'), points: 2 },
                { text: t('q3D'), points: 1 }
            ]
        },
        {
            id: 4,
            text: t('q4Text'),
            options: [
                { text: t('q4A'), points: 1 },
                { text: t('q4B'), points: 2 },
                { text: t('q4C'), points: 3 },
                { text: t('q4D'), points: 4 }
            ]
        },
        {
            id: 5,
            text: t('q5Text'),
            options: [
                { text: t('q5A'), points: 1 },
                { text: t('q5B'), points: 2 },
                { text: t('q5C'), points: 3 },
                { text: t('q5D'), points: 4 }
            ]
        },
        {
            id: 6,
            text: t('q6Text'),
            options: [
                { text: t('q6A'), points: 1 },
                { text: t('q6B'), points: 2 },
                { text: t('q6C'), points: 3 },
                { text: t('q6D'), points: 4 }
            ]
        },
        {
            id: 7,
            text: t('q7Text'),
            options: [
                { text: t('q7A'), points: 1 },
                { text: t('q7B'), points: 2 },
                { text: t('q7C'), points: 3 },
                { text: t('q7D'), points: 4 }
            ]
        },
        {
            id: 8,
            text: t('q8Text'),
            options: [
                { text: t('q8A'), points: 4 },
                { text: t('q8B'), points: 3 },
                { text: t('q8C'), points: 2 },
                { text: t('q8D'), points: 1 }
            ]
        },
        {
            id: 9,
            text: t('q9Text'),
            options: [
                { text: t('q9A'), points: 4 },
                { text: t('q9B'), points: 3 },
                { text: t('q9C'), points: 2 },
                { text: t('q9D'), points: 1 }
            ]
        },
        {
            id: 10,
            text: t('q10Text'),
            options: [
                { text: t('q10A'), points: 5 },
                { text: t('q10B'), points: 4 },
                { text: t('q10C'), points: 3 },
                { text: t('q10D'), points: 2 },
                { text: t('q10E'), points: 1 }
            ]
        },
        {
            id: 11,
            text: t('q11Text'),
            options: [
                { text: t('q11A'), points: 4 },
                { text: t('q11B'), points: 3 },
                { text: t('q11C'), points: 2 },
                { text: t('q11D'), points: 1 }
            ]
        },
        {
            id: 12,
            text: t('q12Text'),
            options: [
                { text: t('q12A'), points: 1 },
                { text: t('q12B'), points: 2 },
                { text: t('q12C'), points: 3 },
                { text: t('q12D'), points: 4 }
            ]
        },
        {
            id: 13,
            text: t('q13Text'),
            options: [
                { text: t('q13A'), points: 4 },
                { text: t('q13B'), points: 3 },
                { text: t('q13C'), points: 2 },
                { text: t('q13D'), points: 1 }
            ]
        },
        {
            id: 14,
            text: t('q14Text'),
            options: [
                { text: t('q14A'), points: 1 },
                { text: t('q14B'), points: 2 },
                { text: t('q14C'), points: 3 },
                { text: t('q14D'), points: 4 }
            ]
        },
        {
            id: 15,
            text: t('q15Text'),
            options: [
                { text: t('q15A'), points: 4 },
                { text: t('q15B'), points: 3 },
                { text: t('q15C'), points: 2 },
                { text: t('q15D'), points: 1 }
            ]
        },
        {
            id: 16,
            text: t('q16Text'),
            options: [
                { text: t('q16A'), points: 1 },
                { text: t('q16B'), points: 2 },
                { text: t('q16C'), points: 3 },
                { text: t('q16D'), points: 4 }
            ]
        },
        {
            id: 17,
            text: t('q17Text'),
            options: [
                { text: t('q17A'), points: 5 },
                { text: t('q17B'), points: 4 },
                { text: t('q17C'), points: 3 },
                { text: t('q17D'), points: 2 },
                { text: t('q17E'), points: 1 }
            ]
        },
        {
            id: 18,
            text: t('q18Text'),
            options: [
                { text: t('q18A'), points: 5 },
                { text: t('q18B'), points: 4 },
                { text: t('q18C'), points: 3 },
                { text: t('q18D'), points: 2 },
                { text: t('q18E'), points: 1 }
            ]
        },
        {
            id: 19,
            text: t('q19Text'),
            options: [
                { text: t('q19A'), points: 6 },
                { text: t('q19B'), points: 4 },
                { text: t('q19C'), points: 2 },
                { text: t('q19D'), points: 0 }
            ]
        }
    ];

    const getResultInfo = (score: number) => {
        if (score >= 70 && score <= 86) return {
            type: t('res1Title'),
            icon: <Sun className="w-12 h-12 text-yellow-500" />,
            desc: t('res1Desc'),
            color: "bg-yellow-50",
            borderColor: "border-yellow-200"
        };
        if (score >= 59 && score <= 69) return {
            type: t('res2Title'),
            icon: <Sun className="w-12 h-12 text-orange-400" />,
            desc: t('res2Desc'),
            color: "bg-orange-50",
            borderColor: "border-orange-200"
        };
        if (score >= 42 && score <= 58) return {
            type: t('res3Title'),
            icon: <Activity className="w-12 h-12 text-blue-500" />,
            desc: t('res3Desc'),
            color: "bg-blue-50",
            borderColor: "border-blue-200"
        };
        if (score >= 31 && score <= 41) return {
            type: t('res4Title'),
            icon: <Moon className="w-12 h-12 text-indigo-400" />,
            desc: t('res4Desc'),
            color: "bg-indigo-50",
            borderColor: "border-indigo-200"
        };
        return {
            type: t('res5Title'),
            icon: <Moon className="w-12 h-12 text-purple-600" />,
            desc: t('res5Desc'),
            color: "bg-purple-50",
            borderColor: "border-purple-200"
        };
    };

    const [currentStep, setCurrentStep] = useState(-1); // -1: Intro, 0-18: Questions, 19: Result
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [score, setScore] = useState(0);

    // Auth & Save State
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const supabase = createClient();

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setIsAuthenticated(!!session);
        };
        checkAuth();
    }, []);

    const startQuiz = () => setCurrentStep(0);

    const handleAnswer = (points: number) => {
        const newAnswers = { ...answers, [currentStep]: points };
        setAnswers(newAnswers);

        if (currentStep < questions.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            const totalScore = Object.values(newAnswers).reduce((a, b) => a + b, 0);
            setScore(totalScore);
            setCurrentStep(questions.length);
        }
    };

    const prevStep = () => {
        if (currentStep > 0) setCurrentStep(currentStep - 1);
    };

    const resetQuiz = () => {
        setAnswers({});
        setScore(0);
        setCurrentStep(-1);
    };

    const progress = ((currentStep) / questions.length) * 100;

    const handleSave = async () => {
        if (!isAuthenticated) return;
        setIsSaving(true);
        setSaveStatus('idle');

        const res = await saveTestResult({
            testType: 'circadian',
            score: score,
            interpretation: getResultInfo(score).type,
            rawData: { answers, maxScore: 86 }
        });

        setIsSaving(false);
        if (res?.success) {
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } else {
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 pt-32 md:p-8 font-sans text-slate-900">
            <div className="max-w-2xl mx-auto space-y-4 transition-all duration-300">

                <div>
                    <Link href="/diagnostics" className="inline-flex items-center gap-2 text-brand-forest hover:text-brand-leaf transition-colors text-sm font-bold">
                        <ArrowLeft size={16} /> {t('back')}
                    </Link>
                </div>

                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">

                    {/* Header - Brand Styled (only visible on Intro) */}
                    {currentStep === -1 && (
                        <div className="bg-brand-forest p-8 text-white relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-2">
                                    <Clock className="w-8 h-8 text-brand-leaf" />
                                    <h1 className="text-2xl font-serif font-bold tracking-tight">{t('title')}</h1>
                                </div>
                                <p className="text-white/80 text-sm leading-relaxed max-w-lg">
                                    {t('subtitle')}
                                </p>
                            </div>
                            {/* Decorative background element */}
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-brand-leaf pointer-events-none transform translate-x-4">
                                <Clock size={160} />
                            </div>
                        </div>
                    )}

                    {/* Header Progress Bar for Questions */}
                    {currentStep >= 0 && currentStep < questions.length && (
                        <div className="h-2 bg-slate-100 w-full">
                            <div
                                className="h-full bg-brand-leaf transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}

                    <div className="p-8">
                        {/* Intro Screen */}
                        {currentStep === -1 && (
                            <div className="text-center space-y-6 py-4">
                                <p className="text-slate-600 leading-relaxed text-left">
                                    {t('introDesc')}
                                </p>
                                <div className="bg-brand-sage/10 p-4 rounded-xl border border-brand-sage/20 flex items-start gap-3 text-left">
                                    <Info className="w-5 h-5 text-brand-leaf shrink-0 mt-0.5" />
                                    <p className="text-sm text-brand-forest">
                                        {t('introTime')}
                                    </p>
                                </div>
                                <button
                                    onClick={startQuiz}
                                    className="w-full bg-brand-leaf hover:bg-brand-forest text-white font-semibold flex items-center justify-center gap-2 py-4 rounded-2xl transition-all shadow-sm active:scale-95"
                                >
                                    {t('start')} <ChevronRight size={18} />
                                </button>
                            </div>
                        )}

                        {/* Question Screen */}
                        {currentStep >= 0 && currentStep < questions.length && (
                            <div className="space-y-6 min-h-[400px] flex flex-col">
                                <div className="flex justify-between items-center text-sm font-medium text-slate-400">
                                    <span>{t('question')} {currentStep + 1} {t('outOf')} {questions.length}</span>
                                    <span>{Math.round(progress)}% {t('completed')}</span>
                                </div>

                                <h2 className="text-xl font-semibold text-slate-800 leading-tight">
                                    {questions[currentStep].text}
                                </h2>

                                <div className="grid gap-3 flex-grow">
                                    {questions[currentStep].options.map((opt, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleAnswer(opt.points)}
                                            className="group text-left p-4 rounded-2xl border-2 border-slate-100 hover:border-brand-leaf hover:bg-brand-sage/5 transition-all duration-200 active:scale-[0.98]"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-brand-leaf/20 flex items-center justify-center text-sm font-bold text-slate-500 group-hover:text-brand-forest transition-colors">
                                                    {String.fromCharCode(65 + idx)}
                                                </div>
                                                <span className="text-slate-700 font-medium">{opt.text}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                <div className="pt-4">
                                    <button
                                        onClick={prevStep}
                                        disabled={currentStep === 0}
                                        className="flex items-center gap-2 text-slate-400 hover:text-slate-600 disabled:opacity-0 transition-all font-medium text-sm w-fit"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        {t('prev')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Result Screen */}
                        {currentStep === questions.length && (
                            <div className="text-center space-y-6 py-2">
                                <div className="mb-4">
                                    <div className={`w-24 h-24 rounded-3xl mx-auto flex items-center justify-center mb-4 border-4 ${getResultInfo(score).borderColor} ${getResultInfo(score).color}`}>
                                        {getResultInfo(score).icon}
                                    </div>
                                    <h3 className="text-slate-400 uppercase tracking-widest text-xs font-bold">{t('resultLabel')}: {score} {t('points')}</h3>
                                    <h2 className="text-2xl font-bold text-slate-800 mt-2">{getResultInfo(score).type}</h2>
                                </div>

                                <div className={`p-6 rounded-3xl text-left border ${getResultInfo(score).borderColor} ${getResultInfo(score).color}`}>
                                    <p className="text-slate-700 leading-relaxed italic">
                                        "{getResultInfo(score).desc}"
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-left">
                                        <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                                            <Info className="w-4 h-4 text-brand-leaf" />
                                            {t('interpretation')}
                                        </h4>
                                        <ul className="text-sm text-slate-600 space-y-2">
                                            <li>• {t('score1')}</li>
                                            <li>• {t('score2')}</li>
                                            <li>• {t('score3')}</li>
                                            <li>• {t('score4')}</li>
                                            <li>• {t('score5')}</li>
                                        </ul>
                                    </div>
                                </div>

                                {/* Save Button Action */}
                                {isAuthenticated && (
                                    <div className="w-full pb-4">
                                        <button
                                            onClick={handleSave}
                                            disabled={isSaving || saveStatus === 'success'}
                                            className={`
                                            w-full sm:w-auto flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 md:px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300
                                            ${saveStatus === 'success'
                                                    ? 'bg-brand-leaf text-white shadow-md'
                                                    : saveStatus === 'error'
                                                        ? 'bg-red-50 text-red-600 border border-red-200'
                                                        : 'bg-brand-forest hover:bg-brand-leaf text-white shadow-[0_4px_15px_rgba(42,77,65,0.15)] hover:shadow-[0_4px_20px_rgba(42,77,65,0.25)]'
                                                }
                                        `}
                                        >
                                            {isSaving ? (
                                                <><Loader2 size={18} className="animate-spin" /> {tCommon('saving')}</>
                                            ) : saveStatus === 'success' ? (
                                                <><CheckCircle size={18} /> {tCommon('saved')}</>
                                            ) : saveStatus === 'error' ? (
                                                <><AlertCircle size={18} /> Error</>
                                            ) : (
                                                <><Save size={18} /> {tCommon('saveVault')}</>
                                            )}
                                        </button>
                                    </div>
                                )}

                                <button
                                    onClick={resetQuiz}
                                    className="w-full flex items-center justify-center gap-2 bg-brand-forest hover:bg-brand-text text-white font-semibold py-4 rounded-2xl transition-all shadow-lg active:scale-95"
                                >
                                    <RefreshCcw className="w-5 h-5" />
                                    {t('restart')}
                                </button>

                                <p className="text-[10px] text-slate-400 uppercase tracking-tighter">
                                    {t('methodology')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
