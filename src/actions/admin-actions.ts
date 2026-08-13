"use server";

import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// Middleware logic for server actions to ensure admin
async function requireAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error("Unauthorized");
    
    const isAdmin = user.email?.toLowerCase() === 'mogilev.andrey@gmail.com';
    
    if (!isAdmin) {
        // Also check if they have 'admin' role in db
        const dbUser = await prisma.user.findUnique({ where: { email: user.email || '' } });
        if (dbUser?.role !== 'admin') {
            throw new Error("Unauthorized: Admin access required");
        }
    }
    
    return true;
}

export async function updateUserRole(userId: string, newRole: string) {
    await requireAdmin();
    
    await prisma.user.update({
        where: { id: userId },
        data: { role: newRole }
    });
    
    revalidatePath('/[locale]/admin', 'page');
    return { success: true };
}

export async function updateUserSubscription(userId: string, newExpiryStr: string | null) {
    await requireAdmin();
    
    const expiresAt = newExpiryStr ? new Date(newExpiryStr) : null;
    
    await prisma.user.update({
        where: { id: userId },
        data: { subscription_expires_at: expiresAt }
    });
    
    revalidatePath('/[locale]/admin', 'page');
    return { success: true };
}
