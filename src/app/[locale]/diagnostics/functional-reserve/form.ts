import {
  Sex, PaiFrequency, PaiIntensity, PaiDuration, physicalActivityIndex, computeHunt, computeGrip,
  computeSppb, computeSrt, computePhenoAge, unitConv, PHENOAGE_RANGES,
} from "@/lib/clinical/functional-reserve";
import { inRange, num } from "./Fields";
import type { Profile } from "./Results";

export const FREQ: PaiFrequency[] = ["never", "lt1week", "once", "twoThree", "daily"];
export const INTENSITY: PaiIntensity[] = ["light", "moderate", "hard"];
export const DURATION: PaiDuration[] = ["lt15", "m15_29", "m30_60", "gt60"];

export interface FormState {
  age: string; sex: Sex;
  waist: string; rhr: string; freq: number; intensity: number; duration: number; measuredVo2: string;
  gripDom: string; gripNon: string;
  sbs: boolean; semi: boolean; tandem: string; gait: string; gaitUnable: boolean; chair: string; chairUnable: boolean;
  srtDown: number; srtUp: number; srtUnsDown: boolean; srtUnsUp: boolean;
  alb: string; albU: keyof typeof unitConv.albumin;
  cre: string; creU: keyof typeof unitConv.creatinine;
  glu: string; gluU: keyof typeof unitConv.glucose;
  crp: string; crpU: keyof typeof unitConv.crp;
  lym: string; mcv: string; rdw: string; alp: string; wbc: string;
}

export const initialForm: FormState = {
  age: "", sex: "male",
  waist: "", rhr: "", freq: 0, intensity: 0, duration: 0, measuredVo2: "",
  gripDom: "", gripNon: "",
  sbs: true, semi: true, tandem: "10", gait: "", gaitUnable: false, chair: "", chairUnable: false,
  srtDown: 0, srtUp: 0, srtUnsDown: false, srtUnsUp: false,
  alb: "", albU: "g/L", cre: "", creU: "umol/L", glu: "", gluU: "mmol/L", crp: "", crpU: "mg/L",
  lym: "", mcv: "", rdw: "", alp: "", wbc: "",
};

const R = PHENOAGE_RANGES;

export const validity = {
  profile: (f: FormState) => inRange(f.age, 18, 100),
  cardio: (f: FormState) =>
    inRange(f.waist, 40, 200) && inRange(f.rhr, 30, 140) && (f.measuredVo2 === "" || inRange(f.measuredVo2, 10, 95)),
  grip: (f: FormState) => inRange(f.gripDom, 3, 100) && inRange(f.gripNon, 3, 100),
  sppb: (f: FormState) =>
    inRange(f.tandem, 0, 10) &&
    (f.gaitUnable || inRange(f.gait, 1, 30)) &&
    (f.chairUnable || inRange(f.chair, 3, 120)),
  srt: () => true,
  labs: (f: FormState) => !!labValues(f),
};

/** Convert lab inputs to model units; null if anything is missing/implausible. */
export function labValues(f: FormState) {
  const v = {
    albuminGL: num(f.alb) * unitConv.albumin[f.albU],
    creatinineUmolL: num(f.cre) * unitConv.creatinine[f.creU],
    glucoseMmolL: num(f.glu) * unitConv.glucose[f.gluU],
    crpMgL: num(f.crp) * unitConv.crp[f.crpU],
    lymphocytePct: num(f.lym),
    mcvFL: num(f.mcv),
    rdwPct: num(f.rdw),
    alpUL: num(f.alp),
    wbc: num(f.wbc),
  };
  for (const k of Object.keys(v) as (keyof typeof v)[]) {
    const x = v[k];
    if (isNaN(x) || x < R[k][0] || x > R[k][1]) return null;
  }
  return v;
}

export function buildProfile(f: FormState, skipped: Set<string>, steps: string[]): Profile | null {
  if (!validity.profile(f)) return null;
  const age = num(f.age);
  const p: Profile = { age, sex: f.sex };
  const on = (s: string) => steps.includes(s) && !skipped.has(s);

  if (on("cardio") && validity.cardio(f)) {
    p.hunt = computeHunt({
      age, sex: f.sex, waistCm: num(f.waist), restingHr: num(f.rhr),
      pai: physicalActivityIndex(FREQ[f.freq], INTENSITY[f.intensity], DURATION[f.duration]),
      measuredVo2max: f.measuredVo2 === "" ? null : num(f.measuredVo2),
    });
  }
  if (on("grip") && validity.grip(f)) p.grip = computeGrip(f.sex, num(f.gripDom), num(f.gripNon));
  if (on("sppb") && validity.sppb(f)) {
    p.sppb = computeSppb({
      sideBySide10s: f.sbs, semiTandem10s: f.sbs && f.semi, tandemSec: f.sbs && f.semi ? num(f.tandem) : 0,
      gait4mSec: f.gaitUnable ? null : num(f.gait), chair5Sec: f.chairUnable ? null : num(f.chair),
    });
  }
  if (on("srt")) {
    p.srt = computeSrt({
      supportsDown: f.srtDown, supportsUp: f.srtUp, unsteadyDown: f.srtUnsDown, unsteadyUp: f.srtUnsUp,
    });
  }
  const lv = labValues(f);
  if (on("labs") && lv) p.pheno = computePhenoAge({ age, ...lv });
  return p;
}
