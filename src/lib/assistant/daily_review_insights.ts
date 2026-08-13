import prisma from "../prisma";
import { getLocalDate, getLocalDayRangeUTC } from "./ingest";
import { getAdviceForToday } from "./advice";

const CONFIG = {
  BASELINE_WINDOW: 14,
  SPIKE_SD: 1.5,
  MIN_BASELINE_POINTS: 4,
  TOPIC_COOLDOWN: 3,
  LATE_MEAL_HOURS: 3,
  REPEAT_THRESHOLD: 3
};


function formatMinutes(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h > 0) return `${h} ч ${m} мин`;
    return `${m} мин`;
}

function calculateMedian(arr: number[]): number {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculateSD(arr: number[], mean: number): number {
  if (!arr || arr.length < 2) return 0;
  const variance = arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

export async function buildInsightsContract(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const tz = user?.timezone || "Europe/Moscow";
  const now = new Date();
  
  // Calculate window
  const todayStr = getLocalDate(now, tz);
  const windowEnd = getLocalDayRangeUTC(todayStr, tz).end;
  const windowStart = new Date(windowEnd.getTime() - 15 * 24 * 60 * 60 * 1000); // 15 days just to be safe
  
  // 1. Fetch all data
  const [sleepLogs, activityLogs, waterLogs, nutritionLogs, habitLogs, adviceLogs, topicMentions] = await Promise.all([
    prisma.sleepLog.findMany({ where: { user_id: userId, date: { gte: windowStart, lt: windowEnd } } }),
    prisma.activityLog.findMany({ where: { user_id: userId, date: { gte: windowStart, lt: windowEnd } } }),
    prisma.hydrationLog.findMany({ where: { user_id: userId, date: { gte: windowStart, lt: windowEnd } } }),
    prisma.nutritionLog.findMany({ where: { user_id: userId, date: { gte: windowStart, lt: windowEnd } } }),
    prisma.habitLog.findMany({ where: { user_id: userId, date: { gte: windowStart, lt: windowEnd } } }),
    prisma.adviceLog.findMany({ where: { userId, date: { gte: windowStart } }, orderBy: { date: 'desc' } }),
    prisma.topicMention.findMany({ where: { user_id: userId, mentioned_at: { gte: windowStart } }, orderBy: { mentioned_at: 'desc' } })
  ]);
  
  // 2. Aggregate by day
  const daily: Record<string, any> = {};
  const addDaily = (date: Date, key: string, val: any) => {
      const d = getLocalDate(date, tz);
      if (!daily[d]) daily[d] = { date: d, is_weekend: [0,6].includes(date.getDay()) };
      daily[d][key] = val;
  };
  
  sleepLogs.forEach(l => {
      if (l.duration_hrs) addDaily(l.date, 'sleep_duration', l.duration_hrs * 60); // in minutes
      if (l.hrv) addDaily(l.date, 'hrv', l.hrv);
      if (l.resting_heart_rate) addDaily(l.date, 'rhr', l.resting_heart_rate);
      if (l.start_time) addDaily(l.date, 'sleep_start_time', l.start_time.getTime());
  });
  
  activityLogs.forEach(l => {
      if (l.steps) addDaily(l.date, 'steps', l.steps);
  });
  
  // Aggregate water
  waterLogs.forEach(l => {
      const d = getLocalDate(l.date, tz);
      if (!daily[d]) daily[d] = { date: d };
      daily[d].water = (daily[d].water || 0) + l.volume_ml;
  });
  
  // Group nutrition by date to find max eaten_at
  const nutritionByDate: Record<string, any[]> = {};
  nutritionLogs.forEach(l => {
      const d = getLocalDate(l.date, tz);
      if (!nutritionByDate[d]) nutritionByDate[d] = [];
      nutritionByDate[d].push(l);
  });

  Object.keys(nutritionByDate).forEach(d => {
      const logs = nutritionByDate[d];
      let maxEatenAt = 0;
      logs.forEach(l => {
         const t = l.eaten_at ? l.eaten_at.getTime() : l.created_at.getTime();
         if (t > maxEatenAt) maxEatenAt = t;
      });
      if (!daily[d]) daily[d] = { date: d, is_weekend: false };
      daily[d].max_eaten_at = maxEatenAt;
  });
  
  const todayData = daily[todayStr] || {};
  const yesterdayStr = getLocalDate(new Date(now.getTime() - 24 * 60 * 60 * 1000), tz);
  const targetDay = todayData.sleep_duration ? todayStr : yesterdayStr; 
  
  const getValues = (metric: string) => Object.values(daily).map(d => d[metric]).filter(v => v !== undefined && v !== null);
  
  // 3. Baselines & Targets
  const metrics = ['sleep_duration', 'hrv', 'steps', 'water'];
  const baselines: Record<string, { median: number, sd: number }> = {};
  metrics.forEach(m => {
      const vals = getValues(m);
      if (vals.length < CONFIG.MIN_BASELINE_POINTS) return;
      const median = calculateMedian(vals);
      const mean = vals.reduce((a,b)=>a+b, 0) / (vals.length || 1);
      const sd = calculateSD(vals, mean) || (median * 0.1);
      baselines[m] = { median, sd };
  });
  
  // 4. Calculate Deviations for targetDay
  const deviations: any[] = [];
  const targetData = daily[targetDay] || {};
  
  const checkDev = (metric: string, val: number, isGoodUp: boolean) => {
      const b = baselines[metric];
      if (!b || b.median === 0) return;
      const diff = val - b.median;
      const mag = Math.abs(diff) / b.sd;
      
      // calculate streak first to check if it passes filter
      let dir = diff > 0 ? 'up' : 'down';
      let streak = 0;
      let sortedDays = Object.keys(daily).sort().reverse();
      let idx = sortedDays.indexOf(targetDay);
      if (idx !== -1) {
          for (let i = idx; i < sortedDays.length; i++) {
              const dVal = daily[sortedDays[i]][metric];
              if (dVal !== undefined) {
                  const dDiff = dVal - b.median;
                  if ((dir === 'up' && dDiff > b.sd*0.5) || (dir === 'down' && dDiff < -b.sd*0.5)) {
                      streak++;
                  } else {
                      break;
                  }
              }
          }
      }
      if (mag > CONFIG.SPIKE_SD || streak >= CONFIG.REPEAT_THRESHOLD || (Math.abs(diff) / b.median) >= 0.1) {
          
          deviations.push({
              metric,
              value: val,
              baseline: Math.round(b.median),
              magnitude_sd: Number(mag.toFixed(1)),
              direction: dir,
              streak: streak,
              streak_direction: streak > 1 ? "worsening" : "stable",
              same_weekday_pattern: false,
              rank_in_window: 1, // mock
              ...(metric === 'sleep_duration' && { value_formatted: formatMinutes(val), baseline_formatted: formatMinutes(b.median) })
          });
      }
  };
  
  if (targetData.sleep_duration) checkDev('sleep_duration', targetData.sleep_duration, true);
  if (targetData.hrv) checkDev('hrv', targetData.hrv, true);
  if (targetData.steps) checkDev('steps', targetData.steps, true);
  
  // 5. Domain States
  const domain_states: Record<string, any> = {};
  metrics.forEach(m => {
      const sortedDays = Object.keys(daily).sort();
      const recent = sortedDays.slice(-7).map(d => daily[d][m]).filter(x => x !== undefined);
      const prev = sortedDays.slice(-14, -7).map(d => daily[d][m]).filter(x => x !== undefined);
      
      let status = "normal";
      let trend = "stable";
      if (recent.length && baselines[m]) {
          const recMed = calculateMedian(recent);
          const bMed = baselines[m].median;
          if (recMed > bMed * 1.05) trend = "improving";
          else if (recMed < bMed * 0.95) trend = "worsening";
      }
      
      if (deviations.some(d => d.metric.includes(m.split('_')[0]))) {
          status = "deviating";
      }
      
      let val = Math.round(targetData[m] || 0);
      let bVal = baselines[m]?.median || 0;
      let formattedVal = m === 'sleep_duration' ? formatMinutes(val) : undefined;
      let formattedBaseline = m === 'sleep_duration' ? formatMinutes(bVal) : undefined;

      const vals = getValues(m);
      domain_states[m.split('_')[0]] = { 
          status, 
          trend_7d: trend,
          value: val,
          baseline: Math.round(bVal),
          points: vals.length,
          ...(formattedVal && { value_formatted: formattedVal }),
          ...(formattedBaseline && { baseline_formatted: formattedBaseline })
      };
  });
  
  // 6. Explanation Candidates (Late Meal)
  const explanation_candidates: any[] = [];
  
  // Late meal logic
  let lateMealOccurred = false;
  if (targetData.max_eaten_at && targetData.sleep_start_time) {
     const diffHrs = (targetData.sleep_start_time - targetData.max_eaten_at) / (1000 * 3600);
     if (diffHrs > 0 && diffHrs < CONFIG.LATE_MEAL_HOURS) {
         lateMealOccurred = true;
     }
  }

  // Calculate pairs observed for late meal & poor sleep
  let pairsObserved = 0;
  let sleepDrops = 0;
  Object.keys(daily).forEach(d => {
      const dd = daily[d];
      if (dd.max_eaten_at && dd.sleep_start_time) {
          const diffHrs = (dd.sleep_start_time - dd.max_eaten_at) / (1000 * 3600);
          if (diffHrs > 0 && diffHrs < CONFIG.LATE_MEAL_HOURS) {
              pairsObserved++;
              if (dd.sleep_duration && baselines['sleep_duration'] && dd.sleep_duration < baselines['sleep_duration'].median - baselines['sleep_duration'].sd) {
                  sleepDrops++;
              }
          }
      }
  });

  if (deviations.some(d => d.metric === 'sleep_duration' && d.direction === 'down')) {
      explanation_candidates.push({
          factor: "late_meal",
          occurred: lateMealOccurred,
          pairs_observed: pairsObserved,
          consistent: pairsObserved > 0 ? (sleepDrops / pairsObserved >= 0.5) : null
      });
  }
  
  // 7. Topic History
  const topic_history: Record<string, any> = {};
  
  // Group mentions by topic
  const mentionsByTopic: Record<string, any[]> = {};
  topicMentions.forEach(m => {
      const baseTopic = m.topic_key.split('_')[0];
      if (!mentionsByTopic[baseTopic]) mentionsByTopic[baseTopic] = [];
      mentionsByTopic[baseTopic].push(m);
  });

  Object.keys(mentionsByTopic).forEach(topic => {
      const mentions = mentionsByTopic[topic];
      const last = mentions[0];
      const daysAgo = Math.floor((now.getTime() - last.mentioned_at.getTime()) / (1000 * 3600 * 24));
      
      let adviceFollowed = false;
      if (last.advice_id) {
          // If advice was given, find it
          const adv = adviceLogs.find(a => a.id === last.advice_id);
          if (adv) {
              // Check if user met target today? Since we don't have exact target checking logic here yet, default to false.
              // In full implementation, we'd check if targetData[topic] >= adv.target_value etc.
          }
      }

      topic_history[topic] = {
          mentioned_days_ago: daysAgo,
          times_in_window: mentions.length,
          advice_given: !!last.advice_id,
          advice_followed: adviceFollowed
      };
  });

  const suppressed: any[] = [];
  // Suppress topics that were mentioned within cooldown, unless streak is worsening
  const finalDeviations = deviations.filter(d => {
      const baseTopic = d.metric.split('_')[0];
      const th = topic_history[baseTopic];
      if (th && th.mentioned_days_ago < CONFIG.TOPIC_COOLDOWN) {
          const relDiff = Math.abs(d.value - d.baseline) / (d.baseline || 1);
          const isSpike = d.magnitude_sd >= CONFIG.SPIKE_SD || relDiff >= 0.15;
          if (d.streak_direction !== 'worsening' && !isSpike) {
              suppressed.push({ reason: "cooldown", topic: d.metric });
              return false;
          }
      }
      return true;
  });
  
  let praise = null;
  let problem = null;
  const down = finalDeviations.find(d => d.direction === 'down');
  const PRAISE_MIN_SD = 1.0;
  const up = finalDeviations.find(d => d.direction === 'up' && (d.magnitude_sd >= PRAISE_MIN_SD || d.streak >= 3));
  
  if (up) {
      praise = up;
  } else {
      // Find normal domain if no explicit upward deviation
      const candidateDomains = Object.keys(domain_states).filter(k => {
          if (domain_states[k].status !== 'normal') return false;
          const metricKey = metrics.find(m => m.startsWith(k)) || k;
          const val = targetData[metricKey] || 0;
          const bVal = baselines[metricKey]?.median || 0;
          return val >= bVal * 0.95;
      });
      
      candidateDomains.sort((a, b) => {
          if (domain_states[a].trend_7d === 'improving' && domain_states[b].trend_7d !== 'improving') return -1;
          if (domain_states[b].trend_7d === 'improving' && domain_states[a].trend_7d !== 'improving') return 1;
          return 0;
      });

      if (candidateDomains.length > 0) {
          const dom = candidateDomains[0];
          const metricKey = metrics.find(m => m.startsWith(dom)) || dom;
          let val = Math.round(targetData[metricKey] || 0);
          let bVal = baselines[metricKey]?.median || 0;
          let formattedVal = metricKey === 'sleep_duration' ? formatMinutes(val) : undefined;
          let formattedBaseline = metricKey === 'sleep_duration' ? formatMinutes(bVal) : undefined;
          
          praise = { 
              metric: dom, 
              value: Math.round(val), 
              baseline: Math.round(bVal),
              reason: 'maintenance',
              ...(formattedVal && { value_formatted: formattedVal }),
              ...(formattedBaseline && { baseline_formatted: formattedBaseline })
          };
      }
  }
  if (down) problem = down;

  const adviceObj = await getAdviceForToday(userId, finalDeviations, domain_states, targetData, baselines);
  const advice = adviceObj ? { text_seed: adviceObj.content, target_metric: adviceObj.target_metric } : null;

  const contract = {
      deviations: finalDeviations,
      advice,
      domain_states,
      explanation_candidates,
      topic_history,
      suppressed,
      praise,
      problem,
      yesterday_advice: adviceLogs.length > 0 ? { target_metric: adviceLogs[0].target_metric, result: "met" } : null
  };

  contract.explanation_candidates = contract.explanation_candidates.filter((c: any) => c.pairs_observed > 0);

  return contract;
}
