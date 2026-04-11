/**
 * Integration Status Service — P32 §2.3.4
 *
 * Standardized 4-status model for integrations:
 * connected | error | needs_reauth | disabled
 */

import crypto from 'crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export type IntegrationStatus = 'connected' | 'error' | 'needs_reauth' | 'disabled';

export interface IntegrationHealth {
  integrationId: string;
  connectorType: string;
  status: IntegrationStatus;
  lastSyncAt: string | null;
  errorClass: string | null;
  errorDetail: string | null;
  remediationPath: string;
  updatedAt: string;
}

class IntegrationStatusServiceClass {

  getRemediationPath(status: IntegrationStatus): string {
    switch (status) {
      case 'connected': return 'No action needed. Monitor health.';
      case 'error': return 'Review error detail → Retry sync → Contact vendor if persistent → Disable if needed.';
      case 'needs_reauth': return 'Run reauthorization flow → Verify SSO config in Security Policy.';
      case 'disabled': return 'Re-enable integration → Reauthorize if required.';
    }
  }

  async getHealthForOrg(orgId: string): Promise<IntegrationHealth[]> {
    const rows = await dbAll(
      `SELECT id, connector_type, status, last_sync_at, error_class, error_detail, updated_at
       FROM integrations WHERE organization_id = $1 ORDER BY connector_type`,
      [orgId],
      { fallback: false }
    );
    return (rows || []).map((r: any) => ({
      integrationId: r.id,
      connectorType: r.connector_type || r.name || 'unknown',
      status: this.normalizeStatus(r.status),
      lastSyncAt: r.last_sync_at || null,
      errorClass: r.error_class || null,
      errorDetail: r.error_detail || null,
      remediationPath: this.getRemediationPath(this.normalizeStatus(r.status)),
      updatedAt: r.updated_at || new Date().toISOString(),
    }));
  }

  normalizeStatus(raw: string | null): IntegrationStatus {
    if (!raw) return 'disabled';
    const s = raw.toLowerCase();
    if (s === 'connected' || s === 'active' || s === 'healthy') return 'connected';
    if (s === 'error' || s === 'failed' || s === 'sync_error') return 'error';
    if (s === 'needs_reauth' || s === 'expired' || s === 'token_expired') return 'needs_reauth';
    return 'disabled';
  }

  async transitionStatus(
    integrationId: string,
    newStatus: IntegrationStatus,
    actorId: string,
    organizationId?: string
  ): Promise<boolean> {
    try {
      const target = await dbGet<{ organization_id?: string }>(
        'SELECT organization_id FROM integrations WHERE id = $1',
        [integrationId],
        { fallback: false }
      );
      if (!target?.organization_id) {
        return false;
      }
      if (organizationId && target.organization_id !== organizationId) {
        logger.warn('[IntegrationStatus] Cross-tenant transition blocked', {
          integrationId,
          actorId,
          organizationId,
          actualOrgId: target.organization_id,
        });
        return false;
      }

      await dbRun(
        'UPDATE integrations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND organization_id = $3',
        [newStatus, integrationId, target.organization_id],
        { fallback: false }
      );
      try {
        await dbRun(
          `INSERT INTO admin_audit_logs (id, admin_id, action_type, metadata_json, risk_score, risk_level, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            crypto.randomUUID(),
            actorId,
            'integration_status_change',
            JSON.stringify({ integrationId, orgId: target.organization_id, newStatus }),
            30,
            'medium',
            'unresolved',
          ],
          { fallback: true }
        );
      } catch { /* audit best-effort */ }
      return true;
    } catch (err) {
      logger.error('[IntegrationStatus] Failed to transition', { integrationId, newStatus, err });
      return false;
    }
  }
}

const integrationStatusService = new IntegrationStatusServiceClass();
export default integrationStatusService;
