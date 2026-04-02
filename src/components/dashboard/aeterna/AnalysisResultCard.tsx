"use client";

import React from "react";
import { 
  ClipboardCheck, 
  FlaskConical, 
  Lightbulb, 
  Search, 
  AlertCircle,
  FileText,
  Dna,
  Activity
} from "lucide-react";
import { useTranslations } from "next-intl";

interface AnalysisResultCardProps {
  content: string;
  isNew?: boolean;
}

export default function AnalysisResultCard({ content, isNew }: AnalysisResultCardProps) {
  const t = useTranslations("Dashboard.Analysis");

  // Basic markdown-like parsing for the structure defined in the prompt
  const sections = content.split("\n\n").filter(Boolean);
  
  const parseSection = (title: string, icon: React.ReactNode) => {
    const sectionIndex = sections.findIndex(s => s.toLowerCase().includes(title.toLowerCase()));
    if (sectionIndex === -1) return null;
    
    // Get text after the title line
    const sectionText = sections[sectionIndex].split("\n").slice(1).join("\n").trim();
    if (!sectionText) return null;

    return (
      <div className="mb-8 last:mb-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-brand-sage/20 dark:bg-slate-700/50 rounded-xl text-brand-forest dark:text-brand-mint">
            {icon}
          </div>
          <h5 className="font-bold text-base dark:text-slate-100">{title}</h5>
        </div>
        <div className="pl-11 space-y-3">
          {sectionText.split("\n").map((line, i) => {
            if (line.startsWith("-") || line.startsWith("*")) {
              return (
                <div key={i} className="flex gap-3 text-sm opacity-90 leading-relaxed mb-2">
                  <div className="w-1.5 h-1.5 bg-brand-mint rounded-full mt-1.5 flex-shrink-0" />
                  <p>{line.replace(/^[*-]\s*/, "").trim()}</p>
                </div>
              );
            }
            if (line.includes(":")) {
                const [label, ...val] = line.split(":");
                return (
                    <div key={i} className="text-sm mb-3">
                        <span className="font-bold text-brand-forest dark:text-brand-mint/80">{label.trim()}:</span>
                        <span className="ml-2 opacity-90">{val.join(":").trim()}</span>
                    </div>
                );
            }
            return (
              <p key={i} className="text-sm opacity-80 leading-relaxed mb-2">
                {line.trim()}
              </p>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`relative overflow-hidden rounded-3xl border dark:border-white/5 border-brand-sage/20 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md p-6 md:p-8 shadow-xl ${isNew ? 'ring-2 ring-brand-mint/30' : ''}`}>
      {isNew && (
        <div className="absolute top-4 right-4 bg-brand-mint/20 text-brand-forest text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest animate-pulse">
          New Analysis
        </div>
      )}
      
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-brand-sage/10">
        <div className="p-4 bg-gradient-to-br from-brand-forest to-brand-forest-dark rounded-2xl text-white shadow-lg shadow-brand-forest/20">
          <Dna className="w-8 h-8" />
        </div>
        <div>
          <h4 className="text-xl font-bold dark:text-slate-100">{t('title')}</h4>
          <p className="text-xs opacity-60">AI Diagnostic Interpretation & Lab Recommendations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {parseSection(t('interpretation'), <ClipboardCheck className="w-5 h-5" />)}
        
        <div className="h-px bg-brand-sage/10 my-4" />
        
        {parseSection(t('labTests'), <FlaskConical className="w-5 h-5" />)}
        
        <div className="h-px bg-brand-sage/10 my-4" />
        
        {parseSection(t('justification'), <Lightbulb className="w-5 h-5" />)}
        
        <div className="h-px bg-brand-sage/10 my-4" />
        
        {parseSection(t('additional'), <Search className="w-5 h-5" />)}
      </div>

      <div className="mt-8 pt-6 border-t border-brand-sage/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium italic">
          <AlertCircle className="w-3 h-3" />
          Based on provided clinical protocols and your current health data
        </div>
        <div className="text-[10px] opacity-40">
            Systemic Longevity Panel v2.0
        </div>
      </div>
    </div>
  );
}
