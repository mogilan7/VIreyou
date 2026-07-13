import PublicNavbar from "@/components/layout/PublicNavbar";
import PublicFooter from "@/components/layout/PublicFooter";
import {
    Zap, Hourglass, Activity,
    Moon,
    Brain,
    HeartPulse,
    GlassWater,
    ShieldAlert,
    FileText,
    Lock,
    Check,
    Cigarette,
    BrainCircuit,
    ClipboardList,
    Crown
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";

export default async function DiagnosticsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations('Diagnostics');

    // Server-side subscription check
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    let hasActiveSubscription = false;
    if (authUser?.email) {
        const user = await prisma.user.findUnique({
            where: { email: authUser.email },
            select: { subscription_expires_at: true, role: true, created_at: true }
        });
        if (user) {
            const isAdmin = user.role === 'admin' || user.role === 'employee';
            const hasValidSub = user.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();
            const daysSinceCreated = user.created_at
                ? (Date.now() - new Date(user.created_at).getTime()) / (1000 * 3600 * 24)
                : 999;
            const isTrial = daysSinceCreated <= 3;
            hasActiveSubscription = isAdmin || !!hasValidSub || isTrial;
        }
    }

    const pricingUrl = `/${locale}/pricing`;

    return (
        <div className="bg-brand-bg min-h-screen pt-32 pb-0 flex flex-col">
            <PublicNavbar />

            <main className="flex-grow max-w-6xl mx-auto px-6 w-full mb-32">
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E8F1EB] text-brand-leaf text-[10px] uppercase font-bold tracking-widest rounded-full mb-6">
                        <Activity size={12} />
                        {t('tag')}
                    </div>
                    <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-brand-text mb-6">
                        {t('title1')} <span className="text-brand-leaf italic font-light">{t('title2')}</span>
                    </h1>
                    <p className="text-brand-gray text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
                        {t('desc')}
                    </p>
                </div>

                {/* Free Assessments */}
                <div className="mb-20">
                    <h2 className="flex items-center gap-3 text-lg font-bold text-brand-text mb-8">
                        <div className="bg-[#E8F1EB] p-1.5 rounded-full"><Zap size={16} className="text-brand-leaf" fill="currentColor" /></div>
                        {t('freeTitle')}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Link href="/diagnostics/energy" className="block outline-none">
                            <div className="bg-white rounded-3xl p-8 border border-brand-sage/40 hover:shadow-md transition-shadow relative overflow-hidden group h-full flex flex-col">
                                <div className="absolute -right-8 -top-8 text-brand-sage/20 group-hover:text-brand-sage transition-colors">
                                    <Activity size={120} strokeWidth={1} />
                                </div>
                                <div className="w-10 h-10 bg-[#E8F1EB] rounded-full flex items-center justify-center mb-6">
                                    <Zap size={18} className="text-brand-leaf" fill="currentColor" />
                                </div>
                                <h3 className="font-bold text-xl text-brand-text mb-3">{t('t1Title')}</h3>
                                <p className="text-brand-gray text-sm mb-8 leading-relaxed pr-8">
                                    {t('t1Desc')}
                                </p>
                                <div className="text-brand-leaf text-sm font-bold w-fit flex items-center gap-2 group-hover:text-brand-forest transition-colors mt-auto">
                                    {t('btnT1')} <span className="text-lg leading-none">&rarr;</span>
                                </div>
                            </div>
                        </Link>

                        <Link href="/diagnostics/bio-age" className="block outline-none">
                            <div className="bg-white rounded-3xl p-8 border border-brand-sage/40 hover:shadow-md transition-shadow relative overflow-hidden group h-full flex flex-col">
                                <div className="absolute -right-8 -top-8 text-brand-sage/20 group-hover:text-brand-sage transition-colors">
                                    <Hourglass size={120} strokeWidth={1} />
                                </div>
                                <div className="w-10 h-10 bg-[#E8F1EB] rounded-full flex items-center justify-center mb-6">
                                    <Hourglass size={18} className="text-brand-leaf" />
                                </div>
                                <h3 className="font-bold text-xl text-brand-text mb-3">{t('t2Title')}</h3>
                                <p className="text-brand-gray text-sm mb-8 leading-relaxed pr-8">
                                    {t('t2Desc')}
                                </p>
                                <div className="text-brand-leaf text-sm font-bold w-fit flex items-center gap-2 group-hover:text-brand-forest transition-colors mt-auto">
                                    {t('btnT2')} <span className="text-lg leading-none">&rarr;</span>
                                </div>
                            </div>
                        </Link>
                    </div>
                </div>

                {/* Premium Suite */}
                <div>
                    <div className="flex justify-between items-center mb-8 border-t border-brand-sage/50 pt-16">
                        <h2 className="flex items-center gap-3 text-lg font-bold text-brand-text">
                            <div className="bg-orange-50 p-1.5 rounded-full"><Lock size={16} className="text-orange-400" /></div>
                            {t('premTitle')}
                        </h2>
                        <div className="bg-orange-50 text-orange-600 text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full">
                            {t('premBadge')}
                        </div>
                    </div>

                    {/* Locked banner for non-subscribers */}
                    {!hasActiveSubscription && (
                        <div className="mb-8 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <div className="flex-shrink-0 bg-orange-100 p-3 rounded-xl">
                                <Crown size={24} className="text-orange-500" />
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-brand-text text-sm mb-1">{t('lockTitle')}</p>
                                <p className="text-brand-gray text-xs leading-relaxed">{t('lockDesc')}</p>
                            </div>
                            <Link
                                href={pricingUrl}
                                className="flex-shrink-0 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-5 py-2.5 rounded-full transition-colors whitespace-nowrap shadow-sm"
                            >
                                {t('lockBtn')}
                            </Link>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
                        {[
                            { href: "/diagnostics/score", icon: <ShieldAlert size={20} className="fill-brand-leaf/20" />, title: t('p1Title'), desc: t('p1Desc') },
                            { href: "/diagnostics/mini-cog", icon: <Brain size={20} className="fill-brand-leaf/20" />, title: t('p2Title'), desc: t('p2Desc') },
                            { href: "/diagnostics/circadian", icon: <Activity size={20} className="fill-brand-leaf/20" />, title: t('p3Title'), desc: t('p3Desc') },
                            { href: "/diagnostics/insomnia", icon: <Moon size={20} className="fill-brand-leaf/20" />, title: t('p4Title'), desc: t('p4Desc') },
                            { href: "/diagnostics/alcohol", icon: <GlassWater size={20} className="fill-brand-leaf/20" />, title: t('p5Title'), desc: t('p5Desc') },
                            { href: "/diagnostics/nicotine", icon: <Cigarette size={20} className="fill-brand-leaf/20" />, title: t('p6Title'), desc: t('p6Desc') },
                            { href: "/diagnostics/sarc-f", icon: <Activity size={20} className="fill-brand-leaf/20" />, title: t('p7Title'), desc: t('p7Desc') },
                            { href: "/diagnostics/systemic-bio-age", icon: <Hourglass size={20} className="fill-brand-leaf/20" />, title: t('p8Title'), desc: t('p8Desc') },
                            { href: "/diagnostics/greene-scale", icon: <BrainCircuit size={20} className="fill-brand-leaf/20" />, title: t('p9Title'), desc: t('p9Desc') },
                            { href: "/diagnostics/ipss", icon: <ClipboardList size={20} className="fill-brand-leaf/20" />, title: t('p10Title'), desc: t('p10Desc') },
                            { href: "/diagnostics/mief-5", icon: <HeartPulse size={20} className="fill-brand-leaf/20" />, title: t('p11Title'), desc: t('p11Desc') },
                        ].map((card) => (
                            hasActiveSubscription ? (
                                /* UNLOCKED — clickable card */
                                <Link key={card.href} href={card.href} className="block outline-none">
                                    <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 border border-brand-sage/60 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md cursor-pointer group h-full flex flex-col">
                                        <div className="mb-4 text-brand-leaf group-hover:text-brand-forest transition-colors">{card.icon}</div>
                                        <h4 className="font-bold text-sm text-brand-text mb-2">{card.title}</h4>
                                        <p className="text-brand-gray text-xs leading-relaxed mb-6">{card.desc}</p>
                                        <div className="mt-auto flex items-center gap-1.5 text-[10px] text-brand-leaf tracking-widest font-bold uppercase">
                                            {t('evalText')}
                                        </div>
                                    </div>
                                </Link>
                            ) : (
                                /* LOCKED — non-clickable with overlay */
                                <Link key={card.href} href={pricingUrl} className="block outline-none group">
                                    <div className="relative bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-orange-100 shadow-sm h-full flex flex-col overflow-hidden transition-all hover:-translate-y-1 hover:shadow-md">
                                        {/* Blur overlay */}
                                        <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 rounded-2xl flex flex-col items-center justify-center gap-2">
                                            <div className="bg-orange-100 p-2 rounded-full">
                                                <Lock size={16} className="text-orange-500" />
                                            </div>
                                            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest text-center px-2">
                                                {t('lckText')}
                                            </span>
                                        </div>
                                        {/* Blurred content behind */}
                                        <div className="mb-4 text-brand-leaf/50">{card.icon}</div>
                                        <h4 className="font-bold text-sm text-brand-text/50 mb-2">{card.title}</h4>
                                        <p className="text-brand-gray/40 text-xs leading-relaxed mb-6">{card.desc}</p>
                                        <div className="mt-auto flex items-center gap-1.5 text-[10px] text-brand-leaf/40 tracking-widest font-bold uppercase">
                                            {t('evalText')}
                                        </div>
                                    </div>
                                </Link>
                            )
                        ))}
                    </div>

                    {/* Bottom Deep Dive Banner */}
                    <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-brand-sage/40 flex flex-col md:flex-row items-center gap-12 overflow-hidden relative shadow-sm">
                        <div className="flex-1 z-10">
                            <div className="inline-flex items-center px-3 py-1 bg-[#E8F1EB] text-brand-leaf text-[10px] uppercase font-bold tracking-widest rounded-full mb-6 relative">
                                <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-0.5 bg-brand-leaf/30"></div>
                                {t('deepTag')}
                            </div>
                            <h2 className="font-serif text-3xl md:text-5xl text-brand-text mb-6">{t('deepTitle')}</h2>
                            <p className="text-brand-gray text-sm leading-relaxed mb-8 max-w-sm">
                                {t('deepDesc')}
                            </p>
                            <div className="flex flex-wrap gap-4">
                                <button className="bg-brand-leaf hover:bg-brand-leaf-light text-white px-6 py-3 rounded-full font-medium transition-colors text-sm flex items-center gap-2 shadow-sm">
                                    {t('btnDeep1')} <FileText size={16} />
                                </button>
                                <button className="bg-white border text-sm border-brand-sage hover:border-brand-leaf text-brand-text px-6 py-3 rounded-full font-medium transition-colors shadow-sm">
                                    {t('btnDeep2')}
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 h-[400px] w-full relative rounded-2xl overflow-hidden shadow-xl mt-8 md:mt-0">
                            <div className="absolute inset-0 bg-brand-forest/5 mix-blend-multiply z-10 rounded-2xl"></div>
                            <img
                                src="/hero-specialist.png"
                                className="w-full h-full object-cover object-[center_top] rounded-2xl"
                                alt="Valentina Specialist"
                            />
                            {/* Badge overlay over image */}
                            <div className="absolute bottom-6 right-6 z-20 bg-white/90 backdrop-blur-md px-4 py-3 rounded-xl shadow-lg border border-white flex items-center gap-3">
                                <div className="bg-brand-leaf p-1.5 rounded-full"><Check size={12} className="text-white" strokeWidth={3} /></div>
                                <div>
                                    <p className="text-[10px] text-brand-text font-bold mb-0.5">{t('badge1')}</p>
                                    <p className="text-[9px] text-brand-gray">{t('badge2')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <PublicFooter />
        </div>
    );
}
