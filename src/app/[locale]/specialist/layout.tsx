import { redirect } from '@/i18n/routing';
import { createClient } from '@/utils/supabase/server';
import { DashboardThemeProvider, ThemeWrapper } from '@/components/dashboard/ThemeContext';
import PublicNavbar from '@/components/layout/PublicNavbar';
import React from 'react';

export default async function SpecialistLayout({
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

    // In a real application, you might also check if the user has the 'specialist' role here
    // by fetching their entry from the 'profiles' table.

    return (
        <DashboardThemeProvider>
            <ThemeWrapper>
                <div className="min-h-screen font-sans">
                    <PublicNavbar />
                    <div className="pt-24 lg:pt-0">
                        {children}
                    </div>
                </div>
            </ThemeWrapper>
        </DashboardThemeProvider>
    );
}
