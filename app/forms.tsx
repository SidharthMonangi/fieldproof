'use client';
import { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { caseDataSchema, visitSchema, type CaseData, type VisitData } from '@/lib/domain';
import { getDraft, saveDraft, deleteDraft } from '@/lib/device';
import { toast } from 'sonner';
export function Picker({
  value,
  onChange,
  options,
  label,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="fp-select" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
const blank: CaseData = {
  name: '',
  phone: '',
  location: '',
  purpose: 'Home construction',
  amount: 500000,
  income: 0,
  notes: '',
  consent: false,
  consentAt: null,
};
export function CaseForm({
  initial,
  scope,
  draftKey,
  onSave,
}: {
  initial?: CaseData;
  scope: string;
  draftKey: string;
  onSave: (d: CaseData) => Promise<void>;
}) {
  const [data, setData] = useState(initial ?? blank),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const patch = (p: Partial<CaseData>) => setData((d) => ({ ...d, ...p }));
  useEffect(() => {
    void getDraft<CaseData>(scope, draftKey)
      .then((d) => {
        if (d) setData(d);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [scope, draftKey]);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      void saveDraft(scope, draftKey, data).catch(() =>
        toast.error('Draft could not be saved on this device.'),
      );
    }, 400);
    return () => clearTimeout(t);
  }, [scope, draftKey, data, ready]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const parsed = caseDataSchema.safeParse(data);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      await onSave(parsed.data);
      await deleteDraft(scope, draftKey);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="form-grid">
      <Field label="Applicant name">
        <input
          required
          minLength={2}
          maxLength={100}
          value={data.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </Field>
      <Field label="Contact number">
        <input
          required
          type="tel"
          value={data.phone}
          onChange={(e) => patch({ phone: e.target.value })}
        />
      </Field>
      <Field label="Property location">
        <input
          required
          minLength={2}
          maxLength={180}
          value={data.location}
          onChange={(e) => patch({ location: e.target.value })}
        />
      </Field>
      <Field label="Loan purpose">
        <Picker
          label="Loan purpose"
          value={data.purpose}
          onChange={(v) => patch({ purpose: v as CaseData['purpose'] })}
          options={['Home construction', 'Home purchase', 'Home improvement'].map((v) => ({
            value: v,
            label: v,
          }))}
        />
      </Field>
      <Field label="Requested amount (₹)">
        <input
          required
          type="number"
          min={10000}
          max={100000000}
          step={1}
          value={data.amount}
          onChange={(e) => patch({ amount: Number(e.target.value) })}
        />
      </Field>
      <Field label="Monthly income (₹)">
        <input
          required
          type="number"
          min={0}
          max={10000000}
          step={1}
          value={data.income}
          onChange={(e) => patch({ income: Number(e.target.value) })}
        />
      </Field>
      <Field label="Case notes">
        <textarea
          rows={3}
          maxLength={3000}
          value={data.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </Field>
      <div className="check-row">
        <Checkbox
          id="consent"
          checked={data.consent}
          onCheckedChange={(v) => patch({ consent: v === true })}
        />
        <label htmlFor="consent">The applicant has agreed to this collection of information.</label>
      </div>
      <div className="form-footer">
        <small>Drafts stay on this device until you save the case.</small>
        <button className="primary" disabled={busy || !ready}>
          {busy ? 'Saving…' : 'Save case'}
        </button>
      </div>
    </form>
  );
}
export function VisitForm({
  scope,
  caseId,
  onSave,
}: {
  scope: string;
  caseId: string;
  onSave: (v: VisitData) => Promise<void>;
}) {
  const [v, setV] = useState<VisitData>({
      date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      occupancy: 'Owner occupied',
      condition: 'Good',
      applicantMet: false,
      addressConfirmed: false,
      notes: '',
      latitude: null,
      longitude: null,
    }),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [locating, setLocating] = useState(false);
  const key = 'visit:' + caseId;
  const patch = (p: Partial<VisitData>) => setV((d) => ({ ...d, ...p }));
  useEffect(() => {
    void getDraft<VisitData>(scope, key)
      .then((d) => {
        if (d) setV(d);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [scope, key]);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(
      () =>
        void saveDraft(scope, key, v).catch(() => toast.error('Could not save the visit draft.')),
      400,
    );
    return () => clearTimeout(t);
  }, [scope, key, v, ready]);
  const locate = () => {
    if (!navigator.geolocation) {
      toast.error('Location is unavailable in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        patch({ latitude: p.coords.latitude, longitude: p.coords.longitude });
        setLocating(false);
      },
      () => {
        toast.error('Location could not be obtained. You can record the visit without it.');
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 0, enableHighAccuracy: false },
    );
  };
  return (
    <form
      className="form-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const p = visitSchema.safeParse(v);
          if (!p.success) throw new Error(p.error.issues[0].message);
          await onSave(p.data);
          await deleteDraft(scope, key);
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Visit date">
        <input
          type="date"
          required
          value={v.date}
          onChange={(e) => patch({ date: e.target.value })}
        />
      </Field>
      <Field label="Occupancy">
        <Picker
          label="Occupancy"
          value={v.occupancy}
          onChange={(s) => patch({ occupancy: s as VisitData['occupancy'] })}
          options={['Owner occupied', 'Under construction', 'Vacant', 'Other'].map((s) => ({
            value: s,
            label: s,
          }))}
        />
      </Field>
      <Field label="Property condition">
        <Picker
          label="Property condition"
          value={v.condition}
          onChange={(s) => patch({ condition: s as VisitData['condition'] })}
          options={['Good', 'Needs repair', 'Under construction'].map((s) => ({
            value: s,
            label: s,
          }))}
        />
      </Field>
      <div className="check-row">
        <Checkbox
          id="met"
          checked={v.applicantMet}
          onCheckedChange={(s) => patch({ applicantMet: s === true })}
        />
        <label htmlFor="met">Met the applicant</label>
      </div>
      <div className="check-row">
        <Checkbox
          id="address"
          checked={v.addressConfirmed}
          onCheckedChange={(s) => patch({ addressConfirmed: s === true })}
        />
        <label htmlFor="address">Confirmed the property address</label>
      </div>
      <Field label="Observations">
        <textarea
          required
          minLength={10}
          maxLength={5000}
          rows={4}
          value={v.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="Record what you observed and any follow-up needed."
        />
      </Field>
      <div className="location-row">
        <button type="button" className="secondary" onClick={locate} disabled={locating}>
          {locating ? 'Finding location…' : 'Add current location'}
        </button>
        <small>
          {v.latitude !== null
            ? `${v.latitude.toFixed(5)}, ${v.longitude?.toFixed(5)}`
            : 'Optional · permission requested only when you choose this'}
        </small>
      </div>
      <div className="form-footer">
        <small>Saved visits cannot be silently edited.</small>
        <button className="primary" disabled={busy || !ready}>
          {busy ? 'Saving…' : 'Record visit'}
        </button>
      </div>
    </form>
  );
}
export async function preparePhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is unavailable.');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Photo preparation failed.'))),
        'image/jpeg',
        0.82,
      ),
    );
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}
