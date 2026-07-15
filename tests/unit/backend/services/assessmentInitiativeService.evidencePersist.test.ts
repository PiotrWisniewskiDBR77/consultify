// @vitest-environment node
/**
 * HP-17 bridge (follow-up, fala 11b) — `AssessmentInitiativeService.persistInitiatives`
 * must persist the inline HP-16 `EvidenceContract` (`buildInitiativeEvidenceContract`,
 * computed per generated initiative) as an `EvidenceEnvelope` via
 * `evidenceContractBridge.safePersistEvidenceContract` (artifactType='initiative').
 * Before this bridge, the contract was computed and returned on `created[].evidence`
 * but never written to `artifact_evidence` — the evidence panel (fala 9,
 * ArtifactRightPanel) showed an empty state for initiatives despite the engine
 * having real data (same gap as deck/canvas/document, closed in fala 11a).
 *
 * Mocks `evidenceContractBridge.js` (statically imported by
 * assessmentInitiativeService.ts) directly rather than the deeper
 * `evidenceEnvelopeService.js` — the bridge's own mapping/persist behaviour is
 * already covered by `tests/unit/backend/services/evidence/evidenceContractBridge.test.ts`;
 * this file only proves the SERVICE calls it with the right artifactType/artifactId
 * per initiative. (Mocking the dynamic-import boundary inside the bridge is flaky
 * under concurrent fire-and-forget calls in the same tick — a Vitest/vite-node
 * dynamic-import-mock interaction, not a production bug: verified independently
 * against the real bridge + a stubbed DB layer, where every concurrent call
 * executes and persists correctly.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryRun: vi.fn().mockResolvedValue({ lastID: 1, changes: 1 }),
  queryOne: vi.fn().mockResolvedValue(null),
  queryAll: vi.fn().mockResolvedValue([]),
  getTableColumns: vi.fn().mockResolvedValue(null),
}));

// Incrementing (never-exhausted) mock — a fixed `mockReturnValueOnce` chain would run out
// after the first test (each initiative consumes 2 calls: initiative id + link id) and start
// colliding on the fallback value across tests.
let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: vi.fn(() => `test-uuid-${++uuidCounter}`),
}));

const safePersistEvidenceContract = vi.fn().mockResolvedValue(true);
vi.mock('../../../../server/src/services/evidence/evidenceContractBridge.js', () => ({
  safePersistEvidenceContract: (...args: unknown[]) =>
    safePersistEvidenceContract(...(args as [never])),
  default: { safePersistEvidenceContract },
}));

const loggerMock = { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() };
vi.mock('../../../../server/src/utils/Logger.js', () => ({ default: loggerMock }));

const { default: AssessmentInitiativeService } = await import(
  '../../../../server/src/services/assessmentInitiativeService.js'
);

describe('AssessmentInitiativeService.persistInitiatives — HP-17 evidence persist', () => {
  const testOrgId = 'org-hp17-initiative';
  const testUserId = 'user-hp17-initiative';

  const mockAssessment = {
    id: 'assessment-hp17-1',
    organization_id: testOrgId,
    project_id: null,
    assessment_type: 'DRD' as const,
    name: 'Digital Readiness Assessment',
    status: 'completed',
    completion_percent: 100,
    confidence_avg: 4,
    answers_json: JSON.stringify({ dimension_1: { score: 2.5 } }),
    score_summary: JSON.stringify({
      dimension_1: { score: 2.5, name: 'Data Management' },
    }),
  };

  beforeEach(() => {
    safePersistEvidenceContract.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    safePersistEvidenceContract.mockResolvedValue(true);
  });

  it('persists the initiative EvidenceContract as an EvidenceEnvelope (artifactType=initiative)', async () => {
    const initiatives = [
      {
        title: 'Zamknij lukę w governance danych',
        description: 'Opis inicjatywy',
        category: 'digital_transformation',
        priority: 'high' as const,
        risk: 'medium' as const,
        relatedAxis: 'dimension_1',
      },
    ];

    const result = await AssessmentInitiativeService.persistInitiatives({
      assessment: mockAssessment,
      batchId: 'batch-hp17-1',
      initiatives,
      userId: testUserId,
    });

    expect(result.length).toBe(1);
    expect(result[0].evidence).toBeDefined();
    expect(result[0].evidence.sources.length).toBeGreaterThan(0);

    await vi.waitFor(() => expect(safePersistEvidenceContract).toHaveBeenCalledTimes(1));
    const [evidence, meta] = safePersistEvidenceContract.mock.calls[0];
    expect(evidence).toEqual(result[0].evidence);
    expect(meta.artifactType).toBe('initiative');
    expect(meta.artifactId).toBe(result[0].id);
    expect(meta.organizationId).toBe(testOrgId);
    expect(meta.createdBy).toBe(testUserId);
    expect(meta.service).toBe('assessmentInitiativeService');
  });

  it('persists one envelope per generated initiative, each with its own artifactId', async () => {
    const initiatives = [
      {
        title: 'Initiative A',
        description: 'Desc A',
        category: 'process_automation',
        priority: 'medium' as const,
        risk: 'low' as const,
      },
      {
        title: 'Initiative B',
        description: 'Desc B',
        category: 'ai_readiness',
        priority: 'high' as const,
        risk: 'high' as const,
      },
    ];

    const result = await AssessmentInitiativeService.persistInitiatives({
      assessment: mockAssessment,
      batchId: 'batch-hp17-2',
      initiatives,
      userId: testUserId,
    });

    expect(result.length).toBe(2);
    await vi.waitFor(() => expect(safePersistEvidenceContract).toHaveBeenCalledTimes(2));
    const persistedIds = safePersistEvidenceContract.mock.calls.map((c) => c[1].artifactId);
    expect(persistedIds).toEqual(result.map((r) => r.id));
    expect(new Set(persistedIds).size).toBe(2);
  });

  it('does not persist anything for an empty initiatives array', async () => {
    const result = await AssessmentInitiativeService.persistInitiatives({
      assessment: mockAssessment,
      batchId: 'batch-hp17-empty',
      initiatives: [],
      userId: testUserId,
    });

    expect(result).toEqual([]);
    expect(safePersistEvidenceContract).not.toHaveBeenCalled();
  });

  it('a persist failure never throws or blocks initiative creation (fail-safe)', async () => {
    safePersistEvidenceContract.mockRejectedValueOnce(new Error('db unavailable'));

    const initiatives = [
      {
        title: 'Resilient Initiative',
        description: 'Should still be created even if evidence persist fails',
        category: 'digital_transformation',
        priority: 'medium' as const,
        risk: 'low' as const,
      },
    ];

    const result = await AssessmentInitiativeService.persistInitiatives({
      assessment: mockAssessment,
      batchId: 'batch-hp17-fail',
      initiatives,
      userId: testUserId,
    });

    expect(result.length).toBe(1);
    await vi.waitFor(() => expect(safePersistEvidenceContract).toHaveBeenCalledTimes(1));
  });
});
