/**
 * P10 Interview Insight Artifact — Canon contract tests
 *
 * Tests the frozen artifact structure, confidence semantics, evidence pointer
 * types, source loss rules, handoff payload, anti-duplicate gate, degraded
 * posture, and acceptance checklist from interviewInsightCanon.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  buildP10HandoffToInitiativesSkeleton,
  canPublishFinding,
  isValidP10ConfidenceLevel,
  isValidP10EvidencePointerType,
  P10_ACCEPTANCE_CHECKLIST,
  P10_ANTI_DUPLICATE_RULES,
  P10_ARTIFACT_RULE_NO_FINDING_WITHOUT_CONFIDENCE,
  P10_CONFIDENCE_LEVELS,
  P10_CONFIDENCE_SEMANTICS,
  P10_DEGRADED_SCENARIOS,
  P10_EVIDENCE_POINTER_TYPES,
  P10_EXTENDED_CONFIDENCE_LEVELS,
  P10_HANDOFF_TO_INITIATIVES,
  P10_INSIGHT_ARTIFACT_CONTRACT,
  P10_INSIGHT_ARTIFACT_STRUCTURE,
  P10_NO_OVERCLAIM_RULES,
  P10_SOURCE_LOSS_RULES,
} from '../../../services/v8/interviewInsightCanon.js';

describe('P10 Interview Insight Artifact Canon', () => {
  // ── Contract identity ──────────────────────────────────────────
  it('has a stable contract identifier', () => {
    expect(P10_INSIGHT_ARTIFACT_CONTRACT).toBe('interview_insight_artifact_v1');
  });

  // ── §2.3.1 Artifact structure ──────────────────────────────────
  describe('Artifact structure (§2.3.1)', () => {
    it('has frozen finding structure with required fields', () => {
      const finding = P10_INSIGHT_ARTIFACT_STRUCTURE.finding;
      expect(finding.required_fields).toContain('finding_statement');
      expect(finding.required_fields).toContain('evidence');
      expect(finding.required_fields).toContain('limits');
      expect(finding.required_fields).toContain('next_action');
      expect(finding.required_fields).toContain('confidence_level');
    });

    it('has evidence structure with required fields', () => {
      const evidence = P10_INSIGHT_ARTIFACT_STRUCTURE.evidence;
      expect(evidence.required_fields).toContain('pointers');
      expect(evidence.required_fields).toContain('summary');
    });

    it('has limits structure', () => {
      expect(P10_INSIGHT_ARTIFACT_STRUCTURE.limits.required_fields).toContain('description');
    });

    it('has next_action structure', () => {
      expect(P10_INSIGHT_ARTIFACT_STRUCTURE.next_action.required_fields).toContain('actions');
    });

    it('has artifact header with context, ownership, and summary', () => {
      const header = P10_INSIGHT_ARTIFACT_STRUCTURE.artifact_header;
      expect(header.required_fields).toContain('context');
      expect(header.required_fields).toContain('ownership');
      expect(header.required_fields).toContain('summary_bullets');
    });

    it('enforces no-finding-without-confidence rule', () => {
      expect(P10_ARTIFACT_RULE_NO_FINDING_WITHOUT_CONFIDENCE).toContain('confidence_level');
      expect(P10_ARTIFACT_RULE_NO_FINDING_WITHOUT_CONFIDENCE).toContain('limits');
    });
  });

  // ── §2.3.2 Confidence semantics ────────────────────────────────
  describe('Confidence semantics (§2.3.2)', () => {
    it('has exactly 5 core confidence levels', () => {
      expect(P10_CONFIDENCE_LEVELS).toHaveLength(5);
    });

    it('includes high, medium, low, insufficient, and contradicted', () => {
      expect(P10_CONFIDENCE_LEVELS).toContain('high');
      expect(P10_CONFIDENCE_LEVELS).toContain('medium');
      expect(P10_CONFIDENCE_LEVELS).toContain('low');
      expect(P10_CONFIDENCE_LEVELS).toContain('insufficient');
      expect(P10_CONFIDENCE_LEVELS).toContain('contradicted');
    });

    it('has extended levels including unknown and contradicted', () => {
      expect(P10_EXTENDED_CONFIDENCE_LEVELS).toContain('unknown');
      expect(P10_EXTENDED_CONFIDENCE_LEVELS).toContain('contradicted');
    });

    it('every core level has meaning, minimumEvidence, uiRule, and overclaim_guard', () => {
      for (const level of P10_CONFIDENCE_LEVELS) {
        const semantics = P10_CONFIDENCE_SEMANTICS[level];
        expect(semantics.meaning.length).toBeGreaterThan(0);
        expect(semantics.minimumEvidence.length).toBeGreaterThan(0);
        expect(semantics.uiRule.length).toBeGreaterThan(0);
        expect(semantics.overclaim_guard.length).toBeGreaterThan(0);
      }
    });

    // M03R-012: test żądał wcześniej "3+", podczas gdy kanon mówił "2+", a
    // `insightSignalBridgeService` liczył `>= 3` — trzy progi w jednym kontrakcie.
    // Decyzja Master Codex 2026-08-04 ustaliła próg 2+ z rozrzutem po źródłach;
    // test sprawdza teraz kanon ORAZ to, że `high` i `medium` są rozróżnialne
    // (wcześniej oba deklarowały samo "2+ pointers").
    it('high confidence requires 2+ pointers across different sources or clear triangulation', () => {
      const high = P10_CONFIDENCE_SEMANTICS.high.minimumEvidence;
      expect(high).toContain('2+');
      expect(high).toMatch(/different sources|materially different segments/);
      expect(high).toMatch(/triangulation/);
      expect(high).toMatch(/no unresolved material contradiction/i);
    });

    it('medium is materially weaker than high, not a restatement of it', () => {
      const high = P10_CONFIDENCE_SEMANTICS.high.minimumEvidence;
      const medium = P10_CONFIDENCE_SEMANTICS.medium.minimumEvidence;
      expect(medium).not.toEqual(high);
      expect(medium).toMatch(/single source\/segment|strong artifact/);
      expect(medium).toMatch(/no cross-source triangulation/i);
    });

    it('low confidence labels as "Hypothesis"', () => {
      expect(P10_CONFIDENCE_SEMANTICS.low.uiRule).toContain('Hypothesis');
    });

    it('insufficient confidence blocks publish', () => {
      expect(P10_CONFIDENCE_SEMANTICS.insufficient.uiRule).toContain('block');
    });

    it('isValidP10ConfidenceLevel accepts valid levels', () => {
      expect(isValidP10ConfidenceLevel('high')).toBe(true);
      expect(isValidP10ConfidenceLevel('medium')).toBe(true);
      expect(isValidP10ConfidenceLevel('low')).toBe(true);
      expect(isValidP10ConfidenceLevel('insufficient')).toBe(true);
      expect(isValidP10ConfidenceLevel('contradicted')).toBe(true);
    });

    it('isValidP10ConfidenceLevel rejects invalid levels', () => {
      expect(isValidP10ConfidenceLevel('very_high')).toBe(false);
      expect(isValidP10ConfidenceLevel('')).toBe(false);
      expect(isValidP10ConfidenceLevel('unknown')).toBe(false);
    });
  });

  // ── No-overclaim rules ─────────────────────────────────────────
  describe('No-overclaim rules', () => {
    it('has at least 3 no-overclaim rules', () => {
      expect(P10_NO_OVERCLAIM_RULES.length).toBeGreaterThanOrEqual(3);
    });

    it('forbids rendering findings as facts without confidence + limits', () => {
      const hasRule = P10_NO_OVERCLAIM_RULES.some((r) => r.includes('facts'));
      expect(hasRule).toBe(true);
    });

    it('restricts causality claims to high confidence only', () => {
      const hasRule = P10_NO_OVERCLAIM_RULES.some(
        (r) => r.includes('Causality') || r.includes('causality')
      );
      expect(hasRule).toBe(true);
    });
  });

  // ── §2.3.3 Evidence pointer types ──────────────────────────────
  describe('Evidence pointer types (§2.3.3)', () => {
    it('has exactly 7 evidence pointer types', () => {
      expect(P10_EVIDENCE_POINTER_TYPES).toHaveLength(7);
    });

    it('includes all required types per contract', () => {
      expect(P10_EVIDENCE_POINTER_TYPES).toContain('interview_session');
      expect(P10_EVIDENCE_POINTER_TYPES).toContain('question_answer');
      expect(P10_EVIDENCE_POINTER_TYPES).toContain('transcript_excerpt');
      expect(P10_EVIDENCE_POINTER_TYPES).toContain('survey_linkage');
      expect(P10_EVIDENCE_POINTER_TYPES).toContain('attachment');
      expect(P10_EVIDENCE_POINTER_TYPES).toContain('export_artifact');
      expect(P10_EVIDENCE_POINTER_TYPES).toContain('operator_note');
    });

    it('isValidP10EvidencePointerType validates correctly', () => {
      expect(isValidP10EvidencePointerType('interview_session')).toBe(true);
      expect(isValidP10EvidencePointerType('operator_note')).toBe(true);
      expect(isValidP10EvidencePointerType('random_type')).toBe(false);
    });
  });

  // ── §2.3.3 Source loss rules ───────────────────────────────────
  describe('Source loss prevention (§2.3.3)', () => {
    it('evidence set is append-only by default', () => {
      expect(P10_SOURCE_LOSS_RULES.append_only_default).toContain('append-only');
    });

    it('removal requires tombstone', () => {
      expect(P10_SOURCE_LOSS_RULES.removal_requires_tombstone).toContain('tombstone');
    });

    it('pointer stores source_ref, captured_at, and fingerprint', () => {
      const stores = P10_SOURCE_LOSS_RULES.pointer_stores;
      expect(stores.some((s) => s.includes('source_ref'))).toBe(true);
      expect(stores.some((s) => s.includes('captured_at'))).toBe(true);
      expect(stores.some((s) => s.includes('fingerprint'))).toBe(true);
    });

    it('editing finding does not remove pointers', () => {
      expect(P10_SOURCE_LOSS_RULES.edit_does_not_remove_pointers).toContain('NEVER');
    });

    it('broken references are preserved with "source unavailable" UI', () => {
      expect(P10_SOURCE_LOSS_RULES.broken_reference_handling).toContain('source unavailable');
    });
  });

  // ── §2.3.4 Handoff to Inicjatywy ──────────────────────────────
  describe('Handoff payload to Inicjatywy (§2.3.4)', () => {
    it('has 9 required fields', () => {
      expect(P10_HANDOFF_TO_INITIATIVES.required_fields).toHaveLength(9);
    });

    it('required fields include source IDs, finding, confidence, limits, evidence, next_action', () => {
      const req = P10_HANDOFF_TO_INITIATIVES.required_fields;
      expect(req).toContain('source_insight_artifact_id');
      expect(req).toContain('source_finding_id');
      expect(req).toContain('finding_statement');
      expect(req).toContain('confidence_level');
      expect(req).toContain('limits');
      expect(req).toContain('evidence_pointers');
      expect(req).toContain('next_action');
    });

    it('has optional fields for assumptions, tags, owner_suggestion', () => {
      const opt = P10_HANDOFF_TO_INITIATIVES.optional_fields;
      expect(opt).toContain('assumptions');
      expect(opt).toContain('tags');
      expect(opt).toContain('owner_suggestion');
    });

    it('rule enforces links-first context pack (max 5 links)', () => {
      expect(P10_HANDOFF_TO_INITIATIVES.rule).toContain('links-first');
      expect(P10_HANDOFF_TO_INITIATIVES.rule).toContain('max 5');
    });

    it('buildP10HandoffToInitiativesSkeleton produces valid structure', () => {
      const payload = buildP10HandoffToInitiativesSkeleton({
        insightArtifactId: 'ia-1',
        findingId: 'f-1',
        findingStatement: 'Users report slow onboarding',
        confidenceLevel: 'medium',
        limits: 'Based on 5 interviews from one department',
        nextAction: 'Investigate with broader sample',
        evidencePointers: [
          {
            pointerId: 'p-1',
            type: 'interview_session',
            sourceRef: 'session-1',
            capturedAt: '2026-03-01T10:00:00Z',
            sourceFingerprint: 'abc123',
            isTombstone: false,
          },
        ],
      });

      expect(payload.source_insight_artifact_id).toBe('ia-1');
      expect(payload.source_finding_id).toBe('f-1');
      expect(payload.confidence_level).toBe('medium');
      expect(payload.evidence_pointers).toHaveLength(1);
      expect(payload.source_insight_artifact_deep_link).toContain('ia-1');
      expect(payload.source_finding_deep_link).toContain('f-1');
    });
  });

  // ── §2.3.5 Anti-duplicate gate ─────────────────────────────────
  describe('Anti-duplicate gate (§2.3.5)', () => {
    it('states insight is not a collection engine', () => {
      expect(P10_ANTI_DUPLICATE_RULES.not_collection_engine).toContain('not an engine');
    });

    it('forbids parallel answer store', () => {
      expect(P10_ANTI_DUPLICATE_RULES.no_parallel_answer_store).toContain('parallel answer store');
    });

    it('enforces single handoff channel', () => {
      expect(P10_ANTI_DUPLICATE_RULES.single_handoff_channel).toContain('ONE channel');
    });

    it('forbids parallel initiative truth', () => {
      expect(P10_ANTI_DUPLICATE_RULES.no_parallel_initiative_truth).toContain('Forbidden');
    });

    it('requires dedupe key for evidence pointers', () => {
      expect(P10_ANTI_DUPLICATE_RULES.dedupe_pointers).toContain('dedupe key');
    });
  });

  // ── §2.3.6 Degraded posture ────────────────────────────────────
  describe('Degraded posture (§2.3.6)', () => {
    it('has at least 8 degraded scenarios (contract minimum)', () => {
      expect(P10_DEGRADED_SCENARIOS.length).toBeGreaterThanOrEqual(8);
    });

    it('has exactly 10 degraded scenarios', () => {
      expect(P10_DEGRADED_SCENARIOS).toHaveLength(10);
    });

    it('every scenario has id, scenario, degradedReason, userVisibleState, and nextAction', () => {
      for (const s of P10_DEGRADED_SCENARIOS) {
        expect(s.id).toBeGreaterThan(0);
        expect(s.scenario.length).toBeGreaterThan(0);
        expect(s.degradedReason.length).toBeGreaterThan(0);
        expect(s.userVisibleState.length).toBeGreaterThan(0);
        expect(s.nextAction.length).toBeGreaterThan(0);
      }
    });

    it('includes missing evidence scenario', () => {
      expect(
        P10_DEGRADED_SCENARIOS.find((s) => s.degradedReason === 'missing_evidence')
      ).toBeDefined();
    });

    it('includes broken pointer scenario', () => {
      expect(
        P10_DEGRADED_SCENARIOS.find((s) => s.degradedReason === 'broken_pointer')
      ).toBeDefined();
    });

    it('includes source drift scenario', () => {
      expect(P10_DEGRADED_SCENARIOS.find((s) => s.degradedReason === 'source_drift')).toBeDefined();
    });

    it('includes contradictory evidence scenario', () => {
      expect(
        P10_DEGRADED_SCENARIOS.find((s) => s.degradedReason === 'contradictory_evidence')
      ).toBeDefined();
    });

    it('includes redaction event scenario', () => {
      expect(
        P10_DEGRADED_SCENARIOS.find((s) => s.degradedReason === 'redaction_event')
      ).toBeDefined();
    });
  });

  // ── canPublishFinding ──────────────────────────────────────────
  describe('canPublishFinding', () => {
    it('blocks publish when confidence is insufficient', () => {
      const result = canPublishFinding({
        confidenceLevel: 'insufficient',
        evidencePointers: [{ isTombstone: false }],
        limits: 'Some limits',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Insufficient');
    });

    it('blocks publish when no active evidence pointers', () => {
      const result = canPublishFinding({
        confidenceLevel: 'medium',
        evidencePointers: [{ isTombstone: true }],
        limits: 'Some limits',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No active evidence');
    });

    it('blocks publish when limits are empty', () => {
      const result = canPublishFinding({
        confidenceLevel: 'high',
        evidencePointers: [{ isTombstone: false }],
        limits: '',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Limits are required');
    });

    it('allows publish when all conditions met', () => {
      const result = canPublishFinding({
        confidenceLevel: 'high',
        evidencePointers: [{ isTombstone: false }],
        limits: 'Based on limited sample',
      });
      expect(result.allowed).toBe(true);
    });

    it('rejects invalid confidence level', () => {
      const result = canPublishFinding({
        confidenceLevel: 'super_high',
        evidencePointers: [{ isTombstone: false }],
        limits: 'Some limits',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Invalid confidence');
    });
  });

  // ── §2.3.7 Acceptance checklist ────────────────────────────────
  describe('Acceptance checklist (§2.3.7)', () => {
    it('has exactly 12 acceptance items per contract', () => {
      expect(P10_ACCEPTANCE_CHECKLIST).toHaveLength(12);
    });

    it('every item has id, requirement, and section reference', () => {
      for (const item of P10_ACCEPTANCE_CHECKLIST) {
        expect(item.id).toBeGreaterThan(0);
        expect(item.requirement.length).toBeGreaterThan(0);
        expect(item.section.length).toBeGreaterThan(0);
      }
    });

    it('item 1 covers frozen artifact structure', () => {
      expect(P10_ACCEPTANCE_CHECKLIST[0].requirement).toContain('frozen structure');
    });

    it('item 4 covers 7 evidence pointer types', () => {
      expect(P10_ACCEPTANCE_CHECKLIST[3].requirement).toContain('7 types');
    });

    it('item 10 covers degraded posture with 8+ scenarios', () => {
      expect(P10_ACCEPTANCE_CHECKLIST[9].requirement).toContain('8 scenarios');
    });
  });
});
