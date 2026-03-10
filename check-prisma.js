const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('Prisma keys:', Object.keys(prisma).filter(k => !k.startsWith('_')));
    try {
        const count = await prisma.medicalDocument.count();
        console.log('MedicalDocument count:', count);
    } catch (e) {
        console.error('Error accessing medicalDocument:', e.message);
    }
    await prisma.$disconnect();
}

check();
