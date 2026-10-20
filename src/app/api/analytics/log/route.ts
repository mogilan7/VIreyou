import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { event, path, meta } = body;

        if (!event) {
            return NextResponse.json({ error: 'Missing event' }, { status: 400 });
        }

        // 1. Resolve user if authenticated
        let userId: string | null = null;
        try {
            const supabase = await createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                userId = user.id;
            }
        } catch (e) {
            // Ignore auth error for anon
        }

        // 2. Resolve session ID from cookies or header or body
        const sidCookie = req.cookies.get('vireyou_sid')?.value;
        const sessionId = body.session_id || sidCookie || crypto.randomUUID();

        // 3. Resolve UTM parameters (body overrides cookies)
        const utm_source = body.utm_source || req.cookies.get('vireyou_utm_source')?.value || null;
        const utm_medium = body.utm_medium || req.cookies.get('vireyou_utm_medium')?.value || null;
        const utm_campaign = body.utm_campaign || req.cookies.get('vireyou_utm_campaign')?.value || null;
        const utm_content = body.utm_content || req.cookies.get('vireyou_utm_content')?.value || null;
        const source = body.source || 'portal';

        // 4. Record event in AnalyticsEvent
        const record = await prisma.analyticsEvent.create({
            data: {
                event: String(event).trim(),
                user_id: userId,
                session_id: sessionId,
                source: source,
                utm_source: utm_source,
                utm_medium: utm_medium,
                utm_campaign: utm_campaign,
                utm_content: utm_content,
                path: path || null,
                meta: meta || {}
            }
        });

        const res = NextResponse.json({ success: true, id: record.id, session_id: sessionId });

        // Ensure session cookie is saved
        if (!sidCookie) {
            res.cookies.set('vireyou_sid', sessionId, {
                maxAge: 30 * 24 * 60 * 60,
                path: '/',
                sameSite: 'lax',
                httpOnly: false // Accessible by client JS
            });
        }

        return res;
    } catch (error: any) {
        console.error('[ANALYTICS API] Error logging event:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
