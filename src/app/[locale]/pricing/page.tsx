import PublicNavbar from "@/components/layout/PublicNavbar";
import PublicFooter from "@/components/layout/PublicFooter";
import { Check, X, Diamond } from "lucide-react";
import { useTranslations } from "next-intl";

export default function PricingPage() {
    const t = useTranslations('Pricing');

    return (
        <div className="bg-brand-bg min-h-screen pt-32 pb-0 flex flex-col">
            <PublicNavbar />

            <main className="flex-grow max-w-5xl mx-auto px-6 w-full mb-32">
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E8F1EB] text-brand-leaf text-[10px] uppercase font-bold tracking-widest rounded-full mb-6">
                        <Diamond size={12} fill="currentColor" />
                        {t('tag')}
                    </div>
                    <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-brand-text mb-6">
                        {t('title1')} <span className="text-brand-leaf italic font-light">{t('title2')}</span>
                    </h1>
                    <p className="text-brand-gray text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
                        {t('desc')}
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 max-w-4xl mx-auto">

                    {/* Essential Target */}
                    <div className="bg-white rounded-[2rem] p-10 shadow-sm border border-brand-sage/30 flex flex-col">
                        <h3 className="font-serif text-2xl font-bold text-brand-text mb-2">{t('essentialTitle')}</h3>
                        <p className="text-brand-gray text-xs leading-relaxed mb-6">
                            {t('essentialDesc')}
                        </p>

                        <div className="mb-8">
                            <span className="text-4xl font-bold text-brand-text">€150</span>
                            <span className="text-brand-gray text-xs font-semibold ml-2">{t('session')}</span>
                        </div>

                        <ul className="space-y-4 mb-10 flex-grow">
                            <li className="flex items-center gap-3 text-sm text-brand-gray-dark">
                                <Check size={18} className="text-brand-leaf flex-shrink-0" />
                                {t('eF1')}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-gray-dark">
                                <Check size={18} className="text-brand-leaf flex-shrink-0" />
                                {t('eF2')}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-gray-dark">
                                <Check size={18} className="text-brand-leaf flex-shrink-0" />
                                {t('eF3')}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-gray/40">
                                <X size={18} className="text-brand-gray/40 flex-shrink-0" />
                                {t('eF4')}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-gray/40">
                                <X size={18} className="text-brand-gray/40 flex-shrink-0" />
                                {t('eF5')}
                            </li>
                        </ul>

                        <button className="w-full py-3.5 rounded-full border border-brand-sage text-brand-text font-medium text-sm hover:border-brand-leaf transition-colors text-center shadow-sm">
                            {t('btnEssential')}
                        </button>
                    </div>

                    {/* Premium Target */}
                    <div className="bg-white rounded-[2rem] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-2 border-brand-leaf relative flex flex-col">
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-leaf text-white text-[10px] uppercase font-bold tracking-widest px-4 py-1.5 rounded-full whitespace-nowrap">
                            {t('recBadge')}
                        </div>

                        <div className="w-10 h-10 bg-[#E8F1EB] rounded-full flex items-center justify-center mb-6">
                            <Diamond size={16} className="text-brand-leaf" fill="currentColor" />
                        </div>

                        <h3 className="font-serif text-2xl font-bold text-brand-leaf mb-2">{t('premiumTitle')}</h3>
                        <p className="text-brand-gray text-xs leading-relaxed mb-6">
                            {t('premiumDesc')}
                        </p>

                        <div className="mb-8">
                            <span className="text-4xl font-bold text-brand-text">€350</span>
                            <span className="text-brand-gray text-xs font-semibold ml-2">{t('month')}</span>
                        </div>

                        <ul className="space-y-4 mb-10 flex-grow">
                            <li className="flex items-center gap-3 text-sm text-brand-text font-medium">
                                <div className="bg-brand-leaf/20 p-0.5 rounded-full"><Check size={14} className="text-brand-leaf" strokeWidth={3} /></div>
                                {t('pF1')}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-text font-medium">
                                <div className="bg-brand-leaf/20 p-0.5 rounded-full"><Check size={14} className="text-brand-leaf" strokeWidth={3} /></div>
                                {t('pF2')}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-text font-medium">
                                <div className="bg-brand-leaf/20 p-0.5 rounded-full"><Check size={14} className="text-brand-leaf" strokeWidth={3} /></div>
                                {t('pF3')}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-text font-medium">
                                <div className="bg-brand-leaf/20 p-0.5 rounded-full"><Check size={14} className="text-brand-leaf" strokeWidth={3} /></div>
                                {t('pF4')}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-text font-medium">
                                <div className="bg-brand-leaf/20 p-0.5 rounded-full"><Check size={14} className="text-brand-leaf" strokeWidth={3} /></div>
                                {t('pF5')}
                            </li>
                        </ul>

                        <button className="w-full py-3.5 rounded-full bg-brand-leaf hover:bg-brand-leaf-light text-white font-medium text-sm transition-colors text-center shadow-md shadow-brand-leaf/20">
                            {t('btnPremium')}
                        </button>
                    </div>

                </div>

                {/* FAQ Section */}
                <div className="mt-32 max-w-2xl mx-auto">
                    <div className="text-center mb-10">
                        <h2 className="font-serif text-3xl text-brand-text mb-4">{t('faqTitle')}</h2>
                        <p className="text-brand-gray text-sm">{t('faqDesc')}</p>
                    </div>

                    <div className="space-y-4">
                        {[t('q1'), t('q2'), t('q3')].map((q, i) => (
                            <div key={i} className="bg-white px-6 py-5 rounded-xl border border-brand-sage/40 flex justify-between items-center cursor-pointer hover:border-brand-leaf/50 transition-colors">
                                <span className="font-bold text-sm text-brand-text">{q}</span>
                                <span className="text-brand-leaf ml-4">›</span>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            <PublicFooter />
        </div>
    );
}

