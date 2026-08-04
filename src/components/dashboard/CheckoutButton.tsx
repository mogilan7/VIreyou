"use client";

import React, { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';

interface CheckoutButtonProps {
    plan: string;
    amount: number;
    className?: string;
    children: React.ReactNode;
}

export default function CheckoutButton({ plan, amount, className, children }: CheckoutButtonProps) {
    const [loading, setLoading] = useState(false);
    const t = useTranslations('Wallet');
    const locale = useLocale();
    const isLava = locale !== 'ru'; // International users use Lava.top

    useEffect(() => {
        // Initialize Telegram WebApp script if needed
        if (typeof window !== 'undefined' && !(window as any).Telegram?.WebApp) {
            const script = document.createElement('script');
            script.src = 'https://telegram.org/js/telegram-web-app.js';
            script.async = true;
            document.head.appendChild(script);
        }
    }, []);

    const handleCheckout = async () => {
        setLoading(true);
        try {
            const apiEndpoint = isLava
                ? '/api/payments/lava'
                : '/api/payments/create';

            console.log('[Checkout] Calling API:', apiEndpoint, { plan, amount, locale });

            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan, amount, locale })
            });

            console.log('[Checkout] Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Checkout] API error:', response.status, errorText);
                alert(`Ошибка сервера (${response.status}). Попробуйте позже.`);
                setLoading(false);
                return;
            }

            const data = await response.json();
            console.log('[Checkout] API response:', data);

            if (data.error) {
                alert(`${t('paymentError')}: ${data.error}`);
                setLoading(false);
                return;
            }

            const redirectUrl = data.confirmation_url;
            
            if (!redirectUrl) {
                alert(`${t('paymentError')}: ${data.details || data.error || t('paymentUnknown')}`);
                setLoading(false);
                return;
            }

            if (isLava && typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.openLink) {
                // Open Lava.top external payment page safely outside of Mini App context
                (window as any).Telegram.WebApp.openLink(redirectUrl);
                setLoading(false);
            } else {
                window.location.href = redirectUrl;
            }

        } catch (error: any) {
            console.error('[Checkout] Exception:', error?.message, error);
            alert(`Ошибка: ${error?.message || 'Неизвестная ошибка'}. Проверьте подключение к интернету.`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleCheckout}
            disabled={loading}
            className={`${className} ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
            {loading ? (
                <div className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>{t('loading')}</span>
                </div>
            ) : children}
        </button>
    );
}
