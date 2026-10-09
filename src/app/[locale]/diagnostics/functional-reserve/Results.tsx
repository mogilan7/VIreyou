"use client";

import React from "react";
import { Printer, Save, RotateCcw, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import RadarChart, { RadarPoint } from "./RadarChart";
import type { Dict, Lang } from "./i18n";
import {
  HuntResult, GripResult, SppbResult, PhenoAgeResult, Sex, radarScale,
} from "@/lib/clinical/functional-reserve";

export interface Profile {
  age: number;
  sex: Sex;
  hunt?: HuntResult;
  grip?: GripResult;
  sppb?: SppbResult;
  srt?: number;
  pheno?: PhenoAgeResult;
}

interface Row { key: string; domain: string; value: string; note: string; tone: "good" | "mid" | "bad"; }

const f1 = (v: number) => (Math.round(v * 10) / 10).toString();
const f0 = (v: number) => Math.round(v).toString();

function deltaText(d: Dict, delta: number, better: string, worse: string) {
  const a = Math.abs(delta);
  if (a < 0.5) return d.same;
  return `${delta < 0 ? better : worse} ${f0(a)} ${d.years}`;
}

export function buildRows(p: Profile, d: Dict): Row[] {
  const rows: Row[] = [];
  if (p.hunt) {
    const h = p.hunt;
    rows.push({
      key: "cardio",
      domain: d.cFit,
      value: `${f0(h.fitnessAge)} ${d.years}`,
      note:
        `${deltaText(d, h.deltaYears, d.better, d.worse)}. ${d.cVo2} ${f1(h.vo2)} (${h.vo2Source === "measured" ? d.cMeasured : d.cModel}); ` +
        `${d.cPct}: ${f0(h.percentile)}${h.fitnessAgeExtrapolated ? ". " + d.extrap : ""}`,
      tone: h.deltaYears <= -0.5 ? "good" : h.deltaYears < 4 ? "mid" : "bad",
    });
  }
  if (p.grip) {
    const g = p.grip;
    rows.push({
      key: "grip",
      domain: d.gripRes,
      value: `${f1(g.maxKg)} kg`,
      note: `${g.low ? d.gripLow : d.gripOk} (${d.threshold} ${g.cutoffKg} kg)`,
      tone: g.low ? "bad" : "good",
    });
  }
  if (p.sppb) {
    const s = p.sppb;
    rows.push({
      key: "sppb",
      domain: d.sppbRes,
      value: `${s.total}/12`,
      note: `${s.category === "low" ? d.sppbLow : s.category === "moderate" ? d.sppbMod : d.sppbHigh} (${d.bal} ${s.balance}/4, ${d.gaitL} ${s.gait}/4, ${d.chairL} ${s.chair}/4)`,
      tone: s.category === "low" ? "good" : s.category === "moderate" ? "mid" : "bad",
    });
  }
  if (p.srt !== undefined) {
    rows.push({
      key: "srt",
      domain: d.srtRes,
      value: `${f1(p.srt)}/10`,
      note: d.srtNote,
      tone: p.srt >= 8 ? "good" : p.srt >= 6 ? "mid" : "bad",
    });
  }
  if (p.pheno) {
    const ph = p.pheno;
    rows.push({
      key: "pheno",
      domain: d.phenoRes,
      value: `${f0(ph.phenoAge)} ${d.years}`,
      note: `${deltaText(d, ph.deltaYears, d.phenoY, d.phenoO)}. ${d.mort}: ${(ph.mortality10y * 100).toFixed(1)}%`,
      tone: ph.deltaYears <= -0.5 ? "good" : ph.deltaYears < 3 ? "mid" : "bad",
    });
  }
  return rows;
}

export function buildRadar(p: Profile, d: Dict): RadarPoint[] {
  const pts: RadarPoint[] = [];
  if (p.hunt) pts.push({ label: d.stepCardio, value: radarScale.cardio(p.hunt.percentile) });
  if (p.grip) pts.push({ label: d.stepGrip, value: radarScale.strength(p.grip.ratio) });
  if (p.sppb) pts.push({ label: d.stepSppb, value: radarScale.sppb(p.sppb.total) });
  if (p.srt !== undefined) pts.push({ label: d.stepSrt, value: radarScale.srt(p.srt) });
  if (p.pheno) pts.push({ label: d.stepLabs, value: radarScale.metabolic(p.pheno.deltaYears) });
  return pts;
}

const toneCls = {
  good: "bg-green-50 border-green-200 text-green-800",
  mid: "bg-yellow-50 border-yellow-200 text-yellow-800",
  bad: "bg-red-50 border-red-200 text-red-800",
} as const;

export default function Results({
  profile, d, lang, onRestart, onSave, saveStatus, isSaving, isAuthenticated, saveError,
}: {
  profile: Profile; d: Dict; lang: Lang; onRestart: () => void; onSave: () => void;
  saveStatus: "idle" | "success" | "error"; isSaving: boolean; isAuthenticated: boolean; saveError: string | null;
}) {
  const rows = buildRows(profile, d);
  const radar = buildRadar(profile, d);
  const date = new Date().toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB");
  const sexLabel = profile.sex === "male" ? d.male : d.female;
  const methods = [
    profile.hunt && d.method_hunt,
    profile.grip && d.method_ewgsop,
    profile.sppb && d.method_sppb,
    profile.srt !== undefined && d.method_srt,
    profile.pheno && d.method_pheno,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-8">
      <style>{`
        .fr-print-only{display:none}
        @media print{
          @page{size:A4;margin:14mm}
          body *{visibility:hidden}
          #fr-report,#fr-report *{visibility:visible}
          #fr-report{display:block!important;position:absolute;left:0;top:0;width:100%;color:#111}
          .fr-print-only{display:block}
        }
      `}</style>

      <div className="text-center">
        <h2 className="text-3xl font-bold text-brand-forest mb-2">{d.resultTitle}</h2>
      </div>

      {rows.length === 0 ? (
        <p className="text-center text-gray-500">{d.noData}</p>
      ) : (
        <>
          <div className="grid gap-3">
            {rows.map((r) => (
              <div key={r.key} className={`rounded-2xl border p-5 ${toneCls[r.tone]}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold uppercase tracking-wide opacity-80">{r.domain}</span>
                  <span className="text-2xl font-bold">{r.value}</span>
                </div>
                <p className="text-sm mt-1 opacity-90">{r.note}</p>
              </div>
            ))}
          </div>

          {radar.length >= 3 && (
            <div className="bg-white rounded-2xl border border-brand-sage/60 p-6 flex flex-col items-center">
              <h3 className="font-semibold text-brand-text mb-2">{d.radarTitle}</h3>
              <RadarChart points={radar} />
              <p className="text-xs text-gray-500 text-center mt-3 max-w-md">{d.radarNote}</p>
            </div>
          )}
        </>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          id="fr-export-pdf"
          onClick={() => window.print()}
          disabled={rows.length === 0}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-forest text-white font-medium hover:opacity-90 disabled:opacity-40"
        >
          <Printer className="w-4 h-4" /> {d.exportPdf}
        </button>
        {isAuthenticated ? (
          <button
            id="fr-save"
            onClick={onSave}
            disabled={isSaving || saveStatus === "success" || rows.length === 0}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-brand-leaf text-brand-forest font-medium hover:bg-brand-sage/30 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveStatus === "success" ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saveStatus === "success" ? d.saved : d.save}
          </button>
        ) : (
          <p className="text-sm text-gray-500 self-center">{d.loginHint}</p>
        )}
        <button
          id="fr-restart"
          onClick={onRestart}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-gray-600 hover:bg-gray-100"
        >
          <RotateCcw className="w-4 h-4" /> {d.restart}
        </button>
      </div>
      {saveStatus === "error" && (
        <p className="flex items-center justify-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" /> {d.saveErr}{saveError ? `: ${saveError}` : ""}
        </p>
      )}
      <p className="text-xs text-gray-500 text-center max-w-xl mx-auto">{d.disclaimer}</p>

      {/* A4 clinical report (visible only when printing) */}
      <div id="fr-report" className="fr-print-only" style={{ display: "none", fontFamily: "Arial, Helvetica, sans-serif", fontSize: 12 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>{d.reportTitle}</h1>
        <p style={{ margin: "4px 0 12px", color: "#444" }}>
          VIReYou · {d.reportDate}: {date} · {d.patient}: {sexLabel}, {profile.age} {d.years}
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {[d.domain, d.value, d.reference].map((h) => (
                <th key={h} style={{ textAlign: "left", borderBottom: "2px solid #111", padding: "6px 4px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td style={{ borderBottom: "1px solid #ccc", padding: "6px 4px", fontWeight: 600 }}>{r.domain}</td>
                <td style={{ borderBottom: "1px solid #ccc", padding: "6px 4px", whiteSpace: "nowrap" }}>{r.value}</td>
                <td style={{ borderBottom: "1px solid #ccc", padding: "6px 4px" }}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {radar.length >= 3 && (
          <div style={{ display: "flex", justifyContent: "center", margin: "14px 0" }}>
            <div style={{ width: 300 }}><RadarChart points={radar} size={300} /></div>
          </div>
        )}
        <h2 style={{ fontSize: 14, margin: "12px 0 4px" }}>{d.method}</h2>
        <ul style={{ margin: 0, paddingLeft: 16, color: "#333" }}>
          {methods.map((m) => <li key={m} style={{ marginBottom: 3 }}>{m}</li>)}
        </ul>
        <p style={{ marginTop: 12, fontSize: 10, color: "#555" }}>{d.radarNote} {d.disclaimer}</p>
      </div>
    </div>
  );
}
