
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTransactions() {
    const txs = await prisma.transaction.findMany({
        orderBy: { created_at: 'desc' },
        take: 10,
        include: { user: true }
    });

    console.log(`Last 10 transactions:\n`);
    txs.forEach(tx => {
        console.log(`[${tx.created_at.toISOString()}] User: ${tx.user.full_name} (@${tx.user.telegram_username})`);
        console.log(`Type: ${tx.type} | Amount: ${tx.amount} | Desc: ${tx.description}`);
        console.log('--------------------------------------------------');
    });
}

checkTransactions()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
