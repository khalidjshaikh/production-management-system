import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Database, Fuel, Gauge, Plus, Trash2, TrendingDown } from 'lucide-react';
import type { ForecastDetail } from '../api/types';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useMeta } from '../context/MetaContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { KpiCard } from '../components/KpiCard';
import { ModelBadge } from '../components/StatusBadge';
import { ForecastProjectionChart } from '../components/charts/ForecastProjectionChart';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { ErrorState, PageSkeleton } from '../components/Feedback';
import {
  FORECAST,
  OIL,
  fmtCompact,
  fmtInt,
  fmtNum,
  fmtPct,
  formatDate,
  formatDateTime,
  formatMonth,
} from '../lib/format';

export function ForecastDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refresh: refreshMeta } = useMeta();
  const { notify } = useToast();
  const forecastId = Number(id);
  const { data, loading, error, refresh } = useApi<ForecastDetail>(
    Number.isFinite(forecastId) ? `/forecasts/${forecastId}` : null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (loading && !data) return <PageSkeleton />;
  if (error && !data) {
    return (
      <div className="page">
        <Link to="/forecast" className="back-link">
          <ArrowLeft size={14} /> Back to forecasts
        </Link>
        <ErrorState error={error} onRetry={refresh} />
      </div>
    );
  }
  if (!data) return null;

  const { summary, points } = data;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/forecasts/${forecastId}`);
      notify('Forecast deleted');
      refreshMeta();
      navigate('/forecast');
    } catch (err) {
      notify((err as Error).message, 'error');
      setDeleting(false);
    }
  };

  return (
    <div className="page forecast-detail-page">
      <Link to="/forecast" className="back-link">
        <ArrowLeft size={14} /> Back to forecasts
      </Link>

      <PageHeader
        eyebrow="Decline forecast"
        title={summary.wellName}
        subtitle={
          <span className="well-subline">
            {summary.name}
            <span className="subtitle-dot">·</span>
            {summary.fieldName}
            <span className="subtitle-dot">·</span>
            Base {formatDate(summary.baseDate)}
            <ModelBadge model={summary.model} label={summary.modelLabel} />
          </span>
        }
        actions={
          <div className="header-controls">
            <Link to={`/forecast?wellId=${summary.wellId}&new=1`} className="btn btn-secondary">
              <Plus size={14} />
              New forecast
            </Link>
            <button
              type="button"
              className="icon-btn btn-danger-ghost"
              onClick={() => setConfirmOpen(true)}
              aria-label="Delete forecast"
            >
              <Trash2 size={15} />
            </button>
          </div>
        }
      />

      <div className="well-kpis">
        <KpiCard
          compact
          label="Next month oil"
          value={fmtInt(summary.nextMonthOilRate)}
          unit="bbl/d"
          icon={Fuel}
          accent={OIL}
          footer={`${summary.horizonMonths}-month projection`}
        />
        <KpiCard
          compact
          label="Annual decline"
          value={fmtNum(summary.diAnnualPct, 1)}
          unit="%"
          icon={TrendingDown}
          accent={FORECAST}
          footer={
            summary.bFactor > 0
              ? `Hyperbolic · b ${summary.bFactor.toFixed(2)}`
              : 'Exponential decline'
          }
        />
        <KpiCard
          compact
          label="P50 EUR"
          value={fmtCompact(summary.eurOilBbl)}
          unit="bbl"
          icon={Database}
          accent="#f0a63a"
          footer={`To ${fmtInt(summary.economicLimitBopd)} bbl/d economic limit`}
        />
        <KpiCard
          compact
          label="Curve fit"
          value={fmtPct(data.rSquared, 1)}
          icon={Gauge}
          accent="#51d3c2"
          footer={`${data.monitoredMonths} months fitted`}
        />
      </div>

      <div className="forecast-detail-grid">
        <Panel
          title="Oil rate projection"
          subtitle="Actual production and P50 forecast with P10–P90 band"
          className="chart-panel"
        >
          {points.length > 0 ? (
            <ForecastProjectionChart
              actuals={data.actuals}
              points={points}
              baseDate={summary.baseDate}
              height={352}
            />
          ) : (
            <EmptyState icon={TrendingDown} title="No forecast points" description="This forecast has no projection data." />
          )}
        </Panel>

        <Panel title="Model parameters" subtitle="Decline fit and assumptions">
          <dl className="detail-list detail-list-tight">
            <div>
              <dt>Model</dt>
              <dd>{summary.modelLabel}</dd>
            </div>
            <div>
              <dt>b-factor</dt>
              <dd className="mono">{summary.bFactor.toFixed(2)}</dd>
            </div>
            <div>
              <dt>Initial rate (qi)</dt>
              <dd className="mono">{fmtInt(summary.qiOil)} bbl/d</dd>
            </div>
            <div>
              <dt>Economic limit</dt>
              <dd className="mono">{fmtInt(summary.economicLimitBopd)} bbl/d</dd>
            </div>
            <div>
              <dt>Horizon</dt>
              <dd className="mono">{summary.horizonMonths} months</dd>
            </div>
            <div>
              <dt>GOR assumption</dt>
              <dd className="mono">{fmtNum(data.gorMcfPerBbl, 3)} Mcf/bbl</dd>
            </div>
            <div>
              <dt>Initial water cut</dt>
              <dd className="mono">{fmtPct(data.initialWaterCutPct)}</dd>
            </div>
            <div>
              <dt>Base date</dt>
              <dd>{formatDate(summary.baseDate)}</dd>
            </div>
            <div>
              <dt>Run</dt>
              <dd>{formatDateTime(summary.createdAt)}</dd>
            </div>
          </dl>
          <div className="model-note">
            <Database size={15} />
            <p>
              P50 volume assumes current operating practices continue. The low/high band applies a 12% rate
              sensitivity and 25% decline sensitivity.
            </p>
          </div>
        </Panel>
      </div>

      <Panel
        title="Monthly forecast"
        subtitle={`${points.length} projected months · cumulative oil from ${formatDate(summary.baseDate)}`}
        flush
      >
        {points.length > 0 ? (
          <div className="table-wrap forecast-table-wrap">
            <table className="data-table forecast-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="num">P50 oil · bbl/d</th>
                  <th className="num">P10 · bbl/d</th>
                  <th className="num">P90 · bbl/d</th>
                  <th className="num">Gas · Mcf/d</th>
                  <th className="num">Water · bbl/d</th>
                  <th className="num">Cumulative oil · bbl</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) => (
                  <tr key={point.monthIndex}>
                    <td className="nowrap">{formatMonth(point.date)}</td>
                    <td className="num mono strong">{fmtInt(point.oilRate)}</td>
                    <td className="num mono muted-cell">{fmtInt(point.oilLowRate)}</td>
                    <td className="num mono muted-cell">{fmtInt(point.oilHighRate)}</td>
                    <td className="num mono">{fmtInt(point.gasRate)}</td>
                    <td className="num mono">{fmtInt(point.waterRate)}</td>
                    <td className="num mono">{fmtInt(point.cumulativeOilBbl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={TrendingDown} title="No projected months" description="Run the forecast again with a longer horizon." />
        )}
      </Panel>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this forecast?"
        message={`Remove the forecast for ${summary.wellName} from ${formatDate(summary.baseDate)}? This cannot be undone.`}
        busy={deleting}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
