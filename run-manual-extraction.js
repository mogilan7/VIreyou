const fs = require('fs');
const { extractHealthData } = require('./src/lib/ai-extraction');
const { PrismaClient } = require('@prisma/client');

async function runManual() {
    let dbUrl = '';
    let apiKey = '';
    if (fs.existsSync('.env.local')) {
        const env = fs.readFileSync('.env.local', 'utf8');
        dbUrl = env.match(/DIRECT_URL=(.*)/)?.[1]?.trim()?.replace(/"/g, '') || '';
        apiKey = env.match(/GOOGLE_GENERATIVE_AI_API_KEY=(.*)/)?.[1]?.trim()?.replace(/"/g, '') || '';
    }

    process.env.DATABASE_URL = dbUrl;
    process.env.DIRECT_URL = dbUrl;
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;

    const prisma = new PrismaClient();
    const doc = await prisma.medicalDocument.findFirst({
        where: { file_name: 'MINGALAR HOSPITAL.pdf' },
        orderBy: { created_at: 'desc' }
    });

    if (!doc) {
        console.log('Document not found');
        return;
    }

    console.log(`Starting manual extraction for: ${doc.file_name} (${doc.id})`);
    try {
        await extractHealthData(doc.id);
        console.log('Manual extraction finished (check DB or logs)');

        const updated = await prisma.medicalDocument.findUnique({ where: { id: doc.id } });
        console.log('Final Status:', updated.status);
        if (updated.status === 'COMPLETED') {
            const data = JSON.parse(updated.extracted_data);
            console.log('Biomarkers found:', Object.keys(data).length);
            console.log('Data:', updated.extracted_data);
        } else {
            console.log('Result:', updated.extracted_data);
        }
    } catch (e) {
        console.error('Manual Run Failed:', e);
    }
    await prisma.$disconnect();
}

runManual();
