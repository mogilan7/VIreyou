"use client";

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Script from 'next/script';

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
    const isProdamus = locale !== 'ru';

    const handleCheckout = async () => {
        setLoading(true);
        try {
            const apiEndpoint = isProdamus
                ? '/api/payments/prodamus'
                : '/api/payments/create';

            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan, amount, locale })
            });

            const data = await response.json();

            if (isProdamus) {
                if (data.orderId) {
                    const merchantId = process.env.NEXT_PUBLIC_PRODAMUS_MERCHANT_ID || '9f40d6b1-7246-41d7-8ccf-63f329ca2b7a';
                    const salesChannelId = process.env.NEXT_PUBLIC_PRODAMUS_SALES_CHANNEL_ID || 'f40919dc-6570-4a48-bc45-b9ccac0ce196';
                    
                    const widget = new (window as any).ProdamusWidget({
                        merchantId,
                        salesChannelId,
                        currency: 'usd',
                        merchantOrderNumber: data.orderId,
                        products: [
                            {
                                name: data.planLabel,
                                price: Number(amount), // Use the original USD amount passed to the button
                                quantity: 1,
                            }
                        ]
                    });
                    widget.open();
                } else {
                    alert(`${t('paymentError')}: ${data.details || data.error || t('paymentUnknown')}`);
                }
            } else {
                const redirectUrl = data.confirmation_url;
                if (redirectUrl) {
                    window.location.href = redirectUrl;
                } else {
                    alert(`${t('paymentError')}: ${data.details || data.error || t('paymentUnknown')}`);
                }
            }
        } catch (error) {
            console.error('Checkout error:', error);
            alert(t('networkError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {isProdamus && (
                <Script src="https://widget.payform.ru/iframe.min.js" strategy="lazyOnload" />
            )}
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
        </>
    );
}
