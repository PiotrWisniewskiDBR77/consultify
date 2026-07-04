/**
 * DP-3 T3 — contract tests for server/src/realtime/ideaMapAccess.ts
 *
 * Verifies:
 *   - assertIdeaMembership: ACTIVE member of the idea's org → canRead/canWrite true
 *   - assertIdeaMembership: non-member (or member of a different org) → both false
 *   - assertIdeaMembership: idea does not exist (or belongs to another org) → both false
 *   - selectCanonicalMapRow: is_canonical column missing from schema → null
 *     (caller falls back to legacy per-user selection)
 *   - selectCanonicalMapRow: column present, no canonical row yet → null
 *   - selectCanonicalMapRow: column present, canonical row exists → returns row
 *
 * Mock-based: no real DB needed. A minimal IDatabase-shaped stub plus a
 * mocked dbSchema.getTableColumns (pattern borrowed from
 * tests/integration/mywork/my-work.map-sync.contract.test.ts and
 * tests/integration/gateways/ideaCollabWs.orgscope.test.ts).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockGetTableColumns = vi.hoisted(() => vi.fn<[string], Promise<Set<string>>>());

vi.mock('../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: (...args: [string]) => mockGetTableColumns(...args),
}));

vi.mock('../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import {
  assertIdeaMembership,
  selectCanonicalMapRow,
} from '../../server/src/realtime/ideaMapAccess.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_ID = 'org-a';
const OTHER_ORG_ID = 'org-b';
const IDEA_ID = 'idea-1';
const ACTIVE_USER_ID = 'user-active';
const NON_MEMBER_USER_ID = 'user-outsider';

const CANONICAL_COLUMNS = new Set([
  'id',
  'idea_id',
  'user_id',
  'organization_id',
  'nodes_json',
  'edges_json',
  'version',
  'is_canonical',
  'last_editor_user_id',
  'archived_from_user_id',
]);

const LEGACY_COLUMNS = new Set([
  'id',
  'idea_id',
  'user_id',
  'organization_id',
  'nodes_json',
  'edges_json',
  'version',
]);

/** Minimal IDatabase-shaped stub — only `.get` is used by ideaMapAccess.ts. */
function makeDb(opts: {
  ideaOrg?: string | null; // org the idea actually belongs to (null = idea not found)
  memberStatus?: 'ACTIVE' | 'INACTIVE' | null; // null = no membership row at all
  canonicalRow?: Record<string, unknown> | null;
}) {
  const get = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (/FROM my_ideas/i.test(sql)) {
      const [ideaId, organizationId] = params as [string, string];
      if (opts.ideaOrg == null) return null;
      if (ideaId !== IDEA_ID) return null;
      if (organizationId !== opts.ideaOrg) return null;
      return { id: ideaId };
    }
    if (/FROM organization_members/i.test(sql)) {
      if (!opts.memberStatus || opts.memberStatus !== 'ACTIVE') return null;
      return { id: 'member-1' };
    }
    if (/FROM my_idea_maps/i.test(sql)) {
      return opts.canonicalRow ?? null;
    }
    return null;
  });
  return { get } as unknown as import('../../server/src/database/IDatabase.js').IDatabase;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DP-3 T3 — ideaMapAccess contract', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('assertIdeaMembership', () => {
    it('ACTIVE member of the idea org → canRead=true, canWrite=true', async () => {
      const db = makeDb({ ideaOrg: ORG_ID, memberStatus: 'ACTIVE' });

      const result = await assertIdeaMembership(db, ORG_ID, ACTIVE_USER_ID, IDEA_ID);

      expect(result).toEqual({ canRead: true, canWrite: true });
    });

    it('non-member of the org → canRead=false, canWrite=false', async () => {
      const db = makeDb({ ideaOrg: ORG_ID, memberStatus: null });

      const result = await assertIdeaMembership(db, ORG_ID, NON_MEMBER_USER_ID, IDEA_ID);

      expect(result).toEqual({ canRead: false, canWrite: false });
    });

    it('INACTIVE member → canRead=false, canWrite=false', async () => {
      const db = makeDb({ ideaOrg: ORG_ID, memberStatus: 'INACTIVE' });

      const result = await assertIdeaMembership(db, ORG_ID, ACTIVE_USER_ID, IDEA_ID);

      expect(result).toEqual({ canRead: false, canWrite: false });
    });

    it('idea does not exist → canRead=false, canWrite=false', async () => {
      const db = makeDb({ ideaOrg: null, memberStatus: 'ACTIVE' });

      const result = await assertIdeaMembership(db, ORG_ID, ACTIVE_USER_ID, IDEA_ID);

      expect(result).toEqual({ canRead: false, canWrite: false });
    });

    it('idea belongs to a DIFFERENT org (cross-org IDOR attempt) → false', async () => {
      const db = makeDb({ ideaOrg: OTHER_ORG_ID, memberStatus: 'ACTIVE' });

      const result = await assertIdeaMembership(db, ORG_ID, ACTIVE_USER_ID, IDEA_ID);

      expect(result).toEqual({ canRead: false, canWrite: false });
    });

    it('queries my_ideas with `?` placeholders (ideaId, organizationId)', async () => {
      const db = makeDb({ ideaOrg: ORG_ID, memberStatus: 'ACTIVE' });

      await assertIdeaMembership(db, ORG_ID, ACTIVE_USER_ID, IDEA_ID);

      expect(db.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM my_ideas'),
        [IDEA_ID, ORG_ID]
      );
    });

    it('missing arguments short-circuit to no access without querying', async () => {
      const db = makeDb({ ideaOrg: ORG_ID, memberStatus: 'ACTIVE' });

      const result = await assertIdeaMembership(db, '', ACTIVE_USER_ID, IDEA_ID);

      expect(result).toEqual({ canRead: false, canWrite: false });
      expect(db.get).not.toHaveBeenCalled();
    });
  });

  describe('selectCanonicalMapRow', () => {
    it('is_canonical column absent from schema → returns null (legacy fallback)', async () => {
      mockGetTableColumns.mockResolvedValue(LEGACY_COLUMNS);
      const db = makeDb({ canonicalRow: { id: 'map-1', version: 3 } });

      const result = await selectCanonicalMapRow(db, IDEA_ID, ORG_ID);

      expect(result).toBeNull();
      // Guard must short-circuit before hitting my_idea_maps at all.
      expect(db.get).not.toHaveBeenCalled();
    });

    it('column present but no canonical row exists yet → returns null', async () => {
      mockGetTableColumns.mockResolvedValue(CANONICAL_COLUMNS);
      const db = makeDb({ canonicalRow: null });

      const result = await selectCanonicalMapRow(db, IDEA_ID, ORG_ID);

      expect(result).toBeNull();
    });

    it('column present and canonical row exists → returns the row', async () => {
      mockGetTableColumns.mockResolvedValue(CANONICAL_COLUMNS);
      const canonicalRow = { id: 'map-1', ideaId: IDEA_ID, organizationId: ORG_ID, version: 5 };
      const db = makeDb({ canonicalRow });

      const result = await selectCanonicalMapRow(db, IDEA_ID, ORG_ID);

      expect(result).toEqual(canonicalRow);
    });

    it('queries my_idea_maps filtered by is_canonical = TRUE with `?` placeholders', async () => {
      mockGetTableColumns.mockResolvedValue(CANONICAL_COLUMNS);
      const db = makeDb({ canonicalRow: { id: 'map-1', version: 1 } });

      await selectCanonicalMapRow(db, IDEA_ID, ORG_ID);

      expect(db.get).toHaveBeenCalledWith(
        expect.stringMatching(/is_canonical\s*=\s*TRUE/i),
        [IDEA_ID, ORG_ID]
      );
    });
  });
});
