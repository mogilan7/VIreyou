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

    // 1. Strict secret validation: ONLY JWT_SECRET, no fallbacks
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error('[AUTH CRITICAL] Missing JWT_SECRET environment variable');
        return NextResponse.json({ error: 'Server auth configuration error' }, { status: 500 });
    }

    // 2. Check Supabase environment variables
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
        // 3. Verify JWT with strict secret (rejects any other signatures)
        const decoded = jwt.verify(token, secret) as {
            email: string;
            telegram_id?: string;
            jti?: string;
            exp?: number;
        };

        if (!decoded || !decoded.email) {
            throw new Error('Invalid token: missing email');
        }

        const email = decoded.email;

        // 4. Enforce single-use token via jti tracking
        if (!decoded.jti) {
            console.error('[AUTH] Token rejected: missing jti claim');
            return NextResponse.redirect(new URL(`/${locale}/login?error=invalid_token`, req.url));
        }

        const alreadyUsed = await prisma.$queryRaw<any[]>`
            SELECT jti FROM public.used_auth_tokens WHERE jti = ${decoded.jti} LIMIT 1
        `;
        if (alreadyUsed && alreadyUsed.length > 0) {
            console.error(`[AUTH] Replay attempt rejected for jti: ${decoded.jti}`);
            return NextResponse.redirect(new URL(`/${locale}/login?error=token_already_used`, req.url));
        }

        // 5. Verify telegram_id match against database user
        const dbUser = await prisma.user.findFirst({ where: { email } });
        if (dbUser && dbUser.telegram_id && decoded.telegram_id) {
            if (String(dbUser.telegram_id) !== String(decoded.telegram_id)) {
                console.error(`[AUTH] Telegram ID mismatch for ${email}: token has ${decoded.telegram_id}, DB has ${dbUser.telegram_id}`);
                return NextResponse.redirect(new URL(`/${locale}/login?error=auth_failed`, req.url));
            }
        }

        // 6. Record jti as consumed
        const expiresAt = decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 15 * 60 * 1000);
        await prisma.$executeRaw`
            INSERT INTO public.used_auth_tokens (jti, user_id, expires_at)
            VALUES (${decoded.jti}, ${dbUser?.id || null}, ${expiresAt})
            ON CONFLICT (jti) DO NOTHING
        `;

        const supabaseAdmin = createClient(supabaseUrl, serviceKey);

        // 7. Generate magic link for Supabase authentication
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
            
            // Sync Prisma ID if needed
            if (newUserRes.data?.user?.id) {
                const newAuthId = newUserRes.data.user.id;
                try {
                    const prismaUser = await prisma.user.findFirst({ where: { email } });
                    if (prismaUser && prismaUser.id !== newAuthId) {
                        const oldId = prismaUser.id;
                        console.log(`[AUTH] Syncing Prisma ID from ${oldId} to ${newAuthId} for ${email}`);
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

        // 8. Extract token_hash and verify server-side to set cookies on vireyou.com
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

        console.log(`[AUTH] Successfully authenticated ${email} via one-time Telegram link.`);
        return NextResponse.redirect(dashboardUrl);

    } catch (err: any) {
        console.error('[AUTH] Verification error:', err.message);
        return NextResponse.redirect(new URL(`/${locale}/login?error=auth_failed`, req.url));
    }
}
