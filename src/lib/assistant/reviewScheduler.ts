/**
 * Calculates the next UTC Date for a user's evening review.
 * Respects user's preferred review_time (default "20:30") and local timezone.
 * Ensures the scheduled time is strictly in the future.
 */
export function computeNextReviewUTC(
  timezone: string = 'Europe/Moscow',
  reviewTimeStr: string = '20:30',
  baseDate: Date = new Date()
): Date {
  const [hour, minute] = (reviewTimeStr || '20:30').split(':').map(Number);
  const targetHour = isNaN(hour) ? 20 : hour;
  const targetMinute = isNaN(minute) ? 30 : minute;

  // Get current date string components in the user's timezone
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = dtf.formatToParts(baseDate);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';

  const year = parseInt(getPart('year'), 10);
  const month = parseInt(getPart('month'), 10) - 1; // 0-indexed
  const day = parseInt(getPart('day'), 10);
  const curHour = parseInt(getPart('hour'), 10);
  const curMin = parseInt(getPart('minute'), 10);

  // Check if today's review time has already passed in user's timezone
  const isPastToday = curHour > targetHour || (curHour === targetHour && curMin >= targetMinute);
  const dayOffset = isPastToday ? 1 : 0;

  // Target wall-clock date in user timezone
  const targetYear = year;
  const targetMonth = month;
  const targetDay = day + dayOffset;

  // Initial UTC guess: assume target is UTC
  let guessUtcMs = Date.UTC(targetYear, targetMonth, targetDay, targetHour, targetMinute, 0);

  // Measure what wall-clock time this guess produces in target timezone
  for (let iter = 0; iter < 3; iter++) {
    const guessDate = new Date(guessUtcMs);
    const gParts = dtf.formatToParts(guessDate);
    const gYear = parseInt(gParts.find(p => p.type === 'year')?.value || '0', 10);
    const gMonth = parseInt(gParts.find(p => p.type === 'month')?.value || '0', 10) - 1;
    const gDay = parseInt(gParts.find(p => p.type === 'day')?.value || '0', 10);
    const gHour = parseInt(gParts.find(p => p.type === 'hour')?.value || '0', 10);
    const gMin = parseInt(gParts.find(p => p.type === 'minute')?.value || '0', 10);

    // Wall clock minute difference between target and current guess
    const targetWallMin = (Date.UTC(targetYear, targetMonth, targetDay, targetHour, targetMinute, 0)) / 60000;
    const currentWallMin = (Date.UTC(gYear, gMonth, gDay, gHour, gMin, 0)) / 60000;
    const diffMin = targetWallMin - currentWallMin;

    if (diffMin === 0) break;
    guessUtcMs += diffMin * 60000;
  }

  return new Date(guessUtcMs);
}

/**
 * Checks if a given time in user's timezone falls within Quiet Hours (22:00 - 08:00).
 */
export function isWithinQuietHours(timezone: string = 'Europe/Moscow', date: Date = new Date()): boolean {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false
    });
    const hour = parseInt(dtf.format(date), 10);
    return hour >= 22 || hour < 8;
  } catch {
    const utcHour = date.getUTCHours();
    return utcHour >= 19 || utcHour < 5; // fallback
  }
}
