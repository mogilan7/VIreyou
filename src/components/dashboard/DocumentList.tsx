"use client";

import React, { useState } from 'react';
import { FileText, Clock, Trash2, CheckCircle2, AlertCircle, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ReviewModal from './ReviewModal';

interface Document {
    id: string;
    file_name: string;
    file_url: string;
    status: string;
    created_at: string;
    extracted_data?: string | null;
}

export default function DocumentList({ initialDocuments }: { initialDocuments: Document[] }) {
    const [documents, setDocuments] = useState(initialDocuments);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [reviewDoc, setReviewDoc] = useState<Document | null>(null);
    const router = useRouter();

    // Auto-polling for status updates
    React.useEffect(() => {
        const hasProcessing = documents.some(d => d.status === 'PROCESSING');
        if (!hasProcessing) return;

        const interval = setInterval(async () => {
            try {
                // Fetch latest documents
                // We could implement a specific API, but for now we'll just fetch again
                // Or use server action. For simplicity, let's just use router.refresh() 
                // and trust that initialDocuments might change? No, initialDocuments is passed once.
                // We need a way to fetch the latest state.
                const res = await fetch('/api/cabinet/archive/list'); // Assuming this exists or I'll create it
                if (res.ok) {
                    const data = await res.json();
                    setDocuments(data.documents);

                    // If everything is done processing, we can refresh the router to sync server state
                    if (!data.documents.some((d: any) => d.status === 'PROCESSING')) {
                        router.refresh();
                    }
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [documents, router]);

    const handleConfirmSuccess = () => {
        // Refresh local state and router
        router.refresh();
        // Since it's a server component initially, we might need to manually update local state or just let the refresh happen
        // For a better UX, let's update local state status
        if (reviewDoc) {
            setDocuments(prev => prev.map(d => d.id === reviewDoc.id ? { ...d, status: 'COMPLETED' } : d));
        }
    };

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
                router.refresh();
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
                                    doc.status === 'REVIEW_PENDING' ? 'bg-amber-500/10 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]' :
                                        'bg-slate-500/10 text-slate-500 animate-pulse'}`}>
                            {doc.status === 'COMPLETED' ? <CheckCircle2 size={24} /> :
                                doc.status === 'FAILED' ? <AlertCircle size={24} /> :
                                    <FileText size={24} />}
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
                                            doc.status === 'REVIEW_PENDING' ? 'text-amber-500' :
                                                'text-slate-500'}`}>
                                    {doc.status === 'COMPLETED' ? 'Готово' :
                                        doc.status === 'FAILED' ? 'Ошибка' :
                                            doc.status === 'REVIEW_PENDING' ? 'Нужна проверка' :
                                                'В процессе'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto transition-opacity">
                        {doc.status === 'REVIEW_PENDING' && (
                            <button
                                onClick={() => setReviewDoc(doc)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-all shadow-md active:scale-95"
                            >
                                <Eye size={14} />
                                Проверить
                            </button>
                        )}
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

            {/* Review Modal */}
            {reviewDoc && (
                <ReviewModal
                    isOpen={!!reviewDoc}
                    onClose={() => setReviewDoc(null)}
                    documentId={reviewDoc.id}
                    fileName={reviewDoc.file_name}
                    initialData={reviewDoc.extracted_data ? JSON.parse(reviewDoc.extracted_data) : {}}
                    onConfirm={handleConfirmSuccess}
                />
            )}
        </div>
    );
}
