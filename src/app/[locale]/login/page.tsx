'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { login, signup } from './actions/auth';
import { Mail, Lock, AlertCircle, ArrowRight, ShieldCheck, CheckCircle } from 'lucide-react';

export default function LoginPage() {
    const t = useTranslations('Auth');
    const locale = useLocale();

    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg(null);
        setSuccessMsg(null);

        const formData = new FormData();
        formData.append('email', email);
        formData.append('password', password);

        try {
            if (isLogin) {
                const res = await login(formData, locale);
                if (res?.error) {
                    // If it's a technical error like "fetch failed", show it directly
                    if (res.error.toLowerCase().includes('fetch') || res.error.includes('network')) {
                        setErrorMsg(res.error);
                    } else {
                        setErrorMsg(t('errorInvalidLogin'));
                    }
                }
            } else {
                const res = await signup(formData);
                if (res?.error) {
                    setErrorMsg(res.error === 'User already registered' ? t('errorRegisterFailed') : res.error);
                } else if (res?.success) {
                    setSuccessMsg(t('successRegister'));
                    setIsLogin(true);
                }
            }
        } catch (err: unknown) {
            const error = err as Error;
            // Next.js redirect throws an error, we should not catch it as a real error
            if (error.message === 'NEXT_REDIRECT') throw error;
            setErrorMsg(t('errorUnknown'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4 pt-24 font-sans text-brand-text">
            <div className="max-w-md w-full">

                {/* Logo Area */}
                <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm border border-brand-sage/20 mb-6 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-brand-forest/5 mix-blend-multiply transition-opacity group-hover:opacity-50"></div>
                        <ShieldCheck className="w-8 h-8 text-brand-leaf relative z-10" strokeWidth={1.5} />
                    </div>
                    <h1 className="text-3xl font-serif font-bold tracking-tight mb-2 text-brand-text">{t('title')}</h1>
                    <p className="text-brand-gray/80 text-sm max-w-xs mx-auto leading-relaxed">{t('subtitle')}</p>
                </div>

                {/* Main Card */}
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
                            <label className="text-sm font-bold text-brand-forest uppercase tracking-widest pl-1">{t('email')}</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray/40" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder={t('emailPlaceholder')}
                                    required
                                    className="w-full bg-[#FAFAFA] border-2 border-transparent focus:border-brand-leaf/30 focus:bg-white rounded-2xl py-3.5 pl-12 pr-4 outline-none transition-all placeholder:text-brand-gray/40 text-brand-text font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-brand-forest uppercase tracking-widest pl-1">{t('password')}</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray/40" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={t('passwordPlaceholder')}
                                    required
                                    className="w-full bg-[#FAFAFA] border-2 border-transparent focus:border-brand-leaf/30 focus:bg-white rounded-2xl py-3.5 pl-12 pr-4 outline-none transition-all placeholder:text-brand-gray/40 text-brand-text font-medium"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full bg-brand-forest hover:bg-[#233A2D] text-white py-4 rounded-2xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 mt-4 active:scale-[0.98] ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {loading ? (isLogin ? t('loggingIn') : t('registering')) : (isLogin ? t('loginBtn') : t('registerBtn'))}
                            {!loading && <ArrowRight className="w-5 h-5" />}
                        </button>
                    </form>

                    <div className="mt-8 text-center border-t border-brand-sage/20 pt-6">
                        <button
                            type="button"
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setErrorMsg(null);
                                setSuccessMsg(null);
                            }}
                            className="text-sm text-brand-gray hover:text-brand-forest transition-colors font-medium border-b border-transparent hover:border-brand-forest pb-0.5"
                        >
                            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                        </button>
                    </div>
                </div>

                <p className="text-center text-xs text-brand-gray/40 mt-8">
                    Secure & Encrypted Platform
                </p>
            </div>
        </div>
    );
}
