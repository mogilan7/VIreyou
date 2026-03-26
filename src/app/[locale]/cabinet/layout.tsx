import { redirect } from '@/i18n/routing';
import { createClient } from '@/utils/supabase/server';
import { DashboardThemeProvider, ThemeWrapper } from '@/components/dashboard/ThemeContext';
import React from 'react';

export default async function CabinetLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // If no user, redirect to login
    if (!user) {
        redirect({ href: '/login', locale });
    }

    return (
        <DashboardThemeProvider>
            <ThemeWrapper>
                <div className="min-h-screen font-sans w-full">
                    <div className="flex w-full">
                        {children}
                    </div>
                </div>
            </ThemeWrapper>
        </DashboardThemeProvider>
    );
}
