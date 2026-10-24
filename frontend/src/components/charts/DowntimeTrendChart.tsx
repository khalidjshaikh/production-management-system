import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DailyDowntime } from '../../api/types';
import { DOWNTIME, fmtCompact, formatDate, formatDateShort } from '../../lib/format';
import { ChartTooltip } from '../ChartTooltip';

export function DowntimeTrendChart({ data, height = 220 }: { data: DailyDowntime[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 4, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="downtimeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={DOWNTIME} stopOpacity={0.3} />
            <stop offset="100%" stopColor={DOWNTIME} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 6" vertical={false} stroke="rgba(148,163,184,0.13)" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateShort}
          tick={{ fill: '#74879d', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={40}
          dy={8}
        />
        <YAxis
          tickFormatter={(value: number) => `${fmtCompact(value)}h`}
          tick={{ fill: '#74879d', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={50}
        />
        <Tooltip
          cursor={{ stroke: 'rgba(240,115,109,0.3)', strokeDasharray: '3 4' }}
          content={<ChartTooltip units={{ hours: 'h' }} decimals={{ hours: 1 }} labelFormatter={formatDate} />}
        />
        <Area
          type="monotone"
          dataKey="hours"
          name="Downtime"
          stroke={DOWNTIME}
          strokeWidth={1.8}
          fill="url(#downtimeFill)"
          activeDot={{ r: 3.5, strokeWidth: 0, fill: DOWNTIME }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
