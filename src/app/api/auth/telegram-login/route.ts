import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const locale = searchParams.get('locale') || 'ru';

    // 1. Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
        console.error('[AUTH] Missing critical env vars for seamless login');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
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
            throw new Error('Invalid token payload');
        }

        const email = decoded.email;

        // 3. Try generating the link. This might fail if user doesn't exist.
        let { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: email
        });

        // 4. If user not found, create them and try again
        if (error && (error.message.includes('User not found') || error.status === 422)) {
            console.log(`[AUTH] User ${email} not found, creating...`);
            const { error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                email_confirm: true,
                user_metadata: { source: 'telegram_bot' }
            });
            
            if (!createError) {
                const retry = await supabaseAdmin.auth.admin.generateLink({
                    type: 'magiclink',
                    email: email
                });
                data = retry.data;
                error = retry.error;
            } else {
                console.error('[AUTH] Failed to create user:', createError);
            }
        }

        if (error || !data?.properties?.action_link) {
            console.error('[AUTH] Magic link failed:', error);
            return NextResponse.redirect(new URL(`/${locale}/login?error=auth_failed`, req.url));
        }

        let actionLink = data.properties.action_link;
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vireyou.com';
        const dashboardUrl = encodeURIComponent(`${siteUrl}/${locale}/cabinet/lifestyle`);
        
        if (actionLink.includes('redirect_to=')) {
            actionLink = actionLink.replace(/redirect_to=[^&]+/, `redirect_to=${dashboardUrl}`);
        } else {
            actionLink += `&redirect_to=${dashboardUrl}`;
        }

        console.log(`[AUTH] Successful login for ${email}, redirecting...`);
        return NextResponse.redirect(actionLink);

    } catch (err: any) {
        console.error('[AUTH] Critical error:', err.message);
        return NextResponse.redirect(new URL(`/${locale}/login?error=error`, req.url));
    }
}
