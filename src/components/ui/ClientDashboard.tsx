'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
    { month: 'Jan', biomarkerScore: 65 },
    { month: 'Feb', biomarkerScore: 68 },
    { month: 'Mar', biomarkerScore: 74 },
    { month: 'Apr', biomarkerScore: 82 },
    { month: 'May', biomarkerScore: 88 },
    { month: 'Jun', biomarkerScore: 92 },
];

export function ClientDashboard() {
    const longevityScore = 95;

    return (
        <section className="py-16 bg-white w-full">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
                <h2 className="text-3xl font-bold text-brand-blue mb-8">Your Longevity Dashboard</h2>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Longevity Score Widget */}
                    <div className="lg:col-span-1 bg-brand-bg rounded-2xl p-8 shadow-lg flex flex-col items-center justify-center border border-gray-100">
                        <h3 className="text-xl font-semibold text-gray-700 mb-6 relative z-10">Longevity Score</h3>

                        <div className="relative w-48 h-48">
                            {/* Circular Gauge SVG */}
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle
                                    cx="50" cy="50" r="40"
                                    fill="transparent"
                                    stroke="#E0F2F1"
                                    strokeWidth="12"
                                />
                                <circle
                                    cx="50" cy="50" r="40"
                                    fill="transparent"
                                    stroke="#00796B"
                                    strokeWidth="12"
                                    strokeDasharray={`${2 * Math.PI * 40}`}
                                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - longevityScore / 100)}`}
                                    className="transition-all duration-1000 ease-out"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-4xl font-extrabold text-brand-blue">{longevityScore}%</span>
                                <span className="text-xs text-brand-mint-dark font-medium mt-1">Optimal</span>
                            </div>
                        </div>

                        <p className="text-center mt-6 text-sm text-gray-500">
                            Biologically younger by <span className="font-bold text-green-600">-5 Years</span>
                        </p>
                    </div>

                    {/* Biomarker Timeline Widget */}
                    <div className="lg:col-span-2 bg-brand-bg rounded-2xl p-8 shadow-lg border border-gray-100 flex flex-col">
                        <h3 className="text-xl font-semibold text-gray-700 mb-6">Biomarker Progress Timeline</h3>
                        <div className="flex-1 w-full h-64 min-h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                    <XAxis dataKey="month" stroke="#6b7280" tick={{ fill: '#6b7280' }} axisLine={false} tickLine={false} />
                                    <YAxis stroke="#6b7280" tick={{ fill: '#6b7280' }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="biomarkerScore"
                                        stroke="#1A2B3C"
                                        strokeWidth={4}
                                        dot={{ fill: '#00796B', strokeWidth: 2, r: 6 }}
                                        activeDot={{ r: 8, fill: '#00796B' }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
