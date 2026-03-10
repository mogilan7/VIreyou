import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "@/lib/prisma";
import fs from 'fs';

const logPath = '/tmp/api-debug.log';

export async function extractHealthData(docId: string) {
    const log = (msg: string) => fs.appendFileSync(logPath, `[${new Date().toISOString()}] AI LOG: ${msg}\n`);

    log(`Starting extraction for doc ${docId}`);

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
        log(`CRITICAL ERROR: GOOGLE_GENERATIVE_AI_API_KEY is not defined in environment`);
    } else {
        log(`API Key found (length: ${apiKey.length}, starts with: ${apiKey.substring(0, 4)}...)`);
    }

    const genAI = new GoogleGenerativeAI(apiKey || "");

    try {
        // @ts-ignore
        const doc = await prisma.medicalDocument.findUnique({ where: { id: docId } });
        if (!doc) {
            log(`Document ${docId} not found in database`);
            return;
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            You are a highly accurate medical data extraction AI. 
            Analyze the provided medical lab result (image or PDF) and extract values for the following biomarkers if present.
            Return ONLY a JSON object with the following keys. If a value is not found, use null.
            
            Fields to extract:
            - glucose (mmol/L)
            - ferritin (ng/mL or µg/L)
            - cortisol (nmol/L)
            - vitamin_d3 (ng/mL)
            - insulin (µU/mL or mIU/L)
            - ldl_cholesterol (mmol/L)
            - crp (mg/L)
            - homocysteine (µmol/L)
            
            Important: 
            1. Normalize units to the ones specified above. 
            2. If the document is in Russian, translate/map the terms correctly (e.g., "Глюкоза" -> glucose, "Ферритин" -> ferritin).
            3. Accuracy is critical.
        `;

        log(`Model initialized: gemini-1.5-flash`);

        log(`Fetching file from: ${doc.file_url}`);
        const response = await fetch(doc.file_url);
        if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);

        const buffer = await response.arrayBuffer();
        const base64Content = Buffer.from(buffer).toString("base64");
        log(`File fetched and converted to base64 (${base64Content.length} bytes)`);

        log(`Calling Gemini API...`);
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Content,
                    mimeType: doc.file_type
                }
            }
        ]);

        const text = result.response.text();
        log(`Gemini response received: ${text.substring(0, 100)}...`);

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const extractedData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

        if (extractedData) {
            log(`Data extracted successfully: ${JSON.stringify(extractedData)}`);
            // @ts-ignore
            await prisma.medicalDocument.update({
                where: { id: docId },
                data: {
                    status: 'COMPLETED',
                    extracted_data: JSON.stringify(extractedData)
                }
            });

            const filteredData = Object.fromEntries(
                Object.entries(extractedData).filter(([_, v]) => v !== null)
            );

            log(`Updating HealthData for user ${doc.user_id}...`);
            // @ts-ignore
            await prisma.healthData.upsert({
                where: { user_id: doc.user_id },
                update: filteredData,
                create: {
                    user_id: doc.user_id,
                    ...filteredData as any
                }
            });

            log(`SUCCESS: HealthData updated for user ${doc.user_id}`);
        } else {
            throw new Error("Could not parse AI response as JSON");
        }

    } catch (error: any) {
        const fullError = `${error.message}\n${error.stack}`;
        log(`ERROR: ${fullError}`);
        console.error("AI Extraction failed:", error);

        // @ts-ignore
        try {
            await prisma.medicalDocument.update({
                where: { id: docId },
                data: {
                    status: 'FAILED',
                    extracted_data: JSON.stringify({ error: error.message, stack: error.stack })
                }
            });
        } catch (e: any) {
            log(`DOUBLE ERROR (failed update status): ${e.message}`);
        }
    }
}
