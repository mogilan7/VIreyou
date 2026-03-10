import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { updateSession } from '@/utils/supabase/middleware';

const handleI18nRouting = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
    // 1. Run the i18n routing middleware to get the base response
    const response = handleI18nRouting(request);

    // 2. Pass the request and the i18n response to the Supabase session updater
    return await updateSession(request, response);
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
