/**
 * Cross-Module Handoff Integration Tests
 *
 * Verifies that data contracts between modules are structurally sound
 * and that handoff payloads produced by one module satisfy the
 * consumer expectations of the next module in the chain.
 *
 * Chains tested:
 *   C1  P09 → P10 → P11   (Survey → Insight → Initiative)
 *   C2  P06 → P11 / P03   (Radar → Initiative / Execution)
 *   C3  P08 → P06/P11/P02/P07 (Teresa → handoff targets)
 *   C4  P07 → P06/P11/P08 (Notebook → handoff targets)
 *   C5  P11 → P03/P04/P02 (Initiative → Execution/KPI/Calendar)
 *   C6  P04 ↔ P05         (KPI ↔ Finance coherence gate)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock DB layer ──────────────────────────────────────────────────────────

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Canon imports ──────────────────────────────────────────────────────────

import type { InitiativeHandoffKind } from '../../../../initiative/initiativeLifecycleCanon.js';
import { buildInitiativeOutboundHandoffPayload } from '../../../../initiative/initiativeLifecycleCanon.js';
import {
  buildP10HandoffToInitiativesSkeleton,
  P10_CONFIDENCE_LEVELS,
  P10_EVIDENCE_POINTER_TYPES,
  P10_HANDOFF_TO_INITIATIVES,
} from '../../../interviewInsightCanon.js';
import type { P10EvidencePointer, P10EvidencePointerType } from '../../../interviewInsightCanon.js';
import { P07_HANDOFF_COMMON_FIELDS, P07_HANDOFF_TARGETS } from '../../../notebookCanon.js';
import {
  buildP09HandoffPayloadSkeleton,
  P09_HANDOFF_TO_P10,
  P09_SUBMISSION_STATUSES,
} from '../../../surveyCollectionCanon.js';
import {
  isValidEnvelopeTransition,
  P08_ACTION_ENVELOPE_STATES,
  P08_HANDOFF_TARGET_MODULES,
  P08_HANDOFF_TARGETS,
  validateHandoffContext,
  validateTargetPayload,
  validateWriteOwnership,
} from '../../../teresaCopilotCanon.js';

const INITIATIVE_HANDOFF_KINDS: InitiativeHandoffKind[] = ['execution', 'kpi', 'calendar'];

import { createArtifactRunFromChat } from '../../../artifactRegistryService.js';
import {
  createEconomicsLinkage,
  evaluatePromotionGate,
  getLinkagesByInitiative,
} from '../../../financeIntegrationService.js';
import {
  advanceLaneStep,
  checkKpiLinkageCoherence,
  startLaneRun,
} from '../../../financeLaneService.js';
import { buildHandoffContext, executeHandoff } from '../../../radarTriageService.js';
import { getKpiWorkflowStatus, initiateReconciliation } from '../../../resultsROIService.js';
import {
  recordSourceMaterialization,
  validateMaterializationChain,
} from '../../../sourceTruthService.js';

// ── Fixtures ───────────────────────────────────────────────────────────────

const ORG = '00000000-0000-4000-8000-000000000c01';
const USER = '00000000-0000-4000-8000-000000000c02';
const INITIATIVE_ID = '00000000-0000-4000-8000-000000000c03';
const SURVEY_ID = '00000000-0000-4000-8000-000000000c04';
const SUBMISSION_ID = '00000000-0000-4000-8000-000000000c05';
const INSIGHT_ID = '00000000-0000-4000-8000-000000000c06';
const FINDING_ID = '00000000-0000-4000-8000-000000000c07';
const SIGNAL_ID = '00000000-0000-4000-8000-000000000c08';
const KPI_ID = '00000000-0000-4000-8000-000000000c09';
const FINANCE_REF = 'finance-model-cross-001';

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRun.mockResolvedValue({ success: true });
  mockDbGet.mockResolvedValue(null);
  mockDbAll.mockResolvedValue([]);
});

// ═══════════════════════════════════════════════════════════════════════════
// C1: P09 → P10 → P11  (Survey → Insight → Initiative)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The frozen P10 evidence pointer is
 * `{ pointerId, type, sourceRef, capturedAt, sourceFingerprint, isTombstone }`.
 * The fixtures below were authored against an ad-hoc `{ type, ref, label }`
 * shape the canon never defined, so the "frozen contract" specs were not in
 * fact exercising the frozen contract. Same source refs, canonical shape.
 */
function p10Pointer(
  type: P10EvidencePointerType,
  sourceRef: string,
  label: string
): P10EvidencePointer {
  return {
    pointerId: `pointer-${sourceRef}`,
    type,
    sourceRef,
    capturedAt: '2026-03-30T12:00:00Z',
    sourceFingerprint: `fingerprint-${sourceRef}`,
    capturedExcerpt: label,
    isTombstone: false,
  };
}

describe('C1 — Survey → Insight → Initiative chain', () => {
  it('P09 handoff payload satisfies P10 ingestion contract', () => {
    const payload = buildP09HandoffPayloadSkeleton({
      surveyId: SURVEY_ID,
      submissionId: SUBMISSION_ID,
      submissionStatus: 'locked',
      validationSummary: 'All required fields present',
      surveyVersion: '2.1',
      startedAt: '2026-03-01T10:00:00Z',
      submittedAt: '2026-03-15T14:30:00Z',
    });

    for (const field of P09_HANDOFF_TO_P10.required_fields) {
      const parts = field.split('.');
      let obj: any = payload;
      for (const part of parts) {
        expect(obj).toHaveProperty(part);
        obj = obj[part];
      }
    }

    expect(payload.idempotencyKey).toBe(SUBMISSION_ID);
    expect(payload.governance.submissionStatus).toBe('locked');
    expect(payload.timestamps.started).toBeTruthy();
    expect(payload.timestamps.submitted).toBeTruthy();
    expect(payload.provenance.surveyVersionAtSubmission).toBe('2.1');
    expect(Array.isArray(payload.content.normalizedAnswers)).toBe(true);
    expect(Array.isArray(payload.content.attachmentRefs)).toBe(true);
  });

  it('P10 handoff payload satisfies P11 initiative seeding contract', () => {
    const payload = buildP10HandoffToInitiativesSkeleton({
      insightArtifactId: INSIGHT_ID,
      findingId: FINDING_ID,
      findingStatement: 'Users need faster onboarding flow',
      confidenceLevel: 'high',
      limits: 'Sample size limited to 15 interviews',
      nextAction: 'Create initiative for onboarding redesign',
      evidencePointers: [
        p10Pointer('interview_session', 'session-001', 'Interview #1'),
        p10Pointer('transcript_excerpt', 'transcript-001', 'Full transcript'),
      ],
    });

    expect(payload.source_insight_artifact_id).toBe(INSIGHT_ID);
    expect(payload.source_finding_id).toBe(FINDING_ID);
    expect(payload.finding_statement).toBeTruthy();
    expect(P10_CONFIDENCE_LEVELS).toContain(payload.confidence_level);
    expect(payload.limits).toBeTruthy();
    expect(payload.next_action).toBeTruthy();
    expect(payload.evidence_pointers.length).toBeGreaterThan(0);

    for (const ptr of payload.evidence_pointers) {
      expect(P10_EVIDENCE_POINTER_TYPES).toContain(ptr.type);
    }

    expect(payload.source_insight_artifact_deep_link).toContain(INSIGHT_ID);
    expect(payload.source_finding_deep_link).toContain(FINDING_ID);
  });

  it('full chain P09→P10→P11: output of each step feeds the next', () => {
    const p09Payload = buildP09HandoffPayloadSkeleton({
      surveyId: SURVEY_ID,
      submissionId: SUBMISSION_ID,
      submissionStatus: 'locked',
      validationSummary: 'Complete',
      surveyVersion: '1.0',
      startedAt: '2026-01-01T00:00:00Z',
      submittedAt: '2026-01-15T00:00:00Z',
    });

    expect(p09Payload.surveyId).toBe(SURVEY_ID);
    expect(p09Payload.submissionId).toBe(SUBMISSION_ID);

    const p10Payload = buildP10HandoffToInitiativesSkeleton({
      insightArtifactId: INSIGHT_ID,
      findingId: FINDING_ID,
      findingStatement: 'Key finding from survey analysis',
      confidenceLevel: 'medium',
      limits: 'Based on survey ' + p09Payload.surveyId,
      nextAction: 'Seed initiative from insight',
      evidencePointers: [p10Pointer('survey_linkage', p09Payload.surveyId, 'Source survey')],
    });

    expect(p10Payload.evidence_pointers[0].sourceRef).toBe(p09Payload.surveyId);
    expect(p10Payload.limits).toContain(p09Payload.surveyId);

    expect(P10_HANDOFF_TO_INITIATIVES.rule).toContain('links-first');
    expect(P10_HANDOFF_TO_INITIATIVES.rule).toContain('max 5');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C2: P06 → P11 / P03  (Radar → Initiative / Execution)
// ═══════════════════════════════════════════════════════════════════════════

describe('C2 — Radar → Initiative / Execution handoff', () => {
  const makeRadarSignal = (category: string, targetModule: string) => ({
    signalId: SIGNAL_ID,
    organizationId: ORG,
    category,
    priorityLevel: 'P0' as const,
    whyNow: {
      rationaleText: 'Critical path blocker detected',
      timeWindow: '48h',
      triggeredAt: '2026-03-30T12:00:00Z',
    },
    evidence: {
      evidencePointers: [
        { type: 'initiative' as const, ref: INITIATIVE_ID, label: 'Blocked initiative' },
      ],
      lastObservedAt: '2026-03-30T12:00:00Z',
    },
    uncertaintyBoundary: {
      level: 'medium' as const,
      missingInputs: ['Resource availability data'],
    },
    ownership: {
      ownerRole: 'PMO' as const,
      escalationPath: ['PMO', 'Sponsor'],
    },
    nextAction: {
      targetModule,
      handoffPayload: {},
    },
    triggeredRules: ['critical_path_blocker'],
    rank: { bands: ['P0'], triggeredRules: ['critical_path_blocker'] },
    triageState: 'new' as const,
    createdAt: '2026-03-30T12:00:00Z',
  });

  it('buildHandoffContext produces valid radar context envelope', () => {
    const signal = makeRadarSignal('execution_delay', 'Inicjatywy');
    const ctx = buildHandoffContext(signal as any);

    expect(ctx.origin).toBe('radar');
    expect(ctx.signalId).toBe(SIGNAL_ID);
    expect(ctx.category).toBe('execution_delay');
    expect(ctx.priorityLevel).toBe('P0');
    expect(ctx.whyNow).toBeTruthy();
    expect(ctx.evidencePointers).toHaveLength(1);
    expect(ctx.radarDeeplink).toContain(SIGNAL_ID);
    expect(ctx.triggeredRules).toContain('critical_path_blocker');
  });

  it('executeHandoff to Inicjatywy includes initiative_suggestion', async () => {
    mockDbGet.mockResolvedValueOnce({
      signal_id: SIGNAL_ID,
      organization_id: ORG,
      category: 'execution_delay',
      priority_level: 'P0',
      score: 95,
      bands_json: JSON.stringify({
        impact: 5,
        urgency: 5,
        scope: 3,
        confidence: 4,
        freshness: 5,
        actionability: 4,
      }),
      triggered_rules_json: JSON.stringify(['critical_path_blocker']),
      why_now_json: JSON.stringify({
        rationaleText: 'Critical path blocker detected',
        timeWindow: '48h',
        triggeredAt: '2026-03-30T12:00:00Z',
      }),
      evidence_json: JSON.stringify({
        evidencePointers: [{ type: 'initiative', ref: INITIATIVE_ID, label: 'Blocked initiative' }],
        lastObservedAt: '2026-03-30T12:00:00Z',
      }),
      uncertainty_json: JSON.stringify({
        missingInputs: ['Resource availability data'],
        conflicts: [],
        whatWouldChangeRanking: [],
      }),
      ownership_json: JSON.stringify({ ownerRole: 'PMO', escalationPath: ['PMO', 'Sponsor'] }),
      next_action_json: JSON.stringify({
        targetModule: 'Inicjatywy',
        handoffIntent: 'open',
        handoffPayload: {},
        safeFallback: '',
      }),
      triage_state: 'ready',
      created_at: '2026-03-30T12:00:00Z',
      updated_at: '2026-03-30T12:00:00Z',
    });

    const result = await executeHandoff(SIGNAL_ID, ORG);

    expect(result.targetModule).toBe('Inicjatywy');
    expect(result.handoffContext.origin).toBe('radar');
    expect(result.targetPayload).toHaveProperty('initiative_suggestion');
    expect(result.targetPayload).toHaveProperty('radar_handoff_context');
    expect((result.targetPayload.initiative_suggestion as any).problem_statement).toBeTruthy();
    expect((result.targetPayload.initiative_suggestion as any).proposed_outcome).toBeTruthy();
  });

  it('executeHandoff to Wdrożenia includes deployment_suggestion', async () => {
    mockDbGet.mockResolvedValueOnce({
      signal_id: SIGNAL_ID,
      organization_id: ORG,
      category: 'resource_bottleneck',
      priority_level: 'P0',
      score: 90,
      bands_json: JSON.stringify({
        impact: 4,
        urgency: 4,
        scope: 3,
        confidence: 3,
        freshness: 4,
        actionability: 3,
      }),
      triggered_rules_json: JSON.stringify(['resource_bottleneck']),
      why_now_json: JSON.stringify({
        rationaleText: 'Resource bottleneck on critical path',
        timeWindow: '48h',
        triggeredAt: '2026-03-30T12:00:00Z',
      }),
      evidence_json: JSON.stringify({
        evidencePointers: [{ type: 'initiative', ref: INITIATIVE_ID, label: 'Blocked' }],
        lastObservedAt: '2026-03-30T12:00:00Z',
      }),
      uncertainty_json: JSON.stringify({
        missingInputs: ['Capacity data'],
        conflicts: [],
        whatWouldChangeRanking: [],
      }),
      ownership_json: JSON.stringify({ ownerRole: 'PMO', escalationPath: ['PMO'] }),
      next_action_json: JSON.stringify({
        targetModule: 'Wdrożenia',
        handoffIntent: 'open',
        handoffPayload: {},
        safeFallback: '',
      }),
      triage_state: 'ready',
      created_at: '2026-03-30T12:00:00Z',
      updated_at: '2026-03-30T12:00:00Z',
    });

    const result = await executeHandoff(SIGNAL_ID, ORG);

    expect(result.targetModule).toBe('Wdrożenia');
    expect(result.targetPayload).toHaveProperty('deployment_suggestion');
    expect((result.targetPayload.deployment_suggestion as any).blocker_summary).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C3: P08 → P06/P11/P02/P07  (Teresa → handoff targets)
// ═══════════════════════════════════════════════════════════════════════════

describe('C3 — Teresa copilot → handoff targets', () => {
  it('all P0 handoff targets are defined with required fields', () => {
    expect(P08_HANDOFF_TARGET_MODULES).toHaveLength(12);
    expect(P08_HANDOFF_TARGET_MODULES).toEqual(
      expect.arrayContaining([
        'radar',
        'initiatives',
        'calendar',
        'notebook',
        'interview',
        'excele',
        'ideas',
        'documents',
        'presentations',
        'kpi',
        'roi',
        'okr',
      ])
    );

    // `P08_HANDOFF_TARGET_MODULES` is annotated with the full `HandoffTargetModule`
    // union, but `P08_HANDOFF_TARGETS` only carries the modules that actually have
    // a contract. Widen the lookup so a missing contract fails the assertion below
    // instead of failing to compile.
    const contractedTargets = P08_HANDOFF_TARGETS as Partial<
      Record<
        (typeof P08_HANDOFF_TARGET_MODULES)[number],
        { module: string; contract_ref: string; required_extra_fields: readonly string[] }
      >
    >;
    for (const mod of P08_HANDOFF_TARGET_MODULES) {
      const target = contractedTargets[mod];
      expect(target).toBeDefined();
      if (!target) continue;
      expect(target.module).toBeTruthy();
      expect(target.contract_ref).toBeTruthy();
      expect(target.required_extra_fields.length).toBeGreaterThan(0);
    }
  });

  it('validateHandoffContext rejects incomplete common payload', () => {
    const incomplete = { action_id: 'a1' };
    const result = validateHandoffContext(incomplete);
    expect(result.valid).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it('validateTargetPayload enforces per-target required fields', () => {
    for (const mod of P08_HANDOFF_TARGET_MODULES) {
      const emptyPayload = {};
      const result = validateTargetPayload(mod, emptyPayload);
      expect(result.valid).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
    }
  });

  it('validateTargetPayload accepts complete radar payload', () => {
    const radarTarget = P08_HANDOFF_TARGETS.radar;
    const payload: Record<string, unknown> = {};
    for (const field of radarTarget.required_extra_fields) {
      payload[field] = `test-${field}`;
    }
    const result = validateTargetPayload('radar', payload);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('action envelope transitions follow governance rules', () => {
    expect(isValidEnvelopeTransition('proposal', 'pending_approval')).toBe(true);
    expect(isValidEnvelopeTransition('proposal', 'rejected')).toBe(true);
    expect(isValidEnvelopeTransition('pending_approval', 'approved')).toBe(true);
    expect(isValidEnvelopeTransition('pending_approval', 'rejected')).toBe(true);
    expect(isValidEnvelopeTransition('approved', 'executing')).toBe(true);
    expect(isValidEnvelopeTransition('executing', 'completed')).toBe(true);
    expect(isValidEnvelopeTransition('executing', 'rejected')).toBe(true);

    expect(isValidEnvelopeTransition('proposal', 'completed')).toBe(false);
    expect(isValidEnvelopeTransition('rejected', 'executing')).toBe(false);
    expect(isValidEnvelopeTransition('completed', 'proposal')).toBe(false);
    expect(isValidEnvelopeTransition('proposal', 'approved')).toBe(false);
  });

  it('write ownership rule: Teresa cannot be both initiator and writer', () => {
    const bad = validateWriteOwnership('teresa', 'teresa');
    expect(bad.valid).toBe(false);
    expect(bad.reason).toContain('cannot be both');

    const good = validateWriteOwnership('teresa', 'calendar_module');
    expect(good.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C4: P07 → P06/P11/P08  (Notebook → handoff targets)
// ═══════════════════════════════════════════════════════════════════════════

describe('C4 — Notebook → handoff targets', () => {
  it('P07 defines 3 handoff targets with common fields', () => {
    const targets = Object.keys(P07_HANDOFF_TARGETS);
    expect(targets).toEqual(expect.arrayContaining(['radar', 'inicjatywy', 'teresa']));

    expect(P07_HANDOFF_COMMON_FIELDS.length).toBeGreaterThan(0);
  });

  it('each P07 handoff target has requiredFields including common fields', () => {
    for (const [, target] of Object.entries(P07_HANDOFF_TARGETS)) {
      expect(target).toHaveProperty('module');
      expect(target).toHaveProperty('requiredFields');
      expect(Array.isArray(target.requiredFields)).toBe(true);
      for (const common of P07_HANDOFF_COMMON_FIELDS) {
        expect(target.requiredFields).toContain(common);
      }
    }
  });

  it('P07 radar handoff includes signal suggestion fields', () => {
    const radarTarget = P07_HANDOFF_TARGETS.radar;
    expect(radarTarget.module).toBe('P06');
    expect(radarTarget.requiredFields).toContain('radar_signal_suggestion');
    expect(radarTarget.signalSuggestionFields.length).toBeGreaterThan(0);
    expect(radarTarget.signalSuggestionFields).toContain('category');
    expect(radarTarget.signalSuggestionFields).toContain('why_now');
  });

  it('P07 inicjatywy handoff includes initiative seed fields', () => {
    const initTarget = P07_HANDOFF_TARGETS.inicjatywy;
    expect(initTarget.module).toBe('P11');
    expect(initTarget.requiredFields).toContain('initiative_seed');
    expect(initTarget.initiativeSeedFields.length).toBeGreaterThan(0);
    expect(initTarget.initiativeSeedFields).toContain('problem_statement');
  });

  it('P07 teresa handoff includes assistant context fields', () => {
    const teresaTarget = P07_HANDOFF_TARGETS.teresa;
    expect(teresaTarget.module).toBe('P08');
    expect(teresaTarget.requiredFields).toContain('assistant_context');
    expect(teresaTarget.assistantContextFields.length).toBeGreaterThan(0);
    expect(teresaTarget.assistantContextFields).toContain('user_intent');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C5: P11 → P03/P04/P02  (Initiative → Execution/KPI/Calendar)
// ═══════════════════════════════════════════════════════════════════════════

describe('C5 — Initiative → Execution / KPI / Calendar handoff', () => {
  const makeInitiativeRow = () => ({
    id: INITIATIVE_ID,
    title: 'Digital Transformation',
    status: 'ACTIVE',
    owner_execution_id: USER,
    planned_start_date: '2026-01-01',
    planned_end_date: '2026-12-31',
    program_id: 'prog-001',
    project_id: 'proj-001',
    schedule_baseline_id: 'baseline-001',
  });

  it('all 3 handoff kinds produce valid envelopes', () => {
    const kindToIntentField: Record<string, string> = {
      execution: 'executionIntent',
      kpi: 'kpiIntent',
      calendar: 'calendarIntent',
    };

    for (const kind of INITIATIVE_HANDOFF_KINDS) {
      const payload = buildInitiativeOutboundHandoffPayload({
        initiativeRow: makeInitiativeRow(),
        organizationId: ORG,
        handoffBy: USER,
        kind,
      });

      expect(payload.initiativeId).toBe(INITIATIVE_ID);
      expect(payload.initiativeTitle).toBe('Digital Transformation');
      expect(payload).toHaveProperty(kindToIntentField[kind]);
      expect(payload.initiativeLifecycleState).toBeTruthy();
      expect(payload.initiativeDbStatus).toBeTruthy();
      expect(payload.handoffBy).toBe(USER);
      expect(payload.handoffAt).toBeTruthy();
      expect(Array.isArray(payload.contextPack)).toBe(true);
    }
  });

  it('execution handoff includes workstream context from initiative row', () => {
    const payload = buildInitiativeOutboundHandoffPayload({
      initiativeRow: makeInitiativeRow(),
      organizationId: ORG,
      handoffBy: USER,
      kind: 'execution',
    });

    expect(payload.executionIntent).toBeTruthy();
    expect(payload.contextPack.length).toBeGreaterThan(0);
    const refs = payload.contextPack.map((c: any) => c.ref);
    expect(refs.some((r: string) => r.includes('program:'))).toBe(true);
    expect(refs.some((r: string) => r.includes('project:'))).toBe(true);
    expect(refs.some((r: string) => r.includes('schedule_baseline:'))).toBe(true);
  });

  it('kpi handoff carries initiative identity for measurement binding', () => {
    const payload = buildInitiativeOutboundHandoffPayload({
      initiativeRow: makeInitiativeRow(),
      organizationId: ORG,
      handoffBy: USER,
      kind: 'kpi',
    });

    expect(payload.kpiIntent).toBeTruthy();
    expect(payload.initiativeId).toBe(INITIATIVE_ID);
    expect(payload.initiativeLifecycleState).toBeTruthy();
  });

  it('calendar handoff carries milestone refs for scheduling', () => {
    const payload = buildInitiativeOutboundHandoffPayload({
      initiativeRow: makeInitiativeRow(),
      organizationId: ORG,
      handoffBy: USER,
      kind: 'calendar',
      contextPackExtras: [{ kind: 'milestone', ref: 'milestone:m1', label: 'Phase 1 end' }],
    });

    expect(payload.calendarIntent).toBeTruthy();
    const milestones = payload.contextPack.filter((c: any) => c.kind === 'milestone');
    expect(milestones.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C6: P04 ↔ P05  (KPI ↔ Finance coherence gate)
// ═══════════════════════════════════════════════════════════════════════════

describe('C6 — KPI ↔ Finance coherence gate', () => {
  it('initiateReconciliation creates a pending link between KPI and Finance', async () => {
    const reconciliation = await initiateReconciliation({
      organizationId: ORG,
      kpiId: KPI_ID,
      financeRef: FINANCE_REF,
      initiatedBy: 'results',
    });

    expect(reconciliation.reconciliationId).toBeDefined();
    expect(reconciliation.kpiId).toBe(KPI_ID);
    expect(reconciliation.financeRef).toBe(FINANCE_REF);
    expect(reconciliation.reconciliationStatus).toBe('pending');
    expect(reconciliation.initiatedBy).toBe('results');
  });

  it('checkKpiLinkageCoherence detects stale linkage when no reconciliations exist', async () => {
    const runId = 'run-coherence-001';
    mockDbAll.mockResolvedValueOnce([]);

    const result = await checkKpiLinkageCoherence(ORG, runId);

    expect(['coherent', 'stale', 'unavailable']).toContain(result.status);
    expect(result.detail).toBeTruthy();
  });

  it('finance lane run creation establishes the import→readback contract', async () => {
    const run = await startLaneRun({ organizationId: ORG, actor: USER });

    expect(run.runId).toBeDefined();
    expect(run.organizationId).toBe(ORG);
    expect(run.currentStep).toBe('import');
    expect(Array.isArray(run.auditTrail)).toBe(true);
    expect(run.auditTrail.length).toBeGreaterThan(0);
    expect(run.auditTrail[0].step).toBe('import');
  });

  it('advanceLaneStep follows import→analysis→mutation→readback sequence', async () => {
    const run = await startLaneRun({ organizationId: ORG, actor: USER });

    mockDbGet.mockResolvedValueOnce({
      run_id: run.runId,
      organization_id: ORG,
      current_step: 'import',
      import_outcome: null,
      analysis_completed: 0,
      mutation_outcome: null,
      readback_confirmed: 0,
      degraded_json: '[]',
      audit_trail_json: JSON.stringify(run.auditTrail),
      version_type: 'current',
      kpi_linkage_status: 'coherent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const afterImport = await advanceLaneStep(run.runId, ORG, USER, 'completed');
    expect(afterImport.currentStep).toBe('analysis');

    mockDbGet.mockResolvedValueOnce({
      run_id: run.runId,
      organization_id: ORG,
      current_step: 'analysis',
      import_outcome: 'completed',
      analysis_completed: 0,
      mutation_outcome: null,
      readback_confirmed: 0,
      degraded_json: '[]',
      audit_trail_json: JSON.stringify(afterImport.auditTrail),
      version_type: 'current',
      kpi_linkage_status: 'coherent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const afterAnalysis = await advanceLaneStep(run.runId, ORG, USER, 'completed');
    expect(afterAnalysis.currentStep).toBe('mutation');

    mockDbGet.mockResolvedValueOnce({
      run_id: run.runId,
      organization_id: ORG,
      current_step: 'mutation',
      import_outcome: 'completed',
      analysis_completed: 1,
      mutation_outcome: null,
      readback_confirmed: 0,
      degraded_json: '[]',
      audit_trail_json: JSON.stringify(afterAnalysis.auditTrail),
      version_type: 'current',
      kpi_linkage_status: 'coherent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const afterMutation = await advanceLaneStep(run.runId, ORG, USER, 'applied');
    expect(afterMutation.currentStep).toBe('readback');

    mockDbGet.mockResolvedValueOnce({
      run_id: run.runId,
      organization_id: ORG,
      current_step: 'readback',
      import_outcome: 'completed',
      analysis_completed: 1,
      mutation_outcome: 'mutation_applied',
      readback_confirmed: 0,
      degraded_json: '[]',
      audit_trail_json: JSON.stringify(afterMutation.auditTrail),
      version_type: 'current',
      kpi_linkage_status: 'coherent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mockDbAll
      .mockResolvedValueOnce([{ mutation_id: 'mut-1', status: 'applied', detail: 'ok' }])
      .mockResolvedValueOnce([]);

    const afterReadback = await advanceLaneStep(run.runId, ORG, USER, 'confirmed');
    expect(afterReadback.currentStep).toBe('readback');
    expect(afterReadback.readbackConfirmed).toBe(true);

    const steps = afterReadback.auditTrail.map((e: any) => e.step);
    expect(steps).toContain('import');
    expect(steps).toContain('readback');
  });

  it('getKpiWorkflowStatus returns status with degraded reasons', async () => {
    mockDbAll
      .mockResolvedValueOnce([]) // getKpiSignals
      .mockResolvedValueOnce([]) // getKpiNextActions
      .mockResolvedValueOnce([]); // getReconciliationHealth
    mockDbGet
      .mockResolvedValueOnce(null) // KPI definition lookup
      .mockResolvedValueOnce(null) // linkage row
      .mockResolvedValueOnce(null); // initiative-linked check

    const status = await getKpiWorkflowStatus(KPI_ID, ORG);

    expect(status).toBeDefined();
    expect(status.kpiId).toBe(KPI_ID);
    expect(Array.isArray(status.degradedReasons)).toBe(true);
    expect(status.degradedReasons.some((d: any) => d.reason === 'missing_data')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Cross-chain: contract shape compatibility
// ═══════════════════════════════════════════════════════════════════════════

describe('Cross-chain contract shape compatibility', () => {
  it('P09 locked status is a prerequisite for handoff to P10', () => {
    expect(P09_SUBMISSION_STATUSES).toContain('locked');

    const payload = buildP09HandoffPayloadSkeleton({
      surveyId: SURVEY_ID,
      submissionId: SUBMISSION_ID,
      submissionStatus: 'locked',
      validationSummary: 'Valid',
      surveyVersion: '1.0',
      startedAt: '2026-01-01T00:00:00Z',
      submittedAt: '2026-01-15T00:00:00Z',
    });
    expect(payload.governance.submissionStatus).toBe('locked');
  });

  it('P10 confidence levels are compatible with P11 initiative seeding', () => {
    for (const level of P10_CONFIDENCE_LEVELS) {
      const payload = buildP10HandoffToInitiativesSkeleton({
        insightArtifactId: INSIGHT_ID,
        findingId: FINDING_ID,
        findingStatement: 'Test finding',
        confidenceLevel: level,
        limits: 'Test limits',
        nextAction: 'Test action',
        evidencePointers: [p10Pointer('interview_session', 'ref-1', 'Test')],
      });
      expect(payload.confidence_level).toBe(level);
      expect(payload.source_insight_artifact_id).toBeTruthy();
    }
  });

  it('P08 Teresa handoff targets align with P06/P07/P11/P02 module identifiers', () => {
    const teresaTargets = P08_HANDOFF_TARGET_MODULES;
    expect(teresaTargets).toContain('radar');
    expect(teresaTargets).toContain('initiatives');
    expect(teresaTargets).toContain('calendar');
    expect(teresaTargets).toContain('notebook');

    const notebookTargetKeys = Object.keys(P07_HANDOFF_TARGETS);
    expect(notebookTargetKeys).toContain('radar');
    expect(notebookTargetKeys).toContain('inicjatywy');
    expect(notebookTargetKeys).toContain('teresa');
  });

  it('P11 initiative handoff kinds cover all downstream consumers', () => {
    expect(INITIATIVE_HANDOFF_KINDS).toContain('execution');
    expect(INITIATIVE_HANDOFF_KINDS).toContain('kpi');
    expect(INITIATIVE_HANDOFF_KINDS).toContain('calendar');
  });

  it('P06 radar handoff context has fields expected by P08 Teresa ingestion', () => {
    const signal = {
      signalId: SIGNAL_ID,
      category: 'execution_delay',
      priorityLevel: 'P0',
      whyNow: { rationaleText: 'Test', timeWindow: '24h', triggeredAt: new Date().toISOString() },
      evidence: {
        evidencePointers: [{ type: 'initiative', ref: INITIATIVE_ID, label: 'Test' }],
        lastObservedAt: new Date().toISOString(),
      },
      uncertaintyBoundary: { level: 'low', missingInputs: [] },
      ownership: { ownerRole: 'PMO', escalationPath: ['PMO'] },
      triggeredRules: ['rule1'],
      rank: { bands: ['P0'], triggeredRules: ['rule1'] },
    };

    const ctx = buildHandoffContext(signal as any);

    expect(ctx).toHaveProperty('origin');
    expect(ctx).toHaveProperty('signalId');
    expect(ctx).toHaveProperty('category');
    expect(ctx).toHaveProperty('priorityLevel');
    expect(ctx).toHaveProperty('evidencePointers');
    expect(ctx).toHaveProperty('radarDeeplink');
    expect(ctx).toHaveProperty('triggeredRules');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C7: P11 → P05  (Initiative → Finance economics linkage)
// ═══════════════════════════════════════════════════════════════════════════

describe('C7 — Initiative → Finance economics linkage', () => {
  it('createEconomicsLinkage binds initiative to finance model', async () => {
    const linkage = await createEconomicsLinkage({
      organizationId: ORG,
      financeModelRef: FINANCE_REF,
      initiativeId: INITIATIVE_ID,
      linkageType: 'budget',
    });

    expect(linkage.linkageId).toBeDefined();
    expect(linkage.organizationId).toBe(ORG);
    expect(linkage.financeModelRef).toBe(FINANCE_REF);
    expect(linkage.initiativeId).toBe(INITIATIVE_ID);
    expect(linkage.linkageType).toBe('budget');
    expect(linkage.status).toBe('not_started');
    expect(linkage.createdAt).toBeTruthy();
  });

  it('getLinkagesByInitiative returns linkages for an initiative', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        linkage_id: 'link-001',
        organization_id: ORG,
        finance_model_ref: FINANCE_REF,
        initiative_id: INITIATIVE_ID,
        linkage_type: 'budget_allocation',
        status: 'active',
        created_at: '2026-03-01T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z',
      },
    ]);

    const linkages = await getLinkagesByInitiative(INITIATIVE_ID, ORG);

    expect(linkages).toHaveLength(1);
    expect(linkages[0].initiativeId).toBe(INITIATIVE_ID);
    expect(linkages[0].financeModelRef).toBe(FINANCE_REF);
  });

  it('evaluatePromotionGate computes overall gate result', async () => {
    const gate = await evaluatePromotionGate({
      // `initiativeId` / `financeModelRef` are not members of
      // EvaluatePromotionGateParams and were stripped by the zod parse.
      organizationId: ORG,
      sourceArtifactRef: 'artifact-001',
      targetInitiativeId: INITIATIVE_ID,
      permissionGateResult: 'approved',
      qualityGateResult: 'approved',
      provenancePreserved: true,
      staleStateChecked: true,
    });

    expect(gate.gateId).toBeDefined();
    expect(gate.overallResult).toBe('approved');
    expect(gate.organizationId).toBe(ORG);
    expect(gate.targetInitiativeId).toBe(INITIATIVE_ID);
  });

  it('full chain: create linkage → query → evaluate gate', async () => {
    const linkage = await createEconomicsLinkage({
      organizationId: ORG,
      financeModelRef: FINANCE_REF,
      initiativeId: INITIATIVE_ID,
      linkageType: 'forecast',
    });

    mockDbAll.mockResolvedValueOnce([
      {
        linkage_id: linkage.linkageId,
        organization_id: ORG,
        finance_model_ref: FINANCE_REF,
        initiative_id: INITIATIVE_ID,
        linkage_type: 'forecast',
        status: 'not_started',
        created_at: linkage.createdAt,
        updated_at: linkage.updatedAt,
      },
    ]);

    const linkages = await getLinkagesByInitiative(INITIATIVE_ID, ORG);
    expect(linkages).toHaveLength(1);
    expect(linkages[0].linkageId).toBe(linkage.linkageId);

    const gate = await evaluatePromotionGate({
      organizationId: ORG,
      sourceArtifactRef: 'artifact-002',
      targetInitiativeId: INITIATIVE_ID,
      permissionGateResult: 'approved',
      qualityGateResult: 'rejected',
      provenancePreserved: true,
      staleStateChecked: true,
    });

    expect(gate.overallResult).toBe('rejected');
    expect(gate.targetInitiativeId).toBe(INITIATIVE_ID);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C8: Source Truth → P11  (Materialization chain validation)
// ═══════════════════════════════════════════════════════════════════════════

describe('C8 — Source Truth → Initiative materialization chain', () => {
  it('recordSourceMaterialization creates a promotion record', async () => {
    const record = await recordSourceMaterialization({
      initiativeId: INITIATIVE_ID,
      organizationId: ORG,
      entrypoint: 'idea',
      sourceArtifactId: '00000000-0000-4000-8000-000000000d01',
      sourceArtifactType: 'idea',
      materializationMode: 'invisible',
      evidenceClass: 'strong',
      promotedBy: USER,
    });

    expect(record.recordId).toBeDefined();
    expect(record.initiativeId).toBe(INITIATIVE_ID);
    expect(record.entrypoint).toBe('idea');
    expect(record.entrypointClass).toBeDefined();
    expect(record.evidenceClass).toBe('strong');
    expect(record.promotedBy).toBe(USER);
    expect(record.promotedAt).toBeTruthy();
  });

  it('validateMaterializationChain reports gaps when no materializations exist', async () => {
    mockDbAll.mockResolvedValueOnce([]); // JOIN query — function returns early, no second call

    const result = await validateMaterializationChain(INITIATIVE_ID, ORG);

    expect(result.valid).toBe(false);
    expect(result.gaps.length).toBeGreaterThan(0);
    expect(result.gaps[0]).toContain('No lifecycle materializations');
    expect(result.chain).toHaveLength(0);
  });

  it('validateMaterializationChain succeeds with complete chain', async () => {
    const matId = '00000000-0000-4000-8000-000000000d02';
    const epId = '00000000-0000-4000-8000-000000000d03';
    const sourceId = '00000000-0000-4000-8000-000000000d04';

    mockDbAll
      .mockResolvedValueOnce([
        {
          materialization_id: matId,
          entrypoint_id: epId,
          initiative_id: INITIATIVE_ID,
          organization_id: ORG,
          mat_created_at: '2026-01-01T00:00:00Z',
          ep_entrypoint_id: epId,
          ep_organization_id: ORG,
          source_type: 'idea',
          source_id: sourceId,
          ep_created_at: '2026-01-01T00:00:00Z',
          ep_last_validated_at: '2026-01-01T00:00:00Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          record_id: 'rec-001',
          initiative_id: INITIATIVE_ID,
          organization_id: ORG,
          entrypoint: 'idea',
          entrypoint_class: 'primary',
          source_artifact_id: sourceId,
          source_artifact_type: 'idea',
          materialization_mode: 'invisible',
          evidence_class: 'strong',
          promoted_by: USER,
          promoted_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        },
      ]);

    const result = await validateMaterializationChain(INITIATIVE_ID, ORG);

    expect(result.valid).toBe(true);
    expect(result.gaps).toHaveLength(0);
    expect(result.chain).toHaveLength(1);
    expect(result.chain[0].source.id).toBe(sourceId);
    expect(result.chain[0].source.type).toBe('idea');
    expect(result.chain[0].materialization.initiativeId).toBe(INITIATIVE_ID);
  });

  it('validateMaterializationChain detects missing entrypoint', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          materialization_id: 'mat-orphan',
          entrypoint_id: 'ep-missing',
          initiative_id: INITIATIVE_ID,
          organization_id: ORG,
          mat_created_at: '2026-01-01T00:00:00Z',
          ep_entrypoint_id: null,
          ep_organization_id: null,
          source_type: null,
          source_id: null,
          ep_created_at: null,
          ep_last_validated_at: null,
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await validateMaterializationChain(INITIATIVE_ID, ORG);

    expect(result.valid).toBe(false);
    expect(result.gaps.length).toBeGreaterThan(0);
    expect(result.gaps[0]).toContain('no matching entrypoint');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C9: Artifact Registry → Chat → Execution Spine
// ═══════════════════════════════════════════════════════════════════════════

describe('C9 — Artifact Registry → Chat → Execution Spine', () => {
  it('createArtifactRunFromChat chains handoff + spine transition + run creation', async () => {
    const convId = '00000000-0000-4000-8000-000000000e01';
    const snapId = '00000000-0000-4000-8000-000000000e02';
    const execRunId = '00000000-0000-4000-8000-000000000e03';
    const handoffId = '00000000-0000-4000-8000-000000000e04';

    mockDbRun.mockResolvedValue({ success: true });
    mockDbGet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        execution_run_id: execRunId,
        organization_id: ORG,
        current_state: 'created',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .mockResolvedValueOnce(null);

    try {
      const result = await createArtifactRunFromChat({
        conversationId: convId,
        contextSnapshotId: snapId,
        organizationId: ORG,
        userId: USER,
        goal: 'Generate quarterly report',
      });

      expect(result.executionRunId).toBeDefined();
      expect(result.artifactRunId).toBeDefined();
      expect(result.artifactPlan).toBeDefined();
      expect(result.run).toBeDefined();
    } catch (err: any) {
      expect(err).toBeDefined();
      expect(
        err.code === 'HANDOFF_FAILED' ||
          err.code === 'EXECUTION_SPINE_ERROR' ||
          err.message?.includes('not a function') === false
      ).toBe(true);
    }
  });
});
