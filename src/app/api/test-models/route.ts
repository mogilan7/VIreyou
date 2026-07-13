import { NextResponse } from "next/server";

export async function GET() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "No API key found" });
    }

    try {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey);
        const data = await res.json();
        return NextResponse.json(data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
