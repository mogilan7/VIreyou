'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

export async function deleteNutritionLog(formData: FormData) {
    const id = formData.get('id') as string;
    
    if (!id) return;

    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            console.error("Unauthorized deletion attempt");
            return;
        }

        await prisma.nutritionLog.deleteMany({
            where: {
                id: id,
                user_id: user.id
            }
        });
        revalidatePath('/[locale]/cabinet/lifestyle');
    } catch (err) {
        console.error("Delete NutritionLog failed:", err);
    }
}
