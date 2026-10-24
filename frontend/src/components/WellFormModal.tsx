import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { LiftType, WellStatus, WellUpsertRequest, WellView } from '../api/types';
import { api, ApiError } from '../api/client';
import { useMeta } from '../context/MetaContext';
import { Modal } from './Modal';
import { FormField } from './FormField';

interface WellFormModalProps {
  open: boolean;
  onClose: () => void;
  well?: WellView | null;
  onSaved: (well: WellView) => void;
}

interface FormState {
  name: string;
  apiNumber: string;
  fieldName: string;
  operator: string;
  county: string;
  state: string;
  status: WellStatus;
  liftType: LiftType | '';
  targetFormation: string;
  spudDate: string;
  completionDate: string;
  totalDepthFt: string;
  lateralLengthFt: string;
  latitude: string;
  longitude: string;
}

const emptyForm: FormState = {
  name: '',
  apiNumber: '',
  fieldName: '',
  operator: 'Meridian Operating',
  county: '',
  state: 'TX',
  status: 'PRODUCING',
  liftType: 'ESP',
  targetFormation: '',
  spudDate: '',
  completionDate: '',
  totalDepthFt: '',
  lateralLengthFt: '',
  latitude: '',
  longitude: '',
};

function fromWell(well: WellView): FormState {
  return {
    name: well.name,
    apiNumber: well.apiNumber,
    fieldName: well.fieldName,
    operator: well.operator,
    county: well.county ?? '',
    state: well.state ?? '',
    status: well.status,
    liftType: well.liftType ?? '',
    targetFormation: well.targetFormation ?? '',
    spudDate: well.spudDate ?? '',
    completionDate: well.completionDate ?? '',
    totalDepthFt: well.totalDepthFt != null ? String(well.totalDepthFt) : '',
    lateralLengthFt: well.lateralLengthFt != null ? String(well.lateralLengthFt) : '',
    latitude: well.latitude != null ? String(well.latitude) : '',
    longitude: well.longitude != null ? String(well.longitude) : '',
  };
}

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function WellFormModal({ open, onClose, well, onSaved }: WellFormModalProps) {
  const { meta } = useMeta();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(well ? fromWell(well) : emptyForm);
    setErrors({});
    setGeneralError('');
    setSaving(false);
  }, [open, well]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const clientErrors: Record<string, string> = {};
    if (!form.name.trim()) clientErrors.name = 'Well name is required';
    if (!form.apiNumber.trim()) clientErrors.apiNumber = 'API number is required';
    if (!form.fieldName.trim()) clientErrors.fieldName = 'Field is required';
    if (!form.operator.trim()) clientErrors.operator = 'Operator is required';
    if (form.spudDate && form.completionDate && form.completionDate < form.spudDate) {
      clientErrors.completionDate = 'Completion cannot precede spud';
    }
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    const payload: WellUpsertRequest = {
      name: form.name.trim(),
      apiNumber: form.apiNumber.trim(),
      fieldName: form.fieldName.trim(),
      operator: form.operator.trim(),
      county: form.county.trim() || null,
      state: form.state.trim() || null,
      status: form.status,
      liftType: form.liftType || null,
      targetFormation: form.targetFormation.trim() || null,
      spudDate: form.spudDate || null,
      completionDate: form.completionDate || null,
      totalDepthFt: optionalNumber(form.totalDepthFt),
      lateralLengthFt: optionalNumber(form.lateralLengthFt),
      latitude: optionalNumber(form.latitude),
      longitude: optionalNumber(form.longitude),
    };

    setSaving(true);
    setGeneralError('');
    setErrors({});
    try {
      const saved = well
        ? await api.put<WellView>(`/wells/${well.id}`, payload)
        : await api.post<WellView>('/wells', payload);
      onSaved(saved);
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
      title={well ? 'Edit well' : 'Add a well'}
      subtitle={well ? `${well.name} · ${well.apiNumber}` : 'Create a new well in the production asset.'}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="well-form" className="btn btn-primary" disabled={saving}>
            {saving && <LoaderCircle size={14} className="spin" />}
            {saving ? 'Saving…' : well ? 'Save changes' : 'Create well'}
          </button>
        </>
      }
    >
      <form id="well-form" className="form-grid" onSubmit={handleSubmit} autoComplete="off">
        {generalError && <div className="form-error-banner">{generalError}</div>}
        <FormField label="Well name" htmlFor="well-name" required error={errors.name}>
          <input
            id="well-name"
            className="input"
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="e.g. Rattlesnake 12H-3"
          />
        </FormField>
        <FormField label="API number" htmlFor="well-api" required error={errors.apiNumber} hint="5–20 letters, digits or dashes">
          <input
            id="well-api"
            className="input mono"
            value={form.apiNumber}
            onChange={(event) => update('apiNumber', event.target.value)}
            placeholder="42-301-34567"
          />
        </FormField>
        <FormField label="Field" htmlFor="well-field" required error={errors.fieldName}>
          <input
            id="well-field"
            className="input"
            value={form.fieldName}
            onChange={(event) => update('fieldName', event.target.value)}
            list="field-options"
            placeholder="Spraberry"
          />
          <datalist id="field-options">
            {meta?.fields.map((field) => <option key={field} value={field} />)}
          </datalist>
        </FormField>
        <FormField label="Operator" htmlFor="well-operator" required error={errors.operator}>
          <input
            id="well-operator"
            className="input"
            value={form.operator}
            onChange={(event) => update('operator', event.target.value)}
            list="operator-options"
          />
          <datalist id="operator-options">
            {meta?.operators.map((operator) => <option key={operator} value={operator} />)}
          </datalist>
        </FormField>
        <FormField label="Status" htmlFor="well-status">
          <select
            id="well-status"
            className="input"
            value={form.status}
            onChange={(event) => update('status', event.target.value as WellStatus)}
          >
            {meta?.wellStatuses.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Artificial lift" htmlFor="well-lift">
          <select
            id="well-lift"
            className="input"
            value={form.liftType}
            onChange={(event) => update('liftType', event.target.value as LiftType | '')}
          >
            <option value="">Not assigned</option>
            {meta?.liftTypes.map((lift) => (
              <option key={lift.value} value={lift.value}>{lift.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="County" htmlFor="well-county" error={errors.county}>
          <input
            id="well-county"
            className="input"
            value={form.county}
            onChange={(event) => update('county', event.target.value)}
            placeholder="Midland"
          />
        </FormField>
        <FormField label="State" htmlFor="well-state" error={errors.state}>
          <input
            id="well-state"
            className="input"
            value={form.state}
            onChange={(event) => update('state', event.target.value)}
            placeholder="TX"
          />
        </FormField>
        <FormField label="Target formation" htmlFor="well-formation" className="span-2">
          <input
            id="well-formation"
            className="input"
            value={form.targetFormation}
            onChange={(event) => update('targetFormation', event.target.value)}
            placeholder="Wolfcamp A"
          />
        </FormField>
        <FormField label="Spud date" htmlFor="well-spud">
          <input
            id="well-spud"
            type="date"
            className="input"
            value={form.spudDate}
            onChange={(event) => update('spudDate', event.target.value)}
          />
        </FormField>
        <FormField label="Completion date" htmlFor="well-completion" error={errors.completionDate}>
          <input
            id="well-completion"
            type="date"
            className="input"
            value={form.completionDate}
            onChange={(event) => update('completionDate', event.target.value)}
          />
        </FormField>
        <FormField label="Total depth" htmlFor="well-depth" error={errors.totalDepthFt}>
          <div className="input-with-suffix">
            <input
              id="well-depth"
              type="number"
              min="0"
              step="1"
              className="input"
              value={form.totalDepthFt}
              onChange={(event) => update('totalDepthFt', event.target.value)}
              placeholder="10840"
            />
            <span>ft</span>
          </div>
        </FormField>
        <FormField label="Lateral length" htmlFor="well-lateral" error={errors.lateralLengthFt}>
          <div className="input-with-suffix">
            <input
              id="well-lateral"
              type="number"
              min="0"
              step="1"
              className="input"
              value={form.lateralLengthFt}
              onChange={(event) => update('lateralLengthFt', event.target.value)}
              placeholder="9620"
            />
            <span>ft</span>
          </div>
        </FormField>
        <FormField label="Latitude" htmlFor="well-lat" error={errors.latitude}>
          <input
            id="well-lat"
            type="number"
            step="0.000001"
            className="input mono"
            value={form.latitude}
            onChange={(event) => update('latitude', event.target.value)}
            placeholder="31.9973"
          />
        </FormField>
        <FormField label="Longitude" htmlFor="well-lng" error={errors.longitude}>
          <input
            id="well-lng"
            type="number"
            step="0.000001"
            className="input mono"
            value={form.longitude}
            onChange={(event) => update('longitude', event.target.value)}
            placeholder="-102.0779"
          />
        </FormField>
      </form>
    </Modal>
  );
}
