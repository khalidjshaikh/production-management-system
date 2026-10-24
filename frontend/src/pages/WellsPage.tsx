import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Layers, Pencil, Plus, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import type { LiftType, PageResponse, WellStatus, WellView } from '../api/types';
import { queryString } from '../api/client';
import { useApi, useDebouncedValue } from '../hooks/useApi';
import { useMeta } from '../context/MetaContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { WellStatusBadge } from '../components/StatusBadge';
import { WaterCutBar } from '../components/WaterCutBar';
import { WellFormModal } from '../components/WellFormModal';
import { ErrorState, PageSkeleton } from '../components/Feedback';
import { EmptyState } from '../components/EmptyState';
import { fmtDelta, fmtInt, fmtPct } from '../lib/format';

const statusFilters: Array<{ value: WellStatus | ''; label: string }> = [
  { value: '', label: 'All wells' },
  { value: 'PRODUCING', label: 'Producing' },
  { value: 'SHUT_IN', label: 'Shut in' },
  { value: 'DRILLING', label: 'Drilling' },
  { value: 'COMPLETING', label: 'Completing' },
  { value: 'PLUGGED', label: 'Plugged' },
];

export function WellsPage() {
  const { meta, refresh: refreshMeta } = useMeta();
  const { notify } = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState<WellStatus | ''>('');
  const [field, setField] = useState('');
  const [liftType, setLiftType] = useState<LiftType | ''>('');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWell, setEditingWell] = useState<WellView | null>(null);

  const path = `/wells${queryString({
    search: debouncedSearch,
    status,
    field,
    liftType,
    sort,
    page,
    size: 20,
  })}`;
  const { data, loading, refreshing, error, refresh } = useApi<PageResponse<WellView>>(path);

  const changeFilter = (action: () => void) => {
    action();
    setPage(0);
  };

  const handleSaved = (well: WellView) => {
    setModalOpen(false);
    setEditingWell(null);
    notify(editingWell ? `${well.name} updated` : `${well.name} created`);
    refresh();
    refreshMeta();
  };

  const hasFilters = Boolean(search || status || field || liftType || sort !== 'name');
  const totalWells = meta ? Object.values(meta.statusCounts ?? {}).reduce((sum, count) => sum + count, 0) : 0;

  if (loading && !data) return <PageSkeleton />;
  if (error && !data) return <ErrorState error={error} onRetry={refresh} />;

  return (
    <div className={`page wells-page ${refreshing ? 'is-refreshing' : ''}`}>
      <PageHeader
        eyebrow="Asset inventory"
        title="Wells"
        subtitle={`${fmtInt(totalWells || data?.totalElements || 0)} wells · ${meta?.fields.length ?? 0} fields · 30-day performance window`}
        actions={
          <div className="header-controls">
            <button type="button" className="icon-btn" onClick={refresh} aria-label="Refresh wells">
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setEditingWell(null);
                setModalOpen(true);
              }}
            >
              <Plus size={15} />
              Add well
            </button>
          </div>
        }
      />

      <div className="well-status-bar">
        {statusFilters.map((item) => {
          const count = item.value ? meta?.statusCounts?.[item.value] : totalWells;
          return (
            <button
              key={item.value || 'all'}
              type="button"
              className={`status-filter ${status === item.value ? 'active' : ''}`}
              onClick={() => changeFilter(() => setStatus(item.value))}
            >
              {item.value && <span className={`status-dot status-${item.value.toLowerCase()}`} />}
              <span>{item.label}</span>
              <strong>{count ?? '—'}</strong>
            </button>
          );
        })}
      </div>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={15} />
            <input
              type="search"
              placeholder="Search well, API, field or operator…"
              value={search}
              onChange={(event) => changeFilter(() => setSearch(event.target.value))}
              aria-label="Search wells"
            />
          </div>
          <div className="toolbar-filters">
            <span className="toolbar-icon">
              <SlidersHorizontal size={14} />
            </span>
            <select
              className="input input-compact"
              value={status}
              onChange={(event) => changeFilter(() => setStatus(event.target.value as WellStatus | ''))}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {meta?.wellStatuses.map((option) => (
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
              value={liftType}
              onChange={(event) => changeFilter(() => setLiftType(event.target.value as LiftType | ''))}
              aria-label="Filter by lift type"
            >
              <option value="">All lift types</option>
              {meta?.liftTypes.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              className="input input-compact"
              value={sort}
              onChange={(event) => changeFilter(() => setSort(event.target.value))}
              aria-label="Sort wells"
            >
              <option value="name">Name A–Z</option>
              <option value="-name">Name Z–A</option>
              <option value="fieldName">Field</option>
              <option value="-completionDate">Newest completion</option>
              <option value="status">Status</option>
            </select>
            {hasFilters && (
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  changeFilter(() => {
                    setSearch('');
                    setStatus('');
                    setField('');
                    setLiftType('');
                    setSort('name');
                  })
                }
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {data && data.content.length > 0 ? (
          <>
            <div className="table-wrap">
              <table className="data-table wells-table">
                <thead>
                  <tr>
                    <th>Well</th>
                    <th>Status</th>
                    <th>Lift</th>
                    <th className="num">Oil · bbl/d</th>
                    <th className="num">Gas · Mcf/d</th>
                    <th>Water cut</th>
                    <th className="num">Uptime</th>
                    <th className="num">30d trend</th>
                    <th aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {data.content.map((well) => (
                    <tr key={well.id}>
                      <td>
                        <Link to={`/wells/${well.id}`} className="well-cell">
                          <span className="well-mark">
                            <Layers size={14} />
                          </span>
                          <span>
                            <strong>{well.name}</strong>
                            <small>
                              {well.apiNumber} · {well.fieldName}
                            </small>
                          </span>
                        </Link>
                      </td>
                      <td><WellStatusBadge status={well.status} label={well.statusLabel} /></td>
                      <td className="muted-cell">{well.liftLabel ?? '—'}</td>
                      <td className="num mono strong">{fmtInt(well.metrics.oilRate)}</td>
                      <td className="num mono">{fmtInt(well.metrics.gasRate)}</td>
                      <td><WaterCutBar value={well.metrics.waterCutPct} /></td>
                      <td className={`num mono ${well.metrics.uptimePct < 90 ? 'text-warn' : ''}`}>
                        {well.metrics.recordCount > 0 ? fmtPct(well.metrics.uptimePct) : '—'}
                      </td>
                      <td className="num">
                        {well.metrics.recordCount > 0 ? (
                          <span className={`mini-delta ${well.metrics.oilDeltaPct >= 0 ? 'up' : 'down'}`}>
                            {fmtDelta(well.metrics.oilDeltaPct)}
                          </span>
                        ) : (
                          <span className="muted-cell">—</span>
                        )}
                      </td>
                      <td className="row-action">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn icon-btn-ghost"
                            onClick={() => {
                              setEditingWell(well);
                              setModalOpen(true);
                            }}
                            aria-label={`Edit ${well.name}`}
                          >
                            <Pencil size={13} />
                          </button>
                          <Link to={`/wells/${well.id}`} className="icon-btn icon-btn-ghost" aria-label={`Open ${well.name}`}>
                            <ChevronRight size={15} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span className="table-note">Rates are 30-day averages · delta vs prior 30 days</span>
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
            icon={Layers}
            title={hasFilters ? 'No wells match those filters' : 'No wells yet'}
            description={
              hasFilters
                ? 'Try widening the search or clearing the active filters.'
                : 'Create your first well to begin tracking production.'
            }
            action={
              hasFilters ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    changeFilter(() => {
                      setSearch('');
                      setStatus('');
                      setField('');
                      setLiftType('');
                    })
                  }
                >
                  Clear filters
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
                  <Plus size={15} /> Add well
                </button>
              )
            }
          />
        )}
      </section>

      <WellFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingWell(null);
        }}
        well={editingWell}
        onSaved={handleSaved}
      />
    </div>
  );
}
