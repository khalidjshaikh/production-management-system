import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ActualMonth, ForecastPointView } from '../../api/types';
import { FORECAST, OIL, fmtCompact, formatMonth, fullMonthTick } from '../../lib/format';
import { ChartTooltip } from '../ChartTooltip';
import { ChartLegend } from './ChartLegend';

interface ForecastProjectionChartProps {
  actuals: ActualMonth[];
  points: ForecastPointView[];
  baseDate: string;
  height?: number;
}

interface Row {
  date: string;
  actual?: number;
  forecast?: number;
  low?: number;
  high?: number;
  band?: number;
}

export function ForecastProjectionChart({ actuals, points, baseDate, height = 340 }: ForecastProjectionChartProps) {
  const rows = new Map<string, Row>();
  actuals.forEach((actual) => {
    const key = actual.month;
    rows.set(key, { ...(rows.get(key) ?? { date: key }), date: key, actual: actual.oilRate });
  });
  points.forEach((point) => {
    const key = point.date;
    rows.set(key, {
      ...(rows.get(key) ?? { date: key }),
      date: key,
      forecast: point.oilRate,
      low: point.oilLowRate,
      high: point.oilHighRate,
      band: Math.max(0, point.oilHighRate - point.oilLowRate),
    });
  });
  const data = [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
  const baseMonth = `${baseDate.slice(0, 7)}-01`;

  return (
    <div className="chart-block">
      <ChartLegend
        items={[
          { label: 'Actual · bbl/d', color: OIL },
          { label: 'P50 forecast · bbl/d', color: FORECAST, dashed: true },
          { label: 'P10–P90 range', color: 'rgba(180,155,255,0.35)' },
        ]}
      />
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 14, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="forecastBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={FORECAST} stopOpacity={0.22} />
              <stop offset="100%" stopColor={FORECAST} stopOpacity={0.06} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 6" vertical={false} stroke="rgba(148,163,184,0.13)" />
          <XAxis
            dataKey="date"
            tickFormatter={fullMonthTick}
            tick={{ fill: '#74879d', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={34}
            dy={8}
          />
          <YAxis
            tickFormatter={fmtCompact}
            tick={{ fill: '#74879d', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={54}
          />
          <Tooltip
            cursor={{ stroke: 'rgba(180,155,255,0.25)', strokeDasharray: '3 4' }}
            content={
              <ChartTooltip
                units={{ actual: 'bbl/d', forecast: 'bbl/d' }}
                hiddenKeys={['low', 'band', 'high']}
                labelFormatter={(label) => formatMonth(String(label))}
              />
            }
          />
          <ReferenceLine
            x={baseMonth}
            stroke="rgba(148,163,184,0.35)"
            strokeDasharray="3 4"
            label={{ value: 'Base', fill: '#74879d', fontSize: 10, position: 'insideTopRight' }}
          />
          <Area
            type="monotone"
            dataKey="low"
            stackId="band"
            stroke="none"
            fill="transparent"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="band"
            stackId="band"
            stroke="none"
            fill="url(#forecastBand)"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="actual"
            name="Actual"
            stroke={OIL}
            strokeWidth={2.2}
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 0, fill: OIL }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="forecast"
            name="P50 forecast"
            stroke={FORECAST}
            strokeWidth={2.2}
            strokeDasharray="6 4"
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 0, fill: FORECAST }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
