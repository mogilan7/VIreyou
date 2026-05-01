"use client";

import React, { useState, useEffect } from 'react';
import { X, Zap, Star, ArrowRight, Check, Sparkles } from 'lucide-react';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentPlan: string;
}

export default function UpgradeModal({ isOpen, onClose, currentPlan }: UpgradeModalProps) {
    const [loading, setLoading] = useState(false);

    // Lock scroll on mobile when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen) return null;

    const standardPrice = 9.90;
    const proPrice = 14.90;
    const upgradePrice = parseFloat((proPrice - standardPrice).toFixed(2));

    const handleUpgrade = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/payments/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: 'PRO', amount: proPrice })
            });

            const data = await response.json();

            if (data.confirmation_url) {
                window.location.href = data.confirmation_url;
            } else {
                alert(`Ошибка: ${data.details || 'Попробуйте позже'}`);
                setLoading(false);
            }
        } catch {
            alert('Ошибка подключения. Проверьте интернет.');
            setLoading(false);
        }
    };

    const proFeatures = [
        { icon: '🏃', label: 'Организация марафонов', sub: 'Создавайте и монетизируйте свои марафоны' },
        { icon: '💰', label: '+5% реферальный бонус', sub: 'Дополнительный доход от каждого участника' },
        { icon: '🍽️', label: 'Советы «Что съесть на ужин?»', sub: 'ИИ-рекомендации на основе ваших данных' },
        { icon: '🏪', label: 'Анализ продуктов в магазине', sub: 'Сканируйте штрихкод — получайте оценку' },
        { icon: '🤖', label: 'Приоритетный доступ к ИИ', sub: 'GPT-4o вместо GPT-4o-mini' },
    ];

    return (
        <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden"
                style={{ maxHeight: '92dvh' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Gradient header */}
                <div className="relative bg-gradient-to-br from-[#60B76F] via-emerald-500 to-teal-500 p-6 pb-10">
                    {/* Decorative circles */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors z-10"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-5 h-5 text-yellow-300" />
                            <span className="text-white/80 text-sm font-medium uppercase tracking-wider">Апгрейд до</span>
                        </div>
                        <h2 className="text-3xl font-black text-white">VIReyou PRO</h2>
                        <p className="text-white/80 text-sm mt-1">Полный доступ ко всем функциям платформы</p>
                    </div>
                </div>

                {/* Price block */}
                <div className="relative -mt-6 mx-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 flex items-center justify-between border border-slate-100 dark:border-white/5">
                    <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Стоимость PRO</p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-slate-800 dark:text-white">{proPrice.toFixed(2)} ₽</span>
                            <span className="text-sm text-slate-400">/ мес</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2">
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Доплата за апгрейд</p>
                            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">+{upgradePrice.toFixed(2)} ₽</p>
                        </div>
                    </div>
                </div>

                {/* Features list (scrollable on small screens) */}
                <div className="overflow-y-auto px-6 pt-5 pb-4" style={{ maxHeight: '40dvh' }}>
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Что вы получаете</p>
                    <div className="space-y-3">
                        {proFeatures.map((f, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">
                                    {f.icon}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{f.label}</p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500">{f.sub}</p>
                                </div>
                                <Check className="w-4 h-4 text-emerald-500 ml-auto mt-0.5 flex-shrink-0" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* CTA footer */}
                <div className="px-6 pb-6 pt-3 border-t border-slate-100 dark:border-white/5">
                    <button
                        onClick={handleUpgrade}
                        disabled={loading}
                        className="w-full relative overflow-hidden flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-white text-base transition-all duration-300 shadow-xl shadow-emerald-500/30 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                        style={{ background: 'linear-gradient(135deg, #60B76F 0%, #38a169 60%, #2f9e44 100%)' }}
                    >
                        {/* Shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
                        {loading ? (
                            <>
                                <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                <span>Создание платежа...</span>
                            </>
                        ) : (
                            <>
                                <Zap className="w-5 h-5 fill-white" />
                                <span>Перейти на PRO — {proPrice.toFixed(2)} ₽/мес</span>
                                <ArrowRight className="w-4 h-4 ml-auto" />
                            </>
                        )}
                    </button>
                    <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-3">
                        Безопасная оплата через ЮKassa · Отмена в любой момент
                    </p>
                </div>
            </div>
        </div>
    );
}
