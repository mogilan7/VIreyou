import { LifestyleContext } from "./context";
import { Findings } from "./rules";

export type Pattern = { id: string; areas: string[]; severity: "low" | "medium" };

export function detectPatterns(findings: Findings, ctx: LifestyleContext): Pattern[] {
  const hasL1 = (area: string, st: string[]) => findings.l1.some(f => f.category === area && st.includes(f.status));
  const hasL2 = (area: string, st: string[]) => findings.l2.some(f => f.metric === area && st.includes(f.status));

  const sedentary = hasL1("steps", ["improve"]) || hasL1("activity", ["improve"]);
  const lowHrv = hasL2("hrv", ["trend_down"]);
  const highSodium = hasL1("sodium", ["excess"]);
  const highBadFats = hasL1("saturated_fat", ["excess"]) || hasL1("trans_fat", ["excess"]);
  const drinksALot = hasL1("alcohol", ["excess"]);
  const smokes = !!ctx.l1.habits.smoking;

  const p: Pattern[] = [];

  // Натрий + малоподвижность: сердцу и сосудам труднее
  if (highSodium && sedentary) {
    p.push({ id: "sodium_sedentary", areas: ["sodium", "steps"], severity: "medium" });
  }

  // Нагрузка (соль/жиры/алкоголь) + низкая ВСР + малоподвижность: организму труднее восстанавливаться
  if ((highSodium || highBadFats || drinksALot) && lowHrv && sedentary) {
    p.push({ id: "low_recovery", areas: ["hrv", "steps"], severity: "medium" });
  }

  // Курение + низкая ВСР: восстановление даётся тяжелее (поддержка, без нотаций)
  if (smokes && lowHrv) {
    p.push({ id: "smoking_recovery", areas: ["smoking", "hrv"], severity: "low" });
  }

  return p;
}
