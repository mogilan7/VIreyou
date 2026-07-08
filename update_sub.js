const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({
    orderBy: { created_at: 'desc' },
    take: 10,
    select: { email: true, role: true, telegram_id: true }
  });
  console.log('Recent Users:', users);
}
main().finally(() => prisma.$disconnect());
