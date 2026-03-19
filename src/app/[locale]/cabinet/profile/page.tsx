import React from 'react';
import Sidebar from "@/components/dashboard/Sidebar";
import ProfileForm from "./ProfileForm";
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import { getTranslations } from "next-intl/server";

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {

    const t = await getTranslations('ProfileSettings');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let profile = null;
    if (user) {
        profile = await prisma.profiles.findUnique({
            where: { id: user.id }
        });
    }


    const profileName = profile?.full_name || user?.user_metadata?.full_name || (user?.id === '00000000-0000-0000-0000-000000000000' || !user ? 'Пользователь' : 'Пользователь');


    return (
        <div className="min-h-screen bg-[#fcfdfc] flex">
            <Sidebar role="client" profileName={profileName} />
            <main className="lg:ml-64 flex-1 p-8 md:p-12 pl-12 max-w-[1400px] bg-[#fcfdfc] min-h-screen w-full pt-24 lg:pt-8">
                <header className="mb-10">
                    <h1 className="text-3xl font-serif text-brand-text mb-2 tracking-tight">
                        {t('title')}
                    </h1>
                    <p className="text-brand-gray text-sm">{t('subtitle')}</p>
                </header>

                <div className="bg-white p-8 rounded-3xl border border-brand-sage/40 shadow-sm max-w-2xl">
                    <ProfileForm initialProfile={profile} />
                </div>

                {/* Telegram Bot Connection Card */}
                {user?.email && (
                    <div className="bg-white p-8 rounded-3xl border border-brand-sage/40 shadow-sm max-w-2xl mt-8">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 rounded-2xl bg-teal-50 text-teal-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-brand-text">🤖 Telegram-ассистент</h3>
                                <p className="text-xs text-brand-gray">Мгновенный анализ питания, сна и воды</p>
                            </div>
                        </div>
                        <p className="text-sm text-brand-gray mb-6">
                            Подключите бота, чтобы отправлять отчеты прямо в мессенджер. Бот автоматически занесет данные в ваш календарь.
                        </p>
                        <a 
                            href={`https://t.me/SayAndSaveBot?start=${Buffer.from(user.email).toString('base64')}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center gap-2 px-6 py-3.5 bg-brand-leaf text-white rounded-2xl font-medium hover:bg-brand-leaf/90 transition-all shadow-sm hover:shadow-md active:scale-95"
                        >
                            🚀 Подключить Telegram-бота
                        </a>
                    </div>
                )}
            </main>
        </div>
    );
}
