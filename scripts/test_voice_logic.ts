import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
import { analyzeTextWithAI } from '../src/lib/telegram/ai-services';

async function test() {
    try {
        const text = "Выпил стакан пива 0.33, светлая.";
        console.log("Input:", text);
        const result = await analyzeTextWithAI(text);
        console.log("GPT Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
