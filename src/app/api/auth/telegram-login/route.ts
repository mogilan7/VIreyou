import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';
import { createSessionForUser } from '@/lib/auth/createSessionForUser';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const locale = searchParams.get('locale') || 'ru';
    const dashboardUrl = new URL(`/${locale}/cabinet/lifestyle`, req.url);

    // 1. Strict Secret Validation
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
        console.error('[CRITICAL] JWT_SECRET is not configured or too short (min 32 chars required)!');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (!token) {
        return NextResponse.redirect(new URL(`/${locale}/login`, req.url));
    }

    try {
        // 2. Verify JWT with strict secret (rejects any other signatures or expired tokens)
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

        // 3. Enforce single-use token via jti tracking
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

        // 4. Verify telegram_id match against database user if present
        const dbUser = await prisma.user.findFirst({ where: { email } });
        if (dbUser && dbUser.telegram_id && decoded.telegram_id) {
            if (String(dbUser.telegram_id) !== String(decoded.telegram_id)) {
                console.error(`[AUTH] Telegram ID mismatch for ${email}: token has ${decoded.telegram_id}, DB has ${dbUser.telegram_id}`);
                return NextResponse.redirect(new URL(`/${locale}/login?error=auth_failed`, req.url));
            }
        }

        // 5. Record jti as consumed
        const expiresAt = decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 15 * 60 * 1000);
        await prisma.$executeRaw`
            INSERT INTO public.used_auth_tokens (jti, user_id, expires_at)
            VALUES (${decoded.jti}, ${dbUser?.id || null}, ${expiresAt})
            ON CONFLICT (jti) DO NOTHING
        `;

        // 6. Establish session using shared helper
        const sessionResult = await createSessionForUser(email, decoded.telegram_id || null);

        if (!sessionResult.success) {
            console.error(`[AUTH] Session creation failed for ${email}:`, sessionResult.error);
            return NextResponse.redirect(new URL(`/${locale}/login?error=auth_failed`, req.url));
        }

        console.log(`[AUTH] Successfully authenticated ${email} via one-time Telegram link.`);
        return NextResponse.redirect(dashboardUrl);

    } catch (err: any) {
        console.error('[AUTH] Verification error:', err.message);
        return NextResponse.redirect(new URL(`/${locale}/login?error=auth_failed`, req.url));
    }
}
