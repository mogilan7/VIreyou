import Image from "next/image";
import { useTranslations } from "next-intl";

export default function AboutSection() {
    const t = useTranslations('Landing.About');

    return (
        <section id="about" className="py-24 px-6 bg-[#FAFAFA] relative overflow-hidden">
            <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row gap-16 lg:gap-24 items-center justify-between">

                {/* Left: Image Container */}
                <div className="w-full md:w-[45%] lg:w-[40%] relative">
                    <div className="relative aspect-[4/5] w-full max-w-md mx-auto rounded-[2rem] overflow-hidden shadow-2xl z-10 group">
                        <Image
                            src="/about-specialist-v2.png"
                            alt={t('title')}
                            fill
                            className="object-cover object-[center_top] transform group-hover:scale-105 transition-transform duration-[1500ms] ease-out"
                            sizes="(max-width: 768px) 100vw, 40vw"
                        />
                    </div>
                    {/* Floating Quote */}
                    <div className="absolute -bottom-8 -right-8 bg-white p-8 rounded-3xl shadow-xl hidden lg:block z-20 border border-brand-sage/20">
                        <p className="text-brand-forest font-serif italic text-xl max-w-[180px] leading-snug">
                            {t('quote')}
                        </p>
                    </div>
                    {/* Decorative Blob */}
                    <div className="absolute top-1/2 -left-12 w-64 h-64 bg-brand-leaf/10 rounded-full blur-[60px] pointer-events-none"></div>
                </div>

                {/* Right: Text Content */}
                <div className="w-full md:w-[50%] lg:w-[50%] flex flex-col items-start z-10">
                    <h2 className="text-4xl md:text-5xl lg:text-6xl mb-8 font-serif text-brand-text">
                        {t('title')}
                    </h2>

                    <p className="text-brand-gray/90 mb-10 leading-relaxed text-base md:text-lg max-w-xl font-sans">
                        {t('desc1')}
                    </p>

                    <div className="grid grid-cols-2 gap-4 md:gap-6 mb-12 w-full max-w-md">
                        {/* Stat 1 */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-brand-sage/30 hover:shadow-md transition-shadow">
                            <div className="text-3xl md:text-4xl font-bold font-serif text-brand-forest mb-2">
                                {t('stat1Title')}
                            </div>
                            <div className="text-[10px] md:text-xs uppercase font-bold tracking-widest text-brand-gray/60">
                                {t('stat1Desc')}
                            </div>
                        </div>
                        {/* Stat 2 */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-brand-sage/30 hover:shadow-md transition-shadow">
                            <div className="text-3xl md:text-4xl font-bold font-serif text-brand-forest mb-2">
                                {t('stat2Title')}
                            </div>
                            <div className="text-[10px] md:text-xs uppercase font-bold tracking-widest text-brand-gray/60">
                                {t('stat2Desc')}
                            </div>
                        </div>
                    </div>

                    <ul className="space-y-4 md:space-y-5 text-brand-text font-medium text-sm md:text-base">
                        <li className="flex items-center space-x-4">
                            <span className="w-2 h-2 bg-brand-leaf rounded-full shrink-0 shadow-[0_0_10px_rgba(74,107,93,0.5)]"></span>
                            <span>{t('point1')}</span>
                        </li>
                        <li className="flex items-center space-x-4">
                            <span className="w-2 h-2 bg-brand-leaf rounded-full shrink-0 shadow-[0_0_10px_rgba(74,107,93,0.5)]"></span>
                            <span>{t('point2')}</span>
                        </li>
                        <li className="flex items-center space-x-4">
                            <span className="w-2 h-2 bg-brand-leaf rounded-full shrink-0 shadow-[0_0_10px_rgba(74,107,93,0.5)]"></span>
                            <span>{t('point3')}</span>
                        </li>
                    </ul>
                </div>

            </div>
        </section>
    );
}
