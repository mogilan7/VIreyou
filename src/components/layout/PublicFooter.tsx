"use client";

import { Link } from "@/i18n/routing";
import { useLocale } from "next-intl";

export default function PublicFooter() {
    const locale = useLocale();
    const isRu = locale === "ru";

    return (
        <footer className="bg-white py-12 border-t border-brand-sage/50">
            <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-0">
                <div className="flex flex-col items-center md:items-start max-w-xs">
                    <div className="bg-brand-forest w-6 h-6 flex items-center justify-center text-white text-[10px] font-bold font-serif mb-4">
                        VI
                    </div>
                    <p className="text-brand-gray text-[10px] leading-relaxed text-center md:text-left">
                        {isRu
                            ? "Научное благополучие и комплексное anti-aging от доктора Валентины. Переосмысляем диалог между вами и вашим телом."
                            : "Scientific wellness and holistic anti-aging by Dr. Valentina. Redefining the dialogue between you and your body."}
                    </p>
                </div>

                <div className="flex flex-wrap justify-center gap-6 md:gap-8 text-[10px] tracking-widest font-semibold text-brand-gray-dark uppercase">
                    <Link href="/#philosophy" className="hover:text-brand-leaf">
                        {isRu ? "Философия" : "Philosophy"}
                    </Link>
                    <Link href="/diagnostics" className="hover:text-brand-leaf">
                        {isRu ? "Диагностика" : "Diagnostics"}
                    </Link>
                    <Link href="/pricing" className="hover:text-brand-leaf">
                        {isRu ? "Цены" : "Pricing"}
                    </Link>
                    <Link href="/offer" className="hover:text-brand-leaf">
                        {isRu ? "Публичная оферта" : "Public Offer"}
                    </Link>
                    <Link href="#" className="hover:text-brand-leaf">
                        {isRu ? "Политика конфиденциальности" : "Privacy Policy"}
                    </Link>
                    <Link href="#" className="hover:text-brand-leaf">
                        {isRu ? "Контакты" : "Contact"}
                    </Link>
                </div>

                <div className="text-[10px] text-brand-gray/60 text-center md:text-right">
                    &copy; {new Date().getFullYear()} VI antiage.<br />
                    {isRu
                        ? "Специалист по научному долголетию."
                        : "Science-backed holistic wellness and longevity specialist."}
                </div>
            </div>
        </footer>
    );
}
