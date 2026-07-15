// @vitest-environment node
/**
 * HP-17 bridge — `materializeDocumentArtifact` must persist the inline HP-16
 * `EvidenceContract` (`buildDocumentEvidenceContract`, computed on
 * `finalSchema.evidence`) as an `EvidenceEnvelope` via `evidenceEnvelopeService.
 * upsertEnvelope` (artifactType='document'). Before this bridge, the contract
 * rode along on the returned schema but was never written to
 * `artifact_evidence` — the evidence panel (fala 9, ArtifactRightPanel) showed
 * an empty state for documents despite the engine having real data.
 *
 * Same minimal-mock harness as `documentStudioService.manualContentSave.test.ts`
 * (only `wave5ArtifactRuntimeService` is stubbed) plus a mock for
 * `evidenceEnvelopeService.js` — `documentContentGenerator.buildDocumentSchema`
 * runs FOR REAL so `finalSchema.evidence` is a genuine HP-16 contract, and the
 * real (unmocked) `evidenceContractBridge.ts` maps + persists it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentIntake, DocumentOutline } from '../../../../../server/src/services/documentStudio/documentStudioTypes.js';

const ORG = 'org-doc-hp17';
const USER = 'user-doc-hp17';

const createWave5ArtifactMock = vi.fn(async (params: { artifactType: string; organizationId: string }) => ({
  artifactId: 'doc-artifact-hp17-1',
  artifact_id: 'doc-artifact-hp17-1',
  organization_id: params.organizationId,
}));

vi.mock('../../../../../server/src/services/wave5ArtifactRuntimeService.js', () => ({
  createWave5Artifact: (...args: unknown[]) => createWave5ArtifactMock(...(args as [never])),
  getWave5Artifact: vi.fn(async () => null),
  buildWave5ExportManifest: vi.fn(async () => ({})),
  markWave5ArtifactExported: vi.fn(async () => {}),
}));

const upsertEnvelope = vi.fn().mockResolvedValue({ id: 'envelope-1' });
vi.mock('../../../../../server/src/services/evidence/evidenceEnvelopeService.js', () => ({
  default: { upsertEnvelope, getEnvelope: vi.fn().mockResolvedValue(null) },
  upsertEnvelope,
  getEnvelope: vi.fn().mockResolvedValue(null),
}));

const loggerMock = { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() };
vi.mock('../../../../../server/src/utils/Logger.js', () => ({ default: loggerMock }));

const { materializeDocumentArtifact } = await import(
  '../../../../../server/src/services/documentStudio/documentStudioService.js'
);

const INTAKE: DocumentIntake = {
  title: 'HP-17 test document',
  description: 'A short test document used to prove the evidence-persist bridge.',
  documentType: 'executive_memo',
  language: 'pl',
  goal: 'inform',
};

const OUTLINE: DocumentOutline = {
  documentType: 'executive_memo',
  title: 'HP-17 test document',
  sections: [
    { title: 'Wstęp', level: 1, purpose: 'intro', expectedLengthHint: 'short' },
  ],
  recommendedDensity: 'standard',
  recommendedRegister: 'professional',
  recommendedLanguageStyle: 'formal',
};

describe('materializeDocumentArtifact — HP-17 evidence persist', () => {
  beforeEach(() => {
    createWave5ArtifactMock.mockClear();
    upsertEnvelope.mockClear();
  });

  it('persists the document EvidenceContract as an EvidenceEnvelope (artifactType=document)', async () => {
    const result = await materializeDocumentArtifact({
      organizationId: ORG,
      userId: USER,
      intake: INTAKE,
      outline: OUTLINE,
      sourceRefs: [{ sourceType: 'kb', sourceId: 'kb-1', sourceTitle: 'Playbook excerpt' }],
    });

    expect(result.schema.evidence).toBeDefined();
    await vi.waitFor(() => expect(upsertEnvelope).toHaveBeenCalledTimes(1));
    const input = upsertEnvelope.mock.calls[0][0];
    expect(input.artifactType).toBe('document');
    expect(input.artifactId).toBe('doc-artifact-hp17-1');
    expect(input.organizationId).toBe(ORG);
    expect(input.createdBy).toBe(USER);
    expect(input.computedBy.service).toBe('documentContentGenerator');
    // 1 real source ref, 0 assumption blocks (source present) -> 'medium' -> 0.55
    expect(input.confidence).toBe(0.55);
  });

  it('with zero source refs, still persists but at low confidence (0.25) — "Deklaracja—niepotwierdzone"', async () => {
    const result = await materializeDocumentArtifact({
      organizationId: ORG,
      userId: USER,
      intake: INTAKE,
      outline: OUTLINE,
      sourceRefs: [],
    });

    expect(result.schema.evidence?.toVerify.length).toBeGreaterThan(0);
    await vi.waitFor(() => expect(upsertEnvelope).toHaveBeenCalledTimes(1));
    const input = upsertEnvelope.mock.calls[0][0];
    expect(input.artifactType).toBe('document');
    expect(input.confidence).toBe(0.25);
    expect(input.toVerify.length).toBeGreaterThan(0);
  });
});
