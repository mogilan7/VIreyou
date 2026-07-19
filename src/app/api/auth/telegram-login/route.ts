export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import prisma from '@/lib/prisma';


export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const locale = searchParams.get('locale') || 'ru';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vireyou.com';
    const dashboardUrl = `${siteUrl}/${locale}/cabinet/lifestyle`;

    // 1. Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceKey || !anonKey) {
        console.error('[AUTH] Missing Supabase env vars');
        return NextResponse.json({ error: 'Config error' }, { status: 500 });
    }

    if (!token) {
        return NextResponse.redirect(new URL(`/${locale}/login`, req.url));
    }

    try {
        const supabaseAdmin = createClient(supabaseUrl, serviceKey);

        // 2. Verify the JWT token from the bot
        const secret = process.env.JWT_SECRET || process.env.YOOKASSA_SECRET_KEY || 'default_secret';
        const decoded = jwt.verify(token, secret) as { email: string };

        if (!decoded || !decoded.email) {
            throw new Error('Invalid token');
        }

        const email = decoded.email;

        // 3. Generate a magic link to get a hashed_token
        let { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email,
        });

        // Auto-create user if not found
        if (linkError && (linkError.message.includes('User not found') || linkError.status === 422)) {
            const newUserRes = await supabaseAdmin.auth.admin.createUser({
                email,
                email_confirm: true,
                user_metadata: { source: 'telegram_bot' }
            });
            
            // 🚀 ID SYNC FIX: Ensure Prisma ID matches Supabase Auth ID
            // Also updates all FK references (ActivityLog, NutritionLog, etc.)
            if (newUserRes.data?.user?.id) {
                const newAuthId = newUserRes.data.user.id;
                try {
                    const prismaUser = await prisma.user.findFirst({ where: { email } });
                    if (prismaUser && prismaUser.id !== newAuthId) {
                        const oldId = prismaUser.id;
                        console.log(`[AUTH] Syncing Prisma ID from ${oldId} to ${newAuthId} for ${email}`);
                        // Disable FK checks, update all references atomically, re-enable
                        await prisma.$executeRaw`SET session_replication_role = replica`;
                        await prisma.$executeRaw`UPDATE public."ActivityLog"      SET user_id    = ${newAuthId}::uuid WHERE user_id    = ${oldId}`;
                        await prisma.$executeRaw`UPDATE public."HabitLog"         SET user_id    = ${newAuthId}::uuid WHERE user_id    = ${oldId}`;
                        await prisma.$executeRaw`UPDATE public."NutritionLog"     SET user_id    = ${newAuthId}::uuid WHERE user_id    = ${oldId}`;
                        await prisma.$executeRaw`UPDATE public."SleepLog"         SET user_id    = ${newAuthId}::uuid WHERE user_id    = ${oldId}`;
                        await prisma.$executeRaw`UPDATE public."HydrationLog"     SET user_id    = ${newAuthId}::uuid WHERE user_id    = ${oldId}`;
                        await prisma.$executeRaw`UPDATE public."BiomarkerResult"  SET user_id    = ${newAuthId}::uuid WHERE user_id    = ${oldId}`;
                        await prisma.$executeRaw`UPDATE public."HealthData"       SET user_id    = ${newAuthId}::uuid WHERE user_id    = ${oldId}`;
                        await prisma.$executeRaw`UPDATE public."MedicalDocument"  SET user_id    = ${newAuthId}::uuid WHERE user_id    = ${oldId}`;
                        await prisma.$executeRaw`UPDATE public."Transaction"      SET user_id    = ${newAuthId}::uuid WHERE user_id    = ${oldId}`;
                        await prisma.$executeRaw`UPDATE public."Consultation"     SET client_id  = ${newAuthId}::uuid WHERE client_id  = ${oldId}`;
                        await prisma.$executeRaw`UPDATE public."AccessPermission" SET user_id    = ${newAuthId}::uuid WHERE user_id    = ${oldId}`;
                        await prisma.$executeRaw`UPDATE public."SquadParticipant" SET user_id    = ${newAuthId}::uuid WHERE user_id    = ${oldId}`;
                        await prisma.$executeRaw`UPDATE public."Squad"            SET creator_id = ${newAuthId}::uuid WHERE creator_id = ${oldId}`;
                        await prisma.$executeRaw`UPDATE public."User"             SET referrer_id = ${newAuthId}::uuid WHERE referrer_id = ${oldId}`;
                        await prisma.$executeRaw`UPDATE public."User"             SET id = ${newAuthId}::uuid WHERE email = ${email}`;
                        await prisma.$executeRaw`SET session_replication_role = DEFAULT`;
                        console.log(`[AUTH] ✅ Full ID sync complete for ${email}`);
                    }
                } catch (syncErr) {
                    console.error('[AUTH] Failed to sync Prisma ID (full):', syncErr);
                    // Reset replication role in case of error
                    try { await prisma.$executeRaw`SET session_replication_role = DEFAULT`; } catch {}
                }
            }


            const retry = await supabaseAdmin.auth.admin.generateLink({
                type: 'magiclink',
                email,
            });
            linkData = retry.data;
            linkError = retry.error;
        }

        if (linkError || !linkData?.properties?.action_link) {
            console.error('[AUTH] Supabase generateLink error:', linkError);
            throw new Error('Link generation failed');
        }

        // 4. Extract token_hash and verify server-side to set cookies on vireyou.com
        const actionLink = linkData.properties.action_link;
        const actionUrl = new URL(actionLink);
        const tokenHash = actionUrl.searchParams.get('token');

        if (!tokenHash) {
            console.error('[AUTH] No token in action_link:', actionLink);
            throw new Error('Link parsing failed');
        }

        const { createClient: createServerClient } = await import('@/utils/supabase/server');
        const supabaseServer = await createServerClient();
        
        const { error: verifyError } = await supabaseServer.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'magiclink',
        });

        if (verifyError) {
            console.error('[AUTH] OTP verify error:', verifyError);
            throw new Error('OTP verification failed');
        }

        console.log(`[AUTH] Successfully logged in ${email} and set cookies.`);
        return NextResponse.redirect(dashboardUrl);

    } catch (err: any) {
        console.error('[AUTH] Error:', err.message);
        return NextResponse.redirect(new URL(`/${locale}/login?error=auth_failed`, req.url));
    }
}
