export const CONFIG = {
  // Validity & Baseline
  MIN_EI_BMR_RATIO: 0.6,
  MIN_KCAL_FALLBACK: 800,
  MIN_MEALS_PER_DAY: 2,
  MAX_KCAL_PER_DAY: 6000,
  WINDOW_DAYS: 14,
  THRESHOLD_MACRO: 4,
  THRESHOLD_MINERALS: 7,
  THRESHOLD_MICRO: 10,
  REQUIRE_WEEKEND_DAY: true,
  
  // Daily Review & Insights
  BASELINE_WINDOW: 14,
  MIN_BASELINE_POINTS: 3,
  REPEAT_THRESHOLD: 3,
  SPIKE_SD: 1.5,
  MIN_PAIRS: 5,
  INSIGHT_COOLDOWN: 3,
  
  // Engagement & Schedule
  ONBOARD_GRACE: 5,
  RECOVERY_STREAK: 3,
  NUDGE_COOLDOWN: 3,
  SYNC_GRACE_HOURS: 3,
  MAX_REPORT_ITEMS: 5,

  // Feature Flags
  FEATURE_ASSISTANT_BETA: false,
};

export const CRISIS_CONTACTS = {
  ru: {
    emergency: '112 / 103',
    crisisPhone: '8-800-333-44-34',
    crisisDescription: 'Бесплатная кризисная линия доверия по России: 8-800-333-44-34'
  },
  en: {
    emergency: '112 or your local emergency number',
    crisisPhone: '988 / 111',
    crisisDescription: 'Crisis helplines: call/text 988 (US/Canada), 111 (UK), or visit findahelpline.com'
  }
};
