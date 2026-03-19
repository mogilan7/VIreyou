"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { Activity, User, Ruler, Weight, HeartPulse, Scale, AlertCircle, ArrowLeft, Save, Loader2, CheckCircle } from 'lucide-react';
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { saveTestResult } from '@/actions/save-test';
import { createClient } from '@/utils/supabase/client';

export default function BioAgeCalculatorPage() {
    const t = useTranslations('BioAgeCalculator');
    const tCommon = useTranslations('Common');

    // Состояния для хранения введенных данных
    const [gender, setGender] = useState('female');
    const [age, setAge] = useState(30);
    const [height, setHeight] = useState(165);
    const [weight, setWeight] = useState(65);
    const [waist, setWaist] = useState(70);
    const [hips, setHips] = useState(95);

    // Auth & Save State
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [saveErrorString, setSaveErrorString] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setIsAuthenticated(!!session);
        };
        checkAuth();
    }, []);

    // Вычисления
    const stats = useMemo(() => {
        // 1. Индекс массы тела (ИМТ)
        const heightInMeters = height / 100;
        const bmi = weight / (heightInMeters * heightInMeters);

        // 2. Соотношение талии и бедер (WHR - Waist-to-Hip Ratio)
        const whr = waist / hips;

        // Вычисляем "штрафы" и "бонусы" к возрасту
        let bioAgeModifier = 0;
        let bmiCategory = '';
        let bmiColor = '';
        let bmiBgColor = '';
        let whrCategory = '';
        let whrColor = '';
        let whrBgColor = '';

        // Оценка ИМТ
        if (bmi < 18.5) {
            bioAgeModifier += (18.5 - bmi) * 0.5; // Небольшой штраф за недовес
            bmiCategory = t('bmiUnderweight');
            bmiColor = 'text-blue-500';
            bmiBgColor = 'bg-blue-500';
        } else if (bmi >= 18.5 && bmi <= 24.9) {
            bioAgeModifier -= 1.5; // Бонус за нормальный вес
            bmiCategory = t('bmiNormal');
            bmiColor = 'text-green-500';
            bmiBgColor = 'bg-green-500';
        } else if (bmi >= 25 && bmi <= 29.9) {
            bioAgeModifier += (bmi - 24.9) * 0.8; // Штраф за избыточный вес
            bmiCategory = t('bmiOverweight');
            bmiColor = 'text-yellow-500';
            bmiBgColor = 'bg-yellow-500';
        } else {
            bioAgeModifier += (bmi - 24.9) * 1.2; // Повышенный штраф за ожирение
            bmiCategory = t('bmiObese');
            bmiColor = 'text-red-500';
            bmiBgColor = 'bg-red-500';
        }

        // Оценка соотношения талии и бедер (различается для мужчин и женщин)
        const optimalWhr = gender === 'male' ? 0.9 : 0.8;
        const moderateWhr = gender === 'male' ? 0.95 : 0.85;

        if (whr <= optimalWhr) {
            bioAgeModifier -= 1.5; // Бонус за хорошее распределение жира (отсутствие висцерального жира)
            whrCategory = t('whrLow');
            whrColor = 'text-green-500';
            whrBgColor = 'bg-green-500';
        } else if (whr <= moderateWhr) {
            bioAgeModifier += (whr - optimalWhr) * 15;
            whrCategory = t('whrModerate');
            whrColor = 'text-yellow-500';
            whrBgColor = 'bg-yellow-500';
        } else {
            bioAgeModifier += (whr - optimalWhr) * 30; // Высокий риск сердечно-сосудистых заболеваний
            whrCategory = t('whrHigh');
            whrColor = 'text-red-500';
            whrBgColor = 'bg-red-500';
        }

        // Итоговый биологический возраст
        let calculatedBioAge = age + bioAgeModifier;

        // Ограничиваем результаты, чтобы они выглядели реалистично (не меньше 18 и не больше возраст+30)
        calculatedBioAge = Math.max(18, Math.min(age + 30, calculatedBioAge));

        return {
            bioAge: Math.round(calculatedBioAge),
            diff: Math.round(calculatedBioAge) - age,
            bmi: bmi.toFixed(1),
            bmiCategory,
            bmiColor,
            bmiBgColor,
            whr: whr.toFixed(2),
            whrCategory,
            whrColor,
            whrBgColor
        };
    }, [gender, age, height, weight, waist, hips, t]);

    // get localized text for year differences
    const getYearsText = (years: number) => {
        const lastDigit = years % 10;
        const lastTwoDigits = years % 100;
        if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'лет'; // Fallback
        if (lastDigit === 1) return 'год';
        if (lastDigit >= 2 && lastDigit <= 4) return 'года';
        return 'лет';
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
        setSaveErrorString(null);

        const res = await saveTestResult({
            testType: 'bio-age',
            score: stats.bioAge,
            interpretation: stats.diff > 0 ? t('older') + ' ' + stats.diff : stats.diff < 0 ? t('younger') + ' ' + Math.abs(stats.diff) : t('matches'),
            rawData: { gender, age, height, weight, waist, hips, bmi: stats.bmi, whr: stats.whr }
        });

        setIsSaving(false);
        if (res?.success) {
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } else {
            setSaveStatus('error');
            setSaveErrorString(res?.error || 'Unknown error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    };

    // Компонент ползунка для переиспользования
    const SliderInput = ({ label, icon: Icon, value, setValue, min, max, unit }: any) => (
        <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
                <label className="flex items-center text-sm font-medium text-gray-700">
                    <Icon className="w-4 h-4 mr-2 text-indigo-500" />
                    {label}
                </label>
                <div className="text-right">
                    <input
                        type="number"
                        value={value}
                        onChange={(e) => setValue(Number(e.target.value) || min)}
                        className="w-16 p-1 text-right border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        min={min}
                        max={max}
                    />
                    <span className="ml-1 text-gray-500 text-sm">{unit}</span>
                </div>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 pt-32 sm:px-6 lg:px-8 font-sans text-gray-800">
            <div className="max-w-4xl mx-auto space-y-6">

                <div className="mb-4">
                    <Link href="/diagnostics" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 transition-colors text-sm font-bold">
                        <ArrowLeft size={16} /> {t('back')}
                    </Link>
                </div>

                <div className="text-center mb-10">
                    <h1 className="text-3xl font-extrabold text-gray-900 flex items-center justify-center gap-3">
                        <Activity className="w-8 h-8 text-indigo-600" />
                        {t('title')}
                    </h1>
                    <p className="mt-2 text-gray-600 max-w-2xl mx-auto">
                        {t('subtitle')}
                    </p>
                </div>

                <div className="flex flex-col md:flex-row gap-6">
                    {/* Левая панель: Ввод данных */}
                    <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h2 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">{t('paramsTitle')}</h2>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('gender')}</label>
                            <div className="flex rounded-md shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => setGender('male')}
                                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-l-md border ${gender === 'male'
                                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 z-10'
                                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    {t('male')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setGender('female')}
                                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-r-md border-y border-r ${gender === 'female'
                                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 z-10'
                                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    {t('female')}
                                </button>
                            </div>
                        </div>

                        <SliderInput label={t('age')} icon={User} value={age} setValue={setAge} min={18} max={100} unit={t('unitYears')} />
                        <SliderInput label={t('height')} icon={Ruler} value={height} setValue={setHeight} min={120} max={220} unit={t('unitCm')} />
                        <SliderInput label={t('weight')} icon={Weight} value={weight} setValue={setWeight} min={30} max={200} unit={t('unitKg')} />
                        <SliderInput label={t('waist')} icon={Scale} value={waist} setValue={setWaist} min={40} max={150} unit={t('unitCm')} />
                        <SliderInput label={t('hips')} icon={Scale} value={hips} setValue={setHips} min={50} max={180} unit={t('unitCm')} />
                    </div>

                    {/* Правая панель: Результаты */}
                    <div className="flex-1 space-y-6">

                        {/* Карточка главного результата */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center relative overflow-hidden">
                            <div className={`absolute top-0 w-full h-2 ${stats.diff > 0 ? 'bg-red-500' : stats.diff < 0 ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                            <h2 className="text-lg font-medium text-gray-500 mb-2 mt-4">{t('bioAgeTitle')}</h2>

                            <div className="flex items-end justify-center gap-2 mb-4">
                                <span className="text-7xl font-black text-gray-900 tracking-tight">{stats.bioAge}</span>
                                <span className="text-xl text-gray-500 mb-2">{t('unitYears')}</span>
                            </div>

                            <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${stats.diff > 0 ? 'bg-red-100 text-red-700' : stats.diff < 0 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                {stats.diff > 0 ? (
                                    <>{t('older')} {stats.diff} {getYearsText(stats.diff)}</>
                                ) : stats.diff < 0 ? (
                                    <>{t('younger')} {Math.abs(stats.diff)} {getYearsText(Math.abs(stats.diff))}</>
                                ) : (
                                    <>{t('matches')}</>
                                )}
                            </div>

                            {/* Save Button Action */}
                            <div className="flex flex-col gap-3 w-full">
            <div className="mt-8 w-full border-t border-gray-100 pt-6">
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving || saveStatus === 'success'}
                                        className={`w-full
                                            flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300
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
                                        ) : (
                                            <><Save size={18} /> {tCommon('saveVault')}</>
                                        )}
                                    </button>

                                    {saveStatus === 'error' && (
                                        <div className="flex items-center gap-2 p-3 mt-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
                                            <AlertCircle className="w-4 h-4 shrink-0" />
                                            <span>Ошибка сохранения: {saveErrorString ? `${saveErrorString}` : 'Попробуйте еще раз'}</span>
                                        </div>
                                    )}
                                </div>
                            
            {!isAuthenticated && (
                <div className="text-center text-xs text-slate-500 font-medium">
                   <a href="/ru/login" target="_blank" className="text-indigo-600 hover:underline font-bold">Войдите</a>, чтобы результаты сохранились в медархиве
                </div>
            )}
          </div>
                        </div>

                        {/* Карточки метрик */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                            {/* ИМТ */}
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-bold text-gray-600 flex items-center">
                                        <HeartPulse className="w-4 h-4 mr-1 text-gray-400" /> {t('bmiTitle')}
                                    </h3>
                                    <span className="text-xl font-bold">{stats.bmi}</span>
                                </div>
                                <div className={`text-sm font-medium ${stats.bmiColor}`}>
                                    {stats.bmiCategory}
                                </div>
                                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                                    <div className={`h-1.5 rounded-full ${stats.bmiBgColor}`} style={{ width: `${Math.min(100, (Number(stats.bmi) / 40) * 100)}%` }}></div>
                                </div>
                            </div>

                            {/* Соотношение талии и бедер */}
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-bold text-gray-600 flex items-center">
                                        <Activity className="w-4 h-4 mr-1 text-gray-400" /> {t('whrTitle')}
                                    </h3>
                                    <span className="text-xl font-bold">{stats.whr}</span>
                                </div>
                                <div className={`text-sm font-medium ${stats.whrColor}`}>
                                    {stats.whrCategory}
                                </div>
                                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                                    <div className={`h-1.5 rounded-full ${stats.whrBgColor}`} style={{ width: `${Math.min(100, (Number(stats.whr) / 1.5) * 100)}%` }}></div>
                                </div>
                            </div>

                        </div>

                        {/* Информационная справка */}
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-blue-800">
                                <p className="font-semibold mb-1">{t('infoTitle')}</p>
                                <p>
                                    {t('infoDesc1')}
                                </p>
                                <p className="mt-2 text-xs opacity-75">
                                    {t('infoDesc2')}
                                </p>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}
