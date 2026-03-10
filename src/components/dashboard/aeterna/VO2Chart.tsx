"use client";

import React from 'react';
import { Area, ResponsiveContainer, Tooltip, AreaChart, XAxis, YAxis } from 'recharts';
import { useDashboardTheme } from '../ThemeContext';

const data = [
    { month: 'Jan', value: 48 },
    { month: 'Feb', value: 49.2 },
    { month: 'Mar', value: 48.8 },
    { month: 'Apr', value: 50.5 },
    { month: 'May', value: 51.2 },
    { month: 'Jun', value: 52.4 },
];

export default function VO2Chart() {
    const { theme } = useDashboardTheme();
    const isDark = theme === 'dark';

    const accentColor = isDark ? '#2dd4bf' : '#60B76F';
    const tooltipBg = isDark ? '#1e293b' : '#FFFFFF';
    const tooltipBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
                <defs>
                    <linearGradient id="colorVo2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={accentColor} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <Tooltip
                    contentStyle={{
                        backgroundColor: tooltipBg,
                        border: `1px solid ${tooltipBorder}`,
                        borderRadius: '12px',
                        fontSize: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                    itemStyle={{ color: accentColor }}
                    cursor={{ stroke: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', strokeWidth: 1 }}
                />
                <Area
                    type="monotone"
                    dataKey="value"
                    stroke={accentColor}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorVo2)"
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
