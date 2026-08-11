/**
 * OkrCarryForwardDialog — RN-G3 lane `okr` prompt-removal pass (2026-08-11).
 *
 * Replaces the `window.prompt('Target cycle (UUID) — paste the id')` that
 * used to back `OkrReviewReflectionView.tsx`'s "Carry forward" action. That
 * prompt asked a human to hand-type a UUID with zero validation — a
 * textbook case of "the server takes an id, so the UI just asks for an id"
 * shortcut. A REAL list endpoint exists for this
 * (`GET /vnext/results/okr/cycles`, `okr.routes.ts` L679-699, wrapped
 * client-side as `listOkrCycles` in `./okrAdminApi.ts`), so this dialog
 * fetches it and renders a `<select>` instead of asking for a pasted id —
 * no UUID is ever generated or guessed here.
 *
 * Eligibility mirrors the server's own guard verbatim
 * (`okrCarryForwardCommands.ts` L105-111: `targetCycleRow.status !==
 * 'planned' && !== 'drafting'` throws `TARGET_CYCLE_NOT_ELIGIBLE`) — this
 * dialog pre-filters to `planned`/`drafting` cycles of the SAME Program as
 * the source Set so the picker never offers a choice the server would
 * reject outright; the server's own check remains the source of truth (a
 * concurrent Cycle transition between fetch and submit still surfaces here
 * as a normal server error, not silently retried or guessed around).
 */
import { AlertTriangle } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

import { listOkrCycles, type OkrCycleDto } from './okrAdminApi';

export interface OkrCarryForwardDialogProps {
  open: boolean;
  programId: string;
  isPolish: boolean;
  onClose: () => void;
  onSubmit: (targetCycleId: string) => void;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}

const LABEL_CLASS = 'block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5';

const SELECT_CLASS =
  'w-full h-9 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const GHOST_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-c-border bg-transparent px-4 ' +
  'text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

const PRIMARY_BUTTON_CLASS = `${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`;

function formatCycleOption(c: OkrCycleDto, isPolish: boolean): string {
  const start = new Date(c.startDate);
  const end = new Date(c.endDate);
  const fmt = (d: Date) => (Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }));
  return `${c.name} (${fmt(start)} – ${fmt(end)})`;
}

export const OkrCarryForwardDialog: React.FC<OkrCarryForwardDialogProps> = ({
  open,
  programId,
  isPolish,
  onClose,
  onSubmit,
  busy = false,
  errorMessage = null,
  isConflict = false,
}) => {
  const [cycles, setCycles] = useState<OkrCycleDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected('');
    setTouched(false);
    setCycles(null);
    setLoadError(null);
    let cancelled = false;
    listOkrCycles(programId)
      .then((rows) => {
        if (cancelled) return;
        const eligible = rows.filter((c) => c.status === 'planned' || c.status === 'drafting');
        setCycles(eligible);
        if (eligible.length > 0) setSelected(eligible[0].cycleId);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : String(err));
        setCycles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, programId]);

  const loading = cycles === null;
  const noEligible = !loading && !loadError && cycles.length === 0;
  const fieldError = touched && !selected;
  const submitDisabled = busy;

  const handleSubmit = () => {
    setTouched(true);
    if (!selected) return;
    onSubmit(selected);
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isPolish ? 'Przenieś na kolejny cykl' : 'Carry forward'}
      size="sm"
      preventOverlayClose={busy}
      preventEscapeClose={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS} data-testid="okr-carry-forward-back">
            {isPolish ? 'Wstecz' : 'Back'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitDisabled || loading || noEligible}
            data-testid="okr-carry-forward-submit"
            className={PRIMARY_BUTTON_CLASS}
          >
            <span>{busy ? (isPolish ? 'Przenoszenie…' : 'Carrying forward…') : isPolish ? 'Przenieś' : 'Carry forward'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className={LABEL_CLASS} htmlFor="okr-carry-forward-cycle">
            {isPolish ? 'Docelowy cykl (wymagane)' : 'Target cycle (required)'}
          </label>
          {loading ? (
            <p className="text-sm text-c-text-muted" data-testid="okr-carry-forward-loading">
              {isPolish ? 'Ładowanie cykli…' : 'Loading cycles…'}
            </p>
          ) : loadError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text"
              data-testid="okr-carry-forward-load-error"
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
              <span>{loadError}</span>
            </div>
          ) : noEligible ? (
            <p className="text-[12px] text-c-text-muted" data-testid="okr-carry-forward-empty">
              {isPolish
                ? 'Brak cykli w statusie „zaplanowany" lub „szkic" w tym Programie — nie ma dokąd przenieść tego zestawu. Utwórz lub otwórz nowy cykl w administracji Programu.'
                : 'No cycle in "planned" or "drafting" status exists in this Program — there is nowhere to carry this set forward to. Create or open a new cycle in Program admin.'}
            </p>
          ) : (
            <select
              id="okr-carry-forward-cycle"
              autoFocus
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className={SELECT_CLASS}
              data-testid="okr-carry-forward-cycle"
              aria-invalid={fieldError || undefined}
            >
              {cycles.map((c) => (
                <option key={c.cycleId} value={c.cycleId}>
                  {formatCycleOption(c, isPolish)}
                </option>
              ))}
            </select>
          )}
          {fieldError ? (
            <p className="mt-1 text-[11px] text-c-danger" data-testid="okr-carry-forward-field-error">
              {isPolish ? 'Wybierz docelowy cykl' : 'Select a target cycle'}
            </p>
          ) : null}
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text"
            data-testid="okr-carry-forward-error"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>{isConflict ? (isPolish ? `Konflikt zapisu: ${errorMessage}` : `Write conflict: ${errorMessage}`) : errorMessage}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default OkrCarryForwardDialog;
