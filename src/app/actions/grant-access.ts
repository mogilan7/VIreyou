'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function grantSpecialistAccess(targetUserId: string) {
    const supabase = await createClient();
    
    // 1. Verify current user is Admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email !== 'mogilev.andrey@gmail.com') {
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
