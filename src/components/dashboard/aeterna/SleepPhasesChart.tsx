"use client";

import React from 'react';
import { BarChart, Bar, ResponsiveContainer, Tooltip } from 'recharts';
import { useDashboardTheme } from '../ThemeContext';

const data = [
    { name: 'Mon', deep: 1.5, rem: 2, light: 4 },
    { name: 'Tue', deep: 2, rem: 1.8, light: 4.2 },
    { name: 'Wed', deep: 1.8, rem: 2.1, light: 3.8 },
    { name: 'Thu', deep: 2.2, rem: 1.9, light: 4.5 },
    { name: 'Fri', deep: 2.5, rem: 2.2, light: 3.9 },
    { name: 'Sat', deep: 2.1, rem: 2.4, light: 4.2 },
    { name: 'Sun', deep: 2.3, rem: 2.1, light: 4.1 },
];

export default function SleepPhasesChart() {
    const { theme } = useDashboardTheme();
    const isDark = theme === 'dark';

    const deepColor = isDark ? '#134e4a' : '#244131'; // teal-900 vs brand-forest
    const remColor = isDark ? '#2dd4bf' : '#60B76F'; // teal-400 vs brand-leaf
    const lightColor = isDark ? '#1e293b' : '#DDE5E0'; // slate-800 vs brand-sage
    const tooltipBg = isDark ? '#1e293b' : '#FFFFFF';
    const tooltipBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    const tooltipText = isDark ? '#f8fafc' : '#2D2D2D';

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
