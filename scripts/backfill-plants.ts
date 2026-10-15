import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../src/lib/prisma';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
    }
});

async function runBackfill() {
    console.log('[BACKFILL] Starting plants backfill...');
    const emptyLogs = await prisma.nutritionLog.findMany({
        where: { plants: { equals: [] } },
        select: { id: true, dish: true, description: true },
        orderBy: { created_at: 'desc' }
    });

    console.log(`[BACKFILL] Found ${emptyLogs.length} logs needing plant extraction.`);
    if (emptyLogs.length === 0) {
        console.log('[BACKFILL] All logs already have plants populated!');
        return;
    }

    const BATCH_SIZE = 20;
    for (let i = 0; i < emptyLogs.length; i += BATCH_SIZE) {
        const batch = emptyLogs.slice(i, i + BATCH_SIZE);
        console.log(`[BACKFILL] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(emptyLogs.length / BATCH_SIZE)} (${batch.length} items)...`);

        const prompt = `You are an expert nutritional biochemist analyzing food logs for microbiome plant diversity (American Gut Project guidelines).
For each food entry, identify whole plant species present in the meal from its dish name and description.

Rules:
- Include: vegetables, fruits, berries, legumes, whole grains, nuts, seeds, herbs, spices, mushrooms.
- Normalize names to common Russian singular lowercase (e.g. 'помидор', 'огурец', 'дыня', 'рис', 'базилик', 'чеснок', 'лук', 'морковь', 'капуста', 'перец', 'укроп', 'кунжут', 'пшеница').
- DO NOT include: meat, poultry, fish, eggs, dairy, refined sugar, white refined flour, vegetable oils, coffee, tea, water, salt, chemical additives.
- If a meal contains no plants (e.g., pure scrambled eggs, steak, plain cottage cheese), return an empty array [].

Input meals:
${JSON.stringify(batch, null, 2)}

Return strictly valid JSON:
[
  { "id": "...", "plants": ["..."] }
]`;

        try {
            const res = await model.generateContent(prompt);
            const text = res.response.text();
            const parsed = JSON.parse(text);

            if (Array.isArray(parsed)) {
                for (const item of parsed) {
                    if (item.id && Array.isArray(item.plants)) {
                        const cleanPlants = item.plants.map((p: any) => String(p).toLowerCase().trim()).filter(Boolean);
                        await prisma.nutritionLog.update({
                            where: { id: item.id },
                            data: { plants: cleanPlants }
                        });
                    }
                }
                console.log(`[BACKFILL] Batch ${Math.floor(i / BATCH_SIZE) + 1} updated successfully.`);
            }
        } catch (err: any) {
            console.error(`[BACKFILL] Error in batch ${i}:`, err.message || err);
        }

        // Small delay to be polite to rate limits
        await new Promise(r => setTimeout(r, 600));
    }

    console.log('[BACKFILL] Completed! Checking results...');
    const filledCount = await prisma.nutritionLog.count({
        where: { NOT: { plants: { equals: [] } } }
    });
    console.log(`[BACKFILL] Total logs with plants now: ${filledCount}`);
}

runBackfill()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
