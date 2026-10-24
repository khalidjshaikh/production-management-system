import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Database, Gauge, Layers, Plus, TrendingDown } from 'lucide-react';
import type { ForecastSummary, PageResponse, WellView } from '../api/types';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { KpiCard } from '../components/KpiCard';
import { ModelBadge } from '../components/StatusBadge';
import { Sparkline } from '../components/Sparkline';
import { ForecastFormModal } from '../components/ForecastFormModal';
import { EmptyState } from '../components/EmptyState';
import { ErrorState, PageSkeleton } from '../components/Feedback';
import { FORECAST, fmtCompact, fmtInt, fmtNum, fmtPct, formatDate } from '../lib/format';

export function ForecastPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { notify } = useToast();
  const [modalOpen, setModalOpen] = useState(searchParams.get('new') === '1');
  const [defaultWellId, setDefaultWellId] = useState<number | undefined>(
    searchParams.get('wellId') ? Number(searchParams.get('wellId')) : undefined,
  );

  const forecasts = useApi<ForecastSummary[]>('/forecasts');
  const wells = useApi<PageResponse<WellView>>('/wells?size=200&sort=name');

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setModalOpen(true);
      if (searchParams.get('wellId')) setDefaultWellId(Number(searchParams.get('wellId')));
    }
    // Only react to the initial navigation intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearIntent = () => {
    if (searchParams.has('new') || searchParams.has('wellId')) {
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      next.delete('wellId');
      setSearchParams(next, { replace: true });
    }
  };

  const openModal = () => {
    setDefaultWellId(undefined);
    setModalOpen(true);
  };

  if (forecasts.loading && !forecasts.data) return <PageSkeleton />;
  if (forecasts.error && !forecasts.data) {
    return <ErrorState error={forecasts.error} onRetry={forecasts.refresh} />;
  }
  const data = forecasts.data ?? [];
  const totalEur = data.reduce((sum, forecast) => sum + forecast.eurOilBbl, 0);
  const coveredWells = new Set(data.map((forecast) => forecast.wellId)).size;
  const avgDecline = data.length
    ? data.reduce((sum, forecast) => sum + forecast.diAnnualPct, 0) / data.length
    : 0;
  const latestCreated = data.length
    ? data.map((forecast) => forecast.createdAt).sort().at(-1)
    : undefined;
  const eligibleWells = wells.data?.content ?? [];
  const activeWells = eligibleWells.filter((well) => well.status === 'PRODUCING').length;
  const coverage = activeWells > 0 ? (coveredWells / activeWells) * 100 : 0;

  return (
    <div className="page forecast-page">
      <PageHeader
        eyebrow="Reserves & planning"
        title="Production forecasts"
        subtitle={`${data.length} decline forecasts · ${coveredWells} wells covered · Latest run ${formatDate(latestCreated)}`}
        actions={
          <button type="button" className="btn btn-primary" onClick={openModal}>
            <Plus size={15} />
            Run forecast
          </button>
        }
      />

      <div className="well-kpis">
        <KpiCard
          compact
          label="Forecast runs"
          value={fmtInt(data.length)}
          icon={Layers}
          accent={FORECAST}
          footer={`${coveredWells} wells covered`}
        />
        <KpiCard
          compact
          label="Aggregate P50 EUR"
          value={fmtCompact(totalEur)}
          unit="bbl"
          icon={Database}
          accent="#f0a63a"
          footer="Remaining to economic limit"
        />
        <KpiCard
          compact
          label="Average annual decline"
          value={fmtNum(avgDecline, 1)}
          unit="%"
          icon={TrendingDown}
          accent="#51d3c2"
          footer="Across active forecast runs"
        />
        <KpiCard
          compact
          label="Forecast coverage"
          value={fmtPct(coverage)}
          icon={Gauge}
          accent="#5b9dff"
          footer={`${coveredWells} of ${activeWells} active wells`}
        />
      </div>

      {data.length > 0 ? (
        <div className="forecast-grid">
          {data.map((forecast) => (
            <Link to={`/forecast/${forecast.id}`} className="forecast-card" key={forecast.id}>
              <div className="forecast-card-head">
                <div>
                  <h3>{forecast.wellName}</h3>
                  <span className="forecast-field">{forecast.fieldName}</span>
                </div>
                <ModelBadge model={forecast.model} label={forecast.modelLabel} />
              </div>
              <div className="forecast-title">{forecast.name}</div>
              <div className="forecast-spark">
                <Sparkline values={forecast.preview} color={FORECAST} width={340} height={62} />
              </div>
              <div className="forecast-stats">
                <div>
                  <span>Next month</span>
                  <strong>{fmtInt(forecast.nextMonthOilRate)}</strong>
                  <em>bbl/d</em>
                </div>
                <div>
                  <span>Annual decline</span>
                  <strong>{fmtNum(forecast.diAnnualPct, 1)}%</strong>
                  <em>{forecast.bFactor > 0 ? `b ${forecast.bFactor.toFixed(2)}` : 'exponential'}</em>
                </div>
                <div>
                  <span>P50 EUR</span>
                  <strong>{fmtCompact(forecast.eurOilBbl)}</strong>
                  <em>bbl</em>
                </div>
                <div>
                  <span>Horizon</span>
                  <strong>{forecast.horizonMonths}</strong>
                  <em>months</em>
                </div>
              </div>
              <div className="forecast-card-foot">
                <span>
                  Base {formatDate(forecast.baseDate)} · Run {formatDate(forecast.createdAt)}
                </span>
                <span className="forecast-open">
                  Open <ArrowUpRight size={13} />
                </span>
              </div>
            </Link>
          ))}
          <button type="button" className="forecast-card forecast-card-add" onClick={openModal}>
            <span className="add-icon"><Plus size={20} /></span>
            <strong>Run another forecast</strong>
            <span>Fit another well’s decline curve</span>
          </button>
        </div>
      ) : (
        <Panel>
          <EmptyState
            icon={TrendingDown}
            title="No forecasts yet"
            description="Fit a decline curve to a producing well to project future oil, gas and water rates."
            action={
              <button type="button" className="btn btn-primary" onClick={openModal}>
                <Plus size={15} /> Run the first forecast
              </button>
            }
          />
        </Panel>
      )}

      <Panel className="method-panel" title="How the forecast is built" subtitle="Transparent decline-curve workflow">
        <div className="method-grid">
          <div className="method-item">
            <span className="method-number">01</span>
            <div>
              <h4>Fit the history</h4>
              <p>
                Up to 18 months of monthly oil rates are fit with an Arps exponential or hyperbolic curve.
                Model quality is reported as R².
              </p>
            </div>
          </div>
          <div className="method-item">
            <span className="method-number">02</span>
            <div>
              <h4>Project the decline</h4>
              <p>
                Oil rates continue from the latest production date. Gas follows recent GOR while water cut
                carries forward its measured trend.
              </p>
            </div>
          </div>
          <div className="method-item">
            <span className="method-number">03</span>
            <div>
              <h4>Bound the outcome</h4>
              <p>
                The P10–P90 band applies rate and decline sensitivity. EUR integrates recoverable oil to the
                selected economic limit.
              </p>
            </div>
          </div>
        </div>
      </Panel>

      <ForecastFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          clearIntent();
        }}
        wells={eligibleWells}
        defaultWellId={defaultWellId}
        onSaved={(forecast) => {
          setModalOpen(false);
          clearIntent();
          notify(`Forecast created for ${forecast.summary.wellName}`);
          forecasts.refresh();
          navigate(`/forecast/${forecast.summary.id}`);
        }}
      />
    </div>
  );
}
