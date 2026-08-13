/**
 * AP-10 — the five Finance module adapters, as DATA.
 *
 * One shared Workspace Bar (AP-09) can only exist if every module declares the
 * same shape. This file is that declaration for Statements, Analysis, Baseline
 * Models, Prediction and Enterprise Valuation: views, primary/secondary
 * actions, lifecycle menu, More menu, fullscreen and Context popover fields.
 * It is configuration, not behaviour — no React, no DOM, no I/O.
 *
 * Owner-mandated counts this file is the regression surface for:
 *   - OWN-FIN-017: Baseline Models has **exactly two** views — `Założenia`
 *     and `Wyliczenia`.
 *   - OWN-FIN-019: Prediction has **exactly two** views — `Budowa założeń`
 *     and `Modele/Wyniki`.
 *   - OWN-FIN-021: Enterprise Valuation runs a **seven-step** flow
 *     `Source → Assumptions → Methods & weights → Results → Sensitivity →
 *     Valuation Advisor → Export` (handoff section 9 "Flow UX", verbatim
 *     order).
 *   - Handoff section 5: Statements shows P&L / BS / CF as its main views.
 *
 * Analysis is the one module with no owner-stated view count; its two views
 * are marked `INFERRED` in `viewsMandate` so nobody later mistakes them for a
 * mandate. See `WORKSPACE_VIEW_MANDATES` and the report's escalation section.
 */

import type { FinanceArtifactType } from '../../../types/finance/ArtifactRef.js';
import type { BusinessVersionStatus, FinanceRole } from '../canonical/lifecycleService.js';
import {
  ENABLEMENT_ALWAYS,
  WORKSPACE_BAR_NAME_LAYOUT_BUDGET_CHARS,
  WORKSPACE_BAR_NAME_MAX_CHARS,
  canRenameArtifact,
  resolveControlState,
  resolveViewNavigationPlacement,
  type FinanceWorkspaceModuleId,
  type WorkspaceBarConfig,
  type WorkspaceBarContextField,
  type WorkspaceBarEnablement,
  type WorkspaceBarEvaluationContext,
  type WorkspaceBarFullscreenControl,
  type WorkspaceBarIdentity,
  type WorkspaceBarLabel,
  type WorkspaceBarLifecycleControl,
  type WorkspaceBarLifecycleTransition,
  type WorkspaceBarMoreMenu,
  type WorkspaceBarMoreMenuItem,
  type WorkspaceBarPrimaryAction,
  type WorkspaceBarSecondaryAction,
  type WorkspaceBarView,
  type WorkspaceBarViewNavigation,
  type WorkspaceBarViewNavigationKind,
} from './workspaceBarContract.js';

// ---------------------------------------------------------------------------
// Adapter shape.
// ---------------------------------------------------------------------------

/** Where a module's view list comes from — so an owner mandate is never confused with a design guess. */
export type ViewsMandateSource = 'OWNER_MANDATED' | 'PROGRAM_DOC' | 'INFERRED';

export interface ViewsMandate {
  source: ViewsMandateSource;
  /** `null` only if no document states a count. All five modules currently state one. */
  exactCount: number | null;
  reference: string;
}

export interface FinanceModuleAdapter {
  moduleId: FinanceWorkspaceModuleId;
  artifactType: FinanceArtifactType;
  moduleLabel: WorkspaceBarLabel;
  listRoute: string;
  views: readonly WorkspaceBarView[];
  viewNavigationKind: WorkspaceBarViewNavigationKind;
  viewsMandate: ViewsMandate;
  /**
   * Ordered candidates for the ONE primary slot; the first whose enablement is
   * satisfied wins. This is how OWN-FIN-012's rule is expressed structurally
   * ("dla pustej analizy główne CTA prowadzi do uzupełnienia konfiguracji KPI,
   * a nie do pozornego zatwierdzenia") without giving the bar two primaries.
   * The LAST candidate must be unconditional — `validateModuleAdapter`
   * enforces it, so resolution can never end up with no primary at all.
   */
  primaryCandidates: readonly WorkspaceBarPrimaryAction[];
  secondary: WorkspaceBarSecondaryAction | null;
  lifecycle: WorkspaceBarLifecycleControl;
  more: WorkspaceBarMoreMenu;
  fullscreen: WorkspaceBarFullscreenControl;
  contextFields: readonly WorkspaceBarContextField[];
  /** OWN-FIN-007 / OWN-FIN-022: the artifact types the Related panel offers `+ New` for, with this artifact preselected as source. */
  relatedDownstreamTypes: readonly FinanceArtifactType[];
}

// ---------------------------------------------------------------------------
// Shared pieces — declared once so the five bars are genuinely the same bar.
// ---------------------------------------------------------------------------

const PREPARER_PLUS: readonly FinanceRole[] = ['preparer', 'reviewer', 'approver', 'finance_admin'];
const REVIEWER_PLUS: readonly FinanceRole[] = ['reviewer', 'approver', 'finance_admin'];
const APPROVER_PLUS: readonly FinanceRole[] = ['approver', 'finance_admin'];

const EDITABLE_STATUSES: readonly BusinessVersionStatus[] = ['DRAFT', 'NEEDS_CHANGES'];

function enablement(partial: Partial<WorkspaceBarEnablement>): WorkspaceBarEnablement {
  return {
    statuses: partial.statuses ?? 'any',
    roles: partial.roles ?? 'any',
    freshness: partial.freshness ?? 'any',
    requiresGates: partial.requiresGates ?? [],
  };
}

/**
 * OWN-FIN-012 + OWN-FIN-013 + DEC-FIN-007: the whole lifecycle lives behind
 * ONE status control. Its transitions are menu entries, so they cost nothing
 * against the five-direct-control budget — which is exactly why the register's
 * long wish list of lifecycle actions does not blow the bar up.
 *
 * `approve` deliberately requires freshness `CURRENT` (mirrors
 * `canonicalServices.pg.test.ts`: "approve requires CURRENT") plus a
 * module-supplied completeness gate, so a stale or empty artifact can never
 * offer the sham Approve OWN-FIN-012 objected to.
 */
function standardLifecycleControl(
  moduleId: FinanceWorkspaceModuleId,
  approvalGates: readonly string[]
): WorkspaceBarLifecycleControl {
  const transitions: WorkspaceBarLifecycleTransition[] = [
    {
      action: 'save_draft',
      label: { key: 'finance.lifecycle.saveDraft', pl: 'Zapisz wersję roboczą' },
      enablement: enablement({ statuses: EDITABLE_STATUSES, roles: PREPARER_PLUS }),
      destructive: false,
      requiresConfirmation: false,
      requiresReason: false,
    },
    {
      action: 'submit_for_review',
      label: { key: 'finance.lifecycle.submitForReview', pl: 'Przekaż do przeglądu' },
      enablement: enablement({
        statuses: EDITABLE_STATUSES,
        roles: PREPARER_PLUS,
        requiresGates: approvalGates,
      }),
      destructive: false,
      requiresConfirmation: false,
      requiresReason: false,
    },
    {
      action: 'start_review',
      label: { key: 'finance.lifecycle.startReview', pl: 'Rozpocznij przegląd' },
      enablement: enablement({ statuses: ['READY_FOR_REVIEW'], roles: REVIEWER_PLUS }),
      destructive: false,
      requiresConfirmation: false,
      requiresReason: false,
    },
    {
      action: 'request_changes',
      label: { key: 'finance.lifecycle.requestChanges', pl: 'Zgłoś uwagi' },
      enablement: enablement({ statuses: ['IN_REVIEW'], roles: REVIEWER_PLUS }),
      destructive: false,
      requiresConfirmation: false,
      requiresReason: true,
    },
    {
      action: 'withdraw',
      label: { key: 'finance.lifecycle.withdraw', pl: 'Wycofaj z przeglądu' },
      enablement: enablement({ statuses: ['READY_FOR_REVIEW', 'IN_REVIEW'], roles: PREPARER_PLUS }),
      destructive: false,
      requiresConfirmation: true,
      requiresReason: false,
    },
    {
      action: 'resume_editing',
      label: { key: 'finance.lifecycle.resumeEditing', pl: 'Wróć do edycji' },
      enablement: enablement({ statuses: ['NEEDS_CHANGES'], roles: PREPARER_PLUS }),
      destructive: false,
      requiresConfirmation: false,
      requiresReason: false,
    },
    {
      action: 'approve',
      label: { key: 'finance.lifecycle.approve', pl: 'Zatwierdź' },
      enablement: enablement({
        statuses: ['IN_REVIEW'],
        roles: APPROVER_PLUS,
        freshness: ['CURRENT'],
        requiresGates: approvalGates,
      }),
      destructive: false,
      requiresConfirmation: true,
      requiresReason: false,
    },
    {
      action: 'reopen',
      label: { key: 'finance.lifecycle.reopen', pl: 'Otwórz ponownie' },
      enablement: enablement({ statuses: ['APPROVED'], roles: APPROVER_PLUS }),
      destructive: false,
      requiresConfirmation: true,
      requiresReason: true,
    },
    {
      action: 'new_version',
      label: { key: 'finance.lifecycle.newVersion', pl: 'Utwórz nową wersję' },
      enablement: enablement({ statuses: ['APPROVED', 'SUPERSEDED'], roles: PREPARER_PLUS }),
      destructive: false,
      requiresConfirmation: false,
      requiresReason: true,
    },
    {
      action: 'archive',
      label: { key: 'finance.lifecycle.archive', pl: 'Archiwizuj' },
      enablement: enablement({ roles: APPROVER_PLUS }),
      destructive: true,
      requiresConfirmation: true,
      requiresReason: false,
    },
    {
      action: 'invalidate',
      label: { key: 'finance.lifecycle.invalidate', pl: 'Unieważnij' },
      enablement: enablement({ statuses: ['APPROVED', 'SUPERSEDED'], roles: APPROVER_PLUS }),
      destructive: true,
      requiresConfirmation: true,
      requiresReason: true,
    },
  ];

  return {
    kind: 'lifecycle',
    id: `finance.${moduleId}.lifecycle`,
    // The rendered label is the CURRENT status; this is the accessible/menu name.
    label: { key: 'finance.lifecycle.control', pl: 'Status' },
    enablement: ENABLEMENT_ALWAYS,
    transitions,
  };
}

/** Items every module keeps out of the bar. OWN-FIN-016: "menu dodatkowe: duplikuj, eksportuj, archiwizuj/usuń" — archive/invalidate live in the lifecycle control, everything else here. */
function standardMoreItems(moduleId: FinanceWorkspaceModuleId): WorkspaceBarMoreMenuItem[] {
  return [
    {
      id: `finance.${moduleId}.duplicate`,
      label: { key: 'finance.more.duplicate', pl: 'Duplikuj' },
      group: 'document',
      enablement: enablement({ roles: PREPARER_PLUS }),
      destructive: false,
      requiresConfirmation: false,
    },
    {
      id: `finance.${moduleId}.export`,
      label: { key: 'finance.more.export', pl: 'Eksportuj' },
      group: 'report',
      enablement: ENABLEMENT_ALWAYS,
      destructive: false,
      requiresConfirmation: false,
    },
    {
      id: `finance.${moduleId}.compareVersions`,
      label: { key: 'finance.more.compareVersions', pl: 'Porównaj wersje' },
      group: 'data',
      enablement: ENABLEMENT_ALWAYS,
      destructive: false,
      requiresConfirmation: false,
    },
    {
      id: `finance.${moduleId}.history`,
      label: { key: 'finance.more.history', pl: 'Historia zmian' },
      group: 'document',
      enablement: ENABLEMENT_ALWAYS,
      destructive: false,
      requiresConfirmation: false,
    },
    {
      id: `finance.${moduleId}.backToList`,
      label: { key: 'finance.more.backToList', pl: 'Wróć do listy' },
      group: 'navigation',
      enablement: ENABLEMENT_ALWAYS,
      destructive: false,
      requiresConfirmation: false,
    },
  ];
}

function standardFullscreenControl(moduleId: FinanceWorkspaceModuleId): WorkspaceBarFullscreenControl {
  return {
    kind: 'fullscreen',
    id: `finance.${moduleId}.fullscreen`,
    label: { key: 'finance.focusMode.toggle', pl: 'Pełny obszar roboczy' },
    ariaLabel: {
      key: 'finance.focusMode.toggleAria',
      pl: 'Włącz tryb pełnego obszaru roboczego (Esc wyłącza)',
    },
    iconOnly: true,
    enablement: ENABLEMENT_ALWAYS,
  };
}

/**
 * OWN-FIN-022 puts the Related/lineage entry point "z poziomu paska/panelu
 * `Powiązane`". Making it the ONE secondary action in every module is what
 * keeps all five bars at exactly five direct controls
 * (primary + Powiązane + status + More + fullscreen) while still giving the
 * Lineage Navigator a permanent, predictable home.
 */
function relatedSecondaryAction(moduleId: FinanceWorkspaceModuleId): WorkspaceBarSecondaryAction {
  return {
    kind: 'secondary',
    id: `finance.${moduleId}.related`,
    label: { key: 'finance.related.open', pl: 'Powiązane' },
    enablement: ENABLEMENT_ALWAYS,
    keyboardCommandId: null,
  };
}

function view(id: string, key: string, pl: string): WorkspaceBarView {
  return { id, label: { key, pl }, state: null };
}

// ---------------------------------------------------------------------------
// The five adapters.
// ---------------------------------------------------------------------------

export const statementsAdapter: FinanceModuleAdapter = {
  moduleId: 'statements',
  artifactType: 'STATEMENT_PACK',
  moduleLabel: { key: 'finance.module.statements', pl: 'Sprawozdania' },
  listRoute: '/finance/statements',
  // Handoff section 5 "Grafika i UX": "P&L/BS/CF jako główne widoki".
  views: [
    view('pnl', 'finance.statements.view.pnl', 'P&L'),
    view('bs', 'finance.statements.view.bs', 'Bilans'),
    view('cf', 'finance.statements.view.cf', 'Cash flow'),
  ],
  viewNavigationKind: 'tabs',
  viewsMandate: {
    source: 'PROGRAM_DOC',
    exactCount: 3,
    reference: 'FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md section 5 (Statements — Grafika i UX)',
  },
  primaryCandidates: [
    {
      kind: 'primary',
      id: 'finance.statements.reconcile',
      label: { key: 'finance.statements.reconcile', pl: 'Uzgodnij' },
      enablement: enablement({ roles: PREPARER_PLUS, requiresGates: ['statements.mappingComplete'] }),
      mergesFreshness: true,
      keyboardCommandId: 'finance.compute',
    },
    {
      // Fallback when mapping is not finished: the honest next step, not Approve.
      kind: 'primary',
      id: 'finance.statements.openMapping',
      label: { key: 'finance.statements.openMapping', pl: 'Zmapuj źródła' },
      enablement: ENABLEMENT_ALWAYS,
      mergesFreshness: false,
      keyboardCommandId: null,
    },
  ],
  secondary: relatedSecondaryAction('statements'),
  lifecycle: standardLifecycleControl('statements', ['statements.mappingComplete', 'statements.checksPassed']),
  more: {
    kind: 'more',
    id: 'finance.statements.more',
    label: { key: 'finance.more.label', pl: 'Więcej' },
    enablement: ENABLEMENT_ALWAYS,
    items: [
      // OWN-FIN-003 + handoff section 5: the unintelligible "Report section"
      // button is split into three named results.
      {
        id: 'finance.statements.reportSection.generateDraft',
        label: { key: 'finance.statements.reportSection.generateDraft', pl: 'Generuj szkic sekcji raportu' },
        group: 'report',
        enablement: enablement({ roles: PREPARER_PLUS }),
        destructive: false,
        requiresConfirmation: false,
      },
      {
        id: 'finance.statements.reportSection.open',
        label: { key: 'finance.statements.reportSection.open', pl: 'Otwórz sekcję raportu' },
        group: 'report',
        enablement: ENABLEMENT_ALWAYS,
        destructive: false,
        requiresConfirmation: false,
      },
      {
        id: 'finance.statements.reportSection.publish',
        label: { key: 'finance.statements.reportSection.publish', pl: 'Opublikuj / dodaj do raportu' },
        group: 'report',
        enablement: enablement({ roles: REVIEWER_PLUS }),
        destructive: false,
        requiresConfirmation: true,
      },
      {
        id: 'finance.statements.sourceFiles',
        label: { key: 'finance.statements.sourceFiles', pl: 'Pliki źródłowe' },
        group: 'data',
        enablement: ENABLEMENT_ALWAYS,
        destructive: false,
        requiresConfirmation: false,
      },
      ...standardMoreItems('statements'),
    ],
  },
  fullscreen: standardFullscreenControl('statements'),
  contextFields: ['type', 'period', 'entity', 'currencyScale', 'source', 'lastCompute'],
  relatedDownstreamTypes: ['HISTORICAL_ANALYSIS', 'BASELINE_MODEL', 'REPORT_EXPORT'],
};

export const analysisAdapter: FinanceModuleAdapter = {
  moduleId: 'analysis',
  artifactType: 'HISTORICAL_ANALYSIS',
  moduleLabel: { key: 'finance.module.analysis', pl: 'Analiza' },
  listRoute: '/finance/analysis',
  views: [
    view('kpis', 'finance.analysis.view.kpis', 'Wskaźniki'),
    view('comparison', 'finance.analysis.view.comparison', 'Porównanie'),
  ],
  viewNavigationKind: 'tabs',
  viewsMandate: {
    source: 'INFERRED',
    exactCount: 2,
    reference:
      'No owner-stated count. Derived from handoff section 6 "Grafika i UX" (KPI grid as the main canvas; "review startuje w changed-only compare"). Flagged for owner confirmation.',
  },
  primaryCandidates: [
    {
      kind: 'primary',
      id: 'finance.analysis.compute',
      label: { key: 'finance.analysis.compute', pl: 'Przelicz' },
      enablement: enablement({ roles: PREPARER_PLUS, requiresGates: ['analysis.hasConfiguredKpis'] }),
      mergesFreshness: true,
      keyboardCommandId: 'finance.compute',
    },
    {
      // Handoff section 6: "pusty Draft ma CTA `Configure KPIs`, nie Approve".
      kind: 'primary',
      id: 'finance.analysis.configureKpis',
      label: { key: 'finance.analysis.configureKpis', pl: 'Skonfiguruj wskaźniki' },
      enablement: ENABLEMENT_ALWAYS,
      mergesFreshness: false,
      keyboardCommandId: null,
    },
  ],
  secondary: relatedSecondaryAction('analysis'),
  lifecycle: standardLifecycleControl('analysis', ['analysis.hasConfiguredKpis', 'analysis.computed']),
  more: {
    kind: 'more',
    id: 'finance.analysis.more',
    label: { key: 'finance.more.label', pl: 'Więcej' },
    enablement: ENABLEMENT_ALWAYS,
    items: [
      {
        id: 'finance.analysis.editKpiSet',
        label: { key: 'finance.analysis.editKpiSet', pl: 'Edytuj zestaw wskaźników' },
        group: 'data',
        enablement: enablement({ statuses: EDITABLE_STATUSES, roles: PREPARER_PLUS }),
        destructive: false,
        requiresConfirmation: false,
      },
      {
        id: 'finance.analysis.columnsManager',
        label: { key: 'finance.analysis.columnsManager', pl: 'Kolumny i widoki' },
        group: 'data',
        enablement: ENABLEMENT_ALWAYS,
        destructive: false,
        requiresConfirmation: false,
      },
      ...standardMoreItems('analysis'),
    ],
  },
  fullscreen: standardFullscreenControl('analysis'),
  contextFields: ['type', 'period', 'entity', 'currencyScale', 'source', 'lastCompute'],
  relatedDownstreamTypes: ['BASELINE_MODEL', 'REPORT_EXPORT'],
};

export const baselineModelAdapter: FinanceModuleAdapter = {
  moduleId: 'baselineModel',
  artifactType: 'BASELINE_MODEL',
  moduleLabel: { key: 'finance.module.baselineModel', pl: 'Model bazowy' },
  listRoute: '/finance/models',
  // OWN-FIN-017, verbatim: "ma dokładnie dwa główne widoki wybierane z
  // `Finance Workspace Bar`: (1) `Założenia` ... (2) `Wyliczenia`".
  views: [
    view('assumptions', 'finance.baselineModel.view.assumptions', 'Założenia'),
    view('calculations', 'finance.baselineModel.view.calculations', 'Wyliczenia'),
  ],
  viewNavigationKind: 'tabs',
  viewsMandate: {
    source: 'OWNER_MANDATED',
    exactCount: 2,
    reference: 'OWNER_REVIEW_REGISTER_2026-08-09.md OWN-FIN-017 ("dokładnie dwa główne widoki")',
  },
  primaryCandidates: [
    {
      kind: 'primary',
      id: 'finance.baselineModel.compute',
      label: { key: 'finance.baselineModel.compute', pl: 'Przelicz' },
      enablement: enablement({
        roles: PREPARER_PLUS,
        requiresGates: ['baselineModel.assumptionsConfirmed'],
      }),
      mergesFreshness: true,
      keyboardCommandId: 'finance.compute',
    },
    {
      kind: 'primary',
      id: 'finance.baselineModel.confirmAssumptions',
      label: { key: 'finance.baselineModel.confirmAssumptions', pl: 'Potwierdź założenia' },
      enablement: ENABLEMENT_ALWAYS,
      mergesFreshness: false,
      keyboardCommandId: null,
    },
  ],
  secondary: relatedSecondaryAction('baselineModel'),
  lifecycle: standardLifecycleControl('baselineModel', [
    'baselineModel.assumptionsConfirmed',
    'baselineModel.tieOutsPassed',
  ]),
  more: {
    kind: 'more',
    id: 'finance.baselineModel.more',
    label: { key: 'finance.more.label', pl: 'Więcej' },
    enablement: ENABLEMENT_ALWAYS,
    items: [
      {
        id: 'finance.baselineModel.validate',
        label: { key: 'finance.baselineModel.validate', pl: 'Waliduj model' },
        group: 'data',
        enablement: enablement({ roles: PREPARER_PLUS }),
        destructive: false,
        requiresConfirmation: false,
      },
      {
        id: 'finance.baselineModel.resetToBaseline',
        label: { key: 'finance.baselineModel.resetToBaseline', pl: 'Przywróć wartości bazowe' },
        group: 'data',
        enablement: enablement({ statuses: EDITABLE_STATUSES, roles: PREPARER_PLUS }),
        destructive: true,
        requiresConfirmation: true,
      },
      ...standardMoreItems('baselineModel'),
    ],
  },
  fullscreen: standardFullscreenControl('baselineModel'),
  contextFields: ['type', 'period', 'entity', 'currencyScale', 'source', 'lastCompute'],
  // OWN-FIN-018: "Usunąć akcję wyceny z głównego toku Models" — valuation is
  // reachable only as a downstream relation from the Related panel, never as a
  // bar action. Hence VALUATION_CASE appears here and nowhere in `more`.
  relatedDownstreamTypes: ['PREDICTION_SCENARIO', 'VALUATION_CASE', 'REPORT_EXPORT'],
};

export const predictionAdapter: FinanceModuleAdapter = {
  moduleId: 'prediction',
  artifactType: 'PREDICTION_SCENARIO',
  moduleLabel: { key: 'finance.module.prediction', pl: 'Predykcja' },
  listRoute: '/finance/prediction',
  // OWN-FIN-019, verbatim: "dwa główne widoki wybierane z `Finance Workspace
  // Bar`: `Budowa założeń` ... oraz `Modele/Wyniki`".
  views: [
    view('buildAssumptions', 'finance.prediction.view.buildAssumptions', 'Budowa założeń'),
    view('modelsResults', 'finance.prediction.view.modelsResults', 'Modele/Wyniki'),
  ],
  viewNavigationKind: 'tabs',
  viewsMandate: {
    source: 'OWNER_MANDATED',
    exactCount: 2,
    reference: 'OWNER_REVIEW_REGISTER_2026-08-09.md OWN-FIN-019 ("dwa główne widoki")',
  },
  primaryCandidates: [
    {
      // DEC-FIN-004: compute is two-stage. Once preflight resolutions are
      // closed the primary is the real compute...
      kind: 'primary',
      id: 'finance.prediction.compute',
      label: { key: 'finance.prediction.compute', pl: 'Przelicz' },
      enablement: enablement({ roles: PREPARER_PLUS, requiresGates: ['prediction.preflightResolved'] }),
      mergesFreshness: true,
      keyboardCommandId: 'finance.compute',
    },
    {
      // ...until then it is the preflight itself, so conflicts are never
      // summed silently ("System nie blokuje budowania założeń i nie sumuje
      // konfliktów po cichu").
      kind: 'primary',
      id: 'finance.prediction.preflight',
      label: { key: 'finance.prediction.preflight', pl: 'Sprawdź założenia' },
      enablement: ENABLEMENT_ALWAYS,
      mergesFreshness: false,
      keyboardCommandId: null,
    },
  ],
  secondary: relatedSecondaryAction('prediction'),
  lifecycle: standardLifecycleControl('prediction', [
    'prediction.preflightResolved',
    'prediction.computed',
  ]),
  more: {
    kind: 'more',
    id: 'finance.prediction.more',
    label: { key: 'finance.more.label', pl: 'Więcej' },
    enablement: ENABLEMENT_ALWAYS,
    items: [
      {
        id: 'finance.prediction.compareScenarios',
        label: { key: 'finance.prediction.compareScenarios', pl: 'Porównaj scenariusze' },
        group: 'data',
        enablement: ENABLEMENT_ALWAYS,
        destructive: false,
        requiresConfirmation: false,
      },
      {
        id: 'finance.prediction.conflictLedger',
        label: { key: 'finance.prediction.conflictLedger', pl: 'Rejestr rozstrzygnięć' },
        group: 'data',
        enablement: ENABLEMENT_ALWAYS,
        destructive: false,
        requiresConfirmation: false,
      },
      ...standardMoreItems('prediction'),
    ],
  },
  fullscreen: standardFullscreenControl('prediction'),
  contextFields: ['type', 'period', 'entity', 'currencyScale', 'source', 'lastCompute'],
  relatedDownstreamTypes: ['VALUATION_CASE', 'REPORT_EXPORT'],
};

export const valuationAdapter: FinanceModuleAdapter = {
  moduleId: 'valuation',
  artifactType: 'VALUATION_CASE',
  moduleLabel: { key: 'finance.module.valuation', pl: 'Wycena' },
  listRoute: '/finance/valuation',
  // OWN-FIN-021 / handoff section 9 "Flow UX", verbatim order:
  // Source -> Assumptions -> Methods & weights -> Results -> Sensitivity ->
  // Valuation Advisor -> Export. Seven steps => a stepper on its own compact
  // row (handoff section 11: "Valuation stepper jest osobnym kompaktowym row,
  // nie przeładowuje paska").
  views: [
    view('source', 'finance.valuation.view.source', 'Źródło'),
    view('assumptions', 'finance.valuation.view.assumptions', 'Założenia'),
    view('methodsWeights', 'finance.valuation.view.methodsWeights', 'Metody i wagi'),
    view('results', 'finance.valuation.view.results', 'Wyniki'),
    view('sensitivity', 'finance.valuation.view.sensitivity', 'Wrażliwość'),
    view('advisor', 'finance.valuation.view.advisor', 'Doradca wyceny'),
    view('export', 'finance.valuation.view.export', 'Eksport'),
  ],
  viewNavigationKind: 'stepper',
  viewsMandate: {
    source: 'OWNER_MANDATED',
    exactCount: 7,
    reference:
      'OWNER_REVIEW_REGISTER_2026-08-09.md OWN-FIN-021 + handoff section 9 "Flow UX" (seven named steps, fixed order)',
  },
  primaryCandidates: [
    {
      kind: 'primary',
      id: 'finance.valuation.compute',
      label: { key: 'finance.valuation.compute', pl: 'Przelicz wycenę' },
      enablement: enablement({ roles: PREPARER_PLUS, requiresGates: ['valuation.methodsConfigured'] }),
      mergesFreshness: true,
      keyboardCommandId: 'finance.compute',
    },
    {
      kind: 'primary',
      id: 'finance.valuation.configureMethods',
      label: { key: 'finance.valuation.configureMethods', pl: 'Wybierz metody' },
      enablement: ENABLEMENT_ALWAYS,
      mergesFreshness: false,
      keyboardCommandId: null,
    },
  ],
  secondary: relatedSecondaryAction('valuation'),
  lifecycle: standardLifecycleControl('valuation', [
    'valuation.methodsConfigured',
    'valuation.computed',
  ]),
  more: {
    kind: 'more',
    id: 'finance.valuation.more',
    label: { key: 'finance.more.label', pl: 'Więcej' },
    enablement: ENABLEMENT_ALWAYS,
    items: [
      {
        id: 'finance.valuation.compareVariants',
        label: { key: 'finance.valuation.compareVariants', pl: 'Porównaj warianty' },
        group: 'data',
        enablement: ENABLEMENT_ALWAYS,
        destructive: false,
        requiresConfirmation: false,
      },
      {
        // DEC-FIN-006: the Advisor runs only on a freshly computed candidate
        // version and never approves anything itself.
        id: 'finance.valuation.runAdvisor',
        label: { key: 'finance.valuation.runAdvisor', pl: 'Uruchom Doradcę wyceny' },
        group: 'data',
        enablement: enablement({
          roles: PREPARER_PLUS,
          freshness: ['CURRENT'],
          requiresGates: ['valuation.computed'],
        }),
        destructive: false,
        requiresConfirmation: false,
      },
      ...standardMoreItems('valuation'),
    ],
  },
  fullscreen: standardFullscreenControl('valuation'),
  contextFields: ['type', 'period', 'entity', 'currencyScale', 'source', 'lastCompute'],
  relatedDownstreamTypes: ['REPORT_EXPORT'],
};

export const FINANCE_MODULE_ADAPTERS: Readonly<Record<FinanceWorkspaceModuleId, FinanceModuleAdapter>> = {
  statements: statementsAdapter,
  analysis: analysisAdapter,
  baselineModel: baselineModelAdapter,
  prediction: predictionAdapter,
  valuation: valuationAdapter,
};

export const FINANCE_MODULE_ADAPTER_LIST: readonly FinanceModuleAdapter[] = [
  statementsAdapter,
  analysisAdapter,
  baselineModelAdapter,
  predictionAdapter,
  valuationAdapter,
];

/** Quick lookup used by the Related panel when it must open a downstream artifact's workspace. */
export function adapterForArtifactType(artifactType: FinanceArtifactType): FinanceModuleAdapter | null {
  return FINANCE_MODULE_ADAPTER_LIST.find((adapter) => adapter.artifactType === artifactType) ?? null;
}

// ---------------------------------------------------------------------------
// Adapter -> WorkspaceBarConfig.
// ---------------------------------------------------------------------------

/** First candidate whose enablement is satisfied; the unconditional last candidate is the guaranteed floor. */
export function resolvePrimaryAction(
  adapter: FinanceModuleAdapter,
  ctx: WorkspaceBarEvaluationContext
): WorkspaceBarPrimaryAction {
  for (const candidate of adapter.primaryCandidates) {
    if (resolveControlState(candidate.enablement, ctx).available) return candidate;
  }
  return adapter.primaryCandidates[adapter.primaryCandidates.length - 1];
}

export interface BuildWorkspaceBarInput {
  adapter: FinanceModuleAdapter;
  artifactRef: WorkspaceBarIdentity['artifactRef'];
  name: string;
  versionLabel: string;
  hasUncommittedWorkingRevision: boolean;
  activeViewId: string;
  context: WorkspaceBarEvaluationContext;
}

/**
 * Turn an adapter plus live artifact facts into the one config the shared bar
 * renders. Note what it does NOT do: it never adds a control the adapter did
 * not declare, and it always resolves exactly one primary — so the output is
 * structurally incapable of exceeding the five-control budget unless the
 * adapter itself smuggled `extraDirectControls` in (which the validator then
 * rejects).
 */
export function buildWorkspaceBarConfig(input: BuildWorkspaceBarInput): WorkspaceBarConfig {
  const { adapter, context } = input;
  const rename = canRenameArtifact(context.status, context.role);
  return {
    moduleId: adapter.moduleId,
    artifactType: adapter.artifactType,
    identity: {
      artifactRef: input.artifactRef,
      back: {
        targetListRoute: adapter.listRoute,
        label: { key: 'finance.bar.back', pl: `Wróć: ${adapter.moduleLabel.pl}` },
      },
      name: {
        value: input.name,
        editable: rename.editable,
        editableBlockedReason: rename.editable ? null : rename.reason,
        maxChars: WORKSPACE_BAR_NAME_MAX_CHARS,
        layoutBudgetChars: WORKSPACE_BAR_NAME_LAYOUT_BUDGET_CHARS,
      },
      version: {
        label: input.versionLabel,
        businessVersionId: input.artifactRef.businessVersionId,
        hasUncommittedWorkingRevision: input.hasUncommittedWorkingRevision,
      },
      status: context.status,
      freshness: context.freshness,
      contextFields: adapter.contextFields,
    },
    viewNavigation: buildViewNavigation(adapter, input.activeViewId),
    actions: {
      primary: resolvePrimaryAction(adapter, context),
      secondary: adapter.secondary,
      lifecycle: adapter.lifecycle,
      more: adapter.more,
      fullscreen: adapter.fullscreen,
      extraDirectControls: [],
    },
  };
}

export function buildViewNavigation(
  adapter: FinanceModuleAdapter,
  activeViewId: string
): WorkspaceBarViewNavigation {
  return {
    kind: adapter.viewNavigationKind,
    views: adapter.views,
    activeViewId,
    placement: resolveViewNavigationPlacement(adapter.views.length),
  };
}

// ---------------------------------------------------------------------------
// Adapter-level validation (a layer above `validateWorkspaceBarConfig`).
// ---------------------------------------------------------------------------

export type ModuleAdapterValidationCode =
  | 'NO_PRIMARY_CANDIDATES'
  | 'LAST_PRIMARY_CANDIDATE_NOT_UNCONDITIONAL'
  | 'VIEW_COUNT_VIOLATES_MANDATE'
  | 'DUPLICATE_VIEW_ID'
  | 'STEPPER_WITHOUT_SEPARATE_ROW'
  | 'EMPTY_RELATED_DOWNSTREAM';

export interface ModuleAdapterValidationError {
  code: ModuleAdapterValidationCode;
  moduleId: FinanceWorkspaceModuleId;
  message: string;
}

export type ModuleAdapterValidationResult =
  | { ok: true }
  | { ok: false; errors: ModuleAdapterValidationError[] };

function isUnconditional(e: WorkspaceBarEnablement): boolean {
  return e.statuses === 'any' && e.roles === 'any' && e.freshness === 'any' && e.requiresGates.length === 0;
}

export function validateModuleAdapter(adapter: FinanceModuleAdapter): ModuleAdapterValidationResult {
  const errors: ModuleAdapterValidationError[] = [];
  const push = (code: ModuleAdapterValidationCode, message: string): void => {
    errors.push({ code, moduleId: adapter.moduleId, message });
  };

  if (adapter.primaryCandidates.length === 0) {
    push('NO_PRIMARY_CANDIDATES', 'At least one primary candidate is required.');
  } else {
    const last = adapter.primaryCandidates[adapter.primaryCandidates.length - 1];
    if (!isUnconditional(last.enablement)) {
      push(
        'LAST_PRIMARY_CANDIDATE_NOT_UNCONDITIONAL',
        `The last primary candidate ("${last.id}") must be unconditional so a primary always resolves.`
      );
    }
  }

  if (adapter.viewsMandate.exactCount !== null && adapter.views.length !== adapter.viewsMandate.exactCount) {
    push(
      'VIEW_COUNT_VIOLATES_MANDATE',
      `${adapter.moduleId} declares ${adapter.views.length} views but ${adapter.viewsMandate.source} ` +
        `mandate says exactly ${adapter.viewsMandate.exactCount} (${adapter.viewsMandate.reference}).`
    );
  }

  const seen = new Set<string>();
  for (const v of adapter.views) {
    if (seen.has(v.id)) push('DUPLICATE_VIEW_ID', `Duplicate view id "${v.id}".`);
    seen.add(v.id);
  }

  if (
    adapter.viewNavigationKind === 'stepper' &&
    resolveViewNavigationPlacement(adapter.views.length) !== 'separate-row'
  ) {
    push(
      'STEPPER_WITHOUT_SEPARATE_ROW',
      'A stepper must live on its own compact row (handoff section 11), never inline in the bar.',
    );
  }

  if (adapter.relatedDownstreamTypes.length === 0) {
    push(
      'EMPTY_RELATED_DOWNSTREAM',
      'Every Finance artifact has at least REPORT_EXPORT downstream (OWN-FIN-007 "+ New z preselected source").'
    );
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/**
 * Which view mandates exist, exported so a regression test can iterate them
 * rather than restating the numbers (a test that repeats a constant proves
 * nothing when both are edited together).
 */
export const WORKSPACE_VIEW_MANDATES: Readonly<Record<FinanceWorkspaceModuleId, ViewsMandate>> = {
  statements: statementsAdapter.viewsMandate,
  analysis: analysisAdapter.viewsMandate,
  baselineModel: baselineModelAdapter.viewsMandate,
  prediction: predictionAdapter.viewsMandate,
  valuation: valuationAdapter.viewsMandate,
};
