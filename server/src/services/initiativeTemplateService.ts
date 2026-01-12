import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import DbPromise from '../utils/DbPromise.js';

export interface InitiativeTemplate {
    id: string;
    name: string;
    category: string;
    description: string | null;
    applicableAxes: string[];
    problemStructured?: string | null;
    targetState?: string | null;
    killCriteria: string[];
    suggestedTasks: string[];
    suggestedRoles: { role: string; allocation: number }[];
    typicalTimeline?: string | null;
    typicalBudgetRange?: string | null;
    isPublic: boolean;
    organizationId: string | null;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateTemplateParams {
    id?: string;
    name: string;
    category: string;
    description?: string;
    applicableAxes?: string[];
    problemStructured?: string;
    targetState?: string;
    killCriteria?: string[];
    suggestedTasks?: string[];
    suggestedRoles?: { role: string; allocation: number }[];
    typicalTimeline?: string;
    typicalBudgetRange?: string;
    isPublic?: boolean;
    organizationId?: string;
}

export class InitiativeTemplateService {
    private db;

    constructor() {
        this.db = getDatabase();
    }

    /**
     * Get all available templates
     */
    async getTemplates({
        category = null,
        organizationId = null,
        includePublic = true,
    }: { category?: string | null; organizationId?: string | null; includePublic?: boolean } = {}): Promise<
        InitiativeTemplate[]
    > {
        let sql = `SELECT * FROM initiative_templates WHERE 1=1`;
        const params: any[] = [];

        if (category) {
            sql += ` AND category = ?`;
            params.push(category);
        }

        if (organizationId && includePublic) {
            sql += ` AND (organization_id = ? OR is_public = 1)`;
            params.push(organizationId);
        } else if (organizationId) {
            sql += ` AND organization_id = ?`;
            params.push(organizationId);
        } else if (includePublic) {
            sql += ` AND is_public = 1`;
        }

        sql += ` ORDER BY category, name`;

        const rows = await DbPromise.all<any>(this.db, sql, params);
        return rows.map((row) => this.parseTemplateRow(row));
    }

    /**
     * Get template by ID
     */
    async getTemplateById(id: string): Promise<InitiativeTemplate | null> {
        const sql = `SELECT * FROM initiative_templates WHERE id = ?`;
        const row = await DbPromise.get<any>(this.db, sql, [id]);

        if (!row) return null;
        return this.parseTemplateRow(row);
    }

    /**
     * Create a new template
     */
    async createTemplate(template: CreateTemplateParams, userId: string): Promise<InitiativeTemplate> {
        const id = template.id || uuidv4();
        const now = new Date().toISOString();

        const templateData = {
            problemStructured: template.problemStructured || null,
            targetState: template.targetState || null,
            killCriteria: template.killCriteria || [],
            suggestedTasks: template.suggestedTasks || [],
            suggestedRoles: template.suggestedRoles || [],
            typicalTimeline: template.typicalTimeline || null,
            typicalBudgetRange: template.typicalBudgetRange || null,
        };

        const sql = `
            INSERT INTO initiative_templates 
            (id, name, category, description, applicable_axes, template_data, 
             is_public, organization_id, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await DbPromise.run(this.db, sql, [
            id,
            template.name,
            template.category,
            template.description || null,
            JSON.stringify(template.applicableAxes || []),
            JSON.stringify(templateData),
            template.isPublic ? 1 : 0,
            template.organizationId || null,
            userId,
            now,
            now,
        ]);

        return {
            id,
            name: template.name,
            category: template.category,
            description: template.description || null,
            applicableAxes: template.applicableAxes || [],
            ...templateData,
            isPublic: !!template.isPublic,
            organizationId: template.organizationId || null,
            createdBy: userId,
            createdAt: now,
            updatedAt: now,
        };
    }

    /**
     * Update an existing template
     */
    async updateTemplate(
        id: string,
        updates: Partial<CreateTemplateParams>,
        userId?: string,
    ): Promise<InitiativeTemplate> {
        const existing = await this.getTemplateById(id);
        if (!existing) {
            throw new Error('Template not found');
        }

        const now = new Date().toISOString();

        const templateData = {
            problemStructured: updates.problemStructured ?? existing.problemStructured,
            targetState: updates.targetState ?? existing.targetState,
            killCriteria: updates.killCriteria ?? existing.killCriteria,
            suggestedTasks: updates.suggestedTasks ?? existing.suggestedTasks,
            suggestedRoles: updates.suggestedRoles ?? existing.suggestedRoles,
            typicalTimeline: updates.typicalTimeline ?? existing.typicalTimeline,
            typicalBudgetRange: updates.typicalBudgetRange ?? existing.typicalBudgetRange,
        };

        const sql = `
            UPDATE initiative_templates 
            SET name = ?, 
                category = ?, 
                description = ?,
                applicable_axes = ?,
                template_data = ?,
                is_public = ?,
                updated_at = ?
            WHERE id = ?
        `;

        await DbPromise.run(this.db, sql, [
            updates.name ?? existing.name,
            updates.category ?? existing.category,
            updates.description ?? existing.description,
            JSON.stringify(updates.applicableAxes ?? existing.applicableAxes),
            JSON.stringify(templateData),
            updates.isPublic !== undefined ? (updates.isPublic ? 1 : 0) : existing.isPublic ? 1 : 0,
            now,
            id,
        ]);

        return {
            ...existing,
            ...updates,
            ...templateData,
            updatedAt: now,
        } as InitiativeTemplate;
    }

    /**
     * Delete a template
     */
    async deleteTemplate(id: string, userId?: string): Promise<boolean> {
        const sql = `DELETE FROM initiative_templates WHERE id = ?`;
        const result = await DbPromise.run(this.db, sql, [id]);
        return (result.changes || 0) > 0;
    }

    /**
     * Apply template to a charter draft
     */
    async applyTemplate(templateId: string, charter: any): Promise<any> {
        const template = await this.getTemplateById(templateId);
        if (!template) {
            throw new Error('Template not found');
        }

        // Merge template fields into charter (template values as defaults, charter values take precedence)
        return {
            ...charter,
            templateId: templateId,

            // Problem - use template if charter doesn't have
            problemStructured: charter.problemStructured || template.problemStructured,

            // Target state - use template if charter doesn't have
            targetState: charter.targetState || template.targetState,

            // Kill criteria - merge with template's
            killCriteria: charter.killCriteria?.length ? charter.killCriteria : template.killCriteria || [],

            // Tasks - merge, charter takes precedence
            suggestedTasks: charter.suggestedTasks?.length ? charter.suggestedTasks : template.suggestedTasks || [],

            // Team - use template if not specified
            suggestedTeam: charter.suggestedTeam?.length
                ? charter.suggestedTeam
                : (template.suggestedRoles || []).map((r) => ({
                      id: uuidv4(),
                      role: r.role,
                      allocation: r.allocation,
                  })),

            // Timeline - use template if not specified
            timeline: charter.timeline || template.typicalTimeline,

            // Budget hint from template
            estimatedBudgetHint: template.typicalBudgetRange,
        };
    }

    async getTemplateCategories(): Promise<Record<string, number>> {
        const sql = `
            SELECT category, COUNT(*) as count 
            FROM initiative_templates 
            WHERE is_public = 1 
            GROUP BY category 
            ORDER BY category
        `;

        const rows = await DbPromise.all<any>(this.db, sql, []);
        const categories: Record<string, number> = {};
        rows.forEach((row) => {
            categories[row.category] = row.count;
        });
        return categories;
    }

    async searchTemplates(query: string, organizationId: string | null = null): Promise<InitiativeTemplate[]> {
        const sql = `
            SELECT * FROM initiative_templates
            WHERE (name LIKE ? OR description LIKE ?)
            AND (is_public = 1 ${organizationId ? 'OR organization_id = ?' : ''})
            ORDER BY name
            LIMIT 20
        `;

        const searchTerm = `%${query}%`;
        const params = [searchTerm, searchTerm];
        if (organizationId) params.push(organizationId);

        const rows = await DbPromise.all<any>(this.db, sql, params);
        return rows.map((row) => this.parseTemplateRow(row));
    }

    /**
     * Parse database row to template object
     */
    private parseTemplateRow(row: any): InitiativeTemplate {
        const templateData = JSON.parse(row.template_data || '{}');
        const applicableAxes = JSON.parse(row.applicable_axes || '[]');

        return {
            id: row.id,
            name: row.name,
            category: row.category,
            description: row.description,
            applicableAxes,
            problemStructured: templateData.problemStructured,
            targetState: templateData.targetState,
            killCriteria: templateData.killCriteria || [],
            suggestedTasks: templateData.suggestedTasks || [],
            suggestedRoles: templateData.suggestedRoles || [],
            typicalTimeline: templateData.typicalTimeline,
            typicalBudgetRange: templateData.typicalBudgetRange,
            isPublic: !!row.is_public,
            organizationId: row.organization_id,
            createdBy: row.created_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    /**
     * Dependency Injection for tests
     */
    setDependencies(deps: { db?: any }) {
        if (deps.db) this.db = deps.db;
    }
}

export default new InitiativeTemplateService();
