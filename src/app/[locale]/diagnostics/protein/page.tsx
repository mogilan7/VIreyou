"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { trackEvent, getCookie } from '@/lib/analytics';
import { 
    ShieldCheck, User, Scale, Ruler, Utensils, 
    ArrowLeft, Save, Loader2, CheckCircle, AlertCircle, 
    Send, BookOpen, AlertTriangle, RotateCcw, Activity as ActivityIcon, Target, ChevronDown
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
    SOURCES_DETAIL,
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

    // Form inputs (stored as strings to allow empty states and natural typing)
    const [gender, setGender] = useState<Sex>('female');
    const [ageStr, setAgeStr] = useState<string>('35');
    const [weightStr, setWeightStr] = useState<string>('65');
    const [heightStr, setHeightStr] = useState<string>('170');
    const [activity, setActivity] = useState<Activity>('moderate');
    const [goal, setGoal] = useState<Goal>('maintain');
    const [kidneyDisease, setKidneyDisease] = useState<Kidney>('no');
    const [mealsStr, setMealsStr] = useState<string>('3');

    // Field-level error messages
    const [fieldErrors, setFieldErrors] = useState<{
        age?: string;
        weight?: string;
        height?: string;
        meals?: string;
    }>({});

    // Calculation & UI state
    const [result, setResult] = useState<ProteinResult | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [hasCalculated, setHasCalculated] = useState(false);
    const [lastCalculatedSnapshot, setLastCalculatedSnapshot] = useState<string>('');

    // Analytics tracking refs
    const hasStartedRef = useRef(false);
    const hasCompletedRef = useRef(false);

    // Track if form changed since last calculation
    const currentSnapshot = useMemo(() => {
        return JSON.stringify({ gender, ageStr, weightStr, heightStr, activity, goal, kidneyDisease, mealsStr });
    }, [gender, ageStr, weightStr, heightStr, activity, goal, kidneyDisease, mealsStr]);

    const isDirty = useMemo(() => {
        if (!hasCalculated) return true;
        return currentSnapshot !== lastCalculatedSnapshot;
    }, [hasCalculated, currentSnapshot, lastCalculatedSnapshot]);

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
                            setAgeStr(String(bio.age));
                        }
                        if (bio.weight && bio.weight >= PROTEIN_COEFFICIENTS.MIN_WEIGHT && bio.weight <= PROTEIN_COEFFICIENTS.MAX_WEIGHT) {
                            setWeightStr(String(Math.round(bio.weight)));
                        }
                        if (bio.height && bio.height >= PROTEIN_COEFFICIENTS.MIN_HEIGHT && bio.height <= PROTEIN_COEFFICIENTS.MAX_HEIGHT) {
                            setHeightStr(String(Math.round(bio.height)));
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

        const newFieldErrors: { age?: string; weight?: string; height?: string; meals?: string } = {};

        // Parse and validate age
        const parsedAge = ageStr.trim() === '' ? NaN : Number(ageStr);
        if (isNaN(parsedAge) || parsedAge < PROTEIN_COEFFICIENTS.MIN_AGE || parsedAge > PROTEIN_COEFFICIENTS.MAX_AGE) {
            newFieldErrors.age = t('errors.age');
        }

        // Parse and validate weight (accepts comma and dot)
        const normalizedWeightStr = weightStr.trim().replace(',', '.');
        const parsedWeight = normalizedWeightStr === '' ? NaN : Number(normalizedWeightStr);
        if (isNaN(parsedWeight) || parsedWeight < PROTEIN_COEFFICIENTS.MIN_WEIGHT || parsedWeight > PROTEIN_COEFFICIENTS.MAX_WEIGHT) {
            newFieldErrors.weight = t('errors.weight');
        }

        // Parse and validate height
        const parsedHeight = heightStr.trim() === '' ? NaN : Number(heightStr);
        if (isNaN(parsedHeight) || parsedHeight < PROTEIN_COEFFICIENTS.MIN_HEIGHT || parsedHeight > PROTEIN_COEFFICIENTS.MAX_HEIGHT) {
            newFieldErrors.height = t('errors.height');
        }

        // Parse and validate meals
        const parsedMeals = mealsStr.trim() === '' ? PROTEIN_COEFFICIENTS.DEFAULT_MEALS : Number(mealsStr);
        if (isNaN(parsedMeals) || parsedMeals < PROTEIN_COEFFICIENTS.MIN_MEALS || parsedMeals > PROTEIN_COEFFICIENTS.MAX_MEALS || !Number.isInteger(parsedMeals)) {
            newFieldErrors.meals = t('errors.meals');
        }

        setFieldErrors(newFieldErrors);

        if (Object.keys(newFieldErrors).length > 0) {
            return;
        }

        try {
            const input: ProteinInput = {
                sex: gender,
                age: parsedAge,
                weightKg: parsedWeight,
                heightCm: parsedHeight,
                activity,
                goal,
                kidneyDisease,
                mealsPerDay: parsedMeals,
            };

            const res = calcProteinShield(input);
            setResult(res);
            setHasCalculated(true);
            setLastCalculatedSnapshot(currentSnapshot);
            setSaveStatus('idle');

            // Send test_complete on first calculation in visit, test_recalculate on subsequent
            const sessionCompletedKey = 'vireyou_protein_completed';
            const alreadyCompletedInSession = typeof window !== 'undefined' && sessionStorage.getItem(sessionCompletedKey) === '1';
            const isFirstCalc = !hasCompletedRef.current && !alreadyCompletedInSession;

            if (isFirstCalc) {
                hasCompletedRef.current = true;
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem(sessionCompletedKey, '1');
                }
            }

            const eventType = isFirstCalc ? 'test_complete' : 'test_recalculate';

            // Send analytics event (without raw weight/height)
            const ageGroup = parsedAge < 40 ? '<40' : (parsedAge <= 64 ? '40–64' : '65+');
            const utmCampaign = getCookie('vireyou_utm_campaign') || null;
            const utmContent = getCookie('vireyou_utm_content') || null;

            trackEvent(eventType, {
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

            // Scroll to results on mobile
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                setTimeout(() => {
                    document.getElementById('protein-results-section')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        } catch (err: any) {
            setValidationError(err.message || 'Ошибка расчёта');
        }
    };

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

    // Format numbers with comma for Russian locale
    const formatNumberLocale = (val?: number) => {
        if (val === undefined || isNaN(val)) return '0';
        const str = val.toFixed(1);
        return isRu ? str.replace('.', ',') : str;
    };

    // Russian pluralization for meals
    const formatMealsText = (mealsCount: number, low?: number, high?: number) => {
        const l = low || 0;
        const h = high || 0;
        if (!isRu) {
            const mealWord = mealsCount === 1 ? 'meal' : 'meals';
            return `For ${mealsCount} ${mealWord} — about ${l}–${h} g per meal`;
        }
        let mealWord = 'приёмов пищи';
        if (mealsCount === 1) mealWord = 'приём пищи';
        else if (mealsCount >= 2 && mealsCount <= 4) mealWord = 'приёма пищи';
        return `На ${mealsCount} ${mealWord} — примерно ${l}–${h} г за раз`;
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
                                <label className="block text-xs font-bold text-brand-gray uppercase tracking-widest mb-2">
                                    {t('gender')}
                                </label>
                                <div className="flex space-x-3">
                                    <label className={`flex-1 flex items-center justify-center py-2.5 px-4 border rounded-xl cursor-pointer transition-colors text-sm font-semibold h-11 ${gender === 'female' ? 'bg-[#E8F1EB] border-brand-leaf text-brand-forest' : 'border-brand-sage/50 hover:bg-[#FAFAFA] text-brand-text'}`}>
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
                                    <label className={`flex-1 flex items-center justify-center py-2.5 px-4 border rounded-xl cursor-pointer transition-colors text-sm font-semibold h-11 ${gender === 'male' ? 'bg-[#E8F1EB] border-brand-leaf text-brand-forest' : 'border-brand-sage/50 hover:bg-[#FAFAFA] text-brand-text'}`}>
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

                            {/* Age, Weight, Height Grid with single-line labels and field-level errors */}
                            <div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-brand-gray uppercase tracking-widest whitespace-nowrap mb-1.5 truncate">
                                            {t('ageLabel')}
                                        </label>
                                        <input 
                                            type="text" 
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={ageStr} 
                                            onChange={(e) => {
                                                onFormInteraction();
                                                const val = e.target.value.replace(/[^0-9]/g, '');
                                                setAgeStr(val);
                                                if (fieldErrors.age) setFieldErrors(prev => ({ ...prev, age: undefined }));
                                            }} 
                                            className={`w-full h-11 px-3 bg-[#FAFAFA] border rounded-xl focus:ring-1 outline-none transition-all text-sm font-semibold text-brand-text ${
                                                fieldErrors.age ? 'border-red-400 focus:ring-red-400' : 'border-brand-sage/50 focus:ring-brand-leaf'
                                            }`} 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-brand-gray uppercase tracking-widest whitespace-nowrap mb-1.5 truncate">
                                            {t('weightLabel')}
                                        </label>
                                        <input 
                                            type="text" 
                                            inputMode="decimal"
                                            value={weightStr} 
                                            onChange={(e) => {
                                                onFormInteraction();
                                                // Allow digits, dot, comma
                                                const val = e.target.value.replace(/[^0-9.,]/g, '');
                                                setWeightStr(val);
                                                if (fieldErrors.weight) setFieldErrors(prev => ({ ...prev, weight: undefined }));
                                            }} 
                                            className={`w-full h-11 px-3 bg-[#FAFAFA] border rounded-xl focus:ring-1 outline-none transition-all text-sm font-semibold text-brand-text ${
                                                fieldErrors.weight ? 'border-red-400 focus:ring-red-400' : 'border-brand-sage/50 focus:ring-brand-leaf'
                                            }`} 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-brand-gray uppercase tracking-widest whitespace-nowrap mb-1.5 truncate">
                                            {t('heightLabel')}
                                        </label>
                                        <input 
                                            type="text" 
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={heightStr} 
                                            onChange={(e) => {
                                                onFormInteraction();
                                                const val = e.target.value.replace(/[^0-9]/g, '');
                                                setHeightStr(val);
                                                if (fieldErrors.height) setFieldErrors(prev => ({ ...prev, height: undefined }));
                                            }} 
                                            className={`w-full h-11 px-3 bg-[#FAFAFA] border rounded-xl focus:ring-1 outline-none transition-all text-sm font-semibold text-brand-text ${
                                                fieldErrors.height ? 'border-red-400 focus:ring-red-400' : 'border-brand-sage/50 focus:ring-brand-leaf'
                                            }`} 
                                        />
                                    </div>
                                </div>
                                {(fieldErrors.age || fieldErrors.weight || fieldErrors.height) && (
                                    <div className="mt-2 space-y-1">
                                        {fieldErrors.age && <p className="text-[11px] text-red-600 font-medium leading-tight">• {fieldErrors.age}</p>}
                                        {fieldErrors.weight && <p className="text-[11px] text-red-600 font-medium leading-tight">• {fieldErrors.weight}</p>}
                                        {fieldErrors.height && <p className="text-[11px] text-red-600 font-medium leading-tight">• {fieldErrors.height}</p>}
                                    </div>
                                )}
                            </div>

                            {/* Activity Cards (2x2 grid on mobile and desktop) */}
                            <div>
                                <label className="block text-xs font-bold text-brand-gray uppercase tracking-widest mb-2">
                                    {t('activity')}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { key: 'low', titleKey: 'act_low_title', descKey: 'act_low_desc' },
                                        { key: 'moderate', titleKey: 'act_mod_title', descKey: 'act_mod_desc' },
                                        { key: 'strength', titleKey: 'act_str_title', descKey: 'act_str_desc' },
                                        { key: 'heavy', titleKey: 'act_hvy_title', descKey: 'act_hvy_desc' }
                                    ].map(({ key, titleKey, descKey }) => (
                                        <label 
                                            key={key}
                                            className={`flex flex-col justify-center p-2.5 border rounded-xl cursor-pointer transition-colors min-h-[3.25rem] ${activity === key ? 'bg-[#E8F1EB] border-brand-leaf text-brand-forest' : 'border-brand-sage/50 hover:bg-[#FAFAFA] text-brand-text'}`}
                                        >
                                            <input 
                                                type="radio" 
                                                name="activity" 
                                                value={key} 
                                                checked={activity === key} 
                                                onChange={() => { onFormInteraction(); setActivity(key as Activity); }} 
                                                className="hidden" 
                                            />
                                            <div className="font-semibold text-xs leading-tight">{t(titleKey)}</div>
                                            <div className="text-[10px] text-brand-gray/80 mt-0.5 leading-tight">{t(descKey)}</div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Goal (3 equal height buttons) */}
                            <div>
                                <label className="block text-xs font-bold text-brand-gray uppercase tracking-widest mb-2">
                                    {t('goal')}
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['maintain', 'lose', 'gain_muscle'] as Goal[]).map((g) => (
                                        <label 
                                            key={g}
                                            className={`flex flex-col items-center justify-center p-2 border rounded-xl cursor-pointer transition-colors text-center text-xs font-semibold h-14 ${goal === g ? 'bg-[#E8F1EB] border-brand-leaf text-brand-forest' : 'border-brand-sage/50 hover:bg-[#FAFAFA] text-brand-text'}`}
                                        >
                                            <input 
                                                type="radio" 
                                                name="goal" 
                                                value={g} 
                                                checked={goal === g} 
                                                onChange={() => { onFormInteraction(); setGoal(g); }} 
                                                className="hidden" 
                                            />
                                            <span className="leading-tight">{t(`goal_${g}`)}</span>
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
                                            className={`flex items-center justify-center p-2.5 border rounded-xl cursor-pointer transition-colors text-center text-xs font-semibold h-11 ${kidneyDisease === k ? 'bg-[#E8F1EB] border-brand-leaf text-brand-forest' : 'border-brand-sage/50 hover:bg-[#FAFAFA] text-brand-text'}`}
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
                                <label className="block text-xs font-bold text-brand-gray uppercase tracking-widest mb-1.5">
                                    {t('meals')}
                                </label>
                                <input 
                                    type="text" 
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={mealsStr} 
                                    onChange={(e) => {
                                        onFormInteraction();
                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                        setMealsStr(val);
                                        if (fieldErrors.meals) setFieldErrors(prev => ({ ...prev, meals: undefined }));
                                    }} 
                                    placeholder="3"
                                    className={`w-full h-11 px-3 bg-[#FAFAFA] border rounded-xl focus:ring-1 outline-none transition-all text-sm font-semibold text-brand-text ${
                                        fieldErrors.meals ? 'border-red-400 focus:ring-red-400' : 'border-brand-sage/50 focus:ring-brand-leaf'
                                    }`} 
                                />
                                {fieldErrors.meals ? (
                                    <p className="text-[11px] text-red-600 font-medium leading-tight mt-1">{fieldErrors.meals}</p>
                                ) : (
                                    <div className="text-[11px] text-brand-gray/70 mt-1">{t('mealsHint')}</div>
                                )}
                            </div>

                            {validationError && (
                                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                                    <AlertCircle size={16} className="flex-shrink-0" />
                                    <span>{validationError}</span>
                                </div>
                            )}

                            {/* Calculate / Recalculate button */}
                            <button 
                                type="submit" 
                                id="btn-calculate-protein"
                                disabled={hasCalculated && !isDirty}
                                className={`w-full py-3.5 px-6 rounded-xl font-bold transition-all text-center flex items-center justify-center gap-2 mt-4 ${
                                    hasCalculated && !isDirty
                                        ? 'bg-brand-sage/40 text-brand-gray cursor-not-allowed border border-brand-sage/60'
                                        : 'bg-brand-forest hover:bg-brand-leaf text-white shadow-md hover:shadow-lg cursor-pointer'
                                }`}
                            >
                                <ShieldCheck size={18} />
                                <span>{hasCalculated ? t('recalculateBtn') : t('calculateBtn')}</span>
                            </button>
                        </form>
                    </div>

                    {/* Results Section */}
                    <div id="protein-results-section" className="lg:col-span-7 space-y-6">

                        {/* Placeholder before calculation */}
                        {!hasCalculated && (
                            <div className="bg-white p-8 md:p-12 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-brand-sage/40 min-h-[520px] flex flex-col items-center justify-center text-center space-y-4">
                                <div className="w-16 h-16 bg-[#E8F1EB] rounded-2xl flex items-center justify-center text-brand-leaf shadow-sm">
                                    <ShieldCheck size={32} />
                                </div>
                                <h3 className="text-xl md:text-2xl font-serif font-bold text-brand-forest max-w-md">
                                    {t('placeholderTitle')}
                                </h3>
                                <p className="text-sm text-brand-gray max-w-md leading-relaxed">
                                    {t('placeholderDesc')}
                                </p>
                            </div>
                        )}

                        {/* Result OK */}
                        {hasCalculated && result && result.status === 'ok' && (
                            <div className="bg-white p-6 md:p-10 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-brand-sage/40 relative overflow-hidden flex flex-col space-y-6">
                                <div className="absolute -top-10 -right-10 p-4 opacity-[0.025] text-brand-leaf pointer-events-none select-none">
                                    <ShieldCheck size={260} />
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
                                        {isRu ? (
                                            `${formatNumberLocale(result.gPerKgLow)}–${formatNumberLocale(result.gPerKgHigh)} г на каждый килограмм веса`
                                        ) : (
                                            `${result.gPerKgLow}–${result.gPerKgHigh} g per kg of body weight`
                                        )}
                                    </div>

                                    {/* Fired rule reason string */}
                                    {result.ruleReasonKey && (
                                        <div className="mt-3.5 p-3 bg-brand-sage/20 border border-brand-sage/50 rounded-xl text-xs md:text-sm text-brand-forest/90 leading-relaxed">
                                            {t(`ruleReasons.${result.ruleReasonKey}`)}
                                            {result.usedAdjustedWeight && (
                                                <div className="mt-1 text-xs text-brand-gray font-medium">
                                                    {isRu 
                                                        ? `• ${t('bmiAdjustedBadge', { weight: result.referenceWeightKg ?? 0 })}`
                                                        : `• ${t('bmiAdjustedBadge', { weight: result.referenceWeightKg ?? 0 })}`}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Per meal block with clean pluralization */}
                                <div className="bg-[#E8F1EB] p-4 md:p-5 rounded-2xl border border-brand-leaf/30 flex items-center gap-4">
                                    <div className="w-10 h-10 bg-brand-leaf/20 rounded-xl flex items-center justify-center text-brand-forest flex-shrink-0">
                                        <Utensils size={20} />
                                    </div>
                                    <div className="text-sm md:text-base text-brand-forest font-semibold">
                                        {formatMealsText(result.mealsPerDay || 3, result.perMealLow, result.perMealHigh)}
                                    </div>
                                </div>

                                {/* Additional contextual notes (if any) */}
                                {result.notes && result.notes.length > 0 && (
                                    <div className="space-y-2">
                                        {result.notes.map((note, idx) => (
                                            <div key={idx} className="flex items-start gap-2.5 text-xs md:text-sm text-brand-text/80 leading-relaxed">
                                                <span className="text-brand-leaf font-bold leading-none mt-1">•</span>
                                                <span>{note}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Sources block with expandable citations */}
                                {result.sources && result.sources.length > 0 && (
                                    <div className="bg-[#FAFAFA] p-5 rounded-2xl border border-brand-sage/40 space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-gray">
                                            <BookOpen size={14} className="text-brand-leaf" />
                                            {t('sourcesTitle')}
                                        </div>
                                        <div className="space-y-2">
                                            {result.sources.map((srcKey) => {
                                                const meta = SOURCES_DETAIL[srcKey];
                                                if (!meta) return null;
                                                return (
                                                    <details key={srcKey} className="group bg-white rounded-xl border border-brand-sage/30 p-2.5 transition-colors">
                                                        <summary className="flex items-center justify-between text-xs font-semibold text-brand-text cursor-pointer list-none select-none">
                                                            <span className="flex items-center gap-2">
                                                                <span className="text-brand-leaf font-bold">•</span>
                                                                <span>{meta.shortTitle}</span>
                                                            </span>
                                                            <ChevronDown size={14} className="text-brand-gray group-open:rotate-180 transition-transform duration-200" />
                                                        </summary>
                                                        <div className="mt-2 pt-2 border-t border-brand-sage/20 text-[11px] text-brand-gray/90 leading-relaxed pl-3.5">
                                                            {meta.fullCitation}
                                                        </div>
                                                    </details>
                                                );
                                            })}
                                        </div>
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
                        {hasCalculated && result && result.status === 'see_doctor' && (
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

                                <div className="bg-[#FAFAFA] p-5 rounded-2xl border border-brand-sage/40 space-y-3">
                                    <div className="text-xs font-bold uppercase tracking-widest text-brand-gray flex items-center gap-2">
                                        <BookOpen size={14} className="text-brand-leaf" />
                                        {t('sourcesTitle')}
                                    </div>
                                    <div className="space-y-2">
                                        {(result.sources && result.sources.length > 0 ? result.sources : ['protage']).map((srcKey) => {
                                            const meta = SOURCES_DETAIL[srcKey];
                                            if (!meta) return null;
                                            return (
                                                <details key={srcKey} className="group bg-white rounded-xl border border-brand-sage/30 p-2.5 transition-colors">
                                                    <summary className="flex items-center justify-between text-xs font-semibold text-brand-text cursor-pointer list-none select-none">
                                                        <span className="flex items-center gap-2">
                                                            <span className="text-brand-leaf font-bold">•</span>
                                                            <span>{meta.shortTitle}</span>
                                                        </span>
                                                        <ChevronDown size={14} className="text-brand-gray group-open:rotate-180 transition-transform duration-200" />
                                                    </summary>
                                                    <div className="mt-2 pt-2 border-t border-brand-sage/20 text-[11px] text-brand-gray/90 leading-relaxed pl-3.5">
                                                        {meta.fullCitation}
                                                    </div>
                                                </details>
                                            );
                                        })}
                                    </div>
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
