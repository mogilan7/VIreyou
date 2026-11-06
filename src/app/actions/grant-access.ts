'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';

export async function grantSpecialistAccess(targetUserId: string) {
    const supabase = await createClient();
    
    // 1. Verify current user is Admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error("Unauthorized: Authentication required.");
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (dbUser?.role !== 'admin') {
        throw new Error("Unauthorized: Only Admin can grant access.");
    }

    // 2. Update target user's role in profiles
    const { error } = await supabase
        .from('profiles')
        .update({ role: 'specialist' })
        .eq('id', targetUserId);

    if (error) {
        throw new Error(`Failed to grant access: ${error.message}`);
    }

    // 3. Revalidate path to refresh view
    revalidatePath('/[locale]/specialist', 'page');
    return { success: true };
}
