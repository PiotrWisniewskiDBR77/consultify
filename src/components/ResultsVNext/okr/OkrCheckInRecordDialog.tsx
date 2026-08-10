/**
 * OkrCheckInRecordDialog — form for `POST .../check-ins` (`recordCheckIn`).
 * Fields = exactly `RecordOkrCheckInSchema` (`resultsVnextOkr.validators.ts`
 * L535-552).
 *
 * ── HONEST GAP — `cadenceOccurrenceId` has no picker source ─────────────
 * See `okrCheckInApi.ts`'s file header for the full, code-cited proof: no
 * route anywhere in `okr.routes.ts` exposes `okr_vnext_checkin_occurrences`,
 * so there is no real endpoint this form could call to populate a dropdown
 * of valid occurrences. Rather than fabricate a value (which the server
 * would silently accept as data corruption — a `crypto.randomUUID()` here
 * would create a check-in against an occurrence that was never actually
 * scheduled) or hide the capability entirely, this field is a manually
 * entered UUID with a PERSISTENT, honest explanation — same "read-only by
 * design, not an oversight" precedent `RoiCaseCreateModal.tsx` sets for its
 * own no-picker-source field (`ownerUserId`). A real occurrence id is
 * something an operator would currently have to obtain outside this UI
 * (e.g. from the scheduler's own seeded obligation, not exposed anywhere
 * else in the product today either) — flagged in the acceptance report as
 * an open question for the next package, not silently worked around.
 *
 * `newValue` is nullable (`z.number().nullable()`, required key but
 * nullable value) — `null` = "a qualitative-only check-in this round"
 * (`okrCheckInCommands.ts` L387-389's own doc comment), so this form does
 * NOT treat an empty numeric field as invalid, only as `null`.
 */
import { AlertTriangle, Info, Sparkles } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

import type { OkrCheckInConfidence, OkrCheckInStatus, OkrSuggestNextCheckInValue } from './okrCheckInApi';
import { okrSuggestBasisLabel } from './okrCheckInMappers';

export interface OkrCheckInRecordFormValues {
  cadenceOccurrenceId: string;
  newValue: number | null;
  ownerDeclaredStatus: OkrCheckInStatus | null;
  confidence: OkrCheckInConfidence | null;
  confidenceNumericValue: number | null;
  note: string;
  blocker: string | null;
  supportRequested: string | null;
  reason: string | null;
}

export interface OkrCheckInRecordDialogProps {
  open: boolean;
  keyResultTitle: string;
  isPolish: boolean;
  onClose: () => void;
  onSubmit: (values: OkrCheckInRecordFormValues) => void;
  /** `undefined` = still loading, `null` = fetch failed (shown as absent,
   * never a fabricated suggestion). */
  suggestion?: OkrSuggestNextCheckInValue | null;
  /** Set when the OWNING Set isn't `'active'` or the KR is `'cancelled'`
   * (`getOkrCheckInSetLock` in `okrObjectiveMappers.ts` / `KEY_RESULT_CANCELLED`)
   * — the dialog still opens (TRIADA §C3 posture: locked CTA still fires,
   * shows why) but submit stays disabled with this reason shown. */
  blockedReason?: string | null;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}

const FIELD_CLASS =
  'w-full h-9 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';

const TEXTAREA_CLASS =
  'w-full min-h-[64px] rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors resize-y ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';

const LABEL_CLASS = 'block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5';

const GHOST_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-c-border bg-transparent px-4 ' +
  'text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

export const OkrCheckInRecordDialog: React.FC<OkrCheckInRecordDialogProps> = ({
  open,
  keyResultTitle,
  isPolish,
  onClose,
  onSubmit,
  suggestion,
  blockedReason = null,
  busy = false,
  errorMessage = null,
  isConflict = false,
}) => {
  const [cadenceOccurrenceId, setCadenceOccurrenceId] = useState('');
  const [newValue, setNewValue] = useState('');
  const [ownerDeclaredStatus, setOwnerDeclaredStatus] = useState<OkrCheckInStatus | ''>('');
  const [confidence, setConfidence] = useState<OkrCheckInConfidence | ''>('');
  const [confidenceNumericValue, setConfidenceNumericValue] = useState('');
  const [note, setNote] = useState('');
  const [blocker, setBlocker] = useState('');
  const [supportRequested, setSupportRequested] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCadenceOccurrenceId('');
    setNewValue('');
    setOwnerDeclaredStatus('');
    setConfidence('');
    setConfidenceNumericValue('');
    setNote('');
    setBlocker('');
    setSupportRequested('');
    setReason('');
    setTouched(false);
  }, [open]);

  const cadenceError = touched && !cadenceOccurrenceId.trim();
  const noteError = touched && !note.trim();
  const confidenceNumericError = touched && confidence === 'numeric' && confidenceNumericValue.trim() === '';
  const submitDisabled = busy || !!blockedReason;

  const handleSubmit = () => {
    setTouched(true);
    if (!cadenceOccurrenceId.trim() || !note.trim()) return;
    if (confidence === 'numeric' && confidenceNumericValue.trim() === '') return;
    onSubmit({
      cadenceOccurrenceId: cadenceOccurrenceId.trim(),
      newValue: newValue.trim() === '' ? null : Number(newValue),
      ownerDeclaredStatus: ownerDeclaredStatus || null,
      confidence: confidence || null,
      confidenceNumericValue: confidence === 'numeric' ? Number(confidenceNumericValue) : null,
      note: note.trim(),
      blocker: blocker.trim() || null,
      supportRequested: supportRequested.trim() || null,
      reason: reason.trim() || null,
    });
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isPolish ? 'Nowy check-in' : 'New check-in'}
      description={isPolish ? `Kluczowy Rezultat: ${keyResultTitle}` : `Key Result: ${keyResultTitle}`}
      size="md"
      preventOverlayClose={busy}
      preventEscapeClose={busy}
      className="max-h-[85vh] overflow-y-auto"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitDisabled}
            data-testid="okr-checkin-record-submit"
            className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : isPolish ? 'Zarejestruj check-in' : 'Record check-in'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {blockedReason ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-[12px] text-c-text"
            data-testid="okr-checkin-blocked"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300" />
            <span>{blockedReason}</span>
          </div>
        ) : null}

        {suggestion === undefined ? (
          <p className="text-[12px] text-c-text-muted">{isPolish ? 'Wczytywanie sugestii…' : 'Loading suggestion…'}</p>
        ) : suggestion ? (
          <div
            className="flex items-start gap-2 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-[12px] text-c-text-secondary"
            data-testid="okr-checkin-suggestion"
          >
            <Sparkles size={14} className="mt-0.5 shrink-0 text-c-text-muted" />
            <div>
              <div>
                {isPolish ? 'Sugestia serwera: ' : 'Server suggestion: '}
                <strong className="text-c-text">
                  {suggestion.suggestedValue !== null
                    ? suggestion.suggestedValue.toLocaleString(isPolish ? 'pl-PL' : 'en-US', { maximumFractionDigits: 2 })
                    : okrSuggestBasisLabel(suggestion.basis, isPolish)}
                </strong>{' '}
                ({okrSuggestBasisLabel(suggestion.basis, isPolish)})
              </div>
              <div className="mt-0.5 text-[11px] text-c-text-muted">{suggestion.reason}</div>
              {suggestion.suggestedValue !== null ? (
                <button
                  type="button"
                  onClick={() => setNewValue(String(suggestion.suggestedValue))}
                  className="mt-1.5 text-[11px] font-medium text-c-text underline underline-offset-2"
                  data-testid="okr-checkin-use-suggestion"
                >
                  {isPolish ? 'Użyj sugestii' : 'Use suggestion'}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div>
          <label className={LABEL_CLASS} htmlFor="okr-checkin-cadence">
            {isPolish ? 'ID wystąpienia cyklu (cadence occurrence)' : 'Cadence occurrence id'}
          </label>
          <input
            id="okr-checkin-cadence"
            value={cadenceOccurrenceId}
            onChange={(e) => setCadenceOccurrenceId(e.target.value)}
            placeholder={isPolish ? 'UUID wystąpienia — wklej ręcznie' : 'Occurrence UUID — paste manually'}
            className={FIELD_CLASS}
            data-testid="okr-checkin-cadence"
            aria-invalid={cadenceError || undefined}
          />
          <p className="mt-1 flex items-start gap-1 text-[11px] text-c-text-muted">
            <Info size={12} className="mt-0.5 shrink-0" />
            <span>
              {isPolish
                ? 'Serwer wymaga tego pola, ale ten pakiet nie ma jeszcze punktu API, który wypisuje dostępne wystąpienia cyklu dla tego Kluczowego Rezultatu — wpisz je ręcznie. Zgłoszone jako pytanie otwarte.'
                : "The server requires this field, but this package has no API endpoint yet that lists available cadence occurrences for this Key Result — enter it manually. Flagged as an open question."}
            </span>
          </p>
          {cadenceError ? (
            <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'To pole jest wymagane' : 'This field is required'}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="okr-checkin-value">
              {isPolish ? 'Nowa wartość (opcjonalnie)' : 'New value (optional)'}
            </label>
            <input
              id="okr-checkin-value"
              type="number"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className={FIELD_CLASS}
              data-testid="okr-checkin-value"
            />
            <p className="mt-1 text-[11px] text-c-text-muted">
              {isPolish ? 'Puste = check-in wyłącznie jakościowy, wartość KR bez zmian.' : 'Empty = qualitative-only check-in, KR value unchanged.'}
            </p>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="okr-checkin-status">
              {isPolish ? 'Status zadeklarowany' : 'Owner-declared status'}
            </label>
            <select
              id="okr-checkin-status"
              value={ownerDeclaredStatus}
              onChange={(e) => setOwnerDeclaredStatus(e.target.value as OkrCheckInStatus | '')}
              className={FIELD_CLASS}
              data-testid="okr-checkin-status"
            >
              <option value="">{isPolish ? '— brak —' : '— none —'}</option>
              <option value="not_started">{isPolish ? 'Nierozpoczęty' : 'Not started'}</option>
              <option value="on_track">{isPolish ? 'Zgodnie z planem' : 'On track'}</option>
              <option value="at_risk">{isPolish ? 'Zagrożony' : 'At risk'}</option>
              <option value="off_track">{isPolish ? 'Poza planem' : 'Off track'}</option>
              <option value="achieved">{isPolish ? 'Osiągnięty' : 'Achieved'}</option>
              <option value="not_achieved">{isPolish ? 'Nieosiągnięty' : 'Not achieved'}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="okr-checkin-confidence">
              {isPolish ? 'Pewność (opcjonalnie)' : 'Confidence (optional)'}
            </label>
            <select
              id="okr-checkin-confidence"
              value={confidence}
              onChange={(e) => setConfidence(e.target.value as OkrCheckInConfidence | '')}
              className={FIELD_CLASS}
              data-testid="okr-checkin-confidence"
            >
              <option value="">{isPolish ? '— brak —' : '— none —'}</option>
              <option value="high">{isPolish ? 'Wysoka' : 'High'}</option>
              <option value="medium">{isPolish ? 'Średnia' : 'Medium'}</option>
              <option value="low">{isPolish ? 'Niska' : 'Low'}</option>
              <option value="numeric">{isPolish ? 'Liczbowa' : 'Numeric'}</option>
            </select>
          </div>
          {confidence === 'numeric' ? (
            <div>
              <label className={LABEL_CLASS} htmlFor="okr-checkin-confidence-numeric">
                {isPolish ? 'Wartość pewności' : 'Confidence value'}
              </label>
              <input
                id="okr-checkin-confidence-numeric"
                type="number"
                value={confidenceNumericValue}
                onChange={(e) => setConfidenceNumericValue(e.target.value)}
                className={FIELD_CLASS}
                data-testid="okr-checkin-confidence-numeric"
                aria-invalid={confidenceNumericError || undefined}
              />
              {confidenceNumericError ? (
                <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Wymagane, gdy pewność = „liczbowa"' : 'Required when confidence = "numeric"'}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="okr-checkin-note">
            {isPolish ? 'Notatka' : 'Note'}
          </label>
          <textarea
            id="okr-checkin-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="okr-checkin-note"
            aria-invalid={noteError || undefined}
          />
          {noteError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Notatka jest wymagana' : 'Note is required'}</p> : null}
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="okr-checkin-blocker">
            {isPolish ? 'Blokada (opcjonalnie)' : 'Blocker (optional)'}
          </label>
          <textarea
            id="okr-checkin-blocker"
            value={blocker}
            onChange={(e) => setBlocker(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="okr-checkin-blocker"
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="okr-checkin-support">
            {isPolish ? 'Potrzebne wsparcie (opcjonalnie)' : 'Support requested (optional)'}
          </label>
          <textarea
            id="okr-checkin-support"
            value={supportRequested}
            onChange={(e) => setSupportRequested(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="okr-checkin-support"
          />
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text"
            data-testid="okr-checkin-record-error"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>{isConflict ? (isPolish ? `Konflikt zapisu: ${errorMessage}` : `Write conflict: ${errorMessage}`) : errorMessage}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default OkrCheckInRecordDialog;
