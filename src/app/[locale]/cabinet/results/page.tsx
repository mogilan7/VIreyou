import React from 'react';
import Sidebar from "@/components/dashboard/Sidebar";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { createClient } from '@/utils/supabase/server';
import {
    Activity,
    ArrowRight,
    CheckCircle2
} from "lucide-react";
import ResultsGrid from "@/components/dashboard/ResultsGrid";

export default async function MyResultsPage() {
    const t = await getTranslations('Dashboard.Results');

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || '00000000-0000-0000-0000-000000000000';
    const isDemo = userId === '00000000-0000-0000-0000-000000000000';

    let results: any[] = [];

    if (user || isDemo) {
        const { data } = await supabase
            .from('test_results')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (data && data.length > 0) {
            results = data;
        } else if (isDemo) {
            // Synchronized demo data fallback from page.tsx
            const demoCreatedAt = new Date().toISOString();
            results = [
                { test_type: 'mini-cog', score: 5, interpretation: 'Когнитивные функции в норме', created_at: demoCreatedAt },
                { test_type: 'score', score: 2, interpretation: 'Умеренный риск ССЗ', created_at: demoCreatedAt },
                { test_type: 'nicotine', score: 0, interpretation: 'Зависимость отсутствует', created_at: demoCreatedAt },
                { test_type: 'RU-AUDIT', score: 4, interpretation: 'Низкий риск потребления алкоголя', created_at: demoCreatedAt },
                { test_type: 'insomnia', score: 5, interpretation: 'Отсутствие клинически значимой бессонницы', created_at: demoCreatedAt },
                { test_type: 'circadian', score: 1, interpretation: 'Тип: Жаворонок', created_at: demoCreatedAt }
            ];
        }
    }

    // Calculate unique tests
    const uniqueTests = new Set(results.map(r => r.test_type)).size;

    // Group only latest results for overall status calculation
    const groupedLatest = results.reduce((acc, result) => {
        if (!acc[result.test_type]) acc[result.test_type] = result;
        return acc;
    }, {} as Record<string, any>);

    let risks = 0;
    Object.values(groupedLatest).forEach((res: any) => {
        const type = res.test_type;
        const score = res.score;
        // Naive risk calculation based on ResultsGrid thresholds
        if (type === 'score' && score >= 5) risks++;
        if (type === 'insomnia' && score >= 8) risks++;
        if (type === 'mini-cog' && score <= 4) risks++;
        if (type === 'RU-AUDIT' && score >= 8) risks++;
        if (type === 'nicotine' && score >= 4) risks++;
    });

    // Get profile for sidebar
    const { data: sbProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id || '00000000-0000-0000-0000-000000000000')
        .single();

    let profileName = sbProfile?.full_name || user?.user_metadata?.full_name || 'Пользователь';
    if (user?.id === '00000000-0000-0000-0000-000000000000' || !user) {
        profileName = 'Андрей Могилев';
    }

    return (
        <div className="min-h-screen flex transition-colors duration-300">
            <Sidebar role="client" profileName={profileName} />

            <main className="lg:ml-64 flex-1 p-8 md:p-12 pl-12 max-w-[1200px] w-full pt-24 lg:pt-8">
                {/* Header Section */}
                <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <nav className="text-[10px] font-bold dark:text-slate-500 text-brand-gray uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                            Личный кабинет <span className="opacity-30">/</span> Результаты
                        </nav>
                        <h1 className="text-3xl font-bold dark:text-slate-100 text-brand-text tracking-tight">{t('title')}</h1>
                        <p className="dark:text-slate-400 text-brand-gray mt-1 text-sm">{t('subtitle')}</p>
                    </div>

                    <div className="dark:bg-slate-800 bg-white border dark:border-white/5 border-brand-sage/30 px-4 py-2 rounded-xl flex items-center gap-3 shadow-md transition-colors duration-300">
                        <div className="text-right">
                            <div className="text-[9px] uppercase dark:text-slate-500 text-brand-gray font-bold leading-none mb-1 tracking-wider">Общий статус</div>
                            <div className={`text-sm font-bold leading-none ${risks > 0 ? (risks > 2 ? 'text-red-500' : 'text-amber-400') : 'text-brand-leaf'}`}>
                                {risks > 0 ? (risks > 2 ? 'Риск' : 'Внимание') : 'Оптимально'}
                            </div>
                        </div>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors duration-300 ${risks > 0 ? (risks > 2 ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-400/10 border-amber-400/20') : 'bg-brand-leaf/10 border-brand-leaf/20'}`}>
                            <CheckCircle2 className={`w-5 h-5 ${risks > 0 ? (risks > 2 ? 'text-red-500' : 'text-amber-400') : 'text-brand-leaf'}`} />
                        </div>
                    </div>
                </header>

                {/* Stats Summary Grid */}
                {results.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                        {[
                            { label: "Пройдено тестов", val: uniqueTests.toString(), sub: "сопряжены с биомаркерами", color: "dark:text-slate-100 text-brand-text" },
                            { label: "Зоны риска", val: risks.toString(), sub: "требуют внимания", color: risks > 0 ? (risks > 2 ? "text-red-500" : "text-amber-400") : "text-brand-leaf" },
                            { label: "Обновлено", val: "Сегодня", sub: "синхронизация данных", color: "dark:text-slate-100 text-brand-text" }
                        ].map((stat, i) => (
                            <div key={i} className="dark:bg-slate-800 bg-white p-5 rounded-2xl border dark:border-white/5 border-brand-sage/30 shadow-md hover:border-brand-leaf/30 transition-all duration-300">
                                <div className="dark:text-slate-500 text-brand-gray text-[10px] font-bold uppercase tracking-widest mb-2">{stat.label}</div>
                                <div className={`text-3xl font-bold ${stat.color}`}>{stat.val}</div>
                                <div className="dark:text-slate-500 text-brand-gray text-xs mt-1">{stat.sub}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Results Area */}
                {results.length === 0 ? (
                    <div className="dark:bg-slate-800 bg-white rounded-3xl p-16 border dark:border-white/5 border-brand-sage/30 shadow-md flex flex-col items-center justify-center text-center transition-colors duration-300">
                        <div className="w-20 h-20 dark:bg-teal-400/10 bg-brand-leaf/10 rounded-full flex items-center justify-center mb-6 border dark:border-teal-400/20 border-brand-leaf/20">
                            <Activity className="w-8 h-8 dark:text-teal-400 text-brand-leaf" />
                        </div>
                        <h2 className="text-2xl font-bold dark:text-slate-100 text-brand-text mb-2">{t('emptyHeader')}</h2>
                        <p className="dark:text-slate-400 text-brand-gray max-w-sm mb-8">{t('emptyDesc')}</p>
                        <Link
                            href="/diagnostics"
                            className="dark:bg-teal-400 bg-brand-leaf dark:text-slate-900 text-white px-8 py-3.5 rounded-full font-bold hover:opacity-90 transition-all flex items-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                        >
                            {t('emptyBtn')} <ArrowRight size={18} />
                        </Link>
                    </div>
                ) : (
                    <ResultsGrid results={results} />
                )}

                {/* Footer Section */}
                <footer className="mt-16 pt-8 border-t dark:border-white/5 border-brand-sage/30 text-center">
                    <div className="flex justify-center gap-6 mb-4">
                        <span className="text-[10px] font-bold dark:text-slate-600 text-brand-gray/60 uppercase tracking-widest cursor-help dark:hover:text-slate-400 hover:text-brand-leaf transition-colors">Безопасность данных</span>
                        <span className="text-[10px] font-bold dark:text-slate-600 text-brand-gray/60 uppercase tracking-widest cursor-help dark:hover:text-slate-400 hover:text-brand-leaf transition-colors">Методология</span>
                        <span className="text-[10px] font-bold dark:text-slate-600 text-brand-gray/60 uppercase tracking-widest cursor-help dark:hover:text-slate-400 hover:text-brand-leaf transition-colors">Поддержка</span>
                    </div>
                    <p className="dark:text-slate-600 text-brand-gray/40 text-[9px] uppercase tracking-[0.2em]">© 2026 AETERNA HEALTH PLATFORM. CLINICAL GRADE INTERFACE.</p>
                </footer>
            </main>
        </div>
    );
}
