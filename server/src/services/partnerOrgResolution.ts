/**
 * Resolves the active partner organization for a logged-in user from `partner_users`.
 * Partner data must always be scoped by this id — not by JWT tenant `organizationId`.
 */

import crypto from 'node:crypto';

import { getDatabase } from '../database/Database.js';
import * as DbPromise from '../utils/DbPromise.js';

export async function getActivePartnerOrgIdForUser(userId: string): Promise<string | null> {
  const db = getDatabase();
  const row = await DbPromise.get<{ partner_org_id: string }>(
    db,
    `SELECT partner_org_id
     FROM partner_users
     WHERE user_id = ?
       AND LOWER(COALESCE(status, 'active')) = 'active'
     ORDER BY COALESCE(updated_at, joined_at, created_at) DESC
     LIMIT 1`,
    [userId]
  );
  if (row?.partner_org_id) {
    return row.partner_org_id;
  }

  // Self-heal legacy/demo environments where partner organization exists
  // but partner_users link was not persisted (or status casing drifted).
  const fallbackOrg = await DbPromise.get<{ id: string }>(
    db,
    `SELECT id
     FROM partner_organizations
     WHERE created_by = ?
       AND LOWER(COALESCE(status, 'active')) = 'active'
     ORDER BY COALESCE(updated_at, created_at) DESC
     LIMIT 1`,
    [userId]
  );

  if (!fallbackOrg?.id) {
    // Secondary self-heal for workspace member accounts:
    // if any colleague in the same organization already has an active partner_org,
    // inherit that scope and persist a local partner_users link for this user.
    const orgScopedPartner = await DbPromise.get<{ partner_org_id: string }>(
      db,
      `SELECT pu.partner_org_id
       FROM partner_users pu
       JOIN organization_members owner_member ON owner_member.user_id = pu.user_id::text
       JOIN organization_members candidate_member
         ON candidate_member.organization_id = owner_member.organization_id
        AND candidate_member.user_id = ?
       WHERE LOWER(COALESCE(pu.status, 'active')) = 'active'
         AND LOWER(COALESCE(owner_member.status, 'active')) IN ('active', 'accepted')
         AND LOWER(COALESCE(candidate_member.status, 'active')) IN ('active', 'accepted')
       ORDER BY COALESCE(pu.updated_at, pu.joined_at, pu.created_at) DESC
       LIMIT 1`,
      [userId]
    );

    if (!orgScopedPartner?.partner_org_id) {
      return null;
    }

    try {
      await DbPromise.run(
        db,
        `INSERT INTO partner_users
           (id, partner_org_id, user_id, role, status, joined_at, created_at, updated_at)
         VALUES (?, ?, ?, 'member', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (partner_org_id, user_id) DO UPDATE SET
           status = 'active',
           updated_at = CURRENT_TIMESTAMP`,
        [crypto.randomUUID(), orgScopedPartner.partner_org_id, userId]
      );
    } catch {
      // Non-fatal: keep resolved partner_org even when link backfill cannot be persisted.
    }

    return orgScopedPartner.partner_org_id;
  }

  try {
    await DbPromise.run(
      db,
      `INSERT INTO partner_users
         (id, partner_org_id, user_id, role, status, joined_at, created_at, updated_at)
       VALUES (?, ?, ?, 'owner', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (partner_org_id, user_id) DO UPDATE SET
         status = 'active',
         updated_at = CURRENT_TIMESTAMP`,
      [crypto.randomUUID(), fallbackOrg.id, userId]
    );
  } catch {
    // Non-fatal: return resolved org even when link backfill cannot be persisted.
  }

  return fallbackOrg.id;
}

/**
 * Resolve a Partner organization only when it is durably bound to the current
 * Consultify tenant and the caller has an active Partner link.  This resolver
 * is deliberately read-only: historical Partner rows whose
 * `owner_organization_id` is NULL remain unbound and are denied by V8 writers
 * until an explicit, owner-authorized backfill supplies the relationship.
 */
export async function getActivePartnerOrgIdForTenantUser(
  organizationId: string,
  userId: string
): Promise<string | null> {
  const db = getDatabase();
  const row = await DbPromise.get<{ partner_org_id: string }>(
    db,
    `SELECT po.id AS partner_org_id
       FROM partner_organizations po
       JOIN partner_users pu ON pu.partner_org_id = po.id
      WHERE po.owner_organization_id = ?
        AND pu.user_id = ?
        AND LOWER(COALESCE(po.status, 'active')) = 'active'
        AND LOWER(COALESCE(pu.status, 'active')) = 'active'
      ORDER BY COALESCE(pu.updated_at, pu.joined_at, pu.created_at) DESC
      LIMIT 1`,
    [organizationId, userId],
    { fallback: false }
  );
  return row?.partner_org_id || null;
}
