// @vitest-environment node
/**
 * HP-17 bridge (follow-up, fala 11b) — the V6 interview-insight generator now
 * builds an HP-14/16 `EvidenceContract` (`buildInterviewInsightEvidenceContract`)
 * from the FINAL V6 payload + material quality, and `generateInsight` persists it
 * as an `EvidenceEnvelope` (`artifact_evidence`, artifactType='insight') via
 * `evidenceContractBridge.safePersistEvidenceContract`. Before this, the V6 insight
 * had its own evidence-ref validation but no EvidenceContract was ever computed or
 * persisted for it — the evidence panel (fala 9, ArtifactRightPanel) showed an
 * empty state for insights despite the engine having real evidence_map/themes/
 * issues/opportunities data (same gap as deck/canvas/document closed in fala 11a,
 * and initiative closed alongside this change).
 *
 * This suite tests the PURE, deterministic builder (`buildInterviewInsightEvidenceContract`)
 * that feeds the persist — it exercises the real V6→EvidenceContract mapping and the
 * confidence derivation from real signals (source count / material score / gap count).
 * The persist itself is a one-line fire-and-forget of `safePersistEvidenceContract`,
 * whose mapping+write behaviour is already covered by
 * `tests/unit/backend/services/evidence/evidenceContractBridge.test.ts`.
 */
import { describe, expect, it } from 'vitest';

import {
  buildInterviewInsightEvidenceContract,
  type InsightMaterialQuality,
  type ParsedInsightGenerationData,
} from '../../../../server/src/services/InterviewInsightService.js';
import { mapEvidenceContractToEnvelopeInput } from '../../../../server/src/services/evidence/evidenceContractBridge.js';

function materialQuality(overrides: Partial<InsightMaterialQuality> = {}): InsightMaterialQuality {
  return {
    overall_material_score: 82,
    answer_quality_posture: 'strong',
    coverage_posture: 'good_coverage',
    approved_session_count: 3,
    respondent_count: 3,
    role_coverage: ['CFO', 'COO', 'Head of Ops'],
    department_coverage: ['Finance', 'Operations'],
    thin_answer_count: 0,
    missing_voices: [],
    evidence_gap_count: 0,
    contradiction_count: 0,
    confidence_downgrade_required: false,
    recommendation_posture: 'decision_ready',
    limitations: [],
    recommended_followups: [],
    ...overrides,
  };
}

function v6(overrides: Partial<ParsedInsightGenerationData> = {}): ParsedInsightGenerationData {
  return {
    executive_summary: 'Zespół zgłasza wąskie gardło w cyklu zatwierdzania zapytań.',
    themes: [
      { title: 'Cykl zatwierdzania', description: 'd', evidence_refs: ['ans-1', 'ans-2'], strength: 'strong' },
    ],
    issues: [
      { title: 'Ręczne przekazania', description: 'd', severity: 'high', evidence_refs: ['ans-2', 'ans-3'] },
    ],
    opportunities: [
      { title: 'Automatyzacja', description: 'd', impact: 'high', evidence_refs: ['ans-3'] },
    ],
    signals: [],
    evidence_map: [
      { answer_id: 'ans-1', question_text: 'q', answer_snippet: '40h/mies.', linked_themes: [], linked_issues: [] },
      { answer_id: 'ans-2', question_text: 'q', answer_snippet: 'ręcznie', linked_themes: [], linked_issues: [] },
      { answer_id: 'ans-3', question_text: 'q', answer_snippet: 'brak narzędzia', linked_themes: [], linked_issues: [] },
    ],
    missing_data: [],
    ...overrides,
  };
}

describe('buildInterviewInsightEvidenceContract — HP-17 evidence contract for V6 insights', () => {
  it('collects unique answer_ids (evidence_map + evidence_refs) as sources with snippets', () => {
    const contract = buildInterviewInsightEvidenceContract(v6(), materialQuality());

    const refs = contract.sources.map((s) => s.ref).sort();
    expect(refs).toEqual(['ans-1', 'ans-2', 'ans-3']);
    expect(contract.sources.every((s) => s.type === 'interview')).toBe(true);
    // snippet carried across from evidence_map
    expect(contract.sources.find((s) => s.ref === 'ans-1')?.snippet).toBe('40h/mies.');
  });

  it("derives 'high' confidence from >=3 sources, high material score, zero gaps", () => {
    const contract = buildInterviewInsightEvidenceContract(v6(), materialQuality());
    expect(contract.confidence).toBe('high');
  });

  it('folds limitations, single_perspective coverage and missing voices into risks', () => {
    const contract = buildInterviewInsightEvidenceContract(
      v6(),
      materialQuality({
        coverage_posture: 'single_perspective',
        limitations: ['Tylko jeden respondent z Finansów'],
        missing_voices: ['IT'],
      })
    );

    expect(contract.risks).toContain('Tylko jeden respondent z Finansów');
    expect(contract.risks.some((r) => r.includes('jednoosobowe'))).toBe(true);
    expect(contract.risks).toContain('Brak głosu: IT');
  });

  it('folds missing_data and recommended_followups into toVerify', () => {
    const contract = buildInterviewInsightEvidenceContract(
      v6({ missing_data: ['Brak danych o kosztach jednostkowych'] }),
      materialQuality({ recommended_followups: ['Potwierdź baseline z kontrolingiem'] })
    );

    expect(contract.toVerify).toContain('Brak danych o kosztach jednostkowych');
    expect(contract.toVerify).toContain('Potwierdź baseline z kontrolingiem');
  });

  it("with zero sources yields 'low' confidence (Deklaracja—niepotwierdzone)", () => {
    const contract = buildInterviewInsightEvidenceContract(
      v6({ themes: [], issues: [], opportunities: [], evidence_map: [] }),
      materialQuality({ overall_material_score: 20 })
    );

    expect(contract.sources).toEqual([]);
    expect(contract.confidence).toBe('low');
  });

  it('maps cleanly onto the envelope input shape for persistence (artifactType=insight)', () => {
    const contract = buildInterviewInsightEvidenceContract(v6(), materialQuality());
    const input = mapEvidenceContractToEnvelopeInput(contract, {
      organizationId: 'org-1',
      artifactType: 'insight',
      artifactId: 'insight-1',
      service: 'InterviewInsightService',
      createdBy: 'user-1',
    });

    expect(input.artifactType).toBe('insight');
    expect(input.artifactId).toBe('insight-1');
    expect(input.sources).toHaveLength(3);
    // 'high' label -> confidenceToNumeric -> 0.85
    expect(input.confidence).toBe(0.85);
    expect(input.computedBy?.service).toBe('InterviewInsightService');
  });
});
