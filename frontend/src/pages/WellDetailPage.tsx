import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  Droplets,
  Flame,
  Fuel,
  Gauge,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
} from 'lucide-react';
import type { ProductionPageResponse, WellDetail } from '../api/types';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useMeta } from '../context/MetaContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { KpiCard } from '../components/KpiCard';
import { SegmentedControl } from '../components/SegmentedControl';
import { WellStatusBadge, CategoryBadge, categoryColor } from '../components/StatusBadge';
import { WaterCutBar } from '../components/WaterCutBar';
import { WellFormModal } from '../components/WellFormModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorState, PageSkeleton } from '../components/Feedback';
import { EmptyState } from '../components/EmptyState';
import { ProductionTrendChart } from '../components/charts/ProductionTrendChart';
import {
  GAS,
  OIL,
  WATER,
  fmtInt,
  fmtNum,
  fmtPct,
  formatDate,
  formatDateTime,
} from '../lib/format';

export function WellDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refresh: refreshMeta } = useMeta();
  const { notify } = useToast();
  const wellId = Number(id);
  const { data, loading, error, refresh } = useApi<WellDetail>(Number.isFinite(wellId) ? `/wells/${wellId}` : null);
  const recent = useApi<ProductionPageResponse>(Number.isFinite(wellId) ? `/production?wellId=${wellId}&size=8` : null);
  const [chartMode, setChartMode] = useState<'hydrocarbons' | 'water'>('hydrocarbons');
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (loading && !data) return <PageSkeleton />;
  if (error && !data) {
    return (
      <div className="page">
        <Link to="/wells" className="back-link">
          <ArrowLeft size={14} /> Back to wells
        </Link>
        <ErrorState error={error} onRetry={refresh} />
      </div>
    );
  }
  if (!data) return null;

  const well = data.well;
  const metrics = well.metrics;
  const series = data.series;
  const recentSeries = series.slice(-30);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/wells/${well.id}`);
      notify(`${well.name} deleted`);
      refreshMeta();
      navigate('/wells');
    } catch (err) {
      notify((err as Error).message, 'error');
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="page well-detail-page">
      <Link to="/wells" className="back-link">
        <ArrowLeft size={14} /> Back to wells
      </Link>

      <PageHeader
        eyebrow="Well 360"
        title={well.name}
        subtitle={
          <span className="well-subline">
            <span className="mono">{well.apiNumber}</span>
            <span className="subtitle-dot">·</span>
            {well.fieldName}
            <span className="subtitle-dot">·</span>
            {well.operator}
            <WellStatusBadge status={well.status} label={well.statusLabel} />
          </span>
        }
        actions={
          <div className="header-controls">
            <Link to={`/forecast?wellId=${well.id}&new=1`} className="btn btn-secondary">
              <TrendingDown size={15} />
              Run forecast
            </Link>
            <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(true)}>
              <Pencil size={14} />
              Edit
            </button>
            <button type="button" className="icon-btn btn-danger-ghost" onClick={() => setConfirmOpen(true)} aria-label="Delete well">
              <Trash2 size={15} />
            </button>
          </div>
        }
      />

      <div className="well-kpis">
        <KpiCard
          compact
          label="Oil rate"
          value={fmtInt(metrics.oilRate)}
          unit="bbl/d"
          icon={Fuel}
          accent={OIL}
          delta={metrics.oilDeltaPct}
          spark={recentSeries.map((point) => point.oil)}
          footer="30-day average"
        />
        <KpiCard
          compact
          label="Gas rate"
          value={fmtInt(metrics.gasRate)}
          unit="Mcf/d"
          icon={Flame}
          accent={GAS}
          spark={recentSeries.map((point) => point.gas)}
          footer="30-day average"
        />
        <KpiCard
          compact
          label="Water cut"
          value={fmtNum(metrics.waterCutPct, 1)}
          unit="%"
          icon={Droplets}
          accent={WATER}
          spark={recentSeries.map((point) => point.waterCutPct)}
          footer={`${fmtInt(metrics.waterRate)} bbl/d water`}
        />
        <KpiCard
          compact
          label="Uptime"
          value={fmtNum(metrics.uptimePct, 1)}
          unit="%"
          icon={Gauge}
          accent="#5dd6a0"
          spark={recentSeries.map((point) => point.uptimePct)}
          footer={`${fmtInt(metrics.recordCount)} reporting days`}
        />
      </div>

      <div className="detail-row detail-row-top">
        <Panel
          title="Production history"
          subtitle={`Daily rates · last ${series.length} reporting days`}
          action={
            <SegmentedControl
              small
              ariaLabel="Well production metric"
              value={chartMode}
              onChange={setChartMode}
              options={[
                { value: 'hydrocarbons', label: 'Oil & gas' },
                { value: 'water', label: 'Water' },
              ]}
            />
          }
          className="chart-panel"
        >
          {series.length > 0 ? (
            <ProductionTrendChart series={series} mode={chartMode} height={320} />
          ) : (
            <EmptyState
              icon={Fuel}
              title="No production history"
              description="Log daily production to build the well’s performance curve."
              action={
                <Link to={`/production?wellId=${well.id}&new=1`} className="btn btn-secondary">
                  <Plus size={14} /> Log production
                </Link>
              }
            />
          )}
        </Panel>

        <Panel title="Well details" subtitle="Static and completion data">
          <dl className="detail-list">
            <div>
              <dt>Field</dt>
              <dd>{well.fieldName}</dd>
            </div>
            <div>
              <dt>Operator</dt>
              <dd>{well.operator}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>
                {[well.county, well.state].filter(Boolean).join(', ') || '—'}
              </dd>
            </div>
            <div>
              <dt>Target formation</dt>
              <dd>{well.targetFormation ?? '—'}</dd>
            </div>
            <div>
              <dt>Artificial lift</dt>
              <dd>{well.liftLabel ?? '—'}</dd>
            </div>
            <div>
              <dt>Total depth</dt>
              <dd className="mono">{well.totalDepthFt ? `${fmtInt(well.totalDepthFt)} ft` : '—'}</dd>
            </div>
            <div>
              <dt>Lateral length</dt>
              <dd className="mono">{well.lateralLengthFt ? `${fmtInt(well.lateralLengthFt)} ft` : '—'}</dd>
            </div>
            <div>
              <dt>Spud date</dt>
              <dd>{formatDate(well.spudDate)}</dd>
            </div>
            <div>
              <dt>Completion</dt>
              <dd>{formatDate(well.completionDate)}</dd>
            </div>
            {well.latitude != null && well.longitude != null && (
              <div>
                <dt>Coordinates</dt>
                <dd className="mono coord">
                  <MapPin size={12} />
                  {well.latitude.toFixed(4)}, {well.longitude.toFixed(4)}
                </dd>
              </div>
            )}
          </dl>
        </Panel>
      </div>

      <div className="detail-row detail-row-bottom">
        <Panel
          title="Recent production"
          subtitle="Latest reported daily volumes"
          action={
            <Link to={`/production?wellId=${well.id}`} className="text-link">
              Open ledger <ChevronRight size={13} />
            </Link>
          }
          flush
        >
          {recent.data && recent.data.records.content.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="num">Oil · bbl</th>
                    <th className="num">Gas · Mcf</th>
                    <th className="num">Water · bbl</th>
                    <th>Water cut</th>
                    <th className="num">Online</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.data.records.content.map((record) => (
                    <tr key={record.id}>
                      <td>{formatDate(record.productionDate)}</td>
                      <td className="num mono strong">{fmtInt(record.oilBbl)}</td>
                      <td className="num mono">{fmtInt(record.gasMcf)}</td>
                      <td className="num mono">{fmtInt(record.waterBbl)}</td>
                      <td><WaterCutBar value={record.waterCutPct} /></td>
                      <td className="num mono">{fmtNum(record.hoursOnline, 1)}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : recent.loading ? (
            <div className="inline-loading">Loading production records…</div>
          ) : (
            <EmptyState icon={Fuel} title="No production records" description="Daily volumes will appear here." />
          )}
        </Panel>

        <Panel
          title="Downtime history"
          subtitle="Recent operational events"
          action={
            <Link to={`/downtime?wellId=${well.id}`} className="text-link">
              All events <ChevronRight size={13} />
            </Link>
          }
        >
          {data.downtime.length > 0 ? (
            <ul className="event-list event-list-compact">
              {data.downtime.map((event) => (
                <li key={event.id} className="event-item">
                  <span className="event-rail" style={{ background: categoryColor(event.category) }} />
                  <div className="event-copy">
                    <div className="event-head">
                      <strong>{formatDateTime(event.startTime)}</strong>
                      {event.active ? (
                        <span className="badge badge-danger"><span className="badge-dot" />Active</span>
                      ) : (
                        <span className="event-duration">{fmtNum(event.durationHours, 1)}h</span>
                      )}
                    </div>
                    <p>{event.description}</p>
                    <div className="event-foot">
                      <CategoryBadge category={event.category} label={event.categoryLabel} />
                      {event.deferredOilBbl != null && (
                        <span className="event-deferred">{fmtInt(event.deferredOilBbl)} bbl deferred</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Gauge} title="No downtime recorded" description="This well has no logged outages." />
          )}
        </Panel>
      </div>

      <WellFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        well={well}
        onSaved={() => {
          setEditOpen(false);
          notify(`${well.name} updated`);
          refresh();
          refreshMeta();
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        title={`Delete ${well.name}?`}
        message="Deleting this well permanently removes its production records, downtime events and forecasts. This cannot be undone."
        busy={deleting}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
