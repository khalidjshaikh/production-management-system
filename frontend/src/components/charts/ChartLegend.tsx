interface ChartLegendProps {
  items: Array<{ label: string; color: string; dashed?: boolean; muted?: boolean }>;
}

export function ChartLegend({ items }: ChartLegendProps) {
  return (
    <div className="chart-legend">
      {items.map((item) => (
        <span className={`chart-legend-item ${item.muted ? 'muted' : ''}`} key={item.label}>
          <span
            className={`chart-legend-swatch ${item.dashed ? 'swatch-dashed' : ''}`}
            style={{ color: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
