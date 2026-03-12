import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const documents = await (prisma as any).medicalDocument.findMany({
            where: { user_id: user.id },
            orderBy: { created_at: 'desc' }
        });

        return NextResponse.json({ documents });

    } catch (error: any) {
        console.error("List documents API error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
