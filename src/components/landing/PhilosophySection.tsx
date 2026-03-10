import { Microscope, BatteryMedium, Compass } from "lucide-react";
import { useTranslations } from "next-intl";

export default function PhilosophySection() {
    const t = useTranslations('Landing.Philosophy');

    return (
        <section id="philosophy" className="py-24 px-6 bg-white relative overflow-hidden">
            {/* Decorative background lines */}
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand-sage to-transparent opacity-50"></div>

            <div className="max-w-4xl mx-auto text-center relative z-10">
                <span className="text-brand-leaf font-semibold font-sans tracking-widest uppercase text-xs mb-4 block">
                    {t('tag')}
                </span>

                <h2 className="text-4xl md:text-5xl mb-12 font-serif text-brand-text">
                    {t('title')}
                </h2>

                <p className="text-xl md:text-2xl leading-relaxed text-brand-gray/80 italic font-serif">
                    {t('desc1')}
                </p>

                {/* 3 Column Grid */}
                <div className="grid md:grid-cols-3 gap-8 mt-16">
                    {/* Card 1 */}
                    <div className="p-10 lg:p-12 rounded-[2rem] bg-[#FAFAFA] hover:-translate-y-2 transition-transform duration-500 shadow-sm hover:shadow-xl flex flex-col items-start text-left">
                        <Microscope className="text-brand-leaf mb-8" size={36} strokeWidth={1} />
                        <h3 className="text-2xl mb-4 font-serif font-bold text-brand-text">{t('f1Title')}</h3>
                        <p className="text-sm md:text-base text-brand-gray/80 leading-relaxed font-sans">
                            {t('f1Desc')}
                        </p>
                    </div>

                    {/* Card 2 */}
                    <div className="p-10 lg:p-12 rounded-[2rem] bg-[#FAFAFA] hover:-translate-y-2 transition-transform duration-500 shadow-sm hover:shadow-xl flex flex-col items-start text-left">
                        <BatteryMedium className="text-brand-leaf mb-8" size={36} strokeWidth={1} />
                        <h3 className="text-2xl mb-4 font-serif font-bold text-brand-text">{t('f2Title')}</h3>
                        <p className="text-sm md:text-base text-brand-gray/80 leading-relaxed font-sans">
                            {t('f2Desc')}
                        </p>
                    </div>

                    {/* Card 3 */}
                    <div className="p-10 lg:p-12 rounded-[2rem] bg-[#FAFAFA] hover:-translate-y-2 transition-transform duration-500 shadow-sm hover:shadow-xl flex flex-col items-start text-left">
                        <Compass className="text-brand-leaf mb-8" size={36} strokeWidth={1} />
                        <h3 className="text-2xl mb-4 font-serif font-bold text-brand-text">{t('f3Title')}</h3>
                        <p className="text-sm md:text-base text-brand-gray/80 leading-relaxed font-sans">
                            {t('f3Desc')}
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
