import Sidebar from "@/components/dashboard/Sidebar";
import { Search, MapPin, FileText, Download, TrendingUp, TrendingDown, Minus, Edit3, CalendarPlus, Clock, MessageSquare, Printer, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import ReportViewer from "@/components/specialist/ReportViewer";
import ContextualSidebar from "@/components/specialist/ContextualSidebar";
import { updateReportPeriod } from "@/actions/update-report-settings";
import { revalidatePath } from "next/cache";
import MonitoringDiaryPreview from "@/components/specialist/MonitoringDiaryPreview";

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function SpecialistDashboard(props: { params: Promise<{ locale: string }>, searchParams: Promise<{ id?: string, dates?: string, aiTips?: string }> }) {
    const searchParams = await props.searchParams;
    const params = await props.params;
    const clientId = searchParams.id;
    const selectedDatesStr = searchParams.dates as string | undefined;
    const selectedDates = selectedDatesStr ? selectedDatesStr.split(',') : undefined;
    const locale = params.locale;

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
                .limit(20);

            if (results) {
                const uniqueResults: any[] = [];
                const seenTypes = new Set<string>();
                for (const r of results) {
                    const typeKey = r.test_type.toLowerCase();
                    if (!seenTypes.has(typeKey)) {
                        seenTypes.add(typeKey);
                        uniqueResults.push(r);
                    }
                }
                clientTestResults = uniqueResults;
            }

            var activeClientUser: any = null;
            var activeReport: any = null;
            
            if (activeClient) {
                const authUser = await prisma.users.findUnique({ where: { id: activeClient.id } });
                const email = authUser?.email;

                if (email) {
                    const u = await prisma.user.findUnique({ 
                        where: { email },
                        include: {
                            nutritionLogs: true,
                            sleepLogs: true,
                            activityLogs: true,
                            habitLogs: true,
                            hydrationLogs: true
                        }
                    });
                    if (u) {
                        activeClientUser = u;
                        const { generatePeriodicReport } = require('@/lib/reportGenerator');
                        activeReport = await generatePeriodicReport(u.id, (u as any).report_period_days || 7, activeClient.full_name, selectedDates);
                    }
                }
            }
        }
    } else {
        const { notFound } = require('next/navigation');
        return notFound();
    }

    let biomarkerData: any[] = [];

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
            if (result.test_type === 'ai-recommendation') {
                return null;
            }
            return { indicator: result.test_type.toUpperCase(), reading: result.score, trend: "stable", change: "N/A", assessment: "REVIEW", color: "orange" };
        }).filter(Boolean);
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
                    {/* Left Column Profile Card */}
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
                                {/* Anthropometrics Data Grid */}
                                {activeClient?.welcome_data && (
                                    <div className="w-full border-t border-brand-sage/20 pt-3 text-left">
                                        <span className="text-[10px] font-bold text-brand-leaf uppercase flex items-center gap-1 mb-1.5">📋 Антропометрия / Анкета</span>
                                        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-brand-gray">
                                            {(() => {
                                                const welcome = activeClient.welcome_data as any;
                                                const fieldNames: Record<string, string> = { 
                                                    weight: "Вес", height: "Рост", waist: "Талия", hips: "Бедра", 
                                                    smoking: "Курение", alcohol: "Алкоголь", age: "Возраст" 
                                                };
                                                return Object.entries(welcome).map(([key, value]) => {
                                                    if (!value || (typeof value === 'object' && Array.isArray(value) && value.length === 0)) return null;
                                                    const label = fieldNames[key] || key;
                                                    const displayVal = Array.isArray(value) ? value.join(', ') : String(value);
                                                    return (
                                                        <div key={key} className="flex justify-between border-b border-dashed border-slate-100 pb-0.5">
                                                            <span className="font-medium text-slate-400">{label}:</span>
                                                            <span className="font-bold text-brand-text truncate max-w-[65px]">{displayVal}</span>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {clientTestResults.length > 0 && (
                                    <div className="w-full border-t border-brand-sage/20 pt-3 text-left">
                                        <span className="text-[10px] font-bold text-brand-leaf uppercase">📊 Последние Баллы</span>
                                        <div className="flex flex-wrap gap-1 mt-1.5 max-h-32 overflow-y-auto">
                                            {clientTestResults.map((r, i) => (
                                                <div key={i} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                                    r.score >= (r.test_type==='sarc-f'?4 : r.test_type==='mini-cog'?2 : 0) ? 'bg-red-50 text-red-700 border-red-200/50' : 'bg-brand-sage/10 text-brand-leaf border-brand-sage/20'
                                                }`}>
                                                    {r.test_type.toUpperCase()}: {r.score}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Center Column */}
                    <div className="flex-1 flex flex-col gap-6">
                        <div className="bg-white rounded-[1.5rem] border border-brand-sage/40 overflow-hidden flex flex-col p-6 shadow-sm">
                            <table className="w-full text-left bordedr-collapse">
                                <thead><tr><th className="text-[9px] font-bold text-brand-gray pb-4">Биомаркер</th><th className="text-[9px] font-bold text-brand-gray pb-4">Показатель</th><th className="text-[9px] font-bold text-brand-gray pb-4">Оценка</th></tr></thead>
                                <tbody>
                                    {biomarkerData.map((item: any, i: number) => (
                                        <tr key={i} className="border-b border-brand-sage/10 last:border-0"><td className="py-4 font-bold text-xs">{item.indicator}</td><td className="py-4 text-xs">{item.reading}</td><td><span className="text-[8px] font-bold px-2 py-0.5 rounded bg-brand-sage/10 text-brand-leaf">{item.assessment}</span></td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Periodic Report */}
                        {activeReport && (
                            <div className="bg-white rounded-[1.5rem] border border-brand-sage/40 shadow-sm p-6 flex flex-col gap-4">
                                <div className="flex flex-col gap-4 pb-4 border-b border-brand-sage/20 w-full">
                                    <form action={async (formData: FormData) => {
                                        "use server";
                                        const period = parseInt(formData.get("period") as string);
                                        const selectedDatesFormStr = formData.get("selectedDates") as string;
                                        await updateReportPeriod(activeClient.id, period);
                                        const { redirect } = require("next/navigation");
                                        redirect(`/${locale}/specialist?id=${activeClient.id}&dates=${selectedDatesFormStr}`);
                                    }} className="flex flex-col gap-4 w-full">
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                            <div>
                                                <h2 className="font-serif text-lg text-brand-text mb-1">📊 Периодический отчет</h2>
                                                <p className="text-[11px] text-brand-gray">Выбрано дней: <span className="font-bold text-brand-leaf">{selectedDates ? selectedDates.length : ((activeClientUser as any)?.report_period_days || 7)}</span></p>
                                            </div>

                                            <div className="flex items-center gap-3 bg-[#FAFAFA] p-2 rounded-xl border border-brand-sage/20">
                                                <label className="text-[11px] text-brand-gray whitespace-nowrap">Период (дней):</label>
                                                <input type="number" name="period" min="1" defaultValue={(activeClientUser as any)?.report_period_days || 7} className="w-11 p-1 border border-brand-sage/40 rounded-lg text-xs text-center bg-white" />
                                                <button type="submit" className="bg-brand-leaf hover:bg-brand-leaf-light text-white px-3 py-1.5 rounded-xl text-xs font-semibold">Сформировать</button>
                                            </div>
                                        </div>

                                        <MonitoringDiaryPreview 
                                            logs={{
                                                nutrition: (activeClientUser as any)?.nutritionLogs || [],
                                                sleep: (activeClientUser as any)?.sleepLogs || [],
                                                activity: (activeClientUser as any)?.activityLogs || [],
                                                habit: (activeClientUser as any)?.habitLogs || [],
                                                hydration: (activeClientUser as any)?.hydrationLogs || [],
                                            }}
                                            periodDays={(activeClientUser as any)?.report_period_days || 7}
                                            initialSelectedDates={selectedDates || []}
                                        />
                                    </form>
                                </div>

                                <div className="max-h-[350px] overflow-y-auto pr-2 bg-[#FAFAFA]/50 p-5 rounded-xl border border-dashed border-brand-sage/30">
                                    <ReportViewer markdown={activeReport.markdown} />
                                </div>
                            </div>
                        )}

                        {/* Recommendation Form */}
                        <div className="bg-white rounded-[1.5rem] border border-brand-sage/40 shadow-sm p-6 relative">
                            <div className="flex items-center justify-between mb-6 border-b border-brand-sage/10 pb-4">
                                <div className="flex items-center gap-2">
                                    <div className="bg-[#E8F1EB] p-1.5 rounded-full text-brand-leaf"><Edit3 size={14} /></div>
                                    <h2 className="font-serif text-lg text-brand-text">Новая рекомендация</h2>
                                </div>
                                <a href={`/${locale}/specialist?id=${activeClient?.id}&dates=${selectedDatesStr || ''}&aiTips=true`} className="text-[10px] font-bold text-brand-leaf border border-brand-leaf/30 px-2.5 py-1.5 rounded-xl flex items-center gap-1 hover:bg-brand-leaf/5 transition-colors cursor-pointer bg-brand-sage/5">
                                    💡 {searchParams.aiTips === 'true' ? 'Обновить ИИ' : 'Включить ИИ-подсказки'}
                                </a>
                            </div>
                            <div className="space-y-4">
                                <div><label className="block text-[9px] font-bold text-brand-gray uppercase tracking-widest mb-1.5">Назначения специалистов</label><textarea className="w-full h-20 p-3 rounded-xl border border-brand-sage/30 text-xs bg-[#FAFAFA] resize-none" placeholder="Введите назначения..."></textarea></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="block text-[9px] font-bold text-brand-gray uppercase tracking-widest mb-1.5">Суплементарная поддержка</label><textarea className="w-full h-24 p-3 rounded-xl border border-brand-sage/30 text-xs bg-[#FAFAFA] resize-none" placeholder="Препараты и дозировки..."></textarea></div>
                                    <div><label className="block text-[9px] font-bold text-brand-gray uppercase tracking-widest mb-1.5">Коррекция питания & Lifestyle</label><textarea className="w-full h-24 p-3 rounded-xl border border-brand-sage/30 text-xs bg-[#FAFAFA] resize-none" placeholder="Питание, сон, активность..."></textarea></div>
                                </div>
                                <div className="flex justify-end pt-3 border-t border-brand-sage/10">
                                    <button className="bg-brand-leaf hover:bg-brand-leaf-light text-white px-5 py-2 rounded-xl font-bold text-xs shadow-sm shadow-brand-leaf/10">Сохранить</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right column sidebar AI Insights */}
                    {activeClient && searchParams.aiTips === 'true' && (
                         <div className="w-full xl:w-96 flex flex-col gap-6">
                              <ContextualSidebar clientId={activeClient.id} />
                         </div>
                    )}
                </div>
            </main>
        </div>
    );
}
