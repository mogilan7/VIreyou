"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Heart, Info, AlertTriangle, CheckCircle, User, Activity, ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react';
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { saveTestResult } from '@/actions/save-test';
import { createClient } from '@/utils/supabase/client';

const ScoreCalculatorPage = () => {
    const t = useTranslations('ScoreCalculator');
    const tCommon = useTranslations('Common');

    const [gender, setGender] = useState('male');
    const [age, setAge] = useState(50);
    const [isSmoker, setIsSmoker] = useState(false);
    const [systolicBP, setSystolicBP] = useState(140);
    const [cholesterol, setCholesterol] = useState(5);
    const [risk, setRisk] = useState<number>(0);

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

    // Упрощенная логика расчета SCORE на основе коэффициентов
    const calculateScore = useCallback(() => {
        const ageFactor = (age - 40) / 10;
        const bpFactor = (systolicBP - 120) / 20;
        const cholFactor = (cholesterol - 5);

        let base = gender === 'male' ? 1.5 : 0.8;
        if (isSmoker) base *= 2.1;

        let result = base * Math.pow(1.8, ageFactor) + (bpFactor * 0.5) + (cholFactor * 0.4);

        result = Math.max(0, Math.min(45, result));
        setRisk(parseFloat(result.toFixed(1)));
    }, [age, systolicBP, cholesterol, gender, isSmoker]);

    useEffect(() => {
        calculateScore();
    }, [calculateScore]);

    const getRiskColor = (val: number) => {
        if (val < 1) return 'text-green-600 bg-green-50 border-green-200';
        if (val < 5) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        if (val < 10) return 'text-orange-600 bg-orange-50 border-orange-200';
        return 'text-red-600 bg-red-50 border-red-200';
    };

    const getRiskLabel = (val: number) => {
        if (val < 1) return t('riskLow');
        if (val < 5) return t('riskModerate');
        if (val < 10) return t('riskHigh');
        return t('riskVeryHigh');
    };

    const getRecommendation = (val: number) => {
        if (val < 1) return t('recLow');
        if (val < 5) return t('recModerate');
        if (val < 10) return t('recHigh');
        return t('recVeryHigh');
    };

    const handleSave = async () => {
        if (!isAuthenticated) {
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 4000);
            return;
        }
        if (!isAuthenticated) return;
        setIsSaving(true);
        setSaveStatus('idle');

        const res = await saveTestResult({
            testType: 'score',
            score: risk,
            interpretation: getRiskLabel(risk),
            rawData: { gender, age, isSmoker, systolicBP, cholesterol }
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
            <div className="max-w-2xl mx-auto space-y-4">

                <div>
                    <Link href="/diagnostics" className="inline-flex items-center gap-2 text-brand-forest hover:text-brand-leaf transition-colors text-sm font-bold">
                        <ArrowLeft size={16} /> {t('back')}
                    </Link>
                </div>

                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">

                    {/* Header - Brand Styled */}
                    <div className="bg-brand-forest p-8 text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-2">
                                <Heart className="w-8 h-8 fill-brand-leaf text-brand-leaf" />
                                <h1 className="text-2xl font-serif font-bold tracking-tight">{t('title')}</h1>
                            </div>
                            <p className="text-white/80 text-sm leading-relaxed max-w-lg">
                                {t('subtitle')}
                            </p>
                        </div>
                        {/* Decorative background element */}
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-brand-leaf pointer-events-none transform translate-x-4">
                            <Heart size={160} />
                        </div>
                    </div>

                    <div className="p-8 space-y-8">

                        {/* Inputs Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                            {/* Gender Selection */}
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                    <User className="w-4 h-4" /> {t('gender')}
                                </label>
                                <div className="flex p-1 bg-slate-100 rounded-xl">
                                    <button
                                        onClick={() => setGender('male')}
                                        className={`flex-1 py-2 px-4 rounded-lg transition-all ${gender === 'male' ? 'bg-white shadow-sm text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {t('male')}
                                    </button>
                                    <button
                                        onClick={() => setGender('female')}
                                        className={`flex-1 py-2 px-4 rounded-lg transition-all ${gender === 'female' ? 'bg-white shadow-sm text-pink-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {t('female')}
                                    </button>
                                </div>
                            </div>

                            {/* Smoking Status */}
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                    <Activity className="w-4 h-4" /> {t('smokingStatus')}
                                </label>
                                <div className="flex p-1 bg-slate-100 rounded-xl">
                                    <button
                                        onClick={() => setIsSmoker(false)}
                                        className={`flex-1 py-2 px-4 rounded-lg transition-all ${!isSmoker ? 'bg-white shadow-sm text-green-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {t('nonSmoker')}
                                    </button>
                                    <button
                                        onClick={() => setIsSmoker(true)}
                                        className={`flex-1 py-2 px-4 rounded-lg transition-all ${isSmoker ? 'bg-white shadow-sm text-red-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {t('smoker')}
                                    </button>
                                </div>
                            </div>

                            {/* Age Slider */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{t('age')}</label>
                                    <span className="text-lg font-bold text-blue-600">{age} {t('unitYears')}</span>
                                </div>
                                <input
                                    type="range" min="40" max="65" step="1"
                                    value={age} onChange={(e) => setAge(parseInt(e.target.value))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 touch-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:shadow-md"
                                />
                            </div>

                            {/* Systolic BP Slider */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{t('systolicBP')}</label>
                                    <span className="text-lg font-bold text-blue-600">{systolicBP} {t('unitMmHg')}</span>
                                </div>
                                <input
                                    type="range" min="100" max="180" step="5"
                                    value={systolicBP} onChange={(e) => setSystolicBP(parseInt(e.target.value))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 touch-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:shadow-md"
                                />
                            </div>

                            {/* Cholesterol Slider */}
                            <div className="space-y-3 md:col-span-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{t('cholesterol')}</label>
                                    <span className="text-lg font-bold text-blue-600">{cholesterol} {t('unitMmolL')}</span>
                                </div>
                                <input
                                    type="range" min="3" max="8" step="0.1"
                                    value={cholesterol} onChange={(e) => setCholesterol(parseFloat(e.target.value))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 touch-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:shadow-md"
                                />
                                <div className="flex justify-between text-[10px] text-slate-400 font-medium px-1">
                                    <span>3.0 ({t('labelLow')})</span>
                                    <span>5.0 ({t('labelNorm')})</span>
                                    <span>8.0 ({t('labelHigh')})</span>
                                </div>
                            </div>
                        </div>

                        {/* Results Section */}
                        <div className={`mt-10 p-6 rounded-2xl border transition-colors duration-500 ${getRiskColor(risk).split(' ')[1]} ${getRiskColor(risk).split(' ')[2]}`}>
                            <div className="flex flex-col md:flex-row items-center gap-6">
                                <div className="text-center">
                                    <div className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-1">{t('riskTitle')}</div>
                                    <div className={`text-6xl font-black ${getRiskColor(risk).split(' ')[0]}`}>
                                        {risk}%
                                    </div>
                                </div>

                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <h3 className={`text-xl font-bold ${getRiskColor(risk).split(' ')[0]}`}>
                                            {getRiskLabel(risk)}
                                        </h3>
                                        {risk >= 5 ? <AlertTriangle className="w-5 h-5 text-orange-500" /> : <CheckCircle className="w-5 h-5 text-green-500" />}
                                    </div>
                                    <p className="text-slate-700 leading-relaxed text-sm">
                                        {getRecommendation(risk)}
                                    </p>
                                </div>
                            </div>

                            {/* Save Button Action */}
                            <div className="flex flex-col gap-3 w-full">
            <div className="mt-6 pt-6 border-t border-slate-200/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="text-sm text-slate-600 font-medium">
                                        {tCommon('saveVaultPrompt')}
                                    </div>
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving || saveStatus === 'success'}
                                        className={`
                                            w-full sm:w-auto flex flex-1 sm:flex-none items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300
                                            ${saveStatus === 'success'
                                                ? 'bg-brand-leaf text-white shadow-[0_4px_15px_rgba(42,77,65,0.15)]'
                                                : saveStatus === 'error'
                                                    ? 'bg-red-50 text-red-500 border border-red-200'
                                                    : 'bg-brand-forest hover:bg-brand-leaf text-white shadow-[0_4px_15px_rgba(42,77,65,0.15)] hover:shadow-[0_4px_20px_rgba(42,77,65,0.25)]'
                                            }
                                        `}
                                    >
                                        {isSaving ? (
                                            <><Loader2 size={18} className="animate-spin" /> {tCommon('saving')}</>
                                        ) : saveStatus === 'success' ? (
                                            <><CheckCircle size={18} /> {tCommon('saved')}</>
                                        ) : saveStatus === 'error' ? (
                                            <><AlertCircle size={18} /> {tCommon('error')}</>
                                        ) : (
                                            <><Save size={18} /> {tCommon('saveVault')}</>
                                        )}
                                    </button>
                                </div>
                            
            {!isAuthenticated && (
                <div className="text-center text-xs text-slate-500 font-medium">
                   <a href="/ru/login" target="_blank" className="text-indigo-600 hover:underline font-bold">Войдите</a>, чтобы результаты сохранились в медархиве
                </div>
            )}
          </div>
                        </div>

                        {/* Legend/Info */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-4">
                            <div className="p-3 bg-green-50 rounded-xl border border-green-100 text-center">
                                <div className="text-xs font-bold text-green-700">{'<1%'}</div>
                                <div className="text-[10px] text-green-600">{t('riskLow')}</div>
                            </div>
                            <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-100 text-center">
                                <div className="text-xs font-bold text-yellow-700">1–4%</div>
                                <div className="text-[10px] text-yellow-600">{t('riskModerate')}</div>
                            </div>
                            <div className="p-3 bg-orange-50 rounded-xl border border-orange-100 text-center">
                                <div className="text-xs font-bold text-orange-700">5–9%</div>
                                <div className="text-[10px] text-orange-600">{t('riskHigh')}</div>
                            </div>
                            <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-center">
                                <div className="text-xs font-bold text-red-700">{'>10%'}</div>
                                <div className="text-[10px] text-red-600">{t('riskVeryHigh')}</div>
                            </div>
                        </div>

                    </div>

                    {/* Footer Note */}
                    <div className="bg-slate-50 p-6 border-t border-slate-100">
                        <div className="flex gap-3 text-slate-400">
                            <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-xs mb-1">{t('infoTitle')}</p>
                                <p className="text-xs leading-relaxed italic">
                                    {t('infoDesc')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScoreCalculatorPage;
