import { useEffect, useState, type FormEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { DowntimeCategory, DowntimeUpsertRequest, DowntimeView, WellView } from '../api/types';
import { api, ApiError } from '../api/client';
import { useMeta } from '../context/MetaContext';
import { Modal } from './Modal';
import { FormField } from './FormField';
import { toDateTimeInput } from '../lib/format';

interface DowntimeFormModalProps {
  open: boolean;
  onClose: () => void;
  event?: DowntimeView | null;
  wells: WellView[];
  defaultWellId?: number;
  resolve?: boolean;
  onSaved: () => void;
}

interface FormState {
  wellId: string;
  startTime: string;
  endTime: string;
  category: DowntimeCategory;
  description: string;
  deferredOilBbl: string;
  deferredGasMcf: string;
  reportedBy: string;
}

function localInput(value: string): string {
  return toDateTimeInput(new Date(value));
}

export function DowntimeFormModal({
  open,
  onClose,
  event,
  wells,
  defaultWellId,
  resolve = false,
  onSaved,
}: DowntimeFormModalProps) {
  const { meta } = useMeta();
  const [form, setForm] = useState<FormState>({
    wellId: '',
    startTime: toDateTimeInput(),
    endTime: '',
    category: 'EQUIPMENT_FAILURE',
    description: '',
    deferredOilBbl: '',
    deferredGasMcf: '',
    reportedBy: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (event) {
      setForm({
        wellId: String(event.wellId),
        startTime: localInput(event.startTime),
        endTime: resolve ? toDateTimeInput() : event.endTime ? localInput(event.endTime) : '',
        category: event.category,
        description: event.description,
        deferredOilBbl: event.deferredOilBbl != null ? String(event.deferredOilBbl) : '',
        deferredGasMcf: event.deferredGasMcf != null ? String(event.deferredGasMcf) : '',
        reportedBy: event.reportedBy ?? '',
      });
    } else {
      const fallbackWell = defaultWellId ?? wells.find((well) => well.status === 'PRODUCING')?.id ?? wells[0]?.id;
      setForm({
        wellId: fallbackWell ? String(fallbackWell) : '',
        startTime: toDateTimeInput(),
        endTime: '',
        category: 'EQUIPMENT_FAILURE',
        description: '',
        deferredOilBbl: '',
        deferredGasMcf: '',
        reportedBy: '',
      });
    }
    setErrors({});
    setGeneralError('');
    setSaving(false);
  }, [open, event, defaultWellId, wells, resolve]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    const clientErrors: Record<string, string> = {};
    if (!form.wellId) clientErrors.wellId = 'Select a well';
    if (!form.startTime) clientErrors.startTime = 'Start time is required';
    if (!form.description.trim()) clientErrors.description = 'Describe the downtime';
    if (form.endTime && form.endTime <= form.startTime) {
      clientErrors.endTime = 'End time must be after the start';
    }
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    const payload: DowntimeUpsertRequest = {
      wellId: Number(form.wellId),
      startTime: form.startTime,
      endTime: form.endTime || null,
      category: form.category,
      description: form.description.trim(),
      deferredOilBbl: form.deferredOilBbl ? Number(form.deferredOilBbl) : null,
      deferredGasMcf: form.deferredGasMcf ? Number(form.deferredGasMcf) : null,
      reportedBy: form.reportedBy.trim() || null,
    };

    setSaving(true);
    setGeneralError('');
    setErrors({});
    try {
      if (event) {
        await api.put(`/downtime/${event.id}`, payload);
      } else {
        await api.post('/downtime', payload);
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
      title={resolve ? 'Resolve downtime' : event ? 'Edit downtime event' : 'Report downtime'}
      subtitle={
        event
          ? `${event.wellName} · ${event.categoryLabel}`
          : 'Capture deferred production and the reason a well was offline.'
      }
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="downtime-form" className="btn btn-primary" disabled={saving}>
            {saving && <LoaderCircle size={14} className="spin" />}
            {saving ? 'Saving…' : resolve ? 'Resolve event' : event ? 'Save changes' : 'Report downtime'}
          </button>
        </>
      }
    >
      <form id="downtime-form" className="form-grid" onSubmit={handleSubmit} autoComplete="off">
        {generalError && <div className="form-error-banner">{generalError}</div>}
        <FormField label="Well" htmlFor="dt-well" required error={errors.wellId} className="span-2">
          <select
            id="dt-well"
            className="input"
            value={form.wellId}
            onChange={(e) => update('wellId', e.target.value)}
          >
            <option value="">Select a well</option>
            {wells.map((well) => (
              <option key={well.id} value={well.id}>
                {well.name} · {well.fieldName}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Start time" htmlFor="dt-start" required error={errors.startTime}>
          <input
            id="dt-start"
            type="datetime-local"
            className="input"
            value={form.startTime}
            onChange={(e) => update('startTime', e.target.value)}
          />
        </FormField>
        <FormField
          label="End time"
          htmlFor="dt-end"
          error={errors.endTime}
          hint="Leave blank while the event is still active"
        >
          <input
            id="dt-end"
            type="datetime-local"
            className="input"
            value={form.endTime}
            onChange={(e) => update('endTime', e.target.value)}
          />
        </FormField>
        <FormField label="Reason" htmlFor="dt-category" required>
          <select
            id="dt-category"
            className="input"
            value={form.category}
            onChange={(e) => update('category', e.target.value as DowntimeCategory)}
          >
            {meta?.downtimeCategories.map((category) => (
              <option key={category.value} value={category.value}>{category.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Reported by" htmlFor="dt-reporter">
          <input
            id="dt-reporter"
            className="input"
            value={form.reportedBy}
            onChange={(e) => update('reportedBy', e.target.value)}
            placeholder="Operations"
          />
        </FormField>
        <FormField label="Description" htmlFor="dt-description" required error={errors.description} className="span-2">
          <textarea
            id="dt-description"
            className="input textarea"
            rows={3}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="What happened, and what action is underway?"
          />
        </FormField>
        <FormField
          label="Deferred oil"
          htmlFor="dt-oil"
          error={errors.deferredOilBbl}
          hint="Leave blank to estimate from the prior 30-day rate"
        >
          <div className="input-with-suffix">
            <input
              id="dt-oil"
              type="number"
              min="0"
              step="0.1"
              className="input"
              value={form.deferredOilBbl}
              onChange={(e) => update('deferredOilBbl', e.target.value)}
              placeholder="Auto"
            />
            <span>bbl</span>
          </div>
        </FormField>
        <FormField label="Deferred gas" htmlFor="dt-gas" error={errors.deferredGasMcf}>
          <div className="input-with-suffix">
            <input
              id="dt-gas"
              type="number"
              min="0"
              step="0.1"
              className="input"
              value={form.deferredGasMcf}
              onChange={(e) => update('deferredGasMcf', e.target.value)}
              placeholder="Auto"
            />
            <span>Mcf</span>
          </div>
        </FormField>
      </form>
    </Modal>
  );
}
