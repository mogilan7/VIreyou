"use client";

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import { trackCheckoutClick } from '@/lib/analytics';

interface StarsCheckoutButtonProps {
    plan: 'Standard' | 'PRO';
    starsAmount?: number;
    className?: string;
    children?: React.ReactNode;
}

export default function StarsCheckoutButton({ 
    plan, 
    starsAmount = plan === 'PRO' ? 450 : 250, 
    className, 
    children 
}: StarsCheckoutButtonProps) {
    const [loading, setLoading] = useState(false);
    const locale = useLocale();
    const isEn = locale === 'en';

    const handleCheckout = async () => {
        trackCheckoutClick(plan, 'telegram_stars', starsAmount);
        setLoading(true);
        try {
            const res = await fetch('/api/payments/telegram-stars', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan })
            });

            if (res.status === 401) {
                window.location.href = '/login';
                return;
            }

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                alert(errData.error || (isEn ? 'Failed to create invoice' : 'Ошибка создания счета'));
                setLoading(false);
                return;
            }

            const data = await res.json();
            if (!data.invoiceLink) {
                alert(isEn ? 'Invoice link missing' : 'Не удалось получить ссылку на оплату');
                setLoading(false);
                return;
            }

            // If inside Telegram WebApp
            if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.openInvoice) {
                (window as any).Telegram.WebApp.openInvoice(data.invoiceLink, (status: string) => {
                    setLoading(false);
                    if (status === 'paid') {
                        alert(isEn ? '🎉 Payment successful! Subscription activated.' : '🎉 Оплата прошла успешно! Подписка активирована.');
                        window.location.reload();
                    } else if (status === 'failed') {
                        alert(isEn ? 'Payment failed.' : 'Оплата не прошла или была отклонена.');
                    }
                });
                return;
            }

            // Normal browser: open Telegram invoice link
            window.open(data.invoiceLink, '_blank');
            setLoading(false);
        } catch (err: any) {
            console.error('[StarsCheckout] Error:', err);
            alert(err?.message || (isEn ? 'Payment error' : 'Ошибка при оформлении'));
            setLoading(false);
        }
    };

    const defaultLabel = isEn 
        ? `⭐️ Pay ${starsAmount} Stars` 
        : `⭐️ Оплатить ${starsAmount} ⭐️`;

    return (
        <button
            onClick={handleCheckout}
            disabled={loading}
            className={className || "w-full py-3 px-4 rounded-full font-semibold text-sm transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-slate-900 shadow-md hover:shadow-lg active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"}
        >
            {loading ? (
                <div className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></span>
                    <span>{isEn ? 'Generating invoice...' : 'Формирование счета...'}</span>
                </div>
            ) : (
                children || (
                    <span className="flex items-center gap-1.5">
                        <span className="text-base">⭐️</span>
                        <span>{defaultLabel}</span>
                    </span>
                )
            )}
        </button>
    );
}
