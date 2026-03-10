"use client";
import React, { useState, useEffect } from 'react';
import { Calculator, Activity, Scale, Ruler, User, Flame, Target, Info, HeartPulse, ArrowLeft } from 'lucide-react';
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { saveTestResult } from '@/actions/save-test';
import { createClient } from '@/utils/supabase/client';

export default function EnergyCalculatorPage() {
    const t = useTranslations('EnergyCalculator');
    const tCommon = useTranslations('Common');

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const [gender, setGender] = useState('female');
    const [age, setAge] = useState(30);
    const [weight, setWeight] = useState(65);
    const [height, setHeight] = useState(165);
    const [activity, setActivity] = useState(1.375);
    const [goal, setGoal] = useState('maintain');

    const [results, setResults] = useState({
        bmr: 0,
        tdee: 0,
        targetCalories: 0,
        macros: { protein: 0, fats: 0, carbs: 0 }
    });

    const calculate = () => {
        let bmr = 0;
        if (gender === 'male') {
            bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
        } else {
            bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
        }

        const tdee = bmr * activity;

        let targetCalories = tdee;
        if (goal === 'lose') targetCalories = tdee - (tdee * 0.20);
        if (goal === 'gain') targetCalories = tdee + (tdee * 0.15);

        let proteinPercent, fatPercent, carbPercent;

        if (goal === 'lose') {
            proteinPercent = 0.35;
            fatPercent = 0.30;
            carbPercent = 0.35;
        } else if (goal === 'gain') {
            proteinPercent = 0.25;
            fatPercent = 0.25;
            carbPercent = 0.50;
        } else {
            proteinPercent = 0.30;
            fatPercent = 0.30;
            carbPercent = 0.40;
        }

        const protein = (targetCalories * proteinPercent) / 4;
        const fats = (targetCalories * fatPercent) / 9;
        const carbs = (targetCalories * carbPercent) / 4;

        setResults({
            bmr: Math.round(bmr),
            tdee: Math.round(tdee),
            targetCalories: Math.round(targetCalories),
            macros: {
                protein: Math.round(protein),
                fats: Math.round(fats),
                carbs: Math.round(carbs)
            }
        });
    };

    useEffect(() => {
        calculate();
    }, [gender, age, weight, height, activity, goal]);

    useEffect(() => {
        const checkAuth = async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            setIsAuthenticated(!!session);
        };
        checkAuth();
    }, []);

    const handleSave = async () => {
        if (!isAuthenticated) return;

        setIsSaving(true);
        setSaveStatus('idle');

        try {
            const result = await saveTestResult({
                testType: 'energy',
                score: results.targetCalories,
                interpretation: `${results.targetCalories} kcal`,
                rawData: {
                    gender, age, weight, height, activity, goal,
                    results
                }
            });

            if (result.success) {
                setSaveStatus('success');
            } else {
                setSaveStatus('error');
            }
        } catch (error) {
            console.error(error);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FAFAFA] p-4 md:p-8 font-sans text-brand-text">
            <div className="max-w-5xl mx-auto space-y-6 pt-12 md:pt-4">

                <Link href="/diagnostics" className="inline-flex items-center gap-2 text-brand-gray hover:text-brand-leaf transition-colors text-sm font-bold mb-2 tracking-widest uppercase">
                    <ArrowLeft size={16} /> {t('back')}
                </Link>

                {/* Header */}
                <header className="bg-brand-forest text-white p-8 md:p-10 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex items-center space-x-6">
                    <div className="bg-white/10 p-4 rounded-2xl">
                        <HeartPulse size={36} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-serif font-bold">{t('title')}</h1>
                        <p className="text-white/80 mt-2 text-sm md:text-base font-light">{t('subtitle')}</p>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Form Section */}
                    <div className="lg:col-span-5 bg-white p-8 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-brand-sage/40">
                        <div className="flex items-center space-x-3 mb-8 text-brand-leaf">
                            <Calculator size={24} />
                            <h2 className="text-xl font-bold font-serif text-brand-text">{t('paramsTitle')}</h2>
                        </div>

                        <div className="space-y-6">

                            {/* Gender */}
                            <div>
                                <label className="block text-xs font-bold text-brand-gray uppercase tracking-widest mb-3">{t('gender')}</label>
                                <div className="flex space-x-4">
                                    <label className={`flex-1 flex items-center justify-center p-3.5 border rounded-xl cursor-pointer transition-colors text-sm font-semibold ${gender === 'female' ? 'bg-[#E8F1EB] border-brand-leaf text-brand-forest' : 'border-brand-sage/50 hover:bg-[#FAFAFA] text-brand-text'}`}>
                                        <input type="radio" name="gender" value="female" checked={gender === 'female'} onChange={(e) => setGender(e.target.value)} className="hidden" />
                                        {t('female')}
                                    </label>
                                    <label className={`flex-1 flex items-center justify-center p-3.5 border rounded-xl cursor-pointer transition-colors text-sm font-semibold ${gender === 'male' ? 'bg-[#E8F1EB] border-brand-leaf text-brand-forest' : 'border-brand-sage/50 hover:bg-[#FAFAFA] text-brand-text'}`}>
                                        <input type="radio" name="gender" value="male" checked={gender === 'male'} onChange={(e) => setGender(e.target.value)} className="hidden" />
                                        {t('male')}
                                    </label>
                                </div>
                            </div>

                            {/* Age, Weight, Height Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="flex items-center text-xs font-bold text-brand-gray uppercase tracking-widest mb-2">
                                        <User size={12} className="mr-1.5" /> {t('age')}
                                    </label>
                                    <input type="number" min="15" max="100" value={age} onChange={(e) => setAge(Number(e.target.value))} className="w-full p-3 bg-[#FAFAFA] border border-brand-sage/50 rounded-xl focus:ring-1 focus:ring-brand-leaf outline-none transition-all text-sm font-semibold text-brand-text" />
                                </div>
                                <div>
                                    <label className="flex items-center text-xs font-bold text-brand-gray uppercase tracking-widest mb-2">
                                        <Scale size={12} className="mr-1.5" /> {t('weight')}
                                    </label>
                                    <input type="number" min="30" max="250" value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="w-full p-3 bg-[#FAFAFA] border border-brand-sage/50 rounded-xl focus:ring-1 focus:ring-brand-leaf outline-none transition-all text-sm font-semibold text-brand-text" />
                                </div>
                                <div>
                                    <label className="flex items-center text-xs font-bold text-brand-gray uppercase tracking-widest mb-2">
                                        <Ruler size={12} className="mr-1.5" /> {t('height')}
                                    </label>
                                    <input type="number" min="100" max="250" value={height} onChange={(e) => setHeight(Number(e.target.value))} className="w-full p-3 bg-[#FAFAFA] border border-brand-sage/50 rounded-xl focus:ring-1 focus:ring-brand-leaf outline-none transition-all text-sm font-semibold text-brand-text" />
                                </div>
                            </div>

                            {/* Activity Level */}
                            <div>
                                <label className="flex items-center text-xs font-bold text-brand-gray uppercase tracking-widest mb-3">
                                    <Activity size={12} className="mr-1.5" /> {t('activity')}
                                </label>
                                <select value={activity} onChange={(e) => setActivity(Number(e.target.value))} className="w-full p-3.5 bg-[#FAFAFA] border border-brand-sage/50 rounded-xl focus:ring-1 focus:ring-brand-leaf outline-none text-sm font-semibold text-brand-text appearance-none">
                                    <option value={1.2}>{t('act1')}</option>
                                    <option value={1.375}>{t('act2')}</option>
                                    <option value={1.55}>{t('act3')}</option>
                                    <option value={1.725}>{t('act4')}</option>
                                    <option value={1.9}>{t('act5')}</option>
                                </select>
                            </div>

                            {/* Goal */}
                            <div>
                                <label className="flex items-center text-xs font-bold text-brand-gray uppercase tracking-widest mb-3">
                                    <Target size={12} className="mr-1.5" /> {t('goal')}
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <label className={`flex flex-col items-center justify-center p-3 border rounded-xl cursor-pointer transition-colors text-center text-xs font-bold uppercase tracking-wide leading-tight ${goal === 'lose' ? 'bg-[#E8F1EB] border-brand-leaf text-brand-forest' : 'border-brand-sage/50 hover:bg-[#FAFAFA] text-brand-text'}`}>
                                        <input type="radio" name="goal" value="lose" checked={goal === 'lose'} onChange={(e) => setGoal(e.target.value)} className="hidden" />
                                        {t('lose')}
                                    </label>
                                    <label className={`flex flex-col items-center justify-center p-3 border rounded-xl cursor-pointer transition-colors text-center text-xs font-bold uppercase tracking-wide leading-tight ${goal === 'maintain' ? 'bg-[#E8F1EB] border-brand-leaf text-brand-forest' : 'border-brand-sage/50 hover:bg-[#FAFAFA] text-brand-text'}`}>
                                        <input type="radio" name="goal" value="maintain" checked={goal === 'maintain'} onChange={(e) => setGoal(e.target.value)} className="hidden" />
                                        {t('maintain')}
                                    </label>
                                    <label className={`flex flex-col items-center justify-center p-3 border rounded-xl cursor-pointer transition-colors text-center text-xs font-bold uppercase tracking-wide leading-tight ${goal === 'gain' ? 'bg-[#E8F1EB] border-brand-leaf text-brand-forest' : 'border-brand-sage/50 hover:bg-[#FAFAFA] text-brand-text'}`}>
                                        <input type="radio" name="goal" value="gain" checked={goal === 'gain'} onChange={(e) => setGoal(e.target.value)} className="hidden" />
                                        {t('gain')}
                                    </label>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Results Section */}
                    <div className="lg:col-span-7 space-y-6">

                        {/* Main Result Card */}
                        <div className="bg-white p-8 md:p-10 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-brand-sage/40 relative overflow-hidden h-full flex flex-col justify-between">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-brand-leaf">
                                <Flame size={200} />
                            </div>

                            <div className="relative z-10 mb-8">
                                <h2 className="text-xl font-bold font-serif text-brand-text mb-6">{t('resultsTitle')}</h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-[#FAFAFA] p-6 rounded-2xl border border-brand-sage/40">
                                        <div className="text-brand-gray text-[10px] uppercase font-bold tracking-widest mb-2">{t('bmrTitle')}</div>
                                        <div className="text-3xl font-serif font-bold text-brand-text">{results.bmr} <span className="text-sm font-sans font-medium text-brand-gray normal-case">{t('bmrUnit')}</span></div>
                                        <div className="text-xs text-brand-gray/60 mt-3">{t('bmrDesc')}</div>
                                    </div>

                                    <div className="bg-[#E8F1EB] p-6 rounded-2xl border border-brand-leaf/30">
                                        <div className="text-brand-forest text-[10px] uppercase font-bold tracking-widest mb-2">{t('tdeeTitle')}</div>
                                        <div className="text-3xl font-serif font-bold text-brand-leaf">{results.tdee} <span className="text-sm font-sans font-medium text-brand-forest/60 normal-case">{t('bmrUnit')}</span></div>
                                        <div className="text-xs text-brand-forest/60 mt-3">{t('tdeeDesc')}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-brand-sage/40 relative z-10 flex-grow flex flex-col justify-end">
                                <div className="flex flex-col mb-6">
                                    <div className="text-brand-gray text-[10px] uppercase font-bold tracking-widest mb-2">{t('recTitle')}</div>
                                    <div className="text-5xl font-serif font-bold text-brand-text">{results.targetCalories} <span className="text-xl font-sans font-medium text-brand-gray normal-case">{t('kcal')}</span></div>
                                </div>

                                {/* Macros */}
                                <div className="mt-auto">
                                    <div className="text-[10px] font-bold text-brand-gray uppercase tracking-widest mb-4">{t('macrosTitle')}</div>
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div className="bg-[#F0F4F8] p-4 rounded-2xl border border-slate-200">
                                            <div className="text-slate-700 font-bold text-xl font-serif mb-1">{results.macros.protein} г</div>
                                            <div className="text-slate-500 text-[9px] uppercase font-bold tracking-widest">{t('protein')}</div>
                                        </div>
                                        <div className="bg-[#FFF6ED] p-4 rounded-2xl border border-orange-200">
                                            <div className="text-orange-700 font-bold text-xl font-serif mb-1">{results.macros.fats} г</div>
                                            <div className="text-orange-500 text-[9px] uppercase font-bold tracking-widest">{t('fats')}</div>
                                        </div>
                                        <div className="bg-[#F4F1E1] p-4 rounded-2xl border border-[#E0D8B0]">
                                            <div className="text-[#8B7C32] font-bold text-xl font-serif mb-1">{results.macros.carbs} г</div>
                                            <div className="text-[#A39656] text-[9px] uppercase font-bold tracking-widest">{t('carbs')}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Save Button */}
                                {isAuthenticated && (
                                    <div className="mt-8 pt-6 border-t border-brand-sage/40">
                                        <button
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-bold transition-all disabled:opacity-70 disabled:cursor-not-allowed bg-brand-leaf text-white hover:bg-brand-forest shadow-md"
                                        >
                                            {isSaving ? (
                                                <><Loader2 size={20} className="animate-spin" /> {t('saving')}</>
                                            ) : saveStatus === 'success' ? (
                                                <><CheckCircle size={20} /> {t('saved')}</>
                                            ) : (
                                                <><Save size={20} /> {t('saveBtn')}</>
                                            )}
                                        </button>

                                        {saveStatus === 'error' && (
                                            <p className="text-red-500 text-sm text-center font-medium mt-2">{t('errorSaving')}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Box */}
                <div className="bg-[#FAFAFA] p-8 rounded-[2rem] flex flex-col sm:flex-row items-start space-y-4 sm:space-y-0 sm:space-x-6 border border-brand-sage/40 shadow-[0_4px_20px_rgba(0,0,0,0.05)] mt-8">
                    <div className="text-brand-leaf flex-shrink-0 bg-white p-3 rounded-full border border-brand-sage/30 shadow-sm">
                        <Info size={24} />
                    </div>
                    <div>
                        <h4 className="font-serif font-bold text-xl text-brand-text mb-2">{t('lawTitle')}</h4>
                        <p className="text-sm text-brand-gray leading-relaxed max-w-4xl">
                            {t('lawDesc')}
                        </p>
                    </div>
                </div>
            </div>
        </div >
    );
}
