/**
 * `BaselineWorkspace` — Pakiet F (Baseline Models Product Engineer).
 *
 * Ekran-obiekt Baseline Model, zbudowany na platformie Pakietu C
 * (`FinanceWorkspaceBar`, `useFinanceFocusMode`, `FinanceErrorBoundary`) i
 * kanonicznym `/api/v8/finance-v2/baseline/*` (Pakiet B2). Zamyka sześć
 * naruszeń, które orkiestrator znalazł na dzisiejszym ekranie „Models"
 * (`src/components/Finance/FinancialModelWorkspace.tsx`, stary system —
 * `docs/validation/finance-v3/generated/gate-e/PKG_F_BASELINE_report.md` §1):
 *
 *   V-1 USUNIĘTA zakładka „Oś czasu zdarzeń" — Baseline jest z definicji
 *       no-decision (DEC-FIN-002); zdarzenia/decyzje żyją w Prediction.
 *   V-2 USUNIĘTA akcja „Wyceń model" z głównego paska — wycena jest
 *       downstream (Valuation), nie akcją tego ekranu.
 *   V-3 DOKŁADNIE DWA widoki: Założenia i Wyliczenia (`viewNavigation.views`
 *       poniżej — policz programowo w teście, nie na oko).
 *   V-4 Jednolity polski w całej powłoce (skróty finansowe REVENUE/COGS/
 *       EBITDA zostają kanoniczne — CANON pozwala).
 *   V-5 Brak martwej przestrzeni — oba widoki wypełniają pełną wysokość/
 *       szerokość (`flex-1`/`w-full`, zero pustego bloku pod paskiem).
 *   V-6 JEDEN `FinanceWorkspaceBar` (identyczność+wersja+status+kontekst),
 *       fullscreen jako ostatnia akcja, brak osobnego pasa „GROUNDED ON"/
 *       „Version history" w treści strony — historia wersji żyje w menu
 *       lifecycle paska (`FinanceWorkspaceBar` już to renderuje), źródło w
 *       Context popover (i).
 *
 * Ten komponent NIE jest dziś wpięty w żaden routing produkcyjny (poza
 * allowlistą tego pakietu — `FinanceHub.tsx`/routing to teren integracji po
 * akcepcie) — dostępny wyłącznie przez `dev-render/` i za flagą
 * `financeBaselineWorkspaceV1` (domyślnie OFF, CLAUDE.md #7).
 */
import React, { useEffect, useMemo, useState } from 'react';

import { FinanceErrorBoundary } from '@/components/Finance/shared/FinanceErrorBoundary';
import { FinanceWorkspaceBar } from '@/components/Finance/shared/FinanceWorkspaceBar';
import {
  ENABLEMENT_ALWAYS,
  type WorkspaceBarConfig,
  type WorkspaceBarContextField,
  type WorkspaceBarEvaluationContext,
  type WorkspaceBarLifecycleTransition,
  type WorkspaceBarMoreMenuItem,
} from '@/components/Finance/shared/financeWorkspaceBar.contract';
import { useFinanceBaselineWorkspaceFlag } from '@/hooks/useFinanceBaselineWorkspaceFlag';
import { useFinanceFocusMode } from '@/hooks/useFinanceFocusMode';
import {
  approveFinanceModel,
  reopenFinanceModel,
  renameFinanceArtifact,
  transitionFinanceVersion,
  type RoutableTransitionAction,
} from '@/services/api/financeV2.api';
import {
  describeFinanceV2Error,
  type BusinessVersionStatus,
  type FinanceArtifactFreshness,
  type FinanceRole,
} from '@/services/api/financeV2.types';

import { AssumptionsView, type AssumptionRowSpec } from './baseline/AssumptionsView';
import { CalculationsView, type PeriodMeta } from './baseline/CalculationsView';
import { useBaselineAssumptionsEditor } from './baseline/useBaselineAssumptionsEditor';
import { useBaselineCompute } from './baseline/useBaselineCompute';
import { useBaselineOutputs } from './baseline/useBaselineOutputs';

export type BaselineWorkspaceView = 'assumptions' | 'wyliczenia';

export interface BaselineWorkspaceProps {
  artifactId: string;
  businessVersionId: string;
  entityId: string;
  name: string;
  status: BusinessVersionStatus;
  freshness: FinanceArtifactFreshness;
  version: number;
  role: FinanceRole;
  /** Miesięczne okresy prognozy, w kolejności chronologicznej — CALLER je zna (Kreator/artefakt), ten ekran ich nie zgaduje. */
  forecastPeriods: PeriodMeta[];
  openingBalanceSheetPeriodId: string;
  assumptionRowOrder: AssumptionRowSpec[];
  contextValues: Partial<Record<WorkspaceBarContextField, string>>;
  onNavigateBack: () => void;
  readOnly?: boolean;
  /** Testy/harness: nadpisuje widok startowy. */
  initialView?: BaselineWorkspaceView;
}

const VIEW_NAV_STATE_READY = { kind: 'ready' as const, label: { key: 'ready', pl: 'Gotowe' } };
const VIEW_NAV_STATE_STALE = { kind: 'stale' as const, label: { key: 'stale', pl: 'Nieaktualne' } };
const VIEW_NAV_STATE_NOT_CONFIGURED = { kind: 'not-configured' as const, label: { key: 'brak', pl: 'Do uzupełnienia' } };

/**
 * Gate publiczny (CLAUDE.md #7/#9): przy `financeBaselineWorkspaceV1` OFF
 * zwraca `null` PRZED zamontowaniem `BaselineWorkspaceInner` — żaden hook
 * (`useBaselineAssumptionsEditor`/`useBaselineOutputs`/`useBaselineCompute`,
 * wszystkie ładują dane z `/api/v8/finance-v2/baseline/*` na mount) nigdy się
 * nie wykonuje. Flaga jest jedynym hookiem tego komponentu.
 */
export function BaselineWorkspace(props: BaselineWorkspaceProps): React.ReactElement | null {
  const { enabled } = useFinanceBaselineWorkspaceFlag();
  if (!enabled) return null;
  return <BaselineWorkspaceInner {...props} />;
}

function BaselineWorkspaceInner(props: BaselineWorkspaceProps): React.ReactElement {
  const { artifactId, businessVersionId, entityId, forecastPeriods, openingBalanceSheetPeriodId, assumptionRowOrder, readOnly = false } = props;

  const [activeView, setActiveView] = useState<BaselineWorkspaceView>(props.initialView ?? 'assumptions');
  const [name, setName] = useState(props.name);
  const [status, setStatus] = useState<BusinessVersionStatus>(props.status);
  const [version, setVersion] = useState(props.version);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [pendingReasonFor, setPendingReasonFor] = useState<{ kind: 'transition'; action: RoutableTransitionAction; destructive: boolean } | { kind: 'reopen' } | null>(null);
  const [reasonDraft, setReasonDraft] = useState('');

  const periodLabelById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of forecastPeriods) m[p.periodId] = p.label;
    return m;
  }, [forecastPeriods]);

  const editor = useBaselineAssumptionsEditor(businessVersionId, { entityId });
  const outputsHook = useBaselineOutputs(businessVersionId, { entityId });
  const compute = useBaselineCompute(businessVersionId);

  // Edycja założeń → Wyliczenia stają się `stale` (DoD: „wynik oznaczony stale po edycji założeń").
  useEffect(() => {
    if (editor.dirtyCount > 0) compute.markStale('ASSUMPTIONS_EDITED');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.dirtyCount]);

  const focusMode = useFinanceFocusMode<{ activeView: BaselineWorkspaceView }>({
    workspaceState: { activeView },
    activeViewId: activeView,
  });

  async function runCompute(): Promise<void> {
    const result = await compute.run({
      entityId,
      forecastPeriodIds: forecastPeriods.map((p) => p.periodId),
      openingBalanceSheetPeriodId,
    });
    if (result.ok) await outputsHook.reload();
  }

  const assumptionsViewState = editor.loading
    ? VIEW_NAV_STATE_NOT_CONFIGURED
    : editor.dirtyCount > 0
      ? VIEW_NAV_STATE_STALE
      : editor.rows.length === 0
        ? VIEW_NAV_STATE_NOT_CONFIGURED
        : VIEW_NAV_STATE_READY;

  const wyliczeniaViewState = compute.stale.stale
    ? VIEW_NAV_STATE_STALE
    : outputsHook.outputs.length === 0
      ? VIEW_NAV_STATE_NOT_CONFIGURED
      : VIEW_NAV_STATE_READY;

  // ── V-3: DOKŁADNIE DWA widoki. ──────────────────────────────────────────
  const config: WorkspaceBarConfig = {
    moduleId: 'baselineModel',
    artifactType: 'BASELINE_MODEL',
    identity: {
      artifactRef: { artifactType: 'BASELINE_MODEL', businessVersionId, artifactId },
      back: { targetListRoute: '/finance', label: { key: 'back', pl: 'Wróć do listy' } },
      name: {
        value: name,
        editable: !readOnly && ['DRAFT', 'READY_FOR_REVIEW', 'IN_REVIEW', 'NEEDS_CHANGES'].includes(status),
        editableBlockedReason: status === 'APPROVED' ? 'STATUS_IMMUTABLE' : null,
        maxChars: 120,
        layoutBudgetChars: 60,
      },
      version: { label: `v${version}`, businessVersionId, hasUncommittedWorkingRevision: editor.dirtyCount > 0 },
      status,
      freshness: props.freshness,
      contextFields: (Object.keys(props.contextValues) as WorkspaceBarContextField[]),
    },
    viewNavigation: {
      kind: 'tabs',
      views: [
        { id: 'assumptions', label: { key: 'assumptions', pl: 'Założenia' }, state: assumptionsViewState },
        { id: 'wyliczenia', label: { key: 'wyliczenia', pl: 'Wyliczenia' }, state: wyliczeniaViewState },
      ],
      activeViewId: activeView,
      placement: 'in-bar',
    },
    actions: {
      primary: {
        kind: 'primary',
        id: 'primary.compute',
        label: { key: 'compute', pl: 'Przelicz' },
        enablement: ENABLEMENT_ALWAYS,
        mergesFreshness: true,
        keyboardCommandId: null,
      },
      secondary: null,
      lifecycle: {
        kind: 'lifecycle',
        id: 'lifecycle.status',
        label: { key: 'status', pl: lifecycleShortLabel(status) },
        enablement: ENABLEMENT_ALWAYS,
        transitions: lifecycleTransitionsFor(status),
      },
      more: null,
      fullscreen: {
        kind: 'fullscreen',
        id: 'fullscreen.toggle',
        label: { key: 'fullscreen', pl: 'Pełny ekran' },
        enablement: ENABLEMENT_ALWAYS,
        iconOnly: true,
        ariaLabel: { key: 'fullscreen.aria', pl: 'Tryb pełnego obszaru roboczego' },
      },
      extraDirectControls: [],
    },
  };

  const evaluationContext: WorkspaceBarEvaluationContext = {
    status,
    role: props.role,
    freshness: props.freshness,
    gates: {},
  };

  /**
   * `FinanceWorkspaceBar` (Pakiet C) już obsłużyła `requiresConfirmation`
   * (klik → `ConfirmDestructiveDialog` → dopiero PO potwierdzeniu woła
   * `onLifecycleTransition`) — więc w tym momencie potwierdzenie (jeśli było
   * wymagane) już się zdarzyło. Czego pasek NIE zbiera to WOLNY TEKST powodu
   * (`requiresReason`) — kontrakt niesie to pole, ale komponent baru nie ma
   * pola tekstowego (sprawdzone czytaniem `FinanceWorkspaceBar.tsx` w
   * całości). Ten ekran dokłada WŁASNY, mały dialog powodu dla tych dwóch
   * przypadków (`request_changes`/`invalidate`/`reopen`), zamiast wysyłać
   * `reason: ''`.
   */
  async function performTransition(action: RoutableTransitionAction, reason: string | undefined): Promise<void> {
    setLifecycleError(null);
    try {
      const result = await transitionFinanceVersion({ businessVersionId, action, expectedVersion: version, reason });
      setStatus(result.status);
      setVersion(result.version);
    } catch (e) {
      setLifecycleError(describeFinanceV2Error(e).detail);
    }
  }

  async function handleLifecycleTransition(transition: WorkspaceBarLifecycleTransition): Promise<void> {
    if (transition.action === 'approve') {
      setLifecycleError(null);
      try {
        await approveFinanceModel({ modelArtifactId: artifactId, expectedVersion: version });
        setStatus('APPROVED');
      } catch (e) {
        setLifecycleError(describeFinanceV2Error(e).detail);
      }
      return;
    }
    if (transition.action === 'reopen') {
      setPendingReasonFor({ kind: 'reopen' });
      return;
    }
    if (transition.action === 'save_draft' || transition.action === 'new_version') {
      // Brak realnego endpointu dla tych dwóch (WorkspaceBarLifecycleActionId
      // niesie je jako możliwość kontraktu, ale finance-v2 dziś nie ma
      // osobnego "save draft"/"new version" endpointu poza reopen) — świadomie
      // NIE oferujemy ich w `lifecycleTransitionsFor`, więc ta gałąź jest
      // martwa w praktyce; zostawiona jako fail-closed, nie cichy no-op.
      setLifecycleError('Ta operacja nie ma dziś odpowiednika w API — zgłoszone jako niepokryte.');
      return;
    }
    const action = transition.action as RoutableTransitionAction;
    if (transition.requiresReason) {
      setPendingReasonFor({ kind: 'transition', action, destructive: transition.destructive });
      return;
    }
    await performTransition(action, undefined);
  }

  async function submitReason(): Promise<void> {
    if (!pendingReasonFor) return;
    const reason = reasonDraft.trim();
    if (reason.length === 0) return;
    setLifecycleError(null);
    try {
      if (pendingReasonFor.kind === 'reopen') {
        const result = await reopenFinanceModel({ modelArtifactId: artifactId, reason, idempotencyKey: `reopen:${artifactId}:${businessVersionId}:${Date.now()}` });
        setStatus(result.status);
        setVersion(result.versionNo);
      } else {
        const result = await transitionFinanceVersion({ businessVersionId, action: pendingReasonFor.action, expectedVersion: version, reason });
        setStatus(result.status);
        setVersion(result.version);
      }
    } catch (e) {
      setLifecycleError(describeFinanceV2Error(e).detail);
    } finally {
      setPendingReasonFor(null);
      setReasonDraft('');
    }
  }

  async function handleCommitRename(nextName: string): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      await renameFinanceArtifact(artifactId, nextName);
      setName(nextName);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: describeFinanceV2Error(e).detail };
    }
  }

  return (
    <div className="flex h-full min-h-screen w-full flex-col bg-c-bg" data-testid="baseline-workspace" data-active-view={activeView}>
      <FinanceWorkspaceBar
        config={config}
        evaluationContext={evaluationContext}
        contextValues={props.contextValues}
        onNavigateBack={props.onNavigateBack}
        onSelectView={(viewId) => setActiveView(viewId as BaselineWorkspaceView)}
        onPrimaryAction={() => void runCompute()}
        onLifecycleTransition={(t) => void handleLifecycleTransition(t)}
        onMoreItem={(_item: WorkspaceBarMoreMenuItem) => {}}
        onEnterFocusMode={() => focusMode.enter('finance-workspace-bar-fullscreen')}
        onCommitRename={handleCommitRename}
      />

      {lifecycleError && (
        <p role="alert" className="border-b border-c-border-subtle bg-c-danger/5 px-4 py-1.5 text-xs text-c-danger" data-testid="baseline-lifecycle-error">
          {lifecycleError}
        </p>
      )}

      {/* ── V-5: pełna wysokość/szerokość, zero martwego pasa pod paskiem. ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <FinanceErrorBoundary
          key={activeView}
          documentLabel={activeView === 'assumptions' ? `Założenia — ${name}` : `Wyliczenia — ${name}`}
          onRetry={() => (activeView === 'assumptions' ? void editor.reload() : void outputsHook.reload())}
          onBackToList={props.onNavigateBack}
        >
          {activeView === 'assumptions' ? (
            <AssumptionsView editor={editor} rowOrder={assumptionRowOrder} periodLabelById={periodLabelById} readOnly={readOnly} />
          ) : (
            <CalculationsView
              outputs={outputsHook.outputs}
              loadingOutputs={outputsHook.loading}
              outputsError={outputsHook.error}
              forecastPeriods={forecastPeriods}
              computeState={compute.state}
              computeErrorDetail={compute.errorDetail}
              lastComputedAt={compute.lastComputedAt}
              wasRecovered={compute.wasRecovered}
              stale={compute.stale}
              monthlyResults={compute.result?.monthlyResults ?? null}
              onRunCompute={() => void runCompute()}
              readOnly={readOnly}
            />
          )}
        </FinanceErrorBoundary>
      </div>

      {pendingReasonFor && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={() => setPendingReasonFor(null)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Podaj powód"
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-c-border-subtle bg-c-surface p-4 shadow-xl"
            data-testid="baseline-reason-dialog"
          >
            <p className="text-sm font-semibold text-c-text">Podaj powód</p>
            <textarea
              autoFocus
              value={reasonDraft}
              onChange={(e) => setReasonDraft(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-c-border-subtle bg-c-bg px-2 py-1.5 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              data-testid="baseline-reason-input"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingReasonFor(null);
                  setReasonDraft('');
                }}
                className="inline-flex min-h-[2.75rem] items-center rounded-lg border border-c-border-subtle px-3.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                Anuluj
              </button>
              <button
                type="button"
                disabled={reasonDraft.trim().length === 0}
                onClick={() => void submitReason()}
                data-testid="baseline-reason-submit"
                className="inline-flex min-h-[2.75rem] items-center rounded-lg bg-c-danger px-3.5 text-xs font-semibold text-white hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-40"
              >
                Potwierdź
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function lifecycleShortLabel(status: BusinessVersionStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Wersja robocza';
    case 'READY_FOR_REVIEW':
      return 'Gotowe do przeglądu';
    case 'IN_REVIEW':
      return 'W przeglądzie';
    case 'APPROVED':
      return 'Zatwierdzone';
    case 'NEEDS_CHANGES':
      return 'Wymaga zmian';
    case 'SUPERSEDED':
      return 'Zastąpione';
    case 'ARCHIVED':
      return 'Zarchiwizowane';
    case 'INVALIDATED':
      return 'Unieważnione';
    default:
      return status;
  }
}

/** Tylko przejścia z realnym odpowiednikiem w API (transitionFinanceVersion/approveFinanceModel/reopenFinanceModel) — bez fabrykowanych akcji. */
function lifecycleTransitionsFor(status: BusinessVersionStatus): WorkspaceBarLifecycleTransition[] {
  const t = (action: WorkspaceBarLifecycleTransition['action'], pl: string, opts: Partial<WorkspaceBarLifecycleTransition> = {}): WorkspaceBarLifecycleTransition => ({
    action,
    label: { key: action, pl },
    enablement: ENABLEMENT_ALWAYS,
    destructive: false,
    requiresConfirmation: false,
    requiresReason: false,
    ...opts,
  });

  switch (status) {
    case 'DRAFT':
      return [t('submit_for_review', 'Przekaż do przeglądu'), t('invalidate', 'Unieważnij', { destructive: true, requiresConfirmation: true, requiresReason: true })];
    case 'READY_FOR_REVIEW':
      return [t('start_review', 'Rozpocznij przegląd'), t('withdraw', 'Wycofaj z przeglądu')];
    case 'IN_REVIEW':
      return [
        t('approve', 'Zatwierdź', { requiresConfirmation: true }),
        t('request_changes', 'Poproś o zmiany', { requiresReason: true }),
      ];
    case 'NEEDS_CHANGES':
      return [t('resume_editing', 'Wróć do edycji')];
    case 'APPROVED':
      return [t('reopen', 'Otwórz ponownie', { destructive: true, requiresConfirmation: true, requiresReason: true })];
    default:
      return [];
  }
}

export default BaselineWorkspace;
