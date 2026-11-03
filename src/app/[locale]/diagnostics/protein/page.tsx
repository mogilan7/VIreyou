"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { trackEvent, getCookie } from '@/lib/analytics';
import { 
    ShieldCheck, User, Scale, Ruler, Utensils, 
    ArrowLeft, Save, Loader2, CheckCircle, AlertCircle, 
    Send, BookOpen, AlertTriangle, RotateCcw, Activity as ActivityIcon, Target, HeartPulse
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { saveTestResult, getUserBiometrics } from '@/actions/save-test';
import { createClient } from '@/utils/supabase/client';
import { 
    calcProteinShield, 
    ProteinInput, 
    ProteinResult, 
    Sex, 
    Activity, 
    Goal, 
    Kidney,
    SOURCES,
    PROTEIN_COEFFICIENTS
} from '@/lib/nutrition/proteinShield';

export default function ProteinCalculatorPage() {
    const t = useTranslations('ProteinShield');
    const tCommon = useTranslations('Common');
    const locale = useLocale();
    const isRu = locale === 'ru';

    // Auth & save state
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    // Form inputs
    const [gender, setGender] = useState<Sex>('female');
    const [age, setAge] = useState<number>(35);
    const [weight, setWeight] = useState<number>(65);
    const [height, setHeight] = useState<number>(170);
    const [activity, setActivity] = useState<Activity>('moderate');
    const [goal, setGoal] = useState<Goal>('maintain');
    const [kidneyDisease, setKidneyDisease] = useState<Kidney>('no');
    const [meals, setMeals] = useState<number>(3);

    // Calculation & UI state
    const [result, setResult] = useState<ProteinResult | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [hasCalculated, setHasCalculated] = useState(false);

    // Analytics tracking refs
    const hasStartedRef = useRef(false);
    const lastCalculatedParamsRef = useRef<string>('');

    // Load initial biometrics if user is logged in
    useEffect(() => {
        const checkAuthAndPrefill = async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            const authed = !!session;
            setIsAuthenticated(authed);

            if (authed) {
                try {
                    const bio = await getUserBiometrics();
                    if (bio) {
                        if (bio.gender === 'male' || bio.gender === 'female') setGender(bio.gender);
                        if (bio.age && bio.age >= PROTEIN_COEFFICIENTS.MIN_AGE && bio.age <= PROTEIN_COEFFICIENTS.MAX_AGE) {
                            setAge(bio.age);
                        }
                        if (bio.weight && bio.weight >= PROTEIN_COEFFICIENTS.MIN_WEIGHT && bio.weight <= PROTEIN_COEFFICIENTS.MAX_WEIGHT) {
                            setWeight(Math.round(bio.weight));
                        }
                        if (bio.height && bio.height >= PROTEIN_COEFFICIENTS.MIN_HEIGHT && bio.height <= PROTEIN_COEFFICIENTS.MAX_HEIGHT) {
                            setHeight(Math.round(bio.height));
                        }
                    }
                } catch (e) {
                    console.warn('[PROTEIN] Could not prefill biometrics:', e);
                }
            }
        };
        checkAuthAndPrefill();
    }, []);

    // Track test_start on first form change
    const onFormInteraction = () => {
        if (!hasStartedRef.current) {
            hasStartedRef.current = true;
            trackEvent('test_start', { testType: 'protein', slug: 'protein' });
        }
    };

    // Calculate action
    const handleCalculate = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        onFormInteraction();
        setValidationError(null);

        // Validation
        if (age < PROTEIN_COEFFICIENTS.MIN_AGE || age > PROTEIN_COEFFICIENTS.MAX_AGE || isNaN(age)) {
            setValidationError(t('errors.age'));
            return;
        }
        if (weight < PROTEIN_COEFFICIENTS.MIN_WEIGHT || weight > PROTEIN_COEFFICIENTS.MAX_WEIGHT || isNaN(weight)) {
            setValidationError(t('errors.weight'));
            return;
        }
        if (height < PROTEIN_COEFFICIENTS.MIN_HEIGHT || height > PROTEIN_COEFFICIENTS.MAX_HEIGHT || isNaN(height)) {
            setValidationError(t('errors.height'));
            return;
        }
        const parsedMeals = Math.round(Number(meals) || PROTEIN_COEFFICIENTS.DEFAULT_MEALS);
        if (parsedMeals < PROTEIN_COEFFICIENTS.MIN_MEALS || parsedMeals > PROTEIN_COEFFICIENTS.MAX_MEALS) {
            setValidationError(t('errors.meals'));
            return;
        }

        try {
            const input: ProteinInput = {
                sex: gender,
                age: Number(age),
                weightKg: Number(weight),
                heightCm: Number(height),
                activity,
                goal,
                kidneyDisease,
                mealsPerDay: parsedMeals,
            };

            const res = calcProteinShield(input);
            setResult(res);
            setHasCalculated(true);
            setSaveStatus('idle');

            // Send test_complete analytics event (without raw weight/height)
            const paramsKey = `${gender}_${age}_${activity}_${goal}_${kidneyDisease}_${parsedMeals}`;
            if (lastCalculatedParamsRef.current !== paramsKey) {
                lastCalculatedParamsRef.current = paramsKey;

                const ageGroup = age < 40 ? '<40' : (age <= 64 ? '40–64' : '65+');
                const utmCampaign = getCookie('vireyou_utm_campaign') || null;
                const utmContent = getCookie('vireyou_utm_content') || null;

                trackEvent('test_complete', {
                    testType: 'protein',
                    slug: 'protein',
                    status: res.status,
                    age_group: ageGroup,
                    goal,
                    activity,
                    utm_campaign: utmCampaign,
                    utm_content: utmContent,
                    score: res.gramsLow && res.gramsHigh ? Math.round((res.gramsLow + res.gramsHigh) / 2) : null,
                    interpretation: res.status === 'ok' ? `${res.gramsLow}–${res.gramsHigh} g/day` : 'see_doctor',
                    is_anonymous: !isAuthenticated
                });
            }

            // Scroll to results smoothly on mobile
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                setTimeout(() => {
                    document.getElementById('protein-results-section')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        } catch (err: any) {
            setValidationError(err.message || 'Ошибка расчёта');
        }
    };

    // Calculate automatically once on initial load (defaults)
    useEffect(() => {
        handleCalculate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Save test result handler
    const handleSave = async () => {
        if (!result || result.status !== 'ok') return;

        if (!isAuthenticated) {
            setIsAuthModalOpen(true);
            return;
        }

        setIsSaving(true);
        setSaveStatus('idle');

        try {
            const score = result.gramsLow && result.gramsHigh ? Math.round((result.gramsLow + result.gramsHigh) / 2) : 0;
            const res = await saveTestResult({
                testType: 'protein',
                score,
                interpretation: `${result.gramsLow}–${result.gramsHigh} ${t('gProteinPerDay')}`,
                rawData: {
                    gender,
                    age,
                    weight,
                    height,
                    activity,
                    goal,
                    kidneyDisease,
                    mealsPerDay: meals,
                    results: result
                }
            });

            if (res && res.success) {
                setSaveStatus('success');
            } else {
                setSaveStatus('error');
            }
        } catch (error) {
            console.error('Error saving protein test:', error);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    // Build Telegram bot link with UTM
    const botUrl = useMemo(() => {
        if (typeof window === 'undefined') return 'https://t.me/vireyou_bot?start=web_protein';
        const urlParams = new URLSearchParams(window.location.search);
        const rawCampaign = urlParams.get('utm_campaign') || getCookie('vireyou_utm_campaign') || '';
        const sanitized = rawCampaign.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48);
        const startParam = sanitized ? `web_protein_${sanitized}` : 'web_protein';
        return `https://t.me/vireyou_bot?start=${startParam}`;
    }, []);

    const handleBotClick = () => {
        trackEvent('bot_click', { testType: 'protein', slug: 'protein' });
    };

    // Russian pluralization for meals
    const getMealWord = (n: number) => {
        if (!isRu) return n === 1 ? t('mealWord_1') : t('mealWord_2_4');
        if (n === 1) return t('mealWord_1');
        if (n >= 2 && n <= 4) return t('mealWord_2_4');
        return t('mealWord_5_6');
    };

    return (
        <div className="min-h-screen bg-[#FAFAFA] p-4 md:p-8 font-sans text-brand-text">
            <div className="max-w-5xl mx-auto space-y-6 pt-12 md:pt-4">

                {/* Back to diagnostics */}
                <Link 
                    href="/diagnostics" 
                    className="inline-flex items-center gap-2 text-brand-gray hover:text-brand-leaf transition-colors text-sm font-bold mb-2 tracking-widest uppercase"
                >
                    <ArrowLeft size={16} /> {t('back')}
                </Link>

                {/* Header Banner */}
                <header className="bg-brand-forest text-white p-6 md:p-10 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex items-center space-x-5 md:space-x-6">
                    <div className="bg-white/10 p-3.5 md:p-4 rounded-2xl flex-shrink-0">
                        <ShieldCheck size={36} className="text-white" />
                    </div>
                    <div>
                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white mb-2">
                            {t('badge')}
                        </div>
                        <h1 className="text-2xl md:text-3xl font-serif font-bold leading-tight">
                            {t('title')}
                        </h1>
                        <p className="text-white/80 mt-1 text-sm md:text-base font-light">
                            {t('subtitle')}
                        </p>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* Form Section */}
                    <div className="lg:col-span-5 bg-white p-6 md:p-8 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-brand-sage/40">
                        <div className="flex items-center space-x-3 mb-6 text-brand-leaf">
                            <ActivityIcon size={22} />
                            <h2 className="text-xl font-bold font-serif text-brand-text">{t('paramsTitle')}</h2>
                        </div>

                        <form onSubmit={handleCalculate} className="space-y-5">

                            {/* Gender */}
                            <div>
                                <label className="block text-xs font-bold text-brand-gray uppercase tracking-widest mb-2.5">
                                    {t('gender')}
                                </label>
                                <div className="flex space-x-3">
                                    <label className={`flex-1 flex items-center justify-center py-3 px-4 border rounded-xl cursor-pointer transition-colors text-sm font-semibold ${gender === 'female' ? 'bg-[#E8F1EB] border-brand-leaf text-brand-forest' : 'border-brand-sage/50 hover:bg-[#FAFAFA] text-brand-text'}`}>
                                        <input 
                                            type="radio" 
                                            name="gender" 
                                            value="female" 
                                            checked={gender === 'female'} 
                                            onChange={() => { onFormInteraction(); setGender('female'); }} 
                                            className="hidden" 
                                        />
                                        {t('female')}
                                    </label>
                                    <label className={`flex-1 flex items-center justify-center py-3 px-4 border rounded-xl cursor-pointer transition-colors text-sm font-semibold ${gender === 'male' ? 'bg-[#E8F1EB] border-brand-leaf text-brand-forest' : 'border-brand-sage/50 hover:bg-[#FAFAFA] text-brand-text'}`}>
                                        <input 
                                            type="radio" 
                                            name="gender" 
                                            value="male" 
                                            checked={gender === 'male'} 
                                            onChange={() => { onFormInteraction(); setGender('male'); }} 
                                            className="hidden" 
                                        />
                                        {t('male')}
                                    </label>
                                </div>
                            </div>

                            {/* Age, Weight, Height Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="flex items-center text-xs font-bold text-brand-gray uppercase tracking-widest mb-1.5">
                                        <User size={12} className="mr-1" /> {t('age')}
                                    </label>
                                    <input 
                                        type="number" 
                                        min={PROTEIN_COEFFICIENTS.MIN_AGE} 
                                        max={PROTEIN_COEFFICIENTS.MAX_AGE} 
                                        value={age} 
                                        onChange={(e) => { onFormInteraction(); setAge(Number(e.target.value)); }} 
                                        className="w-full p-2.5 bg-[#FAFAFA] border border-brand-sage/50 rounded-xl focus:ring-1 focus:ring-brand-leaf outline-none transition-all text-sm font-semibold text-brand-text" 
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center text-xs font-bold text-brand-gray uppercase tracking-widest mb-1.5">
                                        <Scale size={12} className="mr-1" /> {t('weight')}
                                    </label>
                                    <input 
                                        type="number" 
                                        min={PROTEIN_COEFFICIENTS.MIN_WEIGHT} 
                                        max={PROTEIN_COEFFICIENTS.MAX_WEIGHT} 
                                        value={weight} 
                                        onChange={(e) => { onFormInteraction(); setWeight(Number(e.target.value)); }} 
                                        className="w-full p-2.5 bg-[#FAFAFA] border border-brand-sage/50 rounded-xl focus:ring-1 focus:ring-brand-leaf outline-none transition-all text-sm font-semibold text-brand-text" 
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center text-xs font-bold text-brand-gray uppercase tracking-widest mb-1.5">
                                        <Ruler size={12} className="mr-1" /> {t('height')}
                                    </label>
                                    <input 
                                        type="number" 
                                        min={PROTEIN_COEFFICIENTS.MIN_HEIGHT} 
                                        max={PROTEIN_COEFFICIENTS.MAX_HEIGHT} 
                                        value={height} 
                                        onChange={(e) => { onFormInteraction(); setHeight(Number(e.target.value)); }} 
                                        className="w-full p-2.5 bg-[#FAFAFA] border border-brand-sage/50 rounded-xl focus:ring-1 focus:ring-brand-leaf outline-none transition-all text-sm font-semibold text-brand-text" 
                                    />
                                </div>
                            </div>

                            {/* Activity */}
                            <div>
                                <label className="block text-xs font-bold text-brand-gray uppercase tracking-widest mb-1.5">
                                    {t('activity')}
                                </label>
                                <select 
                                    value={activity} 
                                    onChange={(e) => { onFormInteraction(); setActivity(e.target.value as Activity); }}
                                    className="w-full p-3 bg-[#FAFAFA] border border-brand-sage/50 rounded-xl focus:ring-1 focus:ring-brand-leaf outline-none transition-all text-sm font-semibold text-brand-text cursor-pointer"
                                >
                                    <option value="low">{t('activity_low')}</option>
                                    <option value="moderate">{t('activity_moderate')}</option>
                                    <option value="strength">{t('activity_strength')}</option>
                                    <option value="heavy">{t('activity_heavy')}</option>
                                </select>
                            </div>

                            {/* Goal */}
                            <div>
                                <label className="flex items-center text-xs font-bold text-brand-gray uppercase tracking-widest mb-2">
                                    <Target size={12} className="mr-1" /> {t('goal')}
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {(['maintain', 'lose', 'gain_muscle'] as Goal[]).map((g) => (
                                        <label 
                                            key={g}
                                            className={`flex flex-col items-center justify-center p-2.5 border rounded-xl cursor-pointer transition-colors text-center text-xs font-semibold leading-tight ${goal === g ? 'bg-[#E8F1EB] border-brand-leaf text-brand-forest' : 'border-brand-sage/50 hover:bg-[#FAFAFA] text-brand-text'}`}
                                        >
                                            <input 
                                                type="radio" 
                                                name="goal" 
                                                value={g} 
                                                checked={goal === g} 
                                                onChange={() => { onFormInteraction(); setGoal(g); }} 
                                                className="hidden" 
                                            />
                                            {t(`goal_${g}`)}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Kidney Disease */}
                            <div>
                                <label className="block text-xs font-bold text-brand-gray uppercase tracking-widest mb-2">
                                    {t('kidney')}
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['no', 'yes', 'unknown'] as Kidney[]).map((k) => (
                                        <label 
                                            key={k}
                                            className={`flex items-center justify-center p-2.5 border rounded-xl cursor-pointer transition-colors text-center text-xs font-semibold ${kidneyDisease === k ? 'bg-[#E8F1EB] border-brand-leaf text-brand-forest' : 'border-brand-sage/50 hover:bg-[#FAFAFA] text-brand-text'}`}
                                        >
                                            <input 
                                                type="radio" 
                                                name="kidneyDisease" 
                                                value={k} 
                                                checked={kidneyDisease === k} 
                                                onChange={() => { onFormInteraction(); setKidneyDisease(k); }} 
                                                className="hidden" 
                                            />
                                            {t(`kidney_${k}`)}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Meals per day (optional) */}
                            <div>
                                <label className="flex items-center justify-between text-xs font-bold text-brand-gray uppercase tracking-widest mb-1.5">
                                    <span className="flex items-center">
                                        <Utensils size={12} className="mr-1" /> {t('meals')}
                                    </span>
                                </label>
                                <input 
                                    type="number" 
                                    min={PROTEIN_COEFFICIENTS.MIN_MEALS} 
                                    max={PROTEIN_COEFFICIENTS.MAX_MEALS} 
                                    value={meals} 
                                    onChange={(e) => { onFormInteraction(); setMeals(Number(e.target.value)); }} 
                                    placeholder="3"
                                    className="w-full p-2.5 bg-[#FAFAFA] border border-brand-sage/50 rounded-xl focus:ring-1 focus:ring-brand-leaf outline-none transition-all text-sm font-semibold text-brand-text" 
                                />
                                <div className="text-[11px] text-brand-gray/70 mt-1">{t('mealsHint')}</div>
                            </div>

                            {validationError && (
                                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                                    <AlertCircle size={16} className="flex-shrink-0" />
                                    <span>{validationError}</span>
                                </div>
                            )}

                            <button 
                                type="submit" 
                                id="btn-calculate-protein"
                                className="w-full bg-brand-forest hover:bg-brand-leaf text-white py-3.5 px-6 rounded-xl font-bold transition-all text-center shadow-md hover:shadow-lg flex items-center justify-center gap-2 mt-4 cursor-pointer"
                            >
                                <ShieldCheck size={18} />
                                {hasCalculated ? t('recalculateBtn') : t('calculateBtn')}
                            </button>
                        </form>
                    </div>

                    {/* Results Section */}
                    <div id="protein-results-section" className="lg:col-span-7 space-y-6">

                        {result && result.status === 'ok' && (
                            <div className="bg-white p-6 md:p-10 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-brand-sage/40 relative overflow-hidden flex flex-col space-y-6">
                                <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-brand-leaf pointer-events-none">
                                    <ShieldCheck size={200} />
                                </div>

                                {/* Main Highlight */}
                                <div className="relative z-10 border-b border-brand-sage/40 pb-6">
                                    <div className="text-xs uppercase font-bold tracking-widest text-brand-gray mb-2">
                                        {t('resultTitle')}
                                    </div>
                                    <div className="text-4xl md:text-5xl font-serif font-bold text-brand-forest tracking-tight">
                                        {result.gramsLow}–{result.gramsHigh} <span className="text-xl md:text-2xl font-sans font-medium text-brand-gray">{t('gProteinPerDay')}</span>
                                    </div>
                                    <div className="text-sm md:text-base text-brand-leaf font-semibold mt-2">
                                        {result.gPerKgLow}–{result.gPerKgHigh} {t('gPerKg')}
                                        {result.usedAdjustedWeight && (
                                            <span className="text-brand-gray font-normal text-xs ml-2">
                                                (скорр. вес {result.referenceWeightKg} кг)
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Per meal block */}
                                <div className="bg-[#E8F1EB] p-4 md:p-5 rounded-2xl border border-brand-leaf/30 flex items-center gap-4">
                                    <div className="w-10 h-10 bg-brand-leaf/20 rounded-xl flex items-center justify-center text-brand-forest flex-shrink-0">
                                        <Utensils size={20} />
                                    </div>
                                    <div className="text-sm md:text-base text-brand-forest font-semibold">
                                        {isRu ? (
                                            <>
                                                На {meals} {getMealWord(meals)} — примерно{' '}
                                                <span className="font-bold">{result.perMealLow}–{result.perMealHigh} г</span> за раз
                                            </>
                                        ) : (
                                            <>
                                                For {meals} {getMealWord(meals)} — about{' '}
                                                <span className="font-bold">{result.perMealLow}–{result.perMealHigh} g</span> per meal
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Notes */}
                                <div className="space-y-2.5">
                                    {result.notes.slice(2).map((note, idx) => (
                                        <div key={idx} className="flex items-start gap-2.5 text-xs md:text-sm text-brand-text/80 leading-relaxed">
                                            <span className="text-brand-leaf font-bold leading-none mt-1">•</span>
                                            <span>{note}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Sources block */}
                                {result.sources && result.sources.length > 0 && (
                                    <div className="bg-[#FAFAFA] p-5 rounded-2xl border border-brand-sage/40 space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-gray">
                                            <BookOpen size={14} className="text-brand-leaf" />
                                            {t('sourcesTitle')}
                                        </div>
                                        <ul className="space-y-2 text-xs text-brand-gray/80 leading-relaxed list-none pl-0">
                                            {result.sources.map((srcKey) => (
                                                <li key={srcKey} className="flex items-start gap-2">
                                                    <span className="text-brand-leaf font-bold">•</span>
                                                    <span>{SOURCES[srcKey] || srcKey}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Disclaimer banner */}
                                <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl text-amber-900 text-xs flex items-start gap-3 leading-relaxed">
                                    <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                    <span>{t('disclaimer')}</span>
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-3 pt-2">
                                    {/* Bot CTA Button */}
                                    <a 
                                        href={botUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={handleBotClick}
                                        id="btn-open-protein-bot"
                                        className="w-full bg-[#2AABEE] hover:bg-[#229ED9] text-white py-4 px-6 rounded-2xl font-bold transition-all text-center shadow-md hover:shadow-lg flex items-center justify-center gap-3 text-base cursor-pointer"
                                    >
                                        <Send size={18} />
                                        <span>{t('botButton')}</span>
                                    </a>

                                    {/* Save to Medical Archive Button */}
                                    <button 
                                        onClick={handleSave}
                                        disabled={isSaving || saveStatus === 'success'}
                                        id="btn-save-protein-result"
                                        className={`w-full py-3.5 px-6 rounded-2xl font-bold transition-all text-center border flex items-center justify-center gap-2 text-sm cursor-pointer ${
                                            saveStatus === 'success' 
                                                ? 'bg-green-50 border-green-300 text-green-700' 
                                                : saveStatus === 'error'
                                                ? 'bg-red-50 border-red-300 text-red-700'
                                                : 'bg-white hover:bg-[#E8F1EB] border-brand-leaf/40 text-brand-forest shadow-sm hover:shadow'
                                        }`}
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin text-brand-leaf" />
                                                <span>{t('saving')}</span>
                                            </>
                                        ) : saveStatus === 'success' ? (
                                            <>
                                                <CheckCircle size={16} className="text-green-600" />
                                                <span>{t('saved')}</span>
                                            </>
                                        ) : saveStatus === 'error' ? (
                                            <>
                                                <AlertCircle size={16} className="text-red-600" />
                                                <span>{t('saveError')}</span>
                                            </>
                                        ) : (
                                            <>
                                                <Save size={16} className="text-brand-leaf" />
                                                <span>{t('saveBtn')}</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                            </div>
                        )}

                        {/* Status see_doctor */}
                        {result && result.status === 'see_doctor' && (
                            <div className="bg-white p-6 md:p-10 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-amber-200 space-y-6">
                                <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-700 mb-2">
                                    <AlertTriangle size={28} />
                                </div>
                                <h3 className="text-2xl font-serif font-bold text-brand-forest">
                                    {t('seeDoctorTitle')}
                                </h3>
                                
                                <div className="space-y-3 text-sm text-brand-text/90 leading-relaxed">
                                    {result.notes.map((note, idx) => (
                                        <p key={idx}>{note}</p>
                                    ))}
                                </div>

                                <div className="bg-[#FAFAFA] p-5 rounded-2xl border border-brand-sage/40 space-y-2">
                                    <div className="text-xs font-bold uppercase tracking-widest text-brand-gray flex items-center gap-2">
                                        <BookOpen size={14} className="text-brand-leaf" />
                                        {t('sourcesTitle')}
                                    </div>
                                    <p className="text-xs text-brand-gray/80 leading-relaxed">
                                        {SOURCES.protage}
                                    </p>
                                </div>

                                <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl text-amber-900 text-xs flex items-start gap-3 leading-relaxed">
                                    <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                    <span>{t('disclaimer')}</span>
                                </div>

                                <div className="pt-2">
                                    <Link 
                                        href="/diagnostics"
                                        className="inline-flex items-center justify-center gap-2 w-full bg-brand-forest hover:bg-brand-leaf text-white py-3.5 px-6 rounded-2xl font-bold transition-all text-center shadow-md hover:shadow-lg text-sm"
                                    >
                                        <ArrowLeft size={16} />
                                        <span>{t('backBtn')}</span>
                                    </Link>
                                </div>
                            </div>
                        )}

                    </div>

                </div>

            </div>

            {/* Auth Modal for saving results when anonymous */}
            {isAuthModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm" 
                        onClick={() => setIsAuthModalOpen(false)}
                    ></div>
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative z-10 border border-brand-sage/40">
                        <button 
                            onClick={() => setIsAuthModalOpen(false)}
                            className="absolute top-4 right-4 p-2 text-brand-gray hover:text-brand-text bg-brand-bg rounded-full transition-colors cursor-pointer"
                        >
                            ✕
                        </button>
                        <div className="w-16 h-16 bg-[#E8F1EB] rounded-2xl flex items-center justify-center mb-6 text-brand-leaf shadow-sm mx-auto">
                            <Save size={32} />
                        </div>
                        <h3 className="font-serif text-2xl text-brand-text mb-3 text-center">
                            {t('authModalTitle')}
                        </h3>
                        <p className="text-brand-gray text-sm mb-8 text-center leading-relaxed">
                            {t('authModalDesc')}
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
                                className="w-full bg-brand-bg hover:bg-[#E8F1EB] text-brand-text py-3.5 px-6 rounded-xl font-bold transition-colors text-center border border-brand-sage/30 cursor-pointer"
                            >
                                {tCommon('cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
