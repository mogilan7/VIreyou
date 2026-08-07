// src/lib/assistant/config.ts

/** 
 * Module A (Daily Review) - thresholds 
 */
export const BASELINE_WINDOW = 14;     // days
export const MIN_BASELINE_POINTS = 3;  // days
export const SYNC_GRACE = 3;           // hours after wakeup
export const INSIGHT_COOLDOWN = 3;     // days
export const REPEAT_THRESHOLD = 3;     // times within baseline window
export const SPIKE_SD = 1.5;           // standard deviations
export const MIN_PAIRS = 5;            // minimum pairs for insight
export const ONBOARD_GRACE = 5;        // days
export const RECOVERY_STREAK = 3;      // days
export const NUDGE_COOLDOWN = 3;       // days

/**
 * Module B (Nutrient Assessment) - thresholds
 */
export const MIN_EI_BMR_RATIO = 0.6;   // 0.6 * BMR
export const MIN_KCAL_FALLBACK = 800;  // kcal
export const MIN_MEALS_PER_DAY = 2;    // meals
export const MAX_KCAL_PER_DAY = 6000;  // kcal

export const GATING = {
  MACROS: 4,                           // days (Calories, Protein, Fat, Carbs)
  FIBER_MINERALS: 7,                   // days (Fiber, Na, Ca, Mg)
  MICROS_VITAMINS: 10,                 // days (Iron, Zinc, A, D, B12, Iodine, Omega-3)
};

export const WEEKDAY_SKEW_THRESHOLD = 0.2; // Group < 20% of sample
export const STALENESS_DAYS = 5;           // Last valid day > 5 days ago
