const fs = require('fs');
const { extractHealthData } = require('./src/lib/ai-extraction');
const { PrismaClient } = require('@prisma/client');

async function runManual() {
    let dbUrl = '';
    let apiKey = '';
    let openAiKey = '';
    if (fs.existsSync('.env.local')) {
        const env = fs.readFileSync('.env.local', 'utf8');
        dbUrl = env.match(/DIRECT_URL=(.*)/)?.[1]?.trim()?.replace(/"/g, '') || '';
        apiKey = env.match(/GOOGLE_GENERATIVE_AI_API_KEY=(.*)/)?.[1]?.trim()?.replace(/"/g, '') || '';
        openAiKey = env.match(/OPENAI_API_KEY=(.*)/)?.[1]?.trim()?.replace(/"/g, '') || '';
    }

    process.env.DATABASE_URL = dbUrl;
    process.env.DIRECT_URL = dbUrl;
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;
    process.env.OPENAI_API_KEY = openAiKey;

    const prisma = new PrismaClient();
    const doc = await prisma.medicalDocument.findFirst({
        where: { status: 'PROCESSING' }, // Try the one that's currently processing
        orderBy: { created_at: 'desc' }
    });

    if (!doc) {
        console.log('No document in PROCESSING status found, trying latest document...');
        const latest = await prisma.medicalDocument.findFirst({
            orderBy: { created_at: 'desc' }
        });
        if (!latest) {
            console.log('No documents found at all.');
            return;
        }
        await startExtraction(latest.id, prisma);
    } else {
        await startExtraction(doc.id, prisma);
    }

    await prisma.$disconnect();
}

async function startExtraction(docId, prisma) {
    console.log(`Starting manual extraction for document: ${docId}`);
    try {
        await extractHealthData(docId);
        console.log('Manual extraction command finished.');

        const updated = await prisma.medicalDocument.findUnique({ where: { id: docId } });
        console.log('Final Status:', updated.status);
        if (updated.status === 'COMPLETED') {
            const data = JSON.parse(updated.extracted_data);
            console.log('Biomarkers found:', Object.keys(data).length);
            console.log('Data sample:', JSON.stringify(data).substring(0, 100) + '...');
        } else {
            console.log('Error/Result:', updated.extracted_data);
        }
    } catch (e) {
        console.error('Manual Run Failed with code error:', e);
    }
}

runManual();
