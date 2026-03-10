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

        const modelsToTry = [
            "models/gemini-2.0-flash",
            "models/gemini-flash-latest",
            "models/gemini-1.5-flash",
            "models/gemini-pro-latest"
        ];

        let lastError = "";

        for (const modelName of modelsToTry) {
            try {
                log(`Attempting extraction with model: ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });

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

                log(`Calling Gemini API for extraction (${modelName})...`);
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
                log(`AI Raw response received from ${modelName}`);

                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error("AI returned no JSON data.");
                }

                const extractedData = JSON.parse(jsonMatch[0]);

                if (extractedData) {
                    log(`Extraction successful with ${modelName}. Updating database...`);

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

                    log(`SUCCESS: All records updated for user ${doc.user_id} using ${modelName}`);
                    return; // EXIT loop and function on success
                }
            } catch (error: any) {
                lastError = error.message || "Unknown AI error";
                log(`Model ${modelName} attempt failed: ${lastError}`);

                // If it's a quota issue (429) or high demand (503), continue to next model
                if (lastError.includes("429") || lastError.includes("503") || lastError.includes("quota")) {
                    log(`Detected Quota/Load error for ${modelName}. Trying next model...`);
                    continue;
                }

                // If it's a critical logic error (not quota), we might still want to try next model just in case
                // but we preserve the error.
            }
        }

        // If we reach here, ALL models failed
        throw new Error(`All models failed. Last error: ${lastError}`);

    } catch (error: unknown) {
        const err = error as Error;
        const errorDetail = err.message || "Unknown AI error";
        log(`CRITICAL: EXTRACTION FAILED ACROSS ALL MODELS: ${errorDetail}`);

        // Save detailed error info to doc
        await prisma.medicalDocument.update({
            where: { id: docId },
            data: {
                status: 'FAILED',
                extracted_data: JSON.stringify({
                    error: errorDetail,
                    timestamp: new Date().toISOString(),
                    hint: errorDetail.includes("429") ? "API Quota exceeded. Please wait a few minutes." : "Check if the file is a clear medical document."
                })
            }
        });

        console.error("AI Extraction failed:", error);
    }
}
