"use client";

import React, { useState } from 'react';
import { Zap } from 'lucide-react';
import UpgradeModal from './UpgradeModal';
import { useTranslations } from 'next-intl';

interface UpgradeButtonProps {
    currentPlan: string;
}

export default function UpgradeButton({ currentPlan }: UpgradeButtonProps) {
    const [open, setOpen] = useState(false);
    const t = useTranslations('Wallet');

    return (
        <>
            <button
                id="upgrade-available-btn"
                onClick={() => setOpen(true)}
                className="group relative flex items-center gap-1.5 text-sm font-semibold overflow-hidden rounded-full px-4 py-1.5 transition-all duration-300 active:scale-95"
                style={{
                    background: 'linear-gradient(135deg, #60B76F, #38a169)',
                    color: '#fff',
                    boxShadow: '0 4px 15px rgba(96, 183, 111, 0.45)',
                }}
            >
                {/* Animated pulse ring */}
                <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-emerald-400" />
                <Zap className="w-3.5 h-3.5 fill-white relative z-10" />
                <span className="relative z-10">{t('upgradeAvailable')}</span>
            </button>

            <UpgradeModal
                isOpen={open}
                onClose={() => setOpen(false)}
                currentPlan={currentPlan}
            />
        </>
    );
}
