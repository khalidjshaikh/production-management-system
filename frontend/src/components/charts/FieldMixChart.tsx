import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { FieldSlice } from '../../api/types';
import { FIELD_COLORS, fmtInt, fmtPct } from '../../lib/format';
import { ChartTooltip } from '../ChartTooltip';

export function FieldMixChart({ fields }: { fields: FieldSlice[] }) {
  const total = fields.reduce((sum, field) => sum + field.oilRate, 0);
  return (
    <div className="field-mix">
      <div className="donut-wrap">
        <ResponsiveContainer width="100%" height={190}>
          <PieChart>
            <Pie
              data={fields}
              dataKey="oilRate"
              nameKey="field"
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={2.5}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {fields.map((field, index) => (
                <Cell key={field.field} fill={FIELD_COLORS[index % FIELD_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              content={
                <ChartTooltip
                  units={{ oilRate: 'bbl/d' }}
                  labelFormatter={(label) => String(label)}
                />
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <strong>{fmtInt(total)}</strong>
          <span>bbl/d</span>
        </div>
      </div>
      <ul className="field-legend">
        {fields.map((field, index) => (
          <li key={field.field}>
            <span
              className="field-swatch"
              style={{ background: FIELD_COLORS[index % FIELD_COLORS.length] }}
            />
            <div className="field-legend-copy">
              <span className="field-name">{field.field}</span>
              <span className="field-sub">{field.wells} wells · {fmtPct(field.waterCutPct)} WC</span>
            </div>
            <div className="field-numbers">
              <strong>{fmtInt(field.oilRate)}</strong>
              <span>{fmtPct(field.sharePct, 1)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
