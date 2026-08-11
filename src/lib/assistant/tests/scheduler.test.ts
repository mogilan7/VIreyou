import { describe, it, expect } from 'vitest';
import { evaluateScheduler, SchedulerContext } from '../scheduler';

describe('Scheduler & Degradation Ladder Tests', () => {
  const defaultContext: SchedulerContext = {
    hasAnyDomain: false,
    hasYesterdayAdvice: false,
    historyDaysCount: 0,
    hasGoalOrPattern: false,
    isNewUser: false,
    consecutiveEmptyDays: 0,
    lastPingDaysAgo: 1,
    userWakeTimeStr: "07:00",
    userTimezoneOffsetMinutes: 0 // UTC
  };

  it('should wait silently during grace period (before 10 AM UTC)', () => {
    const current = new Date('2026-08-02T08:00:00Z'); // 08:00 UTC < 10:00 UTC grace period (07:00 + 3h)
    const result = evaluateScheduler(current, null, defaultContext);
    expect(result.shouldNudge).toBe(false);
    expect(result.reason).toBe('sync_grace');
  });

  it('should nudge normally if has domains (Step 1)', () => {
    const current = new Date('2026-08-02T11:00:00Z'); // Past grace period
    const ctx = { ...defaultContext, hasAnyDomain: true };
    const result = evaluateScheduler(current, null, ctx);
    expect(result.shouldNudge).toBe(true);
    expect(result.nudgeLevel).toBe(1);
    expect(result.reason).toBe('normal_card');
  });

  it('should check yesterday advice if no domains (Step 2)', () => {
    const current = new Date('2026-08-02T11:00:00Z');
    const ctx = { ...defaultContext, hasYesterdayAdvice: true };
    const result = evaluateScheduler(current, null, ctx);
    expect(result.shouldNudge).toBe(true);
    expect(result.nudgeLevel).toBe(2);
    expect(result.reason).toBe('qualitative_check');
  });

  it('should do retrospective if history >= 7 (Step 3)', () => {
    const current = new Date('2026-08-02T11:00:00Z');
    const ctx = { ...defaultContext, historyDaysCount: 7 };
    const result = evaluateScheduler(current, null, ctx);
    expect(result.shouldNudge).toBe(true);
    expect(result.nudgeLevel).toBe(3);
    expect(result.reason).toBe('retrospective');
  });

  it('should do micro request if new user (Step 6)', () => {
    const current = new Date('2026-08-02T11:00:00Z');
    const ctx = { ...defaultContext, isNewUser: true, historyDaysCount: 0 };
    const result = evaluateScheduler(current, null, ctx);
    expect(result.shouldNudge).toBe(true);
    expect(result.nudgeLevel).toBe(6);
    expect(result.reason).toBe('micro_request');
  });

  it('should reduce frequency (every other day) if 2 empty days', () => {
    const current = new Date('2026-08-02T11:00:00Z');
    const ctx = { ...defaultContext, consecutiveEmptyDays: 2, lastPingDaysAgo: 1 };
    const result = evaluateScheduler(current, null, ctx);
    expect(result.shouldNudge).toBe(false);
    expect(result.reason).toBe('sparsity_every_other_day');
  });

  it('should reduce frequency (weekly) if 5 empty days', () => {
    const current = new Date('2026-08-02T11:00:00Z');
    const ctx = { ...defaultContext, consecutiveEmptyDays: 5, lastPingDaysAgo: 3 };
    const result = evaluateScheduler(current, null, ctx);
    expect(result.shouldNudge).toBe(false);
    expect(result.reason).toBe('sparsity_weekly');
  });
});
