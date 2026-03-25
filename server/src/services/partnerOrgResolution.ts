/**
 * Resolves the active partner organization for a logged-in user from `partner_users`.
 * Partner data must always be scoped by this id — not by JWT tenant `organizationId`.
 */

import { getDatabase } from '../database/Database.js';
import * as DbPromise from '../utils/DbPromise.js';

export async function getActivePartnerOrgIdForUser(userId: string): Promise<string | null> {
  const db = getDatabase();
  const row = await DbPromise.get<{ partner_org_id: string }>(
    db,
    `SELECT partner_org_id
     FROM partner_users
     WHERE user_id = ? AND status = 'active'
     LIMIT 1`,
    [userId],
  );
  return row?.partner_org_id || null;
}
