"use client";

import PublicNavbar from "@/components/layout/PublicNavbar";
import PublicFooter from "@/components/layout/PublicFooter";
import { Check, X, Diamond, ChevronDown } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";
import CheckoutButton from "@/components/dashboard/CheckoutButton";

function FaqItem({ question, answer }: { question: string; answer: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div
            className="bg-white px-6 py-5 rounded-xl border border-brand-sage/40 cursor-pointer hover:border-brand-leaf/50 transition-colors"
            onClick={() => setOpen(!open)}
        >
            <div className="flex justify-between items-center gap-4">
                <span className="font-bold text-sm text-brand-text">{question}</span>
                <ChevronDown
                    size={18}
                    className={`text-brand-leaf flex-shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
                />
            </div>
            {open && (
                <p className="mt-3 text-sm text-brand-gray leading-relaxed border-t border-brand-sage/30 pt-3">
                    {answer}
                </p>
            )}
        </div>
    );
}

function Feature({ included, text }: { included: boolean, text: string }) {
    return (
        <li className={`flex items-start gap-3 text-sm ${included ? 'text-brand-gray-dark' : 'text-brand-gray/40'}`}>
            {included ? (
                <div className="bg-brand-leaf/10 p-0.5 rounded-full mt-0.5"><Check size={14} className="text-brand-leaf" strokeWidth={3} /></div>
            ) : (
                <X size={18} className="text-brand-gray/40 flex-shrink-0 mt-0.5" />
            )}
            <span className={`${included ? 'font-medium' : 'line-through'}`}>{text}</span>
        </li>
    );
}

export default function PricingPage() {
    const t = useTranslations("Pricing");
    const tCommon = useTranslations("Common");
    const locale = useLocale();
    const isRu = locale === "ru";

    // Contact link — Telegram channel or contact section
    const contactHref = isRu ? "https://t.me/VI_Beautylife" : "/#contact";

    return (
        <div className="bg-brand-bg min-h-screen pt-32 pb-0 flex flex-col">
            <PublicNavbar />

            <main className="flex-grow max-w-[90rem] mx-auto px-6 w-full mb-32">
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E8F1EB] text-brand-leaf text-[10px] uppercase font-bold tracking-widest rounded-full mb-6">
                        <Diamond size={12} fill="currentColor" />
                        {t("tag")}
                    </div>
                    <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-brand-text mb-6">
                        {t("title1")} <span className="text-brand-leaf italic font-light">{t("title2")}</span>
                    </h1>
                    <p className="text-brand-gray text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
                        {t("desc")}
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 max-w-7xl mx-auto">
                    
                    {/* Assistant Standard */}
                    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-brand-sage/30 flex flex-col h-full">
                        <div className="min-h-[80px]">
                            <h3 className="font-serif text-2xl font-bold text-brand-text mb-2">{t("assistantStandardTitle")}</h3>
                            <p className="text-brand-gray text-xs leading-relaxed">
                                {t("assistantStandardDesc")}
                            </p>
                        </div>

                        <div className="my-6">
                            <span className="text-4xl font-bold text-brand-text">{t("assistantStandardPrice")}</span>
                            <span className="text-brand-gray text-xs font-semibold ml-2">{t("month")}</span>
                        </div>

                        <ul className="space-y-4 mb-10 flex-grow">
                            <Feature included={true} text={t("f1")} />
                            <Feature included={true} text={t("f2")} />
                            <Feature included={true} text={t("f3")} />
                            <Feature included={false} text={t("f4")} />
                            <Feature included={false} text={t("f5")} />
                            <Feature included={false} text={t("f6")} />
                            <Feature included={false} text={t("f7")} />
                        </ul>

                        <CheckoutButton plan="Standard" amount={locale === "en" ? 7 : 495} className="w-full py-3.5 mt-auto rounded-full border border-brand-sage text-brand-text font-medium text-sm hover:border-brand-leaf hover:text-brand-leaf transition-colors text-center shadow-sm block">{t("btnAssistantStandard")}</CheckoutButton>
                    </div>

                    {/* Assistant PRO */}
                    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-brand-sage/30 flex flex-col h-full relative">
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[10px] uppercase font-bold tracking-widest px-4 py-1.5 rounded-full whitespace-nowrap">
                            PRO
                        </div>
                        <div className="min-h-[80px]">
                            <h3 className="font-serif text-2xl font-bold text-brand-text mb-2">{t("assistantProTitle")}</h3>
                            <p className="text-brand-gray text-xs leading-relaxed">
                                {t("assistantProDesc")}
                            </p>
                        </div>

                        <div className="my-6">
                            <span className="text-4xl font-bold text-brand-text">{t("assistantProPrice")}</span>
                            <span className="text-brand-gray text-xs font-semibold ml-2">{t("month")}</span>
                        </div>

                        <ul className="space-y-4 mb-10 flex-grow">
                            <Feature included={true} text={t("f1") + " " + t("f1_adv")} />
                            <Feature included={true} text={t("f2")} />
                            <Feature included={true} text={t("f3")} />
                            <Feature included={false} text={t("f4")} />
                            <Feature included={false} text={t("f5")} />
                            <Feature included={false} text={t("f6")} />
                            <Feature included={false} text={t("f7")} />
                        </ul>
                        
                        <CheckoutButton plan="PRO" amount={locale === "en" ? 15 : 745} className="w-full py-3.5 mt-auto rounded-full border border-blue-500 text-blue-600 font-medium text-sm hover:bg-blue-50 transition-colors text-center shadow-sm block">{t("btnAssistantPro")}</CheckoutButton>
                    </div>

                    {/* Essential */}
                    <div className="bg-white rounded-[2rem] p-8 lg:p-10 shadow-sm border border-brand-sage/30 flex flex-col h-full">
                        <div className="min-h-[80px]">
                            <h3 className="font-serif text-2xl font-bold text-brand-text mb-2">{t("essentialTitle")}</h3>
                            <p className="text-brand-gray text-xs leading-relaxed">
                                {t("essentialDesc")}
                            </p>
                        </div>

                        <div className="my-6">
                            <span className="text-4xl font-bold text-brand-text">{t("essentialPrice")}</span>
                            <span className="text-brand-gray text-xs font-semibold ml-2">{t("session")}</span>
                        </div>

                        <ul className="space-y-4 mb-10 flex-grow">
                            <Feature included={true} text={t("f1")} />
                            <Feature included={true} text={t("f2")} />
                            <Feature included={true} text={t("f3")} />
                            <Feature included={true} text={t("f4") + " " + t("f4_45")} />
                            <Feature included={false} text={t("f5")} />
                            <Feature included={false} text={t("f6")} />
                            <Feature included={false} text={t("f7")} />
                        </ul>

                        <a
                            href={contactHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3.5 mt-auto rounded-full border border-brand-sage text-brand-text font-medium text-sm hover:border-brand-leaf hover:text-brand-leaf transition-colors text-center shadow-sm block"
                        >
                            {t("btnEssential")}
                        </a>
                    </div>

                    {/* Premium */}
                    <div className="bg-white rounded-[2rem] p-8 lg:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-2 border-brand-leaf relative flex flex-col h-full">
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-leaf text-white text-[10px] uppercase font-bold tracking-widest px-4 py-1.5 rounded-full whitespace-nowrap">
                            {t("recBadge")}
                        </div>

                        <div className="min-h-[80px]">
                            <h3 className="font-serif text-2xl font-bold text-brand-leaf mb-2">{t("premiumTitle")}</h3>
                            <p className="text-brand-gray text-xs leading-relaxed">
                                {t("premiumDesc")}
                            </p>
                        </div>

                        <div className="my-6">
                            <span className="text-4xl font-bold text-brand-text">{t("premiumPrice")}</span>
                            <span className="text-brand-gray text-xs font-semibold ml-2">{t("month")}</span>
                        </div>

                        <ul className="space-y-4 mb-10 flex-grow">
                            <Feature included={true} text={t("f1")} />
                            <Feature included={true} text={t("f2")} />
                            <Feature included={true} text={t("f3")} />
                            <Feature included={true} text={t("f4") + " " + t("f4_90")} />
                            <Feature included={true} text={t("f5")} />
                            <Feature included={true} text={t("f6")} />
                            <Feature included={true} text={t("f7")} />
                        </ul>

                        <a
                            href={contactHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3.5 mt-auto rounded-full bg-brand-leaf hover:bg-brand-leaf-light text-white font-medium text-sm transition-colors text-center shadow-md shadow-brand-leaf/20 block"
                        >
                            {t("btnPremium")}
                        </a>
                    </div>

                </div>

                <div className="text-center mt-6">
                    <p className="text-[10px] text-brand-gray/60">
                        {tCommon("publicOfferText1")}<Link href="/offer" className="underline hover:text-brand-leaf">{tCommon("publicOfferText2")}</Link>.
                    </p>
                </div>

                {/* FAQ Section */}
                <div className="mt-32 max-w-2xl mx-auto">
                    <div className="text-center mb-10">
                        <h2 className="font-serif text-3xl text-brand-text mb-4">{t("faqTitle")}</h2>
                        <p className="text-brand-gray text-sm">{t("faqDesc")}</p>
                    </div>

                    <div className="space-y-4">
                        <FaqItem question={t("q1")} answer={t("a1")} />
                        <FaqItem question={t("q2")} answer={t("a2")} />
                        <FaqItem question={t("q3")} answer={t("a3")} />
                    </div>
                </div>
            </main>

            <PublicFooter />
        </div>
    );
}
