import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ChevronRight,
  Droplets,
  FileText,
  Flame,
  Fuel,
  Gauge,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { PageResponse, ProductionPageResponse, ProductionRecordView, WellView } from '../api/types';
import { api, queryString } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useMeta } from '../context/MetaContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { KpiCard } from '../components/KpiCard';
import { SegmentedControl } from '../components/SegmentedControl';
import { Pagination } from '../components/Pagination';
import { WaterCutBar } from '../components/WaterCutBar';
import { ProductionTrendChart } from '../components/charts/ProductionTrendChart';
import { ProductionFormModal } from '../components/ProductionFormModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorState, PageSkeleton } from '../components/Feedback';
import { EmptyState } from '../components/EmptyState';
import {
  GAS,
  OIL,
  WATER,
  addDays,
  fmtInt,
  fmtNum,
  fmtPct,
  formatDate,
} from '../lib/format';

type RangeDays = 7 | 30 | 90 | 180;

export function ProductionPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { meta } = useMeta();
  const { notify } = useToast();
  const [wellId, setWellId] = useState(searchParams.get('wellId') ?? '');
  const [field, setField] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [range, setRange] = useState<RangeDays | null>(90);
  const [chartMode, setChartMode] = useState<'hydrocarbons' | 'water'>('hydrocarbons');
  const [formOpen, setFormOpen] = useState(searchParams.get('new') === '1');
  const [editing, setEditing] = useState<ProductionRecordView | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductionRecordView | null>(null);
  const [deleting, setDeleting] = useState(false);

  const wells = useApi<PageResponse<WellView>>('/wells?size=200&sort=name');

  useEffect(() => {
    const latest = meta?.latestProductionDate;
    if (latest && !from && !to && range) {
      setTo(latest);
      setFrom(addDays(latest, -(range - 1)));
    }
  }, [meta?.latestProductionDate, from, to, range]);

  const path = `/production${queryString({
    wellId: wellId || undefined,
    field: field || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    size: 20,
  })}`;
  const { data, loading, refreshing, error, refresh } = useApi<ProductionPageResponse>(path);

  const setQuickRange = (days: RangeDays) => {
    const latest = meta?.latestProductionDate;
    setRange(days);
    setPage(0);
    if (latest) {
      setTo(latest);
      setFrom(addDays(latest, -(days - 1)));
    }
  };

  const updateFrom = (value: string) => {
    setRange(null);
    setFrom(value);
    if (value && to && value > to) setTo(value);
    setPage(0);
  };

  const updateTo = (value: string) => {
    setRange(null);
    setTo(value);
    if (value && from && value < from) setFrom(value);
    setPage(0);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    if (searchParams.has('new')) {
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleSaved = () => {
    closeForm();
    notify(editing ? 'Production record updated' : 'Production record logged');
    refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/production/${deleteTarget.id}`);
      notify('Production record deleted');
      setDeleteTarget(null);
      if (data && data.records.content.length === 1 && page > 0) {
        setPage(page - 1);
      }
      refresh();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (loading && !data) return <PageSkeleton />;
  if (error && !data) return <ErrorState error={error} onRetry={refresh} />;
  if (!data) return null;

  const summary = data.summary;
  const selectedWell = wells.data?.content.find((well) => String(well.id) === wellId);
  const hasRowFilters = Boolean(wellId || field);

  return (
    <div className={`page production-page ${refreshing ? 'is-refreshing' : ''}`}>
      <PageHeader
        eyebrow="Daily operations"
        title="Production ledger"
        subtitle={`${formatDate(summary.from)} – ${formatDate(summary.to)} · ${fmtInt(summary.records)} daily records`}
        actions={
          <div className="header-controls">
            <button type="button" className="icon-btn" onClick={refresh} aria-label="Refresh production">
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            </button>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <Plus size={15} />
              Log production
            </button>
          </div>
        }
      />

      <div className="well-kpis">
        <KpiCard
          compact
          label="Oil volume"
          value={fmtInt(summary.oilBbl)}
          unit="bbl"
          icon={Fuel}
          accent={OIL}
          spark={summary.series.map((point) => point.oil)}
          footer={`${fmtInt(summary.oilRate)} bbl/d average`}
        />
        <KpiCard
          compact
          label="Gas volume"
          value={fmtInt(summary.gasMcf)}
          unit="Mcf"
          icon={Flame}
          accent={GAS}
          spark={summary.series.map((point) => point.gas)}
          footer={`${fmtInt(summary.gasRate)} Mcf/d average`}
        />
        <KpiCard
          compact
          label="Water volume"
          value={fmtInt(summary.waterBbl)}
          unit="bbl"
          icon={Droplets}
          accent={WATER}
          spark={summary.series.map((point) => point.water)}
          footer={`${fmtInt(summary.waterRate)} bbl/d · ${fmtPct(summary.waterCutPct)} cut`}
        />
        <KpiCard
          compact
          label="Reported uptime"
          value={fmtNum(summary.uptimePct, 1)}
          unit="%"
          icon={Gauge}
          accent="#5dd6a0"
          spark={summary.series.map((point) => point.uptimePct)}
          footer="Hours online / available"
        />
      </div>

      <Panel
        title="Daily production"
        subtitle={selectedWell ? `${selectedWell.name} · daily volumes` : 'Field-wide daily volumes'}
        action={
          <SegmentedControl
            small
            ariaLabel="Production chart metric"
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
        {summary.series.length > 0 ? (
          <ProductionTrendChart series={summary.series} mode={chartMode} height={290} />
        ) : (
          <EmptyState icon={Fuel} title="No production in this window" description="Adjust the date range or log a new record." />
        )}
      </Panel>

      <section className="panel table-panel">
        <div className="table-toolbar table-toolbar-wrap">
          <div className="range-controls">
            <SegmentedControl
              small
              ariaLabel="Production window"
              value={range ?? 0}
              onChange={(value) => setQuickRange(value as RangeDays)}
              options={[
                { value: 7, label: '7D' },
                { value: 30, label: '30D' },
                { value: 90, label: '90D' },
                { value: 180, label: '180D' },
              ]}
            />
            <div className="date-range">
              <input
                type="date"
                className="input input-compact"
                value={from}
                max={to || undefined}
                onChange={(event) => updateFrom(event.target.value)}
                aria-label="From date"
              />
              <span>to</span>
              <input
                type="date"
                className="input input-compact"
                value={to}
                min={from || undefined}
                onChange={(event) => updateTo(event.target.value)}
                aria-label="To date"
              />
            </div>
          </div>
          <div className="toolbar-filters">
            <select
              className="input input-compact"
              value={wellId}
              onChange={(event) => {
                setWellId(event.target.value);
                setPage(0);
              }}
              aria-label="Filter by well"
            >
              <option value="">All wells</option>
              {wells.data?.content.map((well) => (
                <option key={well.id} value={well.id}>{well.name}</option>
              ))}
            </select>
            <select
              className="input input-compact"
              value={field}
              onChange={(event) => {
                setField(event.target.value);
                setPage(0);
              }}
              aria-label="Filter by field"
            >
              <option value="">All fields</option>
              {meta?.fields.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {(hasRowFilters || range === null) && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setWellId('');
                  setField('');
                  setPage(0);
                  setQuickRange(90);
                }}
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

        {selectedWell && (
          <div className="active-filter-bar">
            <span>
              Showing <strong>{selectedWell.name}</strong> · {selectedWell.fieldName}
            </span>
            <Link to={`/wells/${selectedWell.id}`} className="text-link">
              Well detail <ChevronRight size={13} />
            </Link>
          </div>
        )}

        {data.records.content.length > 0 ? (
          <>
            <div className="table-wrap">
              <table className="data-table production-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Well</th>
                    <th>Field</th>
                    <th className="num">Oil · bbl</th>
                    <th className="num">Gas · Mcf</th>
                    <th className="num">Water · bbl</th>
                    <th>Water cut</th>
                    <th className="num">Online</th>
                    <th className="num">Pressure</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {data.records.content.map((record) => (
                    <tr key={record.id}>
                      <td className="mono nowrap">{formatDate(record.productionDate)}</td>
                      <td>
                        <div className="record-well">
                          <Link to={`/wells/${record.wellId}`}>{record.wellName}</Link>
                          {record.notes && (
                            <span className="note-indicator" title={record.notes}>
                              <FileText size={12} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="muted-cell">{record.fieldName}</td>
                      <td className="num mono strong">{fmtInt(record.oilBbl)}</td>
                      <td className="num mono">{fmtInt(record.gasMcf)}</td>
                      <td className="num mono">{fmtInt(record.waterBbl)}</td>
                      <td><WaterCutBar value={record.waterCutPct} /></td>
                      <td className={`num mono ${record.hoursOnline < 20 ? 'text-warn' : ''}`}>
                        {fmtNum(record.hoursOnline, 1)}h
                      </td>
                      <td className="num mono muted-cell">
                        {record.wellheadPressurePsi ? `${fmtNum(record.wellheadPressurePsi, 0)} psi` : '—'}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn icon-btn-ghost"
                            onClick={() => {
                              setEditing(record);
                              setFormOpen(true);
                            }}
                            aria-label={`Edit ${record.wellName} production for ${formatDate(record.productionDate)}`}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn-ghost danger-hover"
                            onClick={() => setDeleteTarget(record)}
                            aria-label={`Delete ${record.wellName} production for ${formatDate(record.productionDate)}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span className="table-note">Daily volumes as reported · hours online drives uptime</span>
              <Pagination
                page={data.records.page}
                totalPages={data.records.totalPages}
                totalElements={data.records.totalElements}
                pageSize={data.records.size}
                onPage={setPage}
              />
            </div>
          </>
        ) : (
          <EmptyState
            icon={Fuel}
            title="No production records"
            description="No records match this date range and filter set."
            action={
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <Plus size={15} /> Log production
              </button>
            }
          />
        )}
      </section>

      <ProductionFormModal
        open={formOpen}
        onClose={closeForm}
        record={editing}
        wells={wells.data?.content ?? []}
        defaultWellId={wellId ? Number(wellId) : undefined}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete production record?"
        message={
          deleteTarget
            ? `Remove ${deleteTarget.wellName}'s production for ${formatDate(deleteTarget.productionDate)}? This cannot be undone.`
            : ''
        }
        busy={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
