/**
 * Functional Reserve Profile — computational core.
 *
 * Модульный калькулятор функционального резерва. Намеренно НЕ сводит всё к одной
 * цифре «биологического возраста»: каждый домен считается отдельно, по своей
 * опубликованной методике, и сопоставляется с популяционными нормативами.
 *
 * Domains / sources
 *  1. Cardiorespiratory — HUNT non-exercise VO2peak model
 *       Nes BM et al. Med Sci Sports Exerc 2011;43(11):2024-30.
 *     PA-index (Kurtze N et al. Med Sci Sports Exerc 2008;40:1087 / HUNT questionnaire).
 *     Reference means/SD (treadmill VO2max, healthy, n=3816)
 *       Loe H et al. PLoS ONE 2013;8(5):e64319, Table 2.
 *  2. Muscle strength — EWGSOP2 grip-strength cut-offs
 *       Cruz-Jentoft AJ et al. Age Ageing 2019;48(1):16-31.
 *  3. Locomotion / balance — SPPB (Guralnik JM et al. J Gerontol 1994;49:M85-94).
 *  4. Floor transfer — Sitting-Rising Test (Araújo CG et al. Eur J Prev Cardiol 2012;
 *       Brito LB et al. Eur J Prev Cardiol 2014).
 *  5. Biochemical — PhenoAge (Levine ME et al. Aging 2018;10(4):573-91).
 */

export type Sex = "male" | "female";

/* ------------------------------------------------------------------ */
/* 1. HUNT: non-exercise VO2peak + Fitness Age                         */
/* ------------------------------------------------------------------ */

/** Nes et al. 2011 sex-specific regression coefficients (VO2peak, mL·kg⁻¹·min⁻¹). */
export const HUNT_COEFFICIENTS: Record<
  Sex,
  { intercept: number; age: number; waist: number; rhr: number; pai: number }
> = {
  male: { intercept: 100.27, age: -0.296, waist: -0.369, rhr: -0.155, pai: 0.226 },
  female: { intercept: 74.74, age: -0.247, waist: -0.259, rhr: -0.114, pai: 0.198 },
};

/** HUNT physical-activity index components (Kurtze 2008). PAI = freq × intensity × duration, range 0–15. */
export const PAI_FREQUENCY = {
  never: 0,
  lt1week: 0.5,
  once: 1,
  twoThree: 2.5,
  daily: 5,
} as const;
export const PAI_INTENSITY = { light: 1, moderate: 2, hard: 3 } as const;
export const PAI_DURATION = { lt15: 0.1, m15_29: 0.38, m30_60: 0.75, gt60: 1.0 } as const;

export type PaiFrequency = keyof typeof PAI_FREQUENCY;
export type PaiIntensity = keyof typeof PAI_INTENSITY;
export type PaiDuration = keyof typeof PAI_DURATION;

export function physicalActivityIndex(
  frequency: PaiFrequency,
  intensity: PaiIntensity,
  duration: PaiDuration
): number {
  return PAI_FREQUENCY[frequency] * PAI_INTENSITY[intensity] * PAI_DURATION[duration];
}

export interface HuntInput {
  age: number;
  sex: Sex;
  waistCm: number;
  restingHr: number;
  pai: number;
  /** Optional measured VO2max (ergospirometry). Overrides the model estimate. */
  measuredVo2max?: number | null;
}

/**
 * HUNT reference VO2max (mL·kg⁻¹·min⁻¹), mean ± SD by decade.
 * Loe et al. 2013, Table 2. `mid` is the decade midpoint used for interpolation
 * (the open-ended 70+ group is placed at 75).
 */
export const HUNT_REFERENCE: ReadonlyArray<{
  label: string;
  mid: number;
  male: { mean: number; sd: number };
  female: { mean: number; sd: number };
}> = [
  { label: "20–29", mid: 25, male: { mean: 54.4, sd: 8.4 }, female: { mean: 43.0, sd: 7.7 } },
  { label: "30–39", mid: 35, male: { mean: 49.1, sd: 7.5 }, female: { mean: 40.0, sd: 6.8 } },
  { label: "40–49", mid: 45, male: { mean: 47.2, sd: 7.7 }, female: { mean: 38.4, sd: 6.9 } },
  { label: "50–59", mid: 55, male: { mean: 42.6, sd: 7.4 }, female: { mean: 34.4, sd: 5.7 } },
  { label: "60–69", mid: 65, male: { mean: 39.2, sd: 6.7 }, female: { mean: 31.1, sd: 5.1 } },
  { label: "70+", mid: 75, male: { mean: 35.3, sd: 6.5 }, female: { mean: 28.3, sd: 5.2 } },
];

export function estimateVo2peak(i: Pick<HuntInput, "age" | "sex" | "waistCm" | "restingHr" | "pai">): number {
  const c = HUNT_COEFFICIENTS[i.sex];
  return c.intercept + c.age * i.age + c.waist * i.waistCm + c.rhr * i.restingHr + c.pai * i.pai;
}

function interpAtAge(sex: Sex, age: number, key: "mean" | "sd"): number {
  const r = HUNT_REFERENCE;
  if (age <= r[0].mid) return r[0][sex][key];
  const last = r[r.length - 1];
  if (age >= last.mid) return last[sex][key];
  for (let k = 0; k < r.length - 1; k++) {
    const a = r[k], b = r[k + 1];
    if (age >= a.mid && age <= b.mid) {
      const t = (age - a.mid) / (b.mid - a.mid);
      return a[sex][key] + t * (b[sex][key] - a[sex][key]);
    }
  }
  return last[sex][key];
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26). */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/**
 * Fitness Age: the age at which the HUNT population-mean VO2max equals the
 * subject's VO2max (piecewise-linear inverse of the reference curve, linear
 * extrapolation beyond the end segments, clamped to 20–90).
 */
export function fitnessAgeFromVo2(vo2: number, sex: Sex): { age: number; extrapolated: boolean } {
  const pts = HUNT_REFERENCE.map((r) => ({ x: r.mid, y: r[sex].mean }));
  let extrapolated = false;
  let age: number;
  if (vo2 >= pts[0].y) {
    const s = (pts[1].y - pts[0].y) / (pts[1].x - pts[0].x);
    age = pts[0].x + (vo2 - pts[0].y) / s;
    extrapolated = true;
  } else if (vo2 <= pts[pts.length - 1].y) {
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    const s = (b.y - a.y) / (b.x - a.x);
    age = b.x + (vo2 - b.y) / s;
    extrapolated = true;
  } else {
    age = pts[0].x;
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      if (vo2 <= a.y && vo2 >= b.y) {
        age = a.x + ((vo2 - a.y) / (b.y - a.y)) * (b.x - a.x);
        break;
      }
    }
  }
  const clamped = Math.min(90, Math.max(20, age));
  return { age: clamped, extrapolated: extrapolated || clamped !== age };
}

export interface HuntResult {
  vo2: number;
  vo2Source: "model" | "measured";
  fitnessAge: number;
  fitnessAgeExtrapolated: boolean;
  /** fitnessAge − chronological age (negative = fitter than peers). */
  deltaYears: number;
  /** Percentile of VO2 among same-sex peers of the same age (normal approximation of HUNT mean/SD). */
  percentile: number;
  refMean: number;
  refSd: number;
}

export function computeHunt(i: HuntInput): HuntResult {
  const useMeasured = typeof i.measuredVo2max === "number" && i.measuredVo2max > 0;
  const vo2 = useMeasured ? (i.measuredVo2max as number) : estimateVo2peak(i);
  const fa = fitnessAgeFromVo2(vo2, i.sex);
  const mean = interpAtAge(i.sex, i.age, "mean");
  const sd = interpAtAge(i.sex, i.age, "sd");
  const percentile = Math.min(99, Math.max(1, normalCdf((vo2 - mean) / sd) * 100));
  return {
    vo2,
    vo2Source: useMeasured ? "measured" : "model",
    fitnessAge: fa.age,
    fitnessAgeExtrapolated: fa.extrapolated,
    deltaYears: fa.age - i.age,
    percentile,
    refMean: mean,
    refSd: sd,
  };
}

/* ------------------------------------------------------------------ */
/* 2. PhenoAge (Levine 2018)                                           */
/* ------------------------------------------------------------------ */

/** Coefficients of the Levine 2018 mortality-score model. Inputs in the ORIGINAL units. */
export const PHENOAGE_COEFFICIENTS = {
  intercept: -19.9067,
  albumin_gL: -0.0336,
  creatinine_umolL: 0.0095,
  glucose_mmolL: 0.1953,
  lnCrp_mgdL: 0.0954,
  lymphocytePct: -0.012,
  mcv_fL: 0.0268,
  rdwPct: 0.3306,
  alp_UL: 0.00188,
  wbc_10e3uL: 0.0554,
  age: 0.0804,
} as const;

/** Gompertz parameters and horizon (120 months). */
export const PHENOAGE_GAMMA = 0.0076927;
export const PHENOAGE_HORIZON_MONTHS = 120;
/** Age-transform constants. */
export const PHENOAGE_A = 141.50225;
export const PHENOAGE_B = 0.00553;
export const PHENOAGE_C = 0.090165;

export interface PhenoAgeInput {
  age: number;
  albuminGL: number;
  creatinineUmolL: number;
  glucoseMmolL: number;
  /** hs-CRP in mg/L */
  crpMgL: number;
  lymphocytePct: number;
  mcvFL: number;
  rdwPct: number;
  alpUL: number;
  /** 10⁹/L (= 10³/µL) */
  wbc: number;
}

export interface PhenoAgeResult {
  phenoAge: number;
  /** phenoAge − chronological age (negative = biologically younger). */
  deltaYears: number;
  xb: number;
  /** 10-year all-cause mortality probability from the model. */
  mortality10y: number;
}

export function computePhenoAge(i: PhenoAgeInput): PhenoAgeResult {
  const c = PHENOAGE_COEFFICIENTS;
  // The model uses ln(CRP in mg/dL); guard against log(0).
  const crpMgDl = Math.max(i.crpMgL, 0.1) / 10;
  const xb =
    c.intercept +
    c.albumin_gL * i.albuminGL +
    c.creatinine_umolL * i.creatinineUmolL +
    c.glucose_mmolL * i.glucoseMmolL +
    c.lnCrp_mgdL * Math.log(crpMgDl) +
    c.lymphocytePct * i.lymphocytePct +
    c.mcv_fL * i.mcvFL +
    c.rdwPct * i.rdwPct +
    c.alp_UL * i.alpUL +
    c.wbc_10e3uL * i.wbc +
    c.age * i.age;
  const g = PHENOAGE_GAMMA;
  // X = −ln(1 − M) = exp(xb)·(exp(120γ) − 1)/γ   (so M = 1 − e^{−X})
  const X = (Math.exp(xb) * (Math.exp(PHENOAGE_HORIZON_MONTHS * g) - 1)) / g;
  const mortality = 1 - Math.exp(-X);
  const phenoAge = PHENOAGE_A + Math.log(PHENOAGE_B * X) / PHENOAGE_C;
  return { phenoAge, deltaYears: phenoAge - i.age, xb, mortality10y: mortality };
}

/** Unit converters to the units required by the model. */
export const unitConv = {
  albumin: { "g/L": 1, "g/dL": 10 },
  creatinine: { "umol/L": 1, "mg/dL": 88.4 },
  glucose: { "mmol/L": 1, "mg/dL": 1 / 18.016 },
  crp: { "mg/L": 1, "mg/dL": 10 },
} as const;

/** Plausibility ranges (in model units) to reject typos. */
export const PHENOAGE_RANGES = {
  albuminGL: [20, 60],
  creatinineUmolL: [20, 600],
  glucoseMmolL: [2, 30],
  crpMgL: [0, 300],
  lymphocytePct: [2, 80],
  mcvFL: [60, 130],
  rdwPct: [9, 25],
  alpUL: [10, 800],
  wbc: [1, 50],
} as const;

/* ------------------------------------------------------------------ */
/* 3. Grip strength (EWGSOP2)                                          */
/* ------------------------------------------------------------------ */

/** EWGSOP2 cut-points for low muscle strength (kg): men <27, women <16. */
export const EWGSOP2_GRIP_CUTOFF: Record<Sex, number> = { male: 27, female: 16 };

export interface GripResult {
  maxKg: number;
  cutoffKg: number;
  low: boolean;
  /** Ratio to the EWGSOP2 cut-off. */
  ratio: number;
}

export function computeGrip(sex: Sex, dominantKg: number, nonDominantKg: number): GripResult {
  const maxKg = Math.max(dominantKg, nonDominantKg);
  const cutoffKg = EWGSOP2_GRIP_CUTOFF[sex];
  return { maxKg, cutoffKg, low: maxKg < cutoffKg, ratio: maxKg / cutoffKg };
}

/* ------------------------------------------------------------------ */
/* 4. SPPB (NIA)                                                       */
/* ------------------------------------------------------------------ */

export interface SppbInput {
  sideBySide10s: boolean;
  semiTandem10s: boolean;
  /** seconds held in tandem stand (0–10) */
  tandemSec: number;
  /** time to walk 4 m, seconds; null if unable */
  gait4mSec: number | null;
  /** time for 5 chair rises, seconds; null if unable / >60 s */
  chair5Sec: number | null;
}

export interface SppbResult {
  balance: number;
  gait: number;
  chair: number;
  total: number;
  gaitSpeed: number | null;
  category: "low" | "moderate" | "high";
}

export function computeSppb(i: SppbInput): SppbResult {
  let balance = 0;
  if (i.sideBySide10s) {
    balance = 1;
    if (i.semiTandem10s) {
      balance = 2;
      balance += i.tandemSec >= 10 ? 2 : i.tandemSec >= 3 ? 1 : 0;
    }
  }
  let gait = 0;
  if (i.gait4mSec && i.gait4mSec > 0) {
    const t = i.gait4mSec;
    gait = t < 4.82 ? 4 : t <= 6.2 ? 3 : t <= 8.7 ? 2 : 1;
  }
  let chair = 0;
  if (i.chair5Sec && i.chair5Sec > 0 && i.chair5Sec <= 60) {
    const t = i.chair5Sec;
    chair = t <= 11.19 ? 4 : t <= 13.69 ? 3 : t <= 16.69 ? 2 : 1;
  }
  const total = balance + gait + chair;
  // Bands per product specification: 11–12 low risk, 8–10 moderate, <8 high.
  const category = total >= 11 ? "low" : total >= 8 ? "moderate" : "high";
  return {
    balance,
    gait,
    chair,
    total,
    gaitSpeed: i.gait4mSec ? 4 / i.gait4mSec : null,
    category,
  };
}

/* ------------------------------------------------------------------ */
/* 5. Sitting-Rising Test (Araújo)                                     */
/* ------------------------------------------------------------------ */

export interface SrtInput {
  /** supports used while SITTING down (hand, knee, forearm, side of leg, hand on knee): 0..5 */
  supportsDown: number;
  /** supports used while RISING: 0..5 */
  supportsUp: number;
  /** noticeable loss of balance (−0.5 per phase) */
  unsteadyDown: boolean;
  unsteadyUp: boolean;
}

/** Score 0–10: 5 points for each phase, −1 per support, −0.5 for unsteadiness. */
export function computeSrt(i: SrtInput): number {
  const phase = (supports: number, unsteady: boolean) =>
    Math.max(0, 5 - Math.min(5, supports) - (unsteady ? 0.5 : 0));
  return phase(i.supportsDown, i.unsteadyDown) + phase(i.supportsUp, i.unsteadyUp);
}

/* ------------------------------------------------------------------ */
/* Radar normalisation (visualisation only — NOT clinical scores)      */
/* ------------------------------------------------------------------ */

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

export const radarScale = {
  cardio: (percentile: number) => clamp(percentile),
  strength: (ratioToCutoff: number) =>
    ratioToCutoff < 1
      ? clamp(50 * ratioToCutoff)
      : clamp(50 + 50 * Math.min(1, (ratioToCutoff - 1) / 0.5)),
  sppb: (total: number) => clamp((total / 12) * 100),
  srt: (score: number) => clamp((score / 10) * 100),
  /** 50 = equal to calendar age; ±5 points per year younger/older. */
  metabolic: (deltaYears: number) => clamp(50 - 5 * deltaYears),
};
