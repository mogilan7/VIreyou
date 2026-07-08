'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { linkTelegramAction } from '@/app/actions/telegram-action';

export function TelegramAutoLinker() {
    const [isLinked, setIsLinked] = useState(false);

    useEffect(() => {
        const tryLinking = () => {
            if (isLinked) return;
            
            // @ts-ignore
            const tg = window?.Telegram?.WebApp;
            
            if (tg?.initDataUnsafe?.user) {
                const user = tg.initDataUnsafe.user;
                if (user.id) {
                    console.log('[TelegramAutoLinker] Found Telegram User:', user.id);
                    linkTelegramAction(user.id.toString(), user.username).then(res => {
                        if (res.success) {
                            console.log('[TelegramAutoLinker] Successfully linked Telegram account!');
                            setIsLinked(true);
                        }
                    });
                }
            }
        };

        // Try immediately in case script is already loaded
        tryLinking();

        // Also listen for script load
        window.addEventListener('load', tryLinking);
        return () => window.removeEventListener('load', tryLinking);
    }, [isLinked]);

    return (
        <Script 
            src="https://telegram.org/js/telegram-web-app.js" 
            strategy="afterInteractive"
            onLoad={() => {
                // Trigger an event that our useEffect can potentially catch, 
                // or just rely on the component re-render / timeout.
                // In this case, we'll just dispatch a custom event if needed, but 
                // usually afterInteractive is fast enough.
                window.dispatchEvent(new Event('load'));
            }}
        />
    );
}
