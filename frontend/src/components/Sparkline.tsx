import { useId } from 'react';

interface SparklineProps {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}

export function Sparkline({ values, color = '#f0a63a', width = 108, height = 38 }: SparklineProps) {
  const id = useId().replace(/:/g, '');
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length < 2) {
    return <div className="sparkline-empty" style={{ width, height }} />;
  }
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;
  const pad = 3;
  const usableWidth = width - pad * 2;
  const usableHeight = height - pad * 2;
  const points = clean.map((value, index) => {
    const x = pad + (index / (clean.length - 1)) * usableWidth;
    const y = pad + usableHeight - ((value - min) / span) * usableHeight;
    return [x, y] as const;
  });
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L${(width - pad).toFixed(2)},${(height - pad).toFixed(2)} L${pad},${(height - pad).toFixed(2)} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkline" aria-hidden="true">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
