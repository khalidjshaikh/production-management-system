import { fmtNum } from '../lib/format';

interface TooltipEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  units?: Record<string, string>;
  decimals?: Record<string, number>;
  hiddenKeys?: string[];
  labelFormatter?: (label: string) => string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  units = {},
  decimals = {},
  hiddenKeys = [],
  labelFormatter,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const entries = payload.filter(
    (entry) => !hiddenKeys.includes(String(entry.dataKey)) && entry.value !== undefined && entry.value !== null,
  );
  if (entries.length === 0) return null;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">
        {labelFormatter && label !== undefined ? labelFormatter(String(label)) : label}
      </div>
      <div className="chart-tooltip-rows">
        {entries.map((entry) => {
          const key = String(entry.dataKey ?? entry.name ?? '');
          const value = Number(entry.value);
          return (
            <div className="chart-tooltip-row" key={key}>
              <span className="chart-tooltip-dot" style={{ background: entry.color }} />
              <span className="chart-tooltip-name">{entry.name}</span>
              <span className="chart-tooltip-value">
                {fmtNum(value, decimals[key] ?? 0)}
                {units[key] ? <span className="chart-tooltip-unit">{units[key]}</span> : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
