import type { DowntimeCategory, ForecastModel, WellStatus } from '../api/types';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'muted' | 'accent';

interface StatusBadgeProps {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
}

export function StatusBadge({ label, tone = 'muted', dot = true, className = '' }: StatusBadgeProps) {
  return (
    <span className={`badge badge-${tone} ${className}`}>
      {dot && <span className="badge-dot" aria-hidden="true" />}
      {label}
    </span>
  );
}

export function wellStatusTone(status: WellStatus): BadgeTone {
  switch (status) {
    case 'PRODUCING':
      return 'success';
    case 'SHUT_IN':
      return 'warning';
    case 'COMPLETING':
      return 'info';
    case 'DRILLING':
      return 'violet';
    case 'PLUGGED':
      return 'muted';
    default:
      return 'muted';
  }
}

export function WellStatusBadge({ status, label }: { status: WellStatus; label: string }) {
  return <StatusBadge label={label} tone={wellStatusTone(status)} />;
}

const categoryTone: Record<DowntimeCategory, BadgeTone> = {
  PLANNED_MAINTENANCE: 'info',
  EQUIPMENT_FAILURE: 'danger',
  POWER_OUTAGE: 'warning',
  WEATHER: 'violet',
  PIPELINE_CONSTRAINT: 'accent',
  REGULATORY: 'muted',
  OTHER: 'muted',
};

export function CategoryBadge({ category, label }: { category: DowntimeCategory; label: string }) {
  return <StatusBadge label={label} tone={categoryTone[category]} />;
}

export function categoryColor(category: DowntimeCategory): string {
  switch (category) {
    case 'EQUIPMENT_FAILURE':
      return '#f0736d';
    case 'POWER_OUTAGE':
      return '#f0a63a';
    case 'WEATHER':
      return '#b49bff';
    case 'PIPELINE_CONSTRAINT':
      return '#5b9dff';
    case 'PLANNED_MAINTENANCE':
      return '#51d3c2';
    case 'REGULATORY':
      return '#88c46a';
    default:
      return '#74879d';
  }
}

export function ModelBadge({ model, label }: { model: ForecastModel; label: string }) {
  return <StatusBadge label={label} tone={model === 'HYPERBOLIC' ? 'violet' : 'info'} dot={false} />;
}
