/**
 * P3.3 — presentationDeckCollaboratorService CRUD (presentation_deck_collaborators).
 *
 * Covers:
 *   - upsertCollaborator inserts a new membership row and is idempotent on
 *     (deck_id, user_id) (re-invite updates role, does not duplicate)
 *   - listCollaborators returns mapped rows and excludes revoked
 *   - getCollaboratorRole returns the active role / null
 *   - revokeCollaborator soft-deletes (status='revoked')
 *   - FAIL-OPEN: a missing table never throws — reads return []/null, writes
 *     return { status: 'storage_error' }
 *
 * The DbPromise layer is mocked with a tiny in-memory table.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── In-memory fake of presentation_deck_collaborators ─────────────────────────

interface Row {
  id: string;
  deck_id: string;
  organization_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: string;
  status: string;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

let table: Row[] = [];
let seq = 0;
let simulateMissingTable = false;

function assertTableExists() {
  if (simulateMissingTable) {
    throw new Error('relation "presentation_deck_collaborators" does not exist');
  }
}

const mockGet = vi.fn(async (sql: string, params: unknown[] = []) => {
  assertTableExists();
  if (/SELECT role FROM presentation_deck_collaborators/i.test(sql)) {
    const [deckId, orgId, userId] = params as string[];
    const row = table.find(
      (r) => r.deck_id === deckId && r.organization_id === orgId && r.user_id === userId && r.status === 'active'
    );
    return row ? { role: row.role } : null;
  }
  if (/SELECT id FROM presentation_deck_collaborators/i.test(sql)) {
    const [deckId, orgId, userId] = params as string[];
    const row = table.find(
      (r) => r.deck_id === deckId && r.organization_id === orgId && r.user_id === userId
    );
    return row ? { id: row.id } : null;
  }
  if (/SELECT \* FROM presentation_deck_collaborators WHERE id = \?/i.test(sql)) {
    const [id] = params as string[];
    return table.find((r) => r.id === id) ?? null;
  }
  if (/SELECT \* FROM presentation_deck_collaborators/i.test(sql)) {
    // "created" fetch after insert — grab most recent matching row
    const [deckId, orgId, userId, email] = params as (string | null)[];
    const matches = table.filter(
      (r) =>
        r.deck_id === deckId &&
        r.organization_id === orgId &&
        (r.user_id === userId || (r.user_id === null && r.invited_email === email))
    );
    return matches[matches.length - 1] ?? null;
  }
  return null;
});

const mockAll = vi.fn(async (sql: string, params: unknown[] = []) => {
  assertTableExists();
  if (/FROM presentation_deck_collaborators/i.test(sql)) {
    const [deckId, orgId] = params as string[];
    const excludeRevoked = /status != 'revoked'/i.test(sql);
    return table.filter(
      (r) =>
        r.deck_id === deckId &&
        r.organization_id === orgId &&
        (!excludeRevoked || r.status !== 'revoked')
    );
  }
  return [];
});

const mockRun = vi.fn(async (sql: string, params: unknown[] = []) => {
  assertTableExists();
  if (/INSERT INTO presentation_deck_collaborators/i.test(sql)) {
    const [deckId, orgId, userId, email, role, status, invitedBy] = params as (string | null)[];
    const now = new Date().toISOString();
    table.push({
      id: `collab-${++seq}`,
      deck_id: deckId as string,
      organization_id: orgId as string,
      user_id: (userId as string) ?? null,
      invited_email: (email as string) ?? null,
      role: role as string,
      status: status as string,
      invited_by: (invitedBy as string) ?? null,
      created_at: now,
      updated_at: now,
    });
    return { changes: 1 };
  }
  if (/UPDATE presentation_deck_collaborators\s+SET role/i.test(sql)) {
    const [role, email, id] = params as (string | null)[];
    const row = table.find((r) => r.id === id);
    if (row) {
      row.role = role as string;
      row.status = 'active';
      if (email) row.invited_email = email as string;
    }
    return { changes: row ? 1 : 0 };
  }
  if (/UPDATE presentation_deck_collaborators\s+SET status = 'revoked'/i.test(sql)) {
    const [id, deckId, orgId] = params as string[];
    const row = table.find(
      (r) => r.id === id && r.deck_id === deckId && r.organization_id === orgId
    );
    if (row) row.status = 'revoked';
    return { changes: row ? 1 : 0 };
  }
  return { changes: 0 };
});

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...a: [string, unknown[]?]) => mockGet(...a),
  all: (...a: [string, unknown[]?]) => mockAll(...a),
  run: (...a: [string, unknown[]?]) => mockRun(...a),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  getCollaboratorRole,
  isValidRole,
  listCollaborators,
  permissionToRole,
  revokeCollaborator,
  upsertCollaborator,
} from '../../../server/src/services/presentationDeckCollaboratorService.js';

describe('presentationDeckCollaboratorService', () => {
  beforeEach(() => {
    table = [];
    seq = 0;
    simulateMissingTable = false;
    mockGet.mockClear();
    mockAll.mockClear();
    mockRun.mockClear();
  });

  it('validates roles and maps permissions', () => {
    expect(isValidRole('owner')).toBe(true);
    expect(isValidRole('editor')).toBe(true);
    expect(isValidRole('viewer')).toBe(true);
    expect(isValidRole('admin')).toBe(false);
    expect(permissionToRole('comment')).toBe('viewer');
    expect(permissionToRole('view')).toBe('viewer');
    expect(permissionToRole('edit')).toBe('editor');
  });

  it('inserts a new collaborator membership row', async () => {
    const res = await upsertCollaborator({
      deckId: 'deck-1',
      organizationId: 'org-A',
      userId: 'user-2',
      invitedEmail: 'bob@example.com',
      role: 'editor',
      invitedBy: 'user-1',
    });
    expect(res.status).toBe('ok');
    expect(res.collaborator?.role).toBe('editor');
    expect(res.collaborator?.userId).toBe('user-2');
    expect(res.collaborator?.status).toBe('active');
    expect(table).toHaveLength(1);
  });

  it('is idempotent on (deck_id, user_id): re-invite updates role, no duplicate', async () => {
    await upsertCollaborator({
      deckId: 'deck-1',
      organizationId: 'org-A',
      userId: 'user-2',
      role: 'viewer',
    });
    const res = await upsertCollaborator({
      deckId: 'deck-1',
      organizationId: 'org-A',
      userId: 'user-2',
      role: 'editor',
    });
    expect(res.status).toBe('ok');
    expect(res.collaborator?.role).toBe('editor');
    expect(table).toHaveLength(1);
  });

  it('stores an email-only invite as pending (no user_id yet)', async () => {
    const res = await upsertCollaborator({
      deckId: 'deck-1',
      organizationId: 'org-A',
      invitedEmail: 'new@example.com',
      role: 'viewer',
    });
    expect(res.status).toBe('ok');
    expect(res.collaborator?.status).toBe('pending');
    expect(res.collaborator?.userId).toBeNull();
  });

  it('lists collaborators and excludes revoked', async () => {
    await upsertCollaborator({ deckId: 'd', organizationId: 'o', userId: 'u1', role: 'owner' });
    await upsertCollaborator({ deckId: 'd', organizationId: 'o', userId: 'u2', role: 'viewer' });
    let list = await listCollaborators('d', 'o');
    expect(list).toHaveLength(2);

    const revokeId = list.find((c) => c.userId === 'u2')!.id;
    await revokeCollaborator('d', 'o', revokeId);
    list = await listCollaborators('d', 'o');
    expect(list).toHaveLength(1);
    expect(list[0].userId).toBe('u1');
  });

  it('resolves the active role / null', async () => {
    await upsertCollaborator({ deckId: 'd', organizationId: 'o', userId: 'u1', role: 'editor' });
    expect(await getCollaboratorRole('d', 'o', 'u1')).toBe('editor');
    expect(await getCollaboratorRole('d', 'o', 'nobody')).toBeNull();
  });

  it('FAIL-OPEN: missing table never throws', async () => {
    simulateMissingTable = true;
    await expect(listCollaborators('d', 'o')).resolves.toEqual([]);
    await expect(getCollaboratorRole('d', 'o', 'u1')).resolves.toBeNull();
    const upsert = await upsertCollaborator({
      deckId: 'd',
      organizationId: 'o',
      userId: 'u1',
      role: 'viewer',
    });
    expect(upsert.status).toBe('storage_error');
    expect(upsert.reason).toBe('schema_missing');
    const revoke = await revokeCollaborator('d', 'o', 'x');
    expect(revoke.status).toBe('storage_error');
  });
});
