"use client";

import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import DiagnosticModal from '@/components/diagnostic/DiagnosticModal';
import { useTranslations } from 'next-intl';

export function Hero() {
    const t = useTranslations('Landing');
    const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);

    return (
        <section className="relative w-full bg-slate-50 py-20 lg:py-32 overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-50 -z-10" />
            
            {/* Background elements for premium feel */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-blue/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-mint/10 rounded-full blur-[100px]" />
            </div>

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center gap-12">
                {/* Text Content */}
                <div className="flex-1 space-y-8 text-center lg:text-left z-10">
                    <h1 className="text-4xl md:text-5xl lg:text-7xl font-extrabold text-slate-900 leading-[1.1] tracking-tight">
                        {t('heroHeadlineLine1')} <br />
                        <span className="text-brand-blue">{t('heroHeadlineLine2')}.</span>
                    </h1>
                    <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium">
                        {t('heroDesc')}
                    </p>
                    <div className="pt-6 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                        <button 
                            onClick={() => setIsDiagnosticOpen(true)}
                            className="group relative inline-flex items-center justify-center gap-3 rounded-2xl bg-brand-blue px-10 py-5 text-lg font-bold text-white shadow-2xl shadow-brand-blue/20 transition-all duration-300 hover:bg-brand-blue-dark hover:-translate-y-1 active:scale-95"
                        >
                            {t('startAnalysis')}
                            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-all">
                                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                            </div>
                        </button>
                    </div>
                </div>

                {/* Image / Portrait */}
                <div className="flex-1 w-full max-w-lg lg:max-w-none relative z-10 group">
                    <div className="absolute inset-0 bg-brand-blue/10 rounded-[2.5rem] rotate-3 scale-[1.02] -z-10 transition-transform group-hover:rotate-0 duration-700" />
                    <div className="aspect-[4/5] w-full bg-slate-100 relative rounded-[2.5rem] overflow-hidden shadow-2xl ring-1 ring-slate-200">
                        <img
                            src="/valentina.jpg"
                            alt="Valentina Ul, Lead Specialist"
                            onError={(e) => {
                                e.currentTarget.src = 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=2070&auto=format&fit=crop';
                            }}
                            className="object-cover w-full h-full transition-transform duration-1000 group-hover:scale-105"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent p-8 text-white">
                            <h3 className="text-2xl font-bold mb-1">Валентина Уль</h3>
                            <p className="text-brand-mint font-semibold tracking-wide uppercase text-xs">Ведущий специалист anti-age</p>
                        </div>
                    </div>
                </div>
            </div>

            <DiagnosticModal 
                isOpen={isDiagnosticOpen} 
                onClose={() => setIsDiagnosticOpen(false)} 
            />
        </section>
    );
}
