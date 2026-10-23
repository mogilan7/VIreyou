'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function TelegramMiniAppAutoLogin({ locale = 'ru' }: { locale?: string }) {
    const router = useRouter();
    const pathname = usePathname() || '';
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [statusText, setStatusText] = useState(locale === 'en' ? 'Opening cabinet…' : 'Открываю кабинет…');

    useEffect(() => {
        let isMounted = true;

        const checkAndAuth = () => {
            // @ts-ignore
            const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
            if (!tg || !tg.initData || tg.initData.length === 0) {
                return;
            }

            try {
                tg.ready();
                tg.expand();
            } catch {}

            // Extract user id from initDataUnsafe if available
            const tgUser = tg.initDataUnsafe?.user;
            const tgUserId = tgUser?.id ? String(tgUser.id) : null;

            // If we are on /login or session hasn't been confirmed for this tg user
            const lastAuthedUser = typeof window !== 'undefined' ? sessionStorage.getItem('tg_authed_user') : null;
            const isOnLoginPage = pathname.includes('/login');

            // If already authed in this session and not on login page, skip
            if (lastAuthedUser && tgUserId && lastAuthedUser === tgUserId && !isOnLoginPage) {
                return;
            }

            if (isMounted) {
                setIsAuthenticating(true);
            }

            fetch('/api/auth/telegram-miniapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: tg.initData, locale })
            })
            .then(res => res.json())
            .then(data => {
                if (!isMounted) return;
                if (data.success && data.redirect) {
                    if (tgUserId) {
                        try {
                            sessionStorage.setItem('tg_authed_user', tgUserId);
                        } catch {}
                    }
                    // Hard navigation ensures Server Components re-read Supabase cookies
                    if (pathname !== data.redirect) {
                        window.location.href = data.redirect;
                    } else {
                        setIsAuthenticating(false);
                        router.refresh();
                    }
                } else {
                    console.warn('[TelegramAutoLogin] Auth failed:', data.error);
                    setIsAuthenticating(false);
                }
            })
            .catch(err => {
                console.error('[TelegramAutoLogin] Request error:', err);
                if (isMounted) {
                    setIsAuthenticating(false);
                }
            });
        };

        // Run immediately or on window load
        checkAndAuth();
        window.addEventListener('load', checkAndAuth);

        return () => {
            isMounted = false;
            window.removeEventListener('load', checkAndAuth);
        };
    }, [locale, pathname, router]);

    if (!isAuthenticating) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md transition-opacity duration-300">
            <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-card border border-border/50 shadow-2xl max-w-sm text-center animate-in fade-in zoom-in-95 duration-200">
                <div className="relative w-12 h-12">
                    <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-foreground tracking-tight">
                        {statusText}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        {locale === 'en' ? 'Secure authentication via Telegram' : 'Безопасная авторизация через Telegram'}
                    </p>
                </div>
            </div>
        </div>
    );
}
