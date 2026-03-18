import Sidebar from "@/components/dashboard/Sidebar";
import { Search, MapPin, FileText, Download, TrendingUp, TrendingDown, Minus, Edit3, CalendarPlus, Clock, MessageSquare, Printer, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const fetchCache = 'force-no-store';


export default async function SpecialistDashboard(props: { searchParams: Promise<{ id?: string }> }) {
    const searchParams = await props.searchParams;
    const clientId = searchParams.id;

    const t = await getTranslations('Dashboard.Specialist');
    const supabase = await createClient();


    // Get current specialist
    const { data: { user } } = await supabase.auth.getUser();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let assignedClients: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let activeClient: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

        // Fetch clients list with Prisma to bypass Supabase RLS policies
        let clients: any[] = [];
        try {
            const fetchedClients = await prisma.profiles.findMany({
                where: !isAdmin ? { assigned_specialist_id: user.id } : undefined
            });
            clients = fetchedClients || [];
        } catch (e: any) {
            console.error("Prisma loading error:", e);
            clients = []; // fallback to empty to avoid crashing full layout
        }

        if (isAdmin) {
            // Include users who are NOT specialists (handles null/client/etc)
            clients = clients.filter((c: any) => c.role !== 'specialist');
        }





        if (clients && clients.length > 0) {
            assignedClients = clients;
            
            if (clientId) {
                activeClient = clients.find(c => c.id === clientId) || clients[0];
            } else {
                activeClient = clients[0];
            }


            // Fetch test results for the active client
            const { data: results } = await supabase
                .from('test_results')
                .select('*')
                .eq('user_id', activeClient.id)
                .order('created_at', { ascending: false })
                .limit(5);

            if (results) {
                clientTestResults = results;
            }
        }
    } else {
        // Not logged in -> hide existence
        const { notFound } = require('next/navigation');
        return notFound();
    }


    // Map real diagnostic results to the table format.
    // If no real data, show placeholders.
    let biomarkerData = [];

    if (clientTestResults.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        biomarkerData = clientTestResults.map((result: any) => {
            // Map our specific test types to realistic looking dashboard displays
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
                return { indicator: "Cognitive Screening", reading: `${result.score}/5`, trend: "stable", change: "Stable", assessment: result.score >= 3 ? "NEGATIVE" : "POSITIVE", color: result.score >= 3 ? "green" : "red" };
            }

            return { indicator: "General Test", reading: result.score, trend: "stable", change: "N/A", assessment: "REVIEW", color: "orange" };
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
                {/* Header */}
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

                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-grow md:w-64">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gray/60" />
                            <input
                                type="text"
                                placeholder={t('searchPlaceholder')}
                                className="w-full pl-10 pr-4 py-2.5 rounded-full border border-brand-sage/50 text-sm focus:outline-none focus:border-brand-leaf transition-colors bg-white shadow-sm placeholder:text-brand-gray/50"
                            />
                        </div>
                        <button className="bg-brand-leaf hover:bg-brand-leaf-light text-white px-5 py-2.5 rounded-full font-medium transition-colors text-sm flex items-center gap-2 shadow-sm whitespace-nowrap">
                            <span className="text-lg leading-none">+</span> {t('newClient')}
                        </button>
                    </div>
                </header>

                <div className="flex flex-col xl:flex-row gap-8">

                    {/* Left Column: Profile & Archives */}
                    <div className="w-full xl:w-80 flex flex-col gap-8">

                        {/* Profile Card */}
                        <div className="bg-white p-8 rounded-[2rem] border border-brand-sage/40 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
                            {/* Decorative background shape */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-sage/30 rounded-bl-[100px] -z-0"></div>

                            <div className="w-24 h-24 rounded-3xl bg-[#F0EBE1] border-4 border-white shadow-sm overflow-hidden mb-5 relative z-10 p-1">
                                <div className="w-full h-full rounded-2xl overflow-hidden bg-brand-sage/50 flex flex-col items-center justify-center font-serif text-2xl text-brand-gray">
                                    {activeClient ? activeClient.full_name?.charAt(0) : '?'}
                                </div>
                            </div>

                            <h2 className="font-serif text-2xl text-brand-text font-bold mb-3 z-10">
                                {activeClient ? activeClient.full_name : 'Select Client'}
                            </h2>
                            <div className={`font-bold text-[9px] uppercase tracking-widest px-3 py-1.5 rounded-full mb-8 z-10 ${activeClient ? 'bg-[#E8F1EB] text-brand-leaf' : 'bg-gray-100 text-gray-500'}`}>
                                {activeClient ? t('profileActive') : 'INACTIVE'}
                            </div>

                            {/* Grant Specialist Access for Admin */}
                            {isAdmin && activeClient && activeClient.role !== 'specialist' && (
                                <form action={async () => {
                                    'use server';
                                    const { grantSpecialistAccess } = require('@/app/actions/grant-access');
                                    await grantSpecialistAccess(activeClient.id);
                                }}>
                                    <button type="submit" className="w-full mb-6 bg-brand-forest hover:bg-brand-forest-dark text-white px-4 py-3 rounded-2xl font-bold text-sm transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 z-10">
                                        <Users size={16} /> Назначить Доктором
                                    </button>
                                </form>
                            )}


                            <div className="w-full space-y-5 z-10">
                                <div className="flex justify-between items-center text-sm border-b border-brand-sage/30 pb-3">
                                    <span className="text-brand-gray">{t('pAge')}</span>
                                    <span className="font-bold">--</span>
                                </div>
                                <div className="flex justify-between items-center text-sm border-b border-brand-sage/30 pb-3">
                                    <span className="text-brand-gray">{t('pSession')}</span>
                                    <span className="font-bold">
                                        {clientTestResults.length > 0
                                            ? new Date(clientTestResults[0].created_at).toLocaleDateString()
                                            : '--'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm border-b border-brand-sage/30 pb-3">
                                    <span className="text-brand-gray">{t('pRisk')}</span>
                                    <span className="font-bold text-brand-leaf bg-brand-sage/20 px-2 py-0.5 rounded text-xs text-right leading-tight">
                                        Pending Review
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm pt-2">
                                    <span className="text-brand-gray">{t('pLocation')}</span>
                                    <span className="font-bold flex items-center gap-1"><MapPin size={14} className="text-brand-gray" /> Remote</span>
                                </div>
                            </div>
                        </div>

                        {/* Medical Archives List */}
                        <div className="bg-white p-6 rounded-3xl border border-brand-sage/40 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-brand-text font-serif">{t('maTitle')}</h3>
                                <button className="text-[10px] font-bold text-brand-leaf uppercase tracking-widest flex items-center gap-1 hover:text-brand-forest">
                                    {t('maUpload')}
                                </button>
                            </div>

                            <div className="space-y-3">
                                <div className="bg-[#FAFAFA] border border-brand-sage/40 p-3.5 rounded-2xl flex items-center justify-between group hover:border-brand-leaf/40 transition-colors cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white p-2 rounded-xl shadow-sm"><FileText size={16} className="text-brand-leaf" /></div>
                                        <div>
                                            <p className="text-xs font-bold text-brand-text leading-tight">Blood_Work_Oct.pdf</p>
                                            <p className="text-[10px] text-brand-gray mt-0.5">3 days ago &bull; 1.2MB</p>
                                        </div>
                                    </div>
                                    <Download size={14} className="text-brand-gray/40 group-hover:text-brand-leaf" />
                                </div>

                                <div className="bg-[#FAFAFA] border border-brand-sage/40 p-3.5 rounded-2xl flex items-center justify-between group hover:border-brand-leaf/40 transition-colors cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white p-2 rounded-xl shadow-sm"><FileText size={16} className="text-blue-500" /></div>
                                        <div>
                                            <p className="text-xs font-bold text-brand-text leading-tight">DNA_Test_Results.xml</p>
                                            <p className="text-[10px] text-brand-gray mt-0.5">Sep 28 &bull; 4.5MB</p>
                                        </div>
                                    </div>
                                    <Download size={14} className="text-brand-gray/40 group-hover:text-blue-500" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Main Data & Forms */}
                    <div className="flex-1 flex flex-col gap-8">

                        {/* Tabs & Table */}
                        <div className="bg-white rounded-[2rem] border border-brand-sage/40 shadow-sm overflow-hidden flex flex-col">

                            {/* Tabs */}
                            <div className="flex px-8 pt-6 border-b border-brand-sage/40 gap-8">
                                <button className="text-sm font-bold text-brand-leaf border-b-2 border-brand-leaf pb-4 px-2">{t('tab1')}</button>
                                <button className="text-sm font-semibold text-brand-gray hover:text-brand-text pb-4 px-2 transition-colors">{t('tab2')}</button>
                                <button className="text-sm font-semibold text-brand-gray hover:text-brand-text pb-4 px-2 transition-colors">{t('tab3')}</button>
                            </div>

                            {/* Data Table */}
                            <div className="p-8 overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[600px]">
                                    <thead>
                                        <tr>
                                            <th className="text-[10px] font-bold text-brand-gray uppercase tracking-widest pb-6 border-b border-brand-sage/20 font-sans">{t('th1')}</th>
                                            <th className="text-[10px] font-bold text-brand-gray uppercase tracking-widest pb-6 border-b border-brand-sage/20 font-sans">{t('th2')}</th>
                                            <th className="text-[10px] font-bold text-brand-gray uppercase tracking-widest pb-6 border-b border-brand-sage/20 font-sans">{t('th3')}</th>
                                            <th className="text-[10px] font-bold text-brand-gray uppercase tracking-widest pb-6 border-b border-brand-sage/20 font-sans">{t('th4')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {biomarkerData.map((item, i) => (
                                            <tr key={i} className="group hover:bg-brand-bg/50 transition-colors">
                                                <td className="py-5 border-b border-brand-sage/20 font-bold text-sm text-brand-text group-last:border-0">{item.indicator}</td>
                                                <td className="py-5 border-b border-brand-sage/20 text-sm text-brand-text group-last:border-0">{item.reading}</td>
                                                <td className="py-5 border-b border-brand-sage/20 group-last:border-0">
                                                    <div className={`flex items-center gap-1.5 text-xs font-bold ${item.trend === 'up' ? 'text-brand-leaf' :
                                                        item.trend === 'down' ? 'text-red-500' : 'text-brand-gray/50'
                                                        }`}>
                                                        {item.trend === 'up' && <TrendingUp size={14} />}
                                                        {item.trend === 'down' && <TrendingDown size={14} />}
                                                        {item.trend === 'stable' && <Minus size={14} />}
                                                        {item.change}
                                                    </div>
                                                </td>
                                                <td className="py-5 border-b border-brand-sage/20 group-last:border-0">
                                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded ${item.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                                                        item.color === 'green' ? 'bg-[#E8F1EB] text-brand-leaf' :
                                                            'bg-red-100 text-red-600'
                                                        }`}>
                                                        {item.assessment}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Recommendations Form */}
                        <div className="bg-white rounded-[2rem] border border-brand-sage/40 shadow-sm p-8 relative">

                            {/* Quick Actions Sidebar */}
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 flex flex-col gap-2">
                                <button className="w-12 h-12 bg-white rounded-full shadow-[0_4px_20px_rgb(0,0,0,0.08)] flex items-center justify-center text-brand-gray hover:text-brand-leaf hover:scale-110 transition-all border border-brand-sage/20">
                                    <MessageSquare size={18} />
                                </button>
                                <button className="w-12 h-12 bg-white rounded-full shadow-[0_4px_20px_rgb(0,0,0,0.08)] flex items-center justify-center text-brand-gray hover:text-brand-leaf hover:scale-110 transition-all border border-brand-sage/20">
                                    <Printer size={18} />
                                </button>
                            </div>

                            <div className="flex items-center gap-3 mb-8">
                                <div className="bg-[#E8F1EB] p-2 rounded-full text-brand-leaf"><Edit3 size={18} /></div>
                                <h2 className="font-serif text-2xl text-brand-text">{t('recTitle')}</h2>
                            </div>

                            <div className="space-y-8 pr-8">
                                {/* Core Strategy */}
                                <div>
                                    <label className="block text-[10px] font-bold text-brand-gray uppercase tracking-widest mb-3">{t('rec1')}</label>
                                    <textarea
                                        className="w-full h-24 p-4 rounded-xl border border-brand-sage/50 text-sm focus:outline-none focus:border-brand-leaf focus:ring-1 focus:ring-brand-leaf transition-all resize-none placeholder:text-brand-gray/40 bg-[#FAFAFA]"
                                        placeholder={t('rec1P')}
                                    ></textarea>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Supplementation Protocol */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-brand-gray uppercase tracking-widest mb-3">{t('rec2')}</label>
                                        <textarea
                                            className="w-full h-32 p-4 rounded-xl border border-brand-sage/50 text-sm focus:outline-none focus:border-brand-leaf focus:ring-1 focus:ring-brand-leaf transition-all resize-none placeholder:text-brand-gray/40 bg-[#FAFAFA]"
                                            placeholder={t('rec2P')}
                                        ></textarea>
                                    </div>

                                    {/* Lifestyle */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-brand-gray uppercase tracking-widest mb-3">{t('rec3')}</label>
                                        <textarea
                                            className="w-full h-32 p-4 rounded-xl border border-brand-sage/50 text-sm focus:outline-none focus:border-brand-leaf focus:ring-1 focus:ring-brand-leaf transition-all resize-none placeholder:text-brand-gray/40 bg-[#FAFAFA]"
                                            placeholder={t('rec3P')}
                                        ></textarea>
                                    </div>
                                </div>

                                {/* Bottom Action Bar */}
                                <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center pt-8 border-t border-brand-sage/30 mt-8 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-bold text-brand-gray uppercase tracking-widest mb-3">{t('rec4')}</label>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center border border-brand-sage/50 rounded-lg px-3 py-2 bg-[#FAFAFA] min-w-[160px]">
                                                <CalendarPlus size={16} className="text-brand-gray mr-2" />
                                                <input type="date" className="bg-transparent text-sm text-brand-text focus:outline-none w-full appearance-none" />
                                            </div>
                                            <div className="flex items-center border border-brand-sage/50 rounded-lg px-3 py-2 bg-[#FAFAFA] min-w-[140px]">
                                                <Clock size={16} className="text-brand-gray mr-2" />
                                                <input type="time" className="bg-transparent text-sm text-brand-text focus:outline-none w-full" />
                                            </div>
                                        </div>
                                    </div>

                                    <button className="bg-brand-leaf hover:bg-brand-leaf-light text-white px-8 py-3.5 rounded-xl font-bold transition-colors text-sm shadow-sm whitespace-nowrap">
                                        {t('recBtn')}
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <div className="mt-16 text-center text-[10px] text-brand-gray/40 uppercase tracking-widest font-bold pb-8 border-t border-brand-sage/20 pt-8">
                    &copy; {new Date().getFullYear()} VI antiage &bull; {t('footer')}
                </div>
            </main>
        </div>
    );
}
