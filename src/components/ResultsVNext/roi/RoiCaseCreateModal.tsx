/**
 * RoiCaseCreateModal — RN-G2 quick-create form for `POST
 * /api/vnext/results/roi/cases` (master plan §9 Etap 3: "quick create
 * zapisujący prawdziwy Draft", not an atrapa).
 *
 * PURE presentational, same shape convention as
 * `src/components/shared/FolderCreateDialog.tsx` (the pattern this file
 * copies): data (`initiatives`) and write behaviour (`onSubmit`/`busy`/
 * `errorMessage`) are supplied by the caller, never fetched here — so the
 * exact same component renders both the live `ResultsRoiHub.tsx` (real
 * `InitiativeApi.getInitiatives()` + `createRoiCase`) and the dev-render QA
 * harness (mock data, no network).
 *
 * Shell: `Modal` (`src/components/ui/primitives/Modal.tsx`) — the
 * app-wide dialog primitive already used in 25+ real screens, chosen
 * specifically because it already implements the a11y contract this
 * package's QA plan requires out of the box: `role="dialog"`+`aria-modal`+
 * `aria-labelledby`, a real Tab focus trap, Escape-to-close, and focus
 * restore to the trigger on close — none of which this package needed to
 * reinvent.
 *
 * Fields = exactly `CreateRoiCaseSchema`
 * (`server/src/validators/resultsVnextRoi.validators.ts` L84-94), no more:
 *   initiativeId (required, picked from the real Initiatives list — see
 *     `initiatives` prop doc) · title (required) · ownerUserId (required —
 *     defaulted to the current user via the JWT-decode pattern already used
 *     by `DeckCommentsPanel.tsx`/`DocumentCommentsPanel.tsx`
 *     `resolveCurrentUserIdFromToken()`, since there is no
 *     generally-available "list org members" endpoint a normal member can
 *     call — `/users` is ADMIN/OWNER/SUPERADMIN-only,
 *     `server/src/routes/users.routes.ts` L134 — so this form does not
 *     invent a picker for a field the app has no real UI capability to
 *     populate any other way; read-only by design, not an oversight) ·
 *     currency (required — the same fixed ISO list `FinancialModelWorkspace.tsx`/
 *     `FinancialStatementImportWizard.tsx` already use:
 *     `['PLN','EUR','USD','GBP','CZK','CHF']`, not invented here) ·
 *     granularity (optional, server defaults to `'monthly'` when omitted —
 *     `roiCaseCommands.ts` L256 — shown explicitly so the user's choice is
 *     never silently defaulted without visibility) · analysisStart/
 *     analysisEnd (optional dates) · reason (optional note).
 */
import { AlertTriangle, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

import type { RoiCaseGranularity } from './roiApi';

export interface RoiCaseCreateInitiativeOption {
  id: string;
  title: string;
}

export interface RoiCaseCreateFormValues {
  initiativeId: string;
  title: string;
  ownerUserId: string;
  currency: string;
  granularity: RoiCaseGranularity;
  analysisStart: string | null;
  analysisEnd: string | null;
  reason: string | null;
}

export interface RoiCaseCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: RoiCaseCreateFormValues) => void;
  isPolish: boolean;
  /** Real initiatives from `InitiativeApi.getInitiatives()` — the app's
   * existing, real endpoint (RN_G2_UI_SCOPE.md §A "initiativeId is a hard
   * dependency"), never a mock/placeholder list in the live Hub. */
  initiatives: RoiCaseCreateInitiativeOption[];
  initiativesLoading?: boolean;
  initiativesError?: string | null;
  /** Current user id resolved from the JWT, or `null` if it could not be
   * resolved (e.g. no token) — the form honestly blocks submit rather than
   * fabricating an owner in that case. */
  currentUserId: string | null;
  /** Save in flight — blocks the submit button, prevents double-submit. */
  busy?: boolean;
  /** Last save attempt's error message (validation / server / network),
   * shown verbatim — never replaced with a generic "something went wrong". */
  errorMessage?: string | null;
  /** `true` when the last error was specifically a 409 conflict — shown
   * with slightly different framing (retry makes sense) than a hard
   * validation failure. */
  isConflict?: boolean;
}

const CURRENCIES = ['PLN', 'EUR', 'USD', 'GBP', 'CZK', 'CHF'];

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

export const RoiCaseCreateModal: React.FC<RoiCaseCreateModalProps> = ({
  open,
  onClose,
  onSubmit,
  isPolish,
  initiatives,
  initiativesLoading = false,
  initiativesError = null,
  currentUserId,
  busy = false,
  errorMessage = null,
  isConflict = false,
}) => {
  const [initiativeId, setInitiativeId] = useState('');
  const [title, setTitle] = useState('');
  const [currency, setCurrency] = useState('PLN');
  const [granularity, setGranularity] = useState<RoiCaseGranularity>('monthly');
  const [analysisStart, setAnalysisStart] = useState('');
  const [analysisEnd, setAnalysisEnd] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  // Reset on every open — otherwise a second open shows the previous
  // attempt's leftovers (same convention as FolderCreateDialog.tsx).
  useEffect(() => {
    if (!open) return;
    setInitiativeId('');
    setTitle('');
    setCurrency('PLN');
    setGranularity('monthly');
    setAnalysisStart('');
    setAnalysisEnd('');
    setReason('');
    setTouched(false);
  }, [open]);

  const initiativeError = touched && !initiativeId;
  const titleError = touched && !title.trim();
  const ownerMissing = !currentUserId;

  // The submit button stays CLICKABLE while required fields are empty —
  // disabling it outright would make the per-field validation messages
  // below unreachable (a disabled `<button>` never fires `onClick`, and
  // this form has no `<form onSubmit>`/Enter-key path either) — a real
  // defect caught in QA (RN-G2 create-package, 2026-08-10): the "Nazwa jest
  // wymagana"/"Wybierz inicjatywę" hints existed in code but a user could
  // never actually trigger them. Only genuinely non-fixable-by-typing
  // blockers (save in flight, initiatives still loading, no resolvable
  // owner) disable the button; a missing initiative/title is instead
  // revealed BY clicking, via `touched`.
  const submitDisabled = busy || initiativesLoading || ownerMissing;

  const handleSubmit = () => {
    setTouched(true);
    if (!initiativeId || !title.trim() || !currentUserId || !currency) return;
    onSubmit({
      initiativeId,
      title: title.trim(),
      ownerUserId: currentUserId,
      currency,
      granularity,
      analysisStart: analysisStart || null,
      analysisEnd: analysisEnd || null,
      reason: reason.trim() || null,
    });
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isPolish ? 'Nowa sprawa ROI' : 'New ROI case'}
      description={
        isPolish
          ? 'Zapisze się jako prawdziwy szkic (Draft) w rejestrze ROI.'
          : 'Saves as a real Draft in the ROI registry.'
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
            data-testid="roi-case-create-submit"
            className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Plus size={16} />
            <span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : isPolish ? 'Utwórz sprawę' : 'Create case'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-create-initiative">
            {isPolish ? 'Inicjatywa' : 'Initiative'}
          </label>
          {initiativesError ? (
            <p className="text-[12px] text-c-danger" role="alert">
              {isPolish
                ? `Nie udało się wczytać listy inicjatyw: ${initiativesError}`
                : `Failed to load initiatives: ${initiativesError}`}
            </p>
          ) : (
            <select
              id="roi-create-initiative"
              value={initiativeId}
              onChange={(e) => setInitiativeId(e.target.value)}
              disabled={initiativesLoading || initiatives.length === 0}
              className={FIELD_CLASS}
              data-testid="roi-create-initiative"
              aria-invalid={initiativeError || undefined}
              aria-describedby={initiativeError ? 'roi-create-initiative-error' : undefined}
            >
              <option value="">
                {initiativesLoading
                  ? isPolish
                    ? 'Wczytywanie inicjatyw…'
                    : 'Loading initiatives…'
                  : initiatives.length === 0
                    ? isPolish
                      ? 'Brak inicjatyw w tej organizacji'
                      : 'No initiatives in this organization'
                    : isPolish
                      ? 'Wybierz inicjatywę…'
                      : 'Select initiative…'}
              </option>
              {initiatives.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
          )}
          {initiativeError ? (
            <p id="roi-create-initiative-error" className="mt-1 text-[11px] text-c-danger">
              {isPolish ? 'Wybierz inicjatywę' : 'Select an initiative'}
            </p>
          ) : null}
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="roi-create-title">
            {isPolish ? 'Nazwa sprawy' : 'Case title'}
          </label>
          <input
            id="roi-create-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isPolish ? 'np. Automatyzacja linii pakowania' : 'e.g. Packaging line automation'}
            className={FIELD_CLASS}
            data-testid="roi-create-title"
            aria-invalid={titleError || undefined}
            aria-describedby={titleError ? 'roi-create-title-error' : undefined}
          />
          {titleError ? (
            <p id="roi-create-title-error" className="mt-1 text-[11px] text-c-danger">
              {isPolish ? 'Nazwa jest wymagana' : 'Title is required'}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-create-currency">
              {isPolish ? 'Waluta' : 'Currency'}
            </label>
            <select
              id="roi-create-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={FIELD_CLASS}
              data-testid="roi-create-currency"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-create-granularity">
              {isPolish ? 'Granulacja' : 'Granularity'}
            </label>
            <select
              id="roi-create-granularity"
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as RoiCaseGranularity)}
              className={FIELD_CLASS}
              data-testid="roi-create-granularity"
            >
              <option value="monthly">{isPolish ? 'Miesięczna' : 'Monthly'}</option>
              <option value="annual">{isPolish ? 'Roczna' : 'Annual'}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-create-start">
              {isPolish ? 'Początek analizy' : 'Analysis start'}
            </label>
            <input
              id="roi-create-start"
              type="date"
              value={analysisStart}
              onChange={(e) => setAnalysisStart(e.target.value)}
              className={FIELD_CLASS}
              data-testid="roi-create-start"
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-create-end">
              {isPolish ? 'Koniec analizy' : 'Analysis end'}
            </label>
            <input
              id="roi-create-end"
              type="date"
              value={analysisEnd}
              onChange={(e) => setAnalysisEnd(e.target.value)}
              className={FIELD_CLASS}
              data-testid="roi-create-end"
            />
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="roi-create-reason">
            {isPolish ? 'Notatka (opcjonalnie)' : 'Note (optional)'}
          </label>
          <textarea
            id="roi-create-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isPolish ? 'Kontekst utworzenia sprawy…' : 'Context for creating this case…'}
            className={TEXTAREA_CLASS}
            data-testid="roi-create-reason"
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
              {isPolish ? 'Ty' : 'You'}{' '}
              <span className="font-mono text-c-text-muted text-[12px]">({currentUserId})</span>
            </p>
          )}
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text"
            data-testid="roi-create-error"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>
              {isConflict
                ? isPolish
                  ? `Konflikt zapisu: ${errorMessage}`
                  : `Write conflict: ${errorMessage}`
                : errorMessage}
            </span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default RoiCaseCreateModal;
