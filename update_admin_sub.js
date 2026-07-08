const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 days
  const updatedUser = await prisma.user.update({
    where: { email: 'mogilev.andrey@gmail.com' },
    data: { 
      subscription_expires_at: newExpiry 
      // role remains 'admin', so they have all features anyway, but the expiration is set
    }
  });
  console.log('User updated:', updatedUser.email, 'Expires at:', updatedUser.subscription_expires_at);
}
main().finally(() => prisma.$disconnect());
