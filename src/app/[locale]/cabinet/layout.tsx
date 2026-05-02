import { redirect } from '@/i18n/routing';
import { createClient } from '@/utils/supabase/server';
import { DashboardThemeProvider, ThemeWrapper } from '@/components/dashboard/ThemeContext';
import prisma from '@/lib/prisma';
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

    // Sync with Prisma: Ensure a user record exists in the database
    // We use email as the primary lookup to avoid conflicts if IDs ever get out of sync,
    // but we use the Supabase ID as the record ID for consistency.
    const dbUser = await prisma.user.findUnique({
        where: { email: user.email || '' }
    });

    if (!dbUser && user.email) {
        console.log(`[AUTH] Syncing new user to Prisma: ${user.email}`);
        await prisma.user.create({
            data: {
                id: user.id,
                email: user.email,
                role: 'client',
                full_name: user.user_metadata?.full_name || 'Пользователь',
                balance: 0,
                language: locale
            }
        });
    } else if (dbUser && dbUser.id !== user.id) {
        // Optional: Update ID if it's different (e.g. if we used email-only lookup before)
        // But usually we don't want to change IDs.
        console.warn(`[AUTH] User ID mismatch for ${user.email}: Supabase=${user.id}, Prisma=${dbUser.id}`);
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
