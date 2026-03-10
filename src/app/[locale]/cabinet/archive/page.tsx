import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Sidebar from '@/components/dashboard/Sidebar';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { PrismaClient } from '@prisma/client';
import DocumentUpload from '@/components/dashboard/DocumentUpload';
import { FileText, Clock, CheckCircle2, FileSearch, Trash2 } from 'lucide-react';

const prisma = new PrismaClient();

export const metadata: Metadata = {
    title: 'Медицинский архив | Longevity Portal',
    description: 'Хранение и анализ медицинских документов',
};

async function getDocuments(userId: string) {
    try {
        // @ts-ignore
        const model = prisma.medicalDocument;
        if (!model) {
            console.warn('Prisma model medicalDocument not found on client instance');
            return [];
        }
        return await model.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' }
        });
    } catch (e) {
        console.error('Error fetching documents:', e);
        return [];
    }
}

export default async function ArchivePage() {
    const ct = await getTranslations('Dashboard.Client');
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/ru/login');

    const userId = user.id;
    const documents = await getDocuments(userId);

    // Get profile name for sidebar
    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();

    const profileName = profile?.full_name || "Андрей Могилев";

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex transition-colors duration-300">
            <Sidebar role="client" profileName={profileName} />

            <main className="flex-grow lg:ml-64 transition-all duration-300">
                <div className="p-4 lg:p-8 mt-20 lg:mt-0">
                    <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 border-b dark:border-slate-800 border-brand-sage/40 pb-6">
                        <div>
                            <h1 className="text-sm font-medium opacity-50 uppercase tracking-widest mb-1">Health Intelligence</h1>
                            <h2 className="text-2xl font-bold dark:text-white">{profileName}</h2>
                        </div>

                        <nav className="flex gap-8 text-sm font-medium">
                            <div className="relative pb-2 transition-all text-teal-500 dark:text-teal-400 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-teal-500">
                                {ct('maTitle')}
                            </div>
                        </nav>
                    </header>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-brand-sage/20 dark:border-white/5 shadow-sm">
                                <h2 className="text-xl font-bold text-brand-text dark:text-white mb-4">Загрузить анализы</h2>
                                <p className="text-sm text-brand-gray mb-6 leading-relaxed">
                                    Загрузите ваши лабораторные результаты в формате PDF или фото. Наш ИИ автоматически распознает показатели и добавит их в вашу динамику здоровья.
                                </p>
                                <DocumentUpload
                                    userId={userId}
                                    email={user.email}
                                    fullName={profileName}
                                />
                            </div>

                            <div className="bg-brand-leaf/5 dark:bg-teal-500/5 rounded-[2.5rem] p-8 border border-brand-leaf/10 dark:border-teal-400/10">
                                <h3 className="text-sm font-bold text-brand-leaf dark:text-teal-400 uppercase tracking-widest mb-4">Как это работает</h3>
                                <ul className="space-y-4">
                                    {[
                                        { icon: <FileText size={16} />, text: "Загрузите файл (PDF или фото)" },
                                        { icon: <FileSearch size={16} />, text: "ИИ анализирует текст документа" },
                                        { icon: <CheckCircle2 size={16} />, text: "Показатели сохраняются в БД" }
                                    ].map((item, i) => (
                                        <li key={i} className="flex items-start gap-3">
                                            <div className="mt-0.5 text-brand-leaf dark:text-teal-400">{item.icon}</div>
                                            <span className="text-xs text-brand-text dark:text-slate-300 leading-tight">{item.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-brand-sage/20 dark:border-white/5 shadow-sm min-h-[500px]">
                                <div className="flex items-center justify-between mb-8">
                                    <h2 className="text-xl font-bold text-brand-text dark:text-white">История архива</h2>
                                    <span className="text-[10px] font-bold bg-brand-sage/20 dark:bg-slate-800 text-brand-gray dark:text-slate-400 px-3 py-1 rounded-full uppercase tracking-tighter">
                                        Всего: {documents.length}
                                    </span>
                                </div>

                                {documents.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center">
                                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                            <FileText className="text-slate-400" size={32} />
                                        </div>
                                        <h3 className="text-lg font-bold text-brand-text dark:text-white mb-2">Архив пуст</h3>
                                        <p className="text-sm text-brand-gray max-w-sm">
                                            Вы еще не загрузили ни одного документа. Ваши анализы будут храниться здесь.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {documents.map((doc: any) => (
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

                                                <div className="flex items-center gap-3 self-end sm:self-auto sm:opacity-0 group-hover:opacity-100 transition-opacity">
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
                                                        className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-brand-sage/20 dark:border-white/10 text-brand-gray hover:text-red-500 transition-colors"
                                                        title="Удалить"
                                                    >
                                                        <Trash2 size={18} strokeWidth={1.5} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
