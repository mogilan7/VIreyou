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
        const dashboardUrl = encodeURIComponent(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://vireyou.com'}/${locale}/cabinet/lifestyle`);
        
        if (actionLink.includes('redirect_to=')) {
            actionLink = actionLink.replace(/redirect_to=[^&]+/, `redirect_to=${dashboardUrl}`);
        } else {
            actionLink += `&redirect_to=${dashboardUrl}`;
        }

        // Redirect the user to the Supabase verification URL. 
        // It will set the cookies and then redirect them to the dashboard.
        return NextResponse.redirect(actionLink);

    } catch (error) {
        console.error('Seamless login error:', error);
        return NextResponse.redirect(new URL(`/${locale}/login?error=invalid_token`, req.url));
    }
}
