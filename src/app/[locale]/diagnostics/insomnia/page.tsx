"use client";
import React, { useState, useEffect } from 'react';
import { Moon, Info, RefreshCcw, AlertCircle, CheckCircle, Brain, Layout, ArrowLeft, Save, Loader2 } from 'lucide-react';
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { saveTestResult } from '@/actions/save-test';
import { createClient } from '@/utils/supabase/client';

export default function InsomniaCalculatorPage() {
    const t = useTranslations('InsomniaCalculator');
    const tCommon = useTranslations('Common');

    const [answers, setAnswers] = useState<number[]>(Array(7).fill(null));
    const [totalScore, setTotalScore] = useState(0);

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

    const questions = [
        {
            id: 0,
            text: t('q1Text'),
            options: [t('q1A'), t('q1B'), t('q1C'), t('q1D'), t('q1E')],
        },
        {
            id: 1,
            text: t('q2Text'),
            options: [t('q2A'), t('q2B'), t('q2C'), t('q2D'), t('q2E')],
        },
        {
            id: 2,
            text: t('q3Text'),
            options: [t('q3A'), t('q3B'), t('q3C'), t('q3D'), t('q3E')],
        },
        {
            id: 3,
            text: t('q4Text'),
            options: [t('q4A'), t('q4B'), t('q4C'), t('q4D'), t('q4E')],
        },
        {
            id: 4,
            text: t('q5Text'),
            options: [t('q5A'), t('q5B'), t('q5C'), t('q5D'), t('q5E')],
        },
        {
            id: 5,
            text: t('q6Text'),
            options: [t('q6A'), t('q6B'), t('q6C'), t('q6D'), t('q6E')],
        },
        {
            id: 6,
            text: t('q7Text'),
            options: [t('q7A'), t('q7B'), t('q7C'), t('q7D'), t('q7E')],
        }
    ];

    useEffect(() => {
        const score = answers.reduce((acc, curr) => acc + (curr !== null ? curr : 0), 0);
        setTotalScore(score);
    }, [answers]);

    const handleSelect = (qIdx: number, val: number) => {
        const newAnswers = [...answers];
        newAnswers[qIdx] = val;
        setAnswers(newAnswers);
    };

    const resetTest = () => {
        setAnswers(Array(7).fill(null));
    };

    const getInterpretation = (score: number) => {
        if (score <= 7) return { label: t('res1Label'), color: "text-green-600", bg: "bg-green-50", icon: <CheckCircle className="w-6 h-6" />, desc: t('res1Desc') };
        if (score <= 14) return { label: t('res2Label'), color: "text-yellow-500", bg: "bg-yellow-50", icon: <Info className="w-6 h-6" />, desc: t('res2Desc') };
        if (score <= 21) return { label: t('res3Label'), color: "text-orange-600", bg: "bg-orange-50", icon: <AlertCircle className="w-6 h-6" />, desc: t('res3Desc') };
        return { label: t('res4Label'), color: "text-red-600", bg: "bg-red-50", icon: <AlertCircle className="w-6 h-6" />, desc: t('res4Desc') };
    };

    const interpretation = getInterpretation(totalScore);
    const progress = (answers.filter(a => a !== null).length / questions.length) * 100;

    const handleSave = async () => {
        if (!isAuthenticated) return;
        setIsSaving(true);
        setSaveStatus('idle');

        const res = await saveTestResult({
            testType: 'insomnia',
            score: totalScore,
            interpretation: interpretation.label,
            rawData: { answers, maxScore: 28 }
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
        <div className="min-h-screen bg-slate-50 p-4 pt-32 md:p-8 font-sans text-slate-800">
            <div className="max-w-2xl mx-auto space-y-4">

                <div>
                    <Link href="/diagnostics" className="inline-flex items-center gap-2 text-brand-forest hover:text-brand-leaf transition-colors text-sm font-bold">
                        <ArrowLeft size={16} /> {t('back')}
                    </Link>
                </div>

                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">

                    {/* Header */}
                    <div className="bg-brand-forest p-8 text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-2">
                                <Moon className="w-8 h-8 text-brand-leaf" />
                                <h1 className="text-2xl font-serif font-bold tracking-tight">{t('title')}</h1>
                            </div>
                            <p className="text-white/80 text-sm opacity-90 leading-relaxed max-w-lg">
                                {t('subtitle')}
                            </p>
                        </div>

                        {/* Decorative background element */}
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-brand-leaf pointer-events-none transform translate-x-4">
                            <Moon size={160} />
                        </div>

                        {/* Progress Bar */}
                        <div className="absolute bottom-0 left-0 w-full h-1.5 bg-brand-forest/50">
                            <div
                                className="h-full bg-brand-leaf transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Form Body */}
                    <div className="p-6 md:p-8 space-y-8">
                        {questions.map((q, idx) => (
                            <div key={q.id} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex items-baseline gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-sage/20 text-brand-forest flex items-center justify-center text-xs font-bold">
                                        {idx + 1}
                                    </span>
                                    <h3 className="text-lg font-medium leading-tight text-slate-700">{q.text}</h3>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                                    {q.options.map((option, score) => (
                                        <button
                                            key={score}
                                            onClick={() => handleSelect(idx, score)}
                                            className={`px-3 py-3 text-sm rounded-xl transition-all duration-200 border-2 flex flex-col items-center justify-center gap-1
                      ${answers[idx] === score
                                                    ? 'border-brand-leaf bg-brand-sage/10 text-brand-forest shadow-sm ring-1 ring-brand-leaf'
                                                    : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-brand-leaf/50 hover:bg-white'}`}
                                        >
                                            <span className="font-bold text-base">{score}</span>
                                            <span className="text-[10px] uppercase tracking-wider text-center leading-none">
                                                {option}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer Results */}
                    <div className="p-8 bg-slate-50 border-t border-slate-100">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="text-center md:text-left">
                                <div className="text-slate-500 text-sm font-medium uppercase tracking-widest mb-1">{t('resultLabel')}</div>
                                <div className="flex items-baseline justify-center md:justify-start gap-2">
                                    <span className="text-5xl font-black text-brand-forest">{totalScore}</span>
                                    <span className="text-slate-400 font-medium">{t('ofMax')}</span>
                                </div>
                            </div>

                            <div className={`flex-1 p-5 rounded-2xl border ${interpretation.bg} ${interpretation.color} border-current border-opacity-20 flex items-start gap-4 transition-all duration-300 w-full`}>
                                <div className="mt-1">{interpretation.icon}</div>
                                <div>
                                    <p className="font-bold leading-tight mb-1">{interpretation.label}</p>
                                    <p className="text-xs opacity-80">
                                        {interpretation.desc}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Save Button Action */}
                        {isAuthenticated && (
                            <div className="mt-8 border-t border-slate-200 pt-6">
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

                        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-between items-center border-t border-slate-200 pt-6">
                            <div className="flex items-center gap-2 text-slate-400 text-xs text-center md:text-left">
                                <Brain className="w-4 h-4 shrink-0" />
                                <span>{t('methodology')}</span>
                            </div>
                            <button
                                onClick={resetTest}
                                className="flex items-center gap-2 text-brand-forest hover:text-brand-text font-semibold text-sm transition-colors py-2 px-4 rounded-lg hover:bg-slate-200 w-full md:w-auto justify-center"
                            >
                                <RefreshCcw className="w-4 h-4" />
                                {t('restart')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Interpretation Legend */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <Layout className="w-4 h-4" /> {t('legendTitle')}
                        </h4>
                        <ul className="text-xs space-y-2 text-slate-500">
                            <li className="flex justify-between"><span>{t('legend1')}</span> <strong>{t('legend1Desc')}</strong></li>
                            <li className="flex justify-between"><span>{t('legend2')}</span> <strong>{t('legend2Desc')}</strong></li>
                            <li className="flex justify-between"><span>{t('legend3')}</span> <strong>{t('legend3Desc')}</strong></li>
                            <li className="flex justify-between"><span>{t('legend4')}</span> <strong>{t('legend4Desc')}</strong></li>
                        </ul>
                    </div>
                    <div className="bg-brand-sage/10 p-4 rounded-2xl border border-brand-sage/30 text-brand-forest text-xs leading-relaxed">
                        <strong>{t('important')}</strong> {t('disclaimer')}
                    </div>
                </div>
            </div>
        </div>
    );
}
