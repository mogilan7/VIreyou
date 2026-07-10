'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { updateUserPassword } from '../login/actions/auth';
import { Lock, AlertCircle, CheckCircle, ShieldCheck, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function UpdatePasswordPage() {
    const t = useTranslations('Auth');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg(null);
        setSuccessMsg(null);

        const formData = new FormData();
        formData.append('password', password);

        try {
            const res = await updateUserPassword(formData);
            if (res?.error) {
                setErrorMsg(res.error);
            } else if (res?.success) {
                setSuccessMsg(t('updatePasswordSuccess'));
            }
        } catch (err: unknown) {
            setErrorMsg(t('errorUnknown'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4 pt-24 font-sans text-brand-text">
            <div className="max-w-md w-full">

                <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm border border-brand-sage/20 mb-6 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-brand-forest/5 mix-blend-multiply transition-opacity group-hover:opacity-50"></div>
                        <ShieldCheck className="w-8 h-8 text-brand-leaf relative z-10" strokeWidth={1.5} />
                    </div>
                    <h1 className="text-3xl font-serif font-bold tracking-tight mb-2 text-brand-text">{t('updatePasswordTitle')}</h1>
                    <p className="text-brand-gray/80 text-sm max-w-xs mx-auto leading-relaxed">{t('updatePasswordSubtitle')}</p>
                </div>

                <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-xl shadow-brand-sage/5 border border-brand-sage/20 p-8 md:p-10 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-leaf to-brand-forest"></div>

                    {errorMsg && (
                        <div className="mb-6 p-4 bg-red-50/50 text-red-600 rounded-2xl border border-red-100 flex items-start gap-3 text-sm animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <p>{errorMsg}</p>
                        </div>
                    )}

                    {successMsg && (
                        <div className="mb-6 p-4 bg-brand-sage/10 text-brand-forest rounded-2xl border border-brand-sage/20 flex items-start gap-3 text-sm animate-in fade-in slide-in-from-top-2">
                            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-brand-leaf" />
                            <p>{successMsg}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-brand-forest uppercase tracking-widest pl-1">{t('newPasswordLabel')}</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray/40" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={t('newPasswordPlaceholder')}
                                    required
                                    className="w-full bg-[#FAFAFA] border-2 border-transparent focus:border-brand-leaf/30 focus:bg-white rounded-2xl py-3.5 pl-12 pr-12 outline-none transition-all placeholder:text-brand-gray/40 text-brand-text font-medium"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-gray/40 hover:text-brand-forest transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !!successMsg}
                            className={`w-full bg-brand-forest hover:bg-[#233A2D] text-white py-4 rounded-2xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 mt-4 active:scale-[0.98] ${loading || !!successMsg ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {t('updatePasswordBtn')}
                            {!loading && <ArrowRight className="w-5 h-5" />}
                        </button>
                    </form>
                    
                    {successMsg && (
                        <div className="mt-8 text-center border-t border-brand-sage/20 pt-6">
                            <a href="/login" className="text-sm text-brand-forest hover:text-brand-leaf font-medium border-b border-transparent hover:border-brand-leaf pb-0.5 transition-colors">
                                {t('backToLogin')}
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
