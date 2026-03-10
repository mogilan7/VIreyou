"use client";
import React, { useState, useCallback } from 'react';
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function DocumentUpload({ userId, email, fullName }: { userId: string, email?: string, fullName?: string }) {
    const t = useTranslations('Dashboard.Client');
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const router = useRouter();

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleUpload = async (file: File) => {
        if (!file) return;

        // Validation
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            setError(t('maTypeError'));
            return;
        }

        if (file.size > 15 * 1024 * 1024) { // 15MB
            setError(t('maLimitError'));
            return;
        }

        setUploading(true);
        setError(null);
        setSuccess(false);
        setProgress(10);

        try {
            const supabase = createClient();

            // 1. Upload to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('medical-archive')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            setProgress(60);

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('medical-archive')
                .getPublicUrl(fileName);

            // 3. Create record in Prisma via server action (to be implemented)
            const response = await fetch('/api/cabinet/archive/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    email,
                    fullName,
                    fileName: file.name,
                    fileUrl: publicUrl,
                    fileType: file.type
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to save document record');
            }

            setProgress(100);
            setSuccess(true);
            setTimeout(() => {
                setUploading(false);
                setProgress(0);
                router.refresh();
            }, 2000);

        } catch (err: unknown) {
            const errorObj = err as { message?: string, statusCode?: number };
            console.error('Full upload error object:', err);
            const detail = errorObj.statusCode ? `(Code: ${errorObj.statusCode}) ${errorObj.message}` : errorObj.message;
            setError(`${t('maError')}: ${detail}`);
            setUploading(false);
        }
    };

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleUpload(file);
    }, [handleUpload]);

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleUpload(file);
    };

    return (
        <div className="w-full">
            <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`relative group border-2 border-dashed rounded-3xl p-8 transition-all duration-300 flex flex-col items-center justify-center min-h-[220px] text-center
                    ${isDragging
                        ? 'border-teal-500 bg-teal-500/5'
                        : 'border-brand-sage/30 hover:border-brand-leaf/40 hover:bg-brand-leaf/5 dark:border-white/10 dark:hover:border-teal-400/30 dark:hover:bg-teal-400/5'}`}
            >
                {/* Hidden Input */}
                <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={onFileChange}
                    disabled={uploading}
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                />

                {uploading ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative w-16 h-16">
                            <Loader2 className="w-16 h-16 text-teal-500 animate-spin" strokeWidth={1} />
                            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-teal-500">
                                {progress}%
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-brand-text dark:text-white">{t('maUploading')}</p>
                            <p className="text-[10px] text-brand-gray tracking-wider mt-1 uppercase">{t('maWait')}</p>
                        </div>
                    </div>
                ) : success ? (
                    <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                        <div className="bg-teal-500/20 p-4 rounded-full">
                            <CheckCircle2 className="w-10 h-10 text-teal-400" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-brand-text dark:text-white">{t('maSuccess')}</p>
                            <p className="text-[10px] text-teal-400 tracking-wider mt-1 uppercase">{t('maSuccessDesc')}</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className="bg-red-500/10 p-4 rounded-full">
                            <AlertCircle className="w-10 h-10 text-red-500" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-red-500">{error}</p>
                            <button
                                onClick={(e) => { e.stopPropagation(); setError(null); }}
                                className="text-[10px] text-brand-gray underline mt-2 uppercase tracking-widest hover:text-brand-text"
                            >
                                {t('maRetry')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className={`p-4 rounded-full mb-4 transition-transform group-hover:scale-110 duration-500 ${isDragging ? 'bg-teal-500/20 scale-110' : 'bg-brand-sage/20 dark:bg-white/5'}`}>
                            <Upload className={`w-8 h-8 ${isDragging ? 'text-teal-400' : 'text-brand-leaf dark:text-teal-400'}`} strokeWidth={1.5} />
                        </div>
                        <h3 className="text-base font-bold text-brand-text dark:text-white mb-1">
                            {t('maTitle')}
                        </h3>
                        <p className="text-xs text-brand-gray max-w-[240px] leading-relaxed">
                            {t('maDrop')}
                        </p>
                        <div className="mt-4 flex items-center gap-2 text-[10px] font-bold tracking-widest text-brand-gray/60 uppercase">
                            <span>PDF</span>
                            <span className="w-1 h-1 rounded-full bg-brand-gray/30" />
                            <span>JPG</span>
                            <span className="w-1 h-1 rounded-full bg-brand-gray/30" />
                            <span>PNG</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
