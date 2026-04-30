import React from 'react';
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import Sidebar from '@/components/dashboard/Sidebar';
import { Users, Trophy, Flame, Share2, Plus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import SquadInviteButton from '@/components/dashboard/SquadInviteButton';

export default async function SquadsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
        return <div className="p-8">Please log in</div>;
    }

    const user = await prisma.user.findUnique({
        where: { email: authUser.email || undefined },
    });

    if (!user) {
         return <div className="p-8">User not found</div>;
    }

    // Find active squad participation
    const participant = await prisma.squadParticipant.findFirst({
        where: { user_id: user.id },
        include: { 
            squad: {
                include: {
                    participants: {
                        include: { user: true },
                        orderBy: { score: 'desc' }
                    }
                }
            }
        },
        orderBy: { joined_at: 'desc' }
    });

    const activeSquad = participant?.squad?.is_active ? participant.squad : null;

    return (
        <div className="min-h-screen flex w-full bg-[#F7F5F0] dark:bg-[#0F172A] text-[#2D2D2D] dark:text-white font-sans relative pb-24">
            <Sidebar role="client" profileName={user.full_name || "Пользователь"} />

            <main className="flex-1 lg:ml-64 px-4 md:px-8 pt-8 space-y-6 w-full max-w-4xl mx-auto min-w-0">
                <header className="space-y-2">
                    <h1 className="font-serif text-3xl font-bold tracking-tight">Squads</h1>
                    <p className="text-slate-500 text-sm">Марафоны и челленджи с друзьями</p>
                </header>

                {!activeSquad ? (
                    <section className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm text-center space-y-6">
                        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto text-blue-500">
                            <Users size={32} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold mb-2">У вас нет активного Сквада</h2>
                            <p className="text-slate-500 text-sm">Создайте свой 7-дневный челлендж или попросите друга прислать приглашение, чтобы соревноваться вместе!</p>
                        </div>
                        <button className="bg-[#60B76F] hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-2xl inline-flex items-center gap-2 transition-colors w-full sm:w-auto justify-center shadow-lg shadow-[#60B76F]/30">
                            <Plus size={20} />
                            Создать Squad
                        </button>
                    </section>
                ) : (
                    <>
                        <section className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 opacity-10">
                                <Trophy size={160} className="-mr-10 -mt-10" />
                            </div>
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 text-indigo-100 text-xs font-bold uppercase tracking-wider mb-2">
                                    <Flame size={14} className="text-orange-300" /> Активный челлендж
                                </div>
                                <h2 className="text-3xl font-bold mb-1">{activeSquad.name}</h2>
                                <p className="text-indigo-100 text-sm">
                                    До конца: {Math.max(0, Math.ceil((new Date(activeSquad.end_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)))} дней
                                </p>
                                
                                <SquadInviteButton 
                                    squadId={activeSquad.id} 
                                    className="mt-6 bg-white text-indigo-600 hover:bg-indigo-50 transition-colors py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm shadow-sm w-full sm:w-auto"
                                />
                            </div>
                        </section>

                        <section className="space-y-4 pt-2">
                            <h3 className="font-bold text-xl flex items-center gap-2">
                                🏆 Таблица лидеров
                            </h3>
                            
                            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden">
                                {activeSquad.participants.map((p: any, index: number) => (
                                    <div key={p.id} className={`flex items-center justify-between p-4 ${index !== activeSquad.participants.length - 1 ? 'border-b border-slate-100 dark:border-white/5' : ''} ${p.user_id === user.id ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg">
                                                {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : <span className="text-slate-400 text-sm">{index + 1}</span>}
                                            </div>
                                            <div>
                                                <p className={`font-bold ${p.user_id === user.id ? 'text-indigo-600 dark:text-indigo-400' : ''}`}>
                                                    {p.user.full_name || p.user.email?.split('@')[0]}
                                                    {p.user_id === user.id && ' (Вы)'}
                                                </p>
                                                <p className="text-xs text-slate-500">{p.score} баллов</p>
                                            </div>
                                        </div>
                                        <div className="font-bold text-lg text-slate-700 dark:text-slate-300">
                                            {p.score}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <p className="text-xs text-slate-400 text-center px-4">
                                Баллы начисляются автоматически каждый день за выполнение норм сна, воды и ведение дневника питания.
                            </p>
                        </section>
                    </>
                )}

            </main>
        </div>
    );
}
