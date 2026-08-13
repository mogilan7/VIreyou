const fs = require('fs');
const file = 'src/components/dashboard/LifestyleDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Import ComposedChart, CartesianGrid, Line, Legend
content = content.replace(
  `Tooltip, Cell, PieChart, Pie, AreaChart, Area\n} from 'recharts';`,
  `Tooltip, Cell, PieChart, Pie, AreaChart, Area, ComposedChart, Line, CartesianGrid, Legend\n} from 'recharts';`
);

// 2. Add activeChart state
content = content.replace(
  `const [isDarkMode, setIsDarkMode] = useState(false);`,
  `const [isDarkMode, setIsDarkMode] = useState(false);\n  const [activeChart, setActiveChart] = useState<'hrv' | 'rhr' | 'none'>('none');`
);

// 3. Make HRV and RHR blocks clickable
content = content.replace(
  `<div className="flex justify-between items-center px-1 sm:px-2 py-2 sm:py-3 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl sm:rounded-2xl mt-auto">
              <div className="text-center flex-1 min-w-0">`,
  `<div className="flex justify-between items-center px-1 sm:px-2 py-2 sm:py-3 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl sm:rounded-2xl mt-auto">
              <div 
                className={\`text-center flex-1 min-w-0 cursor-pointer p-1 rounded-lg transition-colors \${activeChart === 'hrv' ? 'bg-indigo-100 dark:bg-indigo-800/50' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}\`}
                onClick={() => setActiveChart(activeChart === 'hrv' ? 'none' : 'hrv')}
              >`
);

content = content.replace(
  `<div className="text-center flex-1 min-w-0">
                <p className="text-[8px] sm:text-[10px] text-indigo-400 uppercase tracking-tight font-bold truncate">{t('restingHr')}</p>`,
  `<div 
                className={\`text-center flex-1 min-w-0 cursor-pointer p-1 rounded-lg transition-colors \${activeChart === 'rhr' ? 'bg-indigo-100 dark:bg-indigo-800/50' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}\`}
                onClick={() => setActiveChart(activeChart === 'rhr' ? 'none' : 'rhr')}
              >
                <p className="text-[8px] sm:text-[10px] text-indigo-400 uppercase tracking-tight font-bold truncate">{t('restingHr')}</p>`
);

// 4. Add the Chart component right after the sleep card
const chartBlock = `
          {/* Тренд ВСР / Пульса покоя (Combo Chart) */}
          {activeChart !== 'none' && (
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold dark:text-slate-200">
                  {activeChart === 'hrv' ? 'Тренд ВСР (HRV)' : 'Тренд пульса покоя'}
                </h3>
                <button onClick={() => setActiveChart('none')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  ✕
                </button>
              </div>
              <div className="h-48 sm:h-56 w-full -ml-4 sm:-ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={activeChart === 'hrv' ? data.hrvTrend : data.rhrTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 10 }}
                      dy={10}
                    />
                    <YAxis 
                      domain={['dataMin - 5', 'dataMax + 5']}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 10 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                        borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                      itemStyle={{ color: isDarkMode ? '#f1f5f9' : '#0f172a' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="value" name={activeChart === 'hrv' ? 'ВСР за день' : 'Пульс за день'} radius={[4, 4, 0, 0]} barSize={20}>
                      {
                        (activeChart === 'hrv' ? data.hrvTrend : data.rhrTrend)?.map((entry: any, index: number) => {
                          let color = '#3b82f6';
                          if (activeChart === 'hrv') {
                            color = entry.value >= entry.sma ? '#10b981' : '#ef4444';
                          } else {
                            color = entry.value <= entry.sma ? '#10b981' : '#ef4444';
                          }
                          return <Cell key={\`cell-\${index}\`} fill={color} />;
                        })
                      }
                    </Bar>
                    <Line 
                      type="monotone" 
                      dataKey="sma" 
                      name="Тренд (7 дней)" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
`;

content = content.replace(
  `          {/* 3. Nutrition Card */}`,
  chartBlock + `\n          {/* 3. Nutrition Card */}`
);

fs.writeFileSync(file, content);
console.log("Patched LifestyleDashboard.tsx with Recharts");
