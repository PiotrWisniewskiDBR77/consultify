// @ts-nocheck
/**
 * Stakeholder Registry Service (Zwornik Delta A)
 *
 * SSOT: Harvard/wdrozenie-100/_KONCEPT_ZWORNIK_2026-07-10.md, §3.
 *
 * Two-layer PMBOK model:
 *  - `stakeholder_registry`   — identity, once per org (identification).
 *  - `stakeholder_engagements` — RACI / influence / interest per context
 *    (project_id NULL = org baseline, project_id SET = project-level).
 *
 * Does NOT touch `initiative_stakeholders` (335) — that table keeps its own
 * live CRUD (InitiativeController.ts:5000-5200). This service only reads it
 * to build the "effective stakeholders" read-model for §3.3 (inheritance).
 *
 * Confidentiality (§3.5, P-2): influence/interest/engagement_status/notes are
 * assessment fields — POUFNE. Callers must pass `canViewAssessment` and this
 * service strips those fields when false. Identity + role/RACI always visible.
 */

import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../utils/queryHelpers.js';

export interface RegistryEntryInput {
  userId?: string | null;
  externalName?: string | null;
  externalEmail?: string | null;
  orgUnit?: string | null;
  category?: string | null;
  defaultInfluence?: number | null;
  defaultInterest?: number | null;
  notes?: string | null;
}

export interface EngagementInput {
  projectId?: string | null;
  role?: string | null;
  raciType?: string | null;
  influenceLevel?: number | null;
  interestLevel?: number | null;
  engagementStatus?: string | null;
  notes?: string | null;
}

const ASSESSMENT_FIELDS = [
  'defaultInfluence',
  'defaultInterest',
  'influenceLevel',
  'interestLevel',
  'engagementStatus',
  'notes',
] as const;

/**
 * Strip confidential assessment fields (§3.5 `stakeholder.assessment.view`)
 * from a row or array of rows when the caller lacks the capability. Identity
 * (name/email/role/RACI) always remains visible.
 */
export function stripConfidential<T extends Record<string, any>>(
  rows: T | T[] | null,
  canViewAssessment: boolean
): any {
  if (!rows) return rows;
  const strip = (row: Record<string, any>) => {
    if (canViewAssessment) return row;
    const out = { ...row };
    for (const field of ASSESSMENT_FIELDS) {
      if (field in out) out[field] = null;
    }
    out.assessmentRedacted = true;
    return out;
  };
  return Array.isArray(rows) ? rows.map(strip) : strip(rows);
}

function mapRegistryRow(r: any) {
  return {
    id: r.id,
    organizationId: r.organization_id,
    userId: r.user_id || null,
    externalName: r.external_name || null,
    externalEmail: r.external_email || null,
    orgUnit: r.org_unit || null,
    category: r.category || 'INTERNAL',
    defaultInfluence: r.default_influence ?? null,
    defaultInterest: r.default_interest ?? null,
    notes: r.notes || null,
    createdBy: r.created_by || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    firstName: r.first_name || null,
    lastName: r.last_name || null,
    email: r.email || null,
    engagementCount: r.engagement_count !== undefined ? Number(r.engagement_count) : undefined,
  };
}

function mapEngagementRow(r: any) {
  return {
    id: r.id,
    organizationId: r.organization_id,
    stakeholderId: r.stakeholder_id,
    projectId: r.project_id || null,
    role: r.role || null,
    raciType: r.raci_type || null,
    influenceLevel: r.influence_level ?? null,
    interestLevel: r.interest_level ?? null,
    engagementStatus: r.engagement_status || null,
    notes: r.notes || null,
    createdBy: r.created_by || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    projectName: r.project_name || null,
  };
}

// ==========================================
// REGISTRY (identity, org-level)
// ==========================================

export async function listRegistry(organizationId: string) {
  const rows = await queryHelpers.queryAll(
    `SELECT r.*,
            u.first_name, u.last_name, u.email,
            (SELECT COUNT(*) FROM stakeholder_engagements e WHERE e.stakeholder_id = r.id) as engagement_count
     FROM stakeholder_registry r
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.organization_id = ?
     ORDER BY r.created_at DESC`,
    [organizationId]
  );
  return rows.map(mapRegistryRow);
}

export async function getRegistryEntry(organizationId: string, id: string) {
  const row = await queryHelpers.queryOne(
    `SELECT r.*, u.first_name, u.last_name, u.email
     FROM stakeholder_registry r
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.id = ? AND r.organization_id = ?`,
    [id, organizationId]
  );
  return row ? mapRegistryRow(row) : null;
}

export async function createRegistryEntry(
  organizationId: string,
  actorId: string,
  input: RegistryEntryInput
) {
  if (!input.userId && !input.externalName) {
    throw Object.assign(new Error('userId or externalName is required'), { status: 400 });
  }
  const id = uuidv4();
  await queryHelpers.queryRun(
    `INSERT INTO stakeholder_registry (
      id, organization_id, user_id, external_name, external_email,
      org_unit, category, default_influence, default_interest, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      organizationId,
      input.userId || null,
      input.userId ? null : input.externalName || null,
      input.userId ? null : input.externalEmail || null,
      input.orgUnit || null,
      input.category || 'INTERNAL',
      input.defaultInfluence ?? null,
      input.defaultInterest ?? null,
      input.notes || null,
      actorId,
    ]
  );
  return getRegistryEntry(organizationId, id);
}

export async function updateRegistryEntry(
  organizationId: string,
  id: string,
  input: Partial<RegistryEntryInput>
) {
  const existing = await getRegistryEntry(organizationId, id);
  if (!existing) return null;

  await queryHelpers.queryRun(
    `UPDATE stakeholder_registry SET
       org_unit = COALESCE(?, org_unit),
       category = COALESCE(?, category),
       default_influence = ?,
       default_interest = ?,
       notes = COALESCE(?, notes),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND organization_id = ?`,
    [
      input.orgUnit ?? null,
      input.category ?? null,
      input.defaultInfluence !== undefined ? input.defaultInfluence : existing.defaultInfluence,
      input.defaultInterest !== undefined ? input.defaultInterest : existing.defaultInterest,
      input.notes ?? null,
      id,
      organizationId,
    ]
  );
  return getRegistryEntry(organizationId, id);
}

export async function deleteRegistryEntry(organizationId: string, id: string): Promise<boolean> {
  const result = await queryHelpers.queryRun(
    `DELETE FROM stakeholder_registry WHERE id = ? AND organization_id = ?`,
    [id, organizationId]
  );
  return (result?.changes || 0) > 0;
}

// ==========================================
// ENGAGEMENTS (assessment, per context)
// ==========================================

export async function listEngagements(organizationId: string, stakeholderId: string) {
  const rows = await queryHelpers.queryAll(
    `SELECT e.*, p.name as project_name
     FROM stakeholder_engagements e
     LEFT JOIN projects p ON p.id = e.project_id
     WHERE e.stakeholder_id = ? AND e.organization_id = ?
     ORDER BY e.project_id NULLS FIRST, e.created_at DESC`,
    [stakeholderId, organizationId]
  );
  return rows.map(mapEngagementRow);
}

export async function getEngagementProjectId(engagementId: string): Promise<string | null> {
  const row = await queryHelpers.queryOne<{ project_id: string | null }>(
    `SELECT project_id FROM stakeholder_engagements WHERE id = ?`,
    [engagementId]
  );
  return row?.project_id || null;
}

/**
 * Create or update the (stakeholder, project) engagement — one row per
 * context per §3.2 UNIQUE (stakeholder_id, project_id). `projectId: null`
 * targets the org-level baseline row.
 */
export async function upsertEngagement(
  organizationId: string,
  stakeholderId: string,
  actorId: string,
  input: EngagementInput
) {
  const stakeholder = await queryHelpers.queryOne<{ id: string }>(
    `SELECT id FROM stakeholder_registry WHERE id = ? AND organization_id = ?`,
    [stakeholderId, organizationId]
  );
  if (!stakeholder) {
    throw Object.assign(new Error('Stakeholder not found'), { status: 404 });
  }

  const projectId = input.projectId || null;
  if (projectId) {
    const project = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
      [projectId, organizationId]
    );
    if (!project) {
      throw Object.assign(new Error('Project not found'), { status: 404 });
    }
  }

  const existing = await queryHelpers.queryOne<{ id: string }>(
    projectId
      ? `SELECT id FROM stakeholder_engagements WHERE stakeholder_id = ? AND project_id = ?`
      : `SELECT id FROM stakeholder_engagements WHERE stakeholder_id = ? AND project_id IS NULL`,
    projectId ? [stakeholderId, projectId] : [stakeholderId]
  );

  const inf = Number.isFinite(Number(input.influenceLevel)) ? Number(input.influenceLevel) : 3;
  const intr = Number.isFinite(Number(input.interestLevel)) ? Number(input.interestLevel) : 3;

  if (existing) {
    await queryHelpers.queryRun(
      `UPDATE stakeholder_engagements SET
         role = COALESCE(?, role),
         raci_type = ?,
         influence_level = ?,
         interest_level = ?,
         engagement_status = COALESCE(?, engagement_status),
         notes = COALESCE(?, notes),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        input.role ?? null,
        input.raciType ?? null,
        inf,
        intr,
        input.engagementStatus ?? null,
        input.notes ?? null,
        existing.id,
      ]
    );
    return existing.id;
  }

  const id = uuidv4();
  await queryHelpers.queryRun(
    `INSERT INTO stakeholder_engagements (
      id, organization_id, stakeholder_id, project_id, role, raci_type,
      influence_level, interest_level, engagement_status, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      organizationId,
      stakeholderId,
      projectId,
      input.role || null,
      input.raciType || null,
      inf,
      intr,
      input.engagementStatus || null,
      input.notes || null,
      actorId,
    ]
  );
  return id;
}

export async function updateEngagement(
  organizationId: string,
  engagementId: string,
  input: Partial<EngagementInput>
) {
  const existing = await queryHelpers.queryOne<{ id: string }>(
    `SELECT id FROM stakeholder_engagements WHERE id = ? AND organization_id = ?`,
    [engagementId, organizationId]
  );
  if (!existing) return null;

  await queryHelpers.queryRun(
    `UPDATE stakeholder_engagements SET
       role = COALESCE(?, role),
       raci_type = COALESCE(?, raci_type),
       influence_level = COALESCE(?, influence_level),
       interest_level = COALESCE(?, interest_level),
       engagement_status = COALESCE(?, engagement_status),
       notes = COALESCE(?, notes),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND organization_id = ?`,
    [
      input.role ?? null,
      input.raciType ?? null,
      input.influenceLevel ?? null,
      input.interestLevel ?? null,
      input.engagementStatus ?? null,
      input.notes ?? null,
      engagementId,
      organizationId,
    ]
  );
  const row = await queryHelpers.queryOne(
    `SELECT e.*, p.name as project_name
     FROM stakeholder_engagements e
     LEFT JOIN projects p ON p.id = e.project_id
     WHERE e.id = ?`,
    [engagementId]
  );
  return row ? mapEngagementRow(row) : null;
}

export async function deleteEngagement(
  organizationId: string,
  engagementId: string
): Promise<boolean> {
  const result = await queryHelpers.queryRun(
    `DELETE FROM stakeholder_engagements WHERE id = ? AND organization_id = ?`,
    [engagementId, organizationId]
  );
  return (result?.changes || 0) > 0;
}

// ==========================================
// EFFECTIVE / INHERITANCE READ-MODELS (§3.3)
// ==========================================

/**
 * Project's effective stakeholders: engagements set directly on the project,
 * UNION the org-level baseline for stakeholders without a project-level
 * engagement yet (marked `inherited: true`, read-time only — no DB copy).
 */
export async function getProjectEffectiveStakeholders(organizationId: string, projectId: string) {
  const projectRows = await queryHelpers.queryAll(
    `SELECT e.*, r.user_id, r.external_name, r.external_email, r.category,
            u.first_name, u.last_name, u.email
     FROM stakeholder_engagements e
     JOIN stakeholder_registry r ON r.id = e.stakeholder_id
     LEFT JOIN users u ON u.id = r.user_id
     WHERE e.organization_id = ? AND e.project_id = ?`,
    [organizationId, projectId]
  );
  const coveredStakeholderIds = new Set(projectRows.map((r: any) => r.stakeholder_id));

  const orgBaselineRows = await queryHelpers.queryAll(
    `SELECT e.*, r.user_id, r.external_name, r.external_email, r.category,
            u.first_name, u.last_name, u.email
     FROM stakeholder_engagements e
     JOIN stakeholder_registry r ON r.id = e.stakeholder_id
     LEFT JOIN users u ON u.id = r.user_id
     WHERE e.organization_id = ? AND e.project_id IS NULL`,
    [organizationId]
  );

  const direct = projectRows.map((r: any) => ({ ...mapEngagementRow(r), inherited: false, ...identityFields(r) }));
  const inherited = orgBaselineRows
    .filter((r: any) => !coveredStakeholderIds.has(r.stakeholder_id))
    .map((r: any) => ({ ...mapEngagementRow(r), inherited: true, ...identityFields(r) }));

  return [...direct, ...inherited];
}

/**
 * Initiative's effective stakeholders (§3.3): live `initiative_stakeholders`
 * rows ∪ the parent project's engagements ∪ the org baseline, for
 * stakeholders not already present on the initiative — each tagged with
 * `source`. Read-time only; approving a suggestion is a separate write
 * against the existing `POST /initiatives/:id/stakeholders` endpoint (F12
 * wizard territory, not this service).
 */
export async function getInitiativeEffectiveStakeholders(
  organizationId: string,
  initiativeId: string
) {
  const initiative = await queryHelpers.queryOne<{ id: string; project_id: string | null }>(
    `SELECT id, project_id FROM initiatives WHERE id = ? AND organization_id = ?`,
    [initiativeId, organizationId]
  );
  if (!initiative) {
    throw Object.assign(new Error('Initiative not found'), { status: 404 });
  }

  const initiativeRows = await queryHelpers.queryAll(
    `SELECT s.*, u.first_name, u.last_name, u.email
     FROM initiative_stakeholders s
     LEFT JOIN users u ON u.id = s.user_id
     WHERE s.initiative_id = ?`,
    [initiativeId]
  );
  const direct = initiativeRows.map((r: any) => ({
    source: 'initiative',
    inherited: false,
    id: r.id,
    registryId: r.registry_id || null,
    userId: r.user_id || null,
    externalName: r.external_name || null,
    externalEmail: r.external_email || null,
    role: r.role || null,
    raciType: r.raci_type || null,
    influenceLevel: r.influence_level ?? null,
    interestLevel: r.interest_level ?? null,
    firstName: r.first_name || null,
    lastName: r.last_name || null,
    email: r.email || null,
  }));

  if (!initiative.project_id) {
    return direct;
  }

  const coveredRegistryIds = new Set(
    initiativeRows.map((r: any) => r.registry_id).filter(Boolean)
  );
  const projectEffective = await getProjectEffectiveStakeholders(
    organizationId,
    initiative.project_id
  );
  const inherited = projectEffective
    .filter((r: any) => !coveredRegistryIds.has(r.stakeholderId))
    .map((r: any) => ({
      source: r.inherited ? 'inherited_org' : 'inherited_project',
      inherited: true,
      id: null,
      registryId: r.stakeholderId,
      userId: r.userId,
      externalName: r.externalName,
      externalEmail: r.externalEmail,
      role: r.role,
      raciType: r.raciType,
      influenceLevel: r.influenceLevel,
      interestLevel: r.interestLevel,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
    }));

  return [...direct, ...inherited];
}

/**
 * F12 hook: candidates for the initiative wizard's "Stakeholderzy" step
 * (prefill from the parent project's effective stakeholders). Returns plain
 * candidate objects — approving/creating real `initiative_stakeholders` rows
 * is the wizard's job (F12 tor), not this service's.
 */
export async function getProjectPrefillCandidates(organizationId: string, projectId: string) {
  const effective = await getProjectEffectiveStakeholders(organizationId, projectId);
  return effective.map((r: any) => ({
    registryId: r.stakeholderId,
    userId: r.userId,
    externalName: r.externalName,
    externalEmail: r.externalEmail,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    suggestedRole: r.role,
    suggestedRaciType: r.raciType,
    influenceLevel: r.influenceLevel,
    interestLevel: r.interestLevel,
    inherited: r.inherited,
  }));
}

function identityFields(r: any) {
  return {
    userId: r.user_id || null,
    externalName: r.external_name || null,
    externalEmail: r.external_email || null,
    category: r.category || null,
    firstName: r.first_name || null,
    lastName: r.last_name || null,
    email: r.email || null,
  };
}

export default {
  stripConfidential,
  listRegistry,
  getRegistryEntry,
  createRegistryEntry,
  updateRegistryEntry,
  deleteRegistryEntry,
  listEngagements,
  getEngagementProjectId,
  upsertEngagement,
  updateEngagement,
  deleteEngagement,
  getProjectEffectiveStakeholders,
  getInitiativeEffectiveStakeholders,
  getProjectPrefillCandidates,
};
