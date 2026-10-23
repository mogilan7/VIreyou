interface RateLimitOptions {
    intervalMs: number;
    maxRequests: number;
}

const ipMap = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
    const timer = setInterval(() => {
        const now = Date.now();
        for (const [ip, entry] of ipMap.entries()) {
            if (now > entry.resetAt) {
                ipMap.delete(ip);
            }
        }
    }, 5 * 60 * 1000);
    if (timer.unref) timer.unref();
}

export function checkRateLimit(
    ip: string,
    options: RateLimitOptions = { intervalMs: 60_000, maxRequests: 10 }
): { success: boolean; remaining: number } {
    const now = Date.now();
    const entry = ipMap.get(ip);

    if (!entry || now > entry.resetAt) {
        ipMap.set(ip, { count: 1, resetAt: now + options.intervalMs });
        return { success: true, remaining: options.maxRequests - 1 };
    }

    if (entry.count >= options.maxRequests) {
        return { success: false, remaining: 0 };
    }

    entry.count += 1;
    return { success: true, remaining: options.maxRequests - entry.count };
}
