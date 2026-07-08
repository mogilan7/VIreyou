'use server';

import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function linkTelegramAction(telegramId: string, telegramUsername?: string) {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: authUser.email || undefined }
        });

        if (!user) {
            return { success: false, error: 'User not found in Prisma' };
        }

        // Only update if it's currently null or different
        if (user.telegram_id !== telegramId || user.telegram_username !== telegramUsername) {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    telegram_id: telegramId,
                    telegram_username: telegramUsername || null
                }
            });
            console.log(`[AUTH] Linked Telegram ID ${telegramId} for user ${user.email}`);
            revalidatePath('/'); // Refresh paths to update UI
        }

        return { success: true };
    } catch (error) {
        console.error('[AUTH] Failed to link telegram ID:', error);
        return { success: false, error: 'Internal server error' };
    }
}
