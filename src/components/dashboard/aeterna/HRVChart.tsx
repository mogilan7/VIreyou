"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { useDashboardTheme } from '../ThemeContext';

const data = [
    { day: 'Пн', value: 62 },
    { day: 'Вт', value: 68 },
    { day: 'Ср', value: 65 },
    { day: 'Чт', value: 78 },
    { day: 'Пт', value: 82 },
    { day: 'Сб', value: 75 },
    { day: 'Вс', value: 85 },
];

export default function HRVChart() {
    const { theme } = useDashboardTheme();
    const isDark = theme === 'dark';

    const accentColor = isDark ? '#2dd4bf' : '#60B76F'; // teal-400 vs brand-leaf
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const tickColor = isDark ? '#64748b' : '#6B7280'; // slate-500 vs brand-gray
    const tooltipBg = isDark ? '#1e293b' : '#FFFFFF';
    const tooltipBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: tickColor, fontSize: 10 }}
                    dy={10}
                />
                <YAxis
                    domain={[50, 'auto']}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: tickColor, fontSize: 10 }}
                    dx={-10}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: tooltipBg,
                        border: `1px solid ${tooltipBorder}`,
                        borderRadius: '12px',
                        fontSize: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                    itemStyle={{ color: accentColor }}
                />
                <Line
                    type="monotone"
                    dataKey="value"
                    stroke={accentColor}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: accentColor, stroke: isDark ? '#0f172a' : '#f7f5f0', strokeWidth: 2 }}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}
