import { notFound } from "next/navigation";
import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import Sidebar from "@/components/dashboard/Sidebar";
import AdminUserTable from "@/components/admin/AdminUserTable";
import { ShieldCheck } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return notFound();
    }

    const isAdmin = user.email?.toLowerCase() === 'mogilev.andrey@gmail.com';
    let isRoleAdmin = false;

    const dbUser = await prisma.user.findUnique({ where: { email: user.email || '' } });
    if (dbUser?.role === 'admin') {
        isRoleAdmin = true;
    }

    if (!isAdmin && !isRoleAdmin) {
        return notFound();
    }

    // Fetch all users
    const users = await prisma.user.findMany({
        orderBy: { created_at: 'desc' },
        select: {
            id: true,
            email: true,
            full_name: true,
            telegram_username: true,
            role: true,
            balance: true,
            subscription_expires_at: true,
            created_at: true
        }
    });

    return (
        <div className="bg-[#FAFAFA] min-h-screen text-brand-text flex font-sans">
            {/* We reuse the specialist sidebar for now, but pass 'specialist' role so it renders the full links. 
                Wait, actually we can pass 'client' role and our Sidebar logic will inject 'Панель Специалиста' if admin.
                Or we can just pass 'specialist' so they have access to all specialist features. */}
            <div className="hidden lg:block"><Sidebar role="specialist" /></div>

            <main className="lg:ml-64 flex-1 p-8 pt-24 lg:pt-10 max-w-[1400px] w-full">
                <header className="flex justify-between items-center mb-10">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-purple-100 text-purple-600 p-2 rounded-xl">
                                <ShieldCheck size={24} />
                            </div>
                            <h1 className="text-3xl font-serif text-brand-text">Admin Panel</h1>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-brand-gray">
                            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                            Managing {users.length} users
                        </div>
                    </div>
                </header>

                <div className="flex flex-col gap-8 w-full">
                    <AdminUserTable initialUsers={JSON.parse(JSON.stringify(users))} />
                </div>
            </main>
        </div>
    );
}
