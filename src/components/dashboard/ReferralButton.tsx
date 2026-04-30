"use client";

import React from 'react';
import { Copy } from 'lucide-react';

export default function ReferralButton({ userId }: { userId: string }) {
    return (
        <button 
            onClick={() => {
                navigator.clipboard.writeText(`https://t.me/reyou_bot?start=ref_${userId}`);
                alert('Ссылка скопирована!');
            }}
            className="w-full sm:w-auto bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold shadow-sm"
        >
            <Copy size={18} />
            <span>Пригласить друга (Скопировать скидку)</span>
        </button>
    );
}
