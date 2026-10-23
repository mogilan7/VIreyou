import { createClient } from '@supabase/supabase-js';
import prisma from '@/lib/prisma';
import { createClient as createServerClient } from '@/utils/supabase/server';

export interface CreateSessionResult {
    success: boolean;
    error?: string;
    userId?: string;
    email?: string;
}

export async function createSessionForUser(
    email: string,
    expectedTelegramId?: string | null
): Promise<CreateSessionResult> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
        console.error('[AUTH] Missing Supabase environment variables');
        return { success: false, error: 'Server configuration error' };
    }

    const supabaseServer = await createServerClient();

    // 1. Check if a different user session currently exists on browser cookies
    try {
        const { data: { user: currentUser } } = await supabaseServer.auth.getUser();
        if (currentUser) {
            let shouldSignOut = false;
            if (currentUser.email && currentUser.email.toLowerCase() !== email.toLowerCase()) {
                shouldSignOut = true;
            } else if (expectedTelegramId) {
                const dbCurrent = await prisma.user.findFirst({ where: { email: currentUser.email } });
                if (dbCurrent?.telegram_id && String(dbCurrent.telegram_id) !== String(expectedTelegramId)) {
                    shouldSignOut = true;
                }
            }

            if (shouldSignOut) {
                console.log(`[AUTH] Different user session detected (${currentUser.email} vs ${email}). Signing out previous session.`);
                await supabaseServer.auth.signOut();
            }
        }
    } catch (e) {
        console.warn('[AUTH] Warning checking active session:', e);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // 2. Generate magic link for Supabase authentication
    let { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
    });

    // Auto-create user in Supabase auth.users if not found
    if (linkError && (linkError.message?.includes('User not found') || linkError.status === 422 || (linkError as any).code === 'user_not_found')) {
        console.log(`[AUTH] User ${email} not found in Supabase Auth. Auto-creating auth user...`);
        const newUserRes = await supabaseAdmin.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { source: 'telegram_bot' }
        });

        if (newUserRes.error) {
            console.error('[AUTH] Failed to create auth user:', newUserRes.error);
            return { success: false, error: newUserRes.error.message };
        }

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
                console.error('[AUTH] Failed to sync Prisma ID:', syncErr);
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

    if (linkError || !linkData?.properties) {
        console.error('[AUTH] Supabase generateLink error:', linkError);
        return { success: false, error: 'Link generation failed' };
    }

    // 3. Extract token_hash and verify OTP to set session cookies
    const properties = linkData.properties as any;
    let tokenHash = properties.hashed_token;

    if (!tokenHash && properties.action_link) {
        const actionUrl = new URL(properties.action_link);
        tokenHash = actionUrl.searchParams.get('token') || actionUrl.searchParams.get('token_hash');
    }

    if (!tokenHash) {
        console.error('[AUTH] No token in linkData properties:', properties);
        return { success: false, error: 'Link parsing failed' };
    }

    const otpType = (properties.verification_type as any) || 'magiclink';

    const { error: verifyError } = await supabaseServer.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType,
    });

    if (verifyError) {
        console.error(`[AUTH] OTP verify error (type: ${otpType}):`, verifyError);
        return { success: false, error: verifyError.message };
    }

    console.log(`[AUTH] Successfully established Supabase session for ${email}`);
    return { success: true, email };
}
