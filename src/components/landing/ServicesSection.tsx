import { useTranslations } from "next-intl";

export default function ServicesSection() {
    const t = useTranslations('Landing.Services');

    return (
        <section id="services" className="py-32 px-6 bg-white relative overflow-hidden">
            <div className="max-w-[1400px] mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
                    <div className="max-w-xl text-center md:text-left z-10 w-full">
                        <h2 className="text-4xl md:text-5xl lg:text-6xl mb-6 font-serif text-brand-text">
                            {t('title')}
                        </h2>
                        <p className="text-brand-gray/80 text-lg md:text-xl font-light">
                            {t('desc')}
                        </p>
                    </div>
                    {/* Decorative Element */}
                    <div className="hidden md:block w-32 h-px bg-gradient-to-r from-brand-sage/50 to-transparent"></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Step 1 */}
                    <div className="group p-10 bg-[#FAFAFA] border border-brand-sage/30 rounded-[2rem] hover:bg-brand-forest transition-colors duration-500 hover:border-brand-forest">
                        <div className="text-7xl font-serif text-brand-sage mb-10 group-hover:text-white/80 transition-colors duration-500">
                            01
                        </div>
                        <h4 className="text-2xl font-serif font-bold mb-4 italic text-brand-text group-hover:text-white transition-colors duration-500">
                            {t('s1Title')}
                        </h4>
                        <p className="text-sm font-sans text-brand-gray/80 leading-relaxed group-hover:text-white/80 transition-colors duration-500">
                            {t('s1Desc')}
                        </p>
                    </div>

                    {/* Step 2 */}
                    <div className="group p-10 bg-[#FAFAFA] border border-brand-sage/30 rounded-[2rem] hover:bg-brand-forest transition-colors duration-500 hover:border-brand-forest">
                        <div className="text-7xl font-serif text-brand-sage mb-10 group-hover:text-white/80 transition-colors duration-500">
                            02
                        </div>
                        <h4 className="text-2xl font-serif font-bold mb-4 italic text-brand-text group-hover:text-white transition-colors duration-500">
                            {t('s2Title')}
                        </h4>
                        <p className="text-sm font-sans text-brand-gray/80 leading-relaxed group-hover:text-white/80 transition-colors duration-500">
                            {t('s2Desc')}
                        </p>
                    </div>

                    {/* Step 3 */}
                    <div className="group p-10 bg-[#FAFAFA] border border-brand-sage/30 rounded-[2rem] hover:bg-brand-forest transition-colors duration-500 hover:border-brand-forest">
                        <div className="text-7xl font-serif text-brand-sage mb-10 group-hover:text-white/80 transition-colors duration-500">
                            03
                        </div>
                        <h4 className="text-2xl font-serif font-bold mb-4 italic text-brand-text group-hover:text-white transition-colors duration-500">
                            {t('s3Title')}
                        </h4>
                        <p className="text-sm font-sans text-brand-gray/80 leading-relaxed group-hover:text-white/80 transition-colors duration-500">
                            {t('s3Desc')}
                        </p>
                    </div>

                    {/* Step 4 */}
                    <div className="group p-10 bg-[#FAFAFA] border border-brand-sage/30 rounded-[2rem] hover:bg-brand-forest transition-colors duration-500 hover:border-brand-forest">
                        <div className="text-7xl font-serif text-brand-sage mb-10 group-hover:text-white/80 transition-colors duration-500">
                            04
                        </div>
                        <h4 className="text-2xl font-serif font-bold mb-4 italic text-brand-text group-hover:text-white transition-colors duration-500">
                            {t('s4Title')}
                        </h4>
                        <p className="text-sm font-sans text-brand-gray/80 leading-relaxed group-hover:text-white/80 transition-colors duration-500">
                            {t('s4Desc')}
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
