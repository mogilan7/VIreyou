
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSubscriptions() {
    // Look for users with future expiry dates
    const users = await prisma.user.findMany({
        where: {
            subscription_expires_at: {
                gt: new Date()
            }
        },
        include: {
            transactions: {
                where: {
                    type: 'SUBSCRIPTION'
                },
                orderBy: {
                    created_at: 'desc'
                },
                take: 1
            }
        }
    });

    console.log(`Found ${users.length} users with active subscriptions:\n`);

    users.forEach(u => {
        const latestTx = u.transactions[0];
        let plan = u.role === 'PRO' ? 'PRO' : 'Standard';
        if (latestTx && latestTx.description) {
            if (latestTx.description.includes('PRO')) plan = 'PRO';
            else if (latestTx.description.includes('Standard')) plan = 'Standard';
        }
        
        console.log(`User: ${u.full_name || 'No Name'} (@${u.telegram_username || 'No Username'})`);
        console.log(`Email: ${u.email}`);
        console.log(`Role/Plan: ${plan}`);
        console.log(`Expires: ${u.subscription_expires_at}`);
        console.log(`Last Payment: ${latestTx ? latestTx.amount + ' RUB (' + latestTx.created_at.toISOString() + ')' : 'No transaction log'}`);
        console.log('--------------------------------------------------');
    });
}

checkSubscriptions()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
