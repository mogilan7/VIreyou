"use client";

import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useDashboardTheme } from '../ThemeContext';

const defaultData = [
    { subject: 'ССС', A: 46, fullMark: 65 },
    { subject: 'Мышцы', A: 35, fullMark: 65 },
    { subject: 'Реакция', A: 35, fullMark: 65 },
    { subject: 'Коорд.', A: 30, fullMark: 65 },
    { subject: 'Вестиб.', A: 60, fullMark: 65 },
    { subject: 'Кожа', A: 35, fullMark: 65 },
    { subject: 'Суставы', A: 37, fullMark: 65 },
];

export default function BioAgeRadar({ data }: { data?: any[] }) {
    const renderData = data && data.length > 0 ? data : defaultData;
    const { theme } = useDashboardTheme();
    const isDark = theme === 'dark';

    const accentColor = isDark ? '#2dd4bf' : '#60B76F';
    const tickColor = isDark ? '#64748b' : '#6B7280';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const tooltipBg = isDark ? '#1e293b' : '#FFFFFF';
    const tooltipBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

    return (
        <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={renderData}>
                <PolarGrid stroke={gridColor} />
                <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: tickColor, fontSize: 10 }}
                />
                <PolarRadiusAxis
                    angle={30}
                    domain={[0, 65]}
                    tick={false}
                    axisLine={false}
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
                <Radar
                    name="System Age"
                    dataKey="A"
                    stroke={accentColor}
                    strokeWidth={2}
                    fill={accentColor}
                    fillOpacity={0.2}
                />
            </RadarChart>
        </ResponsiveContainer>
    );
}
