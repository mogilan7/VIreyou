"use client";

import React, { useState } from 'react';

interface CheckoutButtonProps {
    plan: string;
    amount: number;
    className?: string;
    children: React.ReactNode;
}

export default function CheckoutButton({ plan, amount, className, children }: CheckoutButtonProps) {
    const [loading, setLoading] = useState(false);

    const handleCheckout = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/payments/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan, amount })
            });

            const data = await response.json();

            if (data.confirmation_url) {
                window.location.href = data.confirmation_url;
            } else {
                alert('Ошибка при создании платежа. Пожалуйста, попробуйте позже.');
            }
        } catch (error) {
            console.error('Checkout error:', error);
            alert('Произошла ошибка. Проверьте подключение к интернету.');
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
                    <span>Загрузка...</span>
                </div>
            ) : children}
        </button>
    );
}
