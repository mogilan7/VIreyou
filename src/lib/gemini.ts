import { GoogleGenerativeAI } from "@google/generative-ai";

export const getGeminiModel = (
    modelName: string = "gemini-1.5-pro", 
    temperature: number = 0.2, 
    jsonMode: boolean = false,
    systemInstruction?: string
) => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.BOT_OPENAI_API_KEY || "";
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not defined in the environment");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    return genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
            temperature: temperature,
            ...(jsonMode && { responseMimeType: "application/json" }),
        },
        ...(systemInstruction && { systemInstruction })
    });
};
