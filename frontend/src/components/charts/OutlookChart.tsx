import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ForecastMonth } from '../../api/types';
import { FORECAST, GAS, OIL, fmtCompact, formatMonth } from '../../lib/format';
import { ChartTooltip } from '../ChartTooltip';
import { ChartLegend } from './ChartLegend';

export function OutlookChart({ data, height = 220 }: { data: ForecastMonth[]; height?: number }) {
  return (
    <div className="chart-block">
      <ChartLegend
        items={[
          { label: 'Forecast oil · bbl/d', color: OIL },
          { label: 'Forecast gas · Mcf/d', color: GAS },
        ]}
      />
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 10, right: 4, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="outlookFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={OIL} stopOpacity={0.26} />
              <stop offset="100%" stopColor={OIL} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 6" vertical={false} stroke="rgba(148,163,184,0.13)" />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonth}
            tick={{ fill: '#74879d', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            dy={8}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={fmtCompact}
            tick={{ fill: '#74879d', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={fmtCompact}
            tick={{ fill: '#74879d', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={46}
          />
          <Tooltip
            cursor={{ stroke: 'rgba(240,166,58,0.28)', strokeDasharray: '3 4' }}
            content={
              <ChartTooltip
                units={{ oilRate: 'bbl/d', gasRate: 'Mcf/d' }}
                labelFormatter={(label) => formatMonth(String(label))}
              />
            }
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="oilRate"
            name="Oil"
            stroke={OIL}
            strokeWidth={2.1}
            fill="url(#outlookFill)"
            dot={{ r: 2.6, fill: OIL, strokeWidth: 0 }}
            activeDot={{ r: 4, strokeWidth: 0, fill: OIL }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="gasRate"
            name="Gas"
            stroke={GAS}
            strokeWidth={1.6}
            strokeDasharray="4 4"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
