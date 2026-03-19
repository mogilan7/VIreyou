import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Sidebar from '@/components/dashboard/Sidebar';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { PrismaClient } from '@prisma/client';
import DocumentUpload from '@/components/dashboard/DocumentUpload';
import DocumentList from '@/components/dashboard/DocumentList';
import { FileText, Clock, CheckCircle2, FileSearch } from 'lucide-react';

const prisma = new PrismaClient();

export const metadata: Metadata = {
    title: 'Медицинский архив | Longevity Portal',
    description: 'Хранение и анализ медицинских документов',
};

export const dynamic = 'force-dynamic';


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

    const profileName = profile?.full_name || "Пользователь";


    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex transition-colors duration-300">
            <Sidebar role="client" profileName={profileName} />

            <main className="flex-grow lg:ml-64 transition-all duration-300">
                <div className="p-4 lg:p-8 mt-20 lg:mt-0">
                    <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 border-b dark:border-slate-800 border-brand-sage/40 pb-6">
                        <div>
                            <h1 className="text-sm font-medium opacity-50 uppercase tracking-widest mb-1">Health Intelligence</h1>
                            <div className="h-8"></div> {/* Spacer node */}
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

                                <DocumentList initialDocuments={documents as any} />
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
