'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/guards';

export async function grantSpecialistAccess(targetUserId: string) {
    // 1. Verify current user is Admin
    await requireRole('admin');

    const supabase = await createClient();

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
