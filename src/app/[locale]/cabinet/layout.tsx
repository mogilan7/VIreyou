import { redirect } from '@/i18n/routing';
import { createClient } from '@/utils/supabase/server';
import { DashboardThemeProvider, ThemeWrapper } from '@/components/dashboard/ThemeContext';
import PublicNavbar from '@/components/layout/PublicNavbar';
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
                <div className="min-h-screen font-sans">
                    <PublicNavbar />
                    <div className="flex pt-24 lg:pt-0">
                        {children}
                    </div>
                </div>
            </ThemeWrapper>
        </DashboardThemeProvider>
    );
}
