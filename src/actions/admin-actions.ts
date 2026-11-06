"use server";

import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// Middleware logic for server actions to ensure admin
async function requireAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error("Unauthorized: Authentication required");
    
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (dbUser?.role !== 'admin') {
        throw new Error("Unauthorized: Admin access required");
    }
    
    return dbUser;
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
