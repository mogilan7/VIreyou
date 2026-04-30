"use client";

import React from 'react';
import { Share2 } from 'lucide-react';

interface SquadInviteButtonProps {
    squadId: string;
    className?: string;
}

export default function SquadInviteButton({ squadId, className }: SquadInviteButtonProps) {
    const handleCopy = () => {
        const inviteLink = `https://t.me/vireyou_bot?start=sq_${squadId}`;
        navigator.clipboard.writeText(inviteLink);
        alert('Ссылка для приглашения в Squad скопирована!');
    };

    return (
        <button 
            onClick={handleCopy}
            className={className || "bg-white text-indigo-600 hover:bg-indigo-50 transition-colors py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm shadow-sm w-full sm:w-auto"}
        >
            <Share2 size={16} />
            <span>Пригласить друга</span>
        </button>
    );
}
