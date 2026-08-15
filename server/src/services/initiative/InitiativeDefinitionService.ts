import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import { IDatabase } from '../../database/IDatabase.js';
import { createInitiative as funnelCreateInitiative } from './createInitiativeService.js';
import { resolveInitiativeProjectId } from '../initiativeProjectPolicyService.js';

export interface Initiative {
  id: string;
  organization_id: string;
  org_id?: string; // Legacy alias
  project_id?: string;
  title: string;
  axis?: string;
  area?: string;
  summary?: string;
  hypothesis?: string;
  status: string;
  current_stage?: string;
  business_value?: string;
  competencies_required?: string[];
  cost_capex?: number;
  cost_opex?: number;
  expected_roi?: number;
  social_impact?: string;
  start_date?: string;
  pilot_end_date?: string;
  end_date?: string;
  due_date?: string;
  owner_business_id?: string;
  owner_id?: string; // Legacy alias
  owner_execution_id?: string;
  sponsor_id?: string;
  market_context?: string;
  created_at?: string;
  updated_at?: string;
  progress?: number; // From tasks
}

export interface CreateInitiativeData extends Omit<
  Initiative,
  'id' | 'created_at' | 'updated_at' | 'progress' | 'org_id' | 'owner_id'
> {
  // Optional allowed aliases for input
  org_id?: string;
  owner_id?: string;
}

export interface UpdateInitiativeData extends Partial<CreateInitiativeData> {}

export class InitiativeDefinitionService {
  private deps: {
    db: IDatabase;
    uuidv4: () => string;
  };

  constructor(deps?: { db: IDatabase; uuidv4: () => string }) {
    this.deps = deps || {
      db: getDatabase(),
      uuidv4,
    };
  }

  // For testing injection
  setDependencies(deps: { db: IDatabase; uuidv4: () => string }) {
    this.deps = deps;
  }

  async getInitiatives(
    organizationId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<Initiative[]> {
    const rows = (await this.deps.db.all<any[]>(
      `SELECT * FROM initiatives 
             WHERE organization_id = ?
    ORDER BY created_at DESC
LIMIT ? OFFSET ? `,
      [organizationId, limit, offset]
    )) as any[];
    return (rows || []).map((row: any) => this._mapInitiativeRow(row));
  }

  async getInitiativeById(id: string, organizationId?: string): Promise<Initiative | null> {
    let query = 'SELECT * FROM initiatives WHERE id = ?';
    const params = [id];

    if (organizationId) {
      query += ' AND organization_id = ?';
      params.push(organizationId);
    }

    const row = await this.deps.db.get<any>(query, params);
    if (!row) return null;
    return this._mapInitiativeRow(row);
  }

  async createInitiative(data: CreateInitiativeData): Promise<Initiative> {
    const orgId = data.organization_id || data.org_id;
    if (!orgId) throw new Error('Organization ID is required');

    // Uspójnienie F1.9 — kanoniczny lejek tworzenia inicjatyw.
    if (process.env.INITIATIVE_FUNNEL_ENABLED === 'true') {
      const ownerId = data.owner_business_id || data.owner_id || null;
      const __r = await funnelCreateInitiative(
        orgId,
        {
          title: data.title,
          projectId: data.project_id || null,
          axis: data.axis || null,
          area: data.area || null,
          summary: data.summary || null,
          hypothesis: data.hypothesis || null,
          status: data.status || null,
          businessValue: data.business_value ? Number(data.business_value) : null,
          costCapex: data.cost_capex || null,
          costOpex: data.cost_opex || null,
          expectedRoi: data.expected_roi || null,
          plannedStartDate: data.start_date || null,
          plannedEndDate: data.end_date || null,
          ownerBusinessId: ownerId,
          ownerExecutionId: data.owner_execution_id || null,
          sourceType: 'manual',
          sourceId: null,
        },
        { validate: false }
      );
      const created = await this.getInitiativeById(__r.id);
      if (!created) throw new Error('Failed to create initiative');
      return created;
    }

    const id = this.deps.uuidv4();
    const now = new Date().toISOString();
    const ownerId = data.owner_business_id || data.owner_id || null;
    const anchoredProjectId = await resolveInitiativeProjectId(orgId, data.project_id, {
      createdBy: ownerId,
    });

    // Build the INSERT column-by-column and include the legacy alias columns
    // (`org_id`, `owner_id`) ONLY when they actually exist in the table. The
    // canonical columns are `organization_id` / `owner_business_id`; some legacy
    // schemas additionally carry the aliases. Probing keeps this resilient across
    // both schema variants (and avoids "column org_id does not exist" on the
    // canonical schema).
    const existingCols = await this.getInitiativeColumns();
    const cols: string[] = [];
    const values: any[] = [];
    // Column-aware: include a column only if it exists in the table. When the
    // probe yields nothing (mock/SQLite test db), `existingCols` is empty and we
    // include everything (legacy behavior). This makes the INSERT resilient to
    // schema drift — the canonical Postgres schema lacks `org_id`, `owner_id`,
    // and `due_date`, which would otherwise throw "column does not exist".
    const push = (col: string, value: any) => {
      if (existingCols.size > 0 && !existingCols.has(col)) return;
      cols.push(col);
      values.push(value);
    };

    push('id', id);
    push('organization_id', orgId);
    push('org_id', orgId); // legacy alias — skipped if column absent
    push('project_id', anchoredProjectId);
    push('title', data.title);
    // `name` is a NOT-NULL legacy column that mirrors `title` in the canonical
    // schema; populate it (skipped automatically if the column is absent).
    push('name', data.title || (data as any).name || 'Untitled');
    push('axis', data.axis || null);
    push('area', data.area || null);
    push('summary', data.summary || null);
    push('hypothesis', data.hypothesis || null);
    push('status', data.status || 'DRAFT'); // Uspójnienie F1.11 — 'step3' (legacy, nieprawidłowy) → DRAFT
    push('current_stage', data.current_stage || null);
    push('business_value', data.business_value || null);
    push(
      'competencies_required',
      data.competencies_required ? JSON.stringify(data.competencies_required) : '[]'
    );
    push('cost_capex', data.cost_capex || 0);
    push('cost_opex', data.cost_opex || 0);
    push('expected_roi', data.expected_roi || 0);
    push('social_impact', data.social_impact || null);
    push('start_date', data.start_date || null);
    push('pilot_end_date', data.pilot_end_date || null);
    push('end_date', data.end_date || null);
    push('due_date', data.due_date || null); // skipped if column absent
    push('owner_business_id', ownerId);
    push('owner_id', ownerId); // legacy alias — skipped if column absent
    push('owner_execution_id', data.owner_execution_id || null);
    push('sponsor_id', data.sponsor_id || null);
    push('market_context', data.market_context || null);
    push('created_at', now);
    push('updated_at', now);

    const placeholders = cols.map(() => '?').join(', ');
    await this.deps.db.run(
      `INSERT INTO initiatives(${cols.join(', ')}) VALUES(${placeholders})`,
      values
    );

    const created = await this.getInitiativeById(id);
    if (!created) throw new Error('Failed to create initiative');
    return created;
  }

  /** Cached set of column names on the `initiatives` table (best-effort; resilient). */
  private _initiativeColumns: Set<string> | null = null;
  private async getInitiativeColumns(): Promise<Set<string>> {
    if (this._initiativeColumns) return this._initiativeColumns;
    try {
      const rows = (await this.deps.db.all<any[]>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'initiatives'`,
        []
      )) as Array<{ column_name?: string; COLUMN_NAME?: string }>;
      const set = new Set<string>();
      for (const r of rows || []) {
        const name = (r.column_name || r.COLUMN_NAME) as string | undefined;
        if (name) set.add(name);
      }
      // Only cache a non-empty probe; an empty result likely means the probe is
      // unsupported (e.g. a mock/SQLite test db) — don't poison the cache.
      if (set.size > 0) this._initiativeColumns = set;
      return set;
    } catch {
      // Probe failed (mock db, permissions, etc.) — assume canonical schema only
      // (no legacy alias columns). Returning an empty set is safe: aliases skipped.
      return new Set<string>();
    }
  }

  async updateInitiative(
    id: string,
    data: UpdateInitiativeData,
    organizationId?: string
  ): Promise<boolean> {
    const updates: string[] = [];
    const params: any[] = [];
    const now = new Date().toISOString();

    // Helper to add update field
    const addUpdate = (field: string, value: any) => {
      if (value !== undefined) {
        updates.push(`${field} = ?`);
        params.push(value);
      }
    };

    if (Object.keys(data).length === 0) return false;

    addUpdate('title', data.title);
    addUpdate('project_id', data.project_id);
    addUpdate('axis', data.axis);
    addUpdate('area', data.area);
    addUpdate('summary', data.summary);
    addUpdate('hypothesis', data.hypothesis);
    addUpdate('status', data.status);
    addUpdate('current_stage', data.current_stage);
    addUpdate('business_value', data.business_value);

    if (data.competencies_required !== undefined) {
      updates.push('competencies_required = ?');
      params.push(JSON.stringify(data.competencies_required));
    }

    addUpdate('cost_capex', data.cost_capex);
    addUpdate('cost_opex', data.cost_opex);
    addUpdate('expected_roi', data.expected_roi);
    addUpdate('social_impact', data.social_impact);
    addUpdate('start_date', data.start_date);
    addUpdate('pilot_end_date', data.pilot_end_date);
    addUpdate('end_date', data.end_date);
    addUpdate('due_date', data.due_date);

    // Handle owners with alias sync
    if (data.owner_business_id !== undefined || data.owner_id !== undefined) {
      const val = data.owner_business_id || data.owner_id;
      updates.push('owner_business_id = ?');
      params.push(val);
      updates.push('owner_id = ?');
      params.push(val);
    }

    addUpdate('owner_execution_id', data.owner_execution_id);
    addUpdate('sponsor_id', data.sponsor_id);
    addUpdate('market_context', data.market_context);

    updates.push('updated_at = ?');
    params.push(now);

    let query = `UPDATE initiatives SET ${updates.join(', ')} WHERE id = ? `;
    params.push(id);

    if (organizationId) {
      query += ' AND organization_id = ?';
      params.push(organizationId);
    }

    const result = (await this.deps.db.run(query, params)) as any;
    return result.changes > 0;
  }

  async deleteInitiative(id: string, organizationId?: string): Promise<boolean> {
    let query = 'DELETE FROM initiatives WHERE id = ?';
    const params = [id];

    if (organizationId) {
      query += ' AND organization_id = ?';
      params.push(organizationId);
    }

    const result = (await this.deps.db.run(query, params)) as any;
    return result.changes > 0;
  }

  private _mapInitiativeRow(row: any): Initiative {
    return {
      ...row,
      competencies_required: row.competencies_required ? JSON.parse(row.competencies_required) : [],
    };
  }
}
