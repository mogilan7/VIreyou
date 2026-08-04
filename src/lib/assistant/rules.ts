import { GUIDELINES as G } from "./guidelines";
import type { LifestyleContext } from "./context";

export type Finding = {
  area: "sleep" | "activity" | "hydration" | "protein" | "fiber" | "sugar";
  status: "good" | "improve" | "no_data";
  value: number | null;
  target: string;
  severity: "info" | "low" | "medium";
};

export function evaluateLifestyle(ctx: LifestyleContext): Finding[] {
  const f: Finding[] = [];

  // Сон
  if (ctx.sleep.avgHours == null) {
    f.push({ area: "sleep", status: "no_data", value: null, target: "≥7 ч", severity: "info" });
  } else {
    f.push({
      area: "sleep", value: +ctx.sleep.avgHours.toFixed(1), target: "≥7 ч",
      status: ctx.sleep.avgHours >= G.sleepHoursMin ? "good" : "improve",
      severity: ctx.sleep.avgHours < 6 ? "medium" : "low",
    });
  }

  // Активность (минуты в неделю)
  if (ctx.activity.activeMinPerWeek != null && ctx.activity.activeMinPerWeek > 0) {
    f.push({
      area: "activity", value: Math.round(ctx.activity.activeMinPerWeek), target: "≥150 мин/нед",
      status: ctx.activity.activeMinPerWeek >= G.activeMinPerWeekMin ? "good" : "improve",
      severity: "low",
    });
  } else if (ctx.activity.avgSteps != null) {
    f.push({
      area: "activity", value: Math.round(ctx.activity.avgSteps), target: "≥8000 шагов",
      status: ctx.activity.avgSteps >= G.stepsGood ? "good" : "improve",
      severity: "low",
    });
  } else {
    f.push({ area: "activity", status: "no_data", value: null, target: "≥150 мин/нед или ≥8000 шагов", severity: "info" });
  }

  // Вода — цель пользователя, иначе ориентир 2000 мл
  const waterTarget = 2000;
  if (ctx.hydration.avgMl != null) {
    f.push({
      area: "hydration", value: Math.round(ctx.hydration.avgMl), target: `~${waterTarget} мл`,
      status: ctx.hydration.avgMl >= waterTarget * 0.85 ? "good" : "improve", severity: "info",
    });
  } else {
    f.push({ area: "hydration", status: "no_data", value: null, target: `~${waterTarget} мл`, severity: "info" });
  }

  // Белок (если известен вес)
  if (ctx.nutrition.avgProteinG != null) {
    if (ctx.user.weightKg) {
      const targetG = Math.round(G.proteinGPerKg * ctx.user.weightKg);
      f.push({
        area: "protein", value: Math.round(ctx.nutrition.avgProteinG), target: `≥${targetG} г`,
        status: ctx.nutrition.avgProteinG >= targetG ? "good" : "improve", severity: "low",
      });
    } else {
      f.push({
        area: "protein", value: Math.round(ctx.nutrition.avgProteinG), target: `индивидуально от веса`,
        status: "improve", severity: "info",
      });
    }
  } else {
    f.push({ area: "protein", status: "no_data", value: null, target: "зависит от веса", severity: "info" });
  }

  // Клетчатка
  if (ctx.nutrition.avgFiberG != null) {
    f.push({
      area: "fiber", value: Math.round(ctx.nutrition.avgFiberG), target: `≥${G.fiberGMin} г`,
      status: ctx.nutrition.avgFiberG >= G.fiberGMin ? "good" : "improve", severity: "low",
    });
  }

  // Добавленный сахар
  if (ctx.nutrition.addedSugarPctKcal != null) {
    f.push({
      area: "sugar", value: Math.round(ctx.nutrition.addedSugarPctKcal), target: `<${G.addedSugarMaxPctKcal}%`,
      status: ctx.nutrition.addedSugarPctKcal <= G.addedSugarMaxPctKcal ? "good" : "improve", severity: ctx.nutrition.addedSugarPctKcal > 15 ? "medium" : "low",
    });
  }

  return f;
}
