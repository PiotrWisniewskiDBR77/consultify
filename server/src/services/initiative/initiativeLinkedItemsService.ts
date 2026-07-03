/**
 * Initiative linked-items persistence (M13 Depth · Seria K · K3).
 *
 * Durable artifact correlation (was React-state-only → lost on reload). All
 * operations are org-scoped and fail-safe (advisory linking must never break
 * the page). Backs GET/POST/DELETE /api/initiatives/:id/linked-items.
 */
import { v4 as uuidv4 } from 'uuid';

import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

const TABLE = 'initiative_linked_items';

export interface LinkedItem {
  id: string;
  targetType: string;
  targetId: string;
  label: string | null;
  createdAt: string | null;
}

export async function listLinkedItems(
  organizationId: string,
  initiativeId: string
): Promise<LinkedItem[]> {
  const orgId = String(organizationId || '').trim();
  if (!orgId || !initiativeId) return [];
  try {
    const rows = await queryHelpers.queryAll<{
      id: string;
      target_type: string;
      target_id: string;
      label: string | null;
      created_at: string | null;
    }>(
      `SELECT id, target_type, target_id, label, created_at
         FROM ${TABLE}
        WHERE organization_id = ? AND initiative_id = ?
        ORDER BY created_at DESC`,
      [orgId, initiativeId]
    );
    return rows.map((r) => ({
      id: String(r.id),
      targetType: r.target_type,
      targetId: r.target_id,
      label: r.label ?? null,
      createdAt: r.created_at ?? null,
    }));
  } catch (e: any) {
    logger.warn('[initiatives] linked-items list failed:', e?.message);
    return [];
  }
}

export async function addLinkedItem(
  organizationId: string,
  initiativeId: string,
  input: { targetType: string; targetId: string; label?: string | null; createdBy?: string | null }
): Promise<LinkedItem | null> {
  const orgId = String(organizationId || '').trim();
  const targetType = String(input?.targetType || '').trim();
  const targetId = String(input?.targetId || '').trim();
  if (!orgId || !initiativeId || !targetType || !targetId) return null;
  const id = uuidv4();
  try {
    await queryHelpers.queryRun(
      `INSERT INTO ${TABLE}
         (id, organization_id, initiative_id, target_type, target_id, label, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
       ON CONFLICT (initiative_id, target_type, target_id)
         DO UPDATE SET label = EXCLUDED.label`,
      [id, orgId, initiativeId, targetType, targetId, input.label ?? null, input.createdBy ?? null]
    );
    return { id, targetType, targetId, label: input.label ?? null, createdAt: null };
  } catch (e: any) {
    logger.warn('[initiatives] linked-items add failed:', e?.message);
    return null;
  }
}

export async function removeLinkedItem(
  organizationId: string,
  initiativeId: string,
  linkId: string
): Promise<boolean> {
  const orgId = String(organizationId || '').trim();
  if (!orgId || !initiativeId || !linkId) return false;
  try {
    await queryHelpers.queryRun(
      `DELETE FROM ${TABLE} WHERE id = ? AND organization_id = ? AND initiative_id = ?`,
      [linkId, orgId, initiativeId]
    );
    return true;
  } catch (e: any) {
    logger.warn('[initiatives] linked-items remove failed:', e?.message);
    return false;
  }
}
