import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

export type InitiativeHeaderSource = 'CANONICAL' | 'LEGACY';

export interface InitiativeHeader {
  id: string;
  title: string;
  lifecycleState: string;
  projectId: string | null;
  ownerId: string | null;
  source: InitiativeHeaderSource;
}

export interface InitiativeHeaderFilters {
  projectId?: string;
  status?: string;
  search?: string;
}

const LEGACY_TO_RUNTIME: Record<string, string> = {
  DRAFT: 'REGISTERED_DRAFT',
  PROPOSED: 'DEFINED',
  PENDING_APPROVAL: 'READY_FOR_DECISION',
  APPROVED: 'APPROVED_BACKLOG',
  IN_EXECUTION: 'IN_EXECUTION',
  EXECUTING: 'IN_EXECUTION',
  REJECTED: 'ARCHIVED',
  CLOSED: 'CLOSED',
};

function objectPayload(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function canonicalHeader(row: Record<string, unknown>): InitiativeHeader {
  const payload = objectPayload(row.payload_json);
  const id = text(row.aggregate_id);
  const rawState = text(payload.lifecycleState) || text(payload.status) || 'REGISTERED_DRAFT';
  const lifecycleState = LEGACY_TO_RUNTIME[rawState.toUpperCase()] || rawState;
  const title = text(payload.title) || text(payload.name);
  const header: InitiativeHeader = {
    id,
    title: title || id,
    lifecycleState,
    projectId: text(payload.projectId) || null,
    ownerId: text(payload.initiativeOwnerId) || text(payload.ownerId) || null,
    source: 'CANONICAL',
  };
  if (!title || !header.projectId || !header.ownerId) {
    logger.warn('[initiativeUnifiedReader] canonical record has unmapped header fields', {
      organizationId: row.organization_id,
      initiativeId: id,
      missing: [
        !title && 'title',
        !header.projectId && 'projectId',
        !header.ownerId && 'ownerId',
      ].filter(Boolean),
    });
  }
  return header;
}

function legacyHeader(row: Record<string, unknown>): InitiativeHeader {
  const id = text(row.id);
  const rawState = text(row.status) || 'DRAFT';
  const title = text(row.title) || text(row.name);
  const header: InitiativeHeader = {
    id,
    title: title || id,
    lifecycleState: LEGACY_TO_RUNTIME[rawState.toUpperCase()] || rawState,
    projectId: text(row.project_id) || null,
    ownerId: text(row.owner_business_id) || text(row.owner_execution_id) || null,
    source: 'LEGACY',
  };
  if (!title || !header.projectId || !header.ownerId) {
    logger.warn('[initiativeUnifiedReader] legacy record has unmapped header fields', {
      organizationId: row.organization_id,
      initiativeId: id,
      missing: [
        !title && 'title',
        !header.projectId && 'projectId',
        !header.ownerId && 'ownerId',
      ].filter(Boolean),
    });
  }
  return header;
}

export function isInitiativeUnifiedReadEnabled(): boolean {
  return process.env.ENABLE_INITIATIVE_UNIFIED_READ === 'true';
}

export async function initiativeExists(
  organizationId: string,
  initiativeId: string
): Promise<boolean> {
  const found = await queryHelpers.queryOne(
    `SELECT 1
       FROM (
         SELECT id FROM initiatives WHERE organization_id = ? AND id = ?
         UNION ALL
         SELECT aggregate_id AS id FROM ie_aggregate_state
          WHERE organization_id = ? AND aggregate_type = 'initiative' AND aggregate_id = ?
       ) initiative_sources
      LIMIT 1`,
    [organizationId, initiativeId, organizationId, initiativeId]
  );
  return Boolean(found);
}

export async function readInitiativeHeader(
  organizationId: string,
  initiativeId: string
): Promise<InitiativeHeader | null> {
  const canonical = await queryHelpers.queryOne<Record<string, unknown>>(
    `SELECT organization_id, aggregate_id, payload_json
       FROM ie_aggregate_state
      WHERE organization_id = ? AND aggregate_type = 'initiative' AND aggregate_id = ?`,
    [organizationId, initiativeId]
  );
  if (canonical) return canonicalHeader(canonical);
  const legacy = await queryHelpers.queryOne<Record<string, unknown>>(
    `SELECT id, organization_id, title, name, status, project_id,
            owner_business_id, owner_execution_id
       FROM initiatives WHERE organization_id = ? AND id = ?`,
    [organizationId, initiativeId]
  );
  return legacy ? legacyHeader(legacy) : null;
}

export async function listInitiativeHeaders(
  organizationId: string,
  filters: InitiativeHeaderFilters = {}
): Promise<InitiativeHeader[]> {
  const [canonicalRows, legacyRows] = await Promise.all([
    queryHelpers.queryAll<Record<string, unknown>>(
      `SELECT organization_id, aggregate_id, payload_json
         FROM ie_aggregate_state
        WHERE organization_id = ? AND aggregate_type = 'initiative'`,
      [organizationId]
    ),
    queryHelpers.queryAll<Record<string, unknown>>(
      `SELECT id, organization_id, title, name, status, project_id,
              owner_business_id, owner_execution_id
         FROM initiatives WHERE organization_id = ?`,
      [organizationId]
    ),
  ]);
  const byId = new Map<string, InitiativeHeader>();
  for (const row of legacyRows) {
    const header = legacyHeader(row);
    byId.set(header.id, header);
  }
  for (const row of canonicalRows) {
    const header = canonicalHeader(row);
    byId.set(header.id, header);
  }
  const search = text(filters.search).toLowerCase();
  return [...byId.values()].filter((header) => {
    if (filters.projectId && header.projectId !== filters.projectId) return false;
    if (
      filters.status &&
      header.lifecycleState !== LEGACY_TO_RUNTIME[filters.status.toUpperCase()] &&
      header.lifecycleState !== filters.status
    )
      return false;
    if (search && !header.title.toLowerCase().includes(search)) return false;
    return true;
  });
}
