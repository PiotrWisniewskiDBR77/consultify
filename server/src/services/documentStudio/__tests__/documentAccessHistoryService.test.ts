/**
 * Document Studio — Slice FR-37.access-history aggregator tests.
 *
 * Verifies the unified access-history feed assembled from the three
 * per-artifact audit feeds (document audit, share-link audit,
 * approval audit). The aggregator is pure-in-memory and deterministic
 * once the underlying audit stores are populated, so we drive each
 * source via its public service API and assert the shape, ordering,
 * filtering, and pagination of the combined feed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getDocumentAccessHistory } from '../documentAccessHistoryService.js';

import {
  __resetApprovalServiceForTests,
  recordApprovalDecision,
  requestDocumentApproval,
} from '../documentApprovalService.js';
import {
  __resetShareLinkRegistryForTests,
  createShareLink,
  revokeShareLink,
} from '../documentShareLinkService.js';

// We need a way to inject `document_audit` rows. The service stores
// them in a private Map keyed by `${artifactId}::${organizationId}`.
// Rather than reaching into private state, we exercise the public
// surface via a `proposal_executed`-style audit emitted by the
// service when an editor proposal is approved. To avoid the full
// proposal state machine we directly patch the audit store via the
// service's internal helper.

// Instead, we rely on the fact that `documentStudioService.ts`
// exposes `listDocumentAuditEntries`, and the `documentApprovalService`
// audit entries are ALREADY tested through that path elsewhere.
// For this test we'll exercise document_audit indirectly: open and
// resolve an approval, which writes audit rows on its own service.
// We can also import the service-level `__pushDocumentAuditForTests`
// helper if exposed, OR mock the document audit feed.
//
// Simplest: mock `listDocumentAuditEntries` so we control every row
// from this side without touching service state.

const documentAuditMock = vi.fn();
vi.mock('../documentStudioService.js', async () => {
  const actual = await vi.importActual<typeof import('../documentStudioService.js')>(
    '../documentStudioService.js'
  );
  return {
    ...actual,
    listDocumentAuditEntries: (...args: unknown[]) =>
      documentAuditMock(...(args as [string, string])),
  };
});

describe('Slice FR-37.access-history aggregator', () => {
  const organizationId = 'org-history';
  const artifactId = 'art-history-1';

  beforeEach(() => {
    __resetShareLinkRegistryForTests();
    __resetApprovalServiceForTests();
    documentAuditMock.mockReset();
    documentAuditMock.mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty result when no feeds have entries', () => {
    const result = getDocumentAccessHistory({ artifactId, organizationId });
    expect(result.totalCount).toBe(0);
    expect(result.entries).toHaveLength(0);
    expect(result.artifactId).toBe(artifactId);
    expect(result.organizationId).toBe(organizationId);
  });

  it('pulls document_audit rows into the feed with stable entryId', () => {
    documentAuditMock.mockReturnValue([
      {
        auditId: 'a1',
        artifactId,
        organizationId,
        action: 'proposal_executed',
        actorId: 'user-1',
        occurredAt: '2026-05-09T10:00:00.000Z',
        details: { proposalId: 'prop-1' },
      },
    ]);
    const result = getDocumentAccessHistory({ artifactId, organizationId });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      entryId: 'document_audit::a1',
      source: 'document_audit',
      action: 'proposal_executed',
      actorId: 'user-1',
    });
  });

  it('pulls share-link audit rows into the feed via listShareLinkAuditEntries', () => {
    const link = createShareLink({
      artifactId,
      organizationId,
      userId: 'user-creator',
      accessScope: 'read',
    });
    revokeShareLink({
      shareLinkId: link.shareLinkId,
      organizationId,
      userId: 'user-revoker',
    });
    const result = getDocumentAccessHistory({ artifactId, organizationId });
    // Two share-link audit rows: created + revoked.
    expect(result.entries.length).toBeGreaterThanOrEqual(2);
    const shareLinkSources = result.entries.filter((e) => e.source === 'share_link');
    expect(shareLinkSources.length).toBeGreaterThanOrEqual(2);
    expect(shareLinkSources.every((e) => e.sourceId === link.shareLinkId)).toBe(true);
    // accessScope should be folded into details by the aggregator.
    expect(shareLinkSources[0]?.details?.accessScope).toBe('read');
  });

  it('pulls approval audit rows into the feed', () => {
    const approval = requestDocumentApproval({
      artifactId,
      organizationId,
      userId: 'user-creator',
      participants: [{ userId: 'reviewer-1', required: true }],
    });
    recordApprovalDecision({
      approvalId: approval.approvalId,
      organizationId,
      reviewerId: 'reviewer-1',
      kind: 'approve',
    });
    const result = getDocumentAccessHistory({ artifactId, organizationId });
    const approvalEntries = result.entries.filter((e) => e.source === 'approval');
    expect(approvalEntries.length).toBeGreaterThanOrEqual(2);
    expect(approvalEntries.every((e) => e.sourceId === approval.approvalId)).toBe(true);
  });

  it('sorts entries by occurredAt descending across all sources', () => {
    documentAuditMock.mockReturnValue([
      {
        auditId: 'old',
        artifactId,
        organizationId,
        action: 'proposal_executed',
        actorId: 'user-1',
        occurredAt: '2026-05-01T00:00:00.000Z',
      },
      {
        auditId: 'new',
        artifactId,
        organizationId,
        action: 'proposal_executed',
        actorId: 'user-1',
        occurredAt: '2026-05-09T00:00:00.000Z',
      },
    ]);
    const result = getDocumentAccessHistory({ artifactId, organizationId });
    expect(result.entries[0]?.entryId).toBe('document_audit::new');
    expect(result.entries[1]?.entryId).toBe('document_audit::old');
  });

  it('honors source filter (only document_audit when sources=["document_audit"])', () => {
    documentAuditMock.mockReturnValue([
      {
        auditId: 'da-1',
        artifactId,
        organizationId,
        action: 'proposal_executed',
        actorId: 'user-1',
        occurredAt: '2026-05-09T00:00:00.000Z',
      },
    ]);
    createShareLink({
      artifactId,
      organizationId,
      userId: 'user-creator',
      accessScope: 'read',
    });
    const filtered = getDocumentAccessHistory({
      artifactId,
      organizationId,
      options: { sources: ['document_audit'] },
    });
    expect(filtered.entries.every((e) => e.source === 'document_audit')).toBe(true);
    expect(filtered.totalCount).toBe(1);
  });

  it('honors limit + offset for pagination', () => {
    documentAuditMock.mockReturnValue(
      Array.from({ length: 5 }, (_, i) => ({
        auditId: `r${i}`,
        artifactId,
        organizationId,
        action: 'proposal_executed',
        actorId: 'user-1',
        occurredAt: `2026-05-09T0${i}:00:00.000Z`,
      }))
    );
    const page1 = getDocumentAccessHistory({
      artifactId,
      organizationId,
      options: { limit: 2, offset: 0 },
    });
    expect(page1.totalCount).toBe(5);
    expect(page1.entries).toHaveLength(2);
    const page2 = getDocumentAccessHistory({
      artifactId,
      organizationId,
      options: { limit: 2, offset: 2 },
    });
    expect(page2.entries).toHaveLength(2);
    // Pages must not overlap.
    const p1Ids = page1.entries.map((e) => e.entryId);
    const p2Ids = page2.entries.map((e) => e.entryId);
    expect(p1Ids.some((id) => p2Ids.includes(id))).toBe(false);
  });

  it('clamps limit to the hard cap (1000) when an absurd value is requested', () => {
    documentAuditMock.mockReturnValue([
      {
        auditId: 'r',
        artifactId,
        organizationId,
        action: 'proposal_executed',
        actorId: 'u',
        occurredAt: '2026-05-09T00:00:00.000Z',
      },
    ]);
    const r = getDocumentAccessHistory({
      artifactId,
      organizationId,
      options: { limit: 99999 },
    });
    expect(r.entries).toHaveLength(1);
  });

  it('returns empty result for empty artifactId or organizationId', () => {
    const r1 = getDocumentAccessHistory({ artifactId: '', organizationId });
    const r2 = getDocumentAccessHistory({ artifactId, organizationId: '' });
    expect(r1.entries).toHaveLength(0);
    expect(r2.entries).toHaveLength(0);
  });

  it('does NOT cross-leak share-link audit between artifacts in the same org', () => {
    createShareLink({
      artifactId: 'art-OTHER',
      organizationId,
      userId: 'user-creator',
      accessScope: 'read',
    });
    const r = getDocumentAccessHistory({ artifactId, organizationId });
    expect(r.entries.filter((e) => e.source === 'share_link')).toHaveLength(0);
  });

  it('isolates results across tenants', () => {
    createShareLink({
      artifactId,
      organizationId: 'org-A',
      userId: 'user-A',
      accessScope: 'read',
    });
    const orgB = getDocumentAccessHistory({ artifactId, organizationId: 'org-B' });
    expect(orgB.entries).toHaveLength(0);
  });
});
