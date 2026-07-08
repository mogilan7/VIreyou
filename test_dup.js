const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({
    where: { telegram_id: '175269194' },
    select: { email: true, subscription_expires_at: true, role: true }
  });
  console.log('Users with telegram_id 175269194:', users);
  
  const users2 = await prisma.user.findMany({
    where: { telegram_id: '1922615825' },
    select: { email: true, subscription_expires_at: true, role: true }
  });
  console.log('Users with telegram_id 1922615825:', users2);
}
main().finally(() => prisma.$disconnect());
