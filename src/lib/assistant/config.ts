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
  FEATURE_ASSISTANT_BETA: true,
  FEATURE_DAILY_ACTION: false,
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

export const ASSISTANT_DOMAINS = [
  'sleep',
  'nutrition',
  'nutrition_protein',
  'movement_muscle',
  'stress_hrv',
  'glucose',
  'water',
  'circadian',
  'habits',
  'aging'
] as const;

export type AssistantDomain = typeof ASSISTANT_DOMAINS[number];

/**
 * Escapes characters for safe Telegram HTML parsing.
 */
export function escapeHtml(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats evidence levels in Russian or English.
 */
export function formatEvidenceLevel(level?: string | null, lang: 'ru' | 'en' = 'ru'): string {
  if (!level) return '';
  if (lang === 'en') {
    const map: Record<string, string> = {
      guideline: 'clinical guideline',
      meta_analysis: 'meta-analysis',
      studies: 'studies',
      hypothesis: 'hypothesis'
    };
    return map[level] || level;
  }
  const map: Record<string, string> = {
    guideline: 'клиническое руководство',
    meta_analysis: 'метаанализ',
    studies: 'исследования',
    hypothesis: 'гипотеза'
  };
  return map[level] || level;
}

/**
 * Renders HTML for the "Details" (Подробнее) callback button with safe escaping.
 */
export function renderCardDetailsHtml(cards: Array<{
  id: string;
  source_title?: string | null;
  source_url?: string | null;
  related_content?: string | null;
  evidence_level?: string | null;
}>, lang: 'ru' | 'en' = 'ru'): string {
  const header = lang === 'en'
    ? '<b>📚 Sources used from knowledge base:</b>\n'
    : '<b>📚 Использованные источники базы знаний:</b>\n';

  const lines = [header];
  cards.forEach((c, idx) => {
    const title = escapeHtml(c.source_title || c.id);
    const level = escapeHtml(formatEvidenceLevel(c.evidence_level, lang));
    lines.push(`${idx + 1}. <b>${title}</b> [${level}]`);
    if (c.source_url) {
      lines.push(`🔗 Источник: ${escapeHtml(c.source_url)}`);
    }
    if (c.related_content) {
      lines.push(`🎥 Материалы: ${escapeHtml(c.related_content)}`);
    }
    lines.push('');
  });

  return lines.join('\n').trim();
}

