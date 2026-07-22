"use client";

import React, { useState } from 'react';
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

    const handleCheckout = async () => {
        setLoading(true);
        try {
            // English users → Prodamus (international cards)
            // Russian users  → YooKassa (Russian cards)
            const isProdamus = locale !== 'ru';
            const apiEndpoint = isProdamus
                ? '/api/payments/prodamus'
                : '/api/payments/create';

            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan, amount, locale })
            });

            const data = await response.json();

            // Prodamus returns payment_url, YooKassa returns confirmation_url
            const redirectUrl = data.payment_url || data.confirmation_url;
            if (redirectUrl) {
                window.location.href = redirectUrl;
            } else {
                alert(`${t('paymentError')}: ${data.details || data.error || t('paymentUnknown')}`);
            }
        } catch (error) {
            console.error('Checkout error:', error);
            alert(t('networkError'));
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
