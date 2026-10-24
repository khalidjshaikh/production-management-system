import type { ReactNode } from 'react';

interface PanelProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
  padded?: boolean;
}

export function Panel({ title, subtitle, action, children, className = '', flush = false, padded = true }: PanelProps) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <div className="panel-head">
          <div>
            {title && <h2 className="panel-title">{title}</h2>}
            {subtitle && <p className="panel-subtitle">{subtitle}</p>}
          </div>
          {action && <div className="panel-action">{action}</div>}
        </div>
      )}
      <div className={`panel-body ${flush ? 'panel-body-flush' : ''} ${padded && !flush ? 'panel-body-padded' : ''}`}>
        {children}
      </div>
    </section>
  );
}
