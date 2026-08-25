"use client";

import PublicNavbar from "@/components/layout/PublicNavbar";
import PublicFooter from "@/components/layout/PublicFooter";
import { Check, X, Diamond, ChevronDown } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";

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

            <main className="flex-grow max-w-5xl mx-auto px-6 w-full mb-32">
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
                    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-brand-sage/30 flex flex-col">
                        <h3 className="font-serif text-2xl font-bold text-brand-text mb-2">{t("assistantStandardTitle")}</h3>
                        <p className="text-brand-gray text-xs leading-relaxed mb-6">
                            {t("assistantStandardDesc")}
                        </p>

                        <div className="mb-8">
                            <span className="text-4xl font-bold text-brand-text">{t("assistantStandardPrice")}</span>
                            <span className="text-brand-gray text-xs font-semibold ml-2">{t("month")}</span>
                        </div>

                        <ul className="space-y-4 mb-10 flex-grow">
                            <li className="flex items-center gap-3 text-sm text-brand-gray-dark">
                                <Check size={18} className="text-brand-leaf flex-shrink-0" />
                                {t("aF1")}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-gray-dark">
                                <Check size={18} className="text-brand-leaf flex-shrink-0" />
                                {t("aF2")}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-gray-dark">
                                <Check size={18} className="text-brand-leaf flex-shrink-0" />
                                {t("aF3")}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-gray-dark">
                                <Check size={18} className="text-brand-leaf flex-shrink-0" />
                                {t("aF4")}
                            </li>
                        </ul>

                        <Link
                            href="/cabinet"
                            className="w-full py-3.5 rounded-full border border-brand-sage text-brand-text font-medium text-sm hover:border-brand-leaf hover:text-brand-leaf transition-colors text-center shadow-sm block"
                        >
                            {t("btnAssistantStandard")}
                        </Link>
                    </div>

                    {/* Assistant PRO */}
                    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-brand-sage/30 flex flex-col relative">
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[10px] uppercase font-bold tracking-widest px-4 py-1.5 rounded-full whitespace-nowrap">
                            PRO
                        </div>
                        <h3 className="font-serif text-2xl font-bold text-brand-text mb-2">{t("assistantProTitle")}</h3>
                        <p className="text-brand-gray text-xs leading-relaxed mb-6">
                            {t("assistantProDesc")}
                        </p>

                        <div className="mb-8">
                            <span className="text-4xl font-bold text-brand-text">{t("assistantProPrice")}</span>
                            <span className="text-brand-gray text-xs font-semibold ml-2">{t("month")}</span>
                        </div>

                        <ul className="space-y-4 mb-10 flex-grow">
                            <li className="flex items-center gap-3 text-sm text-brand-gray-dark">
                                <Check size={18} className="text-brand-leaf flex-shrink-0" />
                                {t("aF1")}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-gray-dark">
                                <Check size={18} className="text-brand-leaf flex-shrink-0" />
                                {t("aF2")}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-gray-dark">
                                <Check size={18} className="text-brand-leaf flex-shrink-0" />
                                {t("aF3")}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-gray-dark">
                                <Check size={18} className="text-brand-leaf flex-shrink-0" />
                                {t("aF4")}
                            </li>
                        </ul>

                        <Link
                            href="/cabinet"
                            className="w-full py-3.5 rounded-full border border-blue-500 text-blue-600 font-medium text-sm hover:bg-blue-50 transition-colors text-center shadow-sm block"
                        >
                            {t("btnAssistantPro")}
                        </Link>
                    </div>

                    {/* Essential */}
                    <div className="bg-white rounded-[2rem] p-10 shadow-sm border border-brand-sage/30 flex flex-col">
                        <h3 className="font-serif text-2xl font-bold text-brand-text mb-2">{t("essentialTitle")}</h3>
                        <p className="text-brand-gray text-xs leading-relaxed mb-6">
                            {t("essentialDesc")}
                        </p>

                        <div className="mb-8">
                            <span className="text-4xl font-bold text-brand-text">{t("essentialPrice")}</span>
                            <span className="text-brand-gray text-xs font-semibold ml-2">{t("session")}</span>
                        </div>

                        <ul className="space-y-4 mb-10 flex-grow">
                            <li className="flex items-center gap-3 text-sm text-brand-gray-dark">
                                <Check size={18} className="text-brand-leaf flex-shrink-0" />
                                {t("eF1")}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-gray-dark">
                                <Check size={18} className="text-brand-leaf flex-shrink-0" />
                                {t("eF2")}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-gray-dark">
                                <Check size={18} className="text-brand-leaf flex-shrink-0" />
                                {t("eF2new")}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-gray-dark">
                                <Check size={18} className="text-brand-leaf flex-shrink-0" />
                                {t("eF3")}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-gray/40">
                                <X size={18} className="text-brand-gray/40 flex-shrink-0" />
                                {t("eF4")}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-gray/40">
                                <X size={18} className="text-brand-gray/40 flex-shrink-0" />
                                {t("eF5")}
                            </li>
                        </ul>

                        <a
                            href={contactHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3.5 rounded-full border border-brand-sage text-brand-text font-medium text-sm hover:border-brand-leaf hover:text-brand-leaf transition-colors text-center shadow-sm block"
                        >
                            {t("btnEssential")}
                        </a>
                    </div>

                    {/* Premium */}
                    <div className="bg-white rounded-[2rem] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-2 border-brand-leaf relative flex flex-col">
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-leaf text-white text-[10px] uppercase font-bold tracking-widest px-4 py-1.5 rounded-full whitespace-nowrap">
                            {t("recBadge")}
                        </div>

                        <div className="w-10 h-10 bg-[#E8F1EB] rounded-full flex items-center justify-center mb-6">
                            <Diamond size={16} className="text-brand-leaf" fill="currentColor" />
                        </div>

                        <h3 className="font-serif text-2xl font-bold text-brand-leaf mb-2">{t("premiumTitle")}</h3>
                        <p className="text-brand-gray text-xs leading-relaxed mb-6">
                            {t("premiumDesc")}
                        </p>

                        <div className="mb-8">
                            <span className="text-4xl font-bold text-brand-text">{t("premiumPrice")}</span>
                            <span className="text-brand-gray text-xs font-semibold ml-2">{t("month")}</span>
                        </div>

                        <ul className="space-y-4 mb-10 flex-grow">
                            <li className="flex items-center gap-3 text-sm text-brand-text font-medium">
                                <div className="bg-brand-leaf/20 p-0.5 rounded-full"><Check size={14} className="text-brand-leaf" strokeWidth={3} /></div>
                                {t("pF1")}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-text font-medium">
                                <div className="bg-brand-leaf/20 p-0.5 rounded-full"><Check size={14} className="text-brand-leaf" strokeWidth={3} /></div>
                                {t("pF2")}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-text font-medium">
                                <div className="bg-brand-leaf/20 p-0.5 rounded-full"><Check size={14} className="text-brand-leaf" strokeWidth={3} /></div>
                                {t("pF3")}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-text font-medium">
                                <div className="bg-brand-leaf/20 p-0.5 rounded-full"><Check size={14} className="text-brand-leaf" strokeWidth={3} /></div>
                                {t("pF4")}
                            </li>
                            <li className="flex items-center gap-3 text-sm text-brand-text font-medium">
                                <div className="bg-brand-leaf/20 p-0.5 rounded-full"><Check size={14} className="text-brand-leaf" strokeWidth={3} /></div>
                                {t("pF5")}
                            </li>
                        </ul>

                        <a
                            href={contactHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3.5 rounded-full bg-brand-leaf hover:bg-brand-leaf-light text-white font-medium text-sm transition-colors text-center shadow-md shadow-brand-leaf/20 block"
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
