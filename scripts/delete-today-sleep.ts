import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deleted = await prisma.sleepLog.deleteMany({
    where: {
      date: {
        gte: today
      }
    }
  });

  console.log(`Deleted ${deleted.count} sleep logs for today.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
