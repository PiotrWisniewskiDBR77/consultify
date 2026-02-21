import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Capability {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  domain: string;
  tags: string[];
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserCapability {
  id: string;
  userId: string;
  organizationId: string;
  capabilityId: string;
  level: number;
  certifications: unknown[];
  notes: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CapabilityRequirement {
  id: string;
  organizationId: string;
  initiativeId: string | null;
  taskId: string | null;
  capabilityId: string;
  minLevel: number;
  priority: 'required' | 'nice_to_have';
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CapabilityAssignment {
  id: string;
  organizationId: string;
  initiativeId: string | null;
  taskId: string | null;
  userId: string;
  matchScore: number | null;
  gapSummary: Record<string, unknown>;
  decision: 'assigned' | 'rejected' | 'pending';
  decisionReason: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  aiSuggested: boolean;
  createdAt: string;
}

export interface CandidateMatch {
  userId: string;
  matchScore: number;
  gaps: { capabilityId: string; capabilityName: string; required: number; actual: number }[];
}

/* ------------------------------------------------------------------ */
/*  Row mappers                                                        */
/* ------------------------------------------------------------------ */

function mapCapability(row: any): Capability {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    domain: row.domain,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags ?? []),
    isActive: Boolean(row.is_active),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUserCapability(row: any): UserCapability {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    capabilityId: row.capability_id,
    level: row.level,
    certifications:
      typeof row.certifications === 'string'
        ? JSON.parse(row.certifications)
        : (row.certifications ?? []),
    notes: row.notes,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRequirement(row: any): CapabilityRequirement {
  return {
    id: row.id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id,
    taskId: row.task_id,
    capabilityId: row.capability_id,
    minLevel: row.min_level,
    priority: row.priority,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAssignment(row: any): CapabilityAssignment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id,
    taskId: row.task_id,
    userId: row.user_id,
    matchScore: row.match_score != null ? Number(row.match_score) : null,
    gapSummary:
      typeof row.gap_summary === 'string' ? JSON.parse(row.gap_summary) : (row.gap_summary ?? {}),
    decision: row.decision,
    decisionReason: row.decision_reason,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    aiSuggested: Boolean(row.ai_suggested),
    createdAt: row.created_at,
  };
}

/* ------------------------------------------------------------------ */
/*  Capability CRUD                                                    */
/* ------------------------------------------------------------------ */

export async function createCapability(
  orgId: string,
  data: { name: string; description?: string; domain?: string; tags?: string[]; createdBy?: string }
): Promise<Capability> {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO capabilities (id, organization_id, name, description, domain, tags, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      orgId,
      data.name,
      data.description ?? null,
      data.domain ?? 'general',
      JSON.stringify(data.tags ?? []),
      data.createdBy ?? null,
    ]
  );
  return getCapability(orgId, id) as Promise<Capability>;
}

export async function getCapabilities(orgId: string, domain?: string): Promise<Capability[]> {
  const params: unknown[] = [orgId];
  let sql = `SELECT * FROM capabilities WHERE organization_id = $1 AND is_active = TRUE`;
  if (domain) {
    sql += ` AND domain = $2`;
    params.push(domain);
  }
  sql += ` ORDER BY name`;
  const rows = await dbAll(sql, params);
  return rows.map(mapCapability);
}

export async function getCapability(orgId: string, id: string): Promise<Capability | null> {
  const row = await dbGet(`SELECT * FROM capabilities WHERE id = $1 AND organization_id = $2`, [
    id,
    orgId,
  ]);
  return row ? mapCapability(row) : null;
}

export async function updateCapability(
  orgId: string,
  id: string,
  data: Partial<{ name: string; description: string; domain: string; tags: string[] }>
): Promise<Capability | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (data.name !== undefined) {
    sets.push(`name = $${idx++}`);
    params.push(data.name);
  }
  if (data.description !== undefined) {
    sets.push(`description = $${idx++}`);
    params.push(data.description);
  }
  if (data.domain !== undefined) {
    sets.push(`domain = $${idx++}`);
    params.push(data.domain);
  }
  if (data.tags !== undefined) {
    sets.push(`tags = $${idx++}`);
    params.push(JSON.stringify(data.tags));
  }
  if (sets.length === 0) return getCapability(orgId, id);

  sets.push(`updated_at = NOW()`);
  params.push(id, orgId);
  await dbRun(
    `UPDATE capabilities SET ${sets.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx}`,
    params
  );
  return getCapability(orgId, id);
}

export async function deleteCapability(orgId: string, id: string): Promise<void> {
  await dbRun(
    `UPDATE capabilities SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND organization_id = $2`,
    [id, orgId]
  );
}

/* ------------------------------------------------------------------ */
/*  User Capability Profile                                            */
/* ------------------------------------------------------------------ */

export async function setUserCapability(
  orgId: string,
  userId: string,
  capabilityId: string,
  level: number,
  extra?: { certifications?: unknown[]; notes?: string; verifiedBy?: string }
): Promise<UserCapability> {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO user_capabilities (id, user_id, organization_id, capability_id, level, certifications, notes, verified_by, verified_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id, capability_id) DO UPDATE SET
       level = EXCLUDED.level,
       certifications = EXCLUDED.certifications,
       notes = EXCLUDED.notes,
       verified_by = EXCLUDED.verified_by,
       verified_at = EXCLUDED.verified_at,
       updated_at = NOW()`,
    [
      id,
      userId,
      orgId,
      capabilityId,
      level,
      JSON.stringify(extra?.certifications ?? []),
      extra?.notes ?? null,
      extra?.verifiedBy ?? null,
      extra?.verifiedBy ? new Date().toISOString() : null,
    ]
  );
  const row = await dbGet(
    `SELECT * FROM user_capabilities WHERE user_id = $1 AND capability_id = $2`,
    [userId, capabilityId]
  );
  return mapUserCapability(row);
}

export async function getUserCapabilities(
  orgId: string,
  userId: string
): Promise<UserCapability[]> {
  const rows = await dbAll(
    `SELECT uc.* FROM user_capabilities uc
     JOIN capabilities c ON c.id = uc.capability_id AND c.is_active = TRUE
     WHERE uc.user_id = $1 AND uc.organization_id = $2
     ORDER BY c.name`,
    [userId, orgId]
  );
  return rows.map(mapUserCapability);
}

export async function removeUserCapability(
  orgId: string,
  userId: string,
  capabilityId: string
): Promise<void> {
  await dbRun(
    `DELETE FROM user_capabilities WHERE user_id = $1 AND capability_id = $2 AND organization_id = $3`,
    [userId, capabilityId, orgId]
  );
}

/* ------------------------------------------------------------------ */
/*  Requirements                                                       */
/* ------------------------------------------------------------------ */

export async function setRequirement(
  orgId: string,
  data: {
    initiativeId?: string;
    taskId?: string;
    capabilityId: string;
    minLevel: number;
    priority?: 'required' | 'nice_to_have';
    notes?: string;
    createdBy?: string;
  }
): Promise<CapabilityRequirement> {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO capability_requirements (id, organization_id, initiative_id, task_id, capability_id, min_level, priority, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      orgId,
      data.initiativeId ?? null,
      data.taskId ?? null,
      data.capabilityId,
      data.minLevel,
      data.priority ?? 'required',
      data.notes ?? null,
      data.createdBy ?? null,
    ]
  );
  return getRequirement(orgId, id) as Promise<CapabilityRequirement>;
}

export async function getRequirements(
  orgId: string,
  filters?: { initiativeId?: string; taskId?: string }
): Promise<CapabilityRequirement[]> {
  const params: unknown[] = [orgId];
  let sql = `SELECT * FROM capability_requirements WHERE organization_id = $1`;
  let idx = 2;
  if (filters?.initiativeId) {
    sql += ` AND initiative_id = $${idx++}`;
    params.push(filters.initiativeId);
  }
  if (filters?.taskId) {
    sql += ` AND task_id = $${idx++}`;
    params.push(filters.taskId);
  }
  sql += ` ORDER BY created_at DESC`;
  const rows = await dbAll(sql, params);
  return rows.map(mapRequirement);
}

export async function getRequirement(
  orgId: string,
  id: string
): Promise<CapabilityRequirement | null> {
  const row = await dbGet(
    `SELECT * FROM capability_requirements WHERE id = $1 AND organization_id = $2`,
    [id, orgId]
  );
  return row ? mapRequirement(row) : null;
}

export async function deleteRequirement(orgId: string, id: string): Promise<void> {
  await dbRun(`DELETE FROM capability_requirements WHERE id = $1 AND organization_id = $2`, [
    id,
    orgId,
  ]);
}

/* ------------------------------------------------------------------ */
/*  Matching & Gap Analysis                                            */
/* ------------------------------------------------------------------ */

export async function matchCandidates(
  orgId: string,
  filters: { initiativeId?: string; taskId?: string }
): Promise<CandidateMatch[]> {
  const reqs = await getRequirements(orgId, filters);
  if (reqs.length === 0) return [];

  const capIds = reqs.map((r) => r.capabilityId);
  const placeholders = capIds.map((_, i) => `$${i + 2}`).join(',');

  const rows: any[] = await dbAll(
    `SELECT uc.user_id, uc.capability_id, uc.level, c.name AS capability_name
     FROM user_capabilities uc
     JOIN capabilities c ON c.id = uc.capability_id
     WHERE uc.organization_id = $1 AND uc.capability_id IN (${placeholders})`,
    [orgId, ...capIds]
  );

  const userMap: Record<string, { levels: Record<string, { level: number; name: string }> }> = {};
  for (const r of rows) {
    if (!userMap[r.user_id]) userMap[r.user_id] = { levels: {} };
    userMap[r.user_id].levels[r.capability_id] = { level: r.level, name: r.capability_name };
  }

  const results: CandidateMatch[] = [];
  for (const [userId, info] of Object.entries(userMap)) {
    let totalScore = 0;
    const gaps: CandidateMatch['gaps'] = [];
    for (const req of reqs) {
      const actual = info.levels[req.capabilityId]?.level ?? 0;
      const reqScore = Math.min(actual / req.minLevel, 1);
      const weight = req.priority === 'required' ? 1.0 : 0.5;
      totalScore += reqScore * weight;
      if (actual < req.minLevel) {
        gaps.push({
          capabilityId: req.capabilityId,
          capabilityName: info.levels[req.capabilityId]?.name ?? req.capabilityId,
          required: req.minLevel,
          actual,
        });
      }
    }
    const maxScore = reqs.reduce((s, r) => s + (r.priority === 'required' ? 1.0 : 0.5), 0);
    const matchScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    results.push({ userId, matchScore, gaps });
  }

  results.sort((a, b) => b.matchScore - a.matchScore);
  return results;
}

export async function getGapRecommendations(
  orgId: string,
  userId: string,
  filters?: { initiativeId?: string; taskId?: string }
): Promise<CandidateMatch['gaps']> {
  const candidates = await matchCandidates(orgId, filters ?? {});
  const match = candidates.find((c) => c.userId === userId);
  return match?.gaps ?? [];
}

/* ------------------------------------------------------------------ */
/*  Assignment Recording                                               */
/* ------------------------------------------------------------------ */

export async function recordAssignment(
  orgId: string,
  data: {
    initiativeId?: string;
    taskId?: string;
    userId: string;
    matchScore?: number;
    gapSummary?: Record<string, unknown>;
    decision: 'assigned' | 'rejected' | 'pending';
    decisionReason?: string;
    decidedBy?: string;
    aiSuggested?: boolean;
  }
): Promise<CapabilityAssignment> {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO capability_assignments (id, organization_id, initiative_id, task_id, user_id, match_score, gap_summary, decision, decision_reason, decided_by, decided_at, ai_suggested)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      id,
      orgId,
      data.initiativeId ?? null,
      data.taskId ?? null,
      data.userId,
      data.matchScore ?? null,
      JSON.stringify(data.gapSummary ?? {}),
      data.decision,
      data.decisionReason ?? null,
      data.decidedBy ?? null,
      data.decision !== 'pending' ? new Date().toISOString() : null,
      data.aiSuggested ?? false,
    ]
  );
  const row = await dbGet(`SELECT * FROM capability_assignments WHERE id = $1`, [id]);
  return mapAssignment(row);
}
