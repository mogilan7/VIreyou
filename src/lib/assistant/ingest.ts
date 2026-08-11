import prisma from "../../lib/prisma";

export function getLocalDate(date: Date, timezone: string = "Europe/Moscow"): string {
  return date.toLocaleDateString('en-CA', { timeZone: timezone });
}

export function getLocalDayRangeUTC(dateStr: string, timezone: string = "Europe/Moscow"): { start: Date, end: Date } {
  // Try to create a Date in that timezone. The easiest way without external libs is tricky, 
  // but we can parse it roughly or just assume ISO parsing.
  // Actually, to get exactly 00:00:00 local time in UTC:
  // We can construct a string that JS native parses if we have the offset, or use Intl.
  
  // A hacky but reliable way in modern Node to get offset:
  const dt = new Date(`${dateStr}T12:00:00Z`); // midday UTC
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'shortOffset', hour12: false });
  const parts = dtf.formatToParts(dt);
  const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT'; // e.g. GMT+3
  
  let offset = tzPart.replace('GMT', ''); // e.g. +3, -4
  if (offset === '') {
    offset = 'Z';
  } else {
    // some systems return +03:00, some +3. If it's single digit, fix it
    if (/^[+-]\d$/.test(offset)) {
      offset = offset[0] + '0' + offset[1] + ':00';
    } else if (/^[+-]\d{2}$/.test(offset)) {
      offset = offset + ':00';
    }
  }

  const start = new Date(`${dateStr}T00:00:00${offset}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { start, end };
}

export async function fetchUserLogs(userId: string, since: Date, to: Date) {
  const [user, sleep, activity, hydration, nutrition, habits] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.sleepLog.findMany({ where: { user_id: userId, date: { gte: since, lt: to } }, orderBy: { date: 'asc' } }),
    prisma.activityLog.findMany({ where: { user_id: userId, date: { gte: since, lt: to } }, orderBy: { date: 'asc' } }),
    prisma.hydrationLog.findMany({ where: { user_id: userId, date: { gte: since, lt: to } }, orderBy: { date: 'asc' } }),
    prisma.nutritionLog.findMany({ where: { user_id: userId, date: { gte: since, lt: to } }, orderBy: { date: 'asc' } }),
    prisma.habitLog.findMany({ where: { user_id: userId, date: { gte: since, lt: to } }, orderBy: { date: 'asc' } })
  ]);
  return { user, sleep, activity, hydration, nutrition, habits };
}
