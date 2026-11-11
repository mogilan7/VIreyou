"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireUser, requireRole } from "@/lib/auth/guards";

export async function updateReportPeriod(clientId: string, periodDays: number) {
    if (periodDays < 1) throw new Error("Period must be at least 1 day");

    const caller = await requireUser();

    // If updating another user, caller MUST be specialist or admin
    let targetUserId = caller.id;
    if (clientId && clientId !== caller.id) {
        await requireRole('specialist', 'admin');
        targetUserId = clientId;
    }

    try {
        const u = await prisma.user.findUnique({ where: { id: targetUserId } });
        if (!u) throw new Error("Client record not found");

        await prisma.user.update({
            where: { id: u.id },
            data: { report_period_days: periodDays }
        });
        
        revalidatePath('/[locale]/specialist', 'page');
        return { success: true };
    } catch (error: any) {
        console.error("Error updating report period:", error);
        return { success: false, error: error.message };
    }
}
