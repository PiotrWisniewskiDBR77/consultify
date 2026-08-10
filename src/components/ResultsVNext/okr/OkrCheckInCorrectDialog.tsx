/**
 * OkrCheckInCorrectDialog — form for `POST .../check-ins/:checkinId/correct`
 * (`correctCheckIn`). Fields = exactly `CorrectOkrCheckInSchema`
 * (`resultsVnextOkr.validators.ts` L558-570) — every value field is
 * OPTIONAL (defaults to the original row's value when omitted, per
 * `okrCheckInCommands.ts` L704-712's own merge logic), only
 * `correctionReason` is required (`min(1)`).
 *
 * NOT gated on Set/KR status (see `okrCheckInApi.ts`'s `correctCheckIn` doc
 * comment — confirmed by reading the command, no status guard exists there
 * unlike `recordCheckIn`) — this dialog never disables submit for a
 * lifecycle reason, only for `busy`.
 */
import { AlertTriangle } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

import type { OkrCheckInConfidence, OkrCheckInDto, OkrCheckInStatus } from './okrCheckInApi';

export interface OkrCheckInCorrectFormValues {
  newValue: number | null | undefined;
  ownerDeclaredStatus: OkrCheckInStatus | null | undefined;
  confidence: OkrCheckInConfidence | null | undefined;
  confidenceNumericValue: number | null | undefined;
  correctionReason: string;
}

export interface OkrCheckInCorrectDialogProps {
  open: boolean;
  original: OkrCheckInDto | null;
  isPolish: boolean;
  onClose: () => void;
  onSubmit: (values: OkrCheckInCorrectFormValues) => void;
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

export const OkrCheckInCorrectDialog: React.FC<OkrCheckInCorrectDialogProps> = ({
  open,
  original,
  isPolish,
  onClose,
  onSubmit,
  busy = false,
  errorMessage = null,
  isConflict = false,
}) => {
  const [changeValue, setChangeValue] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [changeStatus, setChangeStatus] = useState(false);
  const [ownerDeclaredStatus, setOwnerDeclaredStatus] = useState<OkrCheckInStatus | ''>('');
  const [changeConfidence, setChangeConfidence] = useState(false);
  const [confidence, setConfidence] = useState<OkrCheckInConfidence | ''>('');
  const [confidenceNumericValue, setConfidenceNumericValue] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChangeValue(false);
    setNewValue(original?.newValue ?? '');
    setChangeStatus(false);
    setOwnerDeclaredStatus(original?.ownerDeclaredStatus ?? '');
    setChangeConfidence(false);
    setConfidence(original?.confidence ?? '');
    setConfidenceNumericValue(original?.confidenceNumericValue ?? '');
    setCorrectionReason('');
    setTouched(false);
  }, [open, original]);

  const reasonError = touched && !correctionReason.trim();
  const confidenceNumericError = touched && changeConfidence && confidence === 'numeric' && confidenceNumericValue.trim() === '';
  const submitDisabled = busy || !original;

  const handleSubmit = () => {
    setTouched(true);
    if (!correctionReason.trim()) return;
    if (changeConfidence && confidence === 'numeric' && confidenceNumericValue.trim() === '') return;
    onSubmit({
      newValue: changeValue ? (newValue.trim() === '' ? null : Number(newValue)) : undefined,
      ownerDeclaredStatus: changeStatus ? ownerDeclaredStatus || null : undefined,
      confidence: changeConfidence ? confidence || null : undefined,
      confidenceNumericValue: changeConfidence && confidence === 'numeric' ? Number(confidenceNumericValue) : changeConfidence ? null : undefined,
      correctionReason: correctionReason.trim(),
    });
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isPolish ? 'Skoryguj check-in' : 'Correct check-in'}
      description={
        original
          ? isPolish
            ? `Korekta tworzy NOWY wiersz w historii (append-only) — oryginał zostaje, ale przestaje być „bieżący".`
            : 'The correction creates a NEW row in the history (append-only) — the original stays, but stops being "current".'
          : undefined
      }
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
            data-testid="okr-checkin-correct-submit"
            className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : isPolish ? 'Zapisz korektę' : 'Save correction'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <input
            id="okr-correct-change-value"
            type="checkbox"
            checked={changeValue}
            onChange={(e) => setChangeValue(e.target.checked)}
            data-testid="okr-correct-change-value"
          />
          <label htmlFor="okr-correct-change-value" className="text-sm text-c-text">
            {isPolish ? 'Zmień wartość' : 'Change value'}
          </label>
        </div>
        {changeValue ? (
          <input
            type="number"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className={FIELD_CLASS}
            data-testid="okr-correct-value"
          />
        ) : null}

        <div className="flex items-center gap-2">
          <input
            id="okr-correct-change-status"
            type="checkbox"
            checked={changeStatus}
            onChange={(e) => setChangeStatus(e.target.checked)}
            data-testid="okr-correct-change-status"
          />
          <label htmlFor="okr-correct-change-status" className="text-sm text-c-text">
            {isPolish ? 'Zmień status zadeklarowany' : 'Change owner-declared status'}
          </label>
        </div>
        {changeStatus ? (
          <select
            value={ownerDeclaredStatus}
            onChange={(e) => setOwnerDeclaredStatus(e.target.value as OkrCheckInStatus | '')}
            className={FIELD_CLASS}
            data-testid="okr-correct-status"
          >
            <option value="">{isPolish ? '— brak —' : '— none —'}</option>
            <option value="not_started">{isPolish ? 'Nierozpoczęty' : 'Not started'}</option>
            <option value="on_track">{isPolish ? 'Zgodnie z planem' : 'On track'}</option>
            <option value="at_risk">{isPolish ? 'Zagrożony' : 'At risk'}</option>
            <option value="off_track">{isPolish ? 'Poza planem' : 'Off track'}</option>
            <option value="achieved">{isPolish ? 'Osiągnięty' : 'Achieved'}</option>
            <option value="not_achieved">{isPolish ? 'Nieosiągnięty' : 'Not achieved'}</option>
          </select>
        ) : null}

        <div className="flex items-center gap-2">
          <input
            id="okr-correct-change-confidence"
            type="checkbox"
            checked={changeConfidence}
            onChange={(e) => setChangeConfidence(e.target.checked)}
            data-testid="okr-correct-change-confidence"
          />
          <label htmlFor="okr-correct-change-confidence" className="text-sm text-c-text">
            {isPolish ? 'Zmień pewność' : 'Change confidence'}
          </label>
        </div>
        {changeConfidence ? (
          <div className="grid grid-cols-2 gap-3">
            <select
              value={confidence}
              onChange={(e) => setConfidence(e.target.value as OkrCheckInConfidence | '')}
              className={FIELD_CLASS}
              data-testid="okr-correct-confidence"
            >
              <option value="">{isPolish ? '— brak —' : '— none —'}</option>
              <option value="high">{isPolish ? 'Wysoka' : 'High'}</option>
              <option value="medium">{isPolish ? 'Średnia' : 'Medium'}</option>
              <option value="low">{isPolish ? 'Niska' : 'Low'}</option>
              <option value="numeric">{isPolish ? 'Liczbowa' : 'Numeric'}</option>
            </select>
            {confidence === 'numeric' ? (
              <div>
                <input
                  type="number"
                  value={confidenceNumericValue}
                  onChange={(e) => setConfidenceNumericValue(e.target.value)}
                  className={FIELD_CLASS}
                  data-testid="okr-correct-confidence-numeric"
                  aria-invalid={confidenceNumericError || undefined}
                />
                {confidenceNumericError ? (
                  <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Wymagane, gdy pewność = „liczbowa"' : 'Required when confidence = "numeric"'}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <label className={LABEL_CLASS} htmlFor="okr-correct-reason">
            {isPolish ? 'Powód korekty (wymagany)' : 'Correction reason (required)'}
          </label>
          <textarea
            id="okr-correct-reason"
            autoFocus
            value={correctionReason}
            onChange={(e) => setCorrectionReason(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="okr-correct-reason"
            aria-invalid={reasonError || undefined}
          />
          {reasonError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Powód jest wymagany' : 'Reason is required'}</p> : null}
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text"
            data-testid="okr-checkin-correct-error"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>{isConflict ? (isPolish ? `Konflikt zapisu: ${errorMessage}` : `Write conflict: ${errorMessage}`) : errorMessage}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default OkrCheckInCorrectDialog;
