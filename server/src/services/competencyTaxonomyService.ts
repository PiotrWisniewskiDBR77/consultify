import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CompetencyCategory {
  id: string;
  organizationId: string;
  name: string;
  namePl: string | null;
  description: string | null;
  descriptionPl: string | null;
  icon: string;
  color: string;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompetencyLevel {
  id: string;
  organizationId: string;
  levelValue: number;
  label: string;
  labelPl: string | null;
  description: string | null;
  descriptionPl: string | null;
  isSystem: boolean;
  createdAt: string;
}

export interface CompetencyWithCategory {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  domain: string;
  categoryId: string | null;
  categoryName: string | null;
  tags: string[];
  isActive: boolean;
  initiativeCount: number;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeRequirementExpanded {
  id: string;
  organizationId: string;
  initiativeId: string | null;
  capabilityId: string;
  capabilityName: string;
  categoryName: string | null;
  minLevel: number;
  priority: 'required' | 'nice_to_have';
  headcount: number | null;
  justification: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Row mappers                                                        */
/* ------------------------------------------------------------------ */

function mapCategory(row: any): CompetencyCategory {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    namePl: row.name_pl,
    description: row.description,
    descriptionPl: row.description_pl,
    icon: row.icon || 'Layers',
    color: row.color || '#6366f1',
    sortOrder: row.sort_order ?? 0,
    isSystem: Boolean(row.is_system),
    isActive: Boolean(row.is_active),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLevel(row: any): CompetencyLevel {
  return {
    id: row.id,
    organizationId: row.organization_id,
    levelValue: row.level_value,
    label: row.label,
    labelPl: row.label_pl,
    description: row.description,
    descriptionPl: row.description_pl,
    isSystem: Boolean(row.is_system),
    createdAt: row.created_at,
  };
}

function mapCompetencyWithCategory(row: any): CompetencyWithCategory {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    domain: row.domain,
    categoryId: row.category_id,
    categoryName: row.category_name,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags ?? []),
    isActive: Boolean(row.is_active),
    initiativeCount: Number(row.initiative_count ?? 0),
    userCount: Number(row.user_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRequirementExpanded(row: any): InitiativeRequirementExpanded {
  return {
    id: row.id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id,
    capabilityId: row.capability_id,
    capabilityName: row.capability_name || '',
    categoryName: row.category_name,
    minLevel: row.min_level,
    priority: row.priority,
    headcount: row.headcount != null ? Number(row.headcount) : null,
    justification: row.justification,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/* ------------------------------------------------------------------ */
/*  Categories CRUD                                                    */
/* ------------------------------------------------------------------ */

export async function createCategory(
  orgId: string,
  data: {
    name: string;
    namePl?: string;
    description?: string;
    descriptionPl?: string;
    icon?: string;
    color?: string;
    sortOrder?: number;
    createdBy?: string;
  }
): Promise<CompetencyCategory> {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO competency_categories (id, organization_id, name, name_pl, description, description_pl, icon, color, sort_order, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      orgId,
      data.name,
      data.namePl ?? null,
      data.description ?? null,
      data.descriptionPl ?? null,
      data.icon ?? 'Layers',
      data.color ?? '#6366f1',
      data.sortOrder ?? 0,
      data.createdBy ?? null,
    ]
  );
  return getCategory(orgId, id) as Promise<CompetencyCategory>;
}

export async function getCategories(orgId: string): Promise<CompetencyCategory[]> {
  const rows = await dbAll(
    `SELECT * FROM competency_categories WHERE organization_id = $1 AND is_active = TRUE ORDER BY sort_order, name`,
    [orgId]
  );
  return rows.map(mapCategory);
}

export async function getCategory(orgId: string, id: string): Promise<CompetencyCategory | null> {
  const row = await dbGet(
    `SELECT * FROM competency_categories WHERE id = $1 AND organization_id = $2`,
    [id, orgId]
  );
  return row ? mapCategory(row) : null;
}

export async function updateCategory(
  orgId: string,
  id: string,
  data: Partial<{
    name: string;
    namePl: string;
    description: string;
    descriptionPl: string;
    icon: string;
    color: string;
    sortOrder: number;
  }>
): Promise<CompetencyCategory | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const fieldMap: Record<string, string> = {
    name: 'name',
    namePl: 'name_pl',
    description: 'description',
    descriptionPl: 'description_pl',
    icon: 'icon',
    color: 'color',
    sortOrder: 'sort_order',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if ((data as any)[key] !== undefined) {
      sets.push(`${col} = $${idx++}`);
      params.push((data as any)[key]);
    }
  }
  if (sets.length === 0) return getCategory(orgId, id);

  sets.push(`updated_at = NOW()`);
  params.push(id, orgId);
  await dbRun(
    `UPDATE competency_categories SET ${sets.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx}`,
    params
  );
  return getCategory(orgId, id);
}

export async function deleteCategory(orgId: string, id: string): Promise<void> {
  await dbRun(
    `UPDATE competency_categories SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND organization_id = $2`,
    [id, orgId]
  );
}

/* ------------------------------------------------------------------ */
/*  Levels CRUD                                                        */
/* ------------------------------------------------------------------ */

export async function getLevels(orgId: string): Promise<CompetencyLevel[]> {
  const rows = await dbAll(
    `SELECT * FROM competency_levels WHERE organization_id = $1 ORDER BY level_value`,
    [orgId]
  );
  return rows.map(mapLevel);
}

export async function seedDefaultLevels(orgId: string): Promise<CompetencyLevel[]> {
  const existing = await getLevels(orgId);
  if (existing.length > 0) return existing;

  const defaults = [
    {
      value: 1,
      label: 'Novice',
      labelPl: 'Początkujący',
      desc: 'Basic awareness, needs guidance',
      descPl: 'Podstawowa świadomość, wymaga prowadzenia',
    },
    {
      value: 2,
      label: 'Beginner',
      labelPl: 'Podstawowy',
      desc: 'Can perform simple tasks with support',
      descPl: 'Wykonuje proste zadania z pomocą',
    },
    {
      value: 3,
      label: 'Intermediate',
      labelPl: 'Średniozaawansowany',
      desc: 'Works independently on standard tasks',
      descPl: 'Pracuje samodzielnie nad standardowymi zadaniami',
    },
    {
      value: 4,
      label: 'Advanced',
      labelPl: 'Zaawansowany',
      desc: 'Handles complex situations, mentors others',
      descPl: 'Radzi sobie ze złożonymi sytuacjami, mentoruje innych',
    },
    {
      value: 5,
      label: 'Expert',
      labelPl: 'Ekspert',
      desc: 'Recognized authority, shapes organizational standards',
      descPl: 'Uznany autorytet, kształtuje standardy organizacyjne',
    },
  ];

  for (const d of defaults) {
    await dbRun(
      `INSERT INTO competency_levels (id, organization_id, level_value, label, label_pl, description, description_pl, is_system)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       ON CONFLICT (organization_id, level_value) DO NOTHING`,
      [uuidv4(), orgId, d.value, d.label, d.labelPl, d.desc, d.descPl]
    );
  }
  return getLevels(orgId);
}

export async function upsertLevel(
  orgId: string,
  levelValue: number,
  data: { label: string; labelPl?: string; description?: string; descriptionPl?: string }
): Promise<CompetencyLevel> {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO competency_levels (id, organization_id, level_value, label, label_pl, description, description_pl)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (organization_id, level_value) DO UPDATE SET
       label = EXCLUDED.label,
       label_pl = EXCLUDED.label_pl,
       description = EXCLUDED.description,
       description_pl = EXCLUDED.description_pl`,
    [
      id,
      orgId,
      levelValue,
      data.label,
      data.labelPl ?? null,
      data.description ?? null,
      data.descriptionPl ?? null,
    ]
  );
  const row = await dbGet(
    `SELECT * FROM competency_levels WHERE organization_id = $1 AND level_value = $2`,
    [orgId, levelValue]
  );
  return mapLevel(row);
}

/* ------------------------------------------------------------------ */
/*  Competencies with category + usage stats                          */
/* ------------------------------------------------------------------ */

export async function getCompetenciesWithStats(
  orgId: string,
  categoryId?: string
): Promise<CompetencyWithCategory[]> {
  const params: unknown[] = [orgId];
  let sql = `
    SELECT c.*, cc.name AS category_name,
      COALESCE(s.initiative_count, 0) AS initiative_count,
      COALESCE(s.user_count, 0) AS user_count
    FROM capabilities c
    LEFT JOIN competency_categories cc ON cc.id = c.category_id
    LEFT JOIN competency_usage_stats s ON s.capability_id = c.id
    WHERE c.organization_id = $1 AND c.is_active = TRUE`;

  if (categoryId) {
    sql += ` AND c.category_id = $2`;
    params.push(categoryId);
  }
  sql += ` ORDER BY cc.sort_order NULLS LAST, c.name`;

  const rows = await dbAll(sql, params);
  return rows.map(mapCompetencyWithCategory);
}

export async function updateCompetencyCategory(
  orgId: string,
  competencyId: string,
  categoryId: string | null
): Promise<void> {
  await dbRun(
    `UPDATE capabilities SET category_id = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3`,
    [categoryId, competencyId, orgId]
  );
}

/* ------------------------------------------------------------------ */
/*  Initiative requirements (expanded)                                 */
/* ------------------------------------------------------------------ */

export async function getInitiativeRequirements(
  orgId: string,
  initiativeId: string
): Promise<InitiativeRequirementExpanded[]> {
  const rows = await dbAll(
    `SELECT cr.*, c.name AS capability_name, cc.name AS category_name
     FROM capability_requirements cr
     JOIN capabilities c ON c.id = cr.capability_id
     LEFT JOIN competency_categories cc ON cc.id = c.category_id
     WHERE cr.organization_id = $1 AND cr.initiative_id = $2
     ORDER BY cc.sort_order NULLS LAST, c.name`,
    [orgId, initiativeId]
  );
  return rows.map(mapRequirementExpanded);
}

export async function addInitiativeRequirement(
  orgId: string,
  data: {
    initiativeId: string;
    capabilityId: string;
    minLevel: number;
    priority?: 'required' | 'nice_to_have';
    headcount?: number;
    justification?: string;
    notes?: string;
    createdBy?: string;
  }
): Promise<InitiativeRequirementExpanded> {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO capability_requirements (id, organization_id, initiative_id, capability_id, min_level, priority, headcount, justification, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      orgId,
      data.initiativeId,
      data.capabilityId,
      data.minLevel,
      data.priority ?? 'required',
      data.headcount ?? null,
      data.justification ?? null,
      data.notes ?? null,
      data.createdBy ?? null,
    ]
  );
  const row = await dbGet(
    `SELECT cr.*, c.name AS capability_name, cc.name AS category_name
     FROM capability_requirements cr
     JOIN capabilities c ON c.id = cr.capability_id
     LEFT JOIN competency_categories cc ON cc.id = c.category_id
     WHERE cr.id = $1`,
    [id]
  );
  return mapRequirementExpanded(row);
}

export async function updateInitiativeRequirement(
  orgId: string,
  reqId: string,
  data: Partial<{
    minLevel: number;
    priority: 'required' | 'nice_to_have';
    headcount: number | null;
    justification: string;
    notes: string;
  }>
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const fieldMap: Record<string, string> = {
    minLevel: 'min_level',
    priority: 'priority',
    headcount: 'headcount',
    justification: 'justification',
    notes: 'notes',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if ((data as any)[key] !== undefined) {
      sets.push(`${col} = $${idx++}`);
      params.push((data as any)[key]);
    }
  }
  if (sets.length === 0) return;

  sets.push(`updated_at = NOW()`);
  params.push(reqId, orgId);
  await dbRun(
    `UPDATE capability_requirements SET ${sets.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx}`,
    params
  );
}

export async function deleteInitiativeRequirement(orgId: string, reqId: string): Promise<void> {
  await dbRun(`DELETE FROM capability_requirements WHERE id = $1 AND organization_id = $2`, [
    reqId,
    orgId,
  ]);
}

/* ------------------------------------------------------------------ */
/*  Seed default categories                                            */
/* ------------------------------------------------------------------ */

export async function seedDefaultCategories(
  orgId: string,
  createdBy?: string
): Promise<CompetencyCategory[]> {
  const existing = await getCategories(orgId);
  if (existing.length > 0) return existing;

  const defaults = [
    { name: 'Strategy', namePl: 'Strategia', icon: 'Target', color: '#8b5cf6', order: 1 },
    { name: 'Operations', namePl: 'Operacje', icon: 'Settings', color: '#3b82f6', order: 2 },
    {
      name: 'Digital & Technology',
      namePl: 'Cyfryzacja i technologia',
      icon: 'Cpu',
      color: '#06b6d4',
      order: 3,
    },
    {
      name: 'Change Management',
      namePl: 'Zarządzanie zmianą',
      icon: 'RefreshCw',
      color: '#f59e0b',
      order: 4,
    },
    { name: 'Finance', namePl: 'Finanse', icon: 'DollarSign', color: '#10b981', order: 5 },
    {
      name: 'People & Leadership',
      namePl: 'Ludzie i przywództwo',
      icon: 'Users',
      color: '#ec4899',
      order: 6,
    },
  ];

  for (const d of defaults) {
    await createCategory(orgId, {
      name: d.name,
      namePl: d.namePl,
      icon: d.icon,
      color: d.color,
      sortOrder: d.order,
      createdBy,
    });
  }
  return getCategories(orgId);
}
