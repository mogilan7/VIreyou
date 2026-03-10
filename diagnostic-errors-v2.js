const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function checkError() {
    let dbUrl = process.env.DIRECT_URL;

    if (!dbUrl && fs.existsSync('.env.local')) {
        const env = fs.readFileSync('.env.local', 'utf8');
        const dmatch = env.match(/DIRECT_URL=(.*)/);
        if (dmatch) {
            dbUrl = dmatch[1].trim().replace(/"/g, '').replace(/'/g, '');
        }
    }

    if (!dbUrl) {
        console.error('No DIRECT_URL found in env or .env.local');
        return;
    }

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: dbUrl
            }
        }
    });

    try {
        console.log('Connecting to database...');
        const failedDocs = await prisma.medicalDocument.findMany({
            where: { status: 'FAILED' },
            orderBy: { created_at: 'desc' },
            take: 3
        });

        if (failedDocs.length > 0) {
            console.log(`Found ${failedDocs.length} recent failed docs:`);
            failedDocs.forEach(doc => {
                console.log('---');
                console.log(`ID: ${doc.id}`);
                console.log(`Name: ${doc.file_name}`);
                console.log(`Error: ${doc.extracted_data}`);
                console.log(`Date: ${doc.created_at}`);
            });
        } else {
            console.log('No failed documents found.');
        }
    } catch (e) {
        console.error('Prisma Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkError();
