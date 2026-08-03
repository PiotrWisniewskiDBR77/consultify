/**
 * MW-10 — unit coverage for `server/src/services/vault/vaultDocumentAccess.ts`,
 * the single predicate set `knowledge.routes.ts` now uses for EVERY Vault
 * document/version permission check (read/mutate/restore/delete).
 *
 * These are pure-function tests (no DB, no HTTP) — the real-Postgres,
 * real-router coverage of the same rules lives in
 * `tests/integration/mw010-vault-versioning.golden-flow.realdb.test.ts`.
 * This file exists to pin the DECISION TABLE itself (every scope × actor
 * combination), which is easier to audit exhaustively here than by reading
 * assertions buried in an HTTP golden-flow test.
 */

import { describe, expect, it } from 'vitest';

import {
  canDeleteDocument,
  canMutateDocument,
  canReadDocument,
  canRestoreDocument,
  effectiveScope,
  type VaultAccessContext,
  type VaultDocumentLike,
} from '../../../server/src/services/vault/vaultDocumentAccess.js';

const ctx = (overrides: Partial<VaultAccessContext> = {}): VaultAccessContext => ({
  organizationId: 'org-1',
  userId: 'user-owner',
  isSuperAdmin: false,
  memberProjectIds: [],
  ...overrides,
});

const doc = (overrides: Partial<VaultDocumentLike> = {}): VaultDocumentLike => ({
  id: 'doc-1',
  organization_id: 'org-1',
  owner_id: 'user-owner',
  scope: 'user',
  project_id: null,
  deleted_at: null,
  ...overrides,
});

describe('MW-10 — vaultDocumentAccess.effectiveScope', () => {
  it('treats legacy scope IS NULL as organization (VLT-001 behavior preserved)', () => {
    expect(effectiveScope(doc({ scope: null }))).toBe('organization');
  });
  it('treats an unrecognized scope value as organization (fail open to the widest legacy default, never to "user")', () => {
    expect(effectiveScope(doc({ scope: 'bogus' as any }))).toBe('organization');
  });
  it('passes through user/project scopes verbatim', () => {
    expect(effectiveScope(doc({ scope: 'user' }))).toBe('user');
    expect(effectiveScope(doc({ scope: 'project' }))).toBe('project');
  });
});

describe('MW-10 — canReadDocument', () => {
  it('null document is never readable', () => {
    expect(canReadDocument(null, ctx())).toBe(false);
  });

  it('soft-deleted document is never readable, even by the owner', () => {
    expect(canReadDocument(doc({ deleted_at: '2026-08-01T00:00:00Z' }), ctx())).toBe(false);
  });

  it('cross-tenant: a document with a DIFFERENT organization_id is never readable', () => {
    const crossOrg = doc({ organization_id: 'org-2' });
    expect(canReadDocument(crossOrg, ctx({ organizationId: 'org-1' }))).toBe(false);
  });

  it('legacy organization_id IS NULL is tolerated (same-org rule as KnowledgeService.getDocuments)', () => {
    expect(canReadDocument(doc({ organization_id: null }), ctx())).toBe(true);
  });

  it('superadmin can read regardless of scope/owner, but NOT cross-tenant', () => {
    const admin = ctx({ userId: 'someone-else', isSuperAdmin: true });
    expect(canReadDocument(doc({ scope: 'user', owner_id: 'user-owner' }), admin)).toBe(true);
    expect(
      canReadDocument(doc({ organization_id: 'org-2', scope: 'user' }), admin)
    ).toBe(false);
  });

  it('user-scope: owner can read, a different user in the SAME org cannot', () => {
    const privateDoc = doc({ scope: 'user', owner_id: 'user-owner' });
    expect(canReadDocument(privateDoc, ctx({ userId: 'user-owner' }))).toBe(true);
    expect(canReadDocument(privateDoc, ctx({ userId: 'user-peer' }))).toBe(false);
  });

  it('user-scope: no userId on the context (internal/system caller) cannot read a private doc', () => {
    expect(canReadDocument(doc({ scope: 'user' }), ctx({ userId: null }))).toBe(false);
  });

  it('project-scope: member of the project can read, non-member cannot', () => {
    const projectDoc = doc({ scope: 'project', project_id: 'proj-1', owner_id: 'someone-else' });
    expect(
      canReadDocument(projectDoc, ctx({ userId: 'user-x', memberProjectIds: ['proj-1'] }))
    ).toBe(true);
    expect(
      canReadDocument(projectDoc, ctx({ userId: 'user-x', memberProjectIds: ['proj-2'] }))
    ).toBe(false);
  });

  it('project-scope document with no project_id at all is unreadable by a plain member', () => {
    const brokenProjectDoc = doc({ scope: 'project', project_id: null });
    expect(
      canReadDocument(brokenProjectDoc, ctx({ memberProjectIds: ['proj-1'] }))
    ).toBe(false);
  });

  it('organization-scope: any same-org user can read (own doc or not)', () => {
    const orgDoc = doc({ scope: 'organization', owner_id: 'someone-else' });
    expect(canReadDocument(orgDoc, ctx({ userId: 'user-x' }))).toBe(true);
  });
});

describe('MW-10 — canMutateDocument / canRestoreDocument (same predicate, kontrakt pkt 8)', () => {
  it('restore uses the EXACT same rule as mutate — same object identity semantics, always agrees', () => {
    const cases: Array<[VaultDocumentLike, VaultAccessContext]> = [
      [doc({ scope: 'user', owner_id: 'user-owner' }), ctx({ userId: 'user-owner' })],
      [doc({ scope: 'user', owner_id: 'user-owner' }), ctx({ userId: 'user-peer' })],
      [doc({ scope: 'project', project_id: 'p1' }), ctx({ memberProjectIds: ['p1'] })],
      [doc({ scope: 'organization' }), ctx({ userId: 'anyone' })],
    ];
    for (const [d, c] of cases) {
      expect(canRestoreDocument(d, c)).toBe(canMutateDocument(d, c));
    }
  });

  it('owner of own private doc can mutate; a peer in the same org cannot (VLT-002 preserved)', () => {
    const privateDoc = doc({ scope: 'user', owner_id: 'user-owner' });
    expect(canMutateDocument(privateDoc, ctx({ userId: 'user-owner' }))).toBe(true);
    expect(canMutateDocument(privateDoc, ctx({ userId: 'user-peer' }))).toBe(false);
  });

  it('project/organization scoped docs remain superadmin-only for mutation (VLT-002 scope, unchanged by MW-10)', () => {
    const projectDoc = doc({ scope: 'project', project_id: 'p1', owner_id: 'someone-else' });
    const orgDoc = doc({ scope: 'organization', owner_id: 'someone-else' });
    const memberCtx = ctx({ userId: 'user-x', memberProjectIds: ['p1'] });
    expect(canMutateDocument(projectDoc, memberCtx)).toBe(false);
    expect(canMutateDocument(orgDoc, memberCtx)).toBe(false);
    expect(canMutateDocument(projectDoc, ctx({ isSuperAdmin: true, userId: 'admin' }))).toBe(true);
    expect(canMutateDocument(orgDoc, ctx({ isSuperAdmin: true, userId: 'admin' }))).toBe(true);
  });

  it('cannot mutate what cannot be read (deleted doc, cross-tenant doc)', () => {
    expect(
      canMutateDocument(
        doc({ scope: 'user', owner_id: 'user-owner', deleted_at: '2026-08-01' }),
        ctx({ userId: 'user-owner' })
      )
    ).toBe(false);
    expect(
      canMutateDocument(
        doc({ scope: 'user', owner_id: 'user-owner', organization_id: 'org-2' }),
        ctx({ userId: 'user-owner', organizationId: 'org-1' })
      )
    ).toBe(false);
  });
});

describe('MW-10 — canDeleteDocument (kontrakt: fixes the pre-MW-10 gap)', () => {
  it('★ regression pin: BEFORE MW-10, KnowledgeService.deleteDocument only checked organization_id — ' +
      'a peer in the same org could delete another user\'s private document. This predicate must reject that.', () => {
    const victimsPrivateDoc = doc({ scope: 'user', owner_id: 'user-victim' });
    expect(canDeleteDocument(victimsPrivateDoc, ctx({ userId: 'user-attacker' }))).toBe(false);
  });

  it('owner can delete their own private document', () => {
    const own = doc({ scope: 'user', owner_id: 'user-owner' });
    expect(canDeleteDocument(own, ctx({ userId: 'user-owner' }))).toBe(true);
  });

  it('superadmin can delete anything in-org, never cross-tenant', () => {
    const admin = ctx({ isSuperAdmin: true, userId: 'admin' });
    expect(canDeleteDocument(doc({ scope: 'user', owner_id: 'user-x' }), admin)).toBe(true);
    expect(
      canDeleteDocument(doc({ scope: 'user', owner_id: 'user-x', organization_id: 'org-2' }), admin)
    ).toBe(false);
  });

  it('project/organization scoped docs: delete is superadmin-only, aligned with mutate (post-review fix) — ' +
      'a PROJECT MEMBER can read but must NOT be able to delete', () => {
    const projectDoc = doc({ scope: 'project', project_id: 'p1', owner_id: 'someone-else' });
    const member = ctx({ userId: 'user-x', memberProjectIds: ['p1'] });
    // Member can read (sanity — proves this isn't a read-gate false negative).
    expect(canReadDocument(projectDoc, member)).toBe(true);
    // But member cannot delete — matches canMutateDocument exactly.
    expect(canDeleteDocument(projectDoc, member)).toBe(false);
    expect(canDeleteDocument(projectDoc, member)).toBe(canMutateDocument(projectDoc, member));
    // Non-member: still denied (was already denied before the fix too).
    expect(
      canDeleteDocument(projectDoc, ctx({ userId: 'user-x', memberProjectIds: ['p2'] }))
    ).toBe(false);
    // Superadmin: still allowed.
    expect(
      canDeleteDocument(projectDoc, ctx({ isSuperAdmin: true, userId: 'admin' }))
    ).toBe(true);
  });

  it('canDeleteDocument and canMutateDocument agree on EVERY case (delete is now literally an alias)', () => {
    const cases: Array<[VaultDocumentLike, VaultAccessContext]> = [
      [doc({ scope: 'user', owner_id: 'user-owner' }), ctx({ userId: 'user-owner' })],
      [doc({ scope: 'user', owner_id: 'user-owner' }), ctx({ userId: 'user-peer' })],
      [doc({ scope: 'project', project_id: 'p1' }), ctx({ memberProjectIds: ['p1'] })],
      [doc({ scope: 'project', project_id: 'p1' }), ctx({ memberProjectIds: ['p2'] })],
      [doc({ scope: 'organization' }), ctx({ userId: 'anyone' })],
      [doc({ scope: 'organization' }), ctx({ isSuperAdmin: true, userId: 'admin' })],
    ];
    for (const [d, c] of cases) {
      expect(canDeleteDocument(d, c)).toBe(canMutateDocument(d, c));
    }
  });

  it('cannot delete an already-deleted document (no double-delete/idempotency loophole)', () => {
    const gone = doc({ scope: 'user', owner_id: 'user-owner', deleted_at: '2026-08-01' });
    expect(canDeleteDocument(gone, ctx({ userId: 'user-owner' }))).toBe(false);
  });
});
