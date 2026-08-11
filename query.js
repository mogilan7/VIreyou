const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const userId = 'dc39e0c0-8016-4ca6-8a80-17e1950b6b6a';
  
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  yesterday.setHours(0,0,0,0);
  const todayEnd = new Date(yesterday.getTime() + 2 * 24 * 60 * 60 * 1000);

  const [user, sleep, activity, water, nutrition] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }),
    prisma.sleepLog.findMany({ where: { user_id: userId, date: { gte: yesterday, lt: todayEnd } } }),
    prisma.activityLog.findMany({ where: { user_id: userId, date: { gte: yesterday, lt: todayEnd } } }),
    prisma.hydrationLog.findMany({ where: { user_id: userId, date: { gte: yesterday, lt: todayEnd } } }),
    prisma.nutritionLog.findMany({ where: { user_id: userId, date: { gte: yesterday, lt: todayEnd } } }),
  ]);

  const tz = user?.timezone || "Europe/Moscow";
  const getLocalDate = (d) => d.toLocaleDateString('en-CA', { timeZone: tz });

  const allDates = [...sleep, ...activity, ...water].map(x => getLocalDate(x.date));
  allDates.sort();
  const latestDateStr = allDates[allDates.length - 1];

  const todayWater = water.filter(w => getLocalDate(w.date) === latestDateStr);
  console.log("Latest Date Str:", latestDateStr);
  console.log("Water Logs in latest day:", todayWater);
  console.log("Water total:", todayWater.reduce((sum, w) => sum + (w.amount_ml || 0), 0));
}

run().catch(e => console.error(e)).finally(() => prisma.$disconnect());
