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

        // 3. Fetch existing HealthData to merge biomarkers
        const existingHealthData = await (prisma as any).healthData.findUnique({
            where: { user_id: user.id }
        });

        const existingBiomarkers = (existingHealthData?.biomarkers as Record<string, any>) || {};
        const mergedBiomarkers = {
            ...existingBiomarkers,
            ...confirmedData
        };

        // 4. Update HealthData (upsert)
        await (prisma as any).healthData.upsert({
            where: { user_id: user.id },
            update: {
                ...coreUpdate,
                biomarkers: mergedBiomarkers
            },
            create: {
                user_id: user.id,
                ...coreUpdate,
                biomarkers: mergedBiomarkers
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

        // 5. Save historical results to BiomarkerResult table
        const biomarkerResultsData = Object.entries(confirmedData).map(([key, data]: [string, any]) => {
            const val = parseFloat(data.value?.toString()?.replace(',', '.') || '0');
            return {
                user_id: user.id,
                document_id: documentId,
                marker_key: key,
                marker_name: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), // Basic name
                value: isNaN(val) ? 0 : val,
                unit: data.unit || null,
                reference_range: data.reference_range || null,
                status: (data.status || 'NORMAL').toUpperCase(),
                recorded_at: new Date() // Could also take from document if document has a "test date"
            };
        });

        if (biomarkerResultsData.length > 0) {
            // We use createMany if supported, or loop
            for (const result of biomarkerResultsData) {
                await (prisma as any).biomarkerResult.create({
                    data: result
                });
            }
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Error confirming medical data:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
