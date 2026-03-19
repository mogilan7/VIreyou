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
            </main>
        </div>
    );
}
