import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const activities = await prisma.activityLog.findMany({
    orderBy: { date: 'desc' },
    take: 5,
    include: { User: { select: { full_name: true, telegram_id: true } } }
  });

  const sleep = await prisma.sleepLog.findMany({
    orderBy: { date: 'desc' },
    take: 5,
    include: { User: { select: { full_name: true, telegram_id: true } } }
  });

  console.log("Recent Activities:", JSON.stringify(activities, null, 2));
  console.log("Recent Sleep:", JSON.stringify(sleep, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
