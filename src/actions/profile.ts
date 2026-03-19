"use server";

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';

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
        if (dob) updates.date_of_birth = new Date(dob);
        if (height) {
            const { Prisma } = require('@prisma/client');
            updates.height = new Prisma.Decimal(height);
        }


        if (avatarUrl) updates.avatar_url = avatarUrl; // Using avatar_url to match existing schema

        if (Object.keys(updates).length > 0) {
            try {
                await prisma.profiles.update({
                    where: { id: user.id },
                    data: updates
                });
            } catch (e: any) {
                console.error("Profile update error with Prisma:", e);
                return { success: false, error: 'Failed to update profile: ' + (e.message || e) };
            }
        }


        revalidatePath('/', 'layout');
        return { success: true };

    } catch (e: any) {
        console.error("Exception in updateProfile:", e);
        return { success: false, error: e.message || 'An unexpected error occurred' };
    }

}
