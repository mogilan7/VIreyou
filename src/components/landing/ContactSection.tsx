import { Mail, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";

export default function ContactSection() {
    const t = useTranslations('Landing.Contact');

    return (
        <section id="contact" className="py-32 px-6 bg-brand-forest text-white relative overflow-hidden">

            {/* Background elements */}
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-brand-leaf/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

            <div className="max-w-[1400px] mx-auto grid lg:grid-cols-2 gap-16 lg:gap-24 relative z-10">
                {/* Left: Text & Contact Info */}
                <div className="flex flex-col justify-center">
                    <h2 className="text-4xl md:text-5xl lg:text-6xl mb-8 font-serif leading-tight">
                        {t('title')}
                    </h2>
                    <p className="text-white/80 mb-12 text-lg md:text-xl font-light font-sans max-w-lg leading-relaxed">
                        {t('desc')}
                    </p>

                    <div className="space-y-8">
                        {/* Telegram */}
                        <a href="#" className="flex items-center space-x-6 group w-max">
                            <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center border border-white/10 group-hover:bg-brand-leaf/20 group-hover:border-brand-leaf/50 transition-all duration-300">
                                <MessageCircle className="text-brand-leaf" size={24} />
                            </div>
                            <span className="text-white/90 font-medium tracking-wide group-hover:text-white transition-colors duration-300">@vi_antiage</span>
                        </a>
                        {/* Email */}
                        <a href="mailto:contact@vi-antiage.ru" className="flex items-center space-x-6 group w-max">
                            <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center border border-white/10 group-hover:bg-brand-leaf/20 group-hover:border-brand-leaf/50 transition-all duration-300">
                                <Mail className="text-brand-leaf" size={24} />
                            </div>
                            <span className="text-white/90 font-medium tracking-wide group-hover:text-white transition-colors duration-300">contact@vi-antiage.ru</span>
                        </a>
                    </div>
                </div>

                {/* Right: Contact Form */}
                <div className="bg-white p-10 md:p-14 rounded-[2.5rem] shadow-2xl border border-brand-sage/20 relative">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-brand-forest pointer-events-none">
                        <Mail size={150} />
                    </div>

                    <form className="space-y-8 relative z-10">
                        {/* Name */}
                        <div>
                            <label className="block text-brand-text text-[10px] uppercase font-bold tracking-widest mb-3">
                                {t('nameLabel')}
                            </label>
                            <input
                                type="text"
                                placeholder={t('namePlaceholder')}
                                className="w-full bg-[#FAFAFA] border border-brand-sage/40 rounded-2xl px-5 py-4 text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-leaf transition-all placeholder:text-brand-gray/40 text-sm font-medium"
                            />
                        </div>

                        {/* Request */}
                        <div>
                            <label className="block text-brand-text text-[10px] uppercase font-bold tracking-widest mb-3">
                                {t('requestLabel')}
                            </label>
                            <textarea
                                rows={4}
                                placeholder={t('requestPlaceholder')}
                                className="w-full bg-[#FAFAFA] border border-brand-sage/40 rounded-2xl px-5 py-4 text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-leaf transition-all placeholder:text-brand-gray/40 text-sm font-medium resize-none"
                            ></textarea>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="button"
                            className="w-full bg-brand-forest hover:bg-brand-leaf text-white py-5 rounded-2xl font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 uppercase tracking-widest text-xs"
                        >
                            {t('btn')}
                        </button>
                    </form>
                </div>
            </div>
        </section>
    );
}
