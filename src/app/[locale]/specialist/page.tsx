import Sidebar from "@/components/dashboard/Sidebar";
import { Search, MapPin, FileText, Download, TrendingUp, TrendingDown, Minus, Edit3, CalendarPlus, Clock, MessageSquare, Printer, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import ReportViewer from "@/components/specialist/ReportViewer";
import ContextualSidebar from "@/components/specialist/ContextualSidebar";
import { updateReportPeriod } from "@/actions/update-report-settings";
import { revalidatePath } from "next/cache";

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function SpecialistDashboard(props: { searchParams: Promise<{ id?: string }> }) {
    const searchParams = await props.searchParams;
    const clientId = searchParams.id;

    const t = await getTranslations('Dashboard.Specialist');
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    let assignedClients: any[] = [];
    let activeClient: any = null;
    let clientTestResults: any[] = [];

    let isAdmin = false;
    let isSpecialist = false;

    if (user) {
        isAdmin = user.email?.toLowerCase() === 'mogilev.andrey@gmail.com';
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        isSpecialist = profile?.role === 'specialist' || profile?.role === 'admin';

        if (!isAdmin && !isSpecialist) {
            const { notFound } = require('next/navigation');
            return notFound();
        }

        let clients: any[] = [];
        try {
            const fetchedClients = await prisma.profiles.findMany({
                where: !isAdmin ? { assigned_specialist_id: user.id } : undefined
            });
            clients = fetchedClients || [];
        } catch (e: any) {
            clients = [];
        }

        if (isAdmin) {
            clients = clients.filter((c: any) => c.role !== 'specialist');
        }

        if (clients && clients.length > 0) {
            assignedClients = clients;
            activeClient = clientId ? clients.find(c => c.id === clientId) || clients[0] : clients[0];

            const { data: results } = await supabase
                .from('test_results')
                .select('*')
                .eq('user_id', activeClient.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (results) {
                clientTestResults = results;
            }

            var activeClientUser: any = null;
            var activeReport: any = null;
            
            if (activeClient) {
                const authUser = await prisma.users.findUnique({ where: { id: activeClient.id } });
                const email = authUser?.email;

                if (email) {
                    const u = await prisma.user.findUnique({ where: { email } });
                    if (u) {
                        activeClientUser = u;
                        const { generatePeriodicReport } = require('@/lib/reportGenerator');
                        activeReport = await generatePeriodicReport(u.id, (u as any).report_period_days || 7, activeClient.full_name);
                    }
                }
            }
        }
    } else {
        const { notFound } = require('next/navigation');
        return notFound();
    }

    let biomarkerData = [];

    if (clientTestResults.length > 0) {
        biomarkerData = clientTestResults.map((result: any) => {
            if (result.test_type === 'bio-age') {
                const rawData = result.rawData as any;
                return { indicator: "Biological Age", reading: `${result.score} yrs`, trend: "up", change: `${rawData?.diff > 0 ? '+' : ''}${rawData?.diff || 0} yrs`, assessment: rawData?.diff <= 0 ? "OPTIMAL" : "SUB-OPTIMAL", color: rawData?.diff <= 0 ? "green" : "orange" };
            }
            if (result.test_type === 'score') {
                return { indicator: "Cardiovascular Risk (SCORE)", reading: `${result.score}%`, trend: result.score > 5 ? "up" : "stable", change: "Current", assessment: result.score < 5 ? "LOW RISK" : "HIGH RISK", color: result.score < 5 ? "green" : "red" };
            }
            if (result.test_type === 'circadian') {
                return { indicator: "Circadian Rhythm", reading: `${result.score}/86`, trend: "stable", change: "Stable", assessment: result.score > 50 ? "GOOD" : "NEEDS ATTENTION", color: result.score > 50 ? "green" : "orange" };
            }
            if (result.test_type === 'insomnia') {
                return { indicator: "Insomnia Severity", reading: `${result.score}/28`, trend: result.score > 14 ? "up" : "down", change: "Current", assessment: result.score <= 7 ? "NO INSOMNIA" : "CLINICAL", color: result.score <= 7 ? "green" : "red" };
            }
            if (result.test_type === 'mini-cog') {
                return { indicator: "Cognitive Screening (Mini-Cog)", reading: `${result.score}/5`, trend: "stable", change: "Stable", assessment: result.score >= 3 ? "NEGATIVE" : "POSITIVE", color: result.score >= 3 ? "green" : "red" };
            }
            if (result.test_type === 'sarc-f') {
                return { indicator: "Sarcopenia Screen (SARC-F)", reading: `${result.score}/10`, trend: "stable", change: "Current", assessment: result.score >= 4 ? "RISK" : "NORMAL", color: result.score >= 4 ? "red" : "green" };
            }
            return { indicator: result.test_type.toUpperCase(), reading: result.score, trend: "stable", change: "N/A", assessment: "REVIEW", color: "orange" };
        });
    } else {
        biomarkerData = [
            { indicator: "Vitamin D (25-OH)", reading: "28 ng/mL", trend: "up", change: "+12%", assessment: "SUB-OPTIMAL", color: "orange" },
            { indicator: "CRP (Inflammation)", reading: "1.2 mg/L", trend: "down", change: "-5%", assessment: "HEALTHY", color: "green" },
            { indicator: "Cortisol (Morning)", reading: "22 mcg/dL", trend: "stable", change: "Stable", assessment: "ELEVATED", color: "red" },
            { indicator: "Omega-3 Index", reading: "6.8%", trend: "up", change: "+2.1%", assessment: "GOOD", color: "green" },
        ];
    }

    return (
        <div className="bg-[#FAFAFA] min-h-screen text-brand-text flex font-sans">
            <div className="hidden lg:block"><Sidebar role="specialist" /></div>

            <main className="lg:ml-64 flex-1 p-8 pt-24 lg:pt-10 max-w-[1400px] w-full">
                <header className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-serif text-brand-text mb-2">{t('title')}</h1>
                        <div className="flex items-center gap-2 text-sm text-brand-gray">
                            <div className="w-2 h-2 rounded-full bg-brand-leaf"></div>
                            {t('subtitle')} <span className="font-semibold text-brand-text">{activeClient ? activeClient.full_name : 'No Active Client'}</span>
                        </div>
                    </div>
                </header>

                <div className="flex flex-col xl:flex-row gap-8">
                    {/* Left Column */}
                    <div className="w-full xl:w-80 flex flex-col gap-8">
                        <div className="bg-white p-6 rounded-[2rem] border border-brand-sage/40 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-sage/30 rounded-bl-[100px] -z-0"></div>
                            <div className="w-24 h-24 rounded-3xl bg-[#F0EBE1] border-4 border-white overflow-hidden mb-4 relative z-10 p-1">
                                <div className="w-full h-full rounded-2xl overflow-hidden bg-brand-sage/50 flex flex-col items-center justify-center font-serif text-2xl text-brand-gray">
                                    {activeClient?.avatar_url ? <img src={activeClient.avatar_url} alt="C" className="w-full h-full object-cover" /> : activeClient?.full_name?.charAt(0)}
                                </div>
                            </div>
                            <h2 className="font-serif text-xl font-bold mb-2 z-10">{activeClient ? activeClient.full_name : 'Select Client'}</h2>
                            <div className="w-full space-y-4 z-10 mt-2">
                                {activeClient?.welcome_data && (
                                    <details className="w-full border-t border-brand-sage/20 pt-2 text-left">
                                        <summary className="text-[11px] font-bold text-brand-leaf cursor-pointer list-none flex items-center gap-1">📋 Анкета Здоровья</summary>
                                        <div className="mt-2 space-y-1 text-[10px] text-brand-gray bg-slate-50 p-2.5 rounded-xl max-h-40 overflow-y-auto">
                                            {(() => {
                                                const welcome = activeClient.welcome_data as any;
                                                return Object.entries(welcome).map(([key, value]) => {
                                                    if (!value) return null;
                                                    const displayVal = Array.isArray(value) ? value.join(', ') : String(value);
                                                    return <div key={key} className="flex justify-between pb-1"><span>{key}:</span><span className="font-bold text-brand-text">{displayVal}</span></div>
                                                });
                                            })()}
                                        </div>
                                    </details>
                                )}

                                {clientTestResults.length > 0 && (
                                    <div className="w-full border-t border-brand-sage/20 pt-2 text-left">
                                        <span className="text-[10px] font-bold text-brand-leaf uppercase">📊 Баллы Скринингов</span>
                                        <div className="flex flex-wrap gap-1 mt-1.5 max-h-32 overflow-y-auto">
                                            {clientTestResults.map((r, i) => (
                                                <div key={i} className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-brand-sage/10 text-brand-leaf border-brand-sage/20">{r.test_type.toUpperCase()}: {r.score}</div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Center Column: Main Data & Forms */}
                    <div className="flex-1 flex flex-col gap-6">
                        <div className="bg-white rounded-[1.5rem] border border-brand-sage/40 overflow-hidden flex flex-col p-6">
                            <table className="w-full text-left bordedr-collapse">
                                <thead><tr><th className="text-[9px] font-bold text-brand-gray pb-4">Биомаркер</th><th className="text-[9px] font-bold text-brand-gray pb-4">Показатель</th><th className="text-[9px] font-bold text-brand-gray pb-4">Оценка</th></tr></thead>
                                <tbody>
                                    {biomarkerData.map((item, i) => (
                                        <tr key={i} className="border-b border-brand-sage/10 last:border-0"><td className="py-4 font-bold text-xs">{item.indicator}</td><td className="py-4 text-xs">{item.reading}</td><td><span className="text-[8px] font-bold px-2 py-0.5 rounded bg-brand-sage/10 text-brand-leaf">{item.assessment}</span></td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Periodic Report Settings & View */}
                        {activeReport && (
                            <div className="bg-white rounded-[1.5rem] border border-brand-sage/40 shadow-sm p-6 flex flex-col gap-4">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-brand-sage/20">
                                    <div>
                                        <h2 className="font-serif text-lg text-brand-text mb-1">📊 Периодический отчет</h2>
                                        <p className="text-[11px] text-brand-gray">Текущий период мониторинга: <span className="font-bold text-brand-leaf">{(activeClientUser as any)?.report_period_days || 7} дней</span></p>
                                    </div>

                                    <form action={async (formData: FormData) => {
                                        "use server";
                                        const period = parseInt(formData.get("period") as string);
                                        await updateReportPeriod(activeClient.id, period);
                                    }} className="flex items-center gap-2 bg-[#FAFAFA] p-2 rounded-xl border border-brand-sage/20">
                                        <label className="text-[11px] text-brand-gray whitespace-nowrap">Период:</label>
                                        <input type="number" name="period" min="1" defaultValue={(activeClientUser as any)?.report_period_days || 7} className="w-12 p-1 border border-brand-sage/40 rounded-lg text-xs text-center" />
                                        <button type="submit" className="bg-brand-leaf hover:bg-brand-leaf-light text-white px-3 py-1.5 rounded-lg text-xs font-semibold">Обновить</button>
                                    </form>
                                </div>

                                <div className="max-h-[350px] overflow-y-auto pr-2 bg-[#FAFAFA]/50 p-5 rounded-xl border border-dashed border-brand-sage/30">
                                    <ReportViewer markdown={activeReport.markdown} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right column sidebar AI Insights */}
                    {activeClient && (
                         <div className="w-full xl:w-96 flex flex-col gap-6">
                              <ContextualSidebar clientId={activeClient.id} />
                         </div>
                    )}
                </div>
            </main>
        </div>
    );
}
