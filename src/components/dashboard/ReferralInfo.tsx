"use client";

import React, { useState } from 'react';
import { Info, X } from 'lucide-react';

export default function ReferralInfo() {
    const [isOpen, setIsOpen] = useState(false);

    const toggleModal = () => setIsOpen(!isOpen);

    return (
        <>
            <button 
                onClick={toggleModal}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400"
                title="Подробнее"
            >
                <Info size={18} />
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div 
                        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-white/10 relative animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={toggleModal}
                            className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="space-y-4">
                            <h2 className="text-xl font-bold flex items-center gap-2 pr-8">
                                🌿 Поделись заботой о здоровье
                            </h2>
                            <div className="space-y-4 text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                                <p>
                                    Когда ты приглашаешь друга в VIReyou — ты не просто делишься ссылкой. Ты даёшь человеку 3 дня бесплатного доступа к персональному нутрициологу по долголетию.
                                </p>
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/30">
                                    <p className="font-semibold text-blue-700 dark:text-blue-300 mb-2">А пока он заботится о себе — бот заботится о тебе:</p>
                                    <ul className="space-y-2">
                                        <li className="flex items-start gap-2">
                                            <span className="text-blue-500 mt-1">•</span>
                                            <span>Друг оплатил подписку → ты получаешь 10% на внутренний баланс.</span>
                                        </li>
                                    </ul>
                                </div>
                                <p>
                                    Баланс копится в разделе «Кошелёк» и в будущем его можно будет потратить на свою подписку или подарить другу.
                                </p>
                                <p className="italic font-medium text-slate-800 dark:text-slate-200">
                                    Это не партнёрка. Это сообщество людей, которые помогают друг другу стареть медленнее.
                                </p>
                            </div>
                            <button 
                                onClick={toggleModal}
                                className="w-full py-3 bg-[#60B76F] hover:bg-emerald-600 text-white font-bold rounded-2xl transition-colors shadow-lg shadow-[#60B76F]/20"
                            >
                                Понятно
                            </button>
                        </div>
                    </div>
                    {/* Backdrop closer */}
                    <div className="absolute inset-0 -z-10" onClick={toggleModal}></div>
                </div>
            )}
        </>
    );
}
