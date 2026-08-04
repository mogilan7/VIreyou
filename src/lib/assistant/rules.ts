import { LifestyleContext } from "./context";
import { GUIDELINES } from "./guidelines";

export interface Findings {
  l1: Array<{ category: string; status: 'good' | 'improve' | 'no_data'; message: string }>;
  l2: Array<{ metric: string; status: 'trend_up' | 'trend_down' | 'trend_stable' | 'no_data'; message: string }>;
  l3: Array<{ marker: string; status: 'in_range' | 'out_of_range' | 'no_data'; message: string }>;
}

export function evaluateLifestyle(ctx: LifestyleContext): Findings {
  const f: Findings = { l1: [], l2: [], l3: [] };

  // --- LEVEL 1 (Behavioral) ---
  // Sleep
  if (ctx.l1.sleep.avgHours === null) {
    f.l1.push({ category: "sleep", status: "no_data", message: "Нет данных о сне за неделю." });
  } else if (ctx.l1.sleep.avgHours >= GUIDELINES.sleepHoursMin) {
    f.l1.push({ category: "sleep", status: "good", message: `Сон в норме (${ctx.l1.sleep.avgHours.toFixed(1)} ч).` });
  } else {
    f.l1.push({ category: "sleep", status: "improve", message: `Сон (${ctx.l1.sleep.avgHours.toFixed(1)} ч) ниже нормы (${GUIDELINES.sleepHoursMin} ч).` });
  }

  // Nutrition (Macros & Micros)
  if (ctx.l1.nutrition.avgProteinG) {
    const target = ctx.user.weightKg ? ctx.user.weightKg * GUIDELINES.proteinGPerKg : 60;
    if (ctx.l1.nutrition.avgProteinG >= target) {
      f.l1.push({ category: "protein", status: "good", message: "Белок в норме." });
    } else {
      f.l1.push({ category: "protein", status: "improve", message: "Белок ниже нормы." });
    }
  }
  
  if (ctx.l1.nutrition.iron) {
    if (ctx.l1.nutrition.iron < GUIDELINES.minerals.iron) {
      f.l1.push({ category: "iron", status: "improve", message: "Недостаток железа в рационе. Рекомендовать пищевые источники." });
    } else {
      f.l1.push({ category: "iron", status: "good", message: "Железо из еды в норме." });
    }
  }

  // Habits
  if (ctx.l1.habits.smoking) {
    f.l1.push({ category: "smoking", status: "improve", message: "Отмечено курение." });
  }
  if (ctx.l1.habits.alcohol) {
    f.l1.push({ category: "alcohol", status: "improve", message: "Отмечен алкоголь." });
  }

  // --- LEVEL 2 (Physiology/Wearables) ---
  if (ctx.l2.hrv.currentAvg && ctx.l2.hrv.baselineAvg) {
    const change = ((ctx.l2.hrv.currentAvg - ctx.l2.hrv.baselineAvg) / ctx.l2.hrv.baselineAvg) * 100;
    if (change <= -GUIDELINES.trendThresholds.hrvDropPercent) {
      f.l2.push({ metric: "hrv", status: "trend_down", message: `ВСР снижена на ${Math.abs(Math.round(change))}% относительно базового уровня.` });
    } else {
      f.l2.push({ metric: "hrv", status: "trend_stable", message: "ВСР стабильна." });
    }
  }

  if (ctx.l2.restingHr.currentAvg && ctx.l2.restingHr.baselineAvg) {
    const change = ((ctx.l2.restingHr.currentAvg - ctx.l2.restingHr.baselineAvg) / ctx.l2.restingHr.baselineAvg) * 100;
    if (change >= GUIDELINES.trendThresholds.restingHrRisePercent) {
      f.l2.push({ metric: "resting_hr", status: "trend_up", message: `Пульс покоя вырос на ${Math.abs(Math.round(change))}% относительно базового уровня.` });
    } else {
      f.l2.push({ metric: "resting_hr", status: "trend_stable", message: "Пульс покоя стабилен." });
    }
  }

  // --- LEVEL 3 (Clinical Biomarkers) ---
  if (ctx.l3.biomarkers.length > 0) {
    for (const b of ctx.l3.biomarkers) {
      if (b.status === 'out_of_range' || b.status === 'low' || b.status === 'high' || b.status === 'critical') {
        f.l3.push({ marker: b.key, status: 'out_of_range', message: `Биомаркер ${b.name} имеет статус ${b.status}. НИКАКИХ ДОЗИРОВОК И ДИАГНОЗОВ, только рекомендация обсудить с врачом.` });
      } else {
        f.l3.push({ marker: b.key, status: 'in_range', message: `Биомаркер ${b.name} в пределах нормы.` });
      }
    }
  } else {
    f.l3.push({ marker: "general", status: "no_data", message: "Нет загруженных анализов." });
  }

  return f;
}
