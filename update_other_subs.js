const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 days
  await prisma.user.updateMany({
    where: { 
      email: { 
        in: ['tg_1922615825@vireyou.com', 'test_temp2@vireyou.com', 'comfprorf@gmail.com'] 
      }
    },
    data: { subscription_expires_at: newExpiry }
  });
  console.log('Updated alternative accounts to have subscription.');
}
main().finally(() => prisma.$disconnect());
