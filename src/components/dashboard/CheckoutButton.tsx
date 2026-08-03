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
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const t = useTranslations('Wallet');
    const locale = useLocale();
    const isProdamus = locale !== 'ru';

    // Load Prodamus script eagerly via DOM injection (more reliable than next/script lazyOnload in Telegram WebView)
    useEffect(() => {
        if (!isProdamus) return;
        if (typeof window !== 'undefined' && (window as any).ProdamusWidget) {
            setScriptLoaded(true);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://widget.payform.ru/iframe.min.js';
        script.async = true;
        script.onload = () => {
            console.log('[Prodamus] Script loaded successfully');
            setScriptLoaded(true);
        };
        script.onerror = (e) => {
            console.error('[Prodamus] Failed to load script:', e);
        };
        document.head.appendChild(script);

        return () => {
            // Don't remove — other components may need it
        };
    }, [isProdamus]);

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

            if (data.error) {
                alert(`${t('paymentError')}: ${data.error}`);
                setLoading(false);
                return;
            }

            if (isProdamus) {
                if (!data.orderId) {
                    alert(`${t('paymentError')}: ${data.details || t('paymentUnknown')}`);
                    setLoading(false);
                    return;
                }

                // Check if widget script is available
                if (typeof (window as any).ProdamusWidget === 'undefined') {
                    console.error('[Prodamus] ProdamusWidget not available. scriptLoaded:', scriptLoaded);
                    alert('Виджет оплаты не загрузился. Пожалуйста, обновите страницу и попробуйте снова.');
                    setLoading(false);
                    return;
                }

                const merchantId = process.env.NEXT_PUBLIC_PRODAMUS_MERCHANT_ID || '9f40d6b1-7246-41d7-8ccf-63f329ca2b7a';
                const salesChannelId = process.env.NEXT_PUBLIC_PRODAMUS_SALES_CHANNEL_ID || 'f40919dc-6570-4a48-bc45-b9ccac0ce196';
                
                console.log('[Prodamus] Opening widget with:', { merchantId, salesChannelId, orderId: data.orderId, rubAmount: data.rubAmount });

                const widget = new (window as any).ProdamusWidget({
                    merchantId,
                    salesChannelId,
                    currency: 'rub',
                    merchantOrderNumber: data.orderId,
                    products: [
                        {
                            name: data.planLabel,
                            price: data.rubAmount,
                            quantity: 1,
                        }
                    ]
                });

                widget.on('payment_success', () => {
                    window.location.href = `/${locale}/cabinet/wallet?payment=success`;
                });

                widget.on('payment_error', () => {
                    alert('Произошла ошибка при оплате. Попробуйте еще раз.');
                    setLoading(false);
                });

                widget.on('widget_closed', () => {
                    setLoading(false);
                });

                widget.open();
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
