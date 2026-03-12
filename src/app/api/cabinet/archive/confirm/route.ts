import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { documentId, confirmedData } = await request.json();

        if (!documentId || !confirmedData) {
            return NextResponse.json({ error: "Missing documentId or confirmedData" }, { status: 400 });
        }

        // 1. Fetch the document to ensure ownership and current state
        const doc = await (prisma as any).medicalDocument.findUnique({
            where: { id: documentId }
        });

        if (!doc || doc.user_id !== user.id) {
            return NextResponse.json({ error: "Document not found or access denied" }, { status: 404 });
        }

        // 2. Prepare data for HealthData update
        const coreFields = ['glucose', 'ferritin', 'cortisol', 'vitamin_d3', 'insulin', 'ldl_cholesterol', 'crp', 'homocysteine'];
        const coreUpdate: any = {};

        Object.entries(confirmedData).forEach(([key, data]: [string, any]) => {
            if (coreFields.includes(key) && data.value) {
                const val = parseFloat(data.value.toString().replace(',', '.'));
                if (!isNaN(val)) coreUpdate[key] = val;
            }
        });

        // 3. Update HealthData (upsert)
        await (prisma as any).healthData.upsert({
            where: { user_id: user.id },
            update: {
                ...coreUpdate,
                biomarkers: confirmedData
            },
            create: {
                user_id: user.id,
                ...coreUpdate,
                biomarkers: confirmedData
            }
        });

        // 4. Update the document status to COMPLETED
        await (prisma as any).medicalDocument.update({
            where: { id: documentId },
            data: {
                status: 'COMPLETED',
                extracted_data: JSON.stringify(confirmedData)
            }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Error confirming medical data:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
