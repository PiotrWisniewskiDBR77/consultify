import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import { IDatabase } from '../../database/IDatabase.js';

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

    async getInitiatives(organizationId: string, limit: number = 100, offset: number = 0): Promise<Initiative[]> {
        const rows = (await this.deps.db.all<any[]>(
            `SELECT * FROM initiatives 
             WHERE organization_id = ?
    ORDER BY created_at DESC
LIMIT ? OFFSET ? `,
            [organizationId, limit, offset],
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
        const id = this.deps.uuidv4();
        const now = new Date().toISOString();
        const orgId = data.organization_id || data.org_id;

        if (!orgId) throw new Error('Organization ID is required');

        await this.deps.db.run(
            `INSERT INTO initiatives(
    id, organization_id, org_id, project_id, title, axis, area,
    summary, hypothesis, status, current_stage, business_value,
    competencies_required, cost_capex, cost_opex, expected_roi,
    social_impact, start_date, pilot_end_date, end_date, due_date,
    owner_business_id, owner_id, owner_execution_id, sponsor_id,
    market_context, created_at, updated_at
) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                orgId,
                orgId,
                data.project_id || null,
                data.title,
                data.axis || null,
                data.area || null,
                data.summary || null,
                data.hypothesis || null,
                data.status || 'step3',
                data.current_stage || null,
                data.business_value || null,
                data.competencies_required ? JSON.stringify(data.competencies_required) : '[]',
                data.cost_capex || 0,
                data.cost_opex || 0,
                data.expected_roi || 0,
                data.social_impact || null,
                data.start_date || null,
                data.pilot_end_date || null,
                data.end_date || null,
                data.due_date || null,
                data.owner_business_id || data.owner_id || null,
                data.owner_business_id || data.owner_id || null, // Fill both for legacy compat
                data.owner_execution_id || null,
                data.sponsor_id || null,
                data.market_context || null,
                now,
                now,
            ],
        );

        const created = await this.getInitiativeById(id);
        if (!created) throw new Error('Failed to create initiative');
        return created;
    }

    async updateInitiative(id: string, data: UpdateInitiativeData, organizationId?: string): Promise<boolean> {
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
