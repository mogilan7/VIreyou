"use server";

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/guards';

export async function updateUserRole(userId: string, newRole: string) {
    await requireRole('admin');
    
    await prisma.user.update({
        where: { id: userId },
        data: { role: newRole }
    });
    
    revalidatePath('/[locale]/admin', 'page');
    return { success: true };
}

export async function updateUserSubscription(userId: string, newExpiryStr: string | null) {
    await requireRole('admin');
    
    const expiresAt = newExpiryStr ? new Date(newExpiryStr) : null;
    
    await prisma.user.update({
        where: { id: userId },
        data: { subscription_expires_at: expiresAt }
    });
    
    revalidatePath('/[locale]/admin', 'page');
    return { success: true };
}
