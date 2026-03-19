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

        // Welcome Data fields
        const weight = formData.get('weight') as string;
        const waist = formData.get('waist') as string;
        const hips = formData.get('hips') as string;
        const smoking = formData.get('smoking') as string;
        const alcohol = formData.get('alcohol') as string;
        const activity = formData.get('activity') as string;
        const diet = formData.get('diet') as string;
        const chronic = formData.get('chronic') as string;
        const meds = formData.get('meds') as string;
        const heredity = formData.get('heredity') as string;

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

        // Fetch existing Welcome Data to preserve Symptoms
        const existingProfile = await prisma.profiles.findUnique({ where: { id: user.id } });
        const existingWelcome = (existingProfile as any)?.welcome_data || {};

        const welcome_data = {
            ...existingWelcome,
            weight: weight !== null ? weight : existingWelcome.weight,
            waist: waist !== null ? waist : existingWelcome.waist,
            hips: hips !== null ? hips : existingWelcome.hips,
            smoking: smoking !== null ? smoking : existingWelcome.smoking,
            alcohol: alcohol !== null ? alcohol : existingWelcome.alcohol,
            activity: activity !== null ? activity : existingWelcome.activity,
            diet: diet !== null ? diet : existingWelcome.diet,
            chronic: chronic !== null ? chronic : existingWelcome.chronic,
            meds: meds !== null ? meds : existingWelcome.meds,
            heredity: heredity !== null ? heredity : existingWelcome.heredity
        };

        // Prepare update payload
        const updates: any = {};
        if (fullName !== null) updates.full_name = fullName;
        if (dob) updates.date_of_birth = new Date(dob);
        if (height) {
            const { Prisma } = require('@prisma/client');
            updates.height = new Prisma.Decimal(height);
        }
        updates.welcome_data = welcome_data;

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

export async function getSidebarProfile(): Promise<{ full_name: string | null; avatar_url: string | null; welcome_data?: any } | null> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const profile = await prisma.profiles.findUnique({
            where: { id: user.id }
        });

        if (!profile) return null;

        return {
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            welcome_data: (profile as any).welcome_data
        };

    } catch (e) {
        console.error("Error in getSidebarProfile:", e);
        return null;
    }
}

