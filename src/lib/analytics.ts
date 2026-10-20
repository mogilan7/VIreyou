"use client";

export function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
}

export async function trackEvent(
    event: string, 
    meta: Record<string, any> = {},
    source: string = 'portal'
) {
    if (typeof window === 'undefined') return;

    try {
        const path = window.location.pathname;
        const sid = getCookie('vireyou_sid') || '';

        await fetch('/api/analytics/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event,
                path,
                source,
                meta,
                session_id: sid
            }),
            keepalive: true
        });
    } catch (e) {
        console.warn('[ANALYTICS] Failed to send event:', event, e);
    }
}

export function trackPortalVisit() {
    if (typeof window === 'undefined') return;
    const sessionKey = 'vireyou_portal_visited';
    if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, '1');
        trackEvent('portal_visit', {
            referrer: document.referrer || null,
            userAgent: navigator.userAgent
        });
    }
}

export function trackTestStart(testType: string) {
    trackEvent('test_start', { testType });
}

export function trackTestComplete(testType: string, score: number | null, interpretation: string | null, isAnonymous: boolean) {
    trackEvent('test_complete', {
        testType,
        score,
        interpretation,
        is_anonymous: isAnonymous
    });
}

export function trackPaywallView(location: string) {
    trackEvent('paywall_view', { location });
}

export function trackCheckoutClick(plan: string, method: string, amount: number) {
    trackEvent('checkout_click', { plan, method, amount });
}
