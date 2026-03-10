import Image from "next/image";
import { useTranslations } from "next-intl";

export default function HeroSection() {
    const t = useTranslations('Landing');

    return (
        <section className="relative min-h-screen pt-[160px] pb-[120px] px-6 md:px-12 flex items-center justify-center max-w-[1400px] mx-auto w-full">
            <div className="flex flex-col-reverse md:flex-row items-center justify-between gap-12 lg:gap-16 w-full">
                {/* Content - 60% Width */}
                <div className="w-full md:w-[60%] flex flex-col gap-6 z-10 lg:pr-10">
                    <div className="inline-flex items-center px-4 py-1.5 bg-brand-leaf/10 text-brand-leaf text-[10px] uppercase font-bold tracking-widest rounded-full w-max">
                        {t('heroTag')}
                    </div>

                    <h1 className="text-5xl md:text-6xl lg:text-[5rem] leading-[1.1] md:leading-[1.1] text-brand-text mb-4 mt-2">
                        <span className="font-sans font-light">{t('heroHeadlineLine1')}</span> <br />
                        <span className="font-serif italic font-normal text-brand-leaf">{t('heroHeadlineLine2')}</span>
                    </h1>

                    <p className="text-brand-gray font-sans text-sm md:text-lg leading-[1.5] max-w-[32rem] mb-6 md:mb-8 whitespace-pre-line">
                        {t('heroDesc')}
                    </p>

                    <div className="flex flex-wrap items-center gap-4">
                        <button className="bg-brand-forest hover:bg-brand-forest/90 text-white px-8 py-3.5 rounded-[12px] font-medium transition-all shadow-md text-sm whitespace-nowrap">
                            {t('startAnalysis')}
                        </button>
                        <button className="bg-transparent border border-brand-sage hover:bg-brand-sage/20 text-brand-text px-8 py-3.5 rounded-[12px] font-medium transition-all text-sm flex items-center gap-2 whitespace-nowrap">
                            {t('ourMethod')}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>

                {/* Image - 40% Width with Soft Cutout Effect */}
                <div className="w-full md:w-[40%] flex justify-center relative">
                    {/* Background Soft Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[400px] lg:w-[480px] aspect-square bg-brand-sage/40 rounded-full blur-[80px] pointer-events-none z-0"></div>

                    {/* Integrated Cutout Image Container (No Hard Borders) */}
                    <div className="relative w-full max-w-[400px] lg:max-w-[480px] aspect-[3/4] z-10 overflow-hidden" style={{ maskImage: "linear-gradient(to bottom, black 80%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 80%, transparent 100%)" }}>
                        <Image
                            src="/hero-custom.png"
                            alt="Anti-age Specialist"
                            fill
                            className="object-cover object-top transition-transform duration-[1500ms] hover:scale-105 ease-out"
                            sizes="(max-width: 768px) 100vw, 40vw"
                            priority
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}
