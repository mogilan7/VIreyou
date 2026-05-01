
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function countEverything() {
    const txCount = await prisma.transaction.count();
    const userCount = await prisma.user.count();
    console.log(`Total transactions: ${txCount}`);
    console.log(`Total users: ${userCount}`);
}

countEverything()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
