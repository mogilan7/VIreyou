import { NextRequest, NextResponse } from 'next/server';
import { validate } from '@telegram-apps/init-data-node';
import { checkRateLimit } from '@/lib/rateLimit';
import { findOrCreateTelegramUser } from '@/lib/auth/telegramUser';
import { createSessionForUser } from '@/lib/auth/createSessionForUser';

export async function POST(req: NextRequest) {
    // 1. Rate limiting (max 10 req/min per IP)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               req.headers.get('x-real-ip') || 
               '127.0.0.1';

    const rateCheck = checkRateLimit(ip, { intervalMs: 60_000, maxRequests: 10 });
    if (!rateCheck.success) {
        console.warn(`[MINIAPP_AUTH] Rate limit exceeded for IP: ${ip}`);
        return NextResponse.json(
            { error: 'Too many requests. Please try again in a minute.' },
            { status: 429, headers: { 'Retry-After': '60' } }
        );
    }

    // 2. Read body
    let body: { initData?: string; locale?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { initData, locale = 'ru' } = body;
    if (!initData) {
        return NextResponse.json({ error: 'Missing initData' }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        console.error('[MINIAPP_AUTH] TELEGRAM_BOT_TOKEN is not configured');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // 3. Validate initData using @telegram-apps/init-data-node with 1 hour expiration
    try {
        validate(initData, botToken, { expiresIn: 3600 });
    } catch (valErr: any) {
        console.warn('[MINIAPP_AUTH] Signature validation failed:', valErr?.message || valErr);
        return NextResponse.json({ error: 'Invalid or expired Telegram data' }, { status: 401 });
    }

    // 4. Extract user object from initData
    let tgUser: any = null;
    try {
        const urlParams = new URLSearchParams(initData);
        const userJson = urlParams.get('user');
        if (userJson) {
            tgUser = JSON.parse(userJson);
        }
    } catch (parseErr: any) {
        console.error('[MINIAPP_AUTH] Failed to parse user from initData:', parseErr?.message);
        return NextResponse.json({ error: 'Invalid user payload' }, { status: 400 });
    }

    if (!tgUser || !tgUser.id) {
        console.warn('[MINIAPP_AUTH] Missing user.id in initData');
        return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
    }

    const tgIdStr = String(tgUser.id);

    try {
        // 5. Find or create user identically to /start (with 3-day trial and bot_signup event)
        const user = await findOrCreateTelegramUser({
            id: tgIdStr,
            username: tgUser.username,
            first_name: tgUser.first_name,
            last_name: tgUser.last_name,
            language_code: tgUser.language_code
        }, {
            source: 'miniapp'
        });

        // 6. Establish Supabase session for user (signOut previous session if mismatched)
        const sessionResult = await createSessionForUser(user.email, tgIdStr);

        if (!sessionResult.success) {
            console.error(`[MINIAPP_AUTH] Session creation failed for ${user.email}:`, sessionResult.error);
            return NextResponse.json({ error: sessionResult.error || 'Authentication failed' }, { status: 401 });
        }

        console.log(`[MINIAPP_AUTH] ✅ Successfully authenticated user ${user.email} (tg: ${tgIdStr})`);
        return NextResponse.json({
            success: true,
            redirect: `/${locale}/cabinet/lifestyle`
        });
    } catch (err: any) {
        console.error('[MINIAPP_AUTH] Unexpected error:', err?.message || err);
        return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
    }
}
