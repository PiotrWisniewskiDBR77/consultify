import { v4 as uuidv4 } from 'uuid';
import * as queryHelpers from '../utils/queryHelpers.js';

export interface StaffingPlan {
  id: string;
  initiativeId: string;
  organizationId: string;
  name: string;
  status: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  totalFteRequired: number;
  totalFteAllocated: number;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffingPlanRole {
  id: string;
  staffingPlanId: string;
  roleName: string;
  requiredSkills: string[];
  fteRequired: number;
  fteAllocated: number;
  assignedUserId: string | null;
  startDate: string | null;
  endDate: string | null;
  priority: string;
  status: string;
  createdAt: string;
}

export interface StaffingGap {
  roleId: string;
  roleName: string;
  requiredSkills: string[];
  fteRequired: number;
  fteAllocated: number;
  gap: number;
  suggestedUsers: Array<{ userId: string; name: string; matchScore: number; availableCapacity: number }>;
}

function parseSkills(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    return raw.split(',').map((s: string) => s.trim()).filter(Boolean);
  }
  return [];
}

function mapPlanRow(r: any): StaffingPlan {
  return {
    id: r.id,
    initiativeId: r.initiative_id,
    organizationId: r.organization_id,
    name: r.name,
    status: r.status,
    plannedStart: r.planned_start || null,
    plannedEnd: r.planned_end || null,
    totalFteRequired: Number(r.total_fte_required) || 0,
    totalFteAllocated: Number(r.total_fte_allocated) || 0,
    notes: r.notes || null,
    createdBy: r.created_by || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapRoleRow(r: any): StaffingPlanRole {
  return {
    id: r.id,
    staffingPlanId: r.staffing_plan_id,
    roleName: r.role_name,
    requiredSkills: parseSkills(r.required_skills),
    fteRequired: Number(r.fte_required) || 0,
    fteAllocated: Number(r.fte_allocated) || 0,
    assignedUserId: r.assigned_user_id || null,
    startDate: r.start_date || null,
    endDate: r.end_date || null,
    priority: r.priority || 'medium',
    status: r.status || 'open',
    createdAt: r.created_at,
  };
}

export async function listPlans(initiativeId: string, orgId: string): Promise<StaffingPlan[]> {
  const rows = await queryHelpers.queryAll(
    `SELECT * FROM staffing_plans WHERE initiative_id = ? AND organization_id = ? ORDER BY created_at DESC`,
    [initiativeId, orgId]
  );
  return rows.map(mapPlanRow);
}

export async function getPlan(planId: string, orgId: string): Promise<{ plan: StaffingPlan; roles: StaffingPlanRole[] } | null> {
  const row = await queryHelpers.queryOne(
    `SELECT * FROM staffing_plans WHERE id = ? AND organization_id = ?`,
    [planId, orgId]
  );
  if (!row) return null;

  const roleRows = await queryHelpers.queryAll(
    `SELECT * FROM staffing_plan_roles WHERE staffing_plan_id = ? ORDER BY created_at ASC`,
    [planId]
  );

  return { plan: mapPlanRow(row), roles: roleRows.map(mapRoleRow) };
}

export async function createPlan(
  initiativeId: string,
  orgId: string,
  data: { name: string; status?: string; plannedStart?: string; plannedEnd?: string; notes?: string },
  userId?: string
): Promise<StaffingPlan> {
  const id = uuidv4();
  const now = new Date().toISOString();

  await queryHelpers.queryRun(
    `INSERT INTO staffing_plans (id, initiative_id, organization_id, name, status, planned_start, planned_end, notes, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, initiativeId, orgId,
      data.name,
      data.status || 'draft',
      data.plannedStart || null,
      data.plannedEnd || null,
      data.notes || null,
      userId || null,
      now, now,
    ]
  );

  return {
    id, initiativeId, organizationId: orgId,
    name: data.name,
    status: data.status || 'draft',
    plannedStart: data.plannedStart || null,
    plannedEnd: data.plannedEnd || null,
    totalFteRequired: 0,
    totalFteAllocated: 0,
    notes: data.notes || null,
    createdBy: userId || null,
    createdAt: now, updatedAt: now,
  };
}

export async function updatePlan(
  planId: string,
  orgId: string,
  data: Partial<{ name: string; status: string; plannedStart: string; plannedEnd: string; notes: string }>
): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await queryHelpers.queryRun(
    `UPDATE staffing_plans SET
       name = COALESCE(?, name),
       status = COALESCE(?, status),
       planned_start = COALESCE(?, planned_start),
       planned_end = COALESCE(?, planned_end),
       notes = COALESCE(?, notes),
       updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      data.name ?? null, data.status ?? null,
      data.plannedStart ?? null, data.plannedEnd ?? null,
      data.notes ?? null, now,
      planId, orgId,
    ]
  );
  return (result as any)?.changes > 0;
}

export async function deletePlan(planId: string, orgId: string): Promise<boolean> {
  const result = await queryHelpers.queryRun(
    `DELETE FROM staffing_plans WHERE id = ? AND organization_id = ?`,
    [planId, orgId]
  );
  return (result as any)?.changes > 0;
}

export async function addRole(
  planId: string,
  data: {
    roleName: string;
    requiredSkills?: string[];
    fteRequired?: number;
    assignedUserId?: string;
    startDate?: string;
    endDate?: string;
    priority?: string;
  }
): Promise<StaffingPlanRole> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const skillsJson = data.requiredSkills?.length ? JSON.stringify(data.requiredSkills) : null;

  await queryHelpers.queryRun(
    `INSERT INTO staffing_plan_roles (id, staffing_plan_id, role_name, required_skills, fte_required, assigned_user_id, start_date, end_date, priority, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, planId,
      data.roleName,
      skillsJson,
      data.fteRequired ?? 1.0,
      data.assignedUserId || null,
      data.startDate || null,
      data.endDate || null,
      data.priority || 'medium',
      data.assignedUserId ? 'filled' : 'open',
      now,
    ]
  );

  await recalcPlanFte(planId);

  return {
    id, staffingPlanId: planId,
    roleName: data.roleName,
    requiredSkills: data.requiredSkills || [],
    fteRequired: data.fteRequired ?? 1.0,
    fteAllocated: data.assignedUserId ? (data.fteRequired ?? 1.0) : 0,
    assignedUserId: data.assignedUserId || null,
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    priority: data.priority || 'medium',
    status: data.assignedUserId ? 'filled' : 'open',
    createdAt: now,
  };
}

export async function updateRole(
  roleId: string,
  planId: string,
  data: Partial<{
    roleName: string;
    requiredSkills: string[];
    fteRequired: number;
    fteAllocated: number;
    assignedUserId: string | null;
    startDate: string;
    endDate: string;
    priority: string;
    status: string;
  }>
): Promise<boolean> {
  const skillsJson = data.requiredSkills !== undefined ? JSON.stringify(data.requiredSkills) : null;

  const status = data.status ?? (data.assignedUserId !== undefined
    ? (data.assignedUserId ? 'filled' : 'open')
    : null);

  const fteAllocated = data.fteAllocated !== undefined
    ? data.fteAllocated
    : (data.assignedUserId !== undefined
      ? (data.assignedUserId ? undefined : 0)
      : undefined);

  await queryHelpers.queryRun(
    `UPDATE staffing_plan_roles SET
       role_name = COALESCE(?, role_name),
       required_skills = COALESCE(?, required_skills),
       fte_required = COALESCE(?, fte_required),
       fte_allocated = COALESCE(?, fte_allocated),
       assigned_user_id = CASE WHEN ? = 1 THEN ? ELSE assigned_user_id END,
       start_date = COALESCE(?, start_date),
       end_date = COALESCE(?, end_date),
       priority = COALESCE(?, priority),
       status = COALESCE(?, status)
     WHERE id = ? AND staffing_plan_id = ?`,
    [
      data.roleName ?? null,
      skillsJson,
      data.fteRequired ?? null,
      fteAllocated ?? null,
      data.assignedUserId !== undefined ? 1 : 0,
      data.assignedUserId !== undefined ? (data.assignedUserId || null) : null,
      data.startDate ?? null,
      data.endDate ?? null,
      data.priority ?? null,
      status,
      roleId, planId,
    ]
  );

  await recalcPlanFte(planId);
  return true;
}

export async function deleteRole(roleId: string, planId: string): Promise<boolean> {
  const result = await queryHelpers.queryRun(
    `DELETE FROM staffing_plan_roles WHERE id = ? AND staffing_plan_id = ?`,
    [roleId, planId]
  );
  await recalcPlanFte(planId);
  return (result as any)?.changes > 0;
}

async function recalcPlanFte(planId: string): Promise<void> {
  const rows = await queryHelpers.queryAll<any>(
    `SELECT fte_required, fte_allocated FROM staffing_plan_roles WHERE staffing_plan_id = ?`,
    [planId]
  );
  const totalRequired = rows.reduce((s: number, r: any) => s + (Number(r.fte_required) || 0), 0);
  const totalAllocated = rows.reduce((s: number, r: any) => s + (Number(r.fte_allocated) || 0), 0);

  await queryHelpers.queryRun(
    `UPDATE staffing_plans SET total_fte_required = ?, total_fte_allocated = ?, updated_at = ? WHERE id = ?`,
    [totalRequired, totalAllocated, new Date().toISOString(), planId]
  );
}

export async function computeStaffingGaps(planId: string, orgId: string): Promise<StaffingGap[]> {
  const roleRows = await queryHelpers.queryAll<any>(
    `SELECT * FROM staffing_plan_roles WHERE staffing_plan_id = ?`,
    [planId]
  );

  const gaps: StaffingGap[] = [];

  for (const role of roleRows) {
    const fteRequired = Number(role.fte_required) || 0;
    const fteAllocated = Number(role.fte_allocated) || 0;
    const gap = fteRequired - fteAllocated;

    if (gap <= 0) continue;

    const requiredSkills = parseSkills(role.required_skills);
    const suggestedUsers: StaffingGap['suggestedUsers'] = [];

    if (requiredSkills.length > 0) {
      const placeholders = requiredSkills.map(() => '?').join(',');
      const matchingUsers = await queryHelpers.queryAll<any>(
        `SELECT us.user_id,
                COALESCE(u.name, u.email, us.user_id) as name,
                COUNT(DISTINCT us.skill_name) as matched_skills,
                us.proficiency_level
         FROM user_skills us
         LEFT JOIN users u ON u.id = us.user_id
         WHERE us.organization_id = ?
           AND LOWER(us.skill_name) IN (${placeholders})
           AND us.user_id NOT IN (
             SELECT assigned_user_id FROM staffing_plan_roles
             WHERE staffing_plan_id = ? AND assigned_user_id IS NOT NULL
           )
         GROUP BY us.user_id
         ORDER BY matched_skills DESC
         LIMIT 10`,
        [orgId, ...requiredSkills.map(s => s.toLowerCase()), planId]
      );

      for (const mu of matchingUsers) {
        const matchScore = Math.round((Number(mu.matched_skills) / requiredSkills.length) * 100);

        let availableCapacity = 1.0;
        try {
          const allocRow = await queryHelpers.queryOne<any>(
            `SELECT COALESCE(SUM(allocation_percentage), 0) as total_alloc
             FROM initiative_resources
             WHERE user_id = ? AND organization_id = ?`,
            [mu.user_id, orgId]
          );
          const usedPercent = Number(allocRow?.total_alloc) || 0;
          availableCapacity = Math.max(0, (100 - usedPercent) / 100);
        } catch {
          // initiative_resources may not have data
        }

        suggestedUsers.push({
          userId: mu.user_id,
          name: mu.name,
          matchScore,
          availableCapacity: Math.round(availableCapacity * 100) / 100,
        });
      }
    }

    gaps.push({
      roleId: role.id,
      roleName: role.role_name,
      requiredSkills,
      fteRequired,
      fteAllocated,
      gap: Math.round(gap * 100) / 100,
      suggestedUsers,
    });
  }

  return gaps;
}

export async function syncInitiativeCapacity(initiativeId: string, orgId: string): Promise<void> {
  const allocRow = await queryHelpers.queryOne<any>(
    `SELECT COALESCE(SUM(allocation_percentage), 0) as total_alloc
     FROM initiative_resources
     WHERE initiative_id = ? AND organization_id = ?`,
    [initiativeId, orgId]
  );
  const allocatedFte = (Number(allocRow?.total_alloc) || 0) / 100;

  let requiredFte = 0;
  try {
    const reqRow = await queryHelpers.queryOne<any>(
      `SELECT COALESCE(SUM(spr.fte_required), 0) as total_req
       FROM staffing_plan_roles spr
       JOIN staffing_plans sp ON sp.id = spr.staffing_plan_id
       WHERE sp.initiative_id = ? AND sp.organization_id = ?`,
      [initiativeId, orgId]
    );
    requiredFte = Number(reqRow?.total_req) || 0;
  } catch {
    // staffing_plans table may not exist yet
  }

  await queryHelpers.queryRun(
    `UPDATE initiatives SET
       allocated_capacity_fte = ?,
       required_capacity_fte = CASE WHEN ? > 0 THEN ? ELSE required_capacity_fte END,
       updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      Math.round(allocatedFte * 100) / 100,
      requiredFte, requiredFte,
      new Date().toISOString(),
      initiativeId, orgId,
    ]
  );
}

export default {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
  addRole,
  updateRole,
  deleteRole,
  computeStaffingGaps,
  syncInitiativeCapacity,
};
