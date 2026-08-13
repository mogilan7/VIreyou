const fs = require('fs');
const file = 'src/components/dashboard/LifestyleDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

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
  `        {/* --- Detailed Nutrition --- */}`,
  chartBlock + `\n        {/* --- Detailed Nutrition --- */}`
);

fs.writeFileSync(file, content);
console.log("Injected chart block!");
