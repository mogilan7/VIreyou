import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function main() {
    if (openai.beta && openai.beta.threads) {
        console.log("Keys in openai.beta.threads:", Object.keys(openai.beta.threads));
    } else {
        console.log("openai.beta.threads is undefined");
    }
}

main();
