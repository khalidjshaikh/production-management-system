import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Sparkline } from './Sparkline';
import { fmtDelta } from '../lib/format';

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  deltaSuffix?: string;
  positiveIsGood?: boolean;
  icon: LucideIcon;
  accent?: string;
  spark?: number[];
  footer?: string;
  compact?: boolean;
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  deltaSuffix = '%',
  positiveIsGood = true,
  icon: Icon,
  accent = '#f0a63a',
  spark,
  footer,
  compact = false,
}: KpiCardProps) {
  const hasDelta = delta !== undefined && Number.isFinite(delta) && Math.abs(delta) > 0.05;
  const good = hasDelta ? (delta! >= 0) === positiveIsGood : false;
  const DeltaIcon = !hasDelta ? Minus : delta! >= 0 ? ArrowUpRight : ArrowDownRight;
  const style = { '--kpi-accent': accent } as CSSProperties;

  return (
    <article className={`kpi-card ${compact ? 'kpi-card-compact' : ''}`} style={style}>
      <div className="kpi-top">
        <span className="kpi-icon">
          <Icon size={16} strokeWidth={1.9} />
        </span>
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-value-row">
        <span className="kpi-value">{value}</span>
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      <div className="kpi-foot">
        {hasDelta && (
          <span className={`delta ${good ? 'delta-good' : 'delta-bad'}`}>
            <DeltaIcon size={13} />
            {fmtDelta(delta, 1).replace('%', '')}
            {deltaSuffix === 'pts' ? ' pts' : '%'}
          </span>
        )}
        {footer && <span className="kpi-footer">{footer}</span>}
      </div>
      {spark && spark.length > 1 && (
        <div className="kpi-sparkline" aria-hidden="true">
          <Sparkline values={spark} color={accent} width={320} height={36} />
        </div>
      )}
    </article>
  );
}
