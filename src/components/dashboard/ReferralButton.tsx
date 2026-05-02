"use client";

import React from 'react';
import { Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function ReferralButton({ userId }: { userId: string }) {
    const t = useTranslations('Wallet');
    
    return (
        <button 
            onClick={() => {
                navigator.clipboard.writeText(`https://t.me/vireyou_bot?start=ref_${userId}`);
                alert(t('linkCopied'));
            }}
            className="w-full sm:w-auto bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold shadow-sm"
        >
            <Copy size={18} />
            <span>{t('inviteFriend')}</span>
        </button>
    );
}
