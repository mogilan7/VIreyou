const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    try {
        console.log('Prisma keys:', Object.keys(prisma).filter(k => k[0] === k[0].toLowerCase() && !k.startsWith('_')));
        console.log('Checking medicalDocument property...');
        if ('medicalDocument' in prisma) {
            console.log('medicalDocument property exists!');
            const docs = await prisma.medicalDocument.findMany();
            console.log('findMany result:', docs);
        } else {
            console.log('medicalDocument property DOES NOT exist!');
        }
    } catch (e) {
        console.error('Test failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

test();
