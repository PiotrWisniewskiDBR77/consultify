/**
 * Trial Service — real implementation
 *
 * Handles trial lifecycle:
 * - convertTrialToOrg: upgrades a TRIAL org to PAID
 * - sendTrialWarnings: sends T-7 and T-3 notifications to trial orgs
 * - processExpiredTrials: locks down expired trial orgs (read-only)
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import {
  DEFAULT_PAID_LIMITS,
  ORG_TYPES,
  TRIAL_WARNING_DAYS,
  type TrialConversionResult,
  type TrialLockdownResult,
  type TrialWarningResult,
} from './access/AccessTypes.js';
import { DEMO_TRIAL_EVENT_TYPES, recordDemoTrialEvent } from './demoTrialTelemetryService.js';

interface TrialOrgRow {
  id: string;
  name: string;
  organization_type: string;
  trial_started_at: string | null;
  trial_expires_at: string | null;
  is_active: number;
  status: string | null;
}

interface OrgUserRow {
  user_id: string;
  role: string;
}

interface OrgMemberRoleRow {
  role: string | null;
}

interface NotificationService {
  send: (input: {
    userId: string;
    title: string;
    message: string;
    type: string;
    category?: string;
    severity?: string;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
}

interface AuditService {
  log: (input: {
    userId?: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
    actorType?: string;
  }) => Promise<void>;
}

let notificationService: NotificationService | null = null;
let auditService: AuditService | null = null;

const ADMIN_MEMBER_ROLES = new Set(['owner', 'admin', 'administrator']);

async function getNotificationService(): Promise<NotificationService | null> {
  if (notificationService) return notificationService;
  try {
    const mod = await import('./notificationService.js');
    notificationService = (mod.default || mod) as unknown as NotificationService;
    return notificationService;
  } catch {
    logger.warn('[TrialService] NotificationService not available');
    return null;
  }
}

async function getAuditService(): Promise<AuditService | null> {
  if (auditService) return auditService;
  try {
    const mod = await import('./auditService.js');
    auditService = (mod.default || mod) as unknown as AuditService;
    return auditService;
  } catch {
    logger.warn('[TrialService] AuditService not available');
    return null;
  }
}

class TrialServiceImpl {
  private db: IDatabase;

  constructor(db?: IDatabase) {
    this.db = db || getDatabase();
  }

  /**
   * Convert a TRIAL organization to PAID.
   * Updates org type, removes trial limits, sets paid defaults.
   */
  async convertTrialToOrg(
    trialId: string,
    userId: string,
    newOrgName: string
  ): Promise<TrialConversionResult> {
    const org = await DbPromise.get<TrialOrgRow>(
      this.db,
      `SELECT id, name, organization_type, trial_started_at, trial_expires_at, is_active, status
       FROM organizations WHERE id = ?`,
      [trialId],
      { fallback: false }
    );

    if (!org) {
      throw new Error('Organization not found');
    }

    const member = await DbPromise.get<OrgMemberRoleRow>(
      this.db,
      `SELECT role
       FROM organization_members
       WHERE organization_id = ? AND user_id = ?
       LIMIT 1`,
      [trialId, userId],
      { fallback: false }
    );

    const normalizedMemberRole = String(member?.role || '')
      .trim()
      .toLowerCase();
    if (!ADMIN_MEMBER_ROLES.has(normalizedMemberRole)) {
      throw new Error('Only organization owners or admins can convert a trial');
    }

    if (org.organization_type === ORG_TYPES.PAID) {
      throw new Error('Organization is already on a paid plan');
    }

    if (org.organization_type === ORG_TYPES.DEMO) {
      throw new Error('Cannot convert a demo organization directly. Start a trial first.');
    }

    const now = new Date().toISOString();

    await DbPromise.run(
      this.db,
      `UPDATE organizations 
       SET organization_type = ?, name = ?, status = 'active', is_active = 1, updated_at = ?
       WHERE id = ?`,
      [ORG_TYPES.PAID, newOrgName || org.name, now, trialId]
    );

    await DbPromise.run(this.db, `DELETE FROM organization_limits WHERE organization_id = ?`, [
      trialId,
    ]);

    const audit = await getAuditService();
    if (audit) {
      await audit.log({
        userId,
        action: 'trial_converted_to_paid',
        entityType: 'organization',
        entityId: trialId,
        metadata: {
          previousOrgType: org.organization_type,
          newOrgType: ORG_TYPES.PAID,
          newOrgName: newOrgName || org.name,
          convertedAt: now,
        },
      });
    }

    const ns = await getNotificationService();
    if (ns) {
      const users = await DbPromise.all<OrgUserRow>(
        this.db,
        `SELECT user_id, role FROM organization_members WHERE organization_id = ?`,
        [trialId]
      );
      for (const u of users || []) {
        try {
          await ns.send({
            userId: u.user_id,
            title: 'Welcome to the paid plan!',
            message: `Your organization "${newOrgName || org.name}" has been upgraded. All limits have been removed.`,
            type: 'billing',
            category: 'billing',
            severity: 'INFO',
            actionUrl: '/settings?tab=billing',
            metadata: { orgId: trialId, event: 'trial_converted_to_paid' },
          });
        } catch {
          // best-effort
        }
      }
    }

    logger.info(`[TrialService] Converted trial org ${trialId} to PAID`);
    await recordDemoTrialEvent({
      eventType: DEMO_TRIAL_EVENT_TYPES.TRIAL_CONVERTED_TO_PAID,
      organizationId: trialId,
      userId,
      source: 'trial_service',
      metadata: {
        previousOrgType: org.organization_type,
      },
    });

    return {
      newOrganizationId: trialId,
      previousOrgType: org.organization_type as any,
      newOrgType: ORG_TYPES.PAID,
      convertedAt: now,
    };
  }

  /**
   * Send trial warning notifications for orgs approaching expiry (T-7 and T-3).
   * Returns the number of warnings sent.
   */
  async sendTrialWarnings(): Promise<number> {
    const now = new Date();
    const warningDate = new Date(now.getTime() + TRIAL_WARNING_DAYS.WARNING * 24 * 60 * 60 * 1000);
    const criticalDate = new Date(
      now.getTime() + TRIAL_WARNING_DAYS.CRITICAL * 24 * 60 * 60 * 1000
    );

    const orgs = await DbPromise.all<TrialOrgRow>(
      this.db,
      `SELECT id, name, organization_type, trial_started_at, trial_expires_at, is_active, status
       FROM organizations 
       WHERE organization_type = ? AND is_active = 1 AND trial_expires_at IS NOT NULL
         AND trial_expires_at > ?
         AND trial_expires_at <= ?`,
      [ORG_TYPES.TRIAL, now.toISOString(), warningDate.toISOString()]
    );

    if (!orgs || orgs.length === 0) return 0;

    const ns = await getNotificationService();
    const audit = await getAuditService();
    let totalSent = 0;

    for (const org of orgs) {
      const expiresAt = new Date(org.trial_expires_at!);
      const daysRemaining = Math.ceil(
        (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const warningLevel: 'warning' | 'critical' =
        daysRemaining <= TRIAL_WARNING_DAYS.CRITICAL ? 'critical' : 'warning';

      const users = await DbPromise.all<OrgUserRow>(
        this.db,
        `SELECT user_id, role FROM organization_members WHERE organization_id = ?`,
        [org.id]
      );

      const admins = (users || []).filter(
        (u) => u.role === 'owner' || u.role === 'ADMIN' || u.role === 'admin'
      );
      const targets = admins.length > 0 ? admins : users || [];

      if (ns) {
        for (const u of targets) {
          try {
            const title =
              warningLevel === 'critical'
                ? `Trial expires in ${daysRemaining} days`
                : `${daysRemaining} days left in your trial`;
            const message =
              warningLevel === 'critical'
                ? `Your trial for "${org.name}" expires in ${daysRemaining} days. Upgrade now to keep full access.`
                : `Your trial for "${org.name}" has ${daysRemaining} days remaining. Explore upgrade options to continue without interruption.`;

            await ns.send({
              userId: u.user_id,
              title,
              message,
              type: 'billing',
              category: 'billing',
              severity: warningLevel === 'critical' ? 'WARNING' : 'INFO',
              actionUrl: '/settings?tab=billing',
              metadata: {
                orgId: org.id,
                event: 'trial_warning',
                warningLevel,
                daysRemaining,
              },
            });
            totalSent++;
          } catch {
            // best-effort
          }
        }
      }

      if (audit) {
        await audit.log({
          action: 'trial_warning_sent',
          entityType: 'organization',
          entityId: org.id,
          actorType: 'cron',
          metadata: { warningLevel, daysRemaining, notifiedCount: targets.length },
        });
      }

      await recordDemoTrialEvent({
        eventType: DEMO_TRIAL_EVENT_TYPES.TRIAL_EXPIRY_WARNING_SHOWN,
        organizationId: org.id,
        source: 'trial_cron',
        metadata: {
          warningLevel,
          daysRemaining,
        },
      });
    }

    logger.info(`[TrialService] Sent ${totalSent} trial warning(s) for ${orgs.length} org(s)`);
    return totalSent;
  }

  /**
   * Process expired trials: set orgs to read-only (lockdown).
   * Returns the number of trials locked.
   */
  async processExpiredTrials(): Promise<number> {
    const now = new Date().toISOString();

    const expiredOrgs = await DbPromise.all<TrialOrgRow>(
      this.db,
      `SELECT id, name, organization_type, trial_started_at, trial_expires_at, is_active, status
       FROM organizations 
       WHERE organization_type = ? AND is_active = 1 
         AND trial_expires_at IS NOT NULL AND trial_expires_at <= ?
         AND (status IS NULL OR status != 'expired')`,
      [ORG_TYPES.TRIAL, now]
    );

    if (!expiredOrgs || expiredOrgs.length === 0) return 0;

    const ns = await getNotificationService();
    const audit = await getAuditService();
    let locked = 0;

    for (const org of expiredOrgs) {
      try {
        await DbPromise.run(
          this.db,
          `UPDATE organizations SET status = 'expired', updated_at = ? WHERE id = ?`,
          [now, org.id]
        );

        if (audit) {
          await audit.log({
            action: 'trial_expired_lockdown',
            entityType: 'organization',
            entityId: org.id,
            actorType: 'cron',
            metadata: {
              previousStatus: org.status,
              trialExpiresAt: org.trial_expires_at,
              lockedAt: now,
            },
          });
        }

        if (ns) {
          const users = await DbPromise.all<OrgUserRow>(
            this.db,
            `SELECT user_id, role FROM organization_members WHERE organization_id = ?`,
            [org.id]
          );
          for (const u of users || []) {
            try {
              await ns.send({
                userId: u.user_id,
                title: 'Your trial has expired',
                message: `The trial for "${org.name}" has ended. Your data is safe, but your organization is now in read-only mode. Upgrade to restore full access.`,
                type: 'billing',
                category: 'billing',
                severity: 'CRITICAL',
                actionUrl: '/settings?tab=billing',
                metadata: { orgId: org.id, event: 'trial_expired' },
              });
            } catch {
              // best-effort
            }
          }
        }

        locked++;
      } catch (err) {
        logger.error(`[TrialService] Failed to lock expired trial ${org.id}:`, err);
      }
    }

    logger.info(`[TrialService] Locked ${locked} expired trial org(s)`);
    return locked;
  }
}

const trialService = new TrialServiceImpl();
export default trialService;
