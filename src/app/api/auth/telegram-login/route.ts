import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
    // Initialize inside handler so env vars are available at runtime
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const locale = searchParams.get('locale') || 'ru';

    if (!token) {
        return NextResponse.redirect(new URL(`/${locale}/login`, req.url));
    }

    try {
        // 1. Verify the JWT token from the bot
        const secret = process.env.JWT_SECRET || process.env.YOOKASSA_SECRET_KEY || 'default_secret';
        const decoded = jwt.verify(token, secret) as { email: string };

        if (!decoded || !decoded.email) {
            throw new Error('Invalid token payload');
        }

        const email = decoded.email;

        // 2. Generate Magic Link via Supabase Admin
        // This is the simplest way: it sends a link or returns an action_link
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: email
        });

        if (error || !data.properties?.action_link) {
            console.error('Magic link generation failed:', error);
            // Fallback to login page if user not found or other error
            return NextResponse.redirect(new URL(`/${locale}/login?error=auth_failed`, req.url));
        }

        let actionLink = data.properties.action_link;
        
        // 3. Ensure the redirect back to the dashboard is correct
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vireyou.com';
        const dashboardUrl = encodeURIComponent(`${siteUrl}/${locale}/cabinet/lifestyle`);
        
        if (actionLink.includes('redirect_to=')) {
            actionLink = actionLink.replace(/redirect_to=[^&]+/, `redirect_to=${dashboardUrl}`);
        } else {
            actionLink += `&redirect_to=${dashboardUrl}`;
        }

        console.log(`[AUTH] Redirecting ${email} to magic link`);

        // Redirect directly to Supabase verification
        return NextResponse.redirect(actionLink);

    } catch (error: any) {
        console.error('Seamless login error:', error.message || error);
        return NextResponse.redirect(new URL(`/${locale}/login?error=invalid_token`, req.url));
    }
}
