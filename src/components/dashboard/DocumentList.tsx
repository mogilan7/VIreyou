"use client";

import React, { useState } from 'react';
import { FileText, Clock, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Document {
    id: string;
    file_name: string;
    file_url: string;
    status: string;
    created_at: string;
}

export default function DocumentList({ initialDocuments }: { initialDocuments: Document[] }) {
    const [documents, setDocuments] = useState(initialDocuments);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const router = useRouter();

    const handleDelete = async (docId: string) => {
        if (!confirm('Вы уверены, что хотите удалить этот документ?')) return;

        setIsDeleting(docId);
        try {
            const response = await fetch('/api/cabinet/archive/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentId: docId })
            });

            if (response.ok) {
                setDocuments(prev => prev.filter(d => d.id !== docId));
                router.refresh(); // Refresh server component data if needed
            } else {
                const data = await response.json();
                alert(`Ошибка при удалении: ${data.error}`);
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Произошла ошибка при связи с сервером');
        } finally {
            setIsDeleting(null);
        }
    };

    if (documents.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <FileText className="text-slate-400" size={32} />
                </div>
                <h3 className="text-lg font-bold text-brand-text dark:text-white mb-2">Архив пуст</h3>
                <p className="text-sm text-brand-gray max-w-sm">
                    Вы еще не загрузили ни одного документа. Ваши анализы будут храниться здесь.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {documents.map((doc) => (
                <div
                    key={doc.id}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-3xl border border-brand-sage/10 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-all duration-300"
                >
                    <div className="flex items-center gap-4 mb-3 sm:mb-0">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors
                            ${doc.status === 'COMPLETED' ? 'bg-teal-500/10 text-teal-500' :
                                doc.status === 'FAILED' ? 'bg-red-500/10 text-red-500' :
                                    'bg-amber-500/10 text-amber-500 animate-pulse'}`}>
                            <FileText size={24} />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-brand-text dark:text-white truncate max-w-[200px] sm:max-w-[300px]">
                                {doc.file_name}
                            </h4>
                            <div className="flex items-center gap-3 mt-1">
                                <div className="flex items-center gap-1 text-[10px] text-brand-gray uppercase tracking-widest">
                                    <Clock size={10} />
                                    {new Date(doc.created_at).toLocaleDateString('ru-RU')}
                                </div>
                                <span className="w-1 h-1 rounded-full bg-brand-gray/30" />
                                <span className={`text-[10px] font-bold uppercase tracking-widest
                                    ${doc.status === 'COMPLETED' ? 'text-teal-500' :
                                        doc.status === 'FAILED' ? 'text-red-500' :
                                            'text-amber-500'}`}>
                                    {doc.status === 'COMPLETED' ? 'Обработано' :
                                        doc.status === 'FAILED' ? 'Ошибка' :
                                            'В процессе'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto sm:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-brand-sage/20 dark:border-white/10 text-brand-gray hover:text-brand-leaf dark:hover:text-teal-400 transition-colors"
                            title="Открыть"
                        >
                            <FileText size={18} strokeWidth={1.5} />
                        </a>
                        <button
                            onClick={() => handleDelete(doc.id)}
                            disabled={isDeleting === doc.id}
                            className={`p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-brand-sage/20 dark:border-white/10 text-brand-gray hover:text-red-500 transition-colors ${isDeleting === doc.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Удалить"
                        >
                            <Trash2 size={18} strokeWidth={1.5} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
