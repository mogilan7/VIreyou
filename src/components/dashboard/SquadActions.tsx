'use client';

import React, { useState } from 'react';
import { createSquadAction, removeParticipantAction } from '@/app/actions/squad-actions';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function CreateSquadButton({ className }: { className?: string }) {
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        setLoading(true);
        try {
            await createSquadAction();
            toast.success('Марафон создан!');
        } catch (error: any) {
            toast.error(error.message || 'Ошибка при создании');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button 
            onClick={handleCreate}
            disabled={loading}
            className={className || "bg-[#60B76F] hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-2xl inline-flex items-center gap-2 transition-colors w-full sm:w-auto justify-center shadow-lg shadow-[#60B76F]/30 disabled:opacity-50"}
        >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
            Создать Марафон
        </button>
    );
}

export function RemoveParticipantButton({ squadId, participantId, userName }: { squadId: string, participantId: string, userName: string }) {
    const [loading, setLoading] = useState(false);

    const handleRemove = async () => {
        if (!confirm(`Вы уверены, что хотите удалить ${userName} из марафона?`)) return;
        
        setLoading(true);
        try {
            await removeParticipantAction(squadId, participantId);
            toast.success('Участник удален');
        } catch (error: any) {
            toast.error(error.message || 'Ошибка при удалении');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button 
            onClick={handleRemove}
            disabled={loading}
            className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
            title="Удалить участника"
        >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        </button>
    );
}
