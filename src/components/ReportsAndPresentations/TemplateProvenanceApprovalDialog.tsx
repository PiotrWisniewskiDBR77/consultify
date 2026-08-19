import { Check, ShieldCheck, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

type PendingTemplate = {
  registry: 'document_studio_templates' | 'presentation_templates' | 'tp_base_templates';
  templateId: string;
  name: string;
  provenanceStatus: 'unknown' | 'quarantined';
};

type FormState = {
  source: string;
  licenseBasis: string;
  authority: string;
  version: string;
  evidence: string;
};

const EMPTY_FORM: FormState = {
  source: '',
  licenseBasis: '',
  authority: '',
  version: '',
  evidence: '',
};

const registryLabel = (registry: PendingTemplate['registry']): string =>
  registry === 'document_studio_templates'
    ? 'Dokument'
    : registry === 'presentation_templates'
      ? 'Prezentacja'
      : 'Arkusz';

export function TemplateProvenanceApprovalDialog(props: {
  open: boolean;
  onClose: () => void;
  onApproved?: () => void;
}) {
  const { open, onClose, onApproved } = props;
  const [items, setItems] = useState<PendingTemplate[]>([]);
  const [selected, setSelected] = useState<PendingTemplate | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'error' | 'forbidden'>(
    'loading'
  );
  const [message, setMessage] = useState('');
  const keys = useRef(new Map<string, string>());

  const load = useCallback(async () => {
    setState('loading');
    setMessage('');
    try {
      const response = await fetch('/api/deliverables/templates-provenance/pending', {
        credentials: 'include',
      });
      if (response.status === 403) {
        setState('forbidden');
        return;
      }
      if (!response.ok) throw new Error('Nie udało się pobrać kolejki pochodzenia.');
      const payload = (await response.json()) as { templates?: PendingTemplate[] };
      const next = Array.isArray(payload.templates) ? payload.templates : [];
      setItems(next);
      setSelected((current) =>
        current ? (next.find((item) => item.templateId === current.templateId) ?? null) : null
      );
      setState('ready');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nie udało się pobrać kolejki.');
      setState('error');
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [load, open]);

  if (!open) return null;

  const approve = async () => {
    if (!selected || Object.values(form).some((value) => !value.trim())) return;
    const target = `${selected.registry}:${selected.templateId}`;
    const key = keys.current.get(target) ?? crypto.randomUUID();
    keys.current.set(target, key);
    setState('saving');
    setMessage('');
    try {
      const response = await fetch(
        `/api/deliverables/templates/${encodeURIComponent(selected.templateId)}/provenance/approve`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
          body: JSON.stringify({ registry: selected.registry, ...form }),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Zatwierdzenie zostało odrzucone.');
      keys.current.delete(target);
      setForm(EMPTY_FORM);
      setSelected(null);
      await load();
      onApproved?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Zatwierdzenie zostało odrzucone.');
      setState('error');
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-provenance-title"
        className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-c-border bg-c-surface shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-c-border p-5">
          <div>
            <h2
              id="template-provenance-title"
              className="flex items-center gap-2 text-base font-semibold text-c-text"
            >
              <ShieldCheck size={18} aria-hidden="true" />
              Zatwierdzenie pochodzenia wzorców
            </h2>
            <p className="mt-1 text-sm text-c-text-secondary">
              Tylko OWNER lub ADMIN. Brakujące albo niepełne prawa pozostawiają wzorzec w
              kwarantannie.
            </p>
          </div>
          <button
            type="button"
            aria-label="Zamknij"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-lg text-c-text-secondary hover:bg-c-surface-raised"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="grid min-h-0 flex-1 md:grid-cols-[300px_1fr]">
          <div className="overflow-y-auto border-r border-c-border p-3">
            {state === 'loading' ? (
              <p className="p-3 text-sm text-c-text-secondary">Ładowanie…</p>
            ) : null}
            {state === 'forbidden' ? (
              <p role="alert" className="p-3 text-sm text-c-danger">
                Ta kolejka jest dostępna wyłącznie dla aktywnego OWNER lub ADMIN tej organizacji.
              </p>
            ) : null}
            {state !== 'loading' && state !== 'forbidden' && items.length === 0 ? (
              <p className="p-3 text-sm text-c-text-secondary">
                Brak wzorców oczekujących na pochodzenie.
              </p>
            ) : null}
            {items.map((item) => (
              <button
                key={`${item.registry}:${item.templateId}`}
                type="button"
                onClick={() => {
                  setSelected(item);
                  setForm(EMPTY_FORM);
                  setMessage('');
                  setState('ready');
                }}
                className={`mb-2 w-full rounded-lg border p-3 text-left ${selected?.templateId === item.templateId && selected.registry === item.registry ? 'border-c-focus bg-c-focus/10' : 'border-c-border hover:bg-c-surface-raised'}`}
              >
                <span className="block text-xs text-c-text-muted">
                  {registryLabel(item.registry)} ·{' '}
                  {item.provenanceStatus === 'unknown' ? 'nieznane' : 'kwarantanna'}
                </span>
                <span className="mt-1 block text-sm font-medium text-c-text">{item.name}</span>
              </button>
            ))}
          </div>
          <div className="overflow-y-auto p-5">
            {!selected ? (
              <p className="text-sm text-c-text-secondary">
                Wybierz wzorzec. Nic nie zostanie zatwierdzone automatycznie.
              </p>
            ) : (
              <div className="space-y-3">
                <h3 className="font-medium text-c-text">{selected.name}</h3>
                {(
                  [
                    ['source', 'Źródło / autor / właściciel'],
                    ['licenseBasis', 'Podstawa licencji lub praw'],
                    ['authority', 'Organ zatwierdzający / zakres decyzji'],
                    ['version', 'Wersja zatwierdzanego wzorca'],
                    ['evidence', 'Trwałe evidence (ID, ścieżka lub URL)'],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field} className="block text-sm text-c-text-secondary">
                    {label}
                    <input
                      value={form[field]}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, [field]: event.target.value }))
                      }
                      className="mt-1 h-10 w-full rounded-lg border border-c-border bg-c-surface-raised px-3 text-c-text outline-none focus:border-c-focus-solid"
                    />
                  </label>
                ))}
                <button
                  type="button"
                  disabled={
                    state === 'saving' || Object.values(form).some((value) => !value.trim())
                  }
                  onClick={() => void approve()}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-c-text px-4 text-sm font-medium text-c-surface disabled:opacity-45"
                >
                  <Check size={16} aria-hidden="true" />
                  Zatwierdź kompletne pochodzenie
                </button>
              </div>
            )}
            {message ? (
              <p role="alert" className="mt-3 text-sm text-c-danger">
                {message}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
