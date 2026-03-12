import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { extractHealthData } from "@/lib/ai-extraction";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const documentId = searchParams.get("id");

        if (!documentId) {
            return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Verify ownership
        const doc = await (prisma as any).medicalDocument.findUnique({
            where: { id: documentId }
        });

        if (!doc || doc.user_id !== user.id) {
            return NextResponse.json({ error: "Document not found or access denied" }, { status: 404 });
        }

        // Run extraction and AWAIT it (up to Vercel/local timeout)
        await extractHealthData(documentId);

        // Fetch the updated document
        const updatedDoc = await (prisma as any).medicalDocument.findUnique({
            where: { id: documentId }
        });

        return NextResponse.json(updatedDoc);

    } catch (error: any) {
        console.error("Extraction API error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
