/**
 * OkrObjectiveFormModal — create + edit form for an Objective under one OKR
 * Set. Fields = exactly `CreateOkrObjectiveSchema`/`UpdateOkrObjectiveSchema`
 * (`resultsVnextOkr.validators.ts` L377-404), same shape/a11y/idempotency
 * convention as `../roi/RoiCaseCreateModal.tsx`.
 *
 * `confidence`/`confidenceNumericValue` are DELIBERATELY NOT editable fields
 * here — see `okrObjectiveApi.ts`'s `UpdateOkrObjectiveInput` doc comment:
 * the server rejects them with `CONFIDENCE_NOT_OWNER_EDITABLE` (409) unless
 * the Cycle's pinned `objective_confidence_model` is `'owner_selected'`, a
 * policy this small client has no endpoint to read ahead of time. Building
 * an editable field that fails by default for most Programs would be worse
 * than omitting it — confidence is shown READ-ONLY (engine-computed) in the
 * preview instead (`okrObjectivePresenters.tsx`).
 *
 * `ambitionType` defaults to `'standard'` (server default,
 * `okrObjectiveCommands.ts` L417) when left unset in create mode —
 * `committed`/`aspirational` are offered but may be rejected by the server
 * (409 `AMBITION_TYPE_DISABLED`) depending on the Cycle's
 * `committed_vs_aspirational_enabled` policy, which this client cannot
 * read ahead of time either — the server's own message is shown verbatim
 * on rejection, never pre-validated client-side.
 */
import { AlertTriangle, Plus, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

import type { OkrObjectiveAmbitionType, OkrObjectiveDto } from './okrObjectiveApi';

export interface OkrObjectiveFormValues {
  ownerUserId: string;
  title: string;
  description: string | null;
  rationale: string | null;
  ambitionType: OkrObjectiveAmbitionType;
  reason: string | null;
}

export interface OkrObjectiveFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  /** Only used in `edit` mode — pre-fills the form. */
  initial?: OkrObjectiveDto | null;
  onClose: () => void;
  onSubmit: (values: OkrObjectiveFormValues) => void;
  isPolish: boolean;
  /** Resolved from the JWT — same "no org-members-list endpoint" rationale
   * as `RoiCaseCreateModal.tsx`. `null` only blocks CREATE (edit mode keeps
   * the existing owner unless the user is themselves resolvable). */
  currentUserId: string | null;
  /** Set when the owning Set is not `draft`/`changes_requested`
   * (`getOkrSetChildEditLock`) — the modal still opens (TRIADA §C3: a
   * locked CTA still fires, shows why) but submit stays disabled with this
   * reason shown as a persistent banner. */
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

export const OkrObjectiveFormModal: React.FC<OkrObjectiveFormModalProps> = ({
  open,
  mode,
  initial = null,
  onClose,
  onSubmit,
  isPolish,
  currentUserId,
  blockedReason = null,
  busy = false,
  errorMessage = null,
  isConflict = false,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rationale, setRationale] = useState('');
  const [ambitionType, setAmbitionType] = useState<OkrObjectiveAmbitionType>('standard');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? '');
    setDescription(initial?.description ?? '');
    setRationale(initial?.rationale ?? '');
    setAmbitionType(initial?.ambitionType ?? 'standard');
    setReason('');
    setTouched(false);
  }, [open, initial]);

  const titleError = touched && !title.trim();
  const ownerMissing = mode === 'create' && !currentUserId;
  const ownerUserId = mode === 'edit' ? (initial?.ownerUserId ?? currentUserId ?? '') : currentUserId ?? '';

  // Same fix as `RoiCaseCreateModal.tsx`: submit stays clickable with an
  // empty title so the "Nazwa jest wymagana" hint is reachable at all.
  const submitDisabled = busy || ownerMissing || !!blockedReason;

  const handleSubmit = () => {
    setTouched(true);
    if (!title.trim() || !ownerUserId) return;
    onSubmit({
      ownerUserId,
      title: title.trim(),
      description: description.trim() || null,
      rationale: rationale.trim() || null,
      ambitionType,
      reason: reason.trim() || null,
    });
  };

  const isEdit = mode === 'edit';

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isEdit ? (isPolish ? 'Edytuj cel' : 'Edit objective') : isPolish ? 'Nowy cel (Objective)' : 'New objective'}
      description={
        isEdit
          ? isPolish
            ? 'Zmiany zapiszą się natychmiast w rejestrze.'
            : 'Changes save immediately to the registry.'
          : isPolish
            ? 'Zapisze się jako prawdziwy cel pod tym zestawem OKR.'
            : 'Saves as a real objective under this OKR set.'
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
            data-testid="okr-objective-form-submit"
            className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isEdit ? <Save size={16} /> : <Plus size={16} />}
            <span>
              {busy
                ? isPolish
                  ? 'Zapisywanie…'
                  : 'Saving…'
                : isEdit
                  ? isPolish
                    ? 'Zapisz zmiany'
                    : 'Save changes'
                  : isPolish
                    ? 'Utwórz cel'
                    : 'Create objective'}
            </span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {blockedReason ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-[12px] text-c-text"
            data-testid="okr-objective-form-blocked"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300" />
            <span>{blockedReason}</span>
          </div>
        ) : null}
        <div>
          <label className={LABEL_CLASS} htmlFor="okr-objective-title">
            {isPolish ? 'Tytuł celu' : 'Objective title'}
          </label>
          <input
            id="okr-objective-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isPolish ? 'np. Zbudować cyfrową dojrzałość operacji' : 'e.g. Build digital maturity of operations'}
            className={FIELD_CLASS}
            data-testid="okr-objective-title"
            aria-invalid={titleError || undefined}
            aria-describedby={titleError ? 'okr-objective-title-error' : undefined}
          />
          {titleError ? (
            <p id="okr-objective-title-error" className="mt-1 text-[11px] text-c-danger">
              {isPolish ? 'Tytuł jest wymagany' : 'Title is required'}
            </p>
          ) : null}
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="okr-objective-ambition">
            {isPolish ? 'Ambicja' : 'Ambition'}
          </label>
          <select
            id="okr-objective-ambition"
            value={ambitionType}
            onChange={(e) => setAmbitionType(e.target.value as OkrObjectiveAmbitionType)}
            className={FIELD_CLASS}
            data-testid="okr-objective-ambition"
          >
            <option value="standard">{isPolish ? 'Standardowy' : 'Standard'}</option>
            <option value="committed">{isPolish ? 'Zobowiązanie' : 'Committed'}</option>
            <option value="aspirational">{isPolish ? 'Aspiracyjny' : 'Aspirational'}</option>
          </select>
          <p className="mt-1 text-[11px] text-c-text-muted">
            {isPolish
              ? '„Zobowiązanie"/„Aspiracyjny" mogą zostać odrzucone przez serwer, jeśli polityka Cyklu ich nie dopuszcza — komunikat serwera pojawi się poniżej.'
              : '"Committed"/"Aspirational" may be rejected by the server if the Cycle policy disallows them — the server message will appear below.'}
          </p>
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="okr-objective-description">
            {isPolish ? 'Opis (opcjonalnie)' : 'Description (optional)'}
          </label>
          <textarea
            id="okr-objective-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="okr-objective-description"
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="okr-objective-rationale">
            {isPolish ? 'Uzasadnienie (opcjonalnie)' : 'Rationale (optional)'}
          </label>
          <textarea
            id="okr-objective-rationale"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="okr-objective-rationale"
          />
        </div>

        <div>
          <div className={LABEL_CLASS}>{isPolish ? 'Właściciel' : 'Owner'}</div>
          {ownerMissing ? (
            <p className="text-[12px] text-c-danger" role="alert">
              {isPolish
                ? 'Nie udało się ustalić Twojego identyfikatora użytkownika — zaloguj się ponownie.'
                : 'Could not resolve your user id — please sign in again.'}
            </p>
          ) : (
            <p className="text-sm text-c-text-secondary">
              {isEdit ? shortLabel(ownerUserId) : isPolish ? 'Ty' : 'You'}{' '}
              <span className="font-mono text-c-text-muted text-[12px]">({ownerUserId})</span>
            </p>
          )}
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="okr-objective-reason">
            {isPolish ? 'Notatka o zmianie (opcjonalnie)' : 'Change note (optional)'}
          </label>
          <textarea
            id="okr-objective-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="okr-objective-reason"
          />
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text"
            data-testid="okr-objective-form-error"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>{isConflict ? (isPolish ? `Konflikt zapisu: ${errorMessage}` : `Write conflict: ${errorMessage}`) : errorMessage}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

function shortLabel(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

export default OkrObjectiveFormModal;
