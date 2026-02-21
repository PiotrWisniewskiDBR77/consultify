/**
 * Framework Entitlement Service
 *
 * Manages framework-level access control for licensed tools.
 * Access levels: locked | trial | full | educational
 */

import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export type FrameworkAccessLevel = 'locked' | 'trial' | 'full' | 'educational';

export interface FrameworkAccessResult {
  allowed: boolean;
  accessLevel: FrameworkAccessLevel;
  reason?: string;
  expiresAt?: string | null;
  requiresLegalNotice: boolean;
  upgradeCTA?: string;
}

const EDUCATIONAL_FRAMEWORKS = ['SIRI', 'ADMA', 'CMMI'];

class FrameworkEntitlementServiceClass {
  async checkAccess(organizationId: string, frameworkId: string): Promise<FrameworkAccessResult> {
    try {
      const rows = await dbAll(
        `SELECT * FROM framework_entitlements WHERE organization_id = ? AND framework_id = ?`,
        [organizationId, frameworkId]
      );
      const ent = rows?.[0] as any;

      if (!ent) {
        if (EDUCATIONAL_FRAMEWORKS.includes(frameworkId)) {
          return { allowed: true, accessLevel: 'educational', requiresLegalNotice: true };
        }
        return {
          allowed: false,
          accessLevel: 'locked',
          reason: 'No entitlement for this framework',
          requiresLegalNotice: false,
          upgradeCTA: 'Contact sales to unlock this framework',
        };
      }

      const level = ent.access_level as FrameworkAccessLevel;
      if (level === 'locked') {
        return {
          allowed: false,
          accessLevel: 'locked',
          reason: 'Framework access is locked',
          requiresLegalNotice: false,
          upgradeCTA: 'Upgrade your plan',
        };
      }
      if (level === 'trial' && ent.expires_at && new Date(ent.expires_at) < new Date()) {
        return {
          allowed: false,
          accessLevel: 'locked',
          reason: 'Trial expired',
          expiresAt: ent.expires_at,
          requiresLegalNotice: false,
          upgradeCTA: 'Trial expired — upgrade to continue',
        };
      }
      return {
        allowed: true,
        accessLevel: level,
        expiresAt: ent.expires_at,
        requiresLegalNotice: level === 'educational',
      };
    } catch (err) {
      logger.error(`[FrameworkEntitlement] Error:`, err);
      if (EDUCATIONAL_FRAMEWORKS.includes(frameworkId))
        return { allowed: true, accessLevel: 'educational', requiresLegalNotice: true };
      return {
        allowed: false,
        accessLevel: 'locked',
        reason: 'Access check failed',
        requiresLegalNotice: false,
      };
    }
  }

  async getOrgEntitlements(organizationId: string): Promise<Record<string, FrameworkAccessResult>> {
    const ALL = ['DRD', 'SIRI', 'ADMA', 'CMMI', 'LEAN'];
    const result: Record<string, FrameworkAccessResult> = {};
    for (const fw of ALL) result[fw] = await this.checkAccess(organizationId, fw);
    return result;
  }

  async grantAccess(
    organizationId: string,
    frameworkId: string,
    accessLevel: FrameworkAccessLevel,
    grantedBy: string,
    expiresAt?: string | null,
    notes?: string
  ): Promise<void> {
    await dbRun(
      `INSERT INTO framework_entitlements (organization_id, framework_id, access_level, granted_by, expires_at, notes, granted_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(organization_id, framework_id) DO UPDATE SET access_level = excluded.access_level, granted_by = excluded.granted_by, expires_at = excluded.expires_at, notes = excluded.notes, updated_at = datetime('now')`,
      [organizationId, frameworkId, accessLevel, grantedBy, expiresAt || null, notes || null]
    );
    logger.info(
      `[FrameworkEntitlement] Granted ${accessLevel} for ${frameworkId} to org=${organizationId}`
    );
  }

  async revokeAccess(organizationId: string, frameworkId: string): Promise<void> {
    await dbRun(
      `UPDATE framework_entitlements SET access_level = 'locked', updated_at = datetime('now') WHERE organization_id = ? AND framework_id = ?`,
      [organizationId, frameworkId]
    );
  }
}

const FrameworkEntitlementService = new FrameworkEntitlementServiceClass();
export default FrameworkEntitlementService;
