const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const sleepLogs = await prisma.sleepLog.findMany({
        take: 15,
        orderBy: { date: 'desc' }
    });
    console.log(sleepLogs.map(l => ({ id: l.id, date: l.date, created_at: l.created_at, hrv: l.hrv, resting_heart_rate: l.resting_heart_rate })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
