"use client";

import React from "react";
import { Lightbulb, BookOpen, AlertCircle, CheckCircle } from "lucide-react";

export interface TestSuggested {
    testKey: string;
    testName: string;
    reason: string;
}

export interface Recommendation {
    contextTag: string;
    title: string;
    description: string;
    linkToModule?: string;
    testsSuggested: TestSuggested[];
    justificationQuote?: string;
}

interface KnowledgeCardProps {
    recommendation: Recommendation;
    onAddTest?: (test: TestSuggested) => void;
}

export default function KnowledgeCard({ recommendation, onAddTest }: KnowledgeCardProps) {
    const { title, description, contextTag, linkToModule, testsSuggested, justificationQuote } = recommendation;

    const getTagStyles = (tag: string) => {
        if (tag.toLowerCase().includes("sarcopenia")) return "bg-red-50 text-red-700 border-red-200/50";
        if (tag.toLowerCase().includes("deficit")) return "bg-orange-50 text-orange-700 border-orange-200/50";
        return "bg-brand-sage/20 text-brand-leaf border-brand-sage/30";
    };

    return (
        <div className="bg-white border border-brand-sage/40 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            {/* Tag */}
            <div className="flex justify-between items-center mb-3">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${getTagStyles(contextTag)}`}>
                    {contextTag}
                </span>
                {linkToModule && (
                    <span className="text-[10px] text-brand-gray/60 flex items-center gap-1">
                        <BookOpen size={12} /> {linkToModule}
                    </span>
                )}
            </div>

            {/* Title & Description */}
            <h3 className="font-serif text-lg text-brand-text font-bold mb-1.5 flex items-center gap-2">
                <Lightbulb size={18} className="text-amber-500" />
                {title}
            </h3>
            <p className="text-xs text-brand-gray mb-4 leading-relaxed">{description}</p>

            {/* Suggested Tests */}
            {testsSuggested && testsSuggested.length > 0 && (
                <div className="mb-4 bg-[#FAFAFA] rounded-xl p-3.5 border border-brand-sage/30">
                    <h4 className="text-[10px] font-bold text-brand-gray uppercase tracking-widest mb-2 flex items-center gap-1">
                        <CheckCircle size={12} className="text-brand-leaf" /> Рекомендуемые тесты
                    </h4>
                    <ul className="space-y-2">
                        {testsSuggested.map((test) => (
                            <li key={test.testKey} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm text-xs">
                                <div>
                                    <span className="font-bold text-brand-text">{test.testName}</span>
                                    <p className="text-[10px] text-brand-gray mt-0.5">{test.reason}</p>
                                </div>
                                {onAddTest && (
                                    <button 
                                        onClick={() => onAddTest(test)}
                                        className="bg-brand-sage/20 hover:bg-brand-leaf hover:text-white text-brand-leaf text-xs font-bold px-2.5 py-1 rounded-lg transition-colors"
                                    >
                                        + Добавить
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Justification Quote */}
            {justificationQuote && (
                <details className="text-[11px] text-brand-gray border-t border-brand-sage/20 pt-2 cursor-pointer">
                    <summary className="font-bold text-brand-leaf hover:underline flex items-center gap-1">
                        <AlertCircle size={12} /> Обоснование базы знаний
                    </summary>
                    <div className="mt-1.5 p-2 bg-slate-50 rounded-lg text-[10px] italic text-brand-gray bg-opacity-80">
                        {justificationQuote}
                    </div>
                </details>
            )}
        </div>
    );
}
