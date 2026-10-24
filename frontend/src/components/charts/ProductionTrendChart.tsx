import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailyPoint } from '../../api/types';
import { fmtCompact, formatDate, formatDateShort } from '../../lib/format';
import { ChartTooltip } from '../ChartTooltip';
import { GAS, OIL, WATER } from '../../lib/format';
import { ChartLegend } from './ChartLegend';

interface ProductionTrendChartProps {
  series: DailyPoint[];
  mode?: 'hydrocarbons' | 'water';
  height?: number;
  showLegend?: boolean;
}

export function ProductionTrendChart({
  series,
  mode = 'hydrocarbons',
  height = 300,
  showLegend = true,
}: ProductionTrendChartProps) {
  const hydrocarbons = mode === 'hydrocarbons';
  const legend = hydrocarbons
    ? [
        { label: 'Oil · bbl/d', color: OIL },
        { label: 'Gas · Mcf/d', color: GAS },
      ]
    : [
        { label: 'Water · bbl/d', color: WATER },
        { label: 'Water cut · %', color: '#b49bff' },
      ];

  return (
    <div className="chart-block">
      {showLegend && <ChartLegend items={legend} />}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={series} margin={{ top: 12, right: 4, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="oilFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={OIL} stopOpacity={0.32} />
              <stop offset="100%" stopColor={OIL} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="waterFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={WATER} stopOpacity={0.28} />
              <stop offset="100%" stopColor={WATER} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 6" vertical={false} stroke="rgba(148,163,184,0.13)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateShort}
            tick={{ fill: '#74879d', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={36}
            dy={8}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={fmtCompact}
            tick={{ fill: '#74879d', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={54}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={hydrocarbons ? fmtCompact : (value: number) => `${value}%`}
            tick={{ fill: '#74879d', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
            domain={hydrocarbons ? ['auto', 'auto'] : [0, 100]}
          />
          <Tooltip
            cursor={{ stroke: 'rgba(240,166,58,0.28)', strokeDasharray: '3 4' }}
            content={
              <ChartTooltip
                units={
                  hydrocarbons
                    ? { oil: 'bbl/d', gas: 'Mcf/d' }
                    : { water: 'bbl/d', waterCutPct: '%' }
                }
                decimals={hydrocarbons ? { oil: 0, gas: 0 } : { water: 0, waterCutPct: 1 }}
                labelFormatter={formatDate}
              />
            }
          />
          {hydrocarbons ? (
            <>
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="oil"
                name="Oil"
                stroke={OIL}
                strokeWidth={2.1}
                fill="url(#oilFill)"
                activeDot={{ r: 3.5, strokeWidth: 0, fill: OIL }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="gas"
                name="Gas"
                stroke={GAS}
                strokeWidth={1.7}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0, fill: GAS }}
              />
            </>
          ) : (
            <>
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="water"
                name="Water"
                stroke={WATER}
                strokeWidth={2.1}
                fill="url(#waterFill)"
                activeDot={{ r: 3.5, strokeWidth: 0, fill: WATER }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="waterCutPct"
                name="Water cut"
                stroke="#b49bff"
                strokeWidth={1.7}
                strokeDasharray="4 4"
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0, fill: '#b49bff' }}
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
