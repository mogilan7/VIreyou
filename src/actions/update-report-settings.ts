"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateReportPeriod(clientId: string, periodDays: number) {
    if (!clientId) throw new Error("Client ID is required");
    if (periodDays < 1) throw new Error("Period must be at least 1 day");

    try {
        await prisma.user.update({
            where: { id: clientId },
            data: { report_period_days: periodDays } as any
        });
        
        revalidatePath('/[locale]/specialist', 'page');
        return { success: true };
    } catch (error: any) {
        console.error("Error updating report period:", error);
        return { success: false, error: error.message };
    }
}
