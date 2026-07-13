/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getGeminiModel } from "@/lib/gemini";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json({ error: "userId is required" }, { status: 400 });
        }

        // Removed OpenAI setup

        // 1. Fetch Client Profile (Ensures the client exists in specialist's list)
        const profile = await prisma.profiles.findUnique({
            where: { id: userId }
        });

        if (!profile) {
            return NextResponse.json({ error: "Client Profile not found" }, { status: 404 });
        }

        // 1b. Fetch core user record by email lookup for health data (If available)
        const authUser = await prisma.users.findUnique({ where: { id: userId } });
        const email = authUser?.email;

        let user: any = null;
        if (email) {
            user = await prisma.user.findUnique({
                where: { email },
                include: { healthData: true }
            });
        }

        const fullName = profile.full_name || user?.full_name || "Client";

        // 2. Fetch Latest Questionnaire Scores
        const testResults = await prisma.test_results.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' }
        });

        const latestScores: Record<string, number> = {};
        testResults.forEach(r => {
            const key = r.test_type.toLowerCase();
            if (!latestScores[key] && r.score !== null) {
                latestScores[key] = Number(r.score);
            }
        });

        // 3. Aggregate Nutrition Deficits
        const nutritionDeficits: string[] = [];
        const recentLogs = await prisma.nutritionLog.findMany({
            where: { user_id: userId },
            take: 7,
            orderBy: { date: 'desc' }
        });

        const avgProtein = recentLogs.length > 0 
            ? recentLogs.reduce((sum, log) => sum + (log.protein || 0), 0) / recentLogs.length
            : 80;
        if (avgProtein < 60) {
            nutritionDeficits.push("protein");
        }

        // 4. Formulate Trigger State Context
        const triggersContext = {
            metadata: { userId, fullName },
            scores: {
                "sarc_f": latestScores["sarc-f"] || latestScores["sarc_f"] || null,
                "mini_cog": latestScores["mini-cog"] || latestScores["mini_cog"] || null,
                "insomnia_index": latestScores["insomnia"] || latestScores["insomnia_index"] || null
            },
            deficits: nutritionDeficits,
            currentBiomarkers: user?.healthData?.biomarkers || {}
        };

        console.log(`[suggest-labs] Prompting Gemini explicitly...`);
        
        let knowledgeBase = "";
        try {
            knowledgeBase = fs.readFileSync(path.join(process.cwd(), "docs/recommendations.txt"), "utf8");
        } catch (e) {
            console.warn("Could not load knowledge base file", e);
        }

        const model = getGeminiModel("gemini-1.5-pro", 0.2, true);

        const prompt = `
            Review the following current client status JSON. 
            Provide actionable diagnostic recommendations and justifying quotes from your Knowledge Base.
            IMPORTANT: You MUST also mention the names of all the PDF/Knowledge Base files you referenced, preferably as part of the "justificationQuote" or next to the recommendation.
            
            Client Context:
            ${JSON.stringify(triggersContext, null, 2)}
            
            You MUST reply inside a JSON block using the following format:
            {
              "recommendations": [
                {
                  "contextTag": "sarcopenia", 
                  "title": "Саркопения диагностика",
                  "description": "Формулировка рекомендации...",
                  "linkToModule": "Модуль 6",
                  "testsSuggested": [
                    { "testKey": "albumin", "testName": "Альбумин", "reason": "Обоснование из опросника" }
                  ],
                  "justificationQuote": "Цитата из КБ..."
                }
              ]
            }

            --- KNOWLEDGE BASE ---
            ${knowledgeBase}
        `;

        const response = await model.generateContent(prompt);
        let text = response.response.text();
        
        if (text) {
            text = text.replace(/^```json\s*|```$/g, "").trim();
            
            // Robust fallback for trailing quotes or citations outside JSON
            const lastBraceIndex = text.lastIndexOf("}");
            if (lastBraceIndex !== -1) {
                text = text.substring(0, lastBraceIndex + 1);
            }

            const parsed = JSON.parse(text);
            
            return NextResponse.json({
                success: true,
                data: parsed.recommendations || []
            });
        }


    } catch (error: any) {
        console.error("suggest-labs error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to fetch response" }, { status: 500 });
}
