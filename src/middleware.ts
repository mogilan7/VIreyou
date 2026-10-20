import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { updateSession } from '@/utils/supabase/middleware';

const handleI18nRouting = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
    // 1. Run the i18n routing middleware to get the base response
    const i18nResponse = handleI18nRouting(request);

    // 2. Pass the request and the i18n response to the Supabase session updater
    const response = await updateSession(request, i18nResponse);

    // 3. Analytics: Session & UTM tracking
    try {
        const searchParams = request.nextUrl.searchParams;
        const utm_source = searchParams.get('utm_source');
        const utm_medium = searchParams.get('utm_medium');
        const utm_campaign = searchParams.get('utm_campaign');
        const utm_content = searchParams.get('utm_content');

        // Check or generate session_id
        let sid = request.cookies.get('vireyou_sid')?.value;
        const isNewSession = !sid;
        if (!sid) {
            sid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            response.cookies.set('vireyou_sid', sid, {
                maxAge: 30 * 24 * 60 * 60, // 30 days
                path: '/',
                sameSite: 'lax',
                httpOnly: false
            });
        }

        // Store UTM parameters for 30 days if present in query
        if (utm_source) {
            response.cookies.set('vireyou_utm_source', utm_source, { maxAge: 30 * 24 * 60 * 60, path: '/', sameSite: 'lax' });
        }
        if (utm_medium) {
            response.cookies.set('vireyou_utm_medium', utm_medium, { maxAge: 30 * 24 * 60 * 60, path: '/', sameSite: 'lax' });
        }
        if (utm_campaign) {
            response.cookies.set('vireyou_utm_campaign', utm_campaign, { maxAge: 30 * 24 * 60 * 60, path: '/', sameSite: 'lax' });
        }
        if (utm_content) {
            response.cookies.set('vireyou_utm_content', utm_content, { maxAge: 30 * 24 * 60 * 60, path: '/', sameSite: 'lax' });
        }
    } catch (e) {
        console.error('[MIDDLEWARE] Analytics cookie error:', e);
    }

    return response;
}

export const config = {
    // Match only internationalized pathnames
    // Add exclusions for static files, API routes, Next.js internals, etc.
    matcher: [
        "/",
        "/(ru|en)/:path*",
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
    ]
};
