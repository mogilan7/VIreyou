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
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        const doc = await prisma.medicalDocument.findUnique({ where: { id: docId } });
        if (!doc) {
            log(`Document ${docId} not found in database`);
            return;
        }

        // Confirming available models via discovery:
        const primaryModel = "models/gemini-flash-latest";
        const secondaryModel = "models/gemini-2.0-flash";
        const fallbackModel = "gemini-flash-latest";

        let model;
        try {
            log(`Initializing model: ${primaryModel}`);
            model = genAI.getGenerativeModel({ model: primaryModel });
        } catch (e) {
            log(`Failed to init ${primaryModel}, trying secondary ${secondaryModel}`);
            try {
                model = genAI.getGenerativeModel({ model: secondaryModel });
            } catch (e2) {
                log(`Failed to init ${secondaryModel}, trying final fallback ${fallbackModel}`);
                model = genAI.getGenerativeModel({ model: fallbackModel });
            }
        }

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
            Extract as many markers as you can find. Accuracy is critical. Accuracy is critical. Do not include any markdown formatting or extra text.
        `;

        log(`Fetching file from: ${doc.file_url}`);
        const response = await fetch(doc.file_url);
        if (!response.ok) throw new Error(`External Download failed: ${response.status} ${response.statusText}`);

        const buffer = await response.arrayBuffer();
        const byteLength = buffer.byteLength;
        const base64Content = Buffer.from(buffer).toString("base64");
        log(`File fetched: ${byteLength} bytes. Converted to base64.`);

        if (byteLength > 20 * 1024 * 1024) { // 20MB limit
            throw new Error("File too large for AI processing (>20MB)");
        }

        log(`Calling Gemini API for extraction...`);
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Content,
                    mimeType: doc.file_type || "image/jpeg"
                }
            }
        ]);

        const text = result.response.text();
        log(`AI Raw response (length: ${text.length}): ${text.substring(0, 50)}...`);

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("AI returned no JSON data. It might be unable to read the document clearly.");
        }

        const extractedData = JSON.parse(jsonMatch[0]);

        if (extractedData) {
            log(`Extraction successful. Updating database...`);

            // 1. Update the document status
            await prisma.medicalDocument.update({
                where: { id: docId },
                data: {
                    status: 'COMPLETED',
                    extracted_data: JSON.stringify(extractedData)
                }
            });

            // 2. Prepare data for HealthData
            const coreFields = ['glucose', 'ferritin', 'cortisol', 'vitamin_d3', 'insulin', 'ldl_cholesterol', 'crp', 'homocysteine'];
            const coreUpdate: any = {};

            Object.entries(extractedData).forEach(([key, data]: [string, any]) => {
                if (coreFields.includes(key) && data.value) {
                    const val = parseFloat(data.value.toString().replace(',', '.'));
                    if (!isNaN(val)) coreUpdate[key] = val;
                }
            });

            await prisma.healthData.upsert({
                where: { user_id: doc.user_id },
                update: {
                    ...coreUpdate,
                    biomarkers: extractedData
                },
                create: {
                    user_id: doc.user_id,
                    ...coreUpdate,
                    biomarkers: extractedData
                }
            });

            log(`SUCCESS: All records updated for user ${doc.user_id}`);
        }
    } catch (error: unknown) {
        const err = error as Error;
        const errorDetail = err.message || "Unknown AI error";
        log(`EXTRACTION FAILED: ${errorDetail}`);

        // Save detailed error info to doc
        await prisma.medicalDocument.update({
            where: { id: docId },
            data: {
                status: 'FAILED',
                extracted_data: JSON.stringify({
                    error: errorDetail,
                    timestamp: new Date().toISOString(),
                    hint: "Check if the file is a clear medical document and API key is valid."
                })
            }
        });

        console.error("AI Extraction failed:", error);
    }
}
