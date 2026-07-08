const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({
    orderBy: { created_at: 'desc' },
    take: 5,
    select: { email: true, role: true, subscription_expires_at: true, telegram_id: true }
  });
  console.log('Recent Users:', users);
  const tx = await prisma.transaction.findMany({
    orderBy: { created_at: 'desc' },
    take: 5
  });
  console.log('Recent Transactions:', tx);
}
main().finally(() => prisma.$disconnect());
