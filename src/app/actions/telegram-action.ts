'use server';

import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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
                console.log(`[AUTH MERGE] Merging placeholder ${placeholderUser.id} (${placeholderUser.email}) into ${user.id} (${user.email})`);
                
                // 1. Move all user data
                await prisma.nutritionLog.updateMany({ where: { user_id: placeholderUser.id }, data: { user_id: user.id } });
                await prisma.activityLog.updateMany({ where: { user_id: placeholderUser.id }, data: { user_id: user.id } });
                await prisma.habitLog.updateMany({ where: { user_id: placeholderUser.id }, data: { user_id: user.id } });
                await prisma.sleepLog.updateMany({ where: { user_id: placeholderUser.id }, data: { user_id: user.id } });
                await prisma.hydrationLog.updateMany({ where: { user_id: placeholderUser.id }, data: { user_id: user.id } });
                await prisma.biomarkerResult.updateMany({ where: { user_id: placeholderUser.id }, data: { user_id: user.id } });
                await prisma.healthData.updateMany({ where: { user_id: placeholderUser.id }, data: { user_id: user.id } });
                await prisma.analyticsEvent.updateMany({ where: { user_id: placeholderUser.id }, data: { user_id: user.id } });

                // 2. Prevent re-granting 3-day trial if already used or exists on placeholder
                let finalSubscriptionExpiry = user.subscription_expires_at;
                if (placeholderUser.subscription_expires_at) {
                    if (!finalSubscriptionExpiry || placeholderUser.subscription_expires_at < finalSubscriptionExpiry) {
                        finalSubscriptionExpiry = placeholderUser.subscription_expires_at;
                    }
                }

                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        telegram_id: telegramId,
                        telegram_username: telegramUsername || placeholderUser.telegram_username || null,
                        timezone: timezone || user.timezone || placeholderUser.timezone || null,
                        subscription_expires_at: finalSubscriptionExpiry,
                        start_param: user.start_param || placeholderUser.start_param,
                        utm_source: user.utm_source || placeholderUser.utm_source,
                        utm_campaign: user.utm_campaign || placeholderUser.utm_campaign
                    }
                });

                // 3. Delete old placeholder user
                try {
                    await prisma.user.delete({ where: { id: placeholderUser.id } });
                    console.log(`[AUTH MERGE] Successfully deleted placeholder ${placeholderUser.id}`);
                } catch (delErr) {
                    console.error("[AUTH MERGE] Could not delete placeholder:", delErr);
                }
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
            revalidatePath("/"); // Refresh paths to update UI
        }

        return { success: true };
    } catch (error) {
        console.error("[AUTH] Failed to link telegram ID:", error);
        return { success: false, error: "Internal server error" };
    }
}
