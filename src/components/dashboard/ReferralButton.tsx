"use client";

import React from 'react';
import { Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function ReferralButton({ userId }: { userId: string }) {
    const t = useTranslations('Wallet');
    
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert(t('linkCopied'));
    };

    return (
        <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button 
                onClick={() => copyToClipboard(`https://t.me/vireyou_bot?start=ref_${userId}`)}
                className="flex-1 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors py-3 px-4 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-sm"
            >
                <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center shrink-0">
                    <Copy size={14} />
                </div>
                <div className="text-left">
                    <p className="text-[10px] uppercase tracking-wider opacity-60">Telegram</p>
                    <p className="text-sm whitespace-nowrap">{t('inviteFriend')}</p>
                </div>
            </button>

            <button 
                onClick={() => copyToClipboard(`https://vireyou.com/login?ref=${userId}`)}
                className="flex-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 transition-colors py-3 px-4 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-sm"
            >
                <div className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center shrink-0">
                    <Copy size={14} />
                </div>
                <div className="text-left">
                    <p className="text-[10px] uppercase tracking-wider opacity-60">Web App</p>
                    <p className="text-sm whitespace-nowrap">{t('inviteWeb')}</p>
                </div>
            </button>
        </div>
    );
}
