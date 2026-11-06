import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { headers } from 'next/headers';

export async function getClientIp(): Promise<string> {
    try {
        const headerList = await headers();
        const forwardedFor = headerList.get('x-forwarded-for');
        if (forwardedFor) {
            return forwardedFor.split(',')[0].trim();
        }
        const realIp = headerList.get('x-real-ip');
        if (realIp) {
            return realIp.trim();
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
 * Uses atomic UPSERT in PostgreSQL.
 * @param key SHA-256 hash identifying (IP/email + action)
 * @param limit Maximum allowed events within the window
 * @param windowSeconds Window duration in seconds
 */
export async function checkDbRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
    try {
        const result: any = await prisma.$queryRawUnsafe(
            `
            INSERT INTO public."RateLimit" (key, count, window_start, expires_at)
            VALUES ($1, 1, timezone('utc'::text, now()), timezone('utc'::text, now()) + ($2 || ' seconds')::interval)
            ON CONFLICT (key) DO UPDATE
            SET 
              count = CASE 
                WHEN public."RateLimit".expires_at <= timezone('utc'::text, now()) THEN 1 
                ELSE public."RateLimit".count + 1 
              END,
              window_start = CASE 
                WHEN public."RateLimit".expires_at <= timezone('utc'::text, now()) THEN timezone('utc'::text, now()) 
                ELSE public."RateLimit".window_start 
              END,
              expires_at = CASE 
                WHEN public."RateLimit".expires_at <= timezone('utc'::text, now()) THEN timezone('utc'::text, now()) + ($2 || ' seconds')::interval 
                ELSE public."RateLimit".expires_at 
              END
            RETURNING count;
            `,
            key,
            windowSeconds
        );

        if (result && result.length > 0) {
            const currentCount = Number(result[0].count);
            return {
                allowed: currentCount <= limit,
                remaining: Math.max(0, limit - currentCount)
            };
        }
    } catch (err: any) {
        // If table doesn't exist yet before migration execution, log warning and allow request
        console.warn('[RATE_LIMIT] RateLimit table query error (migration pending?):', err?.message || err);
        return { allowed: true, remaining: limit };
    }

    return { allowed: true, remaining: limit };
}

