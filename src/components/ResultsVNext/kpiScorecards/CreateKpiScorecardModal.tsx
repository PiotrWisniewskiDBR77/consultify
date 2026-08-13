/**
 * CreateKpiScorecardModal — RN-G6 UI fix, wiring the "Nowa karta wyników" /
 * "New scorecard" quick-create form for `POST /api/vnext/results/kpi/scorecards`
 * (`createKpiScorecard`, already wired in `kpiScorecardApi.ts` but with no UI
 * entry point anywhere in this package — see
 * `docs/product/results-vnext/RN_G5_SCOPEGAP_DESIGN.md` §2, which built this
 * component's ready-to-paste diff and the `ResultsKpiRegistryPage.tsx`
 * integration point, both applied together in this commit since a modal with
 * zero real importers would fail `scripts/check-gestosc.sh`).
 *
 * PURE presentational, same convention `RoiCaseCreateModal.tsx` established
 * for this codebase (`Modal` primitive, caller supplies write behaviour via
 * `onSubmit`/`busy`/`errorMessage`, never fetches/writes itself) — the same
 * component can render both the live `ResultsKpiRegistryPage.tsx` Scorecards
 * tab and a dev-render QA harness.
 *
 * Fields = exactly `CreateScorecardSchema`
 * (`server/src/validators/resultsVnextKpiScorecard.validators.ts` L71-83),
 * no more: `name` (required) · `description` (optional) · `scopeType`
 * (required, one of the 6 `KPI_SCORECARD_SCOPE_TYPES`) · `scopeId` (optional
 * free text — no picker exists for any of the 6 scope types today, same
 * "no generally-available picker" situation `RoiCaseCreateModal.tsx`
 * documents for a different field) · `reviewFrequency` (required, one of the
 * 5 `KPI_SCORECARD_REVIEW_FREQUENCIES`) · `sensitivity` (optional free text —
 * `nullableShortStringField` server-side, not an enum) · `reason` (optional
 * audit note). `ownerUserId` is OPTIONAL server-side (unlike ROI's case
 * owner, which is required) — defaults to the creator when omitted
 * (`kpiScorecardCommands.ts`), so this form shows the resolved current user
 * as an informational "Owner: You" line but never blocks submit on it being
 * unavailable.
 */
import { AlertTriangle, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

import {
  KPI_SCORECARD_REVIEW_FREQUENCIES,
  KPI_SCORECARD_SCOPE_TYPES,
  type KpiScorecardReviewFrequency,
  type KpiScorecardScopeType,
} from './kpiScorecardApi';

export interface CreateKpiScorecardFormValues {
  name: string;
  description: string | null;
  scopeType: KpiScorecardScopeType;
  scopeId: string | null;
  reviewFrequency: KpiScorecardReviewFrequency;
  sensitivity: string | null;
  reason: string | null;
}

export interface CreateKpiScorecardModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateKpiScorecardFormValues) => void;
  isPolish: boolean;
  /** Current user id resolved from the app store, or `null` — shown as an
   * informational "Owner: You" line only; submit is never blocked on this
   * (unlike `RoiCaseCreateModal`'s required owner), since `ownerUserId` is
   * optional server-side and defaults to the creator when omitted. */
  currentUserId: string | null;
  /** Save in flight — blocks the submit button, prevents double-submit. */
  busy?: boolean;
  /** Last save attempt's error message (validation / server / network),
   * shown verbatim — never replaced with a generic "something went wrong". */
  errorMessage?: string | null;
  /** `true` when the last error was specifically a 409 conflict. */
  isConflict?: boolean;
}

const SCOPE_TYPE_LABELS: Record<KpiScorecardScopeType, { pl: string; en: string }> = {
  organization: { pl: 'Organizacja', en: 'Organization' },
  business_unit: { pl: 'Jednostka biznesowa', en: 'Business unit' },
  team: { pl: 'Zespół', en: 'Team' },
  process: { pl: 'Proces', en: 'Process' },
  individual: { pl: 'Indywidualna', en: 'Individual' },
  custom: { pl: 'Niestandardowa', en: 'Custom' },
};

const REVIEW_FREQUENCY_LABELS: Record<KpiScorecardReviewFrequency, { pl: string; en: string }> = {
  weekly: { pl: 'Co tydzień', en: 'Weekly' },
  monthly: { pl: 'Co miesiąc', en: 'Monthly' },
  quarterly: { pl: 'Co kwartał', en: 'Quarterly' },
  annual: { pl: 'Co rok', en: 'Annual' },
  custom: { pl: 'Niestandardowa', en: 'Custom' },
};

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

export const CreateKpiScorecardModal: React.FC<CreateKpiScorecardModalProps> = ({
  open,
  onClose,
  onSubmit,
  isPolish,
  currentUserId,
  busy = false,
  errorMessage = null,
  isConflict = false,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scopeType, setScopeType] = useState<KpiScorecardScopeType>('organization');
  const [scopeId, setScopeId] = useState('');
  const [reviewFrequency, setReviewFrequency] = useState<KpiScorecardReviewFrequency>('monthly');
  const [sensitivity, setSensitivity] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  // Reset on every open — same convention as RoiCaseCreateModal/
  // KpiDraftFormModal, otherwise a second open shows the previous attempt's
  // leftovers.
  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setScopeType('organization');
    setScopeId('');
    setReviewFrequency('monthly');
    setSensitivity('');
    setReason('');
    setTouched(false);
  }, [open]);

  const nameError = touched && !name.trim();

  // Same "stays clickable" convention RoiCaseCreateModal.tsx documents — a
  // disabled button would make the per-field "Nazwa jest wymagana" hint
  // unreachable. Only save-in-flight actually disables the button.
  const submitDisabled = busy;

  const handleSubmit = () => {
    setTouched(true);
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      scopeType,
      scopeId: scopeId.trim() || null,
      reviewFrequency,
      sensitivity: sensitivity.trim() || null,
      reason: reason.trim() || null,
    });
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isPolish ? 'Nowa karta wyników' : 'New scorecard'}
      description={
        isPolish
          ? 'Zapisze się jako prawdziwy szkic (Draft) w rejestrze kart wyników.'
          : 'Saves as a real Draft in the scorecard registry.'
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
            data-testid="kpi-scorecard-create-submit"
            className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Plus size={16} />
            <span>
              {busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : isPolish ? 'Utwórz kartę wyników' : 'Create scorecard'}
            </span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-scorecard-create-name">
            {isPolish ? 'Nazwa karty wyników' : 'Scorecard name'}
          </label>
          <input
            id="kpi-scorecard-create-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isPolish ? 'np. Karta wyników zespołu Sprzedaży' : 'e.g. Sales team scorecard'}
            className={FIELD_CLASS}
            data-testid="kpi-scorecard-create-name"
            aria-invalid={nameError || undefined}
            aria-describedby={nameError ? 'kpi-scorecard-create-name-error' : undefined}
          />
          {nameError ? (
            <p id="kpi-scorecard-create-name-error" className="mt-1 text-[11px] text-c-danger">
              {isPolish ? 'Nazwa jest wymagana' : 'Name is required'}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="kpi-scorecard-create-scope-type">
              {isPolish ? 'Zakres' : 'Scope'}
            </label>
            <select
              id="kpi-scorecard-create-scope-type"
              value={scopeType}
              onChange={(e) => setScopeType(e.target.value as KpiScorecardScopeType)}
              className={FIELD_CLASS}
              data-testid="kpi-scorecard-create-scope-type"
            >
              {KPI_SCORECARD_SCOPE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {isPolish ? SCOPE_TYPE_LABELS[s].pl : SCOPE_TYPE_LABELS[s].en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="kpi-scorecard-create-review-frequency">
              {isPolish ? 'Częstotliwość przeglądu' : 'Review frequency'}
            </label>
            <select
              id="kpi-scorecard-create-review-frequency"
              value={reviewFrequency}
              onChange={(e) => setReviewFrequency(e.target.value as KpiScorecardReviewFrequency)}
              className={FIELD_CLASS}
              data-testid="kpi-scorecard-create-review-frequency"
            >
              {KPI_SCORECARD_REVIEW_FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {isPolish ? REVIEW_FREQUENCY_LABELS[f].pl : REVIEW_FREQUENCY_LABELS[f].en}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-scorecard-create-scope-id">
            {isPolish ? 'Identyfikator zakresu (opcjonalnie)' : 'Scope id (optional)'}
          </label>
          <input
            id="kpi-scorecard-create-scope-id"
            value={scopeId}
            onChange={(e) => setScopeId(e.target.value)}
            placeholder={isPolish ? 'np. identyfikator zespołu/procesu' : 'e.g. team/process id'}
            className={FIELD_CLASS}
            data-testid="kpi-scorecard-create-scope-id"
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-scorecard-create-description">
            {isPolish ? 'Opis (opcjonalnie)' : 'Description (optional)'}
          </label>
          <textarea
            id="kpi-scorecard-create-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isPolish ? 'Do czego służy ta karta wyników…' : 'What this scorecard is for…'}
            className={TEXTAREA_CLASS}
            data-testid="kpi-scorecard-create-description"
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-scorecard-create-sensitivity">
            {isPolish ? 'Wrażliwość danych (opcjonalnie)' : 'Data sensitivity (optional)'}
          </label>
          <input
            id="kpi-scorecard-create-sensitivity"
            value={sensitivity}
            onChange={(e) => setSensitivity(e.target.value)}
            placeholder={isPolish ? 'np. wewnętrzne, poufne' : 'e.g. internal, confidential'}
            className={FIELD_CLASS}
            data-testid="kpi-scorecard-create-sensitivity"
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-scorecard-create-reason">
            {isPolish ? 'Notatka (opcjonalnie)' : 'Note (optional)'}
          </label>
          <textarea
            id="kpi-scorecard-create-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isPolish ? 'Kontekst utworzenia karty wyników…' : 'Context for creating this scorecard…'}
            className={TEXTAREA_CLASS}
            data-testid="kpi-scorecard-create-reason"
          />
        </div>

        <div>
          <div className={LABEL_CLASS}>{isPolish ? 'Właściciel' : 'Owner'}</div>
          <p className="text-sm text-c-text-secondary">
            {currentUserId ? (
              <>
                {isPolish ? 'Ty' : 'You'}{' '}
                <span className="font-mono text-c-text-muted text-[12px]">({currentUserId})</span>
              </>
            ) : isPolish ? (
              'Zostanie ustalony przez serwer.'
            ) : (
              'Will be resolved by the server.'
            )}
          </p>
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text"
            data-testid="kpi-scorecard-create-error"
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

export default CreateKpiScorecardModal;
