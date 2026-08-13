import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
import prisma from "../src/lib/prisma";

async function run() {
  const userId = "dc39e0c0-8016-4ca6-8a80-17e1950b6b6a"; // mogilev.andrey@gmail.com
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  
  const [sleep, activity, hydration, nutrition] = await Promise.all([
    prisma.sleepLog.findMany({ where: { user_id: userId, date: { gte: since } }, orderBy: { date: 'desc' } }),
    prisma.activityLog.findMany({ where: { user_id: userId, date: { gte: since } }, orderBy: { date: 'desc' } }),
    prisma.hydrationLog.findMany({ where: { user_id: userId, date: { gte: since } }, orderBy: { date: 'desc' } }),
    prisma.nutritionLog.findMany({ where: { user_id: userId, date: { gte: since } }, orderBy: { date: 'desc' }, take: 5 }),
  ]);
  
  console.log(`\n=== Данные за 14 дней ===`);
  console.log(`Записей сна: ${sleep.length}`);
  console.log(`  С ВСР (hrv): ${sleep.filter(s => s.hrv && s.hrv > 0).length}`);
  console.log(`  С пульсом в покое: ${sleep.filter(s => s.resting_heart_rate && s.resting_heart_rate > 0).length}`);
  sleep.forEach(s => console.log(`  ${s.date.toISOString().split('T')[0]}: hrv=${s.hrv}, rhr=${s.resting_heart_rate}, dur=${(s as any).duration_hrs}`));
  
  console.log(`\nЗаписей активности: ${activity.length}`);
  activity.slice(0, 5).forEach(a => console.log(`  ${a.date.toISOString().split('T')[0]}: шаги=${a.steps}, активные мин=${a.active_minutes}`));
  
  console.log(`\nЗаписей гидратации: ${hydration.length}`);
  console.log(`Записей питания: ${nutrition.length}`);
}
run().finally(() => process.exit(0));
