const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking last 5 medical documents...");
    try {
        const docs = await prisma.medicalDocument.findMany({
            take: 5,
            orderBy: { created_at: 'desc' }
        });

        if (docs.length === 0) {
            console.log("No documents found.");
        } else {
            docs.forEach(doc => {
                console.log(`- ID: ${doc.id}`);
                console.log(`  File: ${doc.file_name}`);
                console.log(`  Status: ${doc.status}`);
                console.log(`  Date: ${doc.created_at}`);
                console.log('---');
            });
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
