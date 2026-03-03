import { randomUUID } from 'node:crypto';

import * as DbPromise from '../../utils/DbPromise.js';
import { appCache } from '../redis/CacheService.js';
import { aiLogger } from './logger.js';
import type { Tier } from './modelRouter.js';

export type RoutingRuleType = 'cost' | 'latency' | 'health' | 'geographic' | 'load_balance';

export type RoutingRuleRow = {
  id: string;
  organization_id: string | null;
  name: string;
  description: string | null;
  type: RoutingRuleType;
  priority: number;
  is_active: boolean | number;
  config_json: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
};

export type RoutingRule = {
  id: string;
  organizationId: string | null;
  name: string;
  description: string;
  type: RoutingRuleType;
  priority: number;
  isActive: boolean;
  config: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

type Candidate = {
  id?: string;
  provider: string;
  model_id?: string;
  cost_per_1k?: number | null;
  health_status?: string | null;
  execution_regions?: any;
};

function toBool(v: any): boolean {
  return v === true || v === 1 || String(v).toLowerCase() === 'true';
}

function safeJsonParse(input: unknown, fallback: any) {
  if (typeof input !== 'string') return fallback;
  try {
    return JSON.parse(input);
  } catch {
    return fallback;
  }
}

function normalizeRule(row: RoutingRuleRow): RoutingRule {
  const config = safeJsonParse(row.config_json || '{}', {});
  return {
    id: String(row.id),
    organizationId: row.organization_id ? String(row.organization_id) : null,
    name: String(row.name || ''),
    description: String(row.description || ''),
    type: String(row.type) as RoutingRuleType,
    priority: Number(row.priority || 0) || 0,
    isActive: toBool(row.is_active),
    config: typeof config === 'object' && config ? config : {},
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: row.created_at ? String(row.created_at) : null,
    updatedBy: row.updated_by ? String(row.updated_by) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

async function ensureSchema(): Promise<void> {
  // Best-effort schema for environments where migrations are not applied (DB_MANAGED_SCHEMA=off).
  try {
    await DbPromise.run(
      `CREATE TABLE IF NOT EXISTS llm_routing_rules (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        config_json TEXT DEFAULT '{}',
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      [],
      { fallback: true }
    );
    await DbPromise.run(
      `CREATE INDEX IF NOT EXISTS idx_llm_routing_rules_org ON llm_routing_rules(organization_id)`,
      [],
      { fallback: true }
    );
    await DbPromise.run(
      `CREATE INDEX IF NOT EXISTS idx_llm_routing_rules_active ON llm_routing_rules(is_active)`,
      [],
      { fallback: true }
    );
    await DbPromise.run(
      `CREATE INDEX IF NOT EXISTS idx_llm_routing_rules_priority ON llm_routing_rules(priority)`,
      [],
      { fallback: true }
    );
  } catch {
    // ignore - legacy envs
  }
}

type ListParams = { organizationId?: string | null; includeInactive?: boolean };

async function listRules(params: ListParams = {}): Promise<RoutingRule[]> {
  await ensureSchema();
  const orgId = params.organizationId ? String(params.organizationId).trim() : '';
  const includeInactive = !!params.includeInactive;

  const whereParts: string[] = [];
  const sqlParams: any[] = [];

  if (!includeInactive) whereParts.push('is_active = TRUE');
  if (orgId) {
    whereParts.push('(organization_id = ? OR organization_id IS NULL)');
    sqlParams.push(orgId);
  }

  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const rows = await DbPromise.all<RoutingRuleRow>(
    `
      SELECT *
      FROM llm_routing_rules
      ${where}
      ORDER BY
        CASE WHEN organization_id IS NULL THEN 1 ELSE 0 END,
        priority ASC,
        created_at DESC
    `,
    sqlParams,
    { fallback: true }
  );

  return (rows || []).map(normalizeRule);
}

async function getRuleById(id: string): Promise<RoutingRule | null> {
  await ensureSchema();
  const row = await DbPromise.get<RoutingRuleRow>(
    `SELECT * FROM llm_routing_rules WHERE id = ? LIMIT 1`,
    [id],
    { fallback: true }
  );
  return row ? normalizeRule(row) : null;
}

type CreateInput = {
  organizationId?: string | null;
  name: string;
  description?: string;
  type: RoutingRuleType;
  priority?: number;
  isActive?: boolean;
  config?: Record<string, unknown>;
};

async function createRule(input: CreateInput, actorId: string): Promise<RoutingRule> {
  await ensureSchema();

  const id = randomUUID();
  const name = String(input.name || '').trim();
  if (!name) throw new Error('name is required');

  const type = String(input.type || '').trim() as RoutingRuleType;
  if (!['cost', 'latency', 'health', 'geographic', 'load_balance'].includes(type)) {
    throw new Error('Invalid type');
  }

  const orgId =
    input.organizationId != null && String(input.organizationId).trim()
      ? String(input.organizationId).trim()
      : null;
  const description = input.description ? String(input.description) : null;
  const priority = Number.isFinite(Number(input.priority)) ? Number(input.priority) : 0;
  const isActive = input.isActive === false ? 0 : 1;
  const configJson = JSON.stringify(input.config || {});

  await DbPromise.run(
    `INSERT INTO llm_routing_rules (
      id, organization_id, name, description, type, priority, is_active, config_json,
      created_by, created_at, updated_by, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)`,
    [id, orgId, name, description, type, priority, isActive, configJson, actorId, actorId],
    { fallback: false }
  );

  try {
    await appCache.publish('router:config_update', `routing_rules:${Date.now()}`);
  } catch {}

  const rule = await getRuleById(id);
  if (!rule) throw new Error('Failed to create rule');
  return rule;
}

type UpdateInput = Partial<{
  organizationId: string | null;
  name: string;
  description: string;
  type: RoutingRuleType;
  priority: number;
  isActive: boolean;
  config: Record<string, unknown>;
}>;

async function updateRule(id: string, patch: UpdateInput, actorId: string): Promise<RoutingRule> {
  await ensureSchema();
  const existing = await getRuleById(id);
  if (!existing) throw new Error('Rule not found');

  const next = {
    organizationId:
      patch.organizationId !== undefined ? (patch.organizationId ? String(patch.organizationId) : null) : existing.organizationId,
    name: patch.name !== undefined ? String(patch.name).trim() : existing.name,
    description: patch.description !== undefined ? String(patch.description || '') : existing.description,
    type: patch.type !== undefined ? (String(patch.type) as RoutingRuleType) : existing.type,
    priority: patch.priority !== undefined ? Number(patch.priority || 0) : existing.priority,
    isActive: patch.isActive !== undefined ? !!patch.isActive : existing.isActive,
    config: patch.config !== undefined ? (patch.config || {}) : existing.config,
  };

  if (!next.name) throw new Error('name is required');
  if (!['cost', 'latency', 'health', 'geographic', 'load_balance'].includes(next.type)) {
    throw new Error('Invalid type');
  }

  await DbPromise.run(
    `UPDATE llm_routing_rules
     SET organization_id = ?,
         name = ?,
         description = ?,
         type = ?,
         priority = ?,
         is_active = ?,
         config_json = ?,
         updated_by = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      next.organizationId,
      next.name,
      next.description || null,
      next.type,
      next.priority,
      next.isActive ? 1 : 0,
      JSON.stringify(next.config || {}),
      actorId,
      id,
    ],
    { fallback: false }
  );

  try {
    await appCache.publish('router:config_update', `routing_rules:${Date.now()}`);
  } catch {}

  const rule = await getRuleById(id);
  if (!rule) throw new Error('Failed to update rule');
  return rule;
}

async function deleteRule(id: string, actorId: string): Promise<void> {
  await ensureSchema();
  // Prefer hard delete. If some envs disallow, fallback to deactivate.
  try {
    await DbPromise.run(`DELETE FROM llm_routing_rules WHERE id = ?`, [id], { fallback: false });
  } catch {
    await DbPromise.run(
      `UPDATE llm_routing_rules SET is_active = FALSE, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [actorId, id],
      { fallback: true }
    );
  }
  try {
    await appCache.publish('router:config_update', `routing_rules:${Date.now()}`);
  } catch {}
}

async function getProviderLatencyAverages(options: {
  organizationId?: string | null;
  windowMinutes?: number;
}): Promise<Map<string, number>> {
  const windowMinutes = Number(options.windowMinutes || 30) || 30;
  const orgId = options.organizationId ? String(options.organizationId).trim() : '';

  const whereOrg = orgId ? 'AND organization_id = ?' : '';
  const params = orgId ? [orgId] : [];

  const rows = await DbPromise.all<{ provider: string; avg_latency_ms: number }>(
    `
      SELECT provider, AVG(latency_ms) as avg_latency_ms
      FROM ai_usage_logs
      WHERE status = 'success'
        AND latency_ms IS NOT NULL
        AND latency_ms > 0
        AND created_at >= datetime('now', '-${windowMinutes} minutes')
        ${whereOrg}
      GROUP BY provider
    `,
    params,
    { fallback: true }
  );

  const map = new Map<string, number>();
  for (const r of rows || []) {
    const k = String((r as any)?.provider || '').toLowerCase();
    const v = Number((r as any)?.avg_latency_ms);
    if (k && Number.isFinite(v)) map.set(k, v);
  }
  return map;
}

function ruleApplies(rule: RoutingRule, ctx: { tier: string; purpose?: string }) {
  const cfg: any = rule.config || {};
  const tiers = Array.isArray(cfg?.tiers) ? cfg.tiers.map((t: any) => String(t).toUpperCase()) : null;
  const purposes = Array.isArray(cfg?.purposes) ? cfg.purposes.map((p: any) => String(p)) : null;
  if (tiers && tiers.length && !tiers.includes(String(ctx.tier || '').toUpperCase())) return false;
  if (purposes && purposes.length) {
    const p = String(ctx.purpose || '');
    if (!p || !purposes.includes(p)) return false;
  }
  return true;
}

export type ApplyResult<T> = {
  candidates: T[];
  selectionStrategy?: { kind: 'round_robin' | 'weighted_random'; weights?: Record<string, number> };
  appliedRuleIds: string[];
};

async function applyRulesToCandidates<T extends Candidate>(params: {
  candidates: T[];
  tier: Tier;
  purpose?: string;
  organizationId?: string | null;
}): Promise<ApplyResult<T>> {
  const { candidates, tier, purpose } = params;
  const orgId = params.organizationId ? String(params.organizationId).trim() : null;
  if (!candidates || candidates.length === 0) return { candidates: [], appliedRuleIds: [] };

  const cacheKey = `routing_rules:${orgId || 'global'}`;
  let rules: RoutingRule[] | null = null;

  try {
    const cached = await appCache.get(cacheKey);
    if (cached) rules = safeJsonParse(cached, null);
  } catch {}

  if (!rules) {
    rules = await listRules({ organizationId: orgId, includeInactive: false }).catch(() => []);
    try {
      await appCache.set(cacheKey, JSON.stringify(rules), 30);
    } catch {}
  }

  const active = (rules || [])
    .filter((r) => r.isActive)
    .filter((r) => ruleApplies(r, { tier, purpose }))
    .sort((a, b) => (a.priority || 0) - (b.priority || 0));

  let out = [...candidates];
  const appliedRuleIds: string[] = [];
  let selectionStrategy: ApplyResult<T>['selectionStrategy'] | undefined;

  // Optional latency data for latency rules.
  const needsLatency = active.some((r) => r.type === 'latency');
  const latencyAvg = needsLatency
    ? await getProviderLatencyAverages({ organizationId: orgId, windowMinutes: 30 }).catch(() => new Map())
    : new Map<string, number>();

  for (const rule of active) {
    const cfg: any = rule.config || {};
    if (rule.type === 'health') {
      const hasHealthy = out.some((c) => String((c as any).health_status || '').toLowerCase() === 'healthy');
      if (hasHealthy) {
        const filtered = out.filter(
          (c) => String((c as any).health_status || '').toLowerCase() === 'healthy'
        );
        if (filtered.length) {
          out = filtered;
          appliedRuleIds.push(rule.id);
        }
      }
      continue;
    }

    if (rule.type === 'cost') {
      const threshold = Number(cfg?.threshold);
      if (Number.isFinite(threshold) && threshold > 0) {
        const filtered = out.filter((c) => {
          const v = Number((c as any)?.cost_per_1k);
          if (!Number.isFinite(v)) return false;
          return v <= threshold;
        });
        if (filtered.length) {
          out = filtered;
          appliedRuleIds.push(rule.id);
        } else {
          // Optional fallback provider pin (by provider id or provider name)
          const fb = String(cfg?.fallbackProvider || '').trim();
          if (fb) {
            const pinned = out.find(
              (c) =>
                String((c as any)?.id || '').trim() === fb ||
                String((c as any)?.provider || '').toLowerCase() === fb.toLowerCase()
            );
            if (pinned) {
              out = [pinned];
              appliedRuleIds.push(rule.id);
            }
          }
        }
      }
      continue;
    }

    if (rule.type === 'latency') {
      const threshold = Number(cfg?.threshold);
      if (Number.isFinite(threshold) && threshold > 0) {
        const filtered = out.filter((c) => {
          const key = String((c as any)?.provider || '').toLowerCase();
          const avg = latencyAvg.get(key);
          if (!Number.isFinite(avg)) return true; // unknown -> keep
          return avg <= threshold;
        });
        if (filtered.length) {
          out = filtered;
          appliedRuleIds.push(rule.id);
        }
      }
      continue;
    }

    if (rule.type === 'geographic') {
      const region = String(cfg?.region || '').trim().toUpperCase();
      if (region) {
        const filtered = out.filter((c) => {
          const raw = (c as any)?.execution_regions;
          const arr = Array.isArray(raw)
            ? raw
            : typeof raw === 'string'
              ? safeJsonParse(raw, null)
              : null;
          if (!Array.isArray(arr)) return true; // unknown -> keep
          return arr.map((x: any) => String(x).toUpperCase()).includes(region);
        });
        if (filtered.length) {
          out = filtered;
          appliedRuleIds.push(rule.id);
        }
      }
      continue;
    }

    if (rule.type === 'load_balance') {
      const kindRaw = String(cfg?.strategy || '').trim().toLowerCase();
      const kind =
        kindRaw === 'weighted_random' || kindRaw === 'weighted'
          ? 'weighted_random'
          : 'round_robin';
      if (kind === 'weighted_random') {
        const weightsRaw = cfg?.weights;
        const weights =
          weightsRaw && typeof weightsRaw === 'object' ? (weightsRaw as Record<string, number>) : undefined;
        selectionStrategy = { kind: 'weighted_random', weights };
        appliedRuleIds.push(rule.id);
      }
      continue;
    }
  }

  if (appliedRuleIds.length) {
    aiLogger.info('RoutingRules', 'Applied routing rules', {
      organizationId: orgId || 'global',
      tier,
      purpose: purpose || null,
      appliedRuleIds,
      candidatesBefore: candidates.length,
      candidatesAfter: out.length,
      strategy: selectionStrategy?.kind || 'round_robin',
    });
  }

  return { candidates: out, selectionStrategy, appliedRuleIds };
}

function pickWeightedRandom<T extends Candidate>(candidates: T[], weights?: Record<string, number>): T {
  const w = weights || {};
  const items = candidates.map((c) => {
    const key = String((c as any)?.id || (c as any)?.provider || '').trim();
    const v = Number((w as any)[key]);
    const weight = Number.isFinite(v) && v > 0 ? v : 1;
    return { c, weight };
  });
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let r = Math.random() * total;
  for (const i of items) {
    r -= i.weight;
    if (r <= 0) return i.c;
  }
  return items[items.length - 1].c;
}

export const routingRulesService = {
  ensureSchema,
  listRules,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
  applyRulesToCandidates,
  pickWeightedRandom,
};

