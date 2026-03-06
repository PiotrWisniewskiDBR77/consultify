/**
 * Tool Enterprise Service
 *
 * V4-TOOL-03: Template library (SWOT/PESTLE/Porter/Journey/BCG/OKR, org-curated, versioning)
 * V4-TOOL-06: Knowledge bank + scoped RAG with citations
 * V4-TOOL-07: Entitlement model (licensed packs per org, policy enforcement)
 */

import { v4 as uuidv4 } from 'uuid';
import * as queryHelpers from '../utils/queryHelpers.js';

class ToolEnterpriseService {

  // ── V4-TOOL-03: Template Library ──

  async createTemplate(orgId: string | null, data: {
    templateKey: string; templateName: string; category: string;
    description?: string; schemaJson: object; defaultConfig?: object;
    isSystem?: boolean; isOrgCurated?: boolean; createdBy?: string;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO tool_template_library (id, organization_id, template_key, template_name, category, description, schema_json, default_config, is_system, is_org_curated, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, orgId, data.templateKey, data.templateName, data.category,
       data.description ?? null, JSON.stringify(data.schemaJson),
       JSON.stringify(data.defaultConfig ?? {}),
       data.isSystem ? 1 : 0, data.isOrgCurated ? 1 : 0, data.createdBy ?? null],
    );
    return { id };
  }

  async listTemplates(orgId: string, category?: string) {
    const sql = category
      ? `SELECT * FROM tool_template_library WHERE (organization_id=$1 OR organization_id IS NULL OR is_system=1) AND category=$2 ORDER BY is_system DESC, template_name`
      : `SELECT * FROM tool_template_library WHERE (organization_id=$1 OR organization_id IS NULL OR is_system=1) ORDER BY category, is_system DESC, template_name`;
    return queryHelpers.queryAll(sql, category ? [orgId, category] : [orgId]);
  }

  async getTemplate(templateId: string) {
    return queryHelpers.queryFirst(
      `SELECT * FROM tool_template_library WHERE id=$1`, [templateId],
    );
  }

  async updateTemplate(templateId: string, data: Partial<{
    templateName: string; description: string; schemaJson: object;
    defaultConfig: object; isOrgCurated: boolean;
  }>) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (data.templateName !== undefined) { sets.push(`template_name=$${idx++}`); params.push(data.templateName); }
    if (data.description !== undefined) { sets.push(`description=$${idx++}`); params.push(data.description); }
    if (data.schemaJson !== undefined) { sets.push(`schema_json=$${idx++}`); params.push(JSON.stringify(data.schemaJson)); }
    if (data.defaultConfig !== undefined) { sets.push(`default_config=$${idx++}`); params.push(JSON.stringify(data.defaultConfig)); }
    if (data.isOrgCurated !== undefined) { sets.push(`is_org_curated=$${idx++}`); params.push(data.isOrgCurated ? 1 : 0); }

    if (sets.length === 0) return { ok: true };
    sets.push(`version=version+1`);
    sets.push(`updated_at=CURRENT_TIMESTAMP`);
    params.push(templateId);
    await queryHelpers.queryRun(
      `UPDATE tool_template_library SET ${sets.join(', ')} WHERE id=$${idx}`, params,
    );
    return { ok: true };
  }

  async deleteTemplate(templateId: string) {
    await queryHelpers.queryRun(
      `DELETE FROM tool_template_library WHERE id=$1 AND is_system=0`, [templateId],
    );
    return { deleted: true };
  }

  // ── V4-TOOL-06: Knowledge Bank + RAG ──

  async addKnowledgeEntry(orgId: string, data: {
    toolSessionId?: string; sourceType: string; sourceId: string;
    contentText?: string; embeddingVector?: string; metadata?: object;
    scope?: string;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO tool_knowledge_bank (id, organization_id, tool_session_id, source_type, source_id, content_text, embedding_vector, metadata_json, scope)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, orgId, data.toolSessionId ?? null, data.sourceType, data.sourceId,
       data.contentText ?? null, data.embeddingVector ?? null,
       data.metadata ? JSON.stringify(data.metadata) : '{}',
       data.scope ?? 'session'],
    );
    return { id };
  }

  async searchKnowledge(orgId: string, query: string, toolSessionId?: string, limit: number = 10) {
    const sql = toolSessionId
      ? `SELECT * FROM tool_knowledge_bank WHERE organization_id=$1 AND (tool_session_id=$2 OR scope='organization') AND content_text LIKE $3 ORDER BY created_at DESC LIMIT $4`
      : `SELECT * FROM tool_knowledge_bank WHERE organization_id=$1 AND content_text LIKE $2 ORDER BY created_at DESC LIMIT $3`;
    const likeQuery = `%${query}%`;
    return queryHelpers.queryAll(sql, toolSessionId ? [orgId, toolSessionId, likeQuery, limit] : [orgId, likeQuery, limit]);
  }

  async getKnowledgeEntries(orgId: string, toolSessionId?: string) {
    const sql = toolSessionId
      ? `SELECT * FROM tool_knowledge_bank WHERE organization_id=$1 AND tool_session_id=$2 ORDER BY created_at DESC`
      : `SELECT * FROM tool_knowledge_bank WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100`;
    return queryHelpers.queryAll(sql, toolSessionId ? [orgId, toolSessionId] : [orgId]);
  }

  async deleteKnowledgeEntry(entryId: string) {
    await queryHelpers.queryRun(`DELETE FROM tool_knowledge_bank WHERE id=$1`, [entryId]);
    return { deleted: true };
  }

  async createRagQuery(orgId: string, data: {
    toolSessionId?: string; queryText: string; results?: object[];
    citations?: object[];
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO tool_rag_queries (id, organization_id, tool_session_id, query_text, results_json, citations_json)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, orgId, data.toolSessionId ?? null, data.queryText,
       JSON.stringify(data.results ?? []), JSON.stringify(data.citations ?? [])],
    );
    return { id };
  }

  async getRagQueries(orgId: string, toolSessionId?: string) {
    const sql = toolSessionId
      ? `SELECT * FROM tool_rag_queries WHERE organization_id=$1 AND tool_session_id=$2 ORDER BY created_at DESC`
      : `SELECT * FROM tool_rag_queries WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 50`;
    return queryHelpers.queryAll(sql, toolSessionId ? [orgId, toolSessionId] : [orgId]);
  }

  // ── V4-TOOL-07: Entitlement Model ──

  async createEntitlement(orgId: string, data: {
    packKey: string; packName: string; licensedTools?: string[];
    maxSessionsPerMonth?: number; maxConcurrentUsers?: number;
    validFrom?: string; validUntil?: string;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO tool_entitlements (id, organization_id, pack_key, pack_name, licensed_tools, max_sessions_per_month, max_concurrent_users, valid_from, valid_until)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (organization_id, pack_key)
       DO UPDATE SET pack_name=$4, licensed_tools=$5, max_sessions_per_month=$6, max_concurrent_users=$7, valid_from=$8, valid_until=$9, updated_at=CURRENT_TIMESTAMP`,
      [id, orgId, data.packKey, data.packName,
       JSON.stringify(data.licensedTools ?? []),
       data.maxSessionsPerMonth ?? null, data.maxConcurrentUsers ?? null,
       data.validFrom ?? null, data.validUntil ?? null],
    );
    return { id };
  }

  async getEntitlements(orgId: string) {
    return queryHelpers.queryAll(
      `SELECT * FROM tool_entitlements WHERE organization_id=$1 AND is_active=1 ORDER BY pack_name`,
      [orgId],
    );
  }

  async checkEntitlement(orgId: string, toolKey: string): Promise<{ allowed: boolean; reason?: string; entitlementId?: string }> {
    const entitlements = await queryHelpers.queryAll<{ id: string; licensed_tools: string; max_sessions_per_month: number }>(
      `SELECT * FROM tool_entitlements WHERE organization_id=$1 AND is_active=1`, [orgId],
    );

    for (const ent of entitlements) {
      const tools = JSON.parse(ent.licensed_tools || '[]');
      if (tools.includes(toolKey) || tools.includes('*')) {
        if (ent.max_sessions_per_month) {
          const usage = await queryHelpers.queryFirst<{ cnt: number }>(
            `SELECT COUNT(*) as cnt FROM tool_usage_log
             WHERE organization_id=$1 AND tool_key=$2 AND entitlement_id=$3
             AND created_at > datetime('now', '-30 days')`,
            [orgId, toolKey, ent.id],
          );
          if (usage && usage.cnt >= ent.max_sessions_per_month) {
            return { allowed: false, reason: 'monthly_limit_exceeded' };
          }
        }
        return { allowed: true, entitlementId: ent.id };
      }
    }
    return { allowed: false, reason: 'no_entitlement' };
  }

  async logToolUsage(orgId: string, data: {
    userId: string; toolKey: string; entitlementId?: string; action?: string;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO tool_usage_log (id, organization_id, user_id, tool_key, entitlement_id, action)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, orgId, data.userId, data.toolKey, data.entitlementId ?? null, data.action ?? 'session_start'],
    );
    return { id };
  }

  async getUsageStats(orgId: string, toolKey?: string) {
    const sql = toolKey
      ? `SELECT tool_key, COUNT(*) as total, COUNT(DISTINCT user_id) as unique_users
         FROM tool_usage_log WHERE organization_id=$1 AND tool_key=$2
         AND created_at > datetime('now', '-30 days') GROUP BY tool_key`
      : `SELECT tool_key, COUNT(*) as total, COUNT(DISTINCT user_id) as unique_users
         FROM tool_usage_log WHERE organization_id=$1
         AND created_at > datetime('now', '-30 days') GROUP BY tool_key ORDER BY total DESC`;
    return queryHelpers.queryAll(sql, toolKey ? [orgId, toolKey] : [orgId]);
  }

  async deactivateEntitlement(orgId: string, entitlementId: string) {
    await queryHelpers.queryRun(
      `UPDATE tool_entitlements SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND organization_id=$2`,
      [entitlementId, orgId],
    );
    return { ok: true };
  }
}

export const toolEnterpriseService = new ToolEnterpriseService();
