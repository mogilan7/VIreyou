"use client";

import React, { useState, useEffect } from 'react';
import {
    X,
    Check,
    AlertCircle,
    Save,
    Loader2,
    Activity,
    Info
} from 'lucide-react';

interface Biomarker {
    value: string | number;
    unit: string;
    reference_range: string;
    status: string;
}

interface ReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    documentId: string;
    fileName: string;
    initialData: Record<string, Biomarker>;
    onConfirm: () => void;
}

export default function ReviewModal({
    isOpen,
    onClose,
    documentId,
    fileName,
    initialData,
    onConfirm
}: ReviewModalProps) {
    const [data, setData] = useState<Record<string, Biomarker>>(initialData);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setData(initialData);
    }, [initialData]);

    if (!isOpen) return null;

    const handleValueChange = (key: string, field: keyof Biomarker, value: string) => {
        setData(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: value
            }
        }));
    };

    const handleConfirm = async () => {
        setIsSaving(true);
        setError(null);
        try {
            const response = await fetch('/api/cabinet/archive/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId,
                    confirmedData: data
                })
            });

            if (response.ok) {
                onConfirm();
                onClose();
            } else {
                const result = await response.json();
                setError(result.error || "Ошибка при сохранении");
            }
        } catch (err) {
            setError("Ошибка связи с сервером");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] border border-brand-sage/20 dark:border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-8 border-b dark:border-white/5 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-bold text-teal-500 dark:text-teal-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                            <Activity size={12} />
                            Проверка результатов ИИ
                        </div>
                        <h2 className="text-xl font-bold dark:text-white truncate max-w-md">
                            {fileName}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-400"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                    {error && (
                        <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center gap-3">
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    )}

                    <div className="bg-brand-leaf/5 dark:bg-teal-500/5 p-4 rounded-2xl border border-brand-leaf/10 dark:border-teal-400/10 mb-6 flex items-start gap-3">
                        <Info size={16} className="text-brand-leaf dark:text-teal-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-brand-text dark:text-slate-300 leading-normal">
                            Пожалуйста, сверьте распознанные данные с оригинальным документом. Вы можете отредактировать значения, если ИИ допустил ошибку.
                        </p>
                    </div>

                    <div className="space-y-4">
                        {Object.entries(data).map(([key, item]) => (
                            <div key={key} className="p-4 rounded-2xl border border-brand-sage/10 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 flex flex-col sm:flex-row sm:items-center gap-4">
                                <div className="flex-1 min-w-0">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                        {key.replace(/_/g, ' ')}
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={item.value}
                                            onChange={(e) => handleValueChange(key, 'value', e.target.value)}
                                            className="bg-white dark:bg-slate-800 border dark:border-white/10 rounded-lg px-2 py-1 text-sm font-bold w-24 dark:text-white outline-none focus:ring-1 focus:ring-teal-500/50"
                                        />
                                        <span className="text-xs text-slate-500">{item.unit}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                                        Норма
                                    </label>
                                    <input
                                        type="text"
                                        value={item.reference_range}
                                        onChange={(e) => handleValueChange(key, 'reference_range', e.target.value)}
                                        className="bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 outline-none w-32 focus:border-teal-500"
                                    />
                                </div>

                                <div className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest self-start sm:self-auto
                                    ${item.status === 'NORMAL' ? 'bg-teal-500/10 text-teal-500' :
                                        item.status === 'ABNORMAL' ? 'bg-amber-400/10 text-amber-500' :
                                            'bg-slate-500/10 text-slate-500'}`}>
                                    {item.status === 'NORMAL' ? 'Норма' :
                                        item.status === 'ABNORMAL' ? 'Риск' : 'Неизвестно'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 border-t dark:border-white/5 flex items-center justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-full text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isSaving}
                        className="bg-teal-500 dark:bg-teal-400 text-white dark:text-slate-900 px-8 py-2.5 rounded-full font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Сохранение...
                            </>
                        ) : (
                            <>
                                <Check size={18} />
                                Подтвердить результаты
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
