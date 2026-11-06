import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { headers } from 'next/headers';

let requestCounter = 0;

/**
 * Periodically cleans up expired rate limit entries older than 1 day.
 * Executed asynchronously every 100 calls without blocking the request.
 */
async function maybeCleanupExpiredRecords() {
    requestCounter++;
    if (requestCounter % 100 === 0) {
        try {
            await prisma.$executeRaw`
                DELETE FROM public."RateLimit"
                WHERE expires_at < timezone('utc'::text, now()) - interval '1 day'
            `;
        } catch (e) {
            console.warn('[RATE_LIMIT] Automatic expired records cleanup error:', e);
        }
    }
}

/**
 * Extracts the real client IP address.
 * On Vercel, `x-real-ip` or `x-vercel-forwarded-for` is injected by the trusted edge reverse proxy
 * and cannot be spoofed by prepending addresses in `x-forwarded-for`.
 */
export async function getClientIp(): Promise<string> {
    try {
        const headerList = await headers();
        
        // 1. Trusted Vercel Edge IP headers
        const realIp = headerList.get('x-real-ip');
        if (realIp) {
            return realIp.trim();
        }

        const vercelForwarded = headerList.get('x-vercel-forwarded-for');
        if (vercelForwarded) {
            // First IP in x-vercel-forwarded-for is set by Vercel edge
            return vercelForwarded.split(',')[0].trim();
        }

        // 2. Standard x-forwarded-for: take the rightmost (closest proxy) to prevent client spoofing
        const forwardedFor = headerList.get('x-forwarded-for');
        if (forwardedFor) {
            const parts = forwardedFor.split(',');
            return parts[parts.length - 1].trim();
        }
    } catch {
        // Fallback when headers() is unavailable
    }
    return '127.0.0.1';
}

export function hashRateLimitKey(identifier: string, action: string): string {
    return crypto.createHash('sha256').update(`${identifier}:${action}`).digest('hex');
}

/**
 * Checks and increments rate limit in public."RateLimit" table.
 * Uses atomic UPSERT in PostgreSQL via $queryRaw.
 *
 * @param key SHA-256 hash identifying (IP/email + action)
 * @param limit Maximum allowed events within the window
 * @param windowSeconds Window duration in seconds
 * @param failMode 'fail-closed' (reject if DB fails, for email) | 'fail-open' (allow if DB fails, for reports/contacts)
 */
export async function checkDbRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
    failMode: 'fail-closed' | 'fail-open' = 'fail-open'
): Promise<{ allowed: boolean; remaining: number }> {
    // Schedule non-blocking cleanup check
    maybeCleanupExpiredRecords().catch(() => {});

    try {
        const result = await prisma.$queryRaw<Array<{ count: number }>>`
            INSERT INTO public."RateLimit" (key, count, window_start, expires_at)
            VALUES (
                ${key}, 
                1, 
                timezone('utc'::text, now()), 
                timezone('utc'::text, now()) + (${windowSeconds} * interval '1 second')
            )
            ON CONFLICT (key) DO UPDATE
            SET 
              count = CASE 
                WHEN public."RateLimit".expires_at < timezone('utc'::text, now()) THEN 1 
                ELSE public."RateLimit".count + 1 
              END,
              window_start = CASE 
                WHEN public."RateLimit".expires_at < timezone('utc'::text, now()) THEN timezone('utc'::text, now()) 
                ELSE public."RateLimit".window_start 
              END,
              expires_at = CASE 
                WHEN public."RateLimit".expires_at < timezone('utc'::text, now()) THEN timezone('utc'::text, now()) + (${windowSeconds} * interval '1 second') 
                ELSE public."RateLimit".expires_at 
              END
            RETURNING count;
        `;

        if (result && result.length > 0) {
            const currentCount = Number(result[0].count);
            return {
                allowed: currentCount <= limit,
                remaining: Math.max(0, limit - currentCount)
            };
        }
    } catch (err: any) {
        console.error(`[RATE_LIMIT] Database rate limit query failed (mode=${failMode}):`, err?.message || err);
        if (failMode === 'fail-closed') {
            return { allowed: false, remaining: 0 };
        }
        return { allowed: true, remaining: limit };
    }

    return { allowed: true, remaining: limit };
}
