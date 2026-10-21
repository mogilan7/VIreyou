'use server';

import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { mergeUserAccounts } from "@/lib/auth/mergeUsers";

export async function linkTelegramAction(telegramId: string, telegramUsername?: string, timezone?: string) {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: authUser.email || undefined }
        });

        if (!user) {
            return { success: false, error: "User not found in Prisma" };
        }

        // Only update if it is currently null or different
        if (user.telegram_id !== telegramId || user.telegram_username !== telegramUsername || (timezone && user.timezone !== timezone)) {
            // Check if there is an existing bot placeholder account for this telegram_id
            const placeholderUser = await prisma.user.findFirst({
                where: {
                    OR: [
                        { telegram_id: telegramId },
                        { email: `tg_${telegramId}@vireyou.com` }
                    ],
                    id: { not: user.id }
                }
            });

            if (placeholderUser) {
                // Execute entire merge inside an atomic transaction
                await prisma.$transaction(async (tx) => {
                    await mergeUserAccounts(tx, user.id, placeholderUser.id);
                });
            } else {
                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        telegram_id: telegramId,
                        telegram_username: telegramUsername || null,
                        ...(timezone ? { timezone } : {})
                    }
                });
            }

            console.log(`[AUTH] Linked Telegram ID ${telegramId} for user ${user.email} with TZ ${timezone || "unknown"}`);
            revalidatePath("/");
        }

        return { success: true };
    } catch (error) {
        console.error("[AUTH] Failed to link telegram ID:", error);
        return { success: false, error: "Internal server error" };
    }
}
