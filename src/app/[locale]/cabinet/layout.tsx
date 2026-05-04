import { redirect } from '@/i18n/routing';
import { createClient } from '@/utils/supabase/server';
import { DashboardThemeProvider, ThemeWrapper } from '@/components/dashboard/ThemeContext';
import prisma from '@/lib/prisma';
import React from 'react';
import { cookies } from 'next/headers';

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
        
        // Check for referral code in cookies
        const cookieStore = await cookies();
        const referralCode = cookieStore.get('referral_code')?.value;
        let referrerId = null;

        if (referralCode && referralCode !== user.id) {
            const referrer = await prisma.user.findUnique({
                where: { id: referralCode }
            });
            if (referrer) {
                referrerId = referrer.id;
                console.log(`[AUTH] Setting referrer ${referrerId} for new user ${user.email}`);
            }
        }

        await prisma.user.create({
            data: {
                id: user.id,
                email: user.email,
                role: 'client',
                full_name: user.user_metadata?.full_name || 'Пользователь',
                balance: 0,
                language: locale,
                referrer_id: referrerId
            }
        });
    } else if (dbUser) {
        // If user exists but has no referrer, check if we have a referral code in cookies
        if (!dbUser.referrer_id) {
            const cookieStore = await cookies();
            const referralCode = cookieStore.get('referral_code')?.value;
            
            if (referralCode && referralCode !== dbUser.id) {
                const referrer = await prisma.user.findUnique({
                    where: { id: referralCode }
                });
                if (referrer && referrer.id !== dbUser.id) {
                    console.log(`[AUTH] Updating referrer ${referrer.id} for existing user ${dbUser.email}`);
                    await prisma.user.update({
                        where: { id: dbUser.id },
                        data: { referrer_id: referrer.id }
                    });
                }
            }
        }

        if (dbUser.id !== user.id) {
            console.warn(`[AUTH] User ID mismatch for ${user.email}: Supabase=${user.id}, Prisma=${dbUser.id}`);
        }
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
