"use server";

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateProfile(formData: FormData): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();

        // Ensure user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return { success: false, error: 'Unauthorized' };
        }

        const fullName = formData.get('fullName') as string;
        const dob = formData.get('dob') as string;
        const height = formData.get('height') as string;
        const avatarFile = formData.get('avatar') as File | null;

        let avatarUrl = undefined;

        // Upload avatar if provided
        if (avatarFile && avatarFile.size > 0) {
            const fileExt = avatarFile.name.split('.').pop();
            const fileName = `${user.id}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, avatarFile, { upsert: true });

            if (uploadError) {
                console.error("Avatar upload error:", uploadError);
                return { success: false, error: 'Failed to upload avatar' };
            }

            // Get public URL
            const { data: publicUrlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            avatarUrl = publicUrlData.publicUrl;
        }

        // Prepare update payload
        const updates: any = {};
        if (fullName !== null) updates.full_name = fullName;
        if (dob) updates.date_of_birth = dob;
        if (height) updates.height = parseFloat(height);
        if (avatarUrl) updates.avatar_url = avatarUrl; // Using avatar_url to match existing schema

        if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id);

            if (updateError) {
                console.error("Profile update error:", updateError);
                return { success: false, error: 'Failed to update profile data' };
            }
        }

        revalidatePath('/', 'layout');
        return { success: true };

    } catch (e) {
        console.error("Exception in updateProfile:", e);
        return { success: false, error: 'An unexpected error occurred' };
    }
}
