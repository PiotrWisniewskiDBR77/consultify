// @vitest-environment node
/**
 * MAT-010 — `materializeDocumentArtifact` must not fabricate success when the
 * underlying `wave5_artifacts` write fails.
 *
 * `createWave5Artifact` (wave5ArtifactRuntimeService.ts) returns
 * `getWave5Artifact(...)` — a fresh SELECT — so it resolves `null` whenever
 * the primary `dbRun` INSERT silently failed (`DbPromise.run()`'s default
 * `fallback:true` resolves `{success:false}` instead of throwing; same bug
 * class as MAT-010's G8 presentation-deck fix). Before this fix,
 * `materializeDocumentArtifact` did
 * `String(artifact?.artifactId ?? artifact?.artifact_id ?? provisionalArtifactId)`
 * — silently falling back to a locally-generated id and returning a
 * successful-looking `DocumentRunResult` for an artifact that was never
 * written to `wave5_artifacts`, MAT-010's own tracked Document owner table.
 *
 * Same minimal-mock harness as `documentStudioService.evidencePersist.test.ts`
 * — only `wave5ArtifactRuntimeService` is stubbed, `createWave5Artifact`
 * mocked to resolve `null` (the exact "insert failed" signal), everything
 * else (outline planning, schema building, evidence bridge) runs for real
 * with `useLlm` omitted (default false, so no LLM call is reachable —
 * satisfies "mock only the external LLM boundary").
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  DocumentIntake,
  DocumentOutline,
} from '../../../../../server/src/services/documentStudio/documentStudioTypes.js';

const ORG = 'org-doc-wave5fail';
const USER = 'user-doc-wave5fail';

const createWave5ArtifactMock = vi.fn(async () => null);
const getWave5ArtifactMock = vi.fn(async () => null);

vi.mock('../../../../../server/src/services/wave5ArtifactRuntimeService.js', () => ({
  createWave5Artifact: (...args: unknown[]) => createWave5ArtifactMock(...(args as [never])),
  getWave5Artifact: (...args: unknown[]) => getWave5ArtifactMock(...(args as [never])),
  buildWave5ExportManifest: vi.fn(async () => ({})),
  markWave5ArtifactExported: vi.fn(async () => {}),
}));

vi.mock('../../../../../server/src/services/evidence/evidenceEnvelopeService.js', () => ({
  default: { upsertEnvelope: vi.fn().mockResolvedValue({ id: 'unused' }), getEnvelope: vi.fn().mockResolvedValue(null) },
  upsertEnvelope: vi.fn().mockResolvedValue({ id: 'unused' }),
  getEnvelope: vi.fn().mockResolvedValue(null),
}));

const loggerMock = { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() };
vi.mock('../../../../../server/src/utils/Logger.js', () => ({ default: loggerMock }));

const { materializeDocumentArtifact } = await import(
  '../../../../../server/src/services/documentStudio/documentStudioService.js'
);

const INTAKE: DocumentIntake = {
  title: 'MAT-010 wave5 failure test document',
  description: 'A short test document used to prove the wave5-write-failure guard.',
  documentType: 'executive_memo',
  language: 'pl',
  goal: 'inform',
};

const OUTLINE: DocumentOutline = {
  documentType: 'executive_memo',
  title: 'MAT-010 wave5 failure test document',
  sections: [{ title: 'Wstęp', level: 1, purpose: 'intro', expectedLengthHint: 'short' }],
  recommendedDensity: 'standard',
  recommendedRegister: 'professional',
  recommendedLanguageStyle: 'formal',
};

describe('materializeDocumentArtifact — wave5_artifacts write-failure guard (MAT-010)', () => {
  beforeEach(() => {
    createWave5ArtifactMock.mockClear();
    getWave5ArtifactMock.mockClear();
  });

  it('throws instead of returning a fabricated artifactId when createWave5Artifact resolves null', async () => {
    await expect(
      materializeDocumentArtifact({
        organizationId: ORG,
        userId: USER,
        intake: INTAKE,
        outline: OUTLINE,
        sourceRefs: [],
      })
    ).rejects.toThrow(/wave5_artifacts write did not succeed/);

    expect(createWave5ArtifactMock).toHaveBeenCalledTimes(1);
  });
});
