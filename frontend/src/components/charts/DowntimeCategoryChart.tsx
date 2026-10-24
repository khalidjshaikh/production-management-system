import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CategorySlice } from '../../api/types';
import { categoryColor } from '../StatusBadge';
import { ChartTooltip } from '../ChartTooltip';
import { fmtCompact } from '../../lib/format';

export function DowntimeCategoryChart({ categories }: { categories: CategorySlice[] }) {
  const height = Math.max(180, categories.length * 40 + 30);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={categories} layout="vertical" margin={{ top: 4, right: 18, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 6" horizontal={false} stroke="rgba(148,163,184,0.13)" />
        <XAxis
          type="number"
          tickFormatter={fmtCompact}
          tick={{ fill: '#74879d', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: '#a9b8c9', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={132}
        />
        <Tooltip
          cursor={{ fill: 'rgba(148,163,184,0.05)' }}
          content={<ChartTooltip units={{ hours: 'h' }} decimals={{ hours: 1 }} />}
        />
        <Bar dataKey="hours" name="Downtime" barSize={14} radius={[0, 5, 5, 0]}>
          {categories.map((category) => (
            <Cell key={category.category} fill={categoryColor(category.category)} fillOpacity={0.82} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
