"use client";
import React, { useState, useEffect } from 'react';
import { Droplets, Activity, Save, Loader2, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { saveTestResult } from '@/actions/save-test';
import { createClient } from '@/utils/supabase/client';

export default function WaterCalculatorPage() {
    const t = useTranslations('WaterCalculator');
    const tCommon = useTranslations('Common');

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    const [weight, setWeight] = useState(70);
    const [sex, setSex] = useState<'male' | 'female'>('male');
    const [age, setAge] = useState(30);
    const [preg, setPreg] = useState(0); // 0, 300, or 700
    const [act, setAct] = useState(0); // 0, 500, or 1000
    const [hot, setHot] = useState(false);
    const [unit, setUnit] = useState<'l' | 'cups'>('l');

    const [results, setResults] = useState({ drink: 0, total: 0, food: 0, cups: 0 });

    const calculate = () => {
        if (!weight || weight <= 0) {
            setResults({ drink: 0, total: 0, food: 0, cups: 0 });
            return;
        }

        let mlPerKg = 35;
        if (age >= 66) mlPerKg = 25;
        else if (age >= 56) mlPerKg = 30;

        const sexF = sex === 'female' ? 0.95 : 1.0;
        let total = weight * mlPerKg * sexF + act;

        if (hot) total *= 1.10;
        if (sex === 'female') total += preg;

        const drink = total * 0.80; // 80% from drinks
        const food = total - drink; // 20% from food

        const round = (x: number) => Math.round(x / 50) * 50;

        setResults({
            drink: round(drink),
            total: round(total),
            food: round(food),
            cups: Math.round(drink / 250)
        });
    };

    useEffect(() => {
        calculate();
    }, [weight, sex, age, preg, act, hot]);

    useEffect(() => {
        const checkAuth = async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            setIsAuthenticated(!!session);
        };
        checkAuth();
    }, []);

    const handleSave = async () => {
        if (!isAuthenticated) {
            setIsAuthModalOpen(true);
            return;
        }

        setIsSaving(true);
        setSaveStatus('idle');

        try {
            const result = await saveTestResult({
                testType: 'water',
                score: results.drink,
                interpretation: `${results.drink} ml`,
                rawData: {
                    weight, sex, age, preg, act, hot,
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
            if (saveStatus !== 'error') {
                setTimeout(() => setSaveStatus('idle'), 3000);
            }
        }
    };

    // Helper to bold specific parts in translations
    const formatApproxCups = (text: string, cups: number) => {
        const parts = text.replace('{cups}', String(cups)).split(String(cups));
        if (parts.length < 2) return text;
        return (
            <>
                {parts[0]}
                <b className="text-brand-forest font-bold">{cups}</b>
                {parts[1]}
            </>
        );
    };

    return (
        <div className="min-h-screen bg-brand-bg pt-32 pb-24 px-6">
            <div className="max-w-2xl mx-auto">
                {/* Back button */}
                <Link
                    href="/diagnostics"
                    className="inline-flex items-center gap-2 text-brand-leaf hover:text-brand-forest transition-colors mb-8 text-sm font-bold uppercase tracking-widest"
                >
                    <ArrowLeft size={16} />
                    {t('back')}
                </Link>

                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E8F1EB] text-brand-leaf text-[10px] uppercase font-bold tracking-widest rounded-full mb-6">
                        <Droplets size={12} />
                        {t('eyebrow')}
                    </div>
                    <h1 className="font-serif text-4xl md:text-5xl text-brand-text mb-6">
                        {t('title')}
                    </h1>
                    <p className="text-brand-gray max-w-lg mx-auto text-sm leading-relaxed">
                        {t('subtitle')}
                    </p>
                </div>

                <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-brand-sage/40 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-sage/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                    <div className="flex flex-col gap-8 relative z-10">

                        {/* Weight */}
                        <div>
                            <div className="flex justify-between items-end mb-4">
                                <label htmlFor="weight" className="font-bold text-brand-text text-sm tracking-wide">
                                    {t('weight')}
                                </label>
                                <div className="flex items-baseline gap-2">
                                    <input
                                        id="weight"
                                        type="number"
                                        min="35"
                                        max="180"
                                        value={weight}
                                        onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                                        className="w-20 text-right bg-transparent border-b-2 border-brand-sage/50 focus:border-brand-leaf text-brand-leaf font-serif text-3xl font-bold p-1 outline-none transition-colors tabular-nums"
                                    />
                                    <span className="text-brand-gray font-bold text-sm">{t('weightUnit')}</span>
                                </div>
                            </div>
                            <input
                                type="range"
                                min="35"
                                max="180"
                                step="1"
                                value={weight}
                                onChange={(e) => setWeight(parseInt(e.target.value))}
                                className="w-full h-2 bg-brand-sage/40 rounded-full appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-brand-leaf/30"
                                style={{
                                    background: `linear-gradient(90deg, #6c8a7b ${(weight - 35) / (180 - 35) * 100}%, #e2e8f0 ${(weight - 35) / (180 - 35) * 100}%)`
                                }}
                            />
                            <style dangerouslySetInnerHTML={{__html: `
                                input[type=range]::-webkit-slider-thumb {
                                    appearance: none;
                                    width: 24px;
                                    height: 24px;
                                    border-radius: 50%;
                                    background: white;
                                    border: 3px solid #6c8a7b;
                                    cursor: pointer;
                                    box-shadow: 0 2px 6px rgba(0,0,0,0.1);
                                    transition: transform 0.1s;
                                }
                                input[type=range]::-webkit-slider-thumb:hover {
                                    transform: scale(1.1);
                                }
                            `}} />
                            
                            <div className="flex justify-between text-xs text-brand-gray/60 mt-3 font-medium">
                                <span>35 {t('weightUnit')}</span>
                                <span>180 {t('weightUnit')}</span>
                            </div>
                        </div>

                        {/* Sex & Age Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label className="block font-bold text-brand-text text-sm tracking-wide mb-3">
                                    {t('sex')}
                                </label>
                                <div className="flex gap-2 p-1 bg-[#E8F1EB] rounded-2xl border border-brand-sage/30">
                                    <button
                                        onClick={() => { setSex('male'); setPreg(0); }}
                                        className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${sex === 'male' ? 'bg-white text-brand-leaf shadow-sm' : 'text-brand-gray hover:text-brand-text'}`}
                                    >
                                        {t('male')}
                                    </button>
                                    <button
                                        onClick={() => setSex('female')}
                                        className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${sex === 'female' ? 'bg-white text-brand-leaf shadow-sm' : 'text-brand-gray hover:text-brand-text'}`}
                                    >
                                        {t('female')}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="age" className="block font-bold text-brand-text text-sm tracking-wide mb-3">
                                    {t('age')} <span className="text-brand-gray/60 ml-1 font-medium text-xs">{t('years')}</span>
                                </label>
                                <input
                                    id="age"
                                    type="number"
                                    min="18"
                                    max="99"
                                    value={age}
                                    onChange={(e) => setAge(parseInt(e.target.value) || 30)}
                                    className="w-full bg-[#E8F1EB] border border-brand-sage/30 text-brand-text text-sm font-bold py-3.5 px-4 rounded-2xl outline-none focus:border-brand-leaf transition-colors tabular-nums"
                                />
                            </div>
                        </div>

                        {/* Pregnancy (Visible only if female) */}
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${sex === 'female' ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0 -mt-8'}`}>
                            <label className="block font-bold text-brand-text text-sm tracking-wide mb-3">
                                {t('specialPeriod')}
                            </label>
                            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                {[
                                    { val: 0, t: t('no'), d: t('normal') },
                                    { val: 300, t: t('pregnancy'), d: '+300 ml' },
                                    { val: 700, t: t('lactation'), d: '+700 ml' }
                                ].map((item) => (
                                    <button
                                        key={item.val}
                                        onClick={() => setPreg(item.val)}
                                        className={`py-3 px-1 sm:px-3 rounded-2xl border-[1.5px] text-center transition-all flex flex-col justify-center min-h-[4.5rem] ${preg === item.val ? 'border-brand-leaf bg-[#E8F1EB]' : 'border-brand-sage/40 bg-white hover:border-brand-leaf/50'}`}
                                    >
                                        <span className="block font-bold text-brand-text text-[11px] sm:text-xs leading-tight mb-1 break-words w-full">{item.t}</span>
                                        <span className="block text-[10px] text-brand-gray">{item.d}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Activity */}
                        <div>
                            <label className="block font-bold text-brand-text text-sm tracking-wide mb-3">
                                {t('activity')} <span className="text-brand-gray/60 ml-1 font-medium text-xs">{t('sportPerDay')}</span>
                            </label>
                            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                {[
                                    { val: 0, t: t('low'), d: t('almostNone') },
                                    { val: 500, t: t('medium'), d: t('min3060') },
                                    { val: 1000, t: t('high'), d: t('over60') }
                                ].map((item) => (
                                    <button
                                        key={item.val}
                                        onClick={() => setAct(item.val)}
                                        className={`py-3 px-1 sm:px-3 rounded-2xl border-[1.5px] text-center transition-all flex flex-col justify-center min-h-[4.5rem] ${act === item.val ? 'border-brand-leaf bg-[#E8F1EB]' : 'border-brand-sage/40 bg-white hover:border-brand-leaf/50'}`}
                                    >
                                        <span className="block font-bold text-brand-text text-[11px] sm:text-xs leading-tight mb-1 break-words w-full">{item.t}</span>
                                        <span className="block text-[10px] text-brand-gray">{item.d}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Hot Climate Toggle */}
                        <label className="flex items-center justify-between p-4 bg-[#E8F1EB] border border-brand-sage/30 rounded-2xl cursor-pointer hover:bg-[#E0EBE4] transition-colors">
                            <div>
                                <div className="font-bold text-brand-text text-sm">{t('hotClimateTitle')}</div>
                                <div className="text-xs text-brand-gray mt-1">{t('hotClimateDesc')}</div>
                            </div>
                            <div className="relative w-12 h-7 flex-none">
                                <input
                                    type="checkbox"
                                    checked={hot}
                                    onChange={(e) => setHot(e.target.checked)}
                                    className="peer sr-only"
                                />
                                <div className="absolute inset-0 bg-brand-sage/50 rounded-full transition-colors peer-checked:bg-brand-leaf"></div>
                                <div className="absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform peer-checked:translate-x-5"></div>
                            </div>
                        </label>

                        {/* Results Box */}
                        <div className="bg-[#E8F1EB] border border-brand-sage/40 rounded-3xl p-6 md:p-8 mt-2">
                            <div className="flex justify-center mb-6">
                                <div className="flex gap-1 p-1 bg-white border border-brand-sage/40 rounded-xl">
                                    <button
                                        onClick={() => setUnit('l')}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${unit === 'l' ? 'bg-[#E8F1EB] text-brand-leaf' : 'text-brand-gray hover:text-brand-text'}`}
                                    >
                                        {t('liters')}
                                    </button>
                                    <button
                                        onClick={() => setUnit('cups')}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${unit === 'cups' ? 'bg-[#E8F1EB] text-brand-leaf' : 'text-brand-gray hover:text-brand-text'}`}
                                    >
                                        {t('cups')}
                                    </button>
                                </div>
                            </div>

                            <div className="text-center">
                                <h3 className="text-[10px] uppercase tracking-widest text-brand-gray font-bold mb-3">{t('dailyNorm')}</h3>
                                <div className="text-brand-leaf font-serif font-bold leading-none mb-3">
                                    <span className="text-6xl md:text-7xl tabular-nums tracking-tighter">
                                        {unit === 'l' ? (results.drink / 1000).toFixed(1) : results.cups}
                                    </span>
                                    <span className="text-brand-gray text-xl md:text-2xl ml-3 tracking-normal font-sans">
                                        {unit === 'l' ? t('literUnit') : t('cupsUnit')}
                                    </span>
                                </div>
                                <p className="text-sm text-brand-gray font-medium tabular-nums">
                                    {unit === 'l' ? t('onlyDrinks', { ml: results.drink }) : t('inCups', { ml: results.drink })}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-8">
                                <div className="bg-white border border-brand-sage/40 rounded-2xl p-4">
                                    <div className="text-[9px] uppercase tracking-widest text-brand-gray font-bold mb-1.5">{t('totalWater')}</div>
                                    <div className="font-serif font-bold text-2xl text-brand-text tabular-nums">
                                        {results.total} <span className="text-xs text-brand-gray font-sans font-medium">{t('mlUnit')}</span>
                                    </div>
                                </div>
                                <div className="bg-brand-leaf/10 border border-brand-leaf/30 rounded-2xl p-4">
                                    <div className="text-[9px] uppercase tracking-widest text-brand-leaf/80 font-bold mb-1.5">{t('fromFood')}</div>
                                    <div className="font-serif font-bold text-2xl text-brand-forest tabular-nums">
                                        {results.food} <span className="text-xs text-brand-leaf font-sans font-medium">{t('mlUnit')}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-8 border-t border-brand-sage/50">
                                <p className="text-center text-xs text-brand-gray mb-6 font-medium">
                                    {formatApproxCups(t('approxCups', { cups: results.cups }), results.cups)}
                                </p>
                                <div className="flex flex-wrap justify-center gap-1.5 max-w-[300px] mx-auto">
                                    {Array.from({ length: Math.min(results.cups, 16) }).map((_, i) => (
                                        <div key={i} className="w-5 h-7 border-[1.5px] border-brand-leaf rounded-b-md rounded-t-sm relative overflow-hidden bg-white">
                                            <div
                                                className="absolute bottom-0 left-0 w-full h-[82%] bg-brand-leaf opacity-50 origin-bottom"
                                                style={{ animation: `rise 0.6s cubic-bezier(0.2,0.8,0.3,1.1) both`, animationDelay: `${i * 45}ms` }}
                                            ></div>
                                        </div>
                                    ))}
                                    {results.cups > 16 && <div className="self-center text-brand-leaf font-bold ml-1 text-lg">+</div>}
                                </div>
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="mt-4 border-t border-brand-sage/40 pt-8">
                            <button
                                onClick={handleSave}
                                disabled={isSaving || saveStatus === 'success'}
                                className={`w-full py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
                                    saveStatus === 'success'
                                        ? 'bg-green-100 text-green-700'
                                        : saveStatus === 'error'
                                        ? 'bg-red-50 text-red-600'
                                        : 'bg-brand-leaf hover:bg-brand-forest text-white shadow-md hover:shadow-lg'
                                }`}
                            >
                                {isSaving ? (
                                    <><Loader2 size={18} className="animate-spin" /> {t('saving')}</>
                                ) : saveStatus === 'success' ? (
                                    <><CheckCircle size={18} /> {t('saved')}</>
                                ) : saveStatus === 'error' ? (
                                    <><AlertCircle size={18} /> {t('saveError')}</>
                                ) : (
                                    <><Save size={18} /> {t('saveBtn')}</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-xs text-brand-gray/60 leading-relaxed px-4 text-justify">
                    <span className="font-bold text-brand-gray/80 mr-1">Как считаем:</span>
                    {t('note')}
                </div>
            </div>

            {/* Auth Modal */}
            {isAuthModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm" onClick={() => setIsAuthModalOpen(false)}></div>
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative z-10 border border-brand-sage/40">
                        <button 
                            onClick={() => setIsAuthModalOpen(false)}
                            className="absolute top-4 right-4 p-2 text-brand-gray hover:text-brand-text bg-brand-bg rounded-full transition-colors"
                        >
                            ✕
                        </button>
                        <div className="w-16 h-16 bg-[#E8F1EB] rounded-2xl flex items-center justify-center mb-6 text-brand-leaf shadow-sm mx-auto">
                            <Save size={32} />
                        </div>
                        <h3 className="font-serif text-2xl text-brand-text mb-3 text-center">
                            {tCommon('saveModalTitle')}
                        </h3>
                        <p className="text-brand-gray text-sm mb-8 text-center leading-relaxed">
                            {t('saveModalDesc')}
                        </p>
                        <div className="flex flex-col gap-3">
                            <Link 
                                href="/login" 
                                className="w-full bg-brand-leaf hover:bg-brand-forest text-white py-3.5 px-6 rounded-xl font-bold transition-all text-center shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                            >
                                {tCommon('loginToCabinet')}
                            </Link>
                            <button 
                                onClick={() => setIsAuthModalOpen(false)}
                                className="w-full bg-brand-bg hover:bg-[#E8F1EB] text-brand-text py-3.5 px-6 rounded-xl font-bold transition-colors text-center border border-brand-sage/30"
                            >
                                {tCommon('cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{__html: `
                @keyframes rise {
                    from { transform: scaleY(0); }
                    to { transform: scaleY(1); }
                }
            `}} />
        </div>
    );
}
