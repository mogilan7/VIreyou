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
        const doc = await prisma.medicalDocument.findUnique({ where: { id: docId } });
        if (!doc) {
            log(`Document ${docId} not found in database`);
            return;
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            You are a highly accurate medical data extraction AI. 
            Analyze the provided medical lab result (image or PDF) and extract values for ALL health markers/biomarkers present.
            Return ONLY a JSON object where each key is the marker name (in English, normalized).
            For each marker, provide:
            - value (number or string)
            - unit (string)
            - reference_range (string if found, e.g. "4.2-5.1")
            - status (string: "NORMAL", "ABNORMAL", or "UNKNOWN" based on the reference range in the doc)
            
            Example:
            {
              "glucose": { "value": 4.8, "unit": "mmol/L", "reference_range": "4.2-5.1", "status": "NORMAL" },
              "ferritin": { "value": 180, "unit": "ng/mL", "reference_range": "80-150", "status": "ABNORMAL" }
            }

            If the document is in Russian, translate the marker names to standard medical English counterparts (e.g. Глюкоза -> glucose).
            Extract as many markers as you can find. Accuracy is critical.
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

            // 1. Update the document status
            await prisma.medicalDocument.update({
                where: { id: docId },
                data: {
                    status: 'COMPLETED',
                    extracted_data: JSON.stringify(extractedData)
                }
            });

            // 2. Prepare data for HealthData
            // Identify the core 8 fields we have hardcoded columns for
            const coreFields = ['glucose', 'ferritin', 'cortisol', 'vitamin_d3', 'insulin', 'ldl_cholesterol', 'crp', 'homocysteine'];
            const coreUpdate: any = {};

            Object.entries(extractedData).forEach(([key, data]: [string, any]) => {
                if (coreFields.includes(key)) {
                    const val = parseFloat(data.value);
                    if (!isNaN(val)) coreUpdate[key] = val;
                }
            });

            log(`Updating HealthData for user ${doc.user_id}...`);
            await prisma.healthData.upsert({
                where: { user_id: doc.user_id },
                update: {
                    ...coreUpdate,
                    biomarkers: extractedData // Save EVERYTHING to the new JSON field
                },
                create: {
                    user_id: doc.user_id,
                    ...coreUpdate,
                    biomarkers: extractedData
                }
            });

            log(`SUCCESS: HealthData updated for user ${doc.user_id}`);
        }
    } catch (error: unknown) {
        const err = error as Error;
        const fullError = `${err.message}\n${err.stack}`;
        log(`ERROR: ${fullError}`);
        console.error("AI Extraction failed:", error);

        try {
            await prisma.medicalDocument.update({
                where: { id: docId },
                data: {
                    status: 'FAILED',
                    extracted_data: JSON.stringify({ error: err.message, stack: err.stack })
                }
            });
        } catch (e: unknown) {
            const err2 = e as Error;
            log(`DOUBLE ERROR (failed update status): ${err2.message}`);
        }
    }
}
