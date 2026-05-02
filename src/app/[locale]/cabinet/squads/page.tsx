import React from 'react';
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import Sidebar from '@/components/dashboard/Sidebar';
import { Users, Trophy, Flame, Plus } from 'lucide-react';
import SquadInviteButton from '@/components/dashboard/SquadInviteButton';

export default async function SquadsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
        return <div className="p-8">Пожалуйста, авторизуйтесь</div>;
    }

    const user = await prisma.user.findUnique({
        where: { email: authUser.email || undefined },
    });

    if (!user) {
         return <div className="p-8">Пользователь не найден</div>;
    }

    // Find all active squad participations
    const participations = await prisma.squadParticipant.findMany({
        where: { user_id: user.id, squad: { is_active: true } },
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

    const activeSquads = participations.map(p => p.squad);

    return (
        <div className="min-h-screen flex w-full bg-[#F7F5F0] dark:bg-[#0F172A] text-[#2D2D2D] dark:text-white font-sans relative pb-24">
            <Sidebar role="client" profileName={user.full_name || "Пользователь"} />

            <main className="flex-1 lg:ml-64 px-4 md:px-8 pt-8 space-y-8 w-full max-w-4xl mx-auto min-w-0">
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="font-serif text-3xl font-bold tracking-tight">Марафоны</h1>
                        <p className="text-slate-500 text-sm">Ваши активные группы и результаты</p>
                    </div>
                    <CreateSquadButton />
                </header>

                {activeSquads.length === 0 ? (
                    <section className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm text-center space-y-6">
                        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto text-blue-500">
                            <Users size={32} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold mb-2">У вас нет активного Марафона</h2>
                            <p className="text-slate-500 text-sm">Создайте свой 7-дневный челлендж или попросите друга прислать приглашение, чтобы соревноваться вместе!</p>
                        </div>
                        <CreateSquadButton />
                    </section>
                ) : (
                    <div className="space-y-12">
                        {activeSquads.map((squad) => {
                            const isCreator = squad.creator_id === user.id;
                            const daysLeft = Math.max(0, Math.ceil((new Date(squad.end_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)));

                            return (
                                <div key={squad.id} className="space-y-6">
                                    <section className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 opacity-10">
                                            <Trophy size={160} className="-mr-10 -mt-10" />
                                        </div>
                                        <div className="relative z-10">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 text-indigo-100 text-xs font-bold uppercase tracking-wider">
                                                    <Flame size={14} className="text-orange-300" /> 
                                                    {isCreator ? 'Мой марафон' : 'Участие'}
                                                </div>
                                                <span className="bg-white/20 px-2 py-1 rounded text-[10px] font-bold">
                                                    {daysLeft} {daysLeft === 1 ? 'день' : daysLeft > 1 && daysLeft < 5 ? 'дня' : 'дней'} до конца
                                                </span>
                                            </div>
                                            <h2 className="text-3xl font-bold mb-1">{squad.name}</h2>
                                            
                                            <div className="flex flex-col sm:flex-row gap-3 mt-6">
                                                <SquadInviteButton 
                                                    squadId={squad.id} 
                                                    className="bg-white text-indigo-600 hover:bg-indigo-50 transition-colors py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm shadow-sm w-full sm:w-auto"
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    <section className="space-y-4">
                                        <h3 className="font-bold text-xl flex items-center gap-2 px-2">
                                            🏆 Таблица лидеров
                                        </h3>
                                        
                                        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden">
                                            {squad.participants.map((p: any, index: number) => (
                                                <div key={p.id} className={`flex items-center justify-between p-4 ${index !== squad.participants.length - 1 ? 'border-b border-slate-100 dark:border-white/5' : ''} ${p.user_id === user.id ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}>
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg">
                                                            {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : <span className="text-slate-400 text-sm">{index + 1}</span>}
                                                        </div>
                                                        <div>
                                                            <p className={`font-bold flex items-center gap-2 ${p.user_id === user.id ? 'text-indigo-600 dark:text-indigo-400' : ''}`}>
                                                                {p.user.full_name || p.user.email?.split('@')[0]}
                                                                {p.user_id === user.id && <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900 px-1.5 py-0.5 rounded uppercase">Вы</span>}
                                                            </p>
                                                            {(p.user as any).telegram_username && (
                                                                <p className="text-[10px] text-slate-400 -mt-0.5">@{ (p.user as any).telegram_username }</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <div className="text-right">
                                                            <p className="font-bold text-lg text-slate-700 dark:text-slate-300 leading-none">
                                                                {p.score}
                                                            </p>
                                                            <p className="text-[10px] font-normal opacity-50 uppercase tracking-tighter">баллов</p>
                                                        </div>
                                                        {isCreator && p.user_id !== user.id && (
                                                            <RemoveParticipantButton 
                                                                squadId={squad.id} 
                                                                participantId={p.user_id} 
                                                                userName={p.user.full_name || 'Участник'} 
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </div>
                            );
                        })}
                        
                        <p className="text-xs text-slate-400 text-center px-4 max-w-md mx-auto">
                            Баллы начисляются автоматически каждый день за выполнение норм сна, воды и ведение дневника питания. 
                            Обновление происходит в 07:00.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}
                    Баллы начисляются автоматически каждый день за выполнение норм сна, воды и ведение дневника питания.
                            </p>
                        </section>
                    </>
                )}

            </main>
        </div>
    );
}
