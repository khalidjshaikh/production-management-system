import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  Droplets,
  Flame,
  Fuel,
  Gauge,
  Plus,
  TrendingDown,
} from 'lucide-react';
import type { DashboardResponse } from '../api/types';
import { useApi } from '../hooks/useApi';
import { useMeta } from '../context/MetaContext';
import { PageHeader } from '../components/PageHeader';
import { KpiCard } from '../components/KpiCard';
import { Panel } from '../components/Panel';
import { SegmentedControl } from '../components/SegmentedControl';
import { ErrorState, PageSkeleton } from '../components/Feedback';
import { EmptyState } from '../components/EmptyState';
import { ProductionTrendChart } from '../components/charts/ProductionTrendChart';
import { FieldMixChart } from '../components/charts/FieldMixChart';
import { OutlookChart } from '../components/charts/OutlookChart';
import { StatusBadge, categoryColor } from '../components/StatusBadge';
import { WaterCutBar } from '../components/WaterCutBar';
import {
  GAS,
  OIL,
  WATER,
  fmtDelta,
  fmtInt,
  fmtNum,
  fmtPct,
  formatDateTime,
  formatDateShort,
} from '../lib/format';

type RangeDays = 30 | 90 | 180;

export function DashboardPage() {
  const [days, setDays] = useState<RangeDays>(30);
  const [trendMode, setTrendMode] = useState<'hydrocarbons' | 'water'>('hydrocarbons');
  const { data, loading, error, refresh } = useApi<DashboardResponse>(`/dashboard?days=${days}`);
  const { meta } = useMeta();

  if (loading && !data) return <PageSkeleton />;
  if (error && !data) return <ErrorState error={error} onRetry={refresh} />;
  if (!data) return null;

  const { kpis, series, fields, topWells, recentDowntime, outlook, recentProduction } = data;
  const periodLabel = `prior ${days} days`;
  const sparkSlice = series.slice(-Math.min(series.length, 90));

  return (
    <div className="page dashboard-page">
      <PageHeader
        eyebrow="Field surveillance"
        title="Production overview"
        subtitle={
          <>
            <span className="status-inline">
              <span className="live-dot" />
              {fmtInt(kpis.activeWells)} active wells
            </span>
            <span className="subtitle-dot">·</span>
            {fmtInt(kpis.totalWells)} wells across {meta?.fields.length ?? fields.length} fields
            <span className="subtitle-dot">·</span>
            Latest production {formatDateShort(data.latestDate)}
          </>
        }
        actions={
          <div className="header-controls">
            <SegmentedControl
              ariaLabel="Dashboard date range"
              value={days}
              onChange={(value) => setDays(value as RangeDays)}
              options={[
                { value: 30, label: '30D' },
                { value: 90, label: '90D' },
                { value: 180, label: '180D' },
              ]}
            />
            <Link to="/production?new=1" className="btn btn-primary">
              <Plus size={15} />
              Log production
            </Link>
          </div>
        }
      />

      <div className="dashboard-kpis">
        <KpiCard
          label="Oil production"
          value={fmtInt(kpis.oilRate)}
          unit="bbl/d"
          icon={Fuel}
          accent={OIL}
          delta={kpis.oilDeltaPct}
          spark={sparkSlice.map((point) => point.oil)}
          footer={`vs ${periodLabel}`}
        />
        <KpiCard
          label="Gas production"
          value={fmtInt(kpis.gasRate)}
          unit="Mcf/d"
          icon={Flame}
          accent={GAS}
          delta={kpis.gasDeltaPct}
          spark={sparkSlice.map((point) => point.gas)}
          footer={`vs ${periodLabel}`}
        />
        <KpiCard
          label="Water cut"
          value={fmtNum(kpis.waterCutPct, 1)}
          unit="%"
          icon={Droplets}
          accent={WATER}
          delta={kpis.waterCutDeltaPts}
          deltaSuffix="pts"
          positiveIsGood={false}
          spark={sparkSlice.map((point) => point.waterCutPct)}
          footer={`vs ${periodLabel}`}
        />
        <KpiCard
          label="Fleet uptime"
          value={fmtNum(kpis.uptimePct, 1)}
          unit="%"
          icon={Gauge}
          accent="#5dd6a0"
          delta={kpis.uptimeDeltaPts}
          deltaSuffix="pts"
          positiveIsGood
          spark={sparkSlice.map((point) => point.uptimePct)}
          footer={`vs ${periodLabel}`}
        />
      </div>

      <div className="stat-strip">
        <div className="stat-strip-item">
          <span>Active wells</span>
          <strong>
            {fmtInt(kpis.activeWells)}
            <em>/ {fmtInt(kpis.totalWells)}</em>
          </strong>
        </div>
        <div className="stat-strip-item">
          <span>Deferred oil</span>
          <strong>
            {fmtInt(kpis.deferredOilBbl)}
            <em>bbl</em>
          </strong>
          <span className={`stat-strip-delta ${kpis.deferredOilDeltaPct > 0 ? 'bad' : 'good'}`}>
            {fmtDelta(kpis.deferredOilDeltaPct)}
          </span>
        </div>
        <div className="stat-strip-item">
          <span>Water production</span>
          <strong>
            {fmtInt(kpis.waterRate)}
            <em>bbl/d</em>
          </strong>
        </div>
        <div className="stat-strip-item">
          <span>Oil per active well</span>
          <strong>
            {fmtInt(kpis.avgOilPerWell)}
            <em>bbl/d</em>
          </strong>
        </div>
        <div className="stat-strip-spark" aria-hidden="true">
          <span className="strip-label">Field oil</span>
          <div className="strip-bars">
            {series.slice(-28).map((point, index) => {
              const max = Math.max(...series.slice(-28).map((item) => item.oil), 1);
              return (
                <span
                  key={point.date}
                  className="strip-bar"
                  style={{ height: `${Math.max(10, (point.oil / max) * 100)}%`, animationDelay: `${index * 8}ms` }}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="dashboard-row dashboard-row-main">
        <Panel
          title="Production trend"
          subtitle={`Daily field totals · last ${days} days`}
          action={
            <SegmentedControl
              small
              ariaLabel="Production trend metric"
              value={trendMode}
              onChange={setTrendMode}
              options={[
                { value: 'hydrocarbons', label: 'Oil & gas' },
                { value: 'water', label: 'Water' },
              ]}
            />
          }
          className="chart-panel"
        >
          <ProductionTrendChart series={series} mode={trendMode} height={316} />
          <div className="chart-footnote">
            <span>
              <strong>{fmtInt(kpis.oilRate)}</strong> bbl/d average oil
            </span>
            <span>
              <strong>{fmtInt(kpis.gasRate)}</strong> Mcf/d average gas
            </span>
            <span>
              <strong>{fmtPct(kpis.waterCutPct)}</strong> water cut
            </span>
          </div>
        </Panel>

        <Panel
          title="Field contribution"
          subtitle="Oil rate share by field"
          action={
            <Link to="/wells" className="text-link">
              Wells <ChevronRight size={13} />
            </Link>
          }
          className="field-panel"
        >
          {fields.length > 0 ? (
            <FieldMixChart fields={fields} />
          ) : (
            <EmptyState icon={Fuel} title="No field production" description="Production records will populate this view." />
          )}
        </Panel>
      </div>

      <div className="dashboard-row dashboard-row-secondary">
        <Panel
          title="Top producers"
          subtitle={`Ranked by oil rate · last ${days} days`}
          action={
            <Link to="/wells" className="text-link">
              All wells <ChevronRight size={13} />
            </Link>
          }
          flush
        >
          {topWells.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Well</th>
                    <th>Field</th>
                    <th className="num">Oil · bbl/d</th>
                    <th>Water cut</th>
                    <th className="num">Δ period</th>
                    <th className="num">Uptime</th>
                    <th aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {topWells.map((well, index) => (
                    <tr key={well.id}>
                      <td>
                        <Link to={`/wells/${well.id}`} className="well-cell">
                          <span className="rank">{String(index + 1).padStart(2, '0')}</span>
                          <span>
                            <strong>{well.name}</strong>
                            <small>{well.liftLabel}</small>
                          </span>
                        </Link>
                      </td>
                      <td className="muted-cell">{well.fieldName}</td>
                      <td className="num mono strong">{fmtInt(well.oilRate)}</td>
                      <td>
                        <WaterCutBar value={well.waterCutPct} />
                      </td>
                      <td className="num">
                        <span className={`mini-delta ${well.deltaPct >= 0 ? 'up' : 'down'}`}>
                          {fmtDelta(well.deltaPct)}
                        </span>
                      </td>
                      <td className="num mono">{fmtPct(well.uptimePct)}</td>
                      <td className="row-action">
                        <Link to={`/wells/${well.id}`} className="icon-btn icon-btn-ghost" aria-label={`Open ${well.name}`}>
                          <ChevronRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Fuel} title="No producing wells" description="Add a well and log production to rank producers." />
          )}
        </Panel>

        <Panel
          title="Downtime watch"
          subtitle="Active and recent field events"
          action={
            <Link to="/downtime" className="text-link">
              All events <ChevronRight size={13} />
            </Link>
          }
          className="downtime-watch"
        >
          {recentDowntime.length > 0 ? (
            <ul className="event-list">
              {recentDowntime.map((event) => (
                <li key={event.id} className="event-item">
                  <span className="event-rail" style={{ background: categoryColor(event.category) }} />
                  <div className="event-copy">
                    <div className="event-head">
                      <strong>{event.wellName}</strong>
                      {event.active ? (
                        <StatusBadge label="Active" tone="danger" />
                      ) : (
                        <span className="event-duration">{fmtNum(event.durationHours, 1)}h</span>
                      )}
                    </div>
                    <p>{event.description}</p>
                    <span className="event-meta">
                      {event.categoryLabel} · {formatDateTime(event.startTime)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Activity} title="No downtime logged" description="The field is running clean." />
          )}
          <div className="watch-footer">
            <span>
              <strong>{fmtInt(kpis.deferredOilBbl)}</strong> bbl deferred this period
            </span>
            <span className="watch-footer-gas">{fmtInt(kpis.deferredGasMcf)} Mcf gas</span>
          </div>
        </Panel>
      </div>

      <div className="dashboard-row dashboard-row-bottom">
        <Panel
          title="Production outlook"
          subtitle={
            outlook.length > 0
              ? `Aggregated P50 · ${data.outlookWells} of ${kpis.activeWells} active wells · next six months`
              : 'Aggregated P50 · next six months'
          }
          action={
            <Link to="/forecast" className="text-link">
              Forecasts <ChevronRight size={13} />
            </Link>
          }
          className="chart-panel"
        >
          {outlook.length > 0 ? (
            <OutlookChart data={outlook} height={226} />
          ) : (
            <EmptyState
              icon={TrendingDown}
              title="No forecast coverage"
              description="Fit a decline curve to see the forward production outlook."
              action={
                <Link to="/forecast?new=1" className="btn btn-secondary">
                  Run a forecast
                </Link>
              }
            />
          )}
        </Panel>

        <Panel
          title="Latest entries"
          subtitle="Most recently reported production"
          action={
            <Link to="/production" className="text-link">
              Ledger <ChevronRight size={13} />
            </Link>
          }
          className="recent-panel"
        >
          {recentProduction.length > 0 ? (
            <ul className="recent-list">
              {recentProduction.map((entry) => (
                <li key={entry.id}>
                  <div className="recent-main">
                    <span className="recent-dot" />
                    <div>
                      <strong>{entry.wellName}</strong>
                      <span>{formatDateShort(entry.date)}</span>
                    </div>
                  </div>
                  <div className="recent-metrics">
                    <span>
                      <em>Oil</em> {fmtInt(entry.oilBbl)}
                    </span>
                    <span>
                      <em>Gas</em> {fmtInt(entry.gasMcf)}
                    </span>
                  </div>
                  <Link to="/production" className="icon-btn icon-btn-ghost" aria-label="Open production ledger">
                    <ArrowUpRight size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Fuel} title="No production yet" description="Log the first daily volumes." />
          )}
          <div className="recent-foot">
            <span className="legend-dot" style={{ background: OIL }} /> Oil · bbl
            <span className="legend-dot legend-dot-gas" style={{ background: GAS }} /> Gas · Mcf
            <span className="recent-foot-label">Latest {recentProduction.length} entries</span>
          </div>
        </Panel>
      </div>
    </div>
  );
}
