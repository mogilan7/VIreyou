"use client";

import React, { useMemo } from 'react';
import { useDashboardTheme } from '../ThemeContext';

export default function HabitHeatmap() {
    const { theme } = useDashboardTheme();
    const isDark = theme === 'dark';

    // Generate static mockup data mimicking the original script
    const cells = useMemo(() => {
        const arr = [];
        for (let i = 0; i < 35; i++) {
            const isActive = i < 30 && Math.random() > 0.3;
            arr.push(isActive);
        }
        return arr;
    }, []);

    return (
        <div className="grid grid-cols-7 gap-1">
            {cells.map((isActive, i) => (
                <div
                    key={i}
                    className={`aspect-square rounded-[4px] transition-colors duration-300 ${isActive
                        ? (isDark ? 'bg-teal-400 opacity-80' : 'bg-brand-leaf opacity-90')
                        : (isDark ? 'bg-white/5' : 'bg-brand-sage/20')
                        }`}
                />
            ))}
        </div>
    );
}
