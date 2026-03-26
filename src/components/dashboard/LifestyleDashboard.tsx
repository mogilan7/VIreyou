'use client';

import React, { useState } from 'react';
import { 
  Droplets, Moon, Activity, Utensils, 
  ChevronRight, Sparkles, CheckCircle2,
  TrendingUp, Plus, ChevronDown, Trash2, Wine, Cigarette,
  Calendar, User, Settings, Sun, Wind, Info, AlertCircle, MapPin
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  Tooltip, Cell, PieChart, Pie, AreaChart, Area
} from 'recharts';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Sidebar from "@/components/dashboard/Sidebar";
import DeleteLogButton from '@/components/dashboard/DeleteLogButton';
import { useTranslations } from 'next-intl';

const MACRO_COLORS = {
  proteins: '#60B76F',
  fats: '#F59E0B',
  carbs: '#3B82F6',
  fiber: '#8B5CF6'
};

const LifestyleDashboard = ({ 
  data, 
  userMetadata,
  userTz,
  deleteNutritionLog,
  fromStr,
  toStr,
  currentFromDate
}: { 
  data: any, 
  userMetadata: any,
  userTz: string,
  deleteNutritionLog: any,
  fromStr?: string,
  toStr?: string,
  currentFromDate: Date
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.locale as string) || 'ru';
  const t = useTranslations('Lifestyle');
  const [isDarkMode, setIsDarkMode] = useState(false);

  const { 
    nutritionToday, activityToday, sleepToday, hydrationToday, habitsToday,
    nutritionWeek, activityWeek, habitsWeek, sleepWeek, hydrationWeek,
    habitsMonth,
    totalWater, lastSleep, lastActivity, totalCalories, totalSteps,
    nutritionNorms, nutrientNames
  } = data;

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const updateRange = (range: string) => {
    const now = new Date();
    // Use userTz localized date for "Today"
    const tzNow = new Date(now.toLocaleString('en-US', { timeZone: userTz }));
    
    let from = '';
    let to = '';

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    if (range === t('today')) {
        from = formatDate(tzNow);
        to = from;
    } else if (range === t('yesterday')) {
        const yesterday = new Date(tzNow.getTime() - 86400000);
        from = formatDate(yesterday);
        to = from;
    } else if (range === t('week')) {
        const weekAgo = new Date(tzNow.getTime() - 7 * 86400000);
        from = formatDate(weekAgo);
        to = formatDate(tzNow);
    } else if (range === t('month')) {
        const monthAgo = new Date(tzNow.getTime() - 30 * 86400000);
        from = formatDate(monthAgo);
        to = formatDate(tzNow);
    }

    router.push(`?from=${from}&to=${to}`);
  };

  const isToday = !fromStr || fromStr === new Date().toISOString().split('T')[0];
  const isYesterday = fromStr === new Date(new Date().getTime() - 86400000).toISOString().split('T')[0];
  const isWeek = fromStr && toStr && (new Date(toStr).getTime() - new Date(fromStr).getTime() > 5 * 86400000 && new Date(toStr).getTime() - new Date(fromStr).getTime() < 10 * 86400000);
  const isMonth = fromStr && toStr && (new Date(toStr).getTime() - new Date(fromStr).getTime() > 20 * 86400000);

  const selectedRange = (fromStr === toStr || (!fromStr && !toStr)) ? 
    (isToday ? t('today') : isYesterday ? t('yesterday') : t('date')) : 
    (isMonth ? t('month') : isWeek ? t('week') : t('period'));

  const [optimisticRange, setOptimisticRange] = useState<string | null>(null);
  const currentRange = optimisticRange || selectedRange;

  // Format activity trend for last 7 days
  const activityTrend = activityWeek.slice(0, 7).reverse().map((a: any) => ({
    day: new Date(a.created_at).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'short', timeZone: userTz }),
    steps: a.steps || 0
  }));

  // Format sleep data for chart
  const sleepChartData = [
    { name: t('deep'), value: lastSleep?.deep_hrs || 0, color: '#1E3A8A' },
    { name: t('rem'), value: lastSleep?.rem_hrs || 0, color: '#3B82F6' },
    { name: t('light'), value: lastSleep?.light_hrs || ((lastSleep?.duration_hrs || 0) - (lastSleep?.deep_hrs || 0) - (lastSleep?.rem_hrs || 0)), color: '#93C5FD' },
  ].filter(d => d.value > 0);

  // Nutrition Pie Data
  const totalMacros = {
    protein: nutritionToday.reduce((s: number, n: any) => s + Number(n.protein || 0), 0),
    fat: nutritionToday.reduce((s: number, n: any) => s + Number(n.fat || 0), 0),
    carbs: nutritionToday.reduce((s: number, n: any) => s + Number(n.carbs || 0), 0),
  };
  const nutritionPieData = [
    { name: t('proteins'), value: totalMacros.protein },
    { name: t('fats'), value: totalMacros.fat },
    { name: t('carbs'), value: totalMacros.carbs },
  ].filter(d => d.value > 0);

  // Habit completion (last 7 days - as requested)
  const habitDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentFromDate.getTime() - (6 - i) * 86400000);
    const dayStr = d.toISOString().split('T')[0];
    const daysHabits = habitsMonth.filter((h: any) => 
      new Date(h.created_at).toISOString().split('T')[0] === dayStr
    );
    
    let type = 'clean';
    const holdsAlcohol = daysHabits.some((h: any) => h.habit_key?.toLowerCase().includes('алкоголь') || h.habit_key?.toLowerCase().includes('пиво'));
    const holdsSmoking = daysHabits.some((h: any) => h.habit_key?.toLowerCase().includes('курение') || h.habit_key?.toLowerCase().includes('сигарет'));

    if (holdsAlcohol && holdsSmoking) type = 'both';
    else if (holdsSmoking) type = 'smoking';
    else if (daysHabits.length > 0) type = 'alcohol'; // Any other breach is gray (Alcohol/General)

    return { day: dayStr, type };
  });

  const stabilityPct = Math.round((habitDays.filter(d => d.type === 'clean').length / 7) * 100);
  
  const uniqueHabits = Array.from(new Set(habitsMonth.map((h: any) => h.habit_key?.toLowerCase()))) as (string | undefined)[];
  const hasAlcohol = uniqueHabits.some(h => h && (h.includes('алкоголь') || h.includes('пиво') || h.includes('alcohol') || h.includes('beer')));
  const hasSmoking = uniqueHabits.some(h => h && (h.includes('курение') || h.includes('сигарет') || h.includes('smoking') || h.includes('cigarette')));

  const dayNames = locale === 'ru' ? ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className={`min-h-screen flex w-full transition-colors duration-300 ${isDarkMode ? 'dark bg-[#0F172A] text-white' : 'bg-[#F7F5F0] text-[#2D2D2D]'} font-sans relative`}>
      <Sidebar role="client" profileName={userMetadata?.full_name || "Пользователь"} />

      <main className="flex-1 lg:ml-64 px-2 sm:px-4 md:px-8 pt-20 lg:pt-8 space-y-4 sm:space-y-6 md:space-y-8 pb-24 lg:pb-12 w-full max-w-[100vw] sm:max-w-7xl overflow-x-hidden min-w-0">
        
        {/* --- Header Section --- */}
        <section className="space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 sm:gap-6">
            <div className="space-y-1">
              <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">{t('title')}</h1>
              <p className="text-slate-500 dark:text-slate-400 flex items-center gap-2 text-xs sm:text-sm md:text-base pr-2">
                <CheckCircle2 className="w-4 h-4 text-[#60B76F] shrink-0" />
                <span className="leading-tight">{totalSteps > 8000 ? t('activeDay') : t('goodStart')}</span>
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="flex items-center justify-between gap-1 bg-white/50 dark:bg-slate-800/50 p-1 rounded-xl border border-white/20 backdrop-blur-sm overflow-x-auto scrollbar-hide w-full sm:w-auto shrink-0">
                {[t('today'), t('yesterday'), t('week'), t('month')].map((range) => (
                  <button
                    key={range}
                    onClick={() => {
                        setOptimisticRange(range);
                        updateRange(range);
                    }}
                    className={`px-2 sm:px-3 md:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs md:text-sm font-medium transition-all whitespace-nowrap flex-1 text-center ${
                      currentRange === range
                      ? 'bg-[#60B76F] text-white shadow-md shadow-[#60B76F]/20' 
                      : 'hover:bg-white/80 dark:hover:bg-slate-700'
                    } ${optimisticRange === range && optimisticRange !== selectedRange ? 'animate-pulse' : ''}`}
                  >
                    {range}
                  </button>
                ))}
              </div>
              
              <form action="" method="GET" className="flex items-center gap-1.5 bg-white/50 dark:bg-slate-800/50 p-1 rounded-xl border border-white/20 backdrop-blur-sm w-full sm:w-auto">
                 <input type="date" name="from" defaultValue={fromStr || formatDate(currentFromDate)} className="bg-transparent border-0 text-[10px] sm:text-xs p-1 dark:text-white w-full min-w-0 focus:ring-0" />
                 <span className="text-slate-400 text-xs shrink-0">-</span>
                 <input type="date" name="to" defaultValue={toStr || formatDate(new Date())} className="bg-transparent border-0 text-[10px] sm:text-xs p-1 dark:text-white w-full min-w-0 focus:ring-0" />
                 <button type="submit" className="bg-[#60B76F] text-white p-1.5 rounded-lg shrink-0"><ChevronRight size={14}/></button>
              </form>
            </div>
          </div>
        </section>

        {/* --- Summary Cards --- */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
          <SummaryCard 
            icon={<Droplets className="text-blue-500" />} 
            label={t('water')} 
            value={totalWater.toLocaleString()} 
            unit={t('ml')} 
            target="/ 2000"
            progress={(totalWater / 2000) * 100}
            color="bg-blue-500"
            history={hydrationWeek}
            userTz={userTz}
            locale={locale}
            t={t}
          />
          <SummaryCard 
            icon={<Moon className="text-indigo-500" />} 
            label={t('sleep')} 
            value={lastSleep ? Math.floor(lastSleep.duration_hrs).toString() : "0"} 
            unit={lastSleep ? `${t('hrs')} ${Math.round((lastSleep.duration_hrs % 1) * 60)}${t('min')}` : t('hrs')} 
            target={lastSleep?.deep_hrs ? `${t('deep')}: ${lastSleep.deep_hrs.toFixed(1)}${t('hrs')}` : `8${t('hrs')} ${t('sleepGoal')}`}
            progress={( (lastSleep?.duration_hrs || 0) / 8) * 100}
            color="bg-indigo-500"
            history={sleepWeek}
            userTz={userTz}
            historyValueKey="duration_hrs"
            historyUnit={t('hrs')}
            locale={locale}
            t={t}
          />
          <SummaryCard 
            icon={<Activity className="text-[#60B76F]" />} 
            label={t('steps')} 
            value={totalSteps.toLocaleString()} 
            unit="" 
            target="/ 10k"
            progress={(totalSteps / 10000) * 100}
            color="bg-[#60B76F]"
            history={activityWeek}
            userTz={userTz}
            historyValueKey="steps"
            historyUnit=""
            locale={locale}
            t={t}
          />
          <SummaryCard 
            icon={<Utensils className="text-orange-500" />} 
            label={t('nutrition')} 
            value={totalCalories.toLocaleString()} 
            unit={t('kcal')} 
            target="/ 2200"
            progress={(totalCalories / 2200) * 100}
            color="bg-orange-500"
            history={nutritionWeek}
            userTz={userTz}
            historyValueKey="calories"
            historyUnit={t('kcal')}
            locale={locale}
            t={t}
          />
        </section>

        {/* --- Detailed Nutrition --- */}
        <section className="glass-card p-3 sm:p-4 md:p-6 rounded-2xl sm:rounded-3xl space-y-4 sm:space-y-6 w-full min-w-0">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-base sm:text-lg md:text-xl font-bold flex items-center gap-1.5 sm:gap-2">
              <Utensils className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
              {t('nutrition')}
            </h2>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8 items-center w-full min-w-0">
            <div className="h-40 md:h-48 w-full flex justify-center relative min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={nutritionPieData.length > 0 ? nutritionPieData : [{ name: 'Нет данных', value: 1 }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {nutritionPieData.length > 0 ? (
                      nutritionPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={Object.values(MACRO_COLORS)[index % 4]} />
                      ))
                    ) : (
                      <Cell fill="#e2e8f0" />
                    )}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg sm:text-xl md:text-2xl font-bold">{totalCalories > 1000 ? (totalCalories/1000).toFixed(1) + 'k' : totalCalories}</span>
                <span className="text-[9px] sm:text-[10px] md:text-xs text-slate-500">{t('kcal')}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-6">
              <MacroItem label={t('proteins')} current={totalMacros.protein} target={nutritionNorms.protein.norm} color={MACRO_COLORS.proteins} unit={t('unitGram')} />
              <MacroItem label={t('fats')} current={totalMacros.fat} target={nutritionNorms.fat.norm} color={MACRO_COLORS.fats} unit={t('unitGram')} />
              <MacroItem label={t('carbs')} current={totalMacros.carbs} target={nutritionNorms.carbs.norm} color={MACRO_COLORS.carbs} unit={t('unitGram')} />
              <MacroItem label={t('fiber')} current={nutritionToday.reduce((s: number, n: any) => s + Number(n.fiber || 0), 0)} target={nutritionNorms.fiber.norm} color={MACRO_COLORS.fiber} unit={t('unitGram')} />
            </div>
          </div>

          {/* Nutrition Report Dropdown - MOVED HERE */}
          <details className="group pt-2 border-t border-slate-100 dark:border-white/5">
              <summary className="text-xs text-[#60B76F] cursor-pointer list-none flex items-center justify-between font-bold uppercase tracking-wider py-2">
                  {t('nutrientsReport')} <ChevronDown size={14} className="group-open:rotate-180 transition-transform" />
              </summary>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[10px] text-gray-500 dark:text-slate-400 bg-white/30 dark:bg-black/10 p-3 rounded-2xl border border-white/10">
                  {Object.entries(nutritionNorms).map(([key, config]: any) => {
                      const val = nutritionToday.reduce((sum: number, n: any) => sum + Number(n[key] || 0), 0);
                      const pct = (val / config.norm) * 100;
                      let emoji = '🔴';
                      if (pct >= 80) emoji = '🟢';
                      else if (pct >= 50) emoji = '🟡';
                      return (
                          <div key={key} className="flex justify-between items-center py-1 px-2 hover:bg-white/40 dark:hover:bg-white/5 rounded-lg transition-colors border-b border-slate-100/50 dark:border-white/5 last:border-0 sm:border-0">
                              <span className="truncate pr-2">{emoji} {nutrientNames[key]}</span>
                              <span className="font-medium shrink-0">{val.toFixed(1)} / {config.norm}</span>
                          </div>
                      );
                  })}
              </div>
          </details>

          {/* Meals List */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
             {nutritionToday.length === 0 ? <p className="text-gray-400 text-sm text-center py-4">{t('mealsEmpty')}</p> :
              nutritionToday.map((n: any) => (
                <MealRow 
                  key={n.id}
                  time={new Date(n.created_at).toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'en-US', { timeZone: userTz, hour: '2-digit', minute:'2-digit' })} 
                  name={n.dish || t('mealDefault')} 
                  kcal={n.calories} 
                  tags={[n.protein > 20 ? t('proteinTag') : null, n.fiber > 5 ? t('fiberTag') : null, n.grams ? `${n.grams}${t('unitGram')}` : null].filter(Boolean)} 
                  hasImage={!!n.image_url}
                  id={n.id}
                  deleteNutritionLog={deleteNutritionLog}
                  t={t}
                />
              ))
             }
          </div>
        </section>

        {/* --- Sleep & Activity Grid --- */}
        <div className="grid lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6 w-full min-w-0">
          {/* Sleep Detailed */}
          <section className="glass-card p-3 sm:p-4 md:p-6 rounded-2xl sm:rounded-3xl space-y-4 sm:space-y-6 w-full min-w-0 flex flex-col">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-base sm:text-lg md:text-xl font-bold flex items-center gap-1.5 sm:gap-2">
                <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 shrink-0" />
                <span className="truncate">{t('sleep')} & HRV</span>
              </h2>
            </div>
            <div className="h-40 md:h-48 w-full flex justify-center relative min-w-0">
              {sleepChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sleepChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {sleepChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs sm:text-sm">{t('noData')}</div>
              )}
              {sleepChartData.length > 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg sm:text-xl md:text-2xl font-bold">{lastSleep?.duration_hrs?.toFixed(1) || '0'}</span>
                  <span className="text-[9px] sm:text-[10px] md:text-xs text-slate-500">{t('hrs')}</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
              {sleepChartData.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[10px] text-slate-500 font-medium">{s.name} {s.value.toFixed(1)}ч</span>
                </div>
              ))}
            </div>
            
            <div className="flex justify-between items-center px-1 sm:px-2 py-2 sm:py-3 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl sm:rounded-2xl mt-auto">
              <div className="text-center flex-1 min-w-0">
                <p className="text-[8px] sm:text-[10px] text-indigo-400 uppercase tracking-tight font-bold truncate">{t('hrv')}</p>
                <p className="text-sm sm:text-base md:text-lg font-bold">{lastSleep?.hrv || '—'}</p>
              </div>
              <div className="w-px h-6 sm:h-8 bg-indigo-200 dark:bg-indigo-800" />
              <div className="text-center flex-1 min-w-0">
                <p className="text-[8px] sm:text-[10px] text-indigo-400 uppercase tracking-tight font-bold truncate">{t('restingHr')}</p>
                <p className="text-sm sm:text-base md:text-lg font-bold">{lastSleep?.resting_heart_rate || '—'}</p>
              </div>
            </div>
          </section>

          {/* Activity Trend */}
          <section className="glass-card p-3 sm:p-4 md:p-6 rounded-2xl sm:rounded-3xl space-y-4 sm:space-y-6 w-full min-w-0 flex flex-col">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-base sm:text-lg md:text-xl font-bold flex items-center gap-1.5 sm:gap-2">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-[#60B76F] shrink-0" />
                <span className="truncate">{t('activityTrend')}</span>
              </h2>
            </div>
            <div className="h-32 sm:h-40 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityTrend} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSteps" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60B76F" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#60B76F" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 8, fill: '#94A3B8'}} dy={10} />
                  <Tooltip contentStyle={{fontSize: '10px'}} />
                  <Area type="monotone" dataKey="steps" stroke="#60B76F" strokeWidth={2} fillOpacity={1} fill="url(#colorSteps)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-2 sm:gap-4 mt-auto">
              <div className="flex-1 p-2 sm:p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl sm:rounded-2xl min-w-0">
                <p className="text-[8px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-tighter truncate">{t('steps')} (7д)</p>
                <p className="text-sm sm:text-base md:text-lg font-bold truncate">{activityWeek.reduce((s:number,a:any)=>s+(a.steps||0),0).toLocaleString()}</p>
              </div>
              <div className="flex-1 p-2 sm:p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl sm:rounded-2xl min-w-0">
                <p className="text-[8px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-tighter truncate">{t('activeMin')}</p>
                <p className="text-sm sm:text-base md:text-lg font-bold truncate">{activityToday.reduce((s:number,a:any)=>s+(a.active_minutes||0),0)}</p>
              </div>
            </div>
          </section>
        </div>

        {/* --- Habits Heatmap (New requested section) --- */}
        <section className="glass-card p-4 sm:p-6 rounded-3xl space-y-4 sm:space-y-6">
          <div className="flex justify-between items-center sm:px-1">
            <h2 className="text-base sm:text-lg md:text-xl font-bold flex items-center gap-1.5 sm:gap-2">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500 shrink-0" />
              <span className="truncate">{t('habitsAndStability')}</span>
            </h2>
            <div className="flex gap-1 sm:gap-2 shrink-0">
               {hasAlcohol && <span className="p-1 px-1.5 sm:px-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[8px] sm:text-xs font-bold uppercase tracking-wider">{t('alcohol')}</span>}
               {hasSmoking && <span className="p-1 px-1.5 sm:px-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 text-[8px] sm:text-xs font-bold uppercase tracking-wider">{t('smoking')}</span>}
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-1 md:gap-2 px-1">
            {habitDays.map((item, idx) => (
              <div key={`name-${idx}`} className="text-[8px] sm:text-[10px] text-gray-400 text-center font-medium uppercase">
                {dayNames[new Date(item.day).getDay()]}
              </div>
            ))}
            {habitDays.map((item, idx) => {
              let colorClass = 'bg-[#60B76F]'; // Default to Green
              let shadow = 'shadow-[0_0_8px_rgba(96,183,111,0.3)]';
              
              if (item.type === 'alcohol') {
                colorClass = 'bg-slate-400 dark:bg-slate-600';
                shadow = '';
              } else if (item.type === 'smoking') {
                colorClass = 'bg-yellow-400';
                shadow = '';
              } else if (item.type === 'both') {
                colorClass = 'bg-red-400';
                shadow = '';
              }

              return (
                <div 
                  key={idx}
                  className={`aspect-square w-full rounded-md md:rounded-xl transition-all cursor-help ${colorClass} ${shadow}`}
                  title={`${new Date(item.day).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US')}: ${
                    item.type === 'clean' ? t('clean') : 
                    item.type === 'alcohol' ? t('alcohol') : 
                    item.type === 'smoking' ? t('smoking') : t('combo')
                  }`}
                />
              );
            })}
          </div>
          
          <div className="flex items-center justify-between text-[10px] sm:text-xs md:text-sm text-slate-500 px-1 border-t border-slate-100 dark:border-white/5 pt-3">
            <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#60B76F]" /><span>{t('clean')}</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-400" /><span>{t('alcohol')}</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-400" /><span>{t('smoking')}</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400" /><span>{t('combo')}</span></div>
            </div>
            <div className="shrink-0 text-right">
                <p className="text-[10px] text-slate-400 leading-none mb-1">{t('stability7Days')}</p>
                <span className="font-bold text-[#60B76F] text-sm sm:text-base">{stabilityPct}%</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 pt-2">
             {habitsToday.length === 0 ? <p className="text-gray-400 text-[10px] sm:text-xs text-center col-span-full py-2 opacity-50">{t('noBreachesToday')}</p> :
              habitsToday.map((h: any) => (
                <div key={h.id} className="flex gap-2 sm:gap-3 items-center p-2 sm:p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-white/5">
                  {(h.habit_key?.toLowerCase().includes('алкоголь') || h.habit_key?.toLowerCase().includes('пиво') || h.habit_key?.toLowerCase().includes('alcohol') || h.habit_key?.toLowerCase().includes('beer')) ? (
                      <Wine size={16} className="text-purple-400 flex-shrink-0" />
                  ) : (
                      <Cigarette size={16} className="text-amber-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs md:text-sm dark:text-slate-300 font-bold truncate">{h.habit_key}</p>
                      <p className="text-[8px] sm:text-[9px] md:text-[10px] text-gray-400">{new Date(h.created_at).toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'en-US', { timeZone: userTz, hour: '2-digit', minute:'2-digit' })}</p>
                  </div>
                </div>
              ))
             }
          </div>
        </section>

      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .glass-card {
          background: ${isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255, 255, 255, 0.7)'};
          backdrop-filter: blur(16px);
          border: 1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.5)'};
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.05);
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(96, 183, 111, 0.3);
          border-radius: 10px;
        }
      `}} />
    </div>
  );
};

// --- Helper Components ---

const SummaryCard = ({ icon, label, value, unit, target, progress, color, history, userTz, historyValueKey = 'volume_ml', historyUnit = 'ml', locale = 'ru', t }: any) => (
  <div className="glass-card p-2 sm:p-3 md:p-4 rounded-2xl sm:rounded-3xl space-y-1.5 sm:space-y-2 md:space-y-3 transition-transform hover:-translate-y-1 flex flex-col justify-between w-full min-w-0">
    <div className="flex justify-between items-start">
      <div className="p-1 sm:p-1.5 md:p-2 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-slate-800/80 shrink-0">
        {React.cloneElement(icon as React.ReactElement<any>, { className: "w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" })}
      </div>
      <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate ml-1">{label}</span>
    </div>
    <div className="w-full min-w-0">
      <div className="flex items-baseline gap-0.5 sm:gap-1">
        <span className="text-sm sm:text-base md:text-xl font-bold dark:text-white truncate">{value}</span>
        <span className="text-[8px] sm:text-[10px] text-slate-400 font-medium shrink-0">{unit}</span>
      </div>
      <p className="text-[7.5px] sm:text-[9px] text-slate-500 font-medium truncate w-full">{target}</p>
    </div>
    <div className="h-1 sm:h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shrink-0 mt-auto">
      <div 
        className={`h-full ${color} transition-all duration-1000`} 
        style={{ width: `${Math.min(progress, 100)}%` }} 
      />
    </div>

    {/* Dropdown lists - "За неделю" */}
    <details className="group mt-1 sm:mt-2 pt-1 sm:pt-2 border-t border-slate-100 dark:border-white/5 w-full shrink-0">
        <summary className="text-[8px] md:text-[9px] text-[#60B76F] cursor-pointer list-none flex items-center justify-between font-bold uppercase tracking-wider">
            <span className="truncate mr-1">{t('last7Days')}</span> <ChevronDown size={10} className="group-open:rotate-180 transition-transform shrink-0" />
        </summary>
        <div className="mt-1 sm:mt-2 space-y-1 max-h-24 overflow-y-auto text-[8px] sm:text-[9px] md:text-[10px] text-gray-500 dark:text-slate-400 custom-scrollbar pr-1">
            {history && history.length > 0 ? history.slice(0, 7).map((h: any) => (
                <div key={h.id} className="flex justify-between pb-0.5 border-b border-slate-50 dark:border-white/5 last:border-0 overflow-hidden gap-1">
                  <span className="shrink-0">{new Date(h.created_at).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {day:'2-digit', month:'2-digit', timeZone: userTz})}</span>
                  <span className="font-bold truncate text-right">{h[historyValueKey]?.toFixed(0)} <span className="text-[7px] sm:text-[8px] font-normal">{historyUnit}</span></span>
                </div>
            )) : <p className="text-center py-1 opacity-50">{t('noData')}</p>}
        </div>
    </details>
  </div>
);

const MacroItem = ({ label, current, target, color, unit }: any) => (
  <div className="space-y-1">
    <div className="flex justify-between text-[10px] md:text-[11px] font-bold">
      <span className="text-slate-500 uppercase">{label}</span>
      <span className="dark:text-white shrink-0 ml-2">{current}{unit} <span className="text-slate-400 font-normal">/ {target}{unit}</span></span>
    </div>
    <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full">
      <div 
        className="h-full rounded-full transition-all duration-1000" 
        style={{ width: `${Math.min((current/target)*100, 100)}%`, backgroundColor: color }} 
      />
    </div>
  </div>
);

const MealRow = ({ time, name, kcal, tags, hasImage, id, deleteNutritionLog, t }: any) => (
  <div className="flex items-center gap-2 md:gap-4 group cursor-pointer p-2 -mx-1 md:-mx-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all overflow-hidden">
    <div className="text-[10px] md:text-[11px] font-bold text-slate-400 w-8 md:w-10 shrink-0">{time}</div>
    {hasImage ? (
      <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
        <img src={`https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop`} alt="Food" className="object-cover w-full h-full" />
      </div>
    ) : (
      <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
        <Utensils className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
      </div>
    )}
    <div className="flex-1 min-w-0">
      <p className="text-xs md:text-sm font-bold truncate dark:text-white">{name}</p>
      <div className="flex flex-wrap gap-1 mt-0.5">
        {tags.map((tag: any) => (
          <span key={tag} className="text-[8px] md:text-[9px] px-1 md:px-1.5 py-0.5 rounded bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">{tag}</span>
        ))}
      </div>
    </div>
    <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <div className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-300">
        {kcal} <span className="text-[10px] font-normal text-slate-400">{t('kcal')}</span>
        </div>
        <DeleteLogButton id={id} action={deleteNutritionLog} />
    </div>
  </div>
);

export default LifestyleDashboard;

