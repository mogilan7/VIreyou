import Sidebar from "@/components/dashboard/Sidebar";
import { Search, MapPin, User, ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from '@/utils/supabase/server';
import { Link } from "@/i18n/routing";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export const fetchCache = 'force-no-store';

export default async function ClientsPage() {
    const t = await getTranslations('Dashboard.Specialist');
    const supabase = await createClient();

    // Get current specialist
    const { data: { user } } = await supabase.auth.getUser();

    let isAdmin = false;
    let isSpecialist = false;
    let clients: any[] = [];

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
        try {
            const fetchedClients = await prisma.profiles.findMany({
                where: !isAdmin ? { assigned_specialist_id: user.id } : undefined
            });

            if (fetchedClients) {
                clients = fetchedClients;
                if (isAdmin) {
                    clients = clients.filter((c: any) => c.role !== 'specialist');
                }
            }
        } catch (e: any) {
            console.error("Prisma loading error List page:", e);
            clients = [];
        }


    } else {
        const { notFound } = require('next/navigation');
        return notFound();
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
                        <h1 className="text-3xl font-serif text-brand-text mb-2 tracking-tight">База Клиентов</h1>
                        <div className="flex items-center gap-2 text-sm text-brand-gray">
                            <div className="w-2 h-2 rounded-full bg-brand-leaf"></div>
                            Всего клиентов в системе: <span className="font-semibold text-brand-text">{clients.length}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-grow md:w-64">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gray/60" />
                            <input
                                type="text"
                                placeholder="Поиск клиента..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-full border border-brand-sage/50 text-sm focus:outline-none focus:border-brand-leaf transition-colors bg-white shadow-sm placeholder:text-brand-gray/50"
                            />
                        </div>
                    </div>
                </header>

                <div className="bg-white rounded-[2rem] border border-brand-sage/40 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-8 overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr>
                                    <th className="text-[10px] font-bold text-brand-gray uppercase tracking-widest pb-6 border-b border-brand-sage/20 font-sans">Имя</th>
                                    <th className="text-[10px] font-bold text-brand-gray uppercase tracking-widest pb-6 border-b border-brand-sage/20 font-sans">Город / Локация</th>
                                    <th className="text-[10px] font-bold text-brand-gray uppercase tracking-widest pb-6 border-b border-brand-sage/20 font-sans">Статус</th>
                                    <th className="text-[10px] font-bold text-brand-gray uppercase tracking-widest pb-6 border-b border-brand-sage/20 font-sans">Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clients.map((client) => (
                                    <tr key={client.id} className="group hover:bg-brand-bg/50 transition-colors">
                                        <td className="py-5 border-b border-brand-sage/20 font-bold text-sm text-brand-text group-last:border-0 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-brand-sage/20 flex items-center justify-center font-serif text-sm text-brand-gray overflow-hidden box-content border">
                                                {client.avatar_url ? (
                                                    <img src={client.avatar_url} alt={client.full_name || "Client"} className="w-full h-full object-cover rounded-full" />
                                                ) : (
                                                    client.full_name?.charAt(0) || '?'
                                                )}
                                            </div>
                                            {client.full_name || 'Без Имени'}
                                        </td>

                                        <td className="py-5 border-b border-brand-sage/20 text-sm text-brand-text group-last:border-0">
                                            <div className="flex items-center gap-1.5"><MapPin size={14} className="text-brand-gray" /> Remote</div>
                                        </td>
                                        <td className="py-5 border-b border-brand-sage/20 group-last:border-0">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${client.role === 'specialist' ? 'bg-orange-100 text-orange-700' : 'bg-[#E8F1EB] text-brand-leaf'}`}>
                                                {client.role === 'specialist' ? 'Специалист' : 'Клиент'}
                                            </span>
                                        </td>
                                        <td className="py-5 border-b border-brand-sage/20 group-last:border-0">
                                            <div className="flex items-center gap-2">
                                                <Link href={`/specialist?id=${client.id}`} className="text-xs font-bold text-brand-leaf hover:text-brand-forest transition-colors">
                                                    Открыть Карточку
                                                </Link>
                                                
                                                {isAdmin && client.role !== 'specialist' && (
                                                    <form action={async () => {
                                                        'use server';
                                                        const { grantSpecialistAccess } = require('@/app/actions/grant-access');
                                                        await grantSpecialistAccess(client.id);
                                                    }}>
                                                        <button type="submit" className="text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors flex items-center gap-1">
                                                            <ShieldAlert size={14} /> Назначить Специалистом
                                                        </button>
                                                    </form>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
