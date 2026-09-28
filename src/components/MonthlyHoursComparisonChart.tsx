import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import { MonthlySheet } from '../types';
import { BarChart3, TrendingUp, Download } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { downloadSheetCsv } from '../utils/csvExporter';

interface MonthlyHoursComparisonChartProps {
  sheet: MonthlySheet;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomBarTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const value = data.value;
    const hours = Math.floor(value);
    const minutes = Math.round((value - hours) * 60);
    const formatted = `${hours}h ${String(minutes).padStart(2, '0')}m`;
    const fill = data.payload.fill || data.color;

    return (
      <div className="bg-slate-900 text-white text-xs p-3 rounded-xl shadow-xl border border-slate-700 space-y-1">
        <p className="font-bold text-slate-200">{label || data.name}</p>
        <p className="font-mono text-sm font-black" style={{ color: fill }}>
          {value.toFixed(2)} ore ({formatted})
        </p>
        {data.payload.desc && (
          <p className="text-[11px] text-slate-400">{data.payload.desc}</p>
        )}
      </div>
    );
  }
  return null;
};

const CustomWeeklyTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white text-xs p-3 rounded-xl shadow-xl border border-slate-700 space-y-1.5 min-w-[180px]">
        <p className="font-bold text-slate-200 border-b border-slate-700 pb-1">{label}</p>
        {payload.map((item, idx) => {
          const val = Number(item.value) || 0;
          const h = Math.floor(val);
          const m = Math.round((val - h) * 60);
          return (
            <div key={idx} className="flex items-center justify-between gap-3">
              <span className="text-slate-300 flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-xs"
                  style={{ backgroundColor: item.color }}
                />
                {item.name}:
              </span>
              <span className="font-mono font-bold" style={{ color: item.color }}>
                {val.toFixed(2)}h ({h}h {String(m).padStart(2, '0')}m)
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export const MonthlyHoursComparisonChart: React.FC<MonthlyHoursComparisonChartProps> = ({
  sheet,
}) => {
  const [viewMode, setViewMode] = useState<'TOTAL' | 'WEEKLY'>('TOTAL');
  const { isDark } = useTheme();

  const straordMinutes = sheet.totaleMinutiStraordinario || 0;
  const monteOreMinutes = sheet.totaleMinutiMonteOre || 0;
  const totalMinutes = straordMinutes + monteOreMinutes;

  const straordHoursDecimal = Number((straordMinutes / 60).toFixed(2));
  const monteOreHoursDecimal = Number((monteOreMinutes / 60).toFixed(2));
  const totalHoursDecimal = Number((totalMinutes / 60).toFixed(2));

  const straordPct =
    totalMinutes > 0 ? Math.round((straordMinutes / totalMinutes) * 100) : 0;
  const monteOrePct =
    totalMinutes > 0 ? Math.round((monteOreMinutes / totalMinutes) * 100) : 0;

  // Comparison data for Total View
  const comparisonData = [
    {
      name: 'Straordinario',
      ore: straordHoursDecimal,
      formatted: sheet.totaleOreStraordinarioFormatted || '0h 00m',
      fill: isDark ? '#14b8a6' : '#0d9488', // Teal
      desc: 'Destinato a liquidazione retributiva in busta paga',
      percentuale: `${straordPct}%`,
    },
    {
      name: 'Monte Ore',
      ore: monteOreHoursDecimal,
      formatted: sheet.totaleOreMonteOreFormatted || '0h 00m',
      fill: isDark ? '#fbbf24' : '#f59e0b', // Amber
      desc: 'Banca ore per fruizione di riposi compensativi',
      percentuale: `${monteOrePct}%`,
    },
  ];

  // Weekly Breakdown calculation
  const entries = sheet.entries || [];
  const weeklyData = [
    { week: 'Sett. 1 (1-7)', Straordinario: 0, MonteOre: 0 },
    { week: 'Sett. 2 (8-14)', Straordinario: 0, MonteOre: 0 },
    { week: 'Sett. 3 (15-21)', Straordinario: 0, MonteOre: 0 },
    { week: 'Sett. 4 (22-28)', Straordinario: 0, MonteOre: 0 },
    { week: 'Sett. 5 (29-31)', Straordinario: 0, MonteOre: 0 },
  ];

  entries.forEach((e) => {
    const parts = e.giorno.split('/');
    const day = parseInt(parts[0], 10);
    const hours = (e.minutiEffettuati || 0) / 60;

    let weekIndex = 0;
    if (day >= 1 && day <= 7) weekIndex = 0;
    else if (day >= 8 && day <= 14) weekIndex = 1;
    else if (day >= 15 && day <= 21) weekIndex = 2;
    else if (day >= 22 && day <= 28) weekIndex = 3;
    else weekIndex = 4;

    if (e.tipoDestinazione === 'MONTE_ORE') {
      weeklyData[weekIndex].MonteOre = Number(
        (weeklyData[weekIndex].MonteOre + hours).toFixed(2)
      );
    } else {
      weeklyData[weekIndex].Straordinario = Number(
        (weeklyData[weekIndex].Straordinario + hours).toFixed(2)
      );
    }
  });

  const hasEntries = entries.length > 0;

  const gridStroke = isDark ? '#1e293b' : '#f1f5f9';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const axisLineColor = isDark ? '#334155' : '#cbd5e1';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 transition-colors">
      {/* Top Header of the Summary Panel */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-400">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Riepilogo Ore Mese · Confronto a Barre</span>
              {hasEntries && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {entries.length} turni
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Confronto diretto tra ore di Straordinario retribuito e Monte Ore accantonato nel mese di{' '}
              <strong className="text-slate-700 dark:text-slate-200">{sheet.nomeMese}</strong>
            </p>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-end sm:self-auto">
          <button
            onClick={() => setViewMode('TOTAL')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              viewMode === 'TOTAL'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Confronto Totale
          </button>
          <button
            onClick={() => setViewMode('WEEKLY')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              viewMode === 'WEEKLY'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Andamento Settimanale
          </button>
        </div>
      </div>

      {/* Main KPI Badges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* KPI Straordinario */}
        <div className="p-3.5 rounded-xl border border-teal-200 dark:border-teal-800/80 bg-teal-50/40 dark:bg-teal-950/20 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900 dark:text-teal-300 uppercase tracking-wide">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600 dark:bg-teal-400"></span>
              Straordinario
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-teal-900 dark:text-teal-200 tabular-nums">
              {sheet.totaleOreStraordinarioFormatted || '0h 00m'}
            </div>
            <div className="text-[11px] text-teal-700 dark:text-teal-400">
              {straordHoursDecimal.toFixed(2)} ore decimali · {straordPct}% del totale
            </div>
          </div>
          <div className="text-right text-xs font-semibold text-teal-800 dark:text-teal-300">
            Liquidazione
          </div>
        </div>

        {/* KPI Monte Ore */}
        <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wide">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-amber-400"></span>
              Monte Ore
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-amber-900 dark:text-amber-200 tabular-nums">
              {sheet.totaleOreMonteOreFormatted || '0h 00m'}
            </div>
            <div className="text-[11px] text-amber-700 dark:text-amber-400">
              {monteOreHoursDecimal.toFixed(2)} ore decimali · {monteOrePct}% del totale
            </div>
          </div>
          <div className="text-right text-xs font-semibold text-amber-800 dark:text-amber-300">
            Riposi Comp.
          </div>
        </div>

        {/* KPI Bilancio / Totale */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
              <TrendingUp className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              Totale Cumulato Mese
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white tabular-nums">
              {sheet.totaleOreComplessivoFormatted || '0h 00m'}
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400">
              {totalHoursDecimal.toFixed(2)} ore eccedenti complessive
            </div>
          </div>
          <div className="text-right text-xs font-semibold text-slate-700 dark:text-slate-300">
            {totalMinutes === 0
              ? 'Foglio Pulito'
              : straordMinutes >= monteOreMinutes
              ? 'Prevalenza Straord.'
              : 'Prevalenza Monte Ore'}
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="relative pt-2">
        {!hasEntries ? (
          <div className="py-8 px-4 text-center bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 mx-auto flex items-center justify-center shadow-xs border border-slate-200 dark:border-slate-700">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                Foglio personale pulito (0 ore registrate)
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Non ci sono turni simulati. Fai clic su <strong className="text-slate-800 dark:text-slate-200">+ Inserisci Straordinario</strong> per registrare i tuoi turni reali: le barre di confronto si aggiorneranno all'istante con le ore di Straordinario e Monte Ore.
              </p>
            </div>
            {/* Visual zero-state chart preview */}
            <div className="h-44 w-full opacity-60 pointer-events-none mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                  <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 12 }} />
                  <YAxis domain={[0, 5]} tick={{ fill: axisColor, fontSize: 11 }} />
                  <Bar dataKey="ore" radius={[6, 6, 0, 0]} maxBarSize={60}>
                    {comparisonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : viewMode === 'TOTAL' ? (
          /* Total comparison bar chart */
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={comparisonData}
                margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: isDark ? '#f1f5f9' : '#334155', fontSize: 12, fontWeight: 600 }}
                  axisLine={{ stroke: axisLineColor }}
                  tickLine={false}
                />
                <YAxis
                  unit="h"
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, (dataMax: number) => Math.max(2, Math.ceil(dataMax * 1.25))]}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="ore" radius={[8, 8, 0, 0]} maxBarSize={70}>
                  {comparisonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          /* Weekly breakdown bar chart */
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyData}
                margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis
                  dataKey="week"
                  tick={{ fill: isDark ? '#f1f5f9' : '#334155', fontSize: 11, fontWeight: 500 }}
                  axisLine={{ stroke: axisLineColor }}
                  tickLine={false}
                />
                <YAxis
                  unit="h"
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, (dataMax: number) => Math.max(2, Math.ceil(dataMax * 1.25))]}
                />
                <Tooltip content={<CustomWeeklyTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: 10, fontSize: 12 }}
                  formatter={(value) => (
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{value}</span>
                  )}
                />
                <Bar
                  dataKey="Straordinario"
                  fill={isDark ? '#14b8a6' : '#0d9488'}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="MonteOre"
                  name="Monte Ore"
                  fill={isDark ? '#fbbf24' : '#f59e0b'}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Helpful legend footer */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-xs bg-teal-600 dark:bg-teal-400"></span>
            <strong className="text-slate-800 dark:text-slate-200">Straordinario</strong>: Pagamento in busta paga
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 dark:bg-amber-400"></span>
            <strong className="text-slate-800 dark:text-slate-200">Monte Ore</strong>: Recupero ore per turni futuri
          </span>
        </div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500">
          Grafico Recharts aggiornato in tempo reale con ogni riga del foglio
        </div>
      </div>
    </div>
  );
};
