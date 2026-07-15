/**
 * HP-25 B2 — SCIM group-mapping resolution WITH an optional per-project dimension.
 *
 * Context / security:
 * - `scim_group_mappings` maps an external IdP group (Entra/Okta) → an internal
 *   role. Historically the mapping was ONLY org-wide. B2 adds an optional
 *   `project_id` so a mapping can target a specific project ("group X →
 *   PROJECT_LEADER on project Y"), while `project_id IS NULL` stays org-wide.
 * - The `project_id` column ships via a MANUAL migration
 *   (`server/migrations-manual/20260715_hp25_b2_scim_group_mappings_project_id.sql`)
 *   that is intentionally NOT wired into the auto-run migration loader. Until it
 *   is applied on a given environment, every code path here degrades to the
 *   org-wide behaviour instead of crashing or silently dropping rows.
 * - ★ Org-scope is NON-NEGOTIABLE. Every read/write is predicated on the
 *   `organizationId` the caller passes (which callers derive from the
 *   authenticated actor's token, never from request body). A `project_id`
 *   supplied by a caller is validated to belong to that same org before it is
 *   ever written — this closes the cross-org / IDOR surface that `P1`
 *   (`3edaf2a130`) flagged on this exact table.
 */
import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { hasColumn } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';

const TABLE = 'scim_group_mappings';

export type ScimGroupMappingErrorCode = 'PROJECT_NOT_IN_ORG' | 'INVALID_INPUT';

export class ScimGroupMappingError extends Error {
  code: ScimGroupMappingErrorCode;
  constructor(code: ScimGroupMappingErrorCode, message: string) {
    super(message);
    this.name = 'ScimGroupMappingError';
    this.code = code;
  }
}

export interface ScimGroupMappingRow {
  id: string;
  externalGroupId: string;
  externalGroupName: string;
  internalRole: string;
  /** null = org-wide mapping (or column not yet migrated). */
  projectId: string | null;
  projectName: string | null;
  isActive: boolean;
  memberCount: number;
}

export interface ScimGroupGrant {
  mappingId: string;
  internalRole: string;
  projectId: string | null;
  scope: 'project' | 'org-wide';
}

/**
 * Whether the `project_id` column exists on this environment. Cached by
 * `getTableColumns`; a process restart re-reads after the manual migration is
 * applied. Never throws — a lookup failure is treated as "column absent" so we
 * fall back to org-wide behaviour rather than 500.
 */
export async function scimMappingsHasProjectId(): Promise<boolean> {
  try {
    return await hasColumn(TABLE, 'project_id');
  } catch {
    return false;
  }
}

function toBool(value: unknown): boolean {
  if (value === undefined || value === null) return true; // default active
  if (typeof value === 'boolean') return value;
  return Number(value) !== 0;
}

/**
 * List an organization's group mappings. Org-scoped by `orgId`. Tolerates the
 * `project_id` column being absent (returns projectId=null for every row).
 */
export async function listScimGroupMappings(orgId: string): Promise<ScimGroupMappingRow[]> {
  if (!orgId) return [];
  const hasProject = await scimMappingsHasProjectId();

  const sql = hasProject
    ? `SELECT m.id, m.external_group_id, m.external_group_name, m.internal_role,
              m.is_active, m.member_count, m.project_id, p.name AS project_name
         FROM ${TABLE} m
         LEFT JOIN projects p
           ON p.id = m.project_id AND p.organization_id = m.organization_id
         WHERE m.organization_id = ?
         ORDER BY m.created_at DESC`
    : `SELECT id, external_group_id, external_group_name, internal_role,
              is_active, member_count
         FROM ${TABLE}
         WHERE organization_id = ?
         ORDER BY created_at DESC`;

  const rows = await dbAll<Record<string, unknown>>(sql, [orgId], { fallback: true });
  return (rows || []).map((r) => ({
    id: String(r.id),
    externalGroupId: String(r.external_group_id || ''),
    externalGroupName: String(r.external_group_name || ''),
    internalRole: String(r.internal_role || 'member'),
    projectId: hasProject && r.project_id ? String(r.project_id) : null,
    projectName: hasProject && r.project_name ? String(r.project_name) : null,
    isActive: toBool(r.is_active),
    memberCount: Number(r.member_count || 0),
  }));
}

/**
 * Insert an org-scoped group mapping with an optional project dimension.
 *
 * Security invariants:
 * - `orgId` is authoritative (caller passes the token org). It is the only org
 *   predicate written; there is no body-supplied organization anywhere here.
 * - A non-null `projectId` MUST resolve to a project inside `orgId`, else we
 *   throw `PROJECT_NOT_IN_ORG` (403/404 at the route) — never write a mapping
 *   that points at another tenant's project.
 * - If the `project_id` column is not yet migrated, the mapping is stored
 *   org-wide and the requested project is dropped (logged), matching the
 *   documented fallback contract.
 */
export async function insertScimGroupMapping(params: {
  orgId: string;
  externalGroupName: string;
  externalGroupId: string;
  internalRole: string;
  projectId?: string | null;
}): Promise<ScimGroupMappingRow & { projectIdApplied: boolean }> {
  const orgId = String(params.orgId || '').trim();
  if (!orgId) throw new ScimGroupMappingError('INVALID_INPUT', 'organizationId is required');

  const id = uuidv4();
  const role = String(params.internalRole || 'member').trim() || 'member';
  const externalGroupId = String(params.externalGroupId || '').trim();
  const externalGroupName = String(params.externalGroupName || '').trim();
  let projectId = params.projectId ? String(params.projectId).trim() : null;
  let projectName: string | null = null;

  const hasProject = await scimMappingsHasProjectId();

  // Org-scope guard for the project dimension. Validate BEFORE any write.
  if (projectId) {
    const project = await dbGet<{ id?: string; name?: string }>(
      `SELECT id, name FROM projects WHERE id = ? AND organization_id = ? LIMIT 1`,
      [projectId, orgId],
      { fallback: true }
    );
    if (!project?.id) {
      throw new ScimGroupMappingError(
        'PROJECT_NOT_IN_ORG',
        'Project not found in this organization'
      );
    }
    projectName = project.name ? String(project.name) : null;
  }

  if (hasProject) {
    await dbRun(
      `INSERT INTO ${TABLE}
         (id, organization_id, external_group_id, external_group_name, internal_role, project_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, orgId, externalGroupId, externalGroupName, role, projectId]
    );
  } else {
    if (projectId) {
      logger.warn(
        `[scimGroupMapping] project_id column absent — mapping ${id} stored org-wide; ` +
          `requested projectId ${projectId} ignored until manual migration is applied`
      );
      projectId = null;
      projectName = null;
    }
    await dbRun(
      `INSERT INTO ${TABLE}
         (id, organization_id, external_group_id, external_group_name, internal_role)
       VALUES (?, ?, ?, ?, ?)`,
      [id, orgId, externalGroupId, externalGroupName, role]
    );
  }

  return {
    id,
    externalGroupId,
    externalGroupName,
    internalRole: role,
    projectId,
    projectName,
    isActive: true,
    memberCount: 0,
    projectIdApplied: hasProject && Boolean(projectId),
  };
}

/**
 * Resolve the effective grant for an external group, honouring the per-project
 * dimension with a precise precedence:
 *   1. A project-specific mapping (organization + group + project_id) wins.
 *   2. Otherwise the org-wide mapping (project_id IS NULL) applies.
 * When the column is not migrated, only step 2 exists (org-wide).
 *
 * Always org-scoped by `orgId`. Returns null when nothing maps.
 */
export async function resolveScimGroupGrant(
  orgId: string,
  externalGroupId: string,
  projectId?: string | null
): Promise<ScimGroupGrant | null> {
  const org = String(orgId || '').trim();
  const group = String(externalGroupId || '').trim();
  if (!org || !group) return null;

  const hasProject = await scimMappingsHasProjectId();
  const scopedProjectId = projectId ? String(projectId).trim() : null;

  // 1. Project-specific mapping wins (only meaningful when column + project present).
  if (hasProject && scopedProjectId) {
    const row = await dbGet<Record<string, unknown>>(
      `SELECT id, internal_role FROM ${TABLE}
         WHERE organization_id = ? AND external_group_id = ? AND project_id = ?
         ORDER BY created_at DESC LIMIT 1`,
      [org, group, scopedProjectId],
      { fallback: true }
    );
    if (row?.id) {
      return {
        mappingId: String(row.id),
        internalRole: String(row.internal_role || 'member'),
        projectId: scopedProjectId,
        scope: 'project',
      };
    }
  }

  // 2. Org-wide fallback (project_id IS NULL, or column absent entirely).
  const orgWideSql = hasProject
    ? `SELECT id, internal_role FROM ${TABLE}
         WHERE organization_id = ? AND external_group_id = ? AND project_id IS NULL
         ORDER BY created_at DESC LIMIT 1`
    : `SELECT id, internal_role FROM ${TABLE}
         WHERE organization_id = ? AND external_group_id = ?
         ORDER BY created_at DESC LIMIT 1`;
  const orgRow = await dbGet<Record<string, unknown>>(orgWideSql, [org, group], { fallback: true });
  if (orgRow?.id) {
    return {
      mappingId: String(orgRow.id),
      internalRole: String(orgRow.internal_role || 'member'),
      projectId: null,
      scope: 'org-wide',
    };
  }

  return null;
}
