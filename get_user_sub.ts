import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const email = 'cleverval23@gmail.com';
  
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      transactions: {
        orderBy: { created_at: 'desc' },
        take: 10
      }
    }
  });

  if (!user) {
    console.log(`User ${email} not found.`);
    return;
  }

  console.log('--- User Info ---');
  console.log(`ID: ${user.id}`);
  console.log(`Email: ${user.email}`);
  console.log(`Role: ${user.role}`);
  console.log(`Status: ${user.status}`);
  console.log(`Subscription End Date: ${user.subscription_end_date}`);
  console.log(`Subscription Plan: ${user.subscription_plan}`);
  console.log(`Stripe Customer ID: ${user.stripe_customer_id}`);
  
  console.log('\n--- Recent Transactions ---');
  if (user.transactions && user.transactions.length > 0) {
    user.transactions.forEach((tx: any) => {
      console.log(`[${tx.created_at}] Amount: ${tx.amount} | Type: ${tx.type} | Status: ${tx.status} | Ref: ${tx.reference_id}`);
    });
  } else {
    console.log('No transactions found.');
  }

}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
