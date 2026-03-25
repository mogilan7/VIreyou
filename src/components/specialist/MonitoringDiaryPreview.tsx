"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function MonitoringDiaryPreview({ 
    logs, 
    periodDays, 
    initialSelectedDates 
}: { 
    logs: any, 
    periodDays: number, 
    initialSelectedDates: string[] 
}) {
    // Generate the array of dates to show
    const dates = Array.from({ length: periodDays }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (periodDays - 1) + i);
        return d;
    });

    const defaultSelected = dates.map(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    
    // If we have initial dates, use those, else all new dates in the period
    const [selectedDates, setSelectedDates] = useState<Set<string>>(
        new Set(initialSelectedDates.length > 0 ? initialSelectedDates : defaultSelected)
    );

    const toggleDate = (dateStr: string) => {
        const newSet = new Set(selectedDates);
        if (newSet.has(dateStr)) newSet.delete(dateStr);
        else newSet.add(dateStr);
        setSelectedDates(newSet);
    };

    const diaryScrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    const handleScroll = () => {
        if (!diaryScrollRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = diaryScrollRef.current;
        setCanScrollLeft(scrollLeft > 10);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    };

    useEffect(() => {
        const container = diaryScrollRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
            handleScroll();
            container.scrollLeft = container.scrollWidth;
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, [periodDays]);

    const scrollDiary = (direction: 'left' | 'right') => {
        if (!diaryScrollRef.current) return;
        const container = diaryScrollRef.current;
        const scrollAmount = container.clientWidth;
        container.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    };

    return (
        <div className="w-full bg-[#FAFAFA] border border-brand-sage/20 rounded-xl p-4">
            <input type="hidden" name="selectedDates" value={Array.from(selectedDates).join(',')} />
            
            <div className="flex items-center justify-between gap-2 border-b border-brand-sage/20 pb-3 mb-3">
                <div>
                    <h4 className="text-sm font-bold text-brand-text mb-0.5">Дневник мониторинга ({periodDays} дней)</h4>
                    <p className="text-[10px] opacity-60">Отметьте дни для включения в отчет</p>
                </div>
                <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => scrollDiary('left')} disabled={!canScrollLeft} className={`p-1.5 rounded-full bg-white hover:bg-slate-100 transition-colors shadow-sm border border-brand-sage/20 ${!canScrollLeft ? 'opacity-30 cursor-not-allowed' : ''}`}><ChevronLeft size={14} /></button>
                    <button type="button" onClick={() => scrollDiary('right')} disabled={!canScrollRight} className={`p-1.5 rounded-full bg-white hover:bg-slate-100 transition-colors shadow-sm border border-brand-sage/20 ${!canScrollRight ? 'opacity-30 cursor-not-allowed' : ''}`}><ChevronRight size={14} /></button>
                </div>
            </div>
            
            <div ref={diaryScrollRef} className="grid grid-flow-col items-start gap-3 auto-cols-[calc((100%-48px)/5)] md:auto-cols-[calc((100%-84px)/7)] overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory w-full">
                {dates.map((dayDate, i) => {
                    const formattedDate = dayDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
                    const dateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
                    const isSelected = selectedDates.has(dateStr);
                    
                    const isSameDay = (log: any) => {
                        const d = new Date(log.date || log.created_at || log);
                        return d.getDate() === dayDate.getDate() && d.getMonth() === dayDate.getMonth() && d.getFullYear() === dayDate.getFullYear();
                    };
                    
                    const hasNutrition = (logs.nutrition || []).some(isSameDay);
                    const hasSleep = (logs.sleep || []).some(isSameDay);
                    const hasActivity = (logs.activity || []).some(isSameDay);
                    const hasHabits = (logs.habit || []).some(isSameDay) || (logs.hydration || []).some(isSameDay);
                    
                    const count = [hasNutrition, hasSleep, hasActivity, hasHabits].filter(Boolean).length;
                    
                    let bgColor = "bg-white text-slate-400 border-brand-sage/30";
                    if (count >= 3) bgColor = "bg-green-500 text-white border-green-600";
                    else if (count >= 1) bgColor = "bg-amber-400 text-white border-amber-500";
                    
                    return (
                        <div key={i} className="flex flex-col items-center gap-1.5 min-w-0 snap-start relative group cursor-pointer" onClick={() => toggleDate(dateStr)}>
                            <div className={`w-12 h-12 rounded-full flex flex-col items-center justify-center font-bold text-xs ${bgColor} shadow-sm border ${isSelected ? 'ring-2 ring-brand-leaf ring-offset-2' : 'opacity-50 hover:opacity-80'}`}>
                                Д{i+1}
                            </div>
                            
                            <div className="absolute -top-1 -right-1 z-10 bg-white rounded-md shadow-sm">
                                <input type="checkbox" checked={isSelected} readOnly className="w-3.5 h-3.5 accent-brand-leaf cursor-pointer pointer-events-none" />
                            </div>

                            <span className={`text-[9px] ${isSelected ? 'font-bold text-brand-text' : 'opacity-50'}`}>{formattedDate}</span>
                            <div className={`flex gap-0.5 ${!isSelected ? 'opacity-40' : ''}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${hasNutrition ? 'bg-green-400' : 'bg-slate-200'}`} />
                                <span className={`w-1.5 h-1.5 rounded-full ${hasSleep ? 'bg-green-400' : 'bg-slate-200'}`} />
                                <span className={`w-1.5 h-1.5 rounded-full ${hasActivity ? 'bg-green-400' : 'bg-slate-200'}`} />
                                <span className={`w-1.5 h-1.5 rounded-full ${hasHabits ? 'bg-green-400' : 'bg-slate-200'}`} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
