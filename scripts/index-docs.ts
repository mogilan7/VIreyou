import OpenAI from "openai";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    console.error("❌ Error: OPENAI_API_KEY is not defined in .env.local");
    process.exit(1);
}

const openai = new OpenAI({ apiKey });

async function main() {
    console.log("🚀 Starting Knowledge Base Indexing for OpenAI Assistant...");

    const docsDir = path.join(process.cwd(), "docs");
    if (!fs.existsSync(docsDir)) {
        console.log(`Creating directory: ${docsDir}`);
        fs.mkdirSync(docsDir);
    }

    const files = fs.readdirSync(docsDir).filter(f => f.endsWith(".pdf") || f.endsWith(".docx") || f.endsWith(".txt"));

    if (files.length === 0) {
        console.warn("\n⚠️  No documents found in /docs/ folder!");
        console.warn("👉 Please place your .pdf or .docx files in the /docs/ folder and run again.");
        return;
    }

    console.log(`Found ${files.length} files to upload:`, files);

    // 1. Create a Vector Store
    console.log("\n1. Creating OpenAI Vector Store...");
    const vectorStore = await openai.vectorStores.create({
        name: "VIReYou Knowledge Base",
    });
    const vectorStoreId = vectorStore.id;
    console.log(`✅ Vector Store Created: ${vectorStoreId}`);

    // 2. Upload Files
    console.log("\n2. Uploading files and attaching to Vector Store...");
    const fileIds: string[] = [];
    for (const fileName of files) {
        const filePath = path.join(docsDir, fileName);
        console.log(`Uploading: ${fileName}...`);

        try {
            const uploadedFile = await openai.files.create({
                file: fs.createReadStream(filePath),
                purpose: "assistants",
            });
            console.log(`   Uploaded file ID: ${uploadedFile.id}`);
            
            // Attach to Vector Store
            await openai.vectorStores.files.create(vectorStoreId, {
                file_id: uploadedFile.id
            });
            console.log(`   ✅ Attached to vector store.`);
            
            fileIds.push(uploadedFile.id);
        } catch (err: any) {
            console.error(`   ❌ Failed to process ${fileName}:`, err.message);
        }
    }

    if (fileIds.length === 0) {
        console.error("❌ No files were successfully uploaded.");
        return;
    }

    // 3. Create Assistant
    console.log("\n3. Creating OpenAI Assistant with File Search...");
    const assistant = await openai.beta.assistants.create({
        name: "VIReYou Anti-Age Advisor",
        instructions: `
        You are a highly qualified Preventative and Anti-Age Medicine Physician at VIReYou.
        Your goal is to provide evidence-based recommendations for lab diagnostics and health optimization.
        
        Strict Guidelines:
        1. Base your answers and justifications ONLY on the attached documents in your File Search.
        2. Do not use generic internet knowledge or hallucinate facts that are not present in the files.
        3. If a recommendation requires justification (e.g., 'Сдать ферритин'), provide a brief rationale based on the uploaded file contents.
        4. If the client questionnaire scores indicate specific trigger points (like SARC-F > 4), formulate the primary action regarding diagnostics following the specialist guidance files.
        `,
        model: "gpt-4o",
        tools: [{ type: "file_search" }],
        tool_resources: {
            file_search: {
                vector_store_ids: [vectorStoreId]
            }
        }
    });

    console.log("\n🎉 AI Assistant Created Successfully!");
    console.log(`Assistant ID: ${assistant.id}`);
    console.log("\n👉 Action Required: Add the following to your .env.local file:");
    console.log(`OPENAI_ASSISTANT_ID="${assistant.id}"`);
}

main().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
