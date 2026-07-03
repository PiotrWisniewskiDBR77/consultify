/**
 * H3.3/4/5 — round-trip e2e per framework (DRD / SIRI / ADMA).
 *
 * Ścieżka: sesja (load/init) → preset metodologii → evidence → score-proposal
 * → score-review → interpretacja → review → complete → promotion → ODCZYT
 * zapisanego stanu (p28_workbench_v1) + payload promocji.
 *
 * Anty-false-green:
 * - asercje na KONKRETNE wartości score zapisane do DB (deep-equal na
 *   sparsowanym p28_workbench_v1), nie na sam brak błędu;
 * - `applyMethodologyPreset(<framework>)` — na kodzie sprzed fixu
 *   (P28_METHODOLOGY_PRESETS tylko DRD) testy SIRI/ADMA padają z
 *   P28_PRESET_UNKNOWN;
 * - asercja, że promotion do Outputs realnie woła registerArtifactOrigin
 *   z originRecordId = assessmentId (nie tylko status w stanie).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AssessmentWorkbenchService, {
  buildBoundedPromotionPayload,
  P28_METHODOLOGY_PRESETS,
} from '../AssessmentWorkbenchService.js';

const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();
const mockRegisterArtifactOrigin = vi.fn();
const mockAddFinding = vi.fn();

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
  queryAll: vi.fn(),
}));

vi.mock('../../v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: (...args: unknown[]) => mockRegisterArtifactOrigin(...args),
}));

vi.mock('../../v8/interviewInsightFindingsService.js', () => ({
  addFinding: (...args: unknown[]) => mockAddFinding(...args),
}));

type Framework = {
  type: 'DRD' | 'SIRI' | 'ADMA';
  scoreValues: Record<string, number>;
};

const FRAMEWORKS: Framework[] = [
  { type: 'DRD', scoreValues: { governance: 3, process: 2 } },
  { type: 'SIRI', scoreValues: { vertical_integration: 4, shop_floor_automation: 2 } },
  { type: 'ADMA', scoreValues: { advanced_manufacturing_technologies: 3, digital_factory: 4 } },
];

describe.each(FRAMEWORKS)(
  'AssessmentWorkbenchService — round-trip e2e ($type)',
  ({ type, scoreValues }) => {
    const orgId = `org-rt-${type.toLowerCase()}`;
    const assessmentId = `asmt-rt-${type.toLowerCase()}`;
    const userId = 'user-rt';

    let p28Column: string | null = null;
    let definitionRow: Record<string, unknown> | null = null;

    beforeEach(() => {
      p28Column = null;
      definitionRow = null;
      vi.clearAllMocks();
      mockRegisterArtifactOrigin.mockResolvedValue(undefined);
      mockAddFinding.mockResolvedValue(undefined);

      mockQueryOne.mockImplementation(async (sql: string, params: unknown[]) => {
        if (String(sql).includes('FROM assessment_definitions')) {
          if (!definitionRow) return null;
          if (String(sql).includes('WHERE id = ?')) {
            return params[0] === definitionRow.id ? definitionRow : null;
          }
          return definitionRow;
        }
        if (
          String(sql).includes('FROM assessments WHERE id = ?') &&
          String(sql).includes('p28_workbench_v1')
        ) {
          const [id, oid] = params as string[];
          if (id !== assessmentId || oid !== orgId) return null;
          return { p28: p28Column, assessment_type: type, created_by: userId };
        }
        if (String(sql).includes('SELECT assessment_type, created_by FROM assessments')) {
          const [id, oid] = params as string[];
          if (id !== assessmentId || oid !== orgId) return null;
          return { assessment_type: type, created_by: userId };
        }
        return null;
      });

      mockQueryRun.mockImplementation(async (sql: string, params: unknown[]) => {
        if (String(sql).includes('INSERT OR IGNORE INTO assessment_definitions')) {
          definitionRow = {
            id: params[0],
            methodology_id: params[1],
            version: params[2],
            title: params[3],
            definition_json: params[4],
            created_by: params[5],
            created_at: params[6],
            updated_at: params[7],
            published_at: params[8],
            status: 'published',
            is_read_only: 1,
          };
          return;
        }
        if (String(sql).includes('p28_workbench_v1')) {
          p28Column = params[0] as string;
        }
      });
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it(`${type}: preset istnieje i wymaga evidence (nie pusty)`, () => {
      const preset = P28_METHODOLOGY_PRESETS[type];
      expect(preset, `Brak presetu ${type} w P28_METHODOLOGY_PRESETS`).toBeTruthy();
      expect(preset.requiredEvidenceKinds.length).toBeGreaterThan(0);
    });

    it(`${type}: sesja → scoring → zapis → odczyt (pełny round-trip z dokładnym score)`, async () => {
      // 1. Sesja: init workbench dla frameworka — definicja bootstrapuje się per methodology.
      const initial = await AssessmentWorkbenchService.load(assessmentId, orgId, type, userId);
      expect(initial.assessmentDefinitionRef.methodologyId).toBe(type);
      expect(definitionRow?.methodology_id).toBe(type);
      expect(definitionRow?.status).toBe('published');

      // 2. Preset metodologii — na kodzie sprzed fixu SIRI/ADMA rzuca P28_PRESET_UNKNOWN.
      const afterPreset = await AssessmentWorkbenchService.applyMethodologyPreset(
        assessmentId,
        orgId,
        userId,
        type
      );
      expect(afterPreset.requiredEvidenceKinds).toEqual(
        P28_METHODOLOGY_PRESETS[type].requiredEvidenceKinds
      );

      await AssessmentWorkbenchService.transition(assessmentId, orgId, userId, 'running');

      // 3. Evidence — pokrywamy wszystkie wymagane kinds presetu.
      const pointers = P28_METHODOLOGY_PRESETS[type].requiredEvidenceKinds.map((kind, i) => ({
        kind,
        ref: `${kind}:${type.toLowerCase()}-${i}`,
      }));
      await AssessmentWorkbenchService.addEvidence(assessmentId, orgId, userId, pointers);

      const withEvidence = JSON.parse(p28Column!);
      const evidenceIds: string[] = withEvidence.evidencePointers.map(
        (e: { id: string }) => e.id
      );
      expect(evidenceIds.length).toBe(pointers.length);

      // 4. Scoring: konkretne wartości per framework.
      await AssessmentWorkbenchService.proposeScore(assessmentId, orgId, userId, {
        scoreValues,
        scoringRationale: `Scores grounded in ${type} evidence`,
        evidencePointerIds: evidenceIds,
        assumptions: [],
        confidence: 0.81,
      });

      // Zapis: dokładne wartości w DB (kolumna p28_workbench_v1), nie tylko "coś jest".
      const persisted = JSON.parse(p28Column!);
      expect(persisted.runState).toBe('score_proposed');
      expect(persisted.scoreProposal.scoreValues).toEqual(scoreValues);
      expect(persisted.scoreProposal.confidence).toBe(0.81);

      // 5. Review + interpretacja + complete.
      await AssessmentWorkbenchService.reviewScore(assessmentId, orgId, userId, {
        action: 'accept',
      });
      await AssessmentWorkbenchService.proposeInterpretation(assessmentId, orgId, userId, {
        summary: `${type} maturity is moderate`,
        keyFindings: [`${type} gap: integration`],
        limits: 'Single snapshot; bounded assessment.',
        nextActions: ['Plan initiatives'],
      });
      await AssessmentWorkbenchService.reviewInterpretation(assessmentId, orgId, userId, {
        action: 'accept',
      });
      await AssessmentWorkbenchService.transition(assessmentId, orgId, userId, 'completed');

      // 6. Promotion do Outputs — realny handoff (registerArtifactOrigin).
      await AssessmentWorkbenchService.recordPromotion(assessmentId, orgId, userId, {
        targetKind: 'outputs_artifact',
        targetRef: `artifact:report:${type.toLowerCase()}-1`,
      });
      expect(mockRegisterArtifactOrigin).toHaveBeenCalledTimes(1);
      const originArg = mockRegisterArtifactOrigin.mock.calls[0][0] as Record<string, unknown>;
      expect(originArg.originRecordId).toBe(assessmentId);
      expect(originArg.organizationId).toBe(orgId);

      // 7. ODCZYT: świeży load z DB widzi completed + dokładny score + trace.
      const readBack = await AssessmentWorkbenchService.load(assessmentId, orgId, type, userId);
      expect(readBack.runState).toBe('completed');
      expect(readBack.scoreProposal?.scoreValues).toEqual(scoreValues);
      expect(readBack.scoreReview?.status).toBe('accepted');
      expect(readBack.assessmentDefinitionRef.methodologyId).toBe(type);
      expect(readBack.promotionTraces).toHaveLength(1);
      expect(readBack.promotionTraces[0].targetRef).toBe(
        `artifact:report:${type.toLowerCase()}-1`
      );

      // 8. Payload promocji niesie dokładny score (kontrakt downstream).
      const payload = buildBoundedPromotionPayload(readBack) as {
        score_outcome: { scoreValues: Record<string, number> };
        methodology_id: string;
      };
      expect(payload.methodology_id).toBe(type);
      expect(payload.score_outcome.scoreValues).toEqual(scoreValues);
    });

    it(`${type}: scoring bez wymaganego evidence jest blokowany (no-silent-scoring)`, async () => {
      await AssessmentWorkbenchService.load(assessmentId, orgId, type, userId);
      await AssessmentWorkbenchService.applyMethodologyPreset(assessmentId, orgId, userId, type);
      await AssessmentWorkbenchService.transition(assessmentId, orgId, userId, 'running');

      let blocked: any;
      try {
        await AssessmentWorkbenchService.proposeScore(assessmentId, orgId, userId, {
          scoreValues,
          scoringRationale: 'No evidence attached',
          evidencePointerIds: [],
          assumptions: [],
          confidence: 0.5,
        });
      } catch (e) {
        blocked = e;
      }
      expect(blocked?.code).toBe('P28_AWAITING_EVIDENCE');
      const afterBlock = JSON.parse(p28Column!);
      expect(afterBlock.runState).toBe('awaiting_evidence');
      expect(afterBlock.scoreProposal).toBeNull();
    });
  }
);
