/**
 * Blueprint Service (V4-INIT-03)
 *
 * Manages initiative blueprint templates: WBS tree, milestone dependencies,
 * role templates, DoD per level, validation, and cloning.
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

export interface WbsItem {
  id: string;
  templateId: string;
  parentId?: string;
  title: string;
  itemType: string;
  level: number;
  sortOrder: number;
  estimatedHours?: number;
  deliverables?: string;
  acceptanceCriteria?: string;
  assignedRole?: string;
  createdAt: string;
  children?: WbsItem[];
}

export interface BlueprintValidation {
  valid: boolean;
  hasWbs: boolean;
  hasMilestones: boolean;
  hasRoles: boolean;
  hasDod: boolean;
  wbsItemCount: number;
  issues: string[];
}

function rowToWbsItem(r: any): WbsItem {
  return {
    id: r.id,
    templateId: r.template_id,
    parentId: r.parent_id || undefined,
    title: r.title,
    itemType: r.item_type || 'work_package',
    level: Number(r.level) || 1,
    sortOrder: Number(r.sort_order) || 0,
    estimatedHours: r.estimated_hours != null ? Number(r.estimated_hours) : undefined,
    deliverables: r.deliverables || undefined,
    acceptanceCriteria: r.acceptance_criteria || undefined,
    assignedRole: r.assigned_role || undefined,
    createdAt: r.created_at,
  };
}

function buildTree(items: WbsItem[]): WbsItem[] {
  const map = new Map<string, WbsItem>();
  const roots: WbsItem[] = [];

  for (const item of items) {
    map.set(item.id, { ...item, children: [] });
  }

  for (const item of items) {
    const node = map.get(item.id)!;
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortChildren = (nodes: WbsItem[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const n of nodes) {
      if (n.children?.length) sortChildren(n.children);
    }
  };
  sortChildren(roots);

  return roots;
}

export async function getWbsTree(templateId: string): Promise<WbsItem[]> {
  const rows = await queryHelpers.queryAll<any>(
    `SELECT * FROM blueprint_wbs_items WHERE template_id = ? ORDER BY level ASC, sort_order ASC`,
    [templateId]
  );
  const items = rows.map(rowToWbsItem);
  return buildTree(items);
}

export async function getWbsFlat(templateId: string): Promise<WbsItem[]> {
  const rows = await queryHelpers.queryAll<any>(
    `SELECT * FROM blueprint_wbs_items WHERE template_id = ? ORDER BY level ASC, sort_order ASC`,
    [templateId]
  );
  return rows.map(rowToWbsItem);
}

export async function addWbsItem(
  templateId: string,
  data: {
    parentId?: string;
    title: string;
    itemType?: string;
    level?: number;
    sortOrder?: number;
    estimatedHours?: number;
    deliverables?: string;
    acceptanceCriteria?: string;
    assignedRole?: string;
  }
): Promise<WbsItem> {
  const id = uuidv4();
  const now = new Date().toISOString();

  let level = data.level || 1;
  if (data.parentId) {
    const parent = await queryHelpers.queryOne<any>(
      `SELECT level FROM blueprint_wbs_items WHERE id = ? AND template_id = ?`,
      [data.parentId, templateId]
    );
    if (parent) level = Number(parent.level) + 1;
  }

  await queryHelpers.queryRun(
    `INSERT INTO blueprint_wbs_items
       (id, template_id, parent_id, title, item_type, level, sort_order,
        estimated_hours, deliverables, acceptance_criteria, assigned_role, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      templateId,
      data.parentId || null,
      data.title,
      data.itemType || 'work_package',
      level,
      data.sortOrder ?? 0,
      data.estimatedHours ?? null,
      data.deliverables || null,
      data.acceptanceCriteria || null,
      data.assignedRole || null,
      now,
    ]
  );

  return {
    id,
    templateId,
    parentId: data.parentId,
    title: data.title,
    itemType: data.itemType || 'work_package',
    level,
    sortOrder: data.sortOrder ?? 0,
    estimatedHours: data.estimatedHours,
    deliverables: data.deliverables,
    acceptanceCriteria: data.acceptanceCriteria,
    assignedRole: data.assignedRole,
    createdAt: now,
  };
}

export async function updateWbsItem(
  templateId: string,
  itemId: string,
  data: Partial<{
    parentId: string | null;
    title: string;
    itemType: string;
    level: number;
    sortOrder: number;
    estimatedHours: number | null;
    deliverables: string | null;
    acceptanceCriteria: string | null;
    assignedRole: string | null;
  }>
): Promise<WbsItem | null> {
  const existing = await queryHelpers.queryOne<any>(
    `SELECT * FROM blueprint_wbs_items WHERE id = ? AND template_id = ?`,
    [itemId, templateId]
  );
  if (!existing) return null;

  const fields: string[] = [];
  const params: unknown[] = [];

  if (data.title !== undefined) {
    fields.push('title = ?');
    params.push(data.title);
  }
  if (data.parentId !== undefined) {
    fields.push('parent_id = ?');
    params.push(data.parentId);
  }
  if (data.itemType !== undefined) {
    fields.push('item_type = ?');
    params.push(data.itemType);
  }
  if (data.level !== undefined) {
    fields.push('level = ?');
    params.push(data.level);
  }
  if (data.sortOrder !== undefined) {
    fields.push('sort_order = ?');
    params.push(data.sortOrder);
  }
  if (data.estimatedHours !== undefined) {
    fields.push('estimated_hours = ?');
    params.push(data.estimatedHours);
  }
  if (data.deliverables !== undefined) {
    fields.push('deliverables = ?');
    params.push(data.deliverables);
  }
  if (data.acceptanceCriteria !== undefined) {
    fields.push('acceptance_criteria = ?');
    params.push(data.acceptanceCriteria);
  }
  if (data.assignedRole !== undefined) {
    fields.push('assigned_role = ?');
    params.push(data.assignedRole);
  }

  if (fields.length === 0) return rowToWbsItem(existing);

  params.push(itemId, templateId);
  await queryHelpers.queryRun(
    `UPDATE blueprint_wbs_items SET ${fields.join(', ')} WHERE id = ? AND template_id = ?`,
    params
  );

  const updated = await queryHelpers.queryOne<any>(
    `SELECT * FROM blueprint_wbs_items WHERE id = ? AND template_id = ?`,
    [itemId, templateId]
  );
  return updated ? rowToWbsItem(updated) : null;
}

export async function deleteWbsItem(templateId: string, itemId: string): Promise<boolean> {
  const existing = await queryHelpers.queryOne<any>(
    `SELECT id FROM blueprint_wbs_items WHERE id = ? AND template_id = ?`,
    [itemId, templateId]
  );
  if (!existing) return false;

  // Cascade: delete children recursively via SQL (parent_id references)
  // The FK ON DELETE CASCADE handles this if the DB supports it,
  // but for SQLite we do it manually.
  const deleteRecursive = async (parentId: string) => {
    const children = await queryHelpers.queryAll<any>(
      `SELECT id FROM blueprint_wbs_items WHERE parent_id = ? AND template_id = ?`,
      [parentId, templateId]
    );
    for (const child of children) {
      await deleteRecursive(child.id);
    }
    await queryHelpers.queryRun(
      `DELETE FROM blueprint_wbs_items WHERE id = ? AND template_id = ?`,
      [parentId, templateId]
    );
  };

  await deleteRecursive(itemId);
  return true;
}

export async function reorderWbsItems(
  templateId: string,
  items: Array<{ id: string; sortOrder: number }>
): Promise<void> {
  for (const item of items) {
    await queryHelpers.queryRun(
      `UPDATE blueprint_wbs_items SET sort_order = ? WHERE id = ? AND template_id = ?`,
      [item.sortOrder, item.id, templateId]
    );
  }
}

export async function applyWbs(
  templateId: string,
  initiativeId: string,
  orgId: string,
  userId: string
): Promise<{ tasksCreated: number }> {
  const wbsItems = await queryHelpers.queryAll<any>(
    `SELECT * FROM blueprint_wbs_items WHERE template_id = ? ORDER BY level ASC, sort_order ASC`,
    [templateId]
  );

  const now = new Date().toISOString();
  const idMap = new Map<string, string>(); // wbs item id -> new task id
  let tasksCreated = 0;

  for (const item of wbsItems) {
    const taskId = uuidv4();
    idMap.set(item.id, taskId);
    const parentTaskId = item.parent_id ? idMap.get(item.parent_id) || null : null;

    try {
      await queryHelpers.queryRun(
        `INSERT INTO tasks
           (id, organization_id, initiative_id, title, description, status, priority,
            parent_task_id, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'TODO', 'medium', ?, ?, ?, ?)`,
        [
          taskId,
          orgId,
          initiativeId,
          item.title,
          item.deliverables || null,
          parentTaskId,
          userId,
          now,
          now,
        ]
      );
      tasksCreated++;
    } catch (err: any) {
      logger.warn(`[BlueprintService] Failed to create task from WBS ${item.id}: ${err.message}`);
    }
  }

  return { tasksCreated };
}

export async function applyMilestoneDependencies(
  templateId: string,
  initiativeId: string,
  orgId: string
): Promise<{ milestonesCreated: number }> {
  const template = await queryHelpers.queryOne<any>(
    `SELECT milestone_dependencies_json FROM initiative_templates WHERE id = ?`,
    [templateId]
  );

  let milestones: any[] = [];
  if (template?.milestone_dependencies_json) {
    try {
      milestones = JSON.parse(template.milestone_dependencies_json);
    } catch {
      milestones = [];
    }
  }

  const now = new Date().toISOString();
  let milestonesCreated = 0;
  const idMap = new Map<string, string>();

  for (let i = 0; i < milestones.length; i++) {
    const ms = milestones[i];
    const msId = uuidv4();
    idMap.set(ms.templateKey || String(i), msId);

    try {
      await queryHelpers.queryRun(
        `INSERT INTO initiative_milestones
           (id, initiative_id, organization_id, name, description, status, is_gate, order_index, created_at)
         VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
        [
          msId,
          initiativeId,
          orgId,
          ms.name || `Milestone ${i + 1}`,
          ms.description || '',
          ms.isGate ? 1 : 0,
          ms.order ?? i,
          now,
        ]
      );
      milestonesCreated++;
    } catch (err: any) {
      logger.warn(`[BlueprintService] Failed to create milestone: ${err.message}`);
    }
  }

  // Apply dependency links between milestones.
  // NOTE: these are MILESTONE ids (source/target), not initiative ids — they cannot
  // go into `initiative_dependencies` (initiative-to-initiative, hard NOT-NULL FKs to
  // `initiatives(id)` on from_initiative_id/to_initiative_id). They are stored in the
  // dedicated `initiative_milestone_dependencies` table instead (FK-scoped to
  // `initiative_milestones`; see migration 20260720_fala4_kpi_snap_milestone_deps_ai_policies.sql).
  for (const ms of milestones) {
    if (ms.dependsOn && Array.isArray(ms.dependsOn)) {
      const msId = idMap.get(ms.templateKey || '');
      if (!msId) continue;
      for (const depKey of ms.dependsOn) {
        const depId = idMap.get(depKey);
        if (!depId) continue;
        try {
          await queryHelpers.queryRun(
            `INSERT INTO initiative_milestone_dependencies
               (id, initiative_id, organization_id, source_milestone_id, target_milestone_id, dependency_type, created_at)
             VALUES (?, ?, ?, ?, ?, 'finish_to_start', ?)`,
            [uuidv4(), initiativeId, orgId, depId, msId, now]
          );
        } catch (err: any) {
          logger.warn(`[BlueprintService] Failed to create milestone dependency: ${err.message}`);
        }
      }
    }
  }

  return { milestonesCreated };
}

export async function applyRoleTemplates(
  templateId: string,
  initiativeId: string,
  orgId: string,
  userId: string
): Promise<{ rolesCreated: number }> {
  const template = await queryHelpers.queryOne<any>(
    `SELECT role_templates_json FROM initiative_templates WHERE id = ?`,
    [templateId]
  );

  let roles: any[] = [];
  if (template?.role_templates_json) {
    try {
      roles = JSON.parse(template.role_templates_json);
    } catch {
      roles = [];
    }
  }

  const now = new Date().toISOString();
  let rolesCreated = 0;

  for (const role of roles) {
    try {
      await queryHelpers.queryRun(
        `INSERT INTO initiative_resources
           (id, initiative_id, organization_id, name, role, type, skills, allocation_pct, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'human', ?, ?, ?, ?)`,
        [
          uuidv4(),
          initiativeId,
          orgId,
          role.name || role.role || 'Team Member',
          role.role || 'member',
          role.skills
            ? typeof role.skills === 'string'
              ? role.skills
              : JSON.stringify(role.skills)
            : null,
          role.allocationPct ?? 100,
          now,
          now,
        ]
      );
      rolesCreated++;
    } catch (err: any) {
      logger.warn(`[BlueprintService] Failed to create role: ${err.message}`);
    }
  }

  return { rolesCreated };
}

export async function applyDoDPerLevel(
  templateId: string,
  initiativeId: string
): Promise<{ levelsApplied: number }> {
  const template = await queryHelpers.queryOne<any>(
    `SELECT dod_per_level_json FROM initiative_templates WHERE id = ?`,
    [templateId]
  );

  let dod: Record<string, any> = {};
  if (template?.dod_per_level_json) {
    try {
      dod = JSON.parse(template.dod_per_level_json);
    } catch {
      dod = {};
    }
  }

  const levels = Object.keys(dod);
  if (levels.length === 0) return { levelsApplied: 0 };

  try {
    await queryHelpers.queryRun(
      `UPDATE initiatives SET metadata_json =
         json_set(COALESCE(metadata_json, '{}'), '$.dodPerLevel', ?)
       WHERE id = ?`,
      [JSON.stringify(dod), initiativeId]
    );
  } catch {
    // metadata_json column or json_set may not be available
    logger.warn(`[BlueprintService] Could not apply DoD per level for initiative ${initiativeId}`);
  }

  return { levelsApplied: levels.length };
}

export async function validateBlueprint(templateId: string): Promise<BlueprintValidation> {
  const template = await queryHelpers.queryOne<any>(
    `SELECT * FROM initiative_templates WHERE id = ?`,
    [templateId]
  );
  if (!template) {
    return {
      valid: false,
      hasWbs: false,
      hasMilestones: false,
      hasRoles: false,
      hasDod: false,
      wbsItemCount: 0,
      issues: ['Template not found'],
    };
  }

  const wbsCount = await queryHelpers.queryOne<any>(
    `SELECT COUNT(*) as cnt FROM blueprint_wbs_items WHERE template_id = ?`,
    [templateId]
  );
  const wbsItemCount = Number(wbsCount?.cnt) || 0;
  const hasWbs = wbsItemCount > 0;

  let hasMilestones = false;
  if (template.milestone_dependencies_json) {
    try {
      const ms = JSON.parse(template.milestone_dependencies_json);
      hasMilestones = Array.isArray(ms) && ms.length > 0;
    } catch {
      /* */
    }
  }
  if (!hasMilestones && template.suggested_milestones) {
    try {
      const ms = JSON.parse(template.suggested_milestones);
      hasMilestones = Array.isArray(ms) && ms.length > 0;
    } catch {
      /* */
    }
  }

  let hasRoles = false;
  if (template.role_templates_json) {
    try {
      const r = JSON.parse(template.role_templates_json);
      hasRoles = Array.isArray(r) && r.length > 0;
    } catch {
      /* */
    }
  }

  let hasDod = false;
  if (template.dod_per_level_json) {
    try {
      const d = JSON.parse(template.dod_per_level_json);
      hasDod = Object.keys(d).length > 0;
    } catch {
      /* */
    }
  }

  const issues: string[] = [];
  if (!hasWbs) issues.push('No WBS items defined');
  if (!hasMilestones) issues.push('No milestone dependencies defined');
  if (!hasRoles) issues.push('No role templates defined');
  if (!hasDod) issues.push('No Definition of Done per level defined');

  return {
    valid: issues.length === 0,
    hasWbs,
    hasMilestones,
    hasRoles,
    hasDod,
    wbsItemCount,
    issues,
  };
}

export async function cloneBlueprint(
  sourceTemplateId: string,
  orgId: string,
  userId: string
): Promise<{ newTemplateId: string }> {
  const source = await queryHelpers.queryOne<any>(
    `SELECT * FROM initiative_templates WHERE id = ?`,
    [sourceTemplateId]
  );
  if (!source) throw new Error('Source template not found');

  const newId = uuidv4();
  const now = new Date().toISOString();

  let cols: string[] = [];
  try {
    const info = await queryHelpers.queryAll<any>(`PRAGMA table_info(initiative_templates)`);
    cols = (info || []).map((r: any) => String(r.name || '')).filter(Boolean);
  } catch {
    cols = [];
  }

  if (cols.length > 0) {
    const insertCols: string[] = [];
    const insertVals: unknown[] = [];
    for (const c of cols) {
      insertCols.push(c);
      if (c === 'id') insertVals.push(newId);
      else if (c === 'organization_id') insertVals.push(orgId);
      else if (c === 'name') insertVals.push(`${source.name || 'Blueprint'} (Clone)`);
      else if (c === 'is_public') insertVals.push(0);
      else if (c === 'created_at') insertVals.push(now);
      else if (c === 'updated_at') insertVals.push(now);
      else if (c === 'created_by') insertVals.push(userId);
      else insertVals.push(source[c] ?? null);
    }
    const placeholders = insertCols.map(() => '?').join(', ');
    await queryHelpers.queryRun(
      `INSERT INTO initiative_templates (${insertCols.join(', ')}) VALUES (${placeholders})`,
      insertVals
    );
  } else {
    await queryHelpers.queryRun(
      `INSERT INTO initiative_templates (id, organization_id, name, category, description, is_public, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        newId,
        orgId,
        `${source.name || 'Blueprint'} (Clone)`,
        source.category || null,
        source.description || null,
        now,
        now,
        userId,
      ]
    );
  }

  // Clone WBS items
  const wbsItems = await queryHelpers.queryAll<any>(
    `SELECT * FROM blueprint_wbs_items WHERE template_id = ? ORDER BY level ASC, sort_order ASC`,
    [sourceTemplateId]
  );

  const wbsIdMap = new Map<string, string>();
  for (const item of wbsItems) {
    const newItemId = uuidv4();
    wbsIdMap.set(item.id, newItemId);
    const newParentId = item.parent_id ? wbsIdMap.get(item.parent_id) || null : null;

    await queryHelpers.queryRun(
      `INSERT INTO blueprint_wbs_items
         (id, template_id, parent_id, title, item_type, level, sort_order,
          estimated_hours, deliverables, acceptance_criteria, assigned_role, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newItemId,
        newId,
        newParentId,
        item.title,
        item.item_type,
        item.level,
        item.sort_order,
        item.estimated_hours,
        item.deliverables,
        item.acceptance_criteria,
        item.assigned_role,
        now,
      ]
    );
  }

  return { newTemplateId: newId };
}

export default {
  getWbsTree,
  getWbsFlat,
  addWbsItem,
  updateWbsItem,
  deleteWbsItem,
  reorderWbsItems,
  applyWbs,
  applyMilestoneDependencies,
  applyRoleTemplates,
  applyDoDPerLevel,
  validateBlueprint,
  cloneBlueprint,
};
