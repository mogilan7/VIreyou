import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
import prisma from "../src/lib/prisma";
import { getLocalDate, getLocalDayRangeUTC } from "../src/lib/assistant/ingest";

const BASELINE_WINDOW = 14;
const MIN_BASELINE_POINTS = 3;

async function run() {
  const userId = "dc39e0c0-8016-4ca6-8a80-17e1950b6b6a";
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const tz = user?.timezone || "Europe/Moscow";
  
  const now = new Date();
  const windowAgo = new Date(now.getTime() - BASELINE_WINDOW * 24 * 60 * 60 * 1000);
  const windowAgoStr = getLocalDate(windowAgo, tz);
  const { start: windowStart } = getLocalDayRangeUTC(windowAgoStr, tz);
  
  console.log(`Timezone: ${tz}`);
  console.log(`Now (UTC): ${now.toISOString()}`);
  console.log(`Window start (local): ${windowAgoStr}`);
  console.log(`Window start (UTC): ${windowStart.toISOString()}`);
  
  const sleep = await prisma.sleepLog.findMany({ 
    where: { user_id: userId, date: { gte: windowStart } },
    orderBy: { date: 'desc' }
  });
  
  console.log(`\nRecords fetched from DB: ${sleep.length}`);
  sleep.forEach(s => {
    const localDate = getLocalDate(s.date, tz);
    console.log(`  DB date: ${s.date.toISOString()} → local: ${localDate}, hrv=${s.hrv}, rhr=${s.resting_heart_rate}`);
  });
  
  const hrvDays = new Set(sleep.filter(s => s.hrv && s.hrv > 0).map(s => getLocalDate(s.date, tz)));
  const rhrDays = new Set(sleep.filter(s => s.resting_heart_rate && s.resting_heart_rate > 0).map(s => getLocalDate(s.date, tz)));
  
  console.log(`\nUnique HRV days: ${hrvDays.size} (need ${MIN_BASELINE_POINTS}):`, [...hrvDays]);
  console.log(`Unique RHR days: ${rhrDays.size} (need ${MIN_BASELINE_POINTS}):`, [...rhrDays]);
  console.log(`\nHRV sufficient: ${hrvDays.size >= MIN_BASELINE_POINTS}`);
  console.log(`RHR sufficient: ${rhrDays.size >= MIN_BASELINE_POINTS}`);
  console.log(`HRV needs: ${Math.max(0, MIN_BASELINE_POINTS - hrvDays.size)} more days`);
}
run().finally(() => process.exit(0));
