import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbAll = vi.fn();
const mockDbGet = vi.fn();
const mockDbRun = vi.fn();
const uuidState = vi.hoisted(() => ({ value: 0 }));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => {
    uuidState.value += 1;
    return `uuid-${uuidState.value}`;
  }),
}));

describe('ORG-001 immutable Organization context publication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidState.value = 0;
    mockDbAll.mockResolvedValue([]);
    mockDbGet.mockResolvedValue(null);
    mockDbRun.mockResolvedValue({ changes: 1 });
  });

  it('records document claims as proposals without publishing mutable context', async () => {
    const { organizationContextService } =
      await import('../../../../server/src/services/organizationContext/OrganizationContextService.js');
    const rebuild = vi.spyOn(organizationContextService, 'rebuildSnapshot').mockResolvedValue();

    await organizationContextService.recordAttachmentExtraction({
      organizationId: 'org-1',
      userId: 'user-1',
      payload: { docId: 'doc-1', filename: 'strategy.pdf', extractedText: 'Growth target' },
    });

    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO organization_context_claims'),
      expect.arrayContaining(['org-1', 'uuid-1', 'evidence.documentExtraction', 'proposed'])
    );
    expect(rebuild).not.toHaveBeenCalled();
  });

  it('approves an in-tenant proposal and persists reviewer identity', async () => {
    mockDbGet
      .mockResolvedValueOnce({
        id: 'claim-1',
        item_id: 'item-1',
        claim_path: 'profile.industry',
        value_json: '"Consulting"',
        review_status: 'proposed',
        visibility_scope: 'organization',
      })
      .mockResolvedValueOnce(null);
    const { organizationContextService } =
      await import('../../../../server/src/services/organizationContext/OrganizationContextService.js');

    await expect(
      organizationContextService.approveClaim({
        organizationId: 'org-1',
        claimId: 'claim-1',
        reviewerId: 'reviewer-1',
      })
    ).resolves.toEqual({ claimId: 'claim-1', reviewStatus: 'approved' });
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining("SET review_status = 'approved'"),
      expect.arrayContaining(['reviewer-1', 'claim-1', 'org-1', 'proposed'])
    );
  });

  it.each([
    ['deleted or cross-tenant source', null, 'CLAIM_NOT_FOUND'],
    [
      'confidential source',
      {
        id: 'claim-1',
        item_id: 'item-1',
        claim_path: 'profile.industry',
        value_json: '"Consulting"',
        review_status: 'proposed',
        visibility_scope: 'confidential',
      },
      'CONFIDENTIAL_SOURCE',
    ],
  ])('rejects %s during approval', async (_label, claim, code) => {
    mockDbGet.mockResolvedValueOnce(claim);
    const { organizationContextService } =
      await import('../../../../server/src/services/organizationContext/OrganizationContextService.js');
    await expect(
      organizationContextService.approveClaim({
        organizationId: 'org-1',
        claimId: 'claim-1',
        reviewerId: 'reviewer-1',
      })
    ).rejects.toMatchObject({ code });
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('rejects approval when an approved conflicting value exists', async () => {
    mockDbGet
      .mockResolvedValueOnce({
        id: 'claim-1',
        item_id: 'item-1',
        claim_path: 'profile.industry',
        value_json: '"Consulting"',
        review_status: 'proposed',
        visibility_scope: 'organization',
      })
      .mockResolvedValueOnce({ id: 'claim-existing' });
    const { organizationContextService } =
      await import('../../../../server/src/services/organizationContext/OrganizationContextService.js');
    await expect(
      organizationContextService.approveClaim({
        organizationId: 'org-1',
        claimId: 'claim-1',
        reviewerId: 'reviewer-1',
      })
    ).rejects.toMatchObject({ code: 'CLAIM_CONFLICT' });
  });

  it('publishes an append-only snapshot with exact source references', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        claim_id: 'claim-1',
        item_id: 'item-1',
        claim_path: 'profile.industry',
        confidence: 0.9,
        source_type: 'document_extraction',
        source_id: 'doc-1',
        visibility_scope: 'organization',
      },
    ]);
    const { organizationContextService } =
      await import('../../../../server/src/services/organizationContext/OrganizationContextService.js');
    vi.spyOn(organizationContextService, 'buildResolvedContext').mockResolvedValue({
      organizationId: 'org-1',
      schemaVersion: 1,
      conflicts: [],
    } as any);

    const snapshot = await organizationContextService.publishSnapshot({
      organizationId: 'org-1',
      createdBy: 'reviewer-1',
    });

    expect(snapshot.snapshotId).toBe('uuid-1');
    expect(snapshot.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot.sourceRefs).toEqual([
      expect.objectContaining({
        claimId: 'claim-1',
        itemId: 'item-1',
        sourceType: 'document_extraction',
        sourceId: 'doc-1',
      }),
    ]);
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO organization_context_publications'),
      expect.arrayContaining(['uuid-1', 'org-1', 'reviewer-1'])
    );
  });

  it.each([
    [
      'deleted source',
      {
        claim_id: 'claim-1',
        item_id: 'item-1',
        claim_path: 'profile.industry',
        confidence: 1,
        source_type: null,
        source_id: null,
        visibility_scope: null,
      },
      'SOURCE_UNAVAILABLE',
    ],
    [
      'confidential source',
      {
        claim_id: 'claim-1',
        item_id: 'item-1',
        claim_path: 'profile.industry',
        confidence: 1,
        source_type: 'document_extraction',
        source_id: 'doc-1',
        visibility_scope: 'confidential',
      },
      'CONFIDENTIAL_SOURCE',
    ],
  ])('fails publication for %s', async (_label, claimRow, code) => {
    mockDbAll.mockResolvedValueOnce([claimRow]);
    const { organizationContextService } =
      await import('../../../../server/src/services/organizationContext/OrganizationContextService.js');
    await expect(
      organizationContextService.publishSnapshot({
        organizationId: 'org-1',
        createdBy: 'reviewer-1',
      })
    ).rejects.toMatchObject({ code });
  });

  it('reads a snapshot with organization and snapshot identity in the query', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const { organizationContextService } =
      await import('../../../../server/src/services/organizationContext/OrganizationContextService.js');
    await organizationContextService.getPublishedSnapshot('org-1', 'snapshot-1');
    expect(mockDbGet).toHaveBeenCalledWith(
      expect.stringContaining('WHERE organization_id = ? AND id = ?'),
      ['org-1', 'snapshot-1']
    );
  });
});
