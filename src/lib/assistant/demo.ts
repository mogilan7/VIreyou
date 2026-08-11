import { composeDailyCard, composeWeeklyReport, ComposerContext, WeeklyComposerContext, LLMGenerator } from './composer';
import { evaluateScheduler, SchedulerContext } from './scheduler';

// Mock LLM Generator for demo
const mockLLM: LLMGenerator = async (prompt, context) => {
  // Returns a safe string that passes validation
  return `Я замечаю, что ваш организм отлично адаптируется к нагрузкам.
  
Вчерашний совет по воде вы выполнили, отлично!

Сон сегодня составил 7 часов, это хорошая норма.

Проблемная зона: вечерняя активность была низкой.
Действие: постарайтесь прогуляться вечером хотя бы 15 минут.`;
};

async function runDemo() {
  const mode = process.argv[2] || 'card';

  if (mode === 'card') {
    console.log("=== DEMO: DAILY CARD ===");
    
    // Synthetic User 1 (Good coverage, 2 insights)
    const dailyContext: ComposerContext = {
      date: '2026-08-06',
      level_by_domain: { sleep: 2, activity: 2, water: 1, habits: 1, food: 0 },
      baselines: {
        sleep_duration: { median: 431, points: 14, unit: 'min' },
        steps: { median: 7100, points: 14 }
      },
      today: { sleep_duration: 372, steps: 4200, water_ml: 900 },
      deviations: [
        { domain: 'sleep', type: 'spike', magnitude_sd: 1.8, direction: 'down' }
      ],
      yesterday_advice: { id: 'adv_1183', target_metric: 'sleep_duration', verifiable: true },
      engagement: { food: 'decaying', water: 'stable', days_since_last_nudge: 4 },
      empty_streak: 0,
      sync: { sleep_synced: true, waited_until: '2026-08-06T10:00:00+03:00', rebuild_pending: false },
      subjective: { sleep_quality: null, source: 'user_reported' },
      safety_flags: []
    };

    const card = await composeDailyCard(dailyContext, mockLLM);
    console.log(card);
    
    // Test scheduler fading (User 2)
    console.log("\n=== DEMO: SCHEDULER FADING (User 2) ===");
    const currentUTC = new Date('2026-08-06T11:00:00Z');
    const ctx: SchedulerContext = {
      hasAnyDomain: false,
      hasYesterdayAdvice: false,
      historyDaysCount: 30,
      hasGoalOrPattern: false,
      isNewUser: false,
      consecutiveEmptyDays: 5,
      lastPingDaysAgo: 2,
      userWakeTimeStr: "07:00",
      userTimezoneOffsetMinutes: 0
    };
    
    const sched = evaluateScheduler(currentUTC, null, ctx);
    console.log("Scheduler decision for fading user:", sched);
  } else if (mode === 'report') {
    console.log("=== DEMO: WEEKLY REPORT ===");
    const weeklyContext: WeeklyComposerContext = {
      week_start: '2026-07-30',
      week_end: '2026-08-05',
      baselines: {},
      insights: [],
      cross_domain_links: [
        {
          link: 'late_dinner_sleep',
          confidence: 1,
          occurrences: 5,
          experimentIdea: 'Предлагаю сдвинуть ужин на 2 часа раньше обычного и понаблюдать за пульсом во сне.'
        }
      ],
      compliance: {}
    };

    const report = await composeWeeklyReport(weeklyContext, mockLLM);
    console.log(report);
  }
}

runDemo().catch(console.error);
