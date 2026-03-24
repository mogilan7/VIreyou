"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, RefreshCw, AlertTriangle } from "lucide-react";
import KnowledgeCard, { Recommendation } from "./KnowledgeCard";

interface ContextualSidebarProps {
    clientId: string;
}

export default function ContextualSidebar({ clientId }: ContextualSidebarProps) {
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSuggestions = async () => {
        if (!clientId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/v1/diagnostics/suggest-labs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: clientId })
            });
            const data = await res.json();
            if (data.success) {
                setRecommendations(data.data);
            } else {
                setError(data.error || "Failed to load recommendations");
            }
        } catch (err: any) {
            setError(err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSuggestions();
    }, [clientId]);

    if (!clientId) return null;

    return (
        <div className="w-full xl:w-96 flex flex-col gap-6 bg-[#FCFAF7] border border-brand-sage/40 rounded-3xl p-6 shadow-sm max-h-[calc(100vh-200px)] overflow-y-auto relative">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-brand-sage/20 pb-4">
                <div className="flex items-center gap-2">
                    <Sparkles size={20} className="text-amber-500 fill-amber-300/30" />
                    <h3 className="font-serif text-lg text-brand-text font-bold">Интеллектуальные подсказки</h3>
                </div>
                <button 
                    onClick={fetchSuggestions} 
                    disabled={loading}
                    className="p-1.5 hover:bg-white rounded-lg border border-brand-sage/20 shadow-sm transition-colors text-brand-gray/60 hover:text-brand-leaf disabled:opacity-50"
                >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Content States */}
            {loading && recommendations.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-brand-gray/60">
                    <RefreshCw size={24} className="animate-spin text-brand-leaf" />
                    <span className="text-xs font-medium">Анализ базы знаний...</span>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs font-bold text-red-800">Ошибка анализа</p>
                        <p className="text-[10px] text-red-600 mt-1">{error}</p>
                    </div>
                </div>
            )}

            {!loading && recommendations.length === 0 && !error && (
                <div className="text-center py-10 text-brand-gray/40 text-xs italic">
                    Для текущего состояния нет активных триггеров.
                </div>
            )}

            {/* List of Cards */}
            <div className="space-y-4">
                {recommendations.map((rec, index) => (
                    <KnowledgeCard 
                        key={`${rec.contextTag}-${index}`} 
                        recommendation={rec} 
                        onAddTest={(test) => {
                            console.log("Add test clicked:", test);
                            // Integrate with LabOrderTable via window event or callback if nested
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
