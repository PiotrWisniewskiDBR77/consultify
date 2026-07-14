/**
 * presentationDeckCollaboratorService — P3.3 per-user deck membership.
 *
 * Backs the `presentation_deck_collaborators` table (migration 788). This is
 * the deferred piece from P3.1: inviting a collaborator now writes a real
 * membership row (deck + user + role) instead of only minting a share-link.
 *
 * FAIL-OPEN CONTRACT (critical):
 *   Every function here is schema-tolerant. If the table is missing or the DB
 *   is unreachable, reads return `[]`/`null` and writes return
 *   `{ status: 'storage_error' }` — they NEVER throw. Callers (routes + WS
 *   gateway) treat that as "no membership layer available" and fall back to the
 *   existing org-scoped / share-link behaviour, so the deck editor keeps
 *   working in solo mode. Membership + presence are additive, never a hard
 *   dependency of core editing.
 */

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export type CollaboratorRole = 'owner' | 'editor' | 'viewer';
export type CollaboratorStatus = 'active' | 'pending' | 'revoked';

export interface DeckCollaborator {
  id: string;
  deckId: string;
  organizationId: string;
  userId: string | null;
  invitedEmail: string | null;
  role: CollaboratorRole;
  status: CollaboratorStatus;
  invitedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UpsertResult {
  status: 'ok' | 'storage_error';
  collaborator?: DeckCollaborator;
  reason?: string;
}

const VALID_ROLES: readonly CollaboratorRole[] = ['owner', 'editor', 'viewer'];

export function isValidRole(role: unknown): role is CollaboratorRole {
  return typeof role === 'string' && (VALID_ROLES as readonly string[]).includes(role);
}

/** Map a `view`/`comment` share-permission (P3.1 ShareModal) to a role. */
export function permissionToRole(permission: unknown): CollaboratorRole {
  if (permission === 'edit' || permission === 'editor') return 'editor';
  // `comment` collapses to viewer for now — comment-only is a viewer that may annotate.
  return 'viewer';
}

function isSchemaMissing(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('no such table') ||
    lower.includes('does not exist') ||
    lower.includes('relation') ||
    lower.includes('undefined table') ||
    lower.includes('database not initialized')
  );
}

function isUniqueViolation(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('unique') || lower.includes('duplicate');
}

function mapRow(row: any): DeckCollaborator {
  return {
    id: String(row.id),
    deckId: String(row.deck_id),
    organizationId: String(row.organization_id),
    userId: row.user_id != null ? String(row.user_id) : null,
    invitedEmail: row.invited_email != null ? String(row.invited_email) : null,
    role: (VALID_ROLES as readonly string[]).includes(row.role) ? row.role : 'viewer',
    status: ['active', 'pending', 'revoked'].includes(row.status) ? row.status : 'active',
    invitedBy: row.invited_by != null ? String(row.invited_by) : null,
    createdAt: row.created_at != null ? String(row.created_at) : null,
    updatedAt: row.updated_at != null ? String(row.updated_at) : null,
  };
}

/**
 * List collaborators for a deck (org-scoped). Excludes revoked rows by default.
 * Fail-open: returns [] on any storage error.
 */
export async function listCollaborators(
  deckId: string,
  organizationId: string,
  opts: { includeRevoked?: boolean } = {}
): Promise<DeckCollaborator[]> {
  try {
    const rows = await dbAll(
      `SELECT * FROM presentation_deck_collaborators
       WHERE deck_id = ? AND organization_id = ?
       ${opts.includeRevoked ? '' : "AND status != 'revoked'"}
       ORDER BY created_at ASC`,
      [deckId, organizationId]
    );
    return (Array.isArray(rows) ? rows : []).map(mapRow);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!isSchemaMissing(msg)) {
      logger.warn('[DeckCollaborators] listCollaborators failed (fail-open):', msg);
    }
    return [];
  }
}

/**
 * Whether a user has an active membership row for a deck. Fail-open: returns
 * null when the table is unavailable, so callers can fall back to org-scoped
 * access rather than hard-denying.
 */
export async function getCollaboratorRole(
  deckId: string,
  organizationId: string,
  userId: string
): Promise<CollaboratorRole | null> {
  try {
    const row = await dbGet(
      `SELECT role FROM presentation_deck_collaborators
       WHERE deck_id = ? AND organization_id = ? AND user_id = ? AND status = 'active'
       LIMIT 1`,
      [deckId, organizationId, userId]
    );
    if (!row) return null;
    const role = (row as any).role;
    return (VALID_ROLES as readonly string[]).includes(role)
      ? (role as CollaboratorRole)
      : 'viewer';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!isSchemaMissing(msg)) {
      logger.warn('[DeckCollaborators] getCollaboratorRole failed (fail-open):', msg);
    }
    return null;
  }
}

/**
 * Invite / upsert a collaborator. Idempotent on (deck_id, user_id): re-inviting
 * an existing user updates their role + reactivates them. Email-only invites
 * (no userId yet) are stored as `pending`.
 *
 * Fail-open: returns { status: 'storage_error' } on any DB error — never throws.
 */
export async function upsertCollaborator(input: {
  deckId: string;
  organizationId: string;
  userId?: string | null;
  invitedEmail?: string | null;
  role: CollaboratorRole;
  invitedBy?: string | null;
}): Promise<UpsertResult> {
  const role: CollaboratorRole = isValidRole(input.role) ? input.role : 'viewer';
  const userId = input.userId ?? null;
  const status: CollaboratorStatus = userId ? 'active' : 'pending';

  try {
    // Upsert by (deck_id, user_id) when we have a user id; otherwise insert a
    // fresh pending email invite.
    if (userId) {
      const existing = await dbGet(
        `SELECT id FROM presentation_deck_collaborators
         WHERE deck_id = ? AND organization_id = ? AND user_id = ? LIMIT 1`,
        [input.deckId, input.organizationId, userId]
      );
      if (existing) {
        await dbRun(
          `UPDATE presentation_deck_collaborators
           SET role = ?, status = 'active', invited_email = COALESCE(?, invited_email),
               updated_at = now()
           WHERE id = ?`,
          [role, input.invitedEmail ?? null, (existing as any).id]
        );
        const updated = await dbGet(`SELECT * FROM presentation_deck_collaborators WHERE id = ?`, [
          (existing as any).id,
        ]);
        return { status: 'ok', collaborator: updated ? mapRow(updated) : undefined };
      }
    }

    await dbRun(
      `INSERT INTO presentation_deck_collaborators
         (deck_id, organization_id, user_id, invited_email, role, status, invited_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.deckId,
        input.organizationId,
        userId,
        input.invitedEmail ?? null,
        role,
        status,
        input.invitedBy ?? null,
      ]
    );

    const created = await dbGet(
      `SELECT * FROM presentation_deck_collaborators
       WHERE deck_id = ? AND organization_id = ?
         AND (user_id = ? OR (user_id IS NULL AND invited_email = ?))
       ORDER BY created_at DESC LIMIT 1`,
      [input.deckId, input.organizationId, userId, input.invitedEmail ?? null]
    );
    return { status: 'ok', collaborator: created ? mapRow(created) : undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // A unique-violation race means the row exists — treat as success-ish.
    if (isUniqueViolation(msg)) {
      const existing = await dbGet(
        `SELECT * FROM presentation_deck_collaborators
         WHERE deck_id = ? AND organization_id = ? AND user_id = ? LIMIT 1`,
        [input.deckId, input.organizationId, userId]
      ).catch(() => null);
      if (existing) return { status: 'ok', collaborator: mapRow(existing) };
    }
    if (!isSchemaMissing(msg)) {
      logger.warn('[DeckCollaborators] upsertCollaborator failed (fail-open):', msg);
    }
    return { status: 'storage_error', reason: isSchemaMissing(msg) ? 'schema_missing' : msg };
  }
}

/**
 * Revoke a collaborator (soft — status='revoked'). Fail-open.
 */
export async function revokeCollaborator(
  deckId: string,
  organizationId: string,
  collaboratorId: string
): Promise<{ status: 'ok' | 'storage_error'; reason?: string }> {
  try {
    await dbRun(
      `UPDATE presentation_deck_collaborators
       SET status = 'revoked', updated_at = now()
       WHERE id = ? AND deck_id = ? AND organization_id = ?`,
      [collaboratorId, deckId, organizationId]
    );
    return { status: 'ok' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!isSchemaMissing(msg)) {
      logger.warn('[DeckCollaborators] revokeCollaborator failed (fail-open):', msg);
    }
    return { status: 'storage_error', reason: isSchemaMissing(msg) ? 'schema_missing' : msg };
  }
}
