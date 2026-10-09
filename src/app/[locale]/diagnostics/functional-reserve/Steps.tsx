import React from "react";
import { Field, Select, Check, inRange } from "./Fields";
import type { FormState } from "./form";
import { validity, labValues } from "./form";
import type { Dict } from "./i18n";

type Set = <K extends keyof FormState>(k: K, v: FormState[K]) => void;
interface P { f: FormState; set: Set; d: Dict; }

const Card = ({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) => (
  <div className="space-y-5">
    <div>
      <h2 className="text-xl font-bold text-brand-forest">{title}</h2>
      {intro && <p className="text-sm text-gray-600 mt-1">{intro}</p>}
    </div>
    {children}
  </div>
);

export function ProfileStep({ f, set, d }: P) {
  return (
    <Card title={d.stepProfile}>
      <Field id="fr-age" label={d.age} hint={d.ageHint} value={f.age} onChange={(v) => set("age", v)} error={f.age !== "" && !validity.profile(f)} />
      <div>
        <span className="block text-sm font-medium text-gray-700 mb-1">{d.sex}</span>
        <div className="grid grid-cols-2 gap-3">
          {(["male", "female"] as const).map((s) => (
            <button
              key={s} id={`fr-sex-${s}`} type="button" onClick={() => set("sex", s)}
              className={`rounded-xl border px-4 py-3 font-medium ${f.sex === s ? "border-brand-leaf bg-brand-sage/40 text-brand-forest" : "border-gray-200 bg-white text-gray-700"}`}
            >
              {s === "male" ? d.male : d.female}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function CardioStep({ f, set, d }: P) {
  return (
    <Card title={d.cardioTitle} intro={d.cardioIntro}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field id="fr-waist" label={d.waist} hint={d.waistHint} value={f.waist} onChange={(v) => set("waist", v)} error={f.waist !== "" && !inRange(f.waist, 40, 200)} unit="cm" />
        <Field id="fr-rhr" label={d.rhr} hint={d.rhrHint} value={f.rhr} onChange={(v) => set("rhr", v)} error={f.rhr !== "" && !inRange(f.rhr, 30, 140)} unit="bpm" />
      </div>
      <h3 className="font-semibold text-gray-800">{d.paTitle}</h3>
      <Select id="fr-freq" label={d.freq} options={d.freqOpts} value={f.freq} onChange={(i) => set("freq", i)} />
      <Select id="fr-int" label={d.intensity} options={d.intOpts} value={f.intensity} onChange={(i) => set("intensity", i)} />
      <Select id="fr-dur" label={d.duration} options={d.durOpts} value={f.duration} onChange={(i) => set("duration", i)} />
      <Field id="fr-vo2" label={d.measuredVo2} hint={d.measuredVo2Hint} value={f.measuredVo2} onChange={(v) => set("measuredVo2", v)} error={f.measuredVo2 !== "" && !inRange(f.measuredVo2, 10, 95)} />
    </Card>
  );
}

export function GripStep({ f, set, d }: P) {
  return (
    <Card title={d.gripTitle} intro={d.gripIntro}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field id="fr-grip-dom" label={d.gripDom} value={f.gripDom} onChange={(v) => set("gripDom", v)} error={f.gripDom !== "" && !inRange(f.gripDom, 3, 100)} unit="kg" />
        <Field id="fr-grip-non" label={d.gripNon} value={f.gripNon} onChange={(v) => set("gripNon", v)} error={f.gripNon !== "" && !inRange(f.gripNon, 3, 100)} unit="kg" />
      </div>
    </Card>
  );
}

export function SppbStep({ f, set, d }: P) {
  const tandemOk = f.sbs && f.semi;
  return (
    <Card title={d.sppbTitle} intro={d.sppbIntro}>
      <h3 className="font-semibold text-gray-800">{d.balStage}</h3>
      <div className="grid gap-3">
        <Check id="fr-sbs" label={d.sbs} checked={f.sbs} onChange={(v) => set("sbs", v)} />
        <Check id="fr-semi" label={d.semi} checked={f.sbs && f.semi} disabled={!f.sbs} onChange={(v) => set("semi", v)} />
      </div>
      <Field id="fr-tandem" label={d.tandem} value={tandemOk ? f.tandem : "0"} disabled={!tandemOk} onChange={(v) => set("tandem", v)} error={tandemOk && !inRange(f.tandem, 0, 10)} unit="s" />
      <div className="grid gap-3">
        <Field id="fr-gait" label={d.gait} value={f.gait} disabled={f.gaitUnable} onChange={(v) => set("gait", v)} error={!f.gaitUnable && f.gait !== "" && !inRange(f.gait, 1, 30)} unit="s" />
        <Check id="fr-gait-unable" label={d.gaitUnable} checked={f.gaitUnable} onChange={(v) => set("gaitUnable", v)} />
        <Field id="fr-chair" label={d.chair} value={f.chair} disabled={f.chairUnable} onChange={(v) => set("chair", v)} error={!f.chairUnable && f.chair !== "" && !inRange(f.chair, 3, 120)} unit="s" />
        <Check id="fr-chair-unable" label={d.chairUnable} checked={f.chairUnable} onChange={(v) => set("chairUnable", v)} />
      </div>
    </Card>
  );
}

const zeroToFive = ["0", "1", "2", "3", "4", "5"];

export function SrtStep({ f, set, d }: P) {
  return (
    <Card title={d.srtTitle} intro={d.srtIntro}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Select id="fr-srt-down" label={d.srtDown} options={zeroToFive} value={f.srtDown} onChange={(i) => set("srtDown", i)} />
        <Select id="fr-srt-up" label={d.srtUp} options={zeroToFive} value={f.srtUp} onChange={(i) => set("srtUp", i)} />
      </div>
      <div className="grid gap-3">
        <Check id="fr-srt-uns-down" label={d.srtUnsDown} checked={f.srtUnsDown} onChange={(v) => set("srtUnsDown", v)} />
        <Check id="fr-srt-uns-up" label={d.srtUnsUp} checked={f.srtUnsUp} onChange={(v) => set("srtUnsUp", v)} />
      </div>
    </Card>
  );
}

export function LabsStep({ f, set, d }: P) {
  const bad = (s: string) => s !== "" && isNaN(parseFloat(s.replace(",", ".")));
  const all = labValues(f);
  return (
    <Card title={d.labsTitle} intro={d.labsIntro}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field id="fr-alb" label={d.alb} value={f.alb} onChange={(v) => set("alb", v)} units={["g/L", "g/dL"]} unit2={f.albU} onUnit={(u) => set("albU", u as FormState["albU"])} error={bad(f.alb)} />
        <Field id="fr-cre" label={d.cre} value={f.cre} onChange={(v) => set("cre", v)} units={["umol/L", "mg/dL"]} unit2={f.creU} onUnit={(u) => set("creU", u as FormState["creU"])} error={bad(f.cre)} />
        <Field id="fr-glu" label={d.glu} value={f.glu} onChange={(v) => set("glu", v)} units={["mmol/L", "mg/dL"]} unit2={f.gluU} onUnit={(u) => set("gluU", u as FormState["gluU"])} error={bad(f.glu)} />
        <Field id="fr-crp" label={d.crp} value={f.crp} onChange={(v) => set("crp", v)} units={["mg/L", "mg/dL"]} unit2={f.crpU} onUnit={(u) => set("crpU", u as FormState["crpU"])} error={bad(f.crp)} />
        <Field id="fr-lym" label={d.lym} value={f.lym} onChange={(v) => set("lym", v)} error={bad(f.lym)} />
        <Field id="fr-mcv" label={d.mcv} value={f.mcv} onChange={(v) => set("mcv", v)} error={bad(f.mcv)} />
        <Field id="fr-rdw" label={d.rdw} value={f.rdw} onChange={(v) => set("rdw", v)} error={bad(f.rdw)} />
        <Field id="fr-alp" label={d.alp} value={f.alp} onChange={(v) => set("alp", v)} error={bad(f.alp)} />
        <Field id="fr-wbc" label={d.wbc} value={f.wbc} onChange={(v) => set("wbc", v)} error={bad(f.wbc)} />
      </div>
      {!all && Object.values({ a: f.alb, b: f.cre, c: f.glu, e: f.crp, g: f.lym, h: f.mcv, i: f.rdw, j: f.alp, k: f.wbc }).every((x) => x !== "") && (
        <p className="text-sm text-red-600">{d.invalid}</p>
      )}
    </Card>
  );
}
