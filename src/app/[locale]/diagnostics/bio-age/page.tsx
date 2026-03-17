"use client";

import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Move, 
  Zap, 
  Compass, 
  RefreshCw, 
  Fingerprint, 
  Activity, 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Save,
  AlertCircle
} from 'lucide-react';
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { saveTestResult } from '@/actions/save-test';
import { createClient } from '@/utils/supabase/client';

export default function BioAgeCalculatorPage() {
    const t = useTranslations('BioAgeCalculator');
    const tCommon = useTranslations('Common');

    const [currentStep, setCurrentStep] = useState(-1); // -1: Intro, 0-6: Tests, 7: Result
    const [results, setResults] = useState<Record<string, number>>({});
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

    const testConfigs = [
        { id: 'cardio', icon: Heart, ages: [18, 25, 37, 46, 55, 63], color: 'text-red-500', bg: 'bg-red-50' },
        { id: 'flexibility', icon: Move, ages: [18, 25, 35, 45, 55, 65], color: 'text-blue-500', bg: 'bg-blue-50' },
        { id: 'reaction', icon: Zap, ages: [18, 27, 35, 46, 55, 65], color: 'text-yellow-500', bg: 'bg-yellow-50' },
        { id: 'coordination', icon: Compass, ages: [20, 30, 40, 50, 60], color: 'text-green-500', bg: 'bg-green-50' },
        { id: 'vestibular', icon: RefreshCw, ages: [20, 29, 35, 40, 50, 60], color: 'text-purple-500', bg: 'bg-purple-50' },
        { id: 'skin', icon: Fingerprint, ages: [25, 35, 45, 55, 65], color: 'text-pink-500', bg: 'bg-pink-50' },
        { id: 'joints', icon: Activity, ages: [18, 27, 37, 45, 55, 65], color: 'text-teal-500', bg: 'bg-teal-50' }
    ];

    const currentTest = currentStep >= 0 && currentStep < testConfigs.length ? testConfigs[currentStep] : null;

    const handleStart = () => {
        setCurrentStep(0);
    };

    const handleSelect = (testId: string, age: number) => {
        setResults(prev => ({ ...prev, [testId]: age }));
        setTimeout(() => {
            if (currentStep < testConfigs.length - 1) {
                setCurrentStep(currentStep + 1);
            } else {
                setCurrentStep(testConfigs.length);
            }
        }, 300);
    };

    const handleReset = () => {
        setResults({});
        setCurrentStep(-1);
    };

    const calculateFinalAge = () => {
        const values = Object.values(results);
        if (values.length === 0) return 0;
        const sum = values.reduce((a, b) => a + b, 0);
        return Math.round(sum / values.length);
    };

    const handleSave = async () => {
        if (!isAuthenticated) return;
        setIsSaving(true);
        setSaveStatus('idle');

        const finalAge = calculateFinalAge();
        const res = await saveTestResult({
            testType: 'bio-age',
            score: finalAge,
            interpretation: `Биологический возраст: ${finalAge} лет`,
            rawData: results // Saves individual system ages: { cardio: 46, index: ... }
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

    const progress = (Object.keys(results).length / testConfigs.length) * 100;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans text-slate-800 pt-32">
            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden transition-all duration-500 relative">
                
                {/* Back button is always here for navigation */}
                <div className="absolute left-6 top-6 z-10">
                    <Link href="/diagnostics" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 transition-colors text-sm font-bold">
                        <ArrowLeft size={16} /> {t('back')}
                    </Link>
                </div>

                {/* Progress bar */}
                {currentStep >= 0 && currentStep < testConfigs.length && (
                    <div className="h-2 bg-slate-100 w-full mt-16">
                        <div 
                            className="h-full bg-indigo-500 transition-all duration-500 ease-out" 
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}

                <div className={`p-8 md:p-12 ${currentStep < 0 ? 'pt-20' : 'pt-12'}`}>
                  
                  {/* Welcome Screen */}
                  {currentStep === -1 && (
                    <div className="text-center space-y-6">
                      <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Activity className="w-10 h-10 text-indigo-600" />
                      </div>
                      <h1 className="text-3xl font-bold text-slate-900">{t('title')}</h1>
                      <p className="text-slate-600 leading-relaxed max-w-md mx-auto">
                        {t('subtitle')}
                      </p>
                      <button 
                        onClick={handleStart}
                        className="inline-flex items-center px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl transition-colors shadow-lg shadow-indigo-200"
                      >
                        {t('introBtn')}
                        <ChevronRight className="ml-2 w-5 h-5" />
                      </button>
                    </div>
                  )}

                  {/* Test Steps */}
                  {currentTest && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                      <div className="flex items-center space-x-4">
                        <div className={`p-3 rounded-2xl ${currentTest.bg}`}>
                          {React.createElement(currentTest.icon, { className: `w-6 h-6 ${currentTest.color}` })}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider">
                            {t('stepText')} {currentStep + 1} {t('stepOf')} {testConfigs.length}
                          </span>
                          <h2 className="text-2xl font-bold text-slate-900">{t(`tests.${currentTest.id}.title`)}</h2>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <h3 className="font-semibold mb-2 text-slate-700">{t('instruction')}</h3>
                        <p className="text-slate-600 leading-relaxed italic">
                          {t(`tests.${currentTest.id}.instr`)}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        {t.raw(`tests.${currentTest.id}.options`).map((lbl: string, idx: number) => {
                            const age = currentTest.ages[idx];
                            const isSelected = results[currentTest.id] === age;
                            return (
                              <button
                                key={idx}
                                onClick={() => handleSelect(currentTest.id, age)}
                                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                                  isSelected 
                                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                                  : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50'
                                }`}
                              >
                                <span className="font-medium">{lbl}</span>
                                {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-500" />}
                              </button>
                            );
                        })}
                      </div>

                      <div className="flex justify-between pt-4 border-t border-slate-100">
                        <button 
                          onClick={() => setCurrentStep(prev => prev - 1)}
                          className="flex items-center text-slate-400 hover:text-slate-600 transition-colors font-medium"
                        >
                          <ChevronLeft className="mr-1 w-5 h-5" />
                          {t('backStep')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Result Screen */}
                  {currentStep === testConfigs.length && (
                    <div className="text-center space-y-8 animate-in zoom-in-95 duration-700">
                      <div>
                        <h2 className="text-xl font-medium text-slate-500 mb-2">{t('resultTitle')}</h2>
                        <div className="inline-block relative">
                          <span className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-purple-600">
                            {calculateFinalAge()}
                          </span>
                          <span className="text-2xl font-bold text-indigo-400 ml-2">{t('years')}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                        {testConfigs.map((test) => (
                          <div key={test.id} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between border border-slate-100">
                            <div className="flex items-center space-x-3">
                              <div className="scale-75">
                                {React.createElement(test.icon, { className: `w-6 h-6 ${test.color}` })}
                              </div>
                              <span className="text-sm font-medium text-slate-600 truncate max-w-[120px] md:max-w-none">{t(`tests.${test.id}.title`)}</span>
                            </div>
                            <span className="font-bold text-indigo-600">{results[test.id]} {t('years')}</span>
                          </div>
                        ))}
                      </div>

                      <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                        <p className="text-indigo-800 text-sm italic">
                          {t('disclaimer')}
                        </p>
                      </div>

                      <div className="flex flex-col gap-3">
                        {isAuthenticated && (
                            <button
                                onClick={handleSave}
                                disabled={isSaving || saveStatus === 'success'}
                                className={`
                                    w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold text-sm transition-all duration-300 shadow-lg
                                    ${saveStatus === 'success'
                                        ? 'bg-green-600 text-white shadow-green-100'
                                        : saveStatus === 'error'
                                            ? 'bg-red-50 text-red-600 border border-red-200'
                                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'
                                    }
                                `}
                            >
                                {isSaving ? (
                                    <><Loader2 size={18} className="animate-spin" /> {t('saving')}</>
                                ) : saveStatus === 'success' ? (
                                    <><CheckCircle2 size={18} /> {t('saved')}</>
                                ) : saveStatus === 'error' ? (
                                    <><AlertCircle size={18} /> Error</>
                                ) : (
                                    <><Save size={18} /> {t('saveBtn')}</>
                                )}
                            </button>
                        )}

                        <button 
                          onClick={handleReset}
                          className="inline-flex items-center justify-center px-6 py-4 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-2xl transition-all shadow-lg"
                        >
                          <RotateCcw className="mr-2 w-5 h-5" />
                          {t('restart')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
            </div>
        </div>
    );
}
