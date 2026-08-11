export interface SchedulerContext {
  hasAnyDomain: boolean;
  hasYesterdayAdvice: boolean;
  historyDaysCount: number;
  hasGoalOrPattern: boolean;
  isNewUser: boolean;
  consecutiveEmptyDays: number;
  lastPingDaysAgo: number;
  userWakeTimeStr?: string; // e.g. "07:00"
  userTimezoneOffsetMinutes?: number; // e.g. +180 for MSK
}

export interface NudgeDecision {
  shouldNudge: boolean;
  nudgeLevel: 1 | 2 | 3 | 4 | 5 | 6; 
  reason: string;
}

export function evaluateScheduler(
  currentDateUTC: Date,
  lastDataDateUTC: Date | null,
  context: SchedulerContext
): NudgeDecision {
  // 1. SYNC GRACE: wait 3 hours after usual wake time
  // Default wake time 07:00 local time
  const wakeStr = context.userWakeTimeStr || "07:00";
  const [wakeHour, wakeMin] = wakeStr.split(':').map(Number);
  const tzOffset = context.userTimezoneOffsetMinutes || 0; // Default UTC

  // Create a local date representation of the current UTC date
  const localCurrentDate = new Date(currentDateUTC.getTime() + tzOffset * 60000);
  const syncGraceHourLocal = wakeHour + 3; 

  const isGracePeriod = localCurrentDate.getUTCHours() < syncGraceHourLocal; // Note: localCurrentDate is shifted, so getUTCHours returns the local hour

  // Wait if we are still in grace period and have no data today
  if (!context.hasAnyDomain && isGracePeriod) {
    return { shouldNudge: false, nudgeLevel: 1, reason: 'sync_grace' };
  }

  // 2. Sparsity / Backoff logic for consecutive empty days
  if (!context.hasAnyDomain) {
    if (context.consecutiveEmptyDays >= 5 && context.lastPingDaysAgo < 7) {
      return { shouldNudge: false, nudgeLevel: 1, reason: 'sparsity_weekly' };
    } else if (context.consecutiveEmptyDays >= 2 && context.consecutiveEmptyDays < 5 && context.lastPingDaysAgo < 2) {
      return { shouldNudge: false, nudgeLevel: 1, reason: 'sparsity_every_other_day' };
    }
  }

  // 3. Degradation Ladder
  if (context.hasAnyDomain) {
    return { shouldNudge: true, nudgeLevel: 1, reason: 'normal_card' };
  }
  
  if (context.hasYesterdayAdvice) {
    return { shouldNudge: true, nudgeLevel: 2, reason: 'qualitative_check' };
  }
  
  if (context.historyDaysCount >= 7) {
    return { shouldNudge: true, nudgeLevel: 3, reason: 'retrospective' };
  }
  
  // Wait, if it reaches here, it would trigger step 4. 
  // However, step 4 says "always". So it stops here unless it's a completely new user.
  // Actually, step 4 is "Subjective input (how did you sleep)". 
  // Let's check step 6: "New user, no history".
  if (context.isNewUser && context.historyDaysCount === 0) {
    return { shouldNudge: true, nudgeLevel: 6, reason: 'micro_request' };
  }
  
  // Since step 4 is "always", we return it. Step 5 is reached if we want to alternate or if step 4 is somehow inapplicable? 
  // The spec says "Идти строго сверху вниз, останавливаться на первой доступной ступени: 4. всегда".
  // If 4 is always, then 5 and 6 are never reached unless 4 is skipped.
  // Wait, the spec says "4. всегда -> предложение восстановить ночь субъективно".
  // "5. есть заявленная цель или известный паттерн".
  // Maybe "always" means it's available, but we can randomly pick between 4 and 5? 
  // For now, let's implement 4 if applicable, but we'll prioritize 4.
  return { shouldNudge: true, nudgeLevel: 4, reason: 'subjective_input' };
}
