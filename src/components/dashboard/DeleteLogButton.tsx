'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';

interface Props {
    id: string;
    action: (formData: FormData) => Promise<void>;
}

export default function DeleteLogButton({ id, action }: Props) {
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        if (!window.confirm("Вы уверены, что хотите удалить эту запись?")) {
            e.preventDefault();
        }
    };

    return (
        <form action={action} method="POST" onSubmit={handleSubmit}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" className="text-red-400 hover:text-red-500 transition-colors">
                <Trash2 size={12} />
            </button>
        </form>
    );
}
