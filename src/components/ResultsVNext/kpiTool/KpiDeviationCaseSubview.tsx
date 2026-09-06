/**
 * `/results/kpi/:kpiId/deviation-cases/:caseId` — RN-G3 lane, KPI full tool
 * (klasa L). Deviation Case as a SUBVIEW of the KPI Tool (D05 — never a
 * top-level registry; routing/components are built so a later portfolio
 * view can reuse `kpiDeviationApi.ts`/`kpiToolMappers.ts` without a rewrite).
 *
 * State machine — 9 states + non-exclusive `escalated` overlay, NEVER a
 * 10th state (`KPI_E003_DESIGN.md` L75-78, plan §4.6):
 *   open -> analysis_required -> plan_required -> plan_submitted -> approved
 *   -> executing -> recovery_observed -> verification -> closed
 * Every transition below cites the real server guard — see
 * `kpiDeviationApi.ts`'s own header for the full file:line table; this file
 * does not re-derive the rules, it calls the real commands and lets the
 * server be the single source of truth (client-side `disabled` state is a
 * CONVENIENCE hint, matching the current phase — a stale hint that lets a
 * request through still gets the server's real error surfaced honestly via
 * `errorDetail`, never swallowed).
 *
 * -- COLD REOPEN — FIXED 2026-09-01 (dyżur 173). This screen used to
 * accumulate corrective actions and effectiveness verifications CLIENT-SIDE
 * only, for the current browser session, and carried two permanent warning
 * banners saying so ("after refreshing the page, previously saved actions
 * may not appear here"). That limitation was real when this file was
 * written, but the server had ALREADY closed it in the RN-G6-SRV / B3 pass
 * and nobody wired the client to it — the screen went on warning about a gap
 * that no longer existed, which is worse than the gap: it told the user the
 * data was unreliable while the real, persisted list sat one GET away.
 * `loadChildren()` below now fetches both lists from the live routes
 * (`listCorrectiveActionsForCase`/`listEffectivenessVerificationsForCase` —
 * see `kpiDeviationApi.ts` header for the route/file:line table) on mount
 * and re-fetches after every successful write, so a cold reopen shows what
 * is actually in the database. Both banners are gone. Writes still update
 * local state optimistically first (instant feedback), with the refetch as
 * the authority.
 *
 * -- D06: an action blocked by the CURRENT phase not matching is visible,
 * disabled, with a short reason (TRIADA §C3) — never hidden. A server-side
 * REJECTION (e.g. self-approval, NO_CORRECTIVE_ACTIONS, EFFECTIVENESS_NOT_
 * VERIFIED) is shown verbatim via `errorDetail` — these are workflow/maker-
 * checker rules, not ABAC visibility denials, so the general-reason
 * constraint (D06's security clause) does not apply to them.
 *
 * -- D13 (RN-G5 lane `teresa`, 2026-08-12): the "Poproś Teresę o zapis przez
 * pipeline" action next to "Zapisz analizę" (Phase 2) routes the SAME form
 * fields through the governed P08 propose→approve/reject→execute→audit
 * lifecycle (`kpiTeresaRcaDraft.ts`, `reflection_rca` advisor mode) instead
 * of calling `submitRootCause` directly — see that file's header for why
 * the proposed text is always exactly what the human already typed. The
 * pre-existing manual "Zapisz analizę" button is untouched and remains the
 * primary, always-available path; Teresa's pipeline is an alternative, not
 * a replacement, and stays fully optional per-case.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Flame,
  Link2,
  ListChecks,
  RotateCcw,
  Settings2,
  ShieldAlert,
} from 'lucide-react';

import { NModeShell } from '@/components/shared/NModeLayout/NModeShell';
import type { NModeHeaderConfig, NModeSection } from '@/components/shared/NModeLayout/types';
import { ArtifactRightPanel, type ArtifactRightPanelSection } from '@/components/standard/ArtifactRightPanel';
import { ArtifactPropertiesTable, type ArtifactPropertyRow } from '@/components/standard/ArtifactPropertiesTable';
import { StatusChip } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useAppStore';
import { ROUTES } from '@/routes/routeConfig';

import { EmptyState } from '@/components/shared/states';
import { ResultsVNextForbiddenState } from '../ResultsVNextForbiddenState';
import type { ResultsVNextForbiddenDetail } from '../types';
import { isResultsVNextFlagEnabled } from '../resultsVNextFeatureFlags';
import { toUserFacingErrorMessage } from '../shared/errorMessage';
import { listKpiMeasurements, type KpiMeasurementDto } from '../kpiApi';
import {
  acknowledgeDeviationCase,
  addCorrectiveAction,
  approvePlan,
  closeDeviationCase,
  deescalateDeviationCase,
  deviationErrorDetail,
  escalateDeviationCase,
  getDeviationCase,
  listCorrectiveActionsForCase,
  listEffectivenessVerificationsForCase,
  recordRecoveryObservation,
  reopenDeviationCase,
  submitEffectivenessVerification,
  submitPlan,
  submitRootCause,
  updateCorrectiveAction,
  type CorrectiveActionDto,
  type DeviationCaseDto,
  type EffectivenessVerificationDto,
  type EffectivenessVerificationStatus,
} from './kpiDeviationApi';
import {
  correctiveActionStatusLabel,
  CORRECTIVE_ACTION_STATUS_TONE,
  deviationCaseStatusLabel,
  deviationSeverityLabel,
  DEVIATION_CASE_STATUS_TONE,
  DEVIATION_SEVERITY_TONE,
  effectivenessVerificationStatusLabel,
  EFFECTIVENESS_VERIFICATION_STATUS_TONE,
  escalatedOverlayLabel,
} from './kpiToolMappers';

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
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-50';
const PRIMARY_BUTTON_CLASS = `${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`;

function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function formatDateTime(iso: string | null | undefined, isPolish: boolean): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(isPolish ? 'pl-PL' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** One numbered "phase" panel in the vertical stepper. `current` highlights
 * the phase matching the case's live status; `locked` renders a dimmed,
 * always-visible reason (D06) instead of hiding the phase outright. */
const PhaseCard: React.FC<{
  index: number;
  title: string;
  current: boolean;
  done: boolean;
  children: React.ReactNode;
}> = ({ index, title, current, done, children }) => (
  <div
    className={`rounded-xl border p-4 ${current ? 'border-c-info bg-[color-mix(in_srgb,var(--c-info)_6%,transparent)]' : 'border-c-border-subtle bg-c-surface'}`}
    data-testid={`kpi-deviation-phase-${index}`}
  >
    <div className="flex items-center gap-2 mb-3">
      <span
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
          done
            ? 'bg-c-success/15 text-c-success'
            : current
              ? 'bg-c-info/15 text-c-info'
              : 'bg-c-surface-raised text-c-text-muted'
        }`}
      >
        {done ? <CheckCircle2 size={14} /> : index}
      </span>
      <h3 className="text-sm font-semibold text-c-text">{title}</h3>
    </div>
    {children}
  </div>
);

export const KpiDeviationCaseSubview: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  const { kpiId, caseId } = useParams<{ kpiId: string; caseId: string }>();
  const enabled = isResultsVNextFlagEnabled('kpiRegistry');
  const t = useCallback((pl: string, en: string) => (isPolish ? pl : en), [isPolish]);

  const [kase, setKase] = useState<DeviationCaseDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState<ResultsVNextForbiddenDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  // Loaded from the server on mount and after every successful write — see
  // file header "COLD REOPEN — FIXED".
  const [correctiveActions, setCorrectiveActions] = useState<CorrectiveActionDto[]>([]);
  const [verifications, setVerifications] = useState<EffectivenessVerificationDto[]>([]);
  /** True until the first children fetch settles — keeps an empty list from
   * rendering as a confident "no actions yet" while the request is still in
   * flight. */
  const [childrenLoading, setChildrenLoading] = useState(true);
  /** Set when the children fetch itself failed. An empty list after a FAILED
   * load is not evidence of an empty case, and the UI must not present it as
   * one — this drives an explicit error note instead of a silent blank. */
  const [childrenError, setChildrenError] = useState<string | null>(null);

  // Measurement picklist for "recovery observation" / "effectiveness
  // verification" — real KPI measurements, never a free-text id.
  const [measurements, setMeasurements] = useState<KpiMeasurementDto[]>([]);

  const loadCase = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const record = await getDeviationCase(caseId);
      if (!record) {
        setForbidden({ reason: 'NO_VISIBILITY_RECORD' });
        setKase(null);
        return;
      }
      setForbidden(null);
      setKase(record);
    } catch (err) {
      // RN-G5 polish: plain fetch failure, no server business-rule payload
      // here (that's `deviationErrorDetail`, used only by `run()` below) —
      // never render the raw exception text.
      setLoadError(toUserFacingErrorMessage(err, isPolish));
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  /** Fetches the case's corrective actions + effectiveness verifications from
   * the live server routes. Both are visibility-scoped server-side and return
   * an empty list (never a 404) for a case the caller cannot see, so a clean
   * empty result here genuinely means "nothing recorded", not "hidden". */
  const loadChildren = useCallback(async () => {
    if (!caseId) return;
    setChildrenLoading(true);
    try {
      const [actions, verificationList] = await Promise.all([
        listCorrectiveActionsForCase(caseId),
        listEffectivenessVerificationsForCase(caseId),
      ]);
      setCorrectiveActions(actions);
      setVerifications(verificationList);
      setChildrenError(null);
    } catch (err) {
      setChildrenError(toUserFacingErrorMessage(err, isPolish));
    } finally {
      setChildrenLoading(false);
    }
  }, [caseId, isPolish]);

  useEffect(() => {
    if (!enabled) return;
    void loadCase();
    void loadChildren();
  }, [enabled, loadCase, loadChildren]);

  useEffect(() => {
    if (!enabled || !kpiId) return;
    listKpiMeasurements(kpiId, { limit: 20 })
      .then(setMeasurements)
      .catch(() => setMeasurements([]));
  }, [enabled, kpiId]);

  // ── Form-local state (all hooks declared unconditionally, before any
  // early return below — this program has broken a production KPI screen
  // once already by violating rules-of-hooks, see ResultsKpiRegistryPage.tsx
  // header). ──
  const [rootCauseSummary, setRootCauseSummary] = useState('');
  const [rootCauseCategory, setRootCauseCategory] = useState('');
  const [recurrenceFlag, setRecurrenceFlag] = useState(false);
  const [expectedRecoveryDate, setExpectedRecoveryDate] = useState('');
  const [expectedRecoveryValue, setExpectedRecoveryValue] = useState('');

  const [actionTitle, setActionTitle] = useState('');
  const [actionOwner, setActionOwner] = useState('');
  const [actionDue, setActionDue] = useState('');
  const [actionExpectedEffect, setActionExpectedEffect] = useState('');

  const [recoveryMeasurementId, setRecoveryMeasurementId] = useState('');

  const [verificationStart, setVerificationStart] = useState('');
  const [verificationEnd, setVerificationEnd] = useState('');
  const [verificationOutcome, setVerificationOutcome] = useState<EffectivenessVerificationStatus>('effective');
  const [verificationRationale, setVerificationRationale] = useState('');
  const [verificationMeasurementIds, setVerificationMeasurementIds] = useState<string[]>([]);

  const [escalateReason, setEscalateReason] = useState('');

  const measurementOptions = useMemo(
    () =>
      measurements.map((m) => ({
        id: m.measurementId,
        label: `${m.periodEnd?.slice(0, 10) ?? '—'} · ${m.actualValue ?? (isPolish ? 'brak' : 'none')}`,
      })),
    [measurements, isPolish]
  );

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, onSuccess: (result: T) => void, successMessage: string) => {
      setBusy(true);
      setErrorDetail(null);
      try {
        const result = await fn();
        onSuccess(result);
        toast.success(successMessage);
      } catch (err) {
        const detail = deviationErrorDetail(err);
        // RN-G5 polish: a real server business-rule rejection (NOT_PLAN_
        // REQUIRED, self-approval denial, …) is shown verbatim BY DESIGN —
        // see this file's own header ("shown verbatim via `errorDetail` —
        // these are workflow/maker-checker rules, not ABAC visibility
        // denials"). Only the FALLBACK (no server payload — a raw JS/
        // network-error string) goes through the translated, generic
        // message instead of leaking straight to the screen.
        const message = detail.isServerMessage
          ? detail.message
          : toUserFacingErrorMessage(err, isPolish);
        setErrorDetail(message);
        toast.error(message);
      } finally {
        setBusy(false);
      }
    },
    []
  );

  if (!enabled) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="kpi-deviation-case-disabled">
        <EmptyState
          variant="new"
          icon={ShieldAlert}
          title={t('Sprawa odchylenia — jeszcze nie włączona', 'Deviation case — not yet enabled')}
          description={t(
            'Ten ekran jest w budowie. Wróć później albo poproś administratora o dostęp za flagą.',
            'This screen is still being built. Check back later, or ask an administrator for flag access.'
          )}
          compact
        />
      </div>
    );
  }

  if (forbidden) {
    return (
      <ResultsVNextForbiddenState
        forbidden={forbidden}
        onBack={() => navigate(kpiId ? ROUTES.RESULTS_KPI.TOOL.replace(':kpiId', kpiId) : ROUTES.RESULTS_KPI.ROOT)}
      />
    );
  }

  if (loading || (!kase && !loadError)) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="kpi-deviation-case-loading">
        <div className="text-sm text-c-text-muted">{t('Ładowanie sprawy…', 'Loading case…')}</div>
      </div>
    );
  }

  if (loadError || !kase) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="kpi-deviation-case-error">
        <EmptyState
          variant="error"
          icon={AlertTriangle}
          title={t('Nie udało się wczytać sprawy', 'Could not load the case')}
          description={loadError ?? undefined}
          onRetry={() => void loadCase()}
          compact
        />
      </div>
    );
  }

  const backToKpiTool = () => navigate(kpiId ? ROUTES.RESULTS_KPI.TOOL.replace(':kpiId', kpiId) : ROUTES.RESULTS_KPI.ROOT);

  const isOpen = kase.status === 'open';
  const isAnalysis = kase.status === 'analysis_required';
  const isPlanRequired = kase.status === 'plan_required';
  const isPlanSubmitted = kase.status === 'plan_submitted';
  const isApproved = kase.status === 'approved';
  const isExecuting = kase.status === 'executing';
  const isRecoveryObserved = kase.status === 'recovery_observed';
  const isVerification = kase.status === 'verification';
  const isClosed = kase.status === 'closed';

  // 171-pojedyncze (uwaga właściciela: "grafika jak z przed 5 lat, niespójna
  // z UI/UX"): sprawa przeszła dalej, ale fazy 3/4/5/6 nadal renderowały
  // swój PUSTY formularz edycji (disabled, ale widoczny) zamiast zwięzłego
  // podsumowania „co się stało" — dokładnie ten wzorzec, który fazy 2 i 7
  // już poprawnie stosują (`kase.rootCauseSummary && !isAnalysis` / `isClosed`
  // niżej). Te same nazwy co `done` na każdym PhaseCard, żeby nie rozjechać
  // dwóch kopii tego samego warunku.
  const phase3Done = !isOpen && !isAnalysis && !isPlanRequired;
  const phase4Done = phase3Done && !isPlanSubmitted;
  // Content swap for phase 4 uses a LATER gate than `phase4Done`/the
  // PhaseCard checkmark on purpose: right at 'approved' the approve button
  // is disabled but briefly stays put (existing behavior, still asserted by
  // KpiDeviationCaseSubview.test.tsx's maker-checker flow) — it only
  // collapses into the read-only recap once the case has visibly moved on
  // to execution.
  const phase4Settled = isExecuting || isRecoveryObserved || isVerification || isClosed;
  const phase5Done = isRecoveryObserved || isVerification || isClosed;
  const phase6Done = isVerification || isClosed;

  const header: NModeHeaderConfig = {
    title: t(`Sprawa odchylenia ${shortId(kase.caseId)}`, `Deviation case ${shortId(kase.caseId)}`),
    onTitleChange: () => {},
    titleReadOnly: true,
    // ArtifactType has no dedicated 'deviation_case' member — this is a
    // KPI-scoped sub-object, using the closest available type per
    // `src/utils/artifactLinks.ts` (that file is outside this package's
    // allowlist, so a new enum member is not added here; documented, not
    // silently guessed).
    artifactType: 'kpi',
    artifactId: kase.caseId,
    onSave: () => {},
    saveState: 'saved',
    onClose: backToKpiTool,
    extraOverflowItems: [
      {
        id: 'open-kpi',
        label: t('Otwórz KPI', 'Open KPI'),
        icon: Link2,
        onClick: backToKpiTool,
      },
    ],
  };

  const propertyRows: ArtifactPropertyRow[] = [
    { id: 'kpiId', label: t('KPI', 'KPI'), value: shortId(kase.kpiId) },
    { id: 'severity', label: t('Dotkliwość', 'Severity'), value: deviationSeverityLabel(kase.severity, isPolish) },
    { id: 'owner', label: t('Właściciel', 'Owner'), value: shortId(kase.ownerUserId) },
    { id: 'manager', label: t('Manager', 'Manager'), value: shortId(kase.managerUserId) },
    { id: 'detected', label: t('Wykryto', 'Detected'), value: formatDateTime(kase.detectedAt, isPolish) },
    { id: 'due', label: t('Termin reakcji', 'Response due'), value: formatDateTime(kase.responseDueAt, isPolish) },
    { id: 'rowVersion', label: t('Wersja', 'Version'), value: String(kase.rowVersion), mono: true },
  ];

  const rightPanelSections: ArtifactRightPanelSection[] = [
    {
      id: 'actions',
      label: t('Akcje', 'Actions'),
      icon: Settings2,
      defaultOpen: true,
      children: (
        <div className="space-y-2">
          {!isClosed ? (
            <div className="space-y-2">
              <textarea
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                placeholder={t('Powód eskalacji (opcjonalnie)', 'Escalation reason (optional)')}
                className={TEXTAREA_CLASS}
              />
              <button
                type="button"
                disabled={busy}
                className={GHOST_BUTTON_CLASS}
                onClick={() =>
                  run(
                    () =>
                      kase.escalated
                        ? deescalateDeviationCase(kase.caseId, { expectedVersion: kase.rowVersion })
                        : escalateDeviationCase(kase.caseId, {
                            expectedVersion: kase.rowVersion,
                            escalatedReason: escalateReason.trim() || null,
                          }),
                    (res) => setKase(res.case),
                    kase.escalated ? t('Eskalacja cofnięta', 'De-escalated') : t('Sprawa eskalowana', 'Escalated')
                  )
                }
              >
                <Flame size={14} />
                {kase.escalated ? t('Cofnij eskalację', 'De-escalate') : t('Eskaluj', 'Escalate')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              className={GHOST_BUTTON_CLASS}
              onClick={() =>
                run(
                  () => reopenDeviationCase(kase.caseId, {}),
                  (res) => navigate(`${ROUTES.RESULTS_KPI.TOOL.replace(':kpiId', kpiId ?? '')}/deviation-cases/${res.case.caseId}`),
                  t('Sprawa wznowiona', 'Case reopened')
                )
              }
            >
              <RotateCcw size={14} />
              {t('Wznów sprawę', 'Reopen case')}
            </button>
          )}
        </div>
      ),
    },
    {
      id: 'properties',
      label: t('Właściwości', 'Properties'),
      icon: ListChecks,
      defaultOpen: true,
      children: (
        <ArtifactPropertiesTable
          rows={propertyRows}
          propertyLabel={t('Właściwość', 'Property')}
          valueLabel={t('Wartość', 'Value')}
        />
      ),
    },
    {
      id: 'relations',
      label: t('Powiązania', 'Relations'),
      icon: Link2,
      defaultOpen: false,
      isEmpty: !kase.reopenedFromCaseId,
      emptyLabel: t('Brak powiązań', 'No relations'),
      children: kase.reopenedFromCaseId ? (
        <button
          type="button"
          className="text-xs text-c-info underline"
          onClick={() =>
            navigate(
              `${ROUTES.RESULTS_KPI.TOOL.replace(':kpiId', kpiId ?? '')}/deviation-cases/${kase.reopenedFromCaseId}`
            )
          }
        >
          {t('Poprzednia (zamknięta) sprawa', 'Prior (closed) case')}
        </button>
      ) : null,
    },
  ];

  const workflowSection: NModeSection = {
    id: 'workflow',
    icon: ClipboardList,
    label: { pl: 'Przebieg sprawy', en: 'Case workflow' },
    hasData: true,
    alwaysShow: true,
    component: (
      <div className="space-y-4 pb-8">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusChip label={deviationCaseStatusLabel(kase.status, isPolish)} tone={DEVIATION_CASE_STATUS_TONE[kase.status]} />
          <StatusChip label={deviationSeverityLabel(kase.severity, isPolish)} tone={DEVIATION_SEVERITY_TONE[kase.severity]} />
          {kase.escalated ? (
            <StatusChip label={escalatedOverlayLabel(isPolish)} tone="danger" />
          ) : null}
        </div>

        {errorDetail ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text"
            data-testid="kpi-deviation-error"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>{errorDetail}</span>
          </div>
        ) : null}

        {/* Phase 1 — detection + acknowledge */}
        <PhaseCard index={1} title={t('Wykrycie i potwierdzenie', 'Detection & acknowledgement')} current={isOpen} done={!isOpen}>
          <p className="text-xs text-c-text-muted mb-3">
            {t(
              `Pomiar wywołujący: ${shortId(kase.triggerMeasurementId)} · wykryto ${formatDateTime(kase.detectedAt, isPolish)}`,
              `Trigger measurement: ${shortId(kase.triggerMeasurementId)} · detected ${formatDateTime(kase.detectedAt, isPolish)}`
            )}
          </p>
          {isOpen ? (
            <button
              type="button"
              disabled={busy}
              className={PRIMARY_BUTTON_CLASS}
              onClick={() =>
                run(
                  () => acknowledgeDeviationCase(kase.caseId, { expectedVersion: kase.rowVersion }),
                  (res) => setKase(res.case),
                  t('Sprawa potwierdzona', 'Case acknowledged')
                )
              }
            >
              {t('Potwierdź', 'Acknowledge')}
            </button>
          ) : (
            <p className="text-xs text-c-text-secondary">
              {t('Potwierdzona.', 'Acknowledged.')}
            </p>
          )}
        </PhaseCard>

        {/* Phase 2 — root cause analysis */}
        <PhaseCard
          index={2}
          title={t('Analiza przyczyny źródłowej', 'Root cause analysis')}
          current={isAnalysis}
          done={!isOpen && !isAnalysis}
        >
          {kase.rootCauseSummary && !isAnalysis ? (
            <div className="text-xs text-c-text-secondary space-y-1">
              <p>
                <span className="text-c-text-muted">{t('Przyczyna: ', 'Cause: ')}</span>
                {kase.rootCauseSummary}
              </p>
              <p>
                <span className="text-c-text-muted">{t('Kategoria: ', 'Category: ')}</span>
                {kase.rootCauseCategory ?? '—'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                {/* axe `label`: these LABEL_CLASS labels sit next to their
                    field visually but were never wired via htmlFor/id — a
                    sibling <label> with no programmatic link isn't an
                    accessible label. Same fix repeated for every
                    LABEL_CLASS + input/textarea/select pair in this file. */}
                <label className={LABEL_CLASS} htmlFor="kpi-deviation-root-cause-summary">
                  {t('Podsumowanie przyczyny', 'Root cause summary')}
                </label>
                <textarea
                  id="kpi-deviation-root-cause-summary"
                  value={rootCauseSummary}
                  onChange={(e) => setRootCauseSummary(e.target.value)}
                  disabled={!isAnalysis}
                  className={TEXTAREA_CLASS}
                  data-testid="kpi-deviation-root-cause-summary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS} htmlFor="kpi-deviation-root-cause-category">
                    {t('Kategoria', 'Category')}
                  </label>
                  <input
                    id="kpi-deviation-root-cause-category"
                    value={rootCauseCategory}
                    onChange={(e) => setRootCauseCategory(e.target.value)}
                    disabled={!isAnalysis}
                    className={FIELD_CLASS}
                    data-testid="kpi-deviation-root-cause-category"
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS} htmlFor="kpi-deviation-expected-recovery-date">
                    {t('Oczekiwana data odbudowy', 'Expected recovery date')}
                  </label>
                  <input
                    id="kpi-deviation-expected-recovery-date"
                    type="date"
                    value={expectedRecoveryDate}
                    onChange={(e) => setExpectedRecoveryDate(e.target.value)}
                    disabled={!isAnalysis}
                    className={FIELD_CLASS}
                  />
                </div>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-c-text-secondary">
                <input
                  type="checkbox"
                  checked={recurrenceFlag}
                  onChange={(e) => setRecurrenceFlag(e.target.checked)}
                  disabled={!isAnalysis}
                  /*
                   * Odbiór grafiki 174-domkniecie (2026-09-01): na ciemnym
                   * motywie ten kwadrat wychodził piaskowo-oliwkowy, obcy
                   * całej powłoce. Zmierzone: `appearance: auto` + autorskie
                   * `background-color` — Chromium miesza tło autora z własnym
                   * malowaniem kontrolki i daje błoto. `color-scheme: dark`
                   * (src/index.css:238) już rysuje ciemny checkbox poprawnie,
                   * więc tło NIE MOŻE być nadpisywane; kolor zaznaczenia
                   * ustawia `accent-color`, a nie `text-*` (to działa tylko
                   * z pluginem @tailwindcss/forms, którego tu nie ma).
                   *
                   * UWAGA: kanoniczna klasa checkboxa w
                   * `FilterableTable.tsx:394` ma dokładnie ten sam defekt
                   * (`bg-slate-200 dark:bg-navy-700 text-c-info`) — do
                   * rozliczenia osobno, poza tym dyżurem.
                   */
                  className="h-3.5 w-3.5 accent-c-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                />
                {t('To odchylenie się powtarza', 'This deviation is recurring')}
              </label>
              <button
                type="button"
                disabled={busy || !isAnalysis || !rootCauseSummary.trim() || !rootCauseCategory.trim()}
                title={!isAnalysis ? t('Dostępne tylko w stanie „Wymaga analizy"', 'Only available while "Analysis required"') : undefined}
                className={PRIMARY_BUTTON_CLASS}
                data-testid="kpi-deviation-submit-root-cause"
                onClick={() =>
                  run(
                    () =>
                      submitRootCause(kase.caseId, {
                        expectedVersion: kase.rowVersion,
                        rootCauseSummary: rootCauseSummary.trim(),
                        rootCauseCategory: rootCauseCategory.trim(),
                        recurrenceFlag,
                        expectedRecoveryDate: expectedRecoveryDate || null,
                        expectedRecoveryValue: expectedRecoveryValue ? Number(expectedRecoveryValue) : null,
                      }),
                    (res) => setKase(res.case),
                    t('Analiza zapisana, przejście do planu', 'Analysis saved, moved to plan')
                  )
                }
              >
                {t('Zapisz analizę', 'Save analysis')}
              </button>
            </div>
          )}
        </PhaseCard>

        {/* Phase 3 — corrective actions + plan */}
        <PhaseCard
          index={3}
          title={t('Działania korygujące i plan', 'Corrective actions & plan')}
          current={isPlanRequired}
          done={phase3Done}
        >
          {childrenError ? (
            <div
              role="note"
              className="mb-3 rounded-lg border border-c-warning/30 bg-c-warning/10 px-3 py-2 text-[11px] text-c-text-secondary"
              data-testid="kpi-deviation-actions-load-error"
            >
              {t(
                'Nie udało się wczytać zapisanych działań — poniższa lista może być niepełna.',
                'Saved actions could not be loaded — the list below may be incomplete.'
              )}{' '}
              {childrenError}
            </div>
          ) : null}
          {childrenLoading && correctiveActions.length === 0 ? (
            <p className="mb-3 text-xs text-c-text-muted" data-testid="kpi-deviation-actions-loading">
              {t('Wczytywanie działań…', 'Loading actions…')}
            </p>
          ) : null}
          {correctiveActions.length > 0 ? (
            <ul className="space-y-2 mb-3" data-testid="kpi-deviation-actions-list">
              {correctiveActions.map((a) => (
                <li key={a.actionId} className="rounded-lg border border-c-border-subtle p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-c-text">{a.title}</span>
                    <StatusChip label={correctiveActionStatusLabel(a.status, isPolish)} tone={CORRECTIVE_ACTION_STATUS_TONE[a.status]} />
                  </div>
                  {(isApproved || isExecuting) && a.status !== 'completed' && a.status !== 'cancelled' ? (
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        className={`${FIELD_CLASS} h-7 text-xs w-auto`}
                        value={a.status}
                        aria-label={t(`Status działania: ${a.title}`, `Action status: ${a.title}`)}
                        data-testid={`kpi-deviation-action-status-${a.actionId}`}
                        onChange={(e) => {
                          const nextStatus = e.target.value as CorrectiveActionDto['status'];
                          void run(
                            () => updateCorrectiveAction(kase.caseId, a.actionId, { expectedVersion: a.rowVersion, status: nextStatus }),
                            (res) => {
                              setCorrectiveActions((prev) => prev.map((x) => (x.actionId === a.actionId ? res.action : x)));
                              void loadChildren();
                              if (res.caseAutoTransitionedToExecuting) void loadCase();
                            },
                            t('Działanie zaktualizowane', 'Action updated')
                          );
                        }}
                      >
                        {(['planned', 'active', 'blocked', 'completed', 'cancelled'] as const).map((s) => (
                          <option key={s} value={s}>
                            {correctiveActionStatusLabel(s, isPolish)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {phase3Done ? (
            <p className="text-xs text-c-text-secondary">
              {t(
                'Plan złożony — status zatwierdzenia w sekcji „Zatwierdzenie planu" poniżej.',
                'Plan submitted — see "Plan approval" below for its approval status.'
              )}
            </p>
          ) : (
            <div className="space-y-2">
              <input
                value={actionTitle}
                onChange={(e) => setActionTitle(e.target.value)}
                placeholder={t('Tytuł działania', 'Action title')}
                disabled={!isPlanRequired}
                className={FIELD_CLASS}
                data-testid="kpi-deviation-action-title"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={actionOwner}
                  onChange={(e) => setActionOwner(e.target.value)}
                  placeholder={t('ID właściciela działania', 'Action owner user id')}
                  disabled={!isPlanRequired}
                  className={FIELD_CLASS}
                  data-testid="kpi-deviation-action-owner"
                />
                <input
                  type="date"
                  value={actionDue}
                  onChange={(e) => setActionDue(e.target.value)}
                  disabled={!isPlanRequired}
                  aria-label={t('Termin działania', 'Action due date')}
                  className={FIELD_CLASS}
                />
              </div>
              <textarea
                value={actionExpectedEffect}
                onChange={(e) => setActionExpectedEffect(e.target.value)}
                placeholder={t('Oczekiwany efekt (opcjonalnie)', 'Expected effect (optional)')}
                disabled={!isPlanRequired}
                className={TEXTAREA_CLASS}
              />
              <button
                type="button"
                disabled={busy || !isPlanRequired || !actionTitle.trim() || !actionOwner.trim()}
                title={!isPlanRequired ? t('Dostępne tylko w stanie „Wymaga planu"', 'Only available while "Plan required"') : undefined}
                className={GHOST_BUTTON_CLASS}
                data-testid="kpi-deviation-add-action"
                onClick={() =>
                  run(
                    () =>
                      addCorrectiveAction(kase.caseId, {
                        title: actionTitle.trim(),
                        ownerUserId: actionOwner.trim(),
                        dueDate: actionDue || null,
                        expectedEffect: actionExpectedEffect.trim() || null,
                      }),
                    (res) => {
                      // Optimistic append for instant feedback; the refetch
                      // right after is the authority (it also picks up any
                      // action added from another surface or session).
                      setCorrectiveActions((prev) => [...prev, res.action]);
                      setActionTitle('');
                      setActionOwner('');
                      setActionDue('');
                      setActionExpectedEffect('');
                      void loadChildren();
                    },
                    t('Działanie dodane', 'Action added')
                  )
                }
              >
                {t('Dodaj działanie', 'Add action')}
              </button>
              <button
                type="button"
                disabled={busy || !isPlanRequired}
                title={!isPlanRequired ? t('Dostępne tylko w stanie „Wymaga planu"', 'Only available while "Plan required"') : undefined}
                className={PRIMARY_BUTTON_CLASS}
                data-testid="kpi-deviation-submit-plan"
                onClick={() =>
                  run(
                    () => submitPlan(kase.caseId, { expectedVersion: kase.rowVersion }),
                    (res) => setKase(res.case),
                    t('Plan złożony', 'Plan submitted')
                  )
                }
              >
                {t('Złóż plan', 'Submit plan')}
              </button>
            </div>
          )}
        </PhaseCard>

        {/* Phase 4 — plan approval (maker-checker) */}
        <PhaseCard
          index={4}
          title={t('Zatwierdzenie planu', 'Plan approval')}
          current={isPlanSubmitted}
          done={phase4Done}
        >
          {/*
            Odbiór grafiki 174-domkniecie (2026-09-01): dopóki planu nikt nie
            złożył, ten wiersz pisał „Złożył: — · —" — dwa myślniki zamiast
            zdania. Pusty rekord ma mówić, czego brakuje, a nie pokazywać
            interpunkcję w miejscu danych.
          */}
          <p className="text-xs text-c-text-muted mb-3">
            {kase.planSubmittedBy
              ? t(
                  `Złożył: ${shortId(kase.planSubmittedBy)} · ${formatDateTime(kase.planSubmittedAt, isPolish)}`,
                  `Submitted by: ${shortId(kase.planSubmittedBy)} · ${formatDateTime(kase.planSubmittedAt, isPolish)}`
                )
              : t('Plan nie został jeszcze złożony.', 'The plan has not been submitted yet.')}
          </p>
          {phase4Settled ? (
            <p className="text-xs text-c-text-secondary">
              {t(
                `Zatwierdzono: ${shortId(kase.planApprovedBy)} · ${formatDateTime(kase.planApprovedAt, isPolish)}`,
                `Approved by: ${shortId(kase.planApprovedBy)} · ${formatDateTime(kase.planApprovedAt, isPolish)}`
              )}
            </p>
          ) : (
            <>
              <p className="text-[11px] text-c-text-muted mb-2">
                {t(
                  'Plan zatwierdza ktoś inny niż osoba, która go złożyła, i niż osoba, która założyła sprawę — to zasada czterech oczu.',
                  'The plan is approved by someone other than the person who submitted it and the person who opened the case — the four-eyes rule.'
                )}
              </p>
              <button
                type="button"
                disabled={busy || !isPlanSubmitted}
                title={!isPlanSubmitted ? t('Dostępne tylko w stanie „Plan złożony"', 'Only available while "Plan submitted"') : undefined}
                className={PRIMARY_BUTTON_CLASS}
                data-testid="kpi-deviation-approve-plan"
                onClick={() =>
                  run(
                    () => approvePlan(kase.caseId, { expectedVersion: kase.rowVersion }),
                    (res) => setKase(res.case),
                    t('Plan zatwierdzony', 'Plan approved')
                  )
                }
              >
                {t('Zatwierdź plan', 'Approve plan')}
              </button>
            </>
          )}
        </PhaseCard>

        {/* Phase 5 — recovery observation */}
        <PhaseCard
          index={5}
          title={t('Obserwacja odbudowy', 'Recovery observation')}
          current={isExecuting}
          done={phase5Done}
        >
          {phase5Done ? (
            <p className="text-xs text-c-text-secondary">
              {t(
                `Zaobserwowano: ${shortId(kase.recoveryObservedBy)} · ${formatDateTime(kase.recoveryObservedAt, isPolish)}`,
                `Observed by: ${shortId(kase.recoveryObservedBy)} · ${formatDateTime(kase.recoveryObservedAt, isPolish)}`
              )}
            </p>
          ) : (
            <>
              <p className="text-xs text-c-text-muted mb-2">
                {t(
                  'Sprawa przechodzi z „Plan zatwierdzony" w „W realizacji" sama — w chwili, gdy pierwsze działanie ruszy.',
                  'The case moves from "Plan approved" to "In progress" on its own — the moment the first action starts.'
                )}
              </p>
              <div className="space-y-2">
                <select
                  value={recoveryMeasurementId}
                  onChange={(e) => setRecoveryMeasurementId(e.target.value)}
                  disabled={!isExecuting}
                  aria-label={t('Pomiar odbudowy', 'Recovery measurement')}
                  className={FIELD_CLASS}
                  data-testid="kpi-deviation-recovery-measurement"
                >
                  <option value="">{t('Wybierz pomiar…', 'Select measurement…')}</option>
                  {measurementOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy || !isExecuting || !recoveryMeasurementId}
                  title={!isExecuting ? t('Dostępne tylko w stanie „W realizacji"', 'Only available while "Executing"') : undefined}
                  className={GHOST_BUTTON_CLASS}
                  onClick={() =>
                    run(
                      () =>
                        recordRecoveryObservation(kase.caseId, {
                          expectedVersion: kase.rowVersion,
                          recoveryObservationMeasurementId: recoveryMeasurementId,
                        }),
                      (res) => setKase(res.case),
                      t('Obserwacja odbudowy zapisana', 'Recovery observation recorded')
                    )
                  }
                >
                  {t('Zapisz obserwację odbudowy', 'Record recovery observation')}
                </button>
              </div>
            </>
          )}
        </PhaseCard>

        {/* Phase 6 — effectiveness verification */}
        <PhaseCard
          index={6}
          title={t('Weryfikacja skuteczności', 'Effectiveness verification')}
          current={isExecuting || isRecoveryObserved}
          done={phase6Done}
        >
          {childrenLoading && verifications.length === 0 ? (
            <p className="mb-3 text-xs text-c-text-muted" data-testid="kpi-deviation-verifications-loading">
              {t('Wczytywanie weryfikacji…', 'Loading verifications…')}
            </p>
          ) : null}
          {verifications.length > 0 ? (
            <ul className="space-y-1.5 mb-3" data-testid="kpi-deviation-verifications-list">
              {verifications.map((v) => (
                <li key={v.verificationId} className="flex items-center gap-2">
                  <StatusChip
                    label={effectivenessVerificationStatusLabel(v.status, isPolish)}
                    tone={EFFECTIVENESS_VERIFICATION_STATUS_TONE[v.status]}
                  />
                  <span className="text-[11px] text-c-text-muted">{v.rationale ?? '—'}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {phase6Done ? (
            verifications.length === 0 ? (
              <p className="text-xs text-c-text-secondary">
                {t(
                  'Weryfikacja zgłoszona — sprawa poszła dalej.',
                  'Verification submitted — the case has moved on.'
                )}
              </p>
            ) : null
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={LABEL_CLASS} htmlFor="kpi-deviation-verification-window-start">
                    {t('Początek okna', 'Window start')}
                  </label>
                  <input
                    id="kpi-deviation-verification-window-start"
                    type="date"
                    value={verificationStart}
                    onChange={(e) => setVerificationStart(e.target.value)}
                    disabled={!isExecuting && !isRecoveryObserved}
                    className={FIELD_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS} htmlFor="kpi-deviation-verification-window-end">
                    {t('Koniec okna', 'Window end')}
                  </label>
                  <input
                    id="kpi-deviation-verification-window-end"
                    type="date"
                    value={verificationEnd}
                    onChange={(e) => setVerificationEnd(e.target.value)}
                    disabled={!isExecuting && !isRecoveryObserved}
                    className={FIELD_CLASS}
                  />
                </div>
              </div>
              <select
                value={verificationOutcome}
                onChange={(e) => setVerificationOutcome(e.target.value as EffectivenessVerificationStatus)}
                disabled={!isExecuting && !isRecoveryObserved}
                aria-label={t('Wynik weryfikacji skuteczności', 'Effectiveness verification outcome')}
                className={FIELD_CLASS}
                data-testid="kpi-deviation-verification-outcome"
              >
                {(['effective', 'partially_effective', 'ineffective'] as const).map((s) => (
                  <option key={s} value={s}>
                    {effectivenessVerificationStatusLabel(s, isPolish)}
                  </option>
                ))}
              </select>
              <textarea
                value={verificationRationale}
                onChange={(e) => setVerificationRationale(e.target.value)}
                placeholder={t('Uzasadnienie', 'Rationale')}
                disabled={!isExecuting && !isRecoveryObserved}
                className={TEXTAREA_CLASS}
              />
              <div className="space-y-1">
                <span className="text-[11px] text-c-text-muted">{t('Powiązane pomiary (opcjonalnie)', 'Related measurements (optional)')}</span>
                <div className="flex flex-wrap gap-2">
                  {measurementOptions.map((m) => (
                    <label key={m.id} className="flex items-center gap-1 text-[11px] text-c-text-secondary">
                      <input
                        type="checkbox"
                        checked={verificationMeasurementIds.includes(m.id)}
                        disabled={!isExecuting && !isRecoveryObserved}
                        onChange={(e) =>
                          setVerificationMeasurementIds((prev) =>
                            e.target.checked ? [...prev, m.id] : prev.filter((id) => id !== m.id)
                          )
                        }
                        className="h-3 w-3 accent-c-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>
              <button
                type="button"
                disabled={busy || (!isExecuting && !isRecoveryObserved) || !verificationStart || !verificationEnd}
                title={
                  !isExecuting && !isRecoveryObserved
                    ? t('Dostępne w stanie „W realizacji" lub „Odbudowa zaobserwowana"', 'Only available while "Executing" or "Recovery observed"')
                    : undefined
                }
                className={PRIMARY_BUTTON_CLASS}
                data-testid="kpi-deviation-submit-verification"
                onClick={() =>
                  run(
                    () =>
                      submitEffectivenessVerification(kase.caseId, {
                        expectedVersion: kase.rowVersion,
                        verificationWindowStart: verificationStart,
                        verificationWindowEnd: verificationEnd,
                        outcome: verificationOutcome,
                        rationale: verificationRationale.trim() || null,
                        measurementIds: verificationMeasurementIds,
                      }),
                    (res) => {
                      setKase(res.case);
                      setVerifications((prev) => [...prev, res.verification]);
                      void loadChildren();
                    },
                    t('Weryfikacja zgłoszona', 'Verification submitted')
                  )
                }
              >
                {t('Zgłoś weryfikację', 'Submit verification')}
              </button>
            </div>
          )}
        </PhaseCard>

        {/* Phase 7 — close / reopen */}
        <PhaseCard index={7} title={t('Zamknięcie sprawy', 'Case closure')} current={isVerification} done={isClosed}>
          {isClosed ? (
            <p className="text-xs text-c-text-secondary">
              {t(
                `Zamknięto ${formatDateTime(kase.closedAt, isPolish)} przez ${shortId(kase.closedBy)}.`,
                `Closed ${formatDateTime(kase.closedAt, isPolish)} by ${shortId(kase.closedBy)}.`
              )}
            </p>
          ) : (
            <>
              <p className="text-[11px] text-c-text-muted mb-2">
                {t(
                  'Sprawę można zamknąć, gdy ostatnia weryfikacja skuteczności wypadła skutecznie albo częściowo skutecznie.',
                  'The case can be closed once the latest effectiveness verification came out effective or partially effective.'
                )}
              </p>
              <button
                type="button"
                disabled={busy || !isVerification}
                title={!isVerification ? t('Dostępne tylko w stanie „Weryfikacja skuteczności"', 'Only available while "Effectiveness verification"') : undefined}
                className={PRIMARY_BUTTON_CLASS}
                data-testid="kpi-deviation-close-case"
                onClick={() =>
                  run(
                    () => closeDeviationCase(kase.caseId, { expectedVersion: kase.rowVersion }),
                    (res) => setKase(res.case),
                    t('Sprawa zamknięta', 'Case closed')
                  )
                }
              >
                {t('Zamknij sprawę', 'Close case')}
              </button>
            </>
          )}
        </PhaseCard>
      </div>
    ),
  };

  return (
    <div className="h-full" data-testid="results-vnext-kpi-deviation-case-subview">
      <NModeShell
        header={header}
        sections={[workflowSection]}
        activeSection="workflow"
        onSectionChange={() => {}}
        presentationMode="n"
        onPresentationModeChange={() => {}}
        showModeSwitcher={false}
        rightPanel={<ArtifactRightPanel sections={rightPanelSections} ariaLabel={t('Panel sprawy', 'Case panel')} />}
      />
    </div>
  );
};

export default KpiDeviationCaseSubview;
