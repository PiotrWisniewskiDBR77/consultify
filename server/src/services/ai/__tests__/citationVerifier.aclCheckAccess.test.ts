/**
 * M01-006 (Chat citation panel) — server-side ACL enforcement for citation
 * status.
 *
 * FINDING before this packet: `citationVerifier.verify()` (which feeds
 * `citationAccessStatus.ts#mapVerificationStatusToAccessStatus` and, from
 * there, the SSE status delta `CitationList.tsx` renders) only ever checked
 * whether a cited row EXISTED — never whether it belonged to the requesting
 * caller's organization. `checkExists(id, type)` took no organizationId at
 * all. `ChatCitation.status` and `CitationList.getSafeCitationView` already
 * had full client-side support for a `'no_access'` status (redacts
 * title/excerpt, disables the row, shows "Source not accessible to you" —
 * see `tests/components/AIChat/CitationList.fragmentAnchorAndAcl.test.tsx`),
 * but the server had NO code path that could ever produce it — dead status,
 * never exercised by any test. A citation whose `sourceId` happened to
 * resolve to a real row in `knowledge_documents` belonging to a DIFFERENT
 * organization (a forged/stale id, or any future retrieval-path bug) would
 * be reported `'verified'` -> UI `ready`, and its already-fetched real
 * title/excerpt would render.
 *
 * FIX: `citationVerifier.verify()`/`verifySingle`/`checkAccess` now accept
 * the caller's `organizationId` and compare it against the row's
 * `organization_id` for the `knowledge_documents`-backed citation types
 * (`document`/`knowledge`/`system_doc`/`core_doc`). A mismatch reports
 * `'no_access'` (new status value) instead of `'verified'`.
 *
 * NEGATIVE CONTROL for this suite: temporarily reverting `checkAccess` to
 * the old existence-only `checkExists` (or calling `verify()` without an
 * `organizationId`, which this suite also covers explicitly below) makes
 * the "cross-org" test in this file fail — it asserts `status === 'no_access'`
 * where the pre-fix code always returned `'verified'`. This was verified by
 * hand before committing (see packet return summary), not left as an
 * assertion-only claim.
 *
 * FIX_REQUIRED ROUND ADDENDUM (independent-reviewer finding): this suite
 * mocks `dbAll` entirely, so it passes regardless of which TABLE
 * `checkAccess` actually queries — it never proves the table name is
 * correct, only that the ACL comparison logic is correct given a row. A
 * reviewer found that `checkAccess`'s type→table map sent `document`/
 * `knowledge` (ordinary chat RAG citations) to `knowledge_documents`, a
 * table real chat citations never resolve against (their `sourceId` is
 * always a `knowledge_docs.id` — see `citationVerifier.ts#checkAccess`'s
 * updated comment for the full trace through `citationExtractor.ts` /
 * `ragService.ts` / `PostgresDatabase.ts`). That table-name bug is fixed in
 * `citationVerifier.ts`; THIS mocked suite could not have caught it and is
 * kept only as a logic-level regression test. The table-name guarantee
 * itself — including a negative control that reddens when the map is wrong
 * — now lives in
 * `tests/acceptance/chat-m01-006-citation-verifier-table-map.realdb.test.ts`,
 * which inserts real rows into the real `knowledge_docs`/`knowledge_documents`
 * tables on a throwaway local Postgres, with no `dbAll` mock at all.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn();
vi.mock('../../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => dbAll(...args),
  run: vi.fn().mockResolvedValue({ success: true }),
}));

import { citationVerifier } from '../citationVerifier.js';
import type { Citation } from '../citationExtractor.js';

function makeCitation(overrides: Partial<Citation> = {}): Citation {
  return {
    id: 'cit_1',
    index: 1,
    text: '[1]',
    sourceType: 'document',
    sourceId: 'doc-confidential-1',
    confidence: 0.5,
    ...overrides,
  };
}

describe('citationVerifier — ACL (M01-006)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports no_access for a citation whose document exists but belongs to a different organization', async () => {
    dbAll.mockResolvedValueOnce([{ id: 'doc-confidential-1', organization_id: 'org-OTHER' }]);

    const report = await citationVerifier.verify(
      [makeCitation()],
      'conv-1',
      'msg-1',
      'org-CALLER'
    );

    expect(report.results).toHaveLength(1);
    expect(report.results[0].status).toBe('no_access');
    expect(report.results[0].sourceExists).toBe(true);
  });

  it('still reports verified when the document belongs to the caller\'s own organization', async () => {
    dbAll.mockResolvedValueOnce([{ id: 'doc-own-1', organization_id: 'org-CALLER' }]);

    const report = await citationVerifier.verify(
      [makeCitation({ sourceId: 'doc-own-1' })],
      'conv-1',
      'msg-1',
      'org-CALLER'
    );

    expect(report.results[0].status).toBe('verified');
  });

  it('still reports broken when the document does not exist at all (distinct from no_access)', async () => {
    dbAll.mockResolvedValueOnce([]);

    const report = await citationVerifier.verify(
      [makeCitation({ sourceId: 'doc-missing' })],
      'conv-1',
      'msg-1',
      'org-CALLER'
    );

    expect(report.results[0].status).toBe('broken');
    expect(report.results[0].sourceExists).toBe(false);
  });

  it('[negative control / pre-fix reproduction] omitting organizationId reproduces the OLD existence-only behavior — the cross-org leak is only closed when the caller actually threads organizationId through', async () => {
    // Same cross-org row as the first test, but the caller does not pass
    // organizationId (e.g. an older/OTHER call site that hasn't been
    // updated) — this is EXACTLY the pre-fix code path's behavior, kept
    // intact on purpose (see checkAccess's fail-soft rationale). This test
    // documents that the fix is opt-in per call site, not a blanket
    // guarantee — a real gap ai.routes.ts's two call sites close by always
    // passing req.organizationId, but a reviewer adding a THIRD call site
    // must remember to do the same.
    dbAll.mockResolvedValueOnce([{ id: 'doc-confidential-1', organization_id: 'org-OTHER' }]);

    const report = await citationVerifier.verify([makeCitation()], 'conv-1', 'msg-1');

    expect(report.results[0].status).toBe('verified');
  });

  it('falls back to existence-only when organization_id column is unavailable on this schema (fail-soft, not fail-closed)', async () => {
    // First call (org-scoped SELECT) throws — simulates a schema without
    // the organization_id column. Second call (plain existence SELECT)
    // succeeds.
    dbAll.mockRejectedValueOnce(new Error('column "organization_id" does not exist'));
    dbAll.mockResolvedValueOnce([{ id: 'doc-legacy-1' }]);

    const report = await citationVerifier.verify(
      [makeCitation({ sourceId: 'doc-legacy-1' })],
      'conv-1',
      'msg-1',
      'org-CALLER'
    );

    expect(report.results[0].status).toBe('verified');
    expect(dbAll).toHaveBeenCalledTimes(2);
  });
});
