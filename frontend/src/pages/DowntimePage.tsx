import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ChevronRight,
  CircleAlert,
  Clock3,
  Flame,
  Fuel,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type {
  DowntimeCategory,
  DowntimeSummary,
  DowntimeView,
  PageResponse,
  WellView,
} from '../api/types';
import { api, queryString } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useMeta } from '../context/MetaContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { KpiCard } from '../components/KpiCard';
import { SegmentedControl } from '../components/SegmentedControl';
import { Pagination } from '../components/Pagination';
import { CategoryBadge, categoryColor } from '../components/StatusBadge';
import { DowntimeCategoryChart } from '../components/charts/DowntimeCategoryChart';
import { DowntimeTrendChart } from '../components/charts/DowntimeTrendChart';
import { DowntimeFormModal } from '../components/DowntimeFormModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { ErrorState, PageSkeleton } from '../components/Feedback';
import { fmtInt, fmtNum, formatDateTime, timeAgo } from '../lib/format';

type SummaryRange = 30 | 90 | 180;
type StatusFilter = 'ALL' | 'ACTIVE' | 'RESOLVED';

export function DowntimePage() {
  const [searchParams] = useSearchParams();
  const { meta } = useMeta();
  const { notify } = useToast();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [category, setCategory] = useState<DowntimeCategory | ''>('');
  const [field, setField] = useState('');
  const [wellId, setWellId] = useState(searchParams.get('wellId') ?? '');
  const [page, setPage] = useState(0);
  const [summaryRange, setSummaryRange] = useState<SummaryRange>(90);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DowntimeView | null>(null);
  const [resolveMode, setResolveMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DowntimeView | null>(null);
  const [deleting, setDeleting] = useState(false);

  const path = `/downtime${queryString({
    status: status === 'ALL' ? undefined : status,
    category: category || undefined,
    wellId: wellId || undefined,
    field: field || undefined,
    page,
    size: 15,
  })}`;
  const { data, loading, refreshing, error, refresh } = useApi<PageResponse<DowntimeView>>(path);
  const summary = useApi<DowntimeSummary>(`/downtime/summary?days=${summaryRange}`);
  const wells = useApi<PageResponse<WellView>>('/wells?size=200&sort=name');

  const changeFilter = (action: () => void) => {
    action();
    setPage(0);
  };

  const refreshAll = () => {
    refresh();
    summary.refresh();
  };

  const openCreate = () => {
    setEditing(null);
    setResolveMode(false);
    setFormOpen(true);
  };

  const openResolve = (event: DowntimeView) => {
    setEditing(event);
    setResolveMode(true);
    setFormOpen(true);
  };

  const handleSaved = () => {
    setFormOpen(false);
    setEditing(null);
    setResolveMode(false);
    notify(resolveMode ? 'Downtime event resolved' : editing ? 'Downtime event updated' : 'Downtime reported');
    refreshAll();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/downtime/${deleteTarget.id}`);
      notify('Downtime event deleted');
      setDeleteTarget(null);
      if (data && data.content.length === 1 && page > 0) setPage(page - 1);
      refreshAll();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (loading && !data) return <PageSkeleton />;
  if (error && !data) return <ErrorState error={error} onRetry={refresh} />;
  if (!data) return null;

  const selectedWell = wells.data?.content.find((well) => String(well.id) === wellId);
  const activeFilter = status !== 'ALL' || category || field || wellId;

  return (
    <div className={`page downtime-page ${refreshing ? 'is-refreshing' : ''}`}>
      <PageHeader
        eyebrow="Reliability & deferment"
        title="Downtime"
        subtitle="Track outages, deferred volumes and field reliability across the asset."
        actions={
          <div className="header-controls">
            <SegmentedControl
              ariaLabel="Downtime summary range"
              value={summaryRange}
              onChange={(value) => setSummaryRange(value as SummaryRange)}
              options={[
                { value: 30, label: '30D' },
                { value: 90, label: '90D' },
                { value: 180, label: '180D' },
              ]}
            />
            <button type="button" className="icon-btn" onClick={refreshAll} aria-label="Refresh downtime">
              <RefreshCw size={15} className={refreshing || summary.refreshing ? 'spin' : ''} />
            </button>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <Plus size={15} />
              Report downtime
            </button>
          </div>
        }
      />

      <div className="well-kpis">
        <KpiCard
          compact
          label="Active events"
          value={fmtInt(summary.data?.activeEvents ?? 0)}
          icon={CircleAlert}
          accent="#f0736d"
          footer={`Across the asset right now`}
        />
        <KpiCard
          compact
          label="Deferred oil"
          value={fmtInt(summary.data?.deferredOilBbl ?? 0)}
          unit="bbl"
          icon={Fuel}
          accent="#f0a63a"
          footer={`Last ${summaryRange} days`}
        />
        <KpiCard
          compact
          label="Deferred gas"
          value={fmtInt(summary.data?.deferredGasMcf ?? 0)}
          unit="Mcf"
          icon={Flame}
          accent="#51d3c2"
          footer={`Last ${summaryRange} days`}
        />
        <KpiCard
          compact
          label="Avg resolution"
          value={fmtNum(summary.data?.avgResolutionHours ?? 0, 1)}
          unit="h"
          icon={Clock3}
          accent="#b49bff"
          footer={`${fmtNum(summary.data?.totalDowntimeHours ?? 0, 1)} total downtime hours`}
        />
      </div>

      <div className="downtime-charts">
        <Panel title="Downtime by reason" subtitle={`Hours · last ${summaryRange} days`}>
          {summary.data && summary.data.categories.length > 0 ? (
            <DowntimeCategoryChart categories={summary.data.categories} />
          ) : (
            <EmptyState icon={Clock3} title="No downtime in window" description="Reliability is looking clean." />
          )}
        </Panel>
        <Panel title="Downtime hours" subtitle={`Daily reported outage hours · last ${summaryRange} days`}>
          {summary.data && summary.data.series.length > 0 ? (
            <DowntimeTrendChart data={summary.data.series} height={252} />
          ) : (
            <EmptyState icon={CircleAlert} title="No downtime trend" description="Events will populate this chart." />
          )}
        </Panel>
      </div>

      <section className="panel table-panel">
        <div className="table-toolbar table-toolbar-wrap">
          <div className="status-tabs" role="group" aria-label="Filter downtime status">
            {(['ALL', 'ACTIVE', 'RESOLVED'] as StatusFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                className={`status-tab ${status === value ? 'active' : ''}`}
                onClick={() => changeFilter(() => setStatus(value))}
              >
                {value === 'ALL' ? 'All events' : value === 'ACTIVE' ? 'Active' : 'Resolved'}
                {value === 'ACTIVE' && summary.data?.activeEvents ? (
                  <span className="status-tab-count">{summary.data.activeEvents}</span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="toolbar-filters">
            <select
              className="input input-compact"
              value={category}
              onChange={(event) => changeFilter(() => setCategory(event.target.value as DowntimeCategory | ''))}
              aria-label="Filter by reason"
            >
              <option value="">All reasons</option>
              {meta?.downtimeCategories.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              className="input input-compact"
              value={field}
              onChange={(event) => changeFilter(() => setField(event.target.value))}
              aria-label="Filter by field"
            >
              <option value="">All fields</option>
              {meta?.fields.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <select
              className="input input-compact"
              value={wellId}
              onChange={(event) => changeFilter(() => setWellId(event.target.value))}
              aria-label="Filter by well"
            >
              <option value="">All wells</option>
              {wells.data?.content.map((well) => (
                <option key={well.id} value={well.id}>{well.name}</option>
              ))}
            </select>
            {activeFilter && (
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  changeFilter(() => {
                    setStatus('ALL');
                    setCategory('');
                    setField('');
                    setWellId('');
                  })
                }
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {selectedWell && (
          <div className="active-filter-bar">
            <span>
              Showing events for <strong>{selectedWell.name}</strong> · {selectedWell.fieldName}
            </span>
            <Link to={`/wells/${selectedWell.id}`} className="text-link">
              Well detail <ChevronRight size={13} />
            </Link>
          </div>
        )}

        {data.content.length > 0 ? (
          <>
            <div className="table-wrap">
              <table className="data-table downtime-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Well</th>
                    <th>Reason</th>
                    <th>Event</th>
                    <th className="num">Duration</th>
                    <th className="num">Deferred</th>
                    <th>Reported by</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {data.content.map((event) => (
                    <tr key={event.id}>
                      <td>
                        {event.active ? (
                          <span className="badge badge-danger"><span className="badge-dot" />Active</span>
                        ) : (
                          <span className="badge badge-muted"><span className="badge-dot" />Resolved</span>
                        )}
                      </td>
                      <td>
                        <Link to={`/wells/${event.wellId}`} className="table-primary-link">{event.wellName}</Link>
                        <div className="table-sub">{event.fieldName}</div>
                      </td>
                      <td><CategoryBadge category={event.category} label={event.categoryLabel} /></td>
                      <td className="event-detail-cell">
                        <strong>{event.description}</strong>
                        <span>
                          {formatDateTime(event.startTime)}
                          {event.endTime ? ` → ${formatDateTime(event.endTime)}` : ' · ongoing'}
                        </span>
                      </td>
                      <td className="num mono">
                        <span className={`duration-chip ${event.active ? 'duration-active' : ''}`}>
                          {fmtNum(event.durationHours, 1)}h
                        </span>
                      </td>
                      <td className="num">
                        <div className="deferred-stack">
                          <strong>{fmtInt(event.deferredOilBbl ?? 0)} bbl</strong>
                          <span>{fmtInt(event.deferredGasMcf ?? 0)} Mcf</span>
                        </div>
                      </td>
                      <td>
                        <span className="reporter">{event.reportedBy ?? 'Operations'}</span>
                        <div className="table-sub">{timeAgo(event.startTime)}</div>
                      </td>
                      <td>
                        <div className="row-actions">
                          {event.active && (
                            <button
                              type="button"
                              className="btn btn-xs btn-secondary"
                              onClick={() => openResolve(event)}
                            >
                              Resolve
                            </button>
                          )}
                          <button
                            type="button"
                            className="icon-btn icon-btn-ghost"
                            onClick={() => {
                              setEditing(event);
                              setResolveMode(false);
                              setFormOpen(true);
                            }}
                            aria-label={`Edit ${event.wellName} downtime`}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn-ghost danger-hover"
                            onClick={() => setDeleteTarget(event)}
                            aria-label={`Delete ${event.wellName} downtime`}
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
              <span className="table-note">Deferred volumes may be auto-estimated from prior rates</span>
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                totalElements={data.totalElements}
                pageSize={data.size}
                onPage={setPage}
              />
            </div>
          </>
        ) : (
          <EmptyState
            icon={CircleAlert}
            title={activeFilter ? 'No events match these filters' : 'No downtime events'}
            description={
              activeFilter
                ? 'Try clearing a filter or widening the event status.'
                : 'Reliability is clean — report an event if a well goes offline.'
            }
            action={
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <Plus size={15} /> Report downtime
              </button>
            }
          />
        )}
      </section>

      <div className="reason-key">
        {meta?.downtimeCategories.map((option) => (
          <span key={option.value}>
            <i style={{ background: categoryColor(option.value as DowntimeCategory) }} />
            {option.label}
          </span>
        ))}
      </div>

      <DowntimeFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setResolveMode(false);
        }}
        event={editing}
        wells={wells.data?.content ?? []}
        defaultWellId={wellId ? Number(wellId) : undefined}
        resolve={resolveMode}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete downtime event?"
        message={
          deleteTarget
            ? `Remove the ${deleteTarget.categoryLabel.toLowerCase()} event for ${deleteTarget.wellName}? This cannot be undone.`
            : ''
        }
        busy={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
