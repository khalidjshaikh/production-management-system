import { useEffect, useState, type FormEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { ProductionRecordView, ProductionUpsertRequest, WellView } from '../api/types';
import { api, ApiError } from '../api/client';
import { Modal } from './Modal';
import { FormField } from './FormField';
import { fmtNum, toDateInput } from '../lib/format';

interface ProductionFormModalProps {
  open: boolean;
  onClose: () => void;
  record?: ProductionRecordView | null;
  wells: WellView[];
  defaultWellId?: number;
  onSaved: () => void;
}

interface FormState {
  wellId: string;
  productionDate: string;
  oilBbl: string;
  gasMcf: string;
  waterBbl: string;
  hoursOnline: string;
  wellheadPressurePsi: string;
  chokeSize64ths: string;
  notes: string;
}

export function ProductionFormModal({
  open,
  onClose,
  record,
  wells,
  defaultWellId,
  onSaved,
}: ProductionFormModalProps) {
  const [form, setForm] = useState<FormState>({
    wellId: '',
    productionDate: toDateInput(),
    oilBbl: '',
    gasMcf: '',
    waterBbl: '',
    hoursOnline: '24',
    wellheadPressurePsi: '',
    chokeSize64ths: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (record) {
      setForm({
        wellId: String(record.wellId),
        productionDate: record.productionDate,
        oilBbl: String(record.oilBbl),
        gasMcf: String(record.gasMcf),
        waterBbl: String(record.waterBbl),
        hoursOnline: String(record.hoursOnline),
        wellheadPressurePsi: record.wellheadPressurePsi != null ? String(record.wellheadPressurePsi) : '',
        chokeSize64ths: record.chokeSize64ths != null ? String(record.chokeSize64ths) : '',
        notes: record.notes ?? '',
      });
    } else {
      const fallbackWell = defaultWellId ?? wells.find((well) => well.status === 'PRODUCING')?.id ?? wells[0]?.id;
      setForm({
        wellId: fallbackWell ? String(fallbackWell) : '',
        productionDate: toDateInput(),
        oilBbl: '',
        gasMcf: '',
        waterBbl: '',
        hoursOnline: '24',
        wellheadPressurePsi: '',
        chokeSize64ths: '',
        notes: '',
      });
    }
    setErrors({});
    setGeneralError('');
    setSaving(false);
  }, [open, record, defaultWellId, wells]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const waterCut = (() => {
    const oil = Number(form.oilBbl) || 0;
    const water = Number(form.waterBbl) || 0;
    return oil + water > 0 ? (water / (oil + water)) * 100 : 0;
  })();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const clientErrors: Record<string, string> = {};
    if (!form.wellId) clientErrors.wellId = 'Select a well';
    if (!form.productionDate) clientErrors.productionDate = 'Production date is required';
    if (form.productionDate > toDateInput()) clientErrors.productionDate = 'Date cannot be in the future';
    if (Number(form.hoursOnline) < 0 || Number(form.hoursOnline) > 24) {
      clientErrors.hoursOnline = 'Hours must be between 0 and 24';
    }
    (['oilBbl', 'gasMcf', 'waterBbl'] as const).forEach((field) => {
      if (form[field] === '' || Number(form[field]) < 0 || Number.isNaN(Number(form[field]))) {
        clientErrors[field] = 'Enter a value of zero or greater';
      }
    });
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    const payload: ProductionUpsertRequest = {
      wellId: Number(form.wellId),
      productionDate: form.productionDate,
      oilBbl: Number(form.oilBbl),
      gasMcf: Number(form.gasMcf),
      waterBbl: Number(form.waterBbl),
      hoursOnline: Number(form.hoursOnline),
      wellheadPressurePsi: form.wellheadPressurePsi ? Number(form.wellheadPressurePsi) : null,
      chokeSize64ths: form.chokeSize64ths ? Number(form.chokeSize64ths) : null,
      notes: form.notes.trim() || null,
    };

    setSaving(true);
    setGeneralError('');
    setErrors({});
    try {
      if (record) {
        await api.put(`/production/${record.id}`, payload);
      } else {
        await api.post('/production', payload);
      }
      onSaved();
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
      title={record ? 'Edit production record' : 'Log daily production'}
      subtitle={record ? `${record.wellName} · ${record.productionDate}` : 'Record measured oil, gas and water volumes.'}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="production-form" className="btn btn-primary" disabled={saving}>
            {saving && <LoaderCircle size={14} className="spin" />}
            {saving ? 'Saving…' : record ? 'Save changes' : 'Log production'}
          </button>
        </>
      }
    >
      <form id="production-form" className="form-grid" onSubmit={handleSubmit} autoComplete="off">
        {generalError && <div className="form-error-banner">{generalError}</div>}
        <FormField label="Well" htmlFor="prod-well" required error={errors.wellId} className="span-2">
          <select
            id="prod-well"
            className="input"
            value={form.wellId}
            onChange={(event) => update('wellId', event.target.value)}
          >
            <option value="">Select a well</option>
            {wells.map((well) => (
              <option key={well.id} value={well.id}>
                {well.name} · {well.fieldName}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Production date" htmlFor="prod-date" required error={errors.productionDate}>
          <input
            id="prod-date"
            type="date"
            className="input"
            max={toDateInput()}
            value={form.productionDate}
            onChange={(event) => update('productionDate', event.target.value)}
          />
        </FormField>
        <FormField label="Hours online" htmlFor="prod-hours" error={errors.hoursOnline} hint="0–24 hours recorded">
          <div className="input-with-suffix">
            <input
              id="prod-hours"
              type="number"
              min="0"
              max="24"
              step="0.5"
              className="input"
              value={form.hoursOnline}
              onChange={(event) => update('hoursOnline', event.target.value)}
            />
            <span>hrs</span>
          </div>
        </FormField>
        <FormField label="Oil" htmlFor="prod-oil" required error={errors.oilBbl}>
          <div className="input-with-suffix">
            <input
              id="prod-oil"
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.oilBbl}
              onChange={(event) => update('oilBbl', event.target.value)}
              placeholder="0"
            />
            <span>bbl</span>
          </div>
        </FormField>
        <FormField label="Gas" htmlFor="prod-gas" required error={errors.gasMcf}>
          <div className="input-with-suffix">
            <input
              id="prod-gas"
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.gasMcf}
              onChange={(event) => update('gasMcf', event.target.value)}
              placeholder="0"
            />
            <span>Mcf</span>
          </div>
        </FormField>
        <FormField label="Water" htmlFor="prod-water" required error={errors.waterBbl}>
          <div className="input-with-suffix">
            <input
              id="prod-water"
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.waterBbl}
              onChange={(event) => update('waterBbl', event.target.value)}
              placeholder="0"
            />
            <span>bbl</span>
          </div>
        </FormField>
        <FormField label="Water cut preview" htmlFor="prod-wc">
          <div className="input-readonly" id="prod-wc">
            {fmtNum(waterCut, 1)}%
            <span className="readonly-note">derived</span>
          </div>
        </FormField>
        <FormField label="Wellhead pressure" htmlFor="prod-pressure" error={errors.wellheadPressurePsi}>
          <div className="input-with-suffix">
            <input
              id="prod-pressure"
              type="number"
              min="0"
              step="1"
              className="input"
              value={form.wellheadPressurePsi}
              onChange={(event) => update('wellheadPressurePsi', event.target.value)}
              placeholder="1,840"
            />
            <span>psi</span>
          </div>
        </FormField>
        <FormField label="Choke size" htmlFor="prod-choke" error={errors.chokeSize64ths}>
          <div className="input-with-suffix">
            <input
              id="prod-choke"
              type="number"
              min="0"
              step="1"
              className="input"
              value={form.chokeSize64ths}
              onChange={(event) => update('chokeSize64ths', event.target.value)}
              placeholder="34"
            />
            <span>/64"</span>
          </div>
        </FormField>
        <FormField label="Notes" htmlFor="prod-notes" className="span-2">
          <textarea
            id="prod-notes"
            className="input textarea"
            rows={3}
            value={form.notes}
            onChange={(event) => update('notes', event.target.value)}
            placeholder="Choke change, meter verification, operational notes…"
          />
        </FormField>
      </form>
    </Modal>
  );
}
