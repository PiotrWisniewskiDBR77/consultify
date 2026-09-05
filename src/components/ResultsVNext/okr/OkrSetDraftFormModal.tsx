/**
 * OkrSetDraftFormModal — quick-create form for `POST /vnext/results/okr/sets`
 * (`createOkrSet`, `okrApi.ts`).
 *
 * Odbiór grafiki 2026-08-30 (Piotr, `results-vnext-okr-registry`): "W prawym,
 * głównym rogu powinien być przycisk »Nowe dodawanie OKR«, a teraz są jakieś
 * inne niepotrzebne przyciski" — the corner had the Programs/Cycles admin-nav
 * pair (`ResultsOkrHub.tsx`'s `adminLinksCta`) sitting in the ONE primary-CTA
 * slot `StandardModuleBar` reserves for a real create action (see that file's
 * own doc comment on `primaryCta` — "JEDEN primary CTA"). There was no create
 * entry point anywhere. This modal is that entry point.
 *
 * Same PURE presentational convention `KpiDraftFormModal.tsx`/
 * `RoiCaseCreateModal.tsx` established: `Modal` primitive, caller (the Hub)
 * owns fetching Programs/Cycles and performs the actual write — this
 * component only renders whatever it is handed and reports back typed
 * values on submit.
 *
 * Fields = exactly `CreateOkrSetSchema` minus `ownerUserId`/`reviewerUserId`/
 * `idempotencyKey` (`server/src/validators/resultsVnextOkr.validators.ts`
 * L240): `programId`, `cycleId`, `scopeType`, `scopeId`, `title`, `reason`.
 * `ownerUserId` is NOT a field here — same reasoning `kpiApi.ts`'s own
 * `createKpiDraft` doc comment gives for KPI's create form: no
 * generally-available "list org members" endpoint a normal member can call
 * to populate an assign-to-someone-else picker, so this quick-create always
 * assigns the current user as owner (the Hub passes that in on submit).
 *
 * A `programId`/`cycleId` are REQUIRED foreign keys — Sets cannot exist
 * without a real Program+Cycle row already published (`okr.routes.ts` L916
 * `POST /programs/:id/publish` is the only path a Program reaches 'active').
 * When the org has none yet, this form does NOT pretend a submit button that
 * can never succeed — same "don't show it as working when the backend
 * can't deliver" rule the calendar-sync-settings honesty fix applies. It
 * shows an honest empty state with links to the very Programs/Cycles admin
 * screens this fix demoted out of the primary corner (their real purpose).
 */
import { AlertTriangle, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';
import { Modal } from '@/components/ui/primitives';

import type { OkrCycleDto, OkrProgramDto } from './okrAdminApi';
import { OKR_SET_SCOPE_TYPES, type OkrSetScopeType } from './okrApi';

export interface OkrSetDraftFormValues {
  programId: string;
  cycleId: string;
  scopeType: OkrSetScopeType;
  scopeId: string;
  title: string;
  reason: string | null;
}

export interface OkrSetDraftFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: OkrSetDraftFormValues) => void;
  isPolish: boolean;
  currentUserId?: string | null;
  currentOrganizationId?: string | null;
  programs: OkrProgramDto[];
  programsLoading: boolean;
  programsError: string | null;
  cycles: OkrCycleDto[];
  cyclesLoading: boolean;
  onProgramChange: (programId: string) => void;
  onOpenPrograms: () => void;
  onOpenCycles: () => void;
  busy?: boolean;
  errorMessage?: string | null;
}

const FIELD_CLASS =
  'w-full h-9 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const TEXTAREA_CLASS =
  'w-full min-h-[64px] rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors resize-y ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';

const LABEL_CLASS =
  'block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5';

const GHOST_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-c-border bg-transparent px-4 ' +
  'text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

const SCOPE_LABEL: Record<OkrSetScopeType, { pl: string; en: string }> = {
  company: { pl: 'Firma', en: 'Company' },
  business_unit: { pl: 'Jednostka biznesowa', en: 'Business unit' },
  team: { pl: 'Zespół', en: 'Team' },
  individual: { pl: 'Indywidualny', en: 'Individual' },
};

export const OkrSetDraftFormModal: React.FC<OkrSetDraftFormModalProps> = ({
  open,
  onClose,
  onSubmit,
  isPolish,
  currentUserId = null,
  currentOrganizationId = null,
  programs,
  programsLoading,
  programsError,
  cycles,
  cyclesLoading,
  onProgramChange,
  onOpenPrograms,
  onOpenCycles,
  busy = false,
  errorMessage = null,
}) => {
  const [title, setTitle] = useState('');
  const [programId, setProgramId] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [scopeType, setScopeType] = useState<OkrSetScopeType>('individual');
  const [scopeId, setScopeId] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  // Reset on every open — same "a second open shows the previous attempt's
  // leftovers" fix `KpiDraftFormModal.tsx`/`RoiCaseCreateModal.tsx` document.
  useEffect(() => {
    if (!open) return;
    setTitle('');
    setProgramId('');
    setCycleId('');
    setScopeType('individual');
    setScopeId(currentUserId ?? '');
    setReason('');
    setTouched(false);
  }, [open, currentUserId]);

  // scopeId's sane default depends on scopeType (D4 in the validator:
  // company -> organizationId explicit, individual -> a user id). Only
  // auto-fill when the field is still at ITS PREVIOUS default, never
  // overwrite something the user actually typed.
  const handleScopeTypeChange = (next: OkrSetScopeType) => {
    setScopeType(next);
    const wasDefault =
      scopeId === '' || scopeId === currentUserId || scopeId === currentOrganizationId;
    if (!wasDefault) return;
    if (next === 'individual') setScopeId(currentUserId ?? '');
    else if (next === 'company') setScopeId(currentOrganizationId ?? '');
    else setScopeId('');
  };

  const handleProgramChange = (next: string) => {
    setProgramId(next);
    setCycleId('');
    onProgramChange(next);
  };

  const noProgramsAvailable = !programsLoading && !programsError && programs.length === 0;
  const titleError = touched && !title.trim();
  const programError = touched && !programId;
  const cycleError = touched && !cycleId;
  const scopeIdError = touched && !scopeId.trim();
  const submitBlocked = busy || noProgramsAvailable;

  const handleSubmit = () => {
    setTouched(true);
    if (!title.trim() || !programId || !cycleId || !scopeId.trim()) return;
    onSubmit({
      programId,
      cycleId,
      scopeType,
      scopeId: scopeId.trim(),
      title: title.trim(),
      reason: reason.trim() || null,
    });
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isPolish ? 'Nowy OKR' : 'New OKR'}
      description={
        isPolish
          ? 'Utworzy nowy zestaw OKR (szkic) w wybranym Programie i Cyklu.'
          : 'Creates a new OKR set (draft) under the chosen Program and Cycle.'
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
            disabled={submitBlocked}
            data-testid="okr-set-draft-form-submit"
            className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Plus size={16} />
            <span>
              {busy
                ? isPolish
                  ? 'Zapisywanie…'
                  : 'Saving…'
                : isPolish
                  ? 'Utwórz OKR'
                  : 'Create OKR'}
            </span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {noProgramsAvailable ? (
          <div className="rounded-lg border border-c-border bg-c-surface-raised p-3 text-sm text-c-text-secondary">
            <p className="font-medium text-c-text">
              {isPolish ? 'Brak Programu OKR do wyboru' : 'No OKR Program to choose from'}
            </p>
            <p className="mt-1">
              {isPolish
                ? 'Zestaw OKR zawsze należy do Programu i Cyklu. Najpierw utwórz i opublikuj Program, potem Cykl — dopiero wtedy da się dodać nowy OKR.'
                : 'An OKR set always belongs to a Program and a Cycle. Create and publish a Program first, then a Cycle — only then can a new OKR be added.'}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={onOpenPrograms} className={GHOST_BUTTON_CLASS}>
                {isPolish ? 'Otwórz Programy' : 'Open Programs'}
              </button>
              <button type="button" onClick={onOpenCycles} className={GHOST_BUTTON_CLASS}>
                {isPolish ? 'Otwórz Cykle' : 'Open Cycles'}
              </button>
            </div>
          </div>
        ) : null}

        {programsError ? (
          <div className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 p-3 text-sm text-c-danger">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{programsError}</span>
          </div>
        ) : null}

        <div>
          <label className={LABEL_CLASS} htmlFor="okr-set-title">
            {isPolish ? 'Tytuł' : 'Title'}
          </label>
          <input
            id="okr-set-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              isPolish
                ? 'np. Skrócić czas przezbrojenia linii A o 30%'
                : 'e.g. Cut line A changeover time by 30%'
            }
            className={FIELD_CLASS}
            data-testid="okr-set-title"
            aria-invalid={titleError || undefined}
          />
          {titleError ? (
            <p className="mt-1 text-[11px] text-c-danger">
              {isPolish ? 'Tytuł jest wymagany' : 'Title is required'}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="okr-set-program">
              {'Program'}
            </label>
            <select
              id="okr-set-program"
              value={programId}
              onChange={(e) => handleProgramChange(e.target.value)}
              className={FIELD_CLASS}
              data-testid="okr-set-program"
              disabled={programsLoading || noProgramsAvailable}
              aria-invalid={programError || undefined}
            >
              <option value="">
                {programsLoading
                  ? isPolish
                    ? 'Ładowanie…'
                    : 'Loading…'
                  : isPolish
                    ? 'Wybierz…'
                    : 'Choose…'}
              </option>
              {programs.map((p) => (
                <option key={p.programId} value={p.programId}>
                  {p.name}
                </option>
              ))}
            </select>
            {programError ? (
              <p className="mt-1 text-[11px] text-c-danger">
                {isPolish ? 'Program jest wymagany' : 'Program is required'}
              </p>
            ) : null}
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="okr-set-cycle">
              {isPolish ? 'Cykl' : 'Cycle'}
            </label>
            <select
              id="okr-set-cycle"
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
              className={FIELD_CLASS}
              data-testid="okr-set-cycle"
              disabled={!programId || cyclesLoading}
              aria-invalid={cycleError || undefined}
            >
              <option value="">
                {!programId
                  ? isPolish
                    ? 'Najpierw wybierz Program'
                    : 'Choose a Program first'
                  : cyclesLoading
                    ? isPolish
                      ? 'Ładowanie…'
                      : 'Loading…'
                    : isPolish
                      ? 'Wybierz…'
                      : 'Choose…'}
              </option>
              {cycles.map((c) => (
                <option key={c.cycleId} value={c.cycleId}>
                  {c.name}
                </option>
              ))}
            </select>
            {cycleError ? (
              <p className="mt-1 text-[11px] text-c-danger">
                {isPolish ? 'Cykl jest wymagany' : 'Cycle is required'}
              </p>
            ) : null}
            {programId && !cyclesLoading && cycles.length === 0 ? (
              <p className="mt-1 text-[11px] text-c-text-muted">
                {isPolish ? 'Ten Program nie ma jeszcze Cyklu.' : 'This Program has no Cycle yet.'}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="okr-set-scope-type">
              {isPolish ? 'Zasięg' : 'Scope'}
            </label>
            <select
              id="okr-set-scope-type"
              value={scopeType}
              onChange={(e) => handleScopeTypeChange(e.target.value as OkrSetScopeType)}
              className={FIELD_CLASS}
              data-testid="okr-set-scope-type"
            >
              {OKR_SET_SCOPE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {isPolish ? SCOPE_LABEL[s].pl : SCOPE_LABEL[s].en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="okr-set-scope-id">
              {isPolish ? 'Identyfikator zasięgu' : 'Scope identifier'}
            </label>
            <input
              id="okr-set-scope-id"
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              className={FIELD_CLASS}
              data-testid="okr-set-scope-id"
              aria-invalid={scopeIdError || undefined}
              disabled={scopeType === 'individual' || scopeType === 'company'}
            />
            {scopeIdError ? (
              <p className="mt-1 text-[11px] text-c-danger">
                {isPolish ? 'Identyfikator zasięgu jest wymagany' : 'Scope identifier is required'}
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="okr-set-reason">
            {isPolish ? 'Notatka (opcjonalnie)' : 'Note (optional)'}
          </label>
          <textarea
            id="okr-set-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="okr-set-reason"
          />
        </div>

        {errorMessage ? (
          <div className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 p-3 text-sm text-c-danger">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default OkrSetDraftFormModal;
