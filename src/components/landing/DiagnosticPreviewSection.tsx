import { CheckCircle, TrendingUp } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";

export default function DiagnosticPreviewSection() {
    const t = useTranslations('Landing.DiagnosticPreview');

    return (
        <section id="diagnostic" className="py-32 px-6 bg-brand-forest text-white overflow-hidden relative">

            {/* Background elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-leaf/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-brand-sage/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

            <div className="max-w-4xl mx-auto text-center relative z-10">
                <h2 className="text-4xl md:text-5xl lg:text-6xl mb-10 font-serif leading-tight">
                    {t('title')}
                </h2>
                <p className="text-white/80 mb-16 text-lg md:text-xl font-light font-sans max-w-2xl mx-auto leading-relaxed">
                    {t('desc')}
                </p>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-12 rounded-[2.5rem] inline-block w-full max-w-3xl shadow-2xl relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-brand-leaf to-transparent opacity-50"></div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-left">
                        {/* Feature 1 */}
                        <div className="space-y-4">
                            <h4 className="font-serif font-bold text-xl md:text-2xl flex items-center text-white">
                                <CheckCircle className="mr-3 text-brand-leaf shrink-0" size={24} />
                                {t('f1Title')}
                            </h4>
                            <p className="text-sm md:text-base text-white/70 leading-relaxed font-sans pl-9 border-l border-white/10">
                                {t('f1Desc')}
                            </p>
                        </div>
                        {/* Feature 2 */}
                        <div className="space-y-4">
                            <h4 className="font-serif font-bold text-xl md:text-2xl flex items-center text-white">
                                <TrendingUp className="mr-3 text-brand-leaf shrink-0" size={24} />
                                {t('f2Title')}
                            </h4>
                            <p className="text-sm md:text-base text-white/70 leading-relaxed font-sans pl-9 border-l border-white/10">
                                {t('f2Desc')}
                            </p>
                        </div>
                    </div>

                    <div className="mt-16 text-center">
                        <Link href="/diagnostics" className="inline-block w-full md:w-auto bg-white text-brand-forest px-12 py-5 rounded-full font-bold hover:bg-[#FAFAFA] transition hover:shadow-xl hover:-translate-y-1 text-sm md:text-base uppercase tracking-wider">
                            {t('btn')}
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}
