"use client";

import { Link } from "@/i18n/routing";
import { useLocale } from "next-intl";
import { useState } from "react";
import { X } from "lucide-react";

export default function PublicFooter() {
    const locale = useLocale();
    const isRu = locale === "ru";
    const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

    return (
        <>
            <footer className="bg-white py-12 border-t border-brand-sage/50">
                <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-0">
                    <div className="flex flex-col items-center md:items-start max-w-xs">
                        <div className="bg-brand-forest w-6 h-6 flex items-center justify-center text-white text-[10px] font-bold font-serif mb-4">
                            VI
                        </div>
                        <p className="text-brand-gray text-[10px] leading-relaxed text-center md:text-left">
                            {isRu
                                ? "Научное благополучие и комплексное anti-aging. Специалист по антиэйджинг Валентина. Переосмысляем диалог между вами и вашим телом."
                                : "Scientific wellness and holistic anti-aging. Anti-aging specialist Valentina. Redefining the dialogue between you and your body."}
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
                        <button onClick={() => setIsPrivacyOpen(true)} className="hover:text-brand-leaf uppercase tracking-widest text-[10px] font-semibold text-brand-gray-dark">
                            {isRu ? "Политика конфиденциальности" : "Privacy Policy"}
                        </button>
                        <Link href="/#contact" className="hover:text-brand-leaf">
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

            {/* Privacy Policy Modal */}
            {isPrivacyOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[2rem] p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl relative border border-brand-sage/30">
                        <button 
                            onClick={() => setIsPrivacyOpen(false)}
                            className="absolute top-6 right-6 p-2 text-brand-gray hover:text-brand-text bg-brand-bg rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                        
                        <h2 className="font-serif text-2xl text-brand-text mb-6 pr-8">
                            {isRu ? "Политика конфиденциальности" : "Privacy Policy"}
                        </h2>
                        
                        <div className="text-sm text-brand-gray space-y-4 leading-relaxed">
                            {isRu ? (
                                <>
                                    <p>Оставляя свои данные на этом сайте, вы соглашаетесь на их обработку.</p>
                                    <p>Мы гарантируем конфиденциальность ваших данных и не передаем их третьим лицам без вашего явного согласия. Ваши данные используются исключительно для предоставления заявленных услуг, связи с вами и улучшения качества нашего сервиса.</p>
                                    <p>В случае регистрации через Telegram, мы получаем только те данные, которые необходимы для идентификации (ID, имя пользователя). Вы всегда можете отозвать свое согласие, связавшись с нами по доступным каналам связи.</p>
                                </>
                            ) : (
                                <>
                                    <p>By submitting your data on this site, you consent to its processing.</p>
                                    <p>We guarantee the confidentiality of your data and do not share it with third parties without your explicit consent. Your data is used exclusively to provide the stated services, communicate with you, and improve the quality of our service.</p>
                                    <p>If registering via Telegram, we only receive the data necessary for identification (ID, username). You can always withdraw your consent by contacting us through the available communication channels.</p>
                                </>
                            )}
                        </div>

                        <div className="mt-8 pt-6 border-t border-brand-sage/30 text-right">
                            <button 
                                onClick={() => setIsPrivacyOpen(false)}
                                className="px-8 py-3 bg-brand-leaf text-white font-medium rounded-full text-sm hover:bg-brand-leaf-light transition-colors shadow-sm"
                            >
                                {isRu ? "Понятно" : "I Understand"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
