/**
 * Unit tests for the real conversion materializer (Block D · D-S3).
 *
 * Verifies the replacement for the D-S1 `stubMaterializer`:
 *   - registers a real canonical artifact via `registerArtifactOrigin`,
 *   - maps document → report / presentation → presentation triples,
 *   - returns the canonical artifactId as artifactRunId + a real deep link,
 *   - propagates the origin summary (table id, record/field counts, etc.),
 *   - throws when the registry returns no artifactId (so the conversion
 *     lifecycle records a failure rather than a phantom success).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRegisterArtifactOrigin } = vi.hoisted(() => ({
  mockRegisterArtifactOrigin: vi.fn(),
}));

vi.mock('../../v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: (...a: unknown[]) => mockRegisterArtifactOrigin(...a),
}));
vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { realArtifactMaterializer } from '../conversionMaterializer.js';
import type { ConversionMaterializeRequest } from '../TableArtifactConversionService.js';

const baseReq = (
  overrides: Partial<ConversionMaterializeRequest> = {}
): ConversionMaterializeRequest => ({
  conversionId: 'conv-1',
  organizationId: 'org-A',
  workspaceId: 'ws-A',
  tableId: 'tbl-1',
  target: 'document',
  sourcePackId: null,
  title: 'Q3 Pipeline',
  outline: null,
  snapshot: {
    records: [
      {
        id: 'r1',
        data: {},
        confidenceScore: null,
        validationStatus: 'unverified',
        updatedAt: 'now',
      },
    ],
    fields: [{ id: 'f1', name: 'Name', fieldType: 'singleLineText' }],
    capturedAt: 'now',
    captureSource: 'table_conversion',
  },
  initiatedBy: 'user-1',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockRegisterArtifactOrigin.mockResolvedValue({ artifactId: 'art-123' });
});

describe('realArtifactMaterializer', () => {
  it('document target → report triple + /reports/builder deep link', async () => {
    const res = await realArtifactMaterializer.materialize(baseReq({ target: 'document' }));

    expect(mockRegisterArtifactOrigin).toHaveBeenCalledTimes(1);
    const params = mockRegisterArtifactOrigin.mock.calls[0]![0];
    expect(params).toMatchObject({
      organizationId: 'org-A',
      outputType: 'report',
      artifactFamily: 'document',
      originRuntime: 'report',
      originRecordId: 'table-conversion:conv-1',
      ownerUserId: 'user-1',
      createdBy: 'user-1',
    });
    expect(res.artifactRunId).toBe('art-123');
    expect(res.artifactDeepLink).toBe('/reports/builder/art-123');
  });

  it('presentation target → presentation triple + /presentations deep link', async () => {
    const res = await realArtifactMaterializer.materialize(baseReq({ target: 'presentation' }));

    const params = mockRegisterArtifactOrigin.mock.calls[0]![0];
    expect(params).toMatchObject({
      outputType: 'presentation',
      artifactFamily: 'presentation',
      originRuntime: 'presentation',
    });
    expect(res.artifactDeepLink).toBe('/presentations/art-123');
  });

  it('propagates origin summary with source provenance + counts', async () => {
    await realArtifactMaterializer.materialize(
      baseReq({ sourcePackId: 'pack-9', tableId: 'tbl-xyz' })
    );
    const params = mockRegisterArtifactOrigin.mock.calls[0]![0];
    expect(params.originSummary).toMatchObject({
      sourceRuntime: 'tabele',
      sourceTableId: 'tbl-xyz',
      sourcePackId: 'pack-9',
      conversionId: 'conv-1',
      target: 'document',
      recordCount: 1,
      fieldCount: 1,
    });
  });

  it('falls back to a generated title when none is supplied', async () => {
    await realArtifactMaterializer.materialize(baseReq({ title: null, target: 'presentation' }));
    const params = mockRegisterArtifactOrigin.mock.calls[0]![0];
    expect(params.titleSnapshot).toBe('Table export (presentation)');
  });

  it('throws when the registry returns no artifactId', async () => {
    mockRegisterArtifactOrigin.mockResolvedValueOnce(null);
    await expect(realArtifactMaterializer.materialize(baseReq())).rejects.toThrow(/no artifactId/i);
  });
});
