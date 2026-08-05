"use client";

import React from 'react';
import { BarChart, Bar, ResponsiveContainer, Tooltip } from 'recharts';
import { useDashboardTheme } from '../ThemeContext';

import { format, subDays } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';

interface SleepPhasesChartProps {
    sleepLogs?: any[];
}

export default function SleepPhasesChart({ sleepLogs = [] }: SleepPhasesChartProps) {
    const { theme } = useDashboardTheme();
    const isDark = theme === 'dark';

    const deepColor = isDark ? '#134e4a' : '#244131'; // teal-900 vs brand-forest
    const remColor = isDark ? '#2dd4bf' : '#60B76F'; // teal-400 vs brand-leaf
    const lightColor = isDark ? '#1e293b' : '#DDE5E0'; // slate-800 vs brand-sage
    const tooltipBg = isDark ? '#1e293b' : '#FFFFFF';
    const tooltipBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    const tooltipText = isDark ? '#f8fafc' : '#2D2D2D';

    // Group logs by day (last 7 days)
    const today = new Date();
    const data = Array.from({ length: 7 }).map((_, i) => {
        const d = subDays(today, 6 - i);
        const dayStr = format(d, 'yyyy-MM-dd');
        
        // Find logs for this day
        const logsForDay = sleepLogs.filter(log => {
            if (!log.date) return false;
            return format(new Date(log.date), 'yyyy-MM-dd') === dayStr;
        });

        // Sum up the phases for the day (if multiple entries, though usually one per day)
        let deep = 0;
        let rem = 0;
        let light = 0;
        
        logsForDay.forEach(log => {
            if (log.deep_hrs) deep += log.deep_hrs;
            if (log.rem_hrs) rem += log.rem_hrs;
            if (log.light_hrs) light += log.light_hrs;
        });

        return {
            name: format(d, 'E', { locale: ru }), // e.g. "Пн", "Вт"
            deep: Number(deep.toFixed(2)),
            rem: Number(rem.toFixed(2)),
            light: Number(light.toFixed(2)),
        };
    });

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart
                data={data}
                layout="horizontal"
                barSize={12}
            >
                <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{
                        backgroundColor: tooltipBg,
                        border: `1px solid ${tooltipBorder}`,
                        borderRadius: '12px',
                        zIndex: 100,
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                    itemStyle={{ color: tooltipText, fontSize: '12px' }}
                    labelStyle={{ display: 'none' }}
                />
                <Bar dataKey="deep" stackId="a" fill={deepColor} radius={[0, 0, 4, 4]} />
                <Bar dataKey="rem" stackId="a" fill={remColor} />
                <Bar dataKey="light" stackId="a" fill={lightColor} radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}
