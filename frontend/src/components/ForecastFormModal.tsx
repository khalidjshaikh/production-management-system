import { useEffect, useState, type FormEvent } from 'react';
import { LoaderCircle, TrendingDown } from 'lucide-react';
import type { ForecastDetail, ForecastModel, GenerateForecastRequest, WellView } from '../api/types';
import { api, ApiError } from '../api/client';
import { useMeta } from '../context/MetaContext';
import { Modal } from './Modal';
import { FormField } from './FormField';

interface ForecastFormModalProps {
  open: boolean;
  onClose: () => void;
  wells: WellView[];
  defaultWellId?: number;
  onSaved: (forecast: ForecastDetail) => void;
}

export function ForecastFormModal({ open, onClose, wells, defaultWellId, onSaved }: ForecastFormModalProps) {
  const { meta } = useMeta();
  const eligible = wells.filter((well) => well.status === 'PRODUCING' || well.status === 'SHUT_IN');
  const [wellId, setWellId] = useState('');
  const [model, setModel] = useState<ForecastModel>('HYPERBOLIC');
  const [horizon, setHorizon] = useState('24');
  const [economicLimit, setEconomicLimit] = useState('15');
  const [bFactor, setBFactor] = useState('0.8');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fallback =
      (defaultWellId && eligible.some((well) => well.id === defaultWellId) ? defaultWellId : undefined) ??
      eligible[0]?.id;
    setWellId(fallback ? String(fallback) : '');
    setModel('HYPERBOLIC');
    setHorizon('24');
    setEconomicLimit('15');
    setBFactor('0.8');
    setName('');
    setErrors({});
    setGeneralError('');
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultWellId, wells]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const clientErrors: Record<string, string> = {};
    if (!wellId) clientErrors.wellId = 'Select a well';
    if (Number(horizon) < 6 || Number(horizon) > 60) clientErrors.horizonMonths = 'Horizon must be 6–60 months';
    if (Number(economicLimit) <= 0) clientErrors.economicLimitBopd = 'Economic limit must be positive';
    if (model === 'HYPERBOLIC' && (Number(bFactor) < 0 || Number(bFactor) > 1.2)) {
      clientErrors.bFactor = 'b-factor must be between 0 and 1.2';
    }
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    const payload: GenerateForecastRequest = {
      wellId: Number(wellId),
      model,
      horizonMonths: Number(horizon),
      economicLimitBopd: Number(economicLimit),
      bFactor: model === 'HYPERBOLIC' ? Number(bFactor) : null,
      name: name.trim() || null,
    };

    setSaving(true);
    setGeneralError('');
    setErrors({});
    try {
      const forecast = await api.post<ForecastDetail>('/forecasts', payload);
      onSaved(forecast);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setGeneralError(error.message);
      } else {
        setGeneralError((error as Error).message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Run production forecast"
      subtitle="Fit an Arps decline curve and project oil, gas and water rates."
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="forecast-form" className="btn btn-primary" disabled={saving || eligible.length === 0}>
            {saving && <LoaderCircle size={14} className="spin" />}
            {saving ? 'Fitting curve…' : 'Run forecast'}
          </button>
        </>
      }
    >
      <form id="forecast-form" className="form-grid" onSubmit={handleSubmit} autoComplete="off">
        {generalError && <div className="form-error-banner">{generalError}</div>}
        {eligible.length === 0 && (
          <div className="form-callout span-2">
            No wells are available for forecasting. Add production history to a producing well first.
          </div>
        )}
        <FormField label="Well" htmlFor="fc-well" required error={errors.wellId} className="span-2">
          <select id="fc-well" className="input" value={wellId} onChange={(e) => setWellId(e.target.value)}>
            <option value="">Select a well</option>
            {eligible.map((well) => (
              <option key={well.id} value={well.id}>
                {well.name} · {well.fieldName} · {well.statusLabel}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Decline model" htmlFor="fc-model" required>
          <select
            id="fc-model"
            className="input"
            value={model}
            onChange={(e) => setModel(e.target.value as ForecastModel)}
          >
            {meta?.forecastModels.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Horizon" htmlFor="fc-horizon" required error={errors.horizonMonths}>
          <div className="input-with-suffix">
            <input
              id="fc-horizon"
              type="number"
              min="6"
              max="60"
              step="1"
              className="input"
              value={horizon}
              onChange={(e) => setHorizon(e.target.value)}
            />
            <span>months</span>
          </div>
        </FormField>
        <FormField
          label="Economic limit"
          htmlFor="fc-limit"
          required
          error={errors.economicLimitBopd}
          hint="Forecast stops when oil falls below this rate"
        >
          <div className="input-with-suffix">
            <input
              id="fc-limit"
              type="number"
              min="1"
              step="1"
              className="input"
              value={economicLimit}
              onChange={(e) => setEconomicLimit(e.target.value)}
            />
            <span>bbl/d</span>
          </div>
        </FormField>
        {model === 'HYPERBOLIC' && (
          <FormField label="b-factor" htmlFor="fc-b" error={errors.bFactor} hint="Arps curvature, 0–1.2">
            <input
              id="fc-b"
              type="number"
              min="0"
              max="1.2"
              step="0.05"
              className="input mono"
              value={bFactor}
              onChange={(e) => setBFactor(e.target.value)}
            />
          </FormField>
        )}
        <FormField label="Forecast name" htmlFor="fc-name" className={model === 'HYPERBOLIC' ? 'span-2' : ''}>
          <input
            id="fc-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Optional · defaults to a P50 base case label"
          />
        </FormField>
        <div className="form-callout span-2">
          <TrendingDown size={16} />
          <p>
            The model fits up to 18 months of monthly oil rates. Gas follows the recent GOR and water cut
            carries forward its recent trend. The P10–P90 band applies rate and decline sensitivity.
          </p>
        </div>
      </form>
    </Modal>
  );
}
