import { describe, it, expect } from 'vitest';
import { computeNextReviewUTC, isWithinQuietHours } from '../reviewScheduler';

describe('Beta Daily Review Scheduler', () => {
  it('schedules for today if preferred time has not passed yet', () => {
    // 12:00 UTC = 15:00 MSK
    const baseDate = new Date('2026-11-05T12:00:00Z');
    const nextUtc = computeNextReviewUTC('Europe/Moscow', '20:30', baseDate);

    // 20:30 MSK = 17:30 UTC on 2026-11-05
    expect(nextUtc.toISOString()).toBe('2026-11-05T17:30:00.000Z');
  });

  it('schedules for tomorrow if preferred time has already passed today', () => {
    // 18:00 UTC = 21:00 MSK (past 20:30 MSK)
    const baseDate = new Date('2026-11-05T18:00:00Z');
    const nextUtc = computeNextReviewUTC('Europe/Moscow', '20:30', baseDate);

    // 20:30 MSK tomorrow = 17:30 UTC on 2026-11-06
    expect(nextUtc.toISOString()).toBe('2026-11-06T17:30:00.000Z');
  });

  it('correctly detects quiet hours (22:00 to 08:00 local time)', () => {
    // 20:00 UTC = 23:00 MSK -> Quiet hours
    const night = new Date('2026-11-05T20:00:00Z');
    expect(isWithinQuietHours('Europe/Moscow', night)).toBe(true);

    // 04:00 UTC = 07:00 MSK -> Quiet hours
    const earlyMorning = new Date('2026-11-05T04:00:00Z');
    expect(isWithinQuietHours('Europe/Moscow', earlyMorning)).toBe(true);

    // 17:30 UTC = 20:30 MSK -> Active hours (not quiet)
    const eveningReviewTime = new Date('2026-11-05T17:30:00Z');
    expect(isWithinQuietHours('Europe/Moscow', eveningReviewTime)).toBe(false);

    // 11:00 UTC = 14:00 MSK -> Active hours
    const day = new Date('2026-11-05T11:00:00Z');
    expect(isWithinQuietHours('Europe/Moscow', day)).toBe(false);
  });
});

