import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function main() {
    console.log("Keys in openai:", Object.keys(openai));
    if (openai.beta) {
        console.log("Keys in openai.beta:", Object.keys(openai.beta));
        // let's check assistants
        if (openai.beta.assistants) {
             console.log("Keys in openai.beta.assistants:", Object.keys(openai.beta.assistants));
        }
    } else {
        console.log("openai.beta is undefined");
    }
}

main();
