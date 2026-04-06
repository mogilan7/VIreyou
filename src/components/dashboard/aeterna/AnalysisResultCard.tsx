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
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AnalysisResultCardProps {
  content: string;
  isNew?: boolean;
}

export default function AnalysisResultCard({ content, isNew }: AnalysisResultCardProps) {
  const t = useTranslations("Dashboard.Analysis");

  // Logic for manual parsing is now handled by ReactMarkdown for robustness

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

      <div className="prose prose-xs sm:prose-sm dark:prose-invert max-w-none dark:text-slate-200 text-slate-800 overflow-x-auto selection:bg-brand-mint/20">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
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
