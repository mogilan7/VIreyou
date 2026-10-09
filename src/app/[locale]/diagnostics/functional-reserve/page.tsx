"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { ArrowLeft, ChevronLeft, ChevronRight, Home, Stethoscope, Activity } from "lucide-react";
import { Link } from "@/i18n/routing";
import { saveTestResult } from "@/actions/save-test";
import { createClient } from "@/utils/supabase/client";
import { DICT, Lang } from "./i18n";
import { FormState, initialForm, buildProfile, validity } from "./form";
import { ProfileStep, CardioStep, GripStep, SppbStep, SrtStep, LabsStep } from "./Steps";
import Results, { buildRows } from "./Results";

type Protocol = "express" | "full";
const STEPS: Record<Protocol, string[]> = {
  express: ["profile", "cardio", "sppb", "srt", "result"],
  full: ["profile", "cardio", "grip", "sppb", "srt", "labs", "result"],
};

export default function FunctionalReservePage() {
  const locale = useLocale();
  const lang: Lang = locale === "ru" ? "ru" : "en";
  const d = DICT[lang];

  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [idx, setIdx] = useState(0);
  const [f, setF] = useState<FormState>(initialForm);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => setIsAuthenticated(!!data.session));
  }, []);

  const steps = protocol ? STEPS[protocol] : [];
  const step = steps[idx];
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const stepValid = step === "result" || (validity as Record<string, (x: FormState) => boolean>)[step]?.(f);
  const profile = useMemo(() => (protocol ? buildProfile(f, skipped, steps) : null), [f, skipped, protocol, steps]);

  const go = (delta: number, skip = false) => {
    if (step && step !== "profile" && step !== "result") {
      setSkipped((s) => {
        const n = new Set(s);
        if (skip) n.add(step); else n.delete(step);
        return n;
      });
    }
    setIdx((i) => Math.max(0, Math.min(steps.length - 1, i + delta)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const restart = () => {
    setProtocol(null); setIdx(0); setF(initialForm); setSkipped(new Set());
    setSaveStatus("idle"); setSaveError(null);
  };

  const save = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      const rows = buildRows(profile, d);
      const primary = profile.hunt?.fitnessAge ?? profile.sppb?.total ?? profile.pheno?.phenoAge ?? 0;
      const res: any = await saveTestResult({
        testType: "functional-reserve",
        score: Math.round(primary * 10) / 10,
        interpretation: rows.map((r) => `${r.domain}: ${r.value}`).join("; "),
        rawData: { protocol, form: f, skipped: Array.from(skipped), profile },
      });
      if (res?.success) setSaveStatus("success");
      else { setSaveStatus("error"); setSaveError(res?.error ?? null); }
    } catch (e: any) {
      setSaveStatus("error"); setSaveError(e?.message ?? null);
    } finally {
      setIsSaving(false);
    }
  };

  const labelOf = (s: string) =>
    ({ profile: d.stepProfile, cardio: d.stepCardio, grip: d.stepGrip, sppb: d.stepSppb, srt: d.stepSrt, labs: d.stepLabs, result: d.stepResult } as Record<string, string>)[s];

  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-sage/30 to-white py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/diagnostics" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>{d.back}</span>
        </Link>

        {!protocol ? (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-brand-forest mb-3">{d.title}</h1>
              <p className="text-gray-600 max-w-2xl mx-auto">{d.subtitle}</p>
            </div>
            <div className="bg-white rounded-2xl border border-brand-sage/60 p-6">
              <h2 className="font-semibold text-brand-text mb-1">{d.whyTitle}</h2>
              <p className="text-sm text-gray-600">{d.why}</p>
            </div>
            <h2 className="font-semibold text-gray-800">{d.protocolTitle}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {([["express", Home, d.express, d.expressDesc], ["full", Stethoscope, d.full, d.fullDesc]] as const).map(([k, Icon, t, desc]) => (
                <button key={k} id={`fr-protocol-${k}`} onClick={() => setProtocol(k)}
                  className="text-left bg-white rounded-2xl border border-brand-sage/60 p-6 hover:-translate-y-1 hover:shadow-md transition-all">
                  <Icon className="w-6 h-6 text-brand-leaf mb-3" />
                  <div className="font-bold text-brand-text mb-1">{t}</div>
                  <p className="text-sm text-gray-600 mb-4">{desc}</p>
                  <span className="text-xs font-bold uppercase tracking-widest text-brand-leaf">{d.start} →</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <ol className="flex flex-wrap gap-2 text-xs">
              {steps.map((s, i) => (
                <li key={s} className={`px-3 py-1 rounded-full border ${i === idx ? "bg-brand-forest text-white border-brand-forest" : i < idx ? "bg-brand-sage/50 border-brand-sage text-brand-forest" : "border-gray-200 text-gray-400"}`}>
                  {labelOf(s)}
                </li>
              ))}
            </ol>

            <div className="bg-white rounded-2xl border border-brand-sage/60 shadow-sm p-6 md:p-8">
              {step === "profile" && <ProfileStep f={f} set={set} d={d} />}
              {step === "cardio" && <CardioStep f={f} set={set} d={d} />}
              {step === "grip" && <GripStep f={f} set={set} d={d} />}
              {step === "sppb" && <SppbStep f={f} set={set} d={d} />}
              {step === "srt" && <SrtStep f={f} set={set} d={d} />}
              {step === "labs" && <LabsStep f={f} set={set} d={d} />}
              {step === "result" && (profile ? (
                <Results profile={profile} d={d} lang={lang} onRestart={restart} onSave={save}
                  saveStatus={saveStatus} isSaving={isSaving} isAuthenticated={isAuthenticated} saveError={saveError} />
              ) : (
                <p className="text-center text-gray-500">{d.noData}</p>
              ))}
            </div>

            {step !== "result" && (
              <div className="flex items-center justify-between gap-3">
                <button id="fr-prev" onClick={() => (idx === 0 ? restart() : go(-1))}
                  className="flex items-center gap-1 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-100">
                  <ChevronLeft className="w-4 h-4" /> {d.prev}
                </button>
                <div className="flex gap-3">
                  {step !== "profile" && (
                    <button id="fr-skip" onClick={() => go(1, true)} className="px-4 py-3 rounded-xl text-gray-500 hover:bg-gray-100 text-sm">
                      {d.skip}
                    </button>
                  )}
                  <button id="fr-next" disabled={!stepValid} onClick={() => go(1)}
                    className="flex items-center gap-1 px-6 py-3 rounded-xl bg-brand-forest text-white font-medium disabled:opacity-40">
                    {idx === steps.length - 2 ? d.results : d.next} <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <Activity className="hidden" aria-hidden />
      </div>
    </main>
  );
}
