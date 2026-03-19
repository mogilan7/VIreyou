"use client";
import React, { useState, useRef, useEffect } from 'react';
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ArrowLeft, Brain, Clock, CheckCircle, AlertCircle, RefreshCcw, Save, Loader2 } from 'lucide-react';
import { saveTestResult } from '@/actions/save-test';
import { createClient } from '@/utils/supabase/client';

export default function MiniCogCalculatorPage() {
    const t = useTranslations('MiniCogCalculator');
    const tCommon = useTranslations('Common');
    const [screen, setScreen] = useState<'start' | 'stage1' | 'stage2' | 'stage3' | 'result'>('start');
    const [selectedWords, setSelectedWords] = useState<string[]>([]);
    const [clockScore, setClockScore] = useState<number>(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [shuffledWords, setShuffledWords] = useState<{ id: string, text: string }[]>([]);

    const allWords = [
        { id: 'w-lemon', text: t('wordOpt1'), isCorrect: true },
        { id: 'w-table', text: t('wordOpt2'), isCorrect: false },
        { id: 'w-key', text: t('wordOpt3'), isCorrect: true },
        { id: 'w-book', text: t('wordOpt4'), isCorrect: false },
        { id: 'w-ball', text: t('wordOpt5'), isCorrect: true },
        { id: 'w-apple', text: t('wordOpt6'), isCorrect: false },
    ];

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

    useEffect(() => {
        if (screen === 'stage3') {
            // Shuffle
            setShuffledWords([...allWords].sort(() => Math.random() - 0.5));
        }
    }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

    // Canvas logic
    useEffect(() => {
        if (screen === 'stage2' && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.strokeStyle = '#2D4B39'; // brand-forest
            }
        }
    }, [screen]);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        draw(e);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        if (canvasRef.current) {
            canvasRef.current.getContext('2d')?.beginPath();
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();

        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const clearCanvas = () => {
        if (canvasRef.current) {
            const canvas = canvasRef.current;
            canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const handleWordToggle = (id: string) => {
        setSelectedWords(prev =>
            prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
        );
    };

    const calculateScore = () => {
        let score = 0;
        if (selectedWords.includes('w-lemon')) score++;
        if (selectedWords.includes('w-key')) score++;
        if (selectedWords.includes('w-ball')) score++;

        return score + clockScore;
    };

    const totalScore = calculateScore();

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
            testType: 'mini-cog',
            score: totalScore,
            interpretation: totalScore < 3 ? t('resBadLabel') : t('resGoodLabel'),
            rawData: { selectedWords, clockScore, maxScore: 5 }
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
        <div className="min-h-screen bg-brand-bg p-4 pt-32 md:p-8 font-sans text-brand-text">
            <div className="max-w-2xl mx-auto space-y-4">

                <div>
                    <Link href="/diagnostics" className="inline-flex items-center gap-2 text-brand-forest hover:text-brand-leaf transition-colors text-sm font-bold">
                        <ArrowLeft size={16} /> {t('back')}
                    </Link>
                </div>

                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-brand-sage/40">

                    {/* Header */}
                    <div className="bg-brand-forest p-8 text-white relative overflow-hidden">
                        <div className="relative z-10 flex items-center justify-center gap-3">
                            <Brain className="w-8 h-8 text-brand-leaf" />
                            <div>
                                <h1 className="text-2xl font-serif font-bold tracking-tight text-center">{t('title')}</h1>
                                <p className="text-white/80 text-sm opacity-90 text-center">{t('subtitle')}</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 md:p-8 min-h-[400px] flex flex-col justify-center">

                        {/* Initial Screen */}
                        {screen === 'start' && (
                            <div className="text-center animate-in fade-in zoom-in duration-300">
                                <div className="mb-6 text-brand-gray space-y-4 text-left">
                                    <p>{t('intro1')}</p>
                                    <div className="bg-brand-sage/10 p-4 rounded-xl border border-brand-sage/30 text-sm text-brand-forest">
                                        <strong>{t('instruction')}</strong> {t('intro2')}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setScreen('stage1')}
                                    className="w-full bg-brand-leaf hover:bg-brand-forest text-white font-semibold py-4 px-6 rounded-2xl transition shadow-lg active:scale-95"
                                >
                                    {t('start')}
                                </button>
                            </div>
                        )}

                        {/* Stage 1: Memory */}
                        {screen === 'stage1' && (
                            <div className="text-center animate-in slide-in-from-right duration-300">
                                <h2 className="text-xl font-bold mb-4 text-brand-forest uppercase tracking-wider">{t('stage1')}</h2>
                                <p className="text-brand-gray mb-8">{t('stage1Desc')}</p>

                                <div className="grid grid-cols-1 gap-4 mb-10">
                                    <div className="bg-brand-sage/10 py-4- rounded-2xl text-2xl font-black tracking-widest text-brand-forest shadow-sm flex items-center justify-center h-16">{t('word1')}</div>
                                    <div className="bg-brand-sage/10 py-4- rounded-2xl text-2xl font-black tracking-widest text-brand-forest shadow-sm flex items-center justify-center h-16">{t('word2')}</div>
                                    <div className="bg-brand-sage/10 py-4- rounded-2xl text-2xl font-black tracking-widest text-brand-forest shadow-sm flex items-center justify-center h-16">{t('word3')}</div>
                                </div>

                                <button
                                    onClick={() => setScreen('stage2')}
                                    className="w-full bg-brand-leaf hover:bg-brand-forest text-white font-semibold flex py-4 px-6 rounded-2xl transition items-center justify-center shadow-md active:scale-95"
                                >
                                    {t('next1')}
                                </button>
                            </div>
                        )}

                        {/* Stage 2: Clock Drawing */}
                        {screen === 'stage2' && (
                            <div className="animate-in slide-in-from-right duration-300 flex flex-col items-center">
                                <h2 className="text-xl font-bold mb-2 text-brand-forest uppercase tracking-wider text-center">{t('stage2')}</h2>
                                <p className="text-brand-gray text-sm mb-6 text-center max-w-sm">
                                    {t('stage2Desc')} <br /><strong className="text-brand-forest bg-brand-sage/20 px-2 py-1 rounded inline-block mt-2">{t('stage2Time')}</strong>.
                                </p>

                                <div className="relative mb-6 flex justify-center w-full touch-none select-none">
                                    <canvas
                                        ref={canvasRef}
                                        width={280}
                                        height={280}
                                        className="border-[3px] border-dashed border-brand-sage/50 bg-[#fafdfb] rounded-full cursor-crosshair shadow-inner"
                                        onMouseDown={startDrawing}
                                        onMouseMove={draw}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                        onTouchStart={startDrawing}
                                        onTouchMove={draw}
                                        onTouchEnd={stopDrawing}
                                    />
                                    <div className="absolute top-4 left-4 text-brand-sage/30 pointer-events-none">
                                        <Clock size={24} />
                                    </div>
                                </div>

                                <div className="flex gap-3 w-full">
                                    <button onClick={clearCanvas} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-semibold transition">
                                        {t('clear')}
                                    </button>
                                    <button onClick={() => setScreen('stage3')} className="flex-[2] bg-brand-leaf hover:bg-brand-forest text-white py-3 rounded-xl font-semibold shadow-md transition">
                                        {t('done')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Stage 3: Recall */}
                        {screen === 'stage3' && (
                            <div className="animate-in slide-in-from-right duration-300">
                                <h2 className="text-xl font-bold mb-4 text-brand-forest uppercase tracking-wider text-center">{t('stage3')}</h2>
                                <p className="text-brand-gray mb-6 text-center">{t('stage3Desc')}</p>

                                <div className="grid grid-cols-2 gap-3 mb-10">
                                    {shuffledWords.map(word => (
                                        <label key={word.id} className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition select-none
                                            ${selectedWords.includes(word.id) ? 'border-brand-leaf bg-brand-sage/10' : 'border-slate-100 hover:border-brand-sage/50 bg-white'}`}>
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 rounded border-gray-300 text-brand-leaf focus:ring-brand-forest"
                                                checked={selectedWords.includes(word.id)}
                                                onChange={() => handleWordToggle(word.id)}
                                            />
                                            <span className="text-lg text-brand-text font-medium">{word.text}</span>
                                        </label>
                                    ))}
                                </div>

                                <div className="mb-8 p-6 bg-[#fafdfb] rounded-2xl border border-brand-sage/40 shadow-sm">
                                    <h3 className="font-bold mb-2 text-brand-forest uppercase text-xs tracking-widest">{t('evalClock')}</h3>
                                    <p className="text-sm text-brand-gray mb-6">{t('evalClockDesc')}</p>

                                    <div className="flex flex-col items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-brand-sage/20">
                                        <span className="text-[10px] text-brand-gray mb-3 uppercase tracking-wider font-bold">{t('exampleClock')}</span>
                                        <svg viewBox="0 0 100 100" className="w-24 h-24">
                                            <circle cx="50" cy="50" r="46" fill="white" stroke="#2D4B39" strokeWidth="3" />
                                            {/* Основные цифры */}
                                            <text x="50" y="16" textAnchor="middle" fontSize="10" fontFamily="sans-serif" fontWeight="bold" fill="#2D4B39">12</text>
                                            <text x="86" y="53.5" textAnchor="middle" fontSize="10" fontFamily="sans-serif" fontWeight="bold" fill="#2D4B39">3</text>
                                            <text x="50" y="90" textAnchor="middle" fontSize="10" fontFamily="sans-serif" fontWeight="bold" fill="#2D4B39">6</text>
                                            <text x="14" y="53.5" textAnchor="middle" fontSize="10" fontFamily="sans-serif" fontWeight="bold" fill="#2D4B39">9</text>
                                            {/* Отметки остальных часов */}
                                            <circle cx="70" cy="15.4" r="1.5" fill="#A8BCA1" />
                                            <circle cx="84.6" cy="30" r="1.5" fill="#A8BCA1" />
                                            <circle cx="84.6" cy="70" r="1.5" fill="#A8BCA1" />
                                            <circle cx="70" cy="84.6" r="1.5" fill="#A8BCA1" />
                                            <circle cx="30" cy="84.6" r="1.5" fill="#A8BCA1" />
                                            <circle cx="15.4" cy="70" r="1.5" fill="#A8BCA1" />
                                            <circle cx="15.4" cy="30" r="1.5" fill="#A8BCA1" />
                                            <circle cx="30" cy="15.4" r="1.5" fill="#A8BCA1" />

                                            {/* Минутная стрелка (на 2 часа / 10 минут) */}
                                            <line x1="50" y1="50" x2="80.3" y2="32.5" stroke="#4a7c59" strokeWidth="2" strokeLinecap="round" />
                                            {/* Часовая стрелка (чуть дальше 11 часов) */}
                                            <line x1="50" y1="50" x2="39.5" y2="27.4" stroke="#2D4B39" strokeWidth="3.5" strokeLinecap="round" />
                                            {/* Центр */}
                                            <circle cx="50" cy="50" r="3" fill="#2D4B39" />
                                        </svg>
                                    </div>

                                    <div className="space-y-3 text-left">
                                        <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${clockScore === 2 ? 'border-brand-leaf bg-brand-sage/10' : 'border-transparent'}`}>
                                            <input
                                                type="radio"
                                                name="clock_eval"
                                                checked={clockScore === 2}
                                                onChange={() => setClockScore(2)}
                                                className="w-5 h-5 text-brand-leaf focus:ring-brand-forest cursor-pointer"
                                            />
                                            <span className="text-brand-text font-medium text-sm">{t('clockYes')}</span>
                                        </label>
                                        <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${clockScore === 0 ? 'border-brand-leaf bg-brand-sage/10' : 'border-transparent'}`}>
                                            <input
                                                type="radio"
                                                name="clock_eval"
                                                checked={clockScore === 0}
                                                onChange={() => setClockScore(0)}
                                                className="w-5 h-5 text-brand-leaf focus:ring-brand-forest cursor-pointer"
                                            />
                                            <span className="text-brand-text font-medium text-sm">{t('clockNo')}</span>
                                        </label>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setScreen('result')}
                                    className="w-full bg-brand-leaf hover:bg-brand-forest text-white font-semibold py-4 px-6 rounded-2xl transition shadow-lg my-2 active:scale-95"
                                >
                                    {t('showResult')}
                                </button>
                            </div>
                        )}

                        {/* Results Screen */}
                        {screen === 'result' && (
                            <div className="animate-in zoom-in duration-300 flex flex-col items-center">
                                <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center mb-6 shadow-sm border-4 
                                    ${totalScore < 3 ? 'bg-red-50 border-red-100 text-red-500' : 'bg-[#E8F1EB] border-brand-sage/40 text-brand-leaf'}`}>
                                    {totalScore < 3 ? <AlertCircle size={40} /> : <CheckCircle size={40} />}
                                </div>

                                <div className="text-center mb-8">
                                    <div className="text-sm font-bold text-brand-gray uppercase tracking-widest">{t('resultTitle')}</div>
                                    <div className="flex items-baseline justify-center gap-2 mt-2">
                                        <span className={`text-6xl font-black ${totalScore < 3 ? 'text-red-600' : 'text-brand-forest'}`}>{totalScore}</span>
                                        <span className="text-xl text-brand-gray/50 font-bold">/ 5</span>
                                    </div>
                                    <div className="text-sm text-brand-gray mt-1">{t('totalScore').replace('{score}', '')}</div>
                                </div>

                                <div className={`p-6 rounded-2xl mb-8 border w-full text-center
                                    ${totalScore < 3 ? 'bg-red-50 border-red-100' : 'bg-brand-sage/10 border-brand-sage/30'}`}>
                                    <h3 className={`font-bold text-lg mb-2 ${totalScore < 3 ? 'text-red-700' : 'text-brand-forest'}`}>
                                        {totalScore < 3 ? t('resBadLabel') : t('resGoodLabel')}
                                    </h3>
                                    <p className={`text-sm ${totalScore < 3 ? 'text-red-600/80' : 'text-brand-forest/80'}`}>
                                        {totalScore < 3 ? t('resBadDesc') : t('resGoodDesc')}
                                    </p>
                                </div>

                                <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl text-sm text-brand-gray w-full text-center space-y-1 mb-6">
                                    <p><strong className="text-brand-text">{t('interpretationTitle')}</strong></p>
                                    <p>{t('interpretationDesc')}</p>
                                </div>

                                {/* Save Button Action */}
                                <div className="flex flex-col gap-3 w-full">
            <div className="w-full mb-4">
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
                                
            {!isAuthenticated && (
                <div className="text-center text-xs text-slate-500 font-medium">
                   <a href="/ru/login" target="_blank" className="text-indigo-600 hover:underline font-bold">Войдите</a>, чтобы результаты сохранились в медархиве
                </div>
            )}
          </div>

                                <button
                                    onClick={() => {
                                        setScreen('start');
                                        setSelectedWords([]);
                                        setClockScore(0);
                                        clearCanvas();
                                    }}
                                    className="w-full flex items-center justify-center gap-2 border-2 border-slate-200 text-brand-gray hover:bg-slate-50 font-semibold py-4 px-6 rounded-2xl transition active:scale-95"
                                >
                                    <RefreshCcw size={18} />
                                    {t('restart')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
