import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase Admin client
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const locale = searchParams.get('locale') || 'ru';

    if (!token) {
        return NextResponse.redirect(new URL(`/${locale}/login`, req.url));
    }

    try {
        // 1. Verify the JWT token
        const secret = process.env.JWT_SECRET || process.env.YOOKASSA_SECRET_KEY || 'default_secret';
        const decoded = jwt.verify(token, secret) as { email: string };

        if (!decoded || !decoded.email) {
            throw new Error('Invalid token payload');
        }

        // 2. Generate Magic Link via Supabase Admin
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: decoded.email
        });

        if (error || !data.properties?.action_link) {
            console.error('Magic link generation failed:', error);
            return NextResponse.redirect(new URL(`/${locale}/login`, req.url));
        }

        // 3. We have the action link. But wait, the action_link redirects to what is configured in Supabase.
        // We want to make sure it redirects to the dashboard.
        // We can append &redirect_to=... to the action_link if Supabase allows it, 
        // or just rely on the default site url which usually goes to root, 
        // but we can enforce it by modifying the action_link.
        
        let actionLink = data.properties.action_link;
        
        // Supabase action_link includes redirect_to=http://localhost:3000 by default (from settings)
        // We want to replace it to point to the correct locale dashboard.
        // Supabase action_link includes redirect_to=... by default
        // We ensure it points to the cabinet for the given locale
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vireyou.com';
        const dashboardUrl = encodeURIComponent(`${siteUrl}/${locale}/cabinet/lifestyle`);
        
        if (actionLink.includes('redirect_to=')) {
            actionLink = actionLink.replace(/redirect_to=[^&]+/, `redirect_to=${dashboardUrl}`);
        } else {
            actionLink += `&redirect_to=${dashboardUrl}`;
        }

        console.log(`[AUTH] Redirecting user ${decoded.email} to magic link for seamless login`);

        // Creating response with the redirect
        const response = NextResponse.redirect(actionLink);
        
        // IMPORTANT: We don't manually clear cookies here because Supabase's actionLink 
        // will automatically overwrite the session cookies when the user hits the verification endpoint.
        
        return response;

    } catch (error: any) {
        console.error('Seamless login error:', error.message || error);
        // If token is invalid or expired, take them to login but with a hint
        return NextResponse.redirect(new URL(`/${locale}/login?error=auth_failed`, req.url));
    }
}
