/**
 * Model Registry Service
 * V3-A06: SuperAdmin Model Registry - CRUD, purpose assignments, purpose-based routing
 */

import { randomUUID } from 'node:crypto';

import type {
  HealthStatus,
  ModelAuditLog,
  ModelKind,
  ModelRegistryEntry,
  ModelRequirements,
  PurposeAssignment,
  PurposeRoutingRequest,
  PurposeRoutingResult,
} from '../../types/modelRegistry.js';
import * as DbPromise from '../../utils/DbPromise.js';
import { aiLogger } from './logger.js';

const DEFAULT_CAPABILITIES = {
  vision: false,
  tools: false,
  streaming: true,
  jsonMode: false,
  contextWindow: 8192,
};

function parseCapabilities(val: unknown): ModelRegistryEntry['capabilities'] {
  if (!val) return DEFAULT_CAPABILITIES;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return { ...DEFAULT_CAPABILITIES, ...parsed };
    } catch {
      return DEFAULT_CAPABILITIES;
    }
  }
  if (typeof val === 'object' && val !== null) {
    return { ...DEFAULT_CAPABILITIES, ...(val as Record<string, unknown>) };
  }
  return DEFAULT_CAPABILITIES;
}

function parseStringArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((x) => String(x).trim()).filter(Boolean);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.map((x) => String(x).trim()).filter(Boolean) : [];
    } catch {
      return val
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function rowToModel(row: Record<string, unknown>): ModelRegistryEntry {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    provider: String(row.provider ?? ''),
    providerType: (row.provider_type as ModelRegistryEntry['providerType']) ?? 'aggregator',
    originVendor: String(row.origin_vendor ?? ''),
    modelId: String(row.model_id ?? ''),
    kind: (row.kind as ModelKind) ?? 'TEXT_LLM',
    isActive: Boolean(row.is_active === true || row.is_active === 1),
    healthStatus: (row.health_status as HealthStatus) ?? 'unknown',
    lastHealthCheck: row.last_health_check ? new Date(row.last_health_check as string) : undefined,
    avgLatencyMs: typeof row.avg_latency_ms === 'number' ? row.avg_latency_ms : undefined,
    costPer1k: typeof row.cost_per_1k === 'number' ? row.cost_per_1k : undefined,
    capabilities: parseCapabilities(row.capabilities_json),
    executionRegions: parseStringArray(row.execution_regions),
    allowedDataClasses: parseStringArray(row.allowed_data_classes),
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function rowToAssignment(row: Record<string, unknown>): PurposeAssignment {
  return {
    id: String(row.id ?? ''),
    purpose: String(row.purpose ?? ''),
    kind: (row.kind as ModelKind) ?? 'TEXT_LLM',
    registryModelId: String(row.registry_model_id ?? ''),
    tier: row.tier ? String(row.tier) : undefined,
    priority: Number(row.priority ?? 0),
    isActive: Boolean(row.is_active === true || row.is_active === 1),
    fallbackModelId: row.fallback_model_id ? String(row.fallback_model_id) : undefined,
  };
}

function rowToAuditLog(row: Record<string, unknown>): ModelAuditLog {
  let changes: Record<string, unknown> = {};
  if (row.changes_json) {
    try {
      changes =
        typeof row.changes_json === 'string'
          ? JSON.parse(row.changes_json)
          : (row.changes_json as Record<string, unknown>);
    } catch {
      /* ignore */
    }
  }
  return {
    id: String(row.id ?? ''),
    action: row.action as ModelAuditLog['action'],
    entityType: row.entity_type as ModelAuditLog['entityType'],
    entityId: String(row.entity_id ?? ''),
    changedBy: String(row.changed_by ?? ''),
    changedAt: new Date(row.changed_at as string),
    changes,
  };
}

export class ModelRegistryService {
  // ---------------------------------------------------------------------------
  // CRUD for models
  // ---------------------------------------------------------------------------

  async getModels(filters?: {
    kind?: ModelKind;
    isActive?: boolean;
    healthStatus?: HealthStatus;
  }): Promise<ModelRegistryEntry[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.kind) {
      conditions.push('kind = ?');
      params.push(filters.kind);
    }
    if (filters?.isActive !== undefined) {
      conditions.push('is_active = ?');
      params.push(filters.isActive ? 1 : 0);
    }
    if (filters?.healthStatus) {
      conditions.push('health_status = ?');
      params.push(filters.healthStatus);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await DbPromise.all<Record<string, unknown>>(
      `SELECT * FROM model_registry ${where} ORDER BY name`,
      params,
      { fallback: true }
    );
    return (rows || []).map(rowToModel);
  }

  async getModel(id: string): Promise<ModelRegistryEntry | null> {
    const row = await DbPromise.get<Record<string, unknown>>(
      'SELECT * FROM model_registry WHERE id = ?',
      [id],
      { fallback: true }
    );
    return row ? rowToModel(row) : null;
  }

  async createModel(
    data: Omit<ModelRegistryEntry, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ModelRegistryEntry> {
    const id = randomUUID();
    const now = new Date().toISOString();
    await DbPromise.run(
      `INSERT INTO model_registry (
        id, name, provider, provider_type, origin_vendor, model_id, kind,
        is_active, health_status, last_health_check, avg_latency_ms, cost_per_1k,
        capabilities_json, execution_regions, allowed_data_classes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.provider,
        data.providerType,
        data.originVendor,
        data.modelId,
        data.kind,
        data.isActive ? 1 : 0,
        data.healthStatus ?? 'unknown',
        data.lastHealthCheck?.toISOString() ?? null,
        data.avgLatencyMs ?? null,
        data.costPer1k ?? null,
        JSON.stringify(data.capabilities ?? DEFAULT_CAPABILITIES),
        JSON.stringify(data.executionRegions ?? []),
        JSON.stringify(data.allowedDataClasses ?? []),
        now,
        now,
      ],
      { fallback: false }
    );
    const created = await this.getModel(id);
    if (!created) throw new Error('Failed to fetch created model');
    return created;
  }

  async updateModel(id: string, data: Partial<ModelRegistryEntry>): Promise<ModelRegistryEntry> {
    const existing = await this.getModel(id);
    if (!existing) throw new Error(`Model not found: ${id}`);

    const updates: string[] = [];
    const params: unknown[] = [];

    const set = (key: string, val: unknown, dbKey?: string) => {
      if (val !== undefined) {
        updates.push(`${dbKey ?? key} = ?`);
        params.push(val);
      }
    };

    set('name', data.name);
    set('provider', data.provider);
    set('provider_type', data.providerType);
    set('origin_vendor', data.originVendor);
    set('model_id', data.modelId);
    set('kind', data.kind);
    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(data.isActive ? 1 : 0);
    }
    set('health_status', data.healthStatus);
    set('last_health_check', data.lastHealthCheck?.toISOString());
    set('avg_latency_ms', data.avgLatencyMs);
    set('cost_per_1k', data.costPer1k);
    if (data.capabilities) {
      updates.push('capabilities_json = ?');
      params.push(JSON.stringify(data.capabilities));
    }
    if (data.executionRegions) {
      updates.push('execution_regions = ?');
      params.push(JSON.stringify(data.executionRegions));
    }
    if (data.allowedDataClasses) {
      updates.push('allowed_data_classes = ?');
      params.push(JSON.stringify(data.allowedDataClasses));
    }

    if (updates.length === 0) return existing;

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    await DbPromise.run(`UPDATE model_registry SET ${updates.join(', ')} WHERE id = ?`, params, {
      fallback: false,
    });
    const updated = await this.getModel(id);
    if (!updated) throw new Error('Failed to fetch updated model');
    return updated;
  }

  async deleteModel(id: string): Promise<void> {
    const result = await DbPromise.run('DELETE FROM model_registry WHERE id = ?', [id], {
      fallback: false,
    });
    if (result.changes === 0) throw new Error(`Model not found: ${id}`);
  }

  // ---------------------------------------------------------------------------
  // Purpose assignments
  // ---------------------------------------------------------------------------

  async getAssignments(kind?: ModelKind): Promise<PurposeAssignment[]> {
    const where = kind ? 'WHERE kind = ?' : '';
    const params = kind ? [kind] : [];
    const rows = await DbPromise.all<Record<string, unknown>>(
      `SELECT * FROM purpose_assignments ${where} ORDER BY purpose, priority`,
      params,
      { fallback: true }
    );
    return (rows || []).map(rowToAssignment);
  }

  async getAssignmentsByPurpose(purpose: string): Promise<PurposeAssignment[]> {
    const rows = await DbPromise.all<Record<string, unknown>>(
      'SELECT * FROM purpose_assignments WHERE purpose = ? ORDER BY priority',
      [purpose],
      { fallback: true }
    );
    return (rows || []).map(rowToAssignment);
  }

  async setAssignment(data: Omit<PurposeAssignment, 'id'>): Promise<PurposeAssignment> {
    const id = randomUUID();
    const now = new Date().toISOString();
    await DbPromise.run(
      `INSERT INTO purpose_assignments (
        id, purpose, kind, registry_model_id, tier, priority, is_active,
        fallback_model_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.purpose,
        data.kind,
        data.registryModelId,
        data.tier ?? null,
        data.priority ?? 0,
        data.isActive !== false ? 1 : 0,
        data.fallbackModelId ?? null,
        now,
        now,
      ],
      { fallback: false }
    );
    const created = await DbPromise.get<Record<string, unknown>>(
      'SELECT * FROM purpose_assignments WHERE id = ?',
      [id],
      { fallback: false }
    );
    if (!created) throw new Error('Failed to fetch created assignment');
    return rowToAssignment(created);
  }

  async removeAssignment(id: string): Promise<void> {
    const result = await DbPromise.run('DELETE FROM purpose_assignments WHERE id = ?', [id], {
      fallback: false,
    });
    if (result.changes === 0) throw new Error(`Assignment not found: ${id}`);
  }

  async reorderAssignments(purpose: string, orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await DbPromise.run(
        'UPDATE purpose_assignments SET priority = ?, updated_at = ? WHERE id = ? AND purpose = ?',
        [i, new Date().toISOString(), orderedIds[i], purpose],
        { fallback: false }
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Purpose-based routing
  // ---------------------------------------------------------------------------

  async resolveModel(request: PurposeRoutingRequest): Promise<PurposeRoutingResult> {
    const { organizationId, purpose, requirements = {}, options = {} } = request;
    const purposeStr = String(purpose || '').trim();
    if (!purposeStr) {
      throw new Error('Purpose is required for model resolution');
    }

    const assignments = await this.getAssignmentsByPurpose(purposeStr);
    const activeAssignments = assignments
      .filter((a) => a.isActive)
      .sort((a, b) => a.priority - b.priority);

    if (activeAssignments.length === 0) {
      throw new Error(`No active assignments found for purpose: ${purposeStr}`);
    }

    // Load org policy if organizationId provided
    let orgPolicy: Record<string, unknown> | null = null;
    if (organizationId) {
      try {
        const row = await DbPromise.get<{ policy?: string }>(
          'SELECT policy FROM organization_ai_policy WHERE organization_id = ?',
          [organizationId],
          { fallback: true }
        );
        if (row?.policy) {
          orgPolicy =
            typeof row.policy === 'string'
              ? JSON.parse(row.policy)
              : (row.policy as Record<string, unknown>);
        }
      } catch {
        /* ignore */
      }
    }

    const dataClass = options.dataClass ?? 'no_pii';

    // Build candidate list: primary then fallbacks
    const tryCandidates = async (
      ids: string[],
      isFallback: boolean,
      fallbackReason?: string
    ): Promise<PurposeRoutingResult | null> => {
      for (const registryModelId of ids) {
        const model = await this.getModel(registryModelId);
        if (!model || !model.isActive) continue;

        // Health gating: exclude unhealthy
        if (model.healthStatus === 'unhealthy') continue;

        // Org policy filter
        if (orgPolicy) {
          const pt = String(model.providerType || '').toLowerCase();
          const origin = String(model.originVendor || '').toLowerCase();
          const regions = model.executionRegions.map((r) => r.toUpperCase());

          const denyProviderTypes = new Set(
            (Array.isArray(orgPolicy.deny_provider_types)
              ? orgPolicy.deny_provider_types
              : (orgPolicy.denyProviderTypes as string[]) || []
            ).map((x: string) => String(x).toLowerCase())
          );
          if (denyProviderTypes.size > 0 && denyProviderTypes.has(pt)) continue;

          const requireLocalFor = new Set(
            (Array.isArray(orgPolicy.require_local_for_data_classes)
              ? orgPolicy.require_local_for_data_classes
              : (orgPolicy.requireLocalForDataClasses as string[]) || []
            ).map((x: string) => String(x).toLowerCase())
          );
          if (requireLocalFor.has(dataClass) && pt !== 'local' && pt !== 'customer_managed')
            continue;
        }

        // Requirements filter
        if (requirements.vision && !model.capabilities.vision) continue;
        if (requirements.tools && !model.capabilities.tools) continue;
        if (requirements.streaming !== false && !model.capabilities.streaming) continue;
        if (requirements.jsonMode && !model.capabilities.jsonMode) continue;
        if (
          typeof requirements.contextWindow === 'number' &&
          (model.capabilities.contextWindow ?? 0) < requirements.contextWindow
        )
          continue;

        return {
          modelId: model.modelId,
          provider: model.provider,
          modelRegistryId: model.id,
          isFallback,
          fallbackReason,
        };
      }
      return null;
    };

    // Try primary assignments in priority order
    const primaryIds = activeAssignments.map((a) => a.registryModelId);
    const result = await tryCandidates(primaryIds, false);
    if (result) return result;

    // Try fallback chain
    for (const assignment of activeAssignments) {
      if (assignment.fallbackModelId) {
        const fallbackResult = await tryCandidates(
          [assignment.fallbackModelId],
          true,
          `Primary model ${assignment.registryModelId} unavailable`
        );
        if (fallbackResult) {
          await this.logAuditEntry({
            action: 'fallback_used',
            entityType: 'assignment',
            entityId: assignment.id,
            changedBy: 'system:model-router',
            changes: {
              purpose: purposeStr,
              organizationId,
              selectedModelRegistryId: fallbackResult.modelRegistryId,
              selectedModelId: fallbackResult.modelId,
              provider: fallbackResult.provider,
              fallbackReason: fallbackResult.fallbackReason || null,
              requirements,
              options,
            },
          });
          return fallbackResult;
        }
      }
    }

    throw new Error(
      `No model available for purpose "${purposeStr}" after applying health, policy, and capability filters`
    );
  }

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------

  async updateHealthStatus(
    modelId: string,
    status: HealthStatus,
    latencyMs?: number
  ): Promise<void> {
    const updates: string[] = ['health_status = ?', 'last_health_check = ?', 'updated_at = ?'];
    const params: unknown[] = [status, new Date().toISOString(), new Date().toISOString()];
    if (typeof latencyMs === 'number') {
      updates.push('avg_latency_ms = ?');
      params.push(latencyMs);
    }
    params.push(modelId);
    await DbPromise.run(`UPDATE model_registry SET ${updates.join(', ')} WHERE id = ?`, params, {
      fallback: false,
    });
  }

  // ---------------------------------------------------------------------------
  // Audit
  // ---------------------------------------------------------------------------

  async logAuditEntry(entry: Omit<ModelAuditLog, 'id' | 'changedAt'>): Promise<void> {
    const id = randomUUID();
    const now = new Date().toISOString();
    await DbPromise.run(
      `INSERT INTO model_audit_log (id, action, entity_type, entity_id, changed_by, changed_at, changes_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.changedBy,
        now,
        JSON.stringify(entry.changes ?? {}),
      ],
      { fallback: false }
    );
  }

  async getAuditLog(filters?: {
    entityType?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<ModelAuditLog[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.entityType) {
      conditions.push('entity_type = ?');
      params.push(filters.entityType);
    }
    if (filters?.from) {
      conditions.push('changed_at >= ?');
      params.push(filters.from.toISOString());
    }
    if (filters?.to) {
      conditions.push('changed_at <= ?');
      params.push(filters.to.toISOString());
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(filters?.limit ?? 500, 1000);
    const rows = await DbPromise.all<Record<string, unknown>>(
      `SELECT * FROM model_audit_log ${where} ORDER BY changed_at DESC LIMIT ?`,
      [...params, limit],
      { fallback: true }
    );
    return (rows || []).map(rowToAuditLog);
  }
}

export const modelRegistryService = new ModelRegistryService();
export default modelRegistryService;
