import React from 'react';
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import Sidebar from '@/components/dashboard/Sidebar';
import { Wallet, Gift, ArrowRightLeft, Clock, Info } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import ReferralButton from '@/components/dashboard/ReferralButton';
import CheckoutButton from '@/components/dashboard/CheckoutButton';
import ReferralInfo from '@/components/dashboard/ReferralInfo';
import UpgradeButton from '@/components/dashboard/UpgradeButton';

export default async function WalletPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations('Wallet');
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
        return <div className="p-8">Please log in</div>;
    }

    const user = await prisma.user.findUnique({
        where: { email: authUser.email || undefined },
        include: {
            transactions: { orderBy: { created_at: 'desc' }, take: 10 },
            referees: { include: { transactions: true } } // Simplified
        }
    });

    if (!user) {
         return <div className="p-8">User not found</div>;
    }

    const balance = Number(user.balance || 0);

    return (
        <div className="min-h-screen flex w-full bg-[#F7F5F0] dark:bg-[#0F172A] text-[#2D2D2D] dark:text-white font-sans relative pb-24">
            <Sidebar role="client" profileName={user.full_name || t('userFallback')} />

            <main className="flex-1 lg:ml-64 px-4 md:px-8 pt-8 space-y-6 w-full max-w-4xl mx-auto min-w-0">
                <header className="space-y-2">
                    <h1 className="font-serif text-3xl font-bold tracking-tight">{t('title')}</h1>
                    <p className="text-slate-500 text-sm">{t('subtitle')}</p>
                </header>

                {/* Balance Card */}
                <section className="bg-gradient-to-br from-[#60B76F] to-emerald-700 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
                    <div className="relative z-10 flex flex-col items-center justify-center py-4">
                        <p className="text-emerald-100 font-medium uppercase tracking-wider text-sm mb-1">{t('available')}</p>
                        <h2 className="text-5xl md:text-6xl font-bold flex items-center gap-2">
                            {balance.toFixed(0)} <span className="text-2xl md:text-3xl font-normal opacity-80">₽</span>
                        </h2>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-6">
                        <button className="bg-white/20 hover:bg-white/30 backdrop-blur-md transition-colors py-3 px-4 rounded-2xl flex items-center justify-center gap-2 font-medium">
                            <Gift size={18} />
                            <span>{t('giftPro')}</span>
                        </button>
                        <button className="bg-white text-[#60B76F] hover:bg-emerald-50 transition-colors py-3 px-4 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-sm">
                            <ArrowRightLeft size={18} />
                            <span>{t('extendSub')}</span>
                        </button>
                    </div>
                </section>

                {/* Active Subscription Status */}
                {user.subscription_expires_at && user.subscription_expires_at > new Date() && (
                    <section className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <span className={(user.role === 'PRO' || user.role === 'admin') ? "text-[#60B76F]" : "text-slate-700 dark:text-slate-300"}>
                                    {t('activeSub')}: {
                                        user.role === 'PRO' ? t('proPlan') : 
                                        user.role === 'admin' ? t('proAdmin') : 
                                        user.role === 'employee' ? t('proEmployee') : 
                                        t('standardPlan')
                                    }
                                </span>
                            </h3>
                            <p className="text-slate-500 text-sm mt-1">
                                {t('validUntil')}: {new Date(user.subscription_expires_at).toLocaleDateString()}
                            </p>
                        </div>
                        {user.role !== 'PRO' && user.role !== 'employee' && user.role !== 'admin' && (
                            <UpgradeButton currentPlan={user.role} />
                        )}
                    </section>
                )}

                {/* Subscriptions */}
                <section className="space-y-4 pt-2">
                    <h3 className="font-bold text-xl flex items-center gap-2">
                        🌟 {t('subscriptions')}
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                        {/* Base Tier */}
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm flex flex-col justify-between">
                            <div>
                                <h4 className="font-bold text-lg text-slate-700 dark:text-slate-300">{t('standardPlan')}</h4>
                                <p className="text-2xl font-bold my-2">9.90 ₽ <span className="text-sm font-normal text-slate-400">{t('perMonth')}</span></p>
                                <ul className="text-sm space-y-2 mt-4 text-slate-600 dark:text-slate-400">
                                    <li className="flex items-center gap-2">✔️ {t('featurePhotoVoice')}</li>
                                    <li className="flex items-center gap-2">✔️ {t('featureDashboard')}</li>
                                    <li className="flex items-center gap-2">✔️ {t('featureMarathons')}</li>
                                    <li className="flex items-center gap-2">✔️ {t('featureVitamins')}</li>
                                    <li className="flex items-center gap-2 opacity-50">❌ {t('featureOrganization')}</li>
                                    <li className="flex items-center gap-2 opacity-50">❌ {t('featureAdvice')}</li>
                                    <li className="flex items-center gap-2 opacity-50">❌ {t('featureAnalysis')}</li>
                                    <li className="flex items-center gap-2 opacity-50">❌ {t('featureAI')}</li>
                                </ul>
                            </div>
                            <CheckoutButton 
                                plan="Standard" 
                                amount={9.90}
                                className="mt-6 w-full py-2.5 rounded-xl font-bold text-white bg-slate-600 hover:bg-slate-700 transition-colors shadow-lg"
                            >
                                {t('orderStandard')}
                            </CheckoutButton>
                        </div>

                        {/* PRO Tier */}
                        <div className="bg-gradient-to-b from-[#60B76F]/10 to-transparent dark:from-emerald-900/20 p-5 rounded-3xl border-2 border-[#60B76F] shadow-md flex flex-col justify-between relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-[#60B76F] text-white text-[10px] font-bold uppercase py-1 px-3 rounded-bl-xl">{t('hit')}</div>
                            <div>
                                <h4 className="font-bold text-lg text-[#60B76F]">{t('proPlan')}</h4>
                                <p className="text-2xl font-bold my-2">14.90 ₽ <span className="text-sm font-normal text-slate-400">{t('perMonth')}</span></p>
                                <ul className="text-sm space-y-2 mt-4 text-slate-700 dark:text-slate-300">
                                    <li className="flex items-center gap-2">✔️ {t('featurePhotoVoice')}</li>
                                    <li className="flex items-center gap-2">✔️ {t('featureDashboard')}</li>
                                    <li className="flex items-center gap-2">✔️ {t('featureMarathons')}</li>
                                    <li className="flex items-center gap-2">✔️ {t('featureVitamins')}</li>
                                    <li className="flex items-center gap-2">✔️ <span className="font-bold">{t('featureOrganization')}</span> <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">{t('new')}</span></li>
                                    <li className="flex items-center gap-2">✔️ <span className="font-bold">{t('featureAdvice')}</span> <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">{t('new')}</span></li>
                                    <li className="flex items-center gap-2">✔️ <span className="font-bold">{t('featureAnalysis')}</span> <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">{t('new')}</span></li>
                                    <li className="flex items-center gap-2">✔️ <span className="text-[#60B76F] font-bold">{t('featureAI')}</span></li>
                                </ul>
                            </div>
                            <CheckoutButton 
                                plan="PRO" 
                                amount={14.90}
                                className="mt-6 w-full py-2.5 rounded-xl font-bold text-white bg-[#60B76F] hover:bg-emerald-600 transition-colors shadow-lg shadow-[#60B76F]/30"
                            >
                                {t('orderPro')}
                            </CheckoutButton>
                        </div>
                    </div>
                </section>

                {/* Referral Info */}
                <section className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm">
                    <div className="flex gap-4 items-start">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl text-blue-500">
                            <Users size={24} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="font-bold text-lg">{t('referralTitle')}</h3>
                                <ReferralInfo />
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 leading-relaxed">
                                {t('referralDesc')}
                            </p>
                            <ReferralButton userId={user.id} />
                        </div>
                    </div>
                </section>

                {/* Transactions */}
                <section className="space-y-4 pt-4">
                    <h3 className="font-bold text-xl flex items-center gap-2">
                        <Clock size={20} className="text-slate-400" /> 
                        {t('history')}
                    </h3>
                    
                    <div className="space-y-2">
                        {user.transactions.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 bg-white/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-white/5">
                                {t('emptyHistory')}
                            </div>
                        ) : (
                            user.transactions.map((tx: any) => (
                                <div key={tx.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-white/5 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl ${Number(tx.amount) > 0 ? 'bg-green-50 text-green-500 dark:bg-green-900/30' : 'bg-slate-50 text-slate-500 dark:bg-slate-700'}`}>
                                            {Number(tx.amount) > 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm md:text-base">{tx.description || tx.type}</p>
                                            <p className="text-[10px] text-slate-400">{new Date(tx.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className={`font-bold ${Number(tx.amount) > 0 ? 'text-green-500' : ''}`}>
                                        {Number(tx.amount) > 0 ? '+' : ''}{Number(tx.amount).toFixed(0)} ₽
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

            </main>
        </div>
    );
}

import { ArrowDownLeft, ArrowUpRight, Users, Copy } from 'lucide-react';
