import { clamp } from '../lib/format';

export function WaterCutBar({ value, showLabel = true }: { value: number; showLabel?: boolean }) {
  const pct = clamp(value, 0, 100);
  const tone = pct >= 65 ? 'high' : pct >= 40 ? 'mid' : 'low';
  return (
    <div className={`watercut ${showLabel ? 'watercut-labeled' : ''}`}>
      <div className="watercut-track">
        <div className={`watercut-fill watercut-${tone}`} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span className="watercut-value">{pct.toFixed(1)}%</span>}
    </div>
  );
}
