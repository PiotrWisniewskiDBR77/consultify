/**
 * Pakiet E — testy `analysisWorkspace.contract.ts`. Pokrywa DOSŁOWNIE
 * kontrole negatywne z brifu: "spróbuj zatwierdzić pusty draft → musi się nie
 * dać", "spróbuj edytować zatwierdzoną analizę → odmowa", "Otwórz ponownie
 * tworzy NOWĄ wersję, stara zachowuje snapshot".
 */
import { describe, expect, it } from 'vitest';

import { resolveControlState, type WorkspaceBarEvaluationContext } from '../../shared/financeWorkspaceBar.contract';
import {
  ANALYSIS_HAS_KPIS_GATE,
  buildAnalysisLifecycleTransitions,
  buildAnalysisWorkspaceBarConfig,
  buildReopenedVersionMeta,
  canApproveAnalysis,
  canRenameArtifact,
  canSubmitAnalysisForReview,
  isAnalysisEmpty,
  resolveAnalysisPrimaryCta,
  type AnalysisCompleteness,
} from '../analysisWorkspace.contract';

const EMPTY: AnalysisCompleteness = { selectedKpiCount: 0, computedValueCount: 0 };
const CONFIGURED_NEVER_COMPUTED: AnalysisCompleteness = { selectedKpiCount: 5, computedValueCount: 0 };
const CONFIGURED_COMPUTED: AnalysisCompleteness = { selectedKpiCount: 5, computedValueCount: 5 };

describe('isAnalysisEmpty', () => {
  it('0 KPI ⇒ empty; ≥1 KPI ⇒ nie-empty', () => {
    expect(isAnalysisEmpty(EMPTY)).toBe(true);
    expect(isAnalysisEmpty(CONFIGURED_COMPUTED)).toBe(false);
  });
});

describe('OWN-FIN-008 — resolveAnalysisPrimaryCta: pusty draft', () => {
  it('DRAFT + 0 KPI ⇒ CTA = configure_kpis, NIGDY submit/approve', () => {
    const cta = resolveAnalysisPrimaryCta('DRAFT', EMPTY, false);
    expect(cta.id).toBe('configure_kpis');
    expect(cta.navigatesToKpiSelection).toBe(true);
  });

  it('KONTROLA NEGATYWNA: nawet status IN_REVIEW/APPROVED z 0 KPI (stan niespójny, np. ręczna manipulacja) wraca configure_kpis, nie udaje sukcesu', () => {
    expect(resolveAnalysisPrimaryCta('IN_REVIEW', EMPTY, false).id).toBe('configure_kpis');
    expect(resolveAnalysisPrimaryCta('APPROVED', EMPTY, false).id).toBe('configure_kpis');
  });

  it('DRAFT + KPI skonfigurowane, nigdy nie przeliczone ⇒ compute_first_time', () => {
    expect(resolveAnalysisPrimaryCta('DRAFT', CONFIGURED_NEVER_COMPUTED, false).id).toBe('compute_first_time');
  });

  it('DRAFT + KPI przeliczone + freshness stale ⇒ recompute', () => {
    expect(resolveAnalysisPrimaryCta('DRAFT', CONFIGURED_COMPUTED, true).id).toBe('recompute');
  });

  it('DRAFT + KPI przeliczone + freshness current ⇒ submit_for_review', () => {
    expect(resolveAnalysisPrimaryCta('DRAFT', CONFIGURED_COMPUTED, false).id).toBe('submit_for_review');
  });

  it('OWN-FIN-013: APPROVED + KPI ⇒ reopen_or_new_version (nigdy dead-end)', () => {
    expect(resolveAnalysisPrimaryCta('APPROVED', CONFIGURED_COMPUTED, false).id).toBe('reopen_or_new_version');
  });
});

describe('OWN-FIN-008 — KONTROLA NEGATYWNA: "zatwierdzenie pustego draftu MUSI się nie dać"', () => {
  it('canSubmitAnalysisForReview(EMPTY) ⇒ ok:false, kod NO_KPIS_SELECTED', () => {
    const result = canSubmitAnalysisForReview(EMPTY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NO_KPIS_SELECTED');
  });

  it('canSubmitAnalysisForReview(CONFIGURED) ⇒ ok:true', () => {
    expect(canSubmitAnalysisForReview(CONFIGURED_COMPUTED)).toEqual({ ok: true });
  });

  it('canApproveAnalysis(IN_REVIEW, EMPTY) ⇒ ok:false NO_KPIS_SELECTED — próba zatwierdzenia pustego draftu odrzucona', () => {
    const result = canApproveAnalysis('IN_REVIEW', EMPTY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NO_KPIS_SELECTED');
  });

  it('canApproveAnalysis(DRAFT, CONFIGURED) ⇒ ok:false NOT_IN_REVIEW — nie omija stanu maszyny nawet z KPI', () => {
    const result = canApproveAnalysis('DRAFT', CONFIGURED_COMPUTED);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NOT_IN_REVIEW');
  });

  it('canApproveAnalysis(IN_REVIEW, CONFIGURED) ⇒ ok:true — jedyna kombinacja, która przechodzi', () => {
    expect(canApproveAnalysis('IN_REVIEW', CONFIGURED_COMPUTED)).toEqual({ ok: true });
  });
});

describe('OWN-FIN-012 — buildAnalysisLifecycleTransitions: przejścia realne, nie etykieta', () => {
  it('DRAFT zwraca ≥1 przejście (save_draft/submit_for_review/archive) — nie pusta lista', () => {
    const transitions = buildAnalysisLifecycleTransitions('DRAFT', CONFIGURED_COMPUTED, 'preparer');
    expect(transitions.length).toBeGreaterThan(0);
    expect(transitions.map((t) => t.action)).toContain('submit_for_review');
  });

  it('submit_for_review ma requiresGates=[ANALYSIS_HAS_KPIS_GATE] — deklaratywnie związane z kompletnością', () => {
    const transitions = buildAnalysisLifecycleTransitions('DRAFT', EMPTY, 'preparer');
    const submit = transitions.find((t) => t.action === 'submit_for_review');
    expect(submit?.enablement.requiresGates).toContain(ANALYSIS_HAS_KPIS_GATE);
  });

  it('KONTROLA NEGATYWNA: resolveControlState odmawia submit_for_review, gdy bramka KPI=false w evaluationContext', () => {
    const transitions = buildAnalysisLifecycleTransitions('DRAFT', EMPTY, 'preparer');
    const submit = transitions.find((t) => t.action === 'submit_for_review')!;
    const ctx: WorkspaceBarEvaluationContext = { status: 'DRAFT', role: 'preparer', freshness: 'NEVER_COMPUTED', gates: { [ANALYSIS_HAS_KPIS_GATE]: false } };
    const state = resolveControlState(submit.enablement, ctx);
    expect(state.available).toBe(false);
  });

  it('gdy bramka KPI=true, submit_for_review staje się dostępny (dowód, że gate faktycznie coś zmienia, nie stała atrapa)', () => {
    const transitions = buildAnalysisLifecycleTransitions('DRAFT', CONFIGURED_COMPUTED, 'preparer');
    const submit = transitions.find((t) => t.action === 'submit_for_review')!;
    const ctx: WorkspaceBarEvaluationContext = { status: 'DRAFT', role: 'preparer', freshness: 'CURRENT', gates: { [ANALYSIS_HAS_KPIS_GATE]: true } };
    expect(resolveControlState(submit.enablement, ctx).available).toBe(true);
  });

  it('OWN-FIN-013 KONTROLA NEGATYWNA: APPROVED NIGDY nie zwraca pustej listy przejść', () => {
    const transitions = buildAnalysisLifecycleTransitions('APPROVED', CONFIGURED_COMPUTED, 'viewer');
    expect(transitions.length).toBeGreaterThan(0);
    expect(transitions.map((t) => t.action)).toEqual(expect.arrayContaining(['new_version', 'reopen']));
  });

  it('approve wymaga roli approver/finance_admin — resolveControlState odmawia dla preparer nawet z KPI', () => {
    const transitions = buildAnalysisLifecycleTransitions('IN_REVIEW', CONFIGURED_COMPUTED, 'preparer');
    const approve = transitions.find((t) => t.action === 'approve')!;
    const ctxPreparer: WorkspaceBarEvaluationContext = { status: 'IN_REVIEW', role: 'preparer', freshness: 'CURRENT', gates: { [ANALYSIS_HAS_KPIS_GATE]: true } };
    const ctxApprover: WorkspaceBarEvaluationContext = { status: 'IN_REVIEW', role: 'approver', freshness: 'CURRENT', gates: { [ANALYSIS_HAS_KPIS_GATE]: true } };
    expect(resolveControlState(approve.enablement, ctxPreparer).available).toBe(false);
    expect(resolveControlState(approve.enablement, ctxApprover).available).toBe(true);
  });
});

describe('Approved niezmienne — rename zablokowany, reopen tworzy nową wersję', () => {
  it('canRenameArtifact(APPROVED, *) ⇒ editable:false STATUS_IMMUTABLE, dla KAŻDEJ roli', () => {
    for (const role of ['preparer', 'reviewer', 'approver', 'finance_admin', 'viewer'] as const) {
      const result = canRenameArtifact('APPROVED', role);
      expect(result.editable).toBe(false);
    }
  });

  it('canRenameArtifact(DRAFT, preparer) ⇒ editable:true — kontrast z APPROVED (dowód, że blokada jest specyficzna dla statusu)', () => {
    expect(canRenameArtifact('DRAFT', 'preparer').editable).toBe(true);
  });

  it('buildReopenedVersionMeta: nowa wersja odwołuje się jawnie do poprzedniej (numer+id+powód), nie nadpisuje jej', () => {
    const meta = buildReopenedVersionMeta({
      previousBusinessVersionId: 'bv-approved-1',
      previousVersionNo: 2,
      reason: 'Błąd w formule marży',
      reopenedByUserId: 'user-1',
      nowIso: '2026-08-11T10:00:00Z',
    });
    expect(meta.previousBusinessVersionId).toBe('bv-approved-1');
    expect(meta.previousVersionNo).toBe(2);
    expect(meta.historyLabelPl).toContain('v3');
    expect(meta.historyLabelPl).toContain('v2');
    expect(meta.historyLabelPl).toContain('Błąd w formule marży');
  });
});

describe('buildAnalysisWorkspaceBarConfig — integracja z Pakietem C', () => {
  it('pusty draft: primary CTA = configure_kpis, moduleId=analysis, artifactType=HISTORICAL_ANALYSIS', () => {
    const config = buildAnalysisWorkspaceBarConfig(
      {
        artifactId: 'art-1',
        businessVersionId: 'bv-1',
        versionNo: 1,
        name: 'Nowa analiza',
        status: 'DRAFT',
        freshness: 'NEVER_COMPUTED',
        hasUncommittedWorkingRevision: true,
        role: 'preparer',
      },
      EMPTY
    );
    expect(config.moduleId).toBe('analysis');
    expect(config.artifactType).toBe('HISTORICAL_ANALYSIS');
    expect(config.actions.primary.id).toBe('primary.configure_kpis');
  });

  it('APPROVED: nazwa niemożliwa do edycji (STATUS_IMMUTABLE), lifecycle ma reopen/new_version', () => {
    const config = buildAnalysisWorkspaceBarConfig(
      {
        artifactId: 'art-1',
        businessVersionId: 'bv-2',
        versionNo: 2,
        name: 'Analiza FY2026 (zatwierdzona)',
        status: 'APPROVED',
        freshness: 'CURRENT',
        hasUncommittedWorkingRevision: false,
        role: 'approver',
      },
      CONFIGURED_COMPUTED
    );
    expect(config.identity.name.editable).toBe(false);
    expect(config.identity.name.editableBlockedReason).toBe('STATUS_IMMUTABLE');
    expect(config.actions.lifecycle?.transitions.map((t) => t.action)).toEqual(
      expect.arrayContaining(['reopen', 'new_version'])
    );
  });

  it('rerender z inną kompletnością zmienia primary CTA — dowód, że config faktycznie reaguje na dane, nie zwraca stałej', () => {
    const base = {
      artifactId: 'art-1',
      businessVersionId: 'bv-1',
      versionNo: 1,
      name: 'Analiza',
      status: 'DRAFT' as const,
      freshness: 'NEVER_COMPUTED' as const,
      hasUncommittedWorkingRevision: true,
      role: 'preparer' as const,
    };
    const before = buildAnalysisWorkspaceBarConfig(base, EMPTY);
    const after = buildAnalysisWorkspaceBarConfig(base, CONFIGURED_NEVER_COMPUTED);
    expect(before.actions.primary.id).not.toBe(after.actions.primary.id);
  });
});
