import prisma from "../../lib/prisma";

export function getLocalDate(date: Date, timezone: string = "Europe/Moscow"): string {
  if (!date || isNaN(date.getTime())) {
    // fallback: return today's UTC date
    return new Date().toISOString().split('T')[0];
  }
  return date.toLocaleDateString('en-CA', { timeZone: timezone });
}

export function getLocalDayRangeUTC(dateStr: string, timezone: string = "Europe/Moscow"): { start: Date, end: Date } {
  // Validate dateStr format YYYY-MM-DD
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    dateStr = todayStr;
  }

  const [year, month, day] = dateStr.split('-').map(Number);

  // Find the UTC offset for this timezone on this day by using Intl
  // We'll binary-search or just use a known-good reference point:
  // Create a date that represents noon UTC on this date, then check what local time it is.
  // The UTC midnight = noon_utc - localHour*3600000 - localMinute*60000
  const noonUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(noonUTC);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
  const localHour = get('hour');
  const localMinute = get('minute');
  const localSecond = get('second');

  // At noonUTC, local clock shows localHour:localMinute:localSecond.
  // Local midnight = noonUTC - that many milliseconds.
  const start = new Date(noonUTC.getTime() - (localHour * 3600000 + localMinute * 60000 + localSecond * 1000));
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
