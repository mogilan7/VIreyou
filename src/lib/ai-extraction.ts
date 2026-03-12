import OpenAI from "openai";
import prisma from "@/lib/prisma";
import fs from 'fs';

const logPath = '/tmp/api-debug.log';

export async function extractHealthData(docId: string) {
    const log = (msg: string) => fs.appendFileSync(logPath, `[${new Date().toISOString()}] AI LOG: ${msg}\n`);

    log(`Starting OpenAI extraction for doc ${docId}`);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        log(`CRITICAL ERROR: OPENAI_API_KEY is not defined in environment`);
        // Fallback: save error to DB so user sees it
        await prisma.medicalDocument.update({
            where: { id: docId },
            data: {
                status: 'FAILED',
                extracted_data: JSON.stringify({
                    error: "OPENAI_API_KEY missing. Please add it to .env.local and Vercel.",
                    timestamp: new Date().toISOString()
                })
            }
        }).catch(e => log(`Failed to update DB with key error: ${e.message}`));
        return;
    }

    const openai = new OpenAI({ apiKey });

    try {
        const doc = await prisma.medicalDocument.findUnique({ where: { id: docId } });
        if (!doc) {
            log(`Document ${docId} not found in database`);
            return;
        }

        const prompt = `
            You are a highly accurate medical data extraction AI specialized in laboratory test results.
            Analyze the provided medical lab result image or PDF and extract values for ALL health markers/biomarkers present.
            
            Return ONLY a raw JSON object where each key is the marker name (in English, normalized, snake_case).
            For each marker, provide:
            - value (number or string, use decimals for numbers e.g. 5.2)
            - unit (string, e.g. "mmol/L", "ng/mL", "g/L")
            - reference_range (string if found, e.g. "4.1 - 5.9")
            - status (string: "NORMAL", "ABNORMAL", or "UNKNOWN" based on the reference range provided in the document)
            
            Guidelines:
            1. If the document is in Russian, map marker names to their standard medical English equivalents (e.g., "Глюкоза" -> "glucose", "Ферритин" -> "ferritin", "С-реактивный белок" -> "crp").
            2. Be extremely precise with numbers. 
            3. If a marker is mentioned multiple times, use the most recent or main result.
            4. Do not include any text outside the JSON object. No markdown backticks.
            
            Example output format:
            {
              "glucose": { "value": 4.8, "unit": "mmol/L", "reference_range": "4.1-5.9", "status": "NORMAL" },
              "ferritin": { "value": 180, "unit": "ng/mL", "reference_range": "30-400", "status": "NORMAL" }
            }
        `;

        log(`Fetching file from: ${doc.file_url}`);
        const fileResponse = await fetch(doc.file_url);
        if (!fileResponse.ok) throw new Error(`External Download failed: ${fileResponse.status} ${fileResponse.statusText}`);

        const buffer = await fileResponse.arrayBuffer();
        const base64Content = Buffer.from(buffer).toString("base64");
        log(`File fetched: ${buffer.byteLength} bytes. Converted to base64.`);

        const modelsToTry = ["gpt-4o", "gpt-4o-mini"];
        let lastError = "";

        for (const modelName of modelsToTry) {
            try {
                log(`Attempting OpenAI extraction with model: ${modelName}`);

                const response = await openai.chat.completions.create({
                    model: modelName,
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: prompt },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: `data:${doc.file_type || 'image/jpeg'};base64,${base64Content}`
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens: 4096,
                    response_format: { type: "json_object" }
                });

                const text = response.choices[0]?.message?.content;
                if (!text) throw new Error("OpenAI returned no content.");

                log(`AI response received from ${modelName}`);
                const extractedData = JSON.parse(text);

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
                lastError = error.message || "Unknown OpenAI error";
                log(`Model ${modelName} attempt failed: ${lastError}`);
                if (lastError.includes("429") || lastError.includes("quota")) continue;
            }
        }

        throw new Error(`All OpenAI models failed. Last error: ${lastError}`);

    } catch (error: unknown) {
        const err = error as Error;
        const errorDetail = err.message || "Unknown AI error";
        log(`CRITICAL: EXTRACTION FAILED ACROSS ALL MODELS: ${errorDetail}`);

        await prisma.medicalDocument.update({
            where: { id: docId },
            data: {
                status: 'FAILED',
                extracted_data: JSON.stringify({
                    error: errorDetail,
                    timestamp: new Date().toISOString(),
                    hint: "Ensure the file is clear and OpenAI API key is valid / has balance."
                })
            }
        }).catch(e => log(`Failed final DB error update: ${e.message}`));

        console.error("OpenAI Extraction failed:", error);
    }
}
