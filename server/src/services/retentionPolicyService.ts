/**
 * Retention Policy Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Manages data retention policies: minimal (30d), standard (90d), extended (365d).
 */
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export type RetentionTier = 'minimal' | 'standard' | 'extended';

const POLICIES: Record<RetentionTier, Record<string, number>> = {
  minimal: {
    conversations: 30,
    messages: 14,
    embeddings: 30,
    memory: 30,
    feedback: 30,
    actionLogs: 90,
    securityLogs: 365,
    costUsage: 90,
    qualityMetrics: 30,
  },
  standard: {
    conversations: 90,
    messages: 60,
    embeddings: 90,
    memory: 90,
    feedback: 90,
    actionLogs: 180,
    securityLogs: 365,
    costUsage: 180,
    qualityMetrics: 90,
  },
  extended: {
    conversations: 365,
    messages: 180,
    embeddings: 365,
    memory: 365,
    feedback: 365,
    actionLogs: 365,
    securityLogs: 730,
    costUsage: 365,
    qualityMetrics: 365,
  },
};

class RetentionPolicyServiceImpl {
  async getPolicy(orgId: string): Promise<Record<string, number> & { tier: RetentionTier }> {
    try {
      const rows = (await dbAll(
        `SELECT json_extract(settings, '$.data_retention_policy') as r FROM ai_settings WHERE organization_id=? AND setting_type='organization' LIMIT 1`,
        [orgId]
      )) as any[];
      const tier = (rows?.[0]?.r as RetentionTier) || 'standard';
      return { ...(POLICIES[tier] || POLICIES.standard), tier } as Record<string, number> & {
        tier: RetentionTier;
      };
    } catch {
      return { ...POLICIES.standard, tier: 'standard' } as Record<string, number> & {
        tier: RetentionTier;
      };
    }
  }

  async executeCleanup(orgId: string) {
    const start = Date.now();
    const policy = await this.getPolicy(orgId);
    const results: Array<{ table: string; deleted: number }> = [];

    const cleanup = async (table: string, where: string, params: unknown[], days: number) => {
      const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
      try {
        const r = await dbRun(`DELETE FROM ${table} WHERE ${where}`, [...params, cutoff]);
        results.push({ table, deleted: r?.changes || 0 });
      } catch {
        results.push({ table, deleted: 0 });
      }
    };

    await cleanup(
      'conversation_messages',
      `conversation_id IN (SELECT id FROM conversations WHERE organization_id=? AND archived=1 AND updated_at<?)`,
      [orgId],
      policy.messages
    );
    await cleanup(
      'ai_project_memory',
      `organization_id=? AND memory_type='PATTERN' AND updated_at<?`,
      [orgId],
      policy.memory
    );
    await cleanup(
      'ai_feedback',
      `organization_id=? AND feedback_type!='correction' AND created_at<?`,
      [orgId],
      policy.feedback
    );
    await cleanup(
      'ai_actions_log',
      `organization_id=? AND created_at<?`,
      [orgId],
      policy.actionLogs
    );
    await cleanup(
      'ai_security_audit_log',
      `organization_id=? AND created_at<?`,
      [orgId],
      policy.securityLogs
    );
    await cleanup('ai_cost_usage', `organization_id=? AND created_at<?`, [orgId], policy.costUsage);
    await cleanup(
      'ai_quality_metrics',
      `organization_id=? AND created_at<?`,
      [orgId],
      policy.qualityMetrics
    );

    const total = results.reduce((s, r) => s + r.deleted, 0);
    logger.info(`[RetentionPolicy] Cleanup org=${orgId}: ${total} rows in ${Date.now() - start}ms`);
    return {
      organizationId: orgId,
      policy,
      results: results.filter((r) => r.deleted > 0),
      totalDeleted: total,
      elapsedMs: Date.now() - start,
    };
  }

  async executeGlobalCleanup() {
    const start = Date.now();
    try {
      const orgs = (await dbAll(
        `SELECT DISTINCT organization_id FROM conversations WHERE organization_id IS NOT NULL`,
        []
      )) as any[];
      let total = 0;
      for (const o of orgs || []) {
        if (o.organization_id) {
          const r = await this.executeCleanup(o.organization_id);
          total += r.totalDeleted;
        }
      }
      return { orgs: (orgs || []).length, totalDeleted: total, elapsedMs: Date.now() - start };
    } catch {
      return { orgs: 0, totalDeleted: 0, elapsedMs: Date.now() - start };
    }
  }
}

export const retentionPolicyService = new RetentionPolicyServiceImpl();
export default retentionPolicyService;
