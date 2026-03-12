import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
    try {
        const { markerKeys } = await request.json();

        if (!markerKeys || !Array.isArray(markerKeys) || markerKeys.length === 0) {
            return NextResponse.json({ error: "No markers specified for deletion" }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const healthData = await (prisma as any).healthData.findUnique({
            where: { user_id: user.id }
        });

        if (!healthData) {
            return NextResponse.json({ error: "Health data not found" }, { status: 404 });
        }

        // 1. Prepare new biomarkers JSON
        const currentBiomarkers = (healthData.biomarkers as Record<string, any>) || {};
        const updatedBiomarkers = { ...currentBiomarkers };

        // 2. Prepare column updates for hardcoded fields
        const columnUpdates: Record<string, any> = {};

        markerKeys.forEach(key => {
            // Remove from JSON
            delete updatedBiomarkers[key];

            // If it matches a hardcoded column, set it to null
            // We check if the column exists in the healthData object directly
            if (key in healthData && key !== 'id' && key !== 'user_id' && key !== 'biomarkers') {
                columnUpdates[key] = null;
            }
        });

        // 3. Perform update
        await (prisma as any).healthData.update({
            where: { user_id: user.id },
            data: {
                biomarkers: updatedBiomarkers,
                ...columnUpdates
            }
        });

        return NextResponse.json({ success: true, deleted: markerKeys });

    } catch (error: any) {
        console.error("Delete markers API error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
