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
        
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

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
            console.error("Prisma loading error:", e);
            clients = [];
        }

        if (isAdmin) {
            clients = clients.filter((c: any) => c.role !== 'specialist');
        }

        if (clients && clients.length > 0) {
            assignedClients = clients;
            if (clientId) {
                activeClient = clients.find(c => c.id === clientId) || clients[0];
            } else {
                activeClient = clients[0];
            }

            const { data: results } = await supabase
                .from('test_results')
                .select('*')
                .eq('user_id', activeClient.id)
                .order('created_at', { ascending: false })
                .limit(10); // increased limit to catch more tests

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
            <div className="hidden lg:block">
                <Sidebar role="specialist" />
            </div>

            <main className="lg:ml-64 flex-1 p-8 md:p-10 pl-12 max-w-[1400px] w-full pt-24 lg:pt-10">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div>
                        <h1 className="text-3xl font-serif text-brand-text mb-2 tracking-tight">{t('title')}</h1>
                        <div className="flex items-center gap-2 text-sm text-brand-gray">
                            <div className="w-2 h-2 rounded-full bg-brand-leaf"></div>
                            {t('subtitle')} <span className="font-semibold text-brand-text">
                                {activeClient ? activeClient.full_name : 'No Active Client'}
                            </span>
                        </div>
                    </div>
                </header>

                <div className="flex flex-col xl:flex-row gap-8">
                    {/* Left Column: Profile Card */}
                    <div className="w-full xl:w-80 flex flex-col gap-8">
                        <div className="bg-white p-6 rounded-[2rem] border border-brand-sage/40 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-sage/30 rounded-bl-[100px] -z-0"></div>
                            <div className="w-24 h-24 rounded-3xl bg-[#F0EBE1] border-4 border-white shadow-sm overflow-hidden mb-4 relative z-10 p-1">
                                <div className="w-full h-full rounded-2xl overflow-hidden bg-brand-sage/50 flex flex-col items-center justify-center font-serif text-2xl text-brand-gray">
                                    {activeClient?.avatar_url ? (
                                        <img src={activeClient.avatar_url} alt={activeClient.full_name || "Client"} className="w-full h-full object-cover" />
                                    ) : (
                                        activeClient ? activeClient.full_name?.charAt(0) : '?'
                                    )}
                                </div>
                            </div>
                            
                            <h2 className="font-serif text-xl text-brand-text font-bold mb-2 z-10">
                                {activeClient ? activeClient.full_name : 'Select Client'}
                            </h2>
                            <div className={`font-bold text-[9px] uppercase tracking-widest px-3 py-1.5 rounded-full mb-6 z-10 ${activeClient ? 'bg-[#E8F1EB] text-brand-leaf' : 'bg-gray-100 text-gray-500'}`}>
                                {activeClient ? t('profileActive') : 'INACTIVE'}
                            </div>

                            <div className="w-full space-y-4 z-10">
                                <div className="flex justify-between items-center text-xs border-b border-brand-sage/20 pb-2">
                                    <span className="text-brand-gray">Статус</span>
                                    <span className="font-bold flex items-center gap-1">Remote</span>
                                </div>
                                
                                {activeClient?.welcome_data && (
                                    <details className="w-full mt-2 border-t border-brand-sage/20 pt-2 text-left">
                                        <summary className="text-[11px] font-bold text-brand-leaf cursor-pointer hover:underline list-none flex items-center gap-1">📋 Анкета Здоровья <span className="text-[9px] text-brand-gray opacity-50">(Открыть)</span></summary>
                                        <div className="mt-2 space-y-1 text-[10px] text-brand-gray bg-slate-50 p-2.5 rounded-xl max-h-40 overflow-y-auto">
                                            {(() => {
                                                const welcome = activeClient.welcome_data as any;
                                                const fieldNames: Record<string, string> = { weight: "Вес", waist: "Талия", hips: "Бедра", smoking: "Курение", alcohol: "Алкоголь", chronic: "Хронические", meds: "Препараты" };
                                                return Object.entries(welcome).map(([key, value]) => {
                                                    if (!value || (typeof value === 'object' && Array.isArray(value) && value.length === 0)) return null;
                                                    const label = fieldNames[key] || key;
                                                    const displayVal = Array.isArray(value) ? value.join(', ') : String(value);
                                                    return (
                                                        <div key={key} className="flex justify-between border-b border-dashed border-slate-200 pb-1 last:border-0"><span className="font-medium">{label}:</span><span className="font-bold text-brand-text max-w-[100px] truncate">{displayVal}</span></div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </details>
                                )}

                                {/* Trigger Scores Tag Cloud */}
                                {clientTestResults.length > 0 && (
                                    <div className="w-full mt-3 border-t border-brand-sage/20 pt-3 text-left">
                                        <span className="text-[10px] font-bold text-brand-leaf uppercase tracking-widest flex items-center gap-1 mb-1.5">📊 Опросники &amp; Баллы</span>
                                        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1">
                                            {clientTestResults.map((r, index) => {
                                                const isHigh = r.test_type === 'sarc-f' && r.score >= 4 || r.test_type === 'mini-cog' && r.score <= 2 || r.test_type === 'insomnia' && r.score >= 15;
                                                return (
                                                    <div key={`${r.id}-${index}`} className={`text-[9px] font-bold px-1.5 py-0.5 rounded cursor-default border ${
                                                        isHigh ? 'bg-red-50 text-red-700 border-red-200/50' : 'bg-brand-sage/10 text-brand-leaf border-brand-sage/20'
                                                    }`} title={`Дата: ${new Date(r.created_at).toLocaleDateString()}`}>
                                                        {r.test_type.toUpperCase()}: {r.score}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Medical Archives */}
                        <div className="bg-white p-5 rounded-3xl border border-brand-sage/40 shadow-sm">
                            <h3 className="font-bold text-brand-text font-serif text-sm mb-4">Архив документов</h3>
                            <div className="bg-[#FAFAFA] border border-brand-sage/40 p-3 rounded-2xl flex items-center justify-between group hover:border-brand-leaf/40 transition-colors cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <FileText size={14} className="text-brand-leaf" />
                                    <div className="text-[11px] font-bold text-brand-text">Blood_Work_Oct.pdf</div>
                                </div>
                                <Download size={12} className="text-brand-gray/40 group-hover:text-brand-leaf" />
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Main Data & Forms */}
                    <div className="flex-1 flex flex-col gap-6">
                        {/* Tabs & Table */}
                        <div className="bg-white rounded-[1.5rem] border border-brand-sage/40 shadow-sm overflow-hidden flex flex-col">
                            <div className="flex px-6 pt-5 border-b border-brand-sage/40 gap-6">
                                <button className="text-xs font-bold text-brand-leaf border-b-2 border-brand-leaf pb-3 px-1">История анализов</button>
                            </div>

                            <div className="p-6 overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[500px]">
                                    <thead>
                                        <tr>
                                            <th className="text-[9px] font-bold text-brand-gray uppercase tracking-widest pb-4 border-b border-brand-sage/20">Биомаркер</th>
                                            <th className="text-[9px] font-bold text-brand-gray uppercase tracking-widest pb-4 border-b border-brand-sage/20">Показатель</th>
                                            <th className="text-[9px] font-bold text-brand-gray uppercase tracking-widest pb-4 border-b border-brand-sage/20">Тренд</th>
                                            <th className="text-[9px] font-bold text-brand-gray uppercase tracking-widest pb-4 border-b border-brand-sage/20">Оценка</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {biomarkerData.map((item, i) => (
                                            <tr key={i} className="group hover:bg-brand-bg/30 transition-colors border-b border-brand-sage/10 last:border-0">
                                                <td className="py-4 font-bold text-xs text-brand-text">{item.indicator}</td>
                                                <td className="py-4 text-xs text-brand-text">{item.reading}</td>
                                                <td className="py-4">
                                                    <div className={`flex items-center gap-1 text-[11px] font-bold ${item.trend === 'up' ? 'text-brand-leaf' : item.trend === 'down' ? 'text-red-500' : 'text-brand-gray/50'}`}>
                                                        {item.trend === 'up' && <TrendingUp size={12} />}
                                                        {item.trend === 'down' && <TrendingDown size={12} />}
                                                        {item.trend === 'stable' && <Minus size={12} />}
                                                        {item.change}
                                                    </div>
                                                </td>
                                                <td className="py-4">
                                                    <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${item.color === 'orange' ? 'bg-orange-50 text-orange-700 border border-orange-200/40' : item.color === 'green' ? 'bg-[#E8F1EB] text-brand-leaf border border-brand-sage/30' : 'bg-red-50 text-red-600 border border-red-200/40'}`}>
                                                        {item.assessment}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Report Panel */}
                        {activeReport && (
                            <div className="bg-white rounded-[1.5rem] border border-brand-sage/40 shadow-sm p-6">
                                <h2 className="font-serif text-lg text-brand-text mb-4">📊 Периодический отчет</h2>
                                <div className="max-h-[400px] overflow-y-auto pr-2 bg-[#FAFAFA]/50 p-5 rounded-xl border border-dashed border-brand-sage/30">
                                    <ReportViewer markdown={activeReport.markdown} />
                                </div>
                            </div>
                        )}

                        {/* Recommendation Form */}
                        <div className="bg-white rounded-[1.5rem] border border-brand-sage/40 shadow-sm p-6 relative">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="bg-[#E8F1EB] p-1.5 rounded-full text-brand-leaf"><Edit3 size={14} /></div>
                                <h2 className="font-serif text-lg text-brand-text">Новая рекомендация</h2>
                            </div>
                            <div className="space-y-6">
                                <div><label className="block text-[9px] font-bold text-brand-gray uppercase tracking-widest mb-2">Назначения специалистов</label><textarea className="w-full h-20 p-3 rounded-xl border border-brand-sage/40 text-xs bg-[#FAFAFA] resize-none" placeholder="Введите назначения..."></textarea></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="block text-[9px] font-bold text-brand-gray uppercase tracking-widest mb-2">Суплементарная поддержка</label><textarea className="w-full h-24 p-3 rounded-xl border border-brand-sage/40 text-xs bg-[#FAFAFA] resize-none" placeholder="Препараты и дозировки..."></textarea></div>
                                    <div><label className="block text-[9px] font-bold text-brand-gray uppercase tracking-widest mb-2">Коррекция питания & Lifestyle</label><textarea className="w-full h-24 p-3 rounded-xl border border-brand-sage/40 text-xs bg-[#FAFAFA] resize-none" placeholder="Питание, сон, активность..."></textarea></div>
                                </div>
                                <div className="flex justify-end pt-4 border-t border-brand-sage/20">
                                    <button className="bg-brand-leaf hover:bg-brand-leaf-light text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-sm">Сформировать</button>
                                </div>
                            </div>
                        </div>
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
