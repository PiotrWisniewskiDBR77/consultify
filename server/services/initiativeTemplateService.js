/**
 * Initiative Template Service
 * 
 * CRUD operations for initiative templates.
 * Templates provide reusable charter patterns for common transformation scenarios.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database');

class InitiativeTemplateService {
    /**
     * Get all available templates
     * @param {Object} options - Filter options
     * @returns {Promise<Array>} List of templates
     */
    static async getTemplates({ category = null, organizationId = null, includePublic = true } = {}) {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT * FROM initiative_templates
                WHERE 1=1
            `;
            const params = [];

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

            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                
                const templates = (rows || []).map(row => this.parseTemplateRow(row));
                resolve(templates);
            });
        });
    }

    /**
     * Get template by ID
     * @param {string} id - Template ID
     * @returns {Promise<Object|null>} Template or null
     */
    static async getTemplateById(id) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM initiative_templates WHERE id = ?`;

            db.get(sql, [id], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);

                resolve(this.parseTemplateRow(row));
            });
        });
    }

    /**
     * Create a new template
     * @param {Object} template - Template data
     * @param {string} userId - Creating user ID
     * @returns {Promise<Object>} Created template
     */
    static async createTemplate(template, userId) {
        return new Promise((resolve, reject) => {
            const id = template.id || uuidv4();
            const now = new Date().toISOString();

            const templateData = {
                problemStructured: template.problemStructured || null,
                targetState: template.targetState || null,
                killCriteria: template.killCriteria || [],
                suggestedTasks: template.suggestedTasks || [],
                suggestedRoles: template.suggestedRoles || [],
                typicalTimeline: template.typicalTimeline || null,
                typicalBudgetRange: template.typicalBudgetRange || null
            };

            const sql = `
                INSERT INTO initiative_templates 
                (id, name, category, description, applicable_axes, template_data, 
                 is_public, organization_id, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.run(sql, [
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
                now
            ], function(err) {
                if (err) return reject(err);

                resolve({
                    id,
                    name: template.name,
                    category: template.category,
                    description: template.description,
                    applicableAxes: template.applicableAxes || [],
                    ...templateData,
                    isPublic: !!template.isPublic,
                    organizationId: template.organizationId,
                    createdBy: userId,
                    createdAt: now,
                    updatedAt: now
                });
            });
        });
    }

    /**
     * Update an existing template
     * @param {string} id - Template ID
     * @param {Object} updates - Updated fields
     * @returns {Promise<Object>} Updated template
     */
    static async updateTemplate(id, updates) {
        return new Promise(async (resolve, reject) => {
            const existing = await this.getTemplateById(id);
            if (!existing) {
                return reject(new Error('Template not found'));
            }

            const now = new Date().toISOString();

            const templateData = {
                problemStructured: updates.problemStructured ?? existing.problemStructured,
                targetState: updates.targetState ?? existing.targetState,
                killCriteria: updates.killCriteria ?? existing.killCriteria,
                suggestedTasks: updates.suggestedTasks ?? existing.suggestedTasks,
                suggestedRoles: updates.suggestedRoles ?? existing.suggestedRoles,
                typicalTimeline: updates.typicalTimeline ?? existing.typicalTimeline,
                typicalBudgetRange: updates.typicalBudgetRange ?? existing.typicalBudgetRange
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

            db.run(sql, [
                updates.name ?? existing.name,
                updates.category ?? existing.category,
                updates.description ?? existing.description,
                JSON.stringify(updates.applicableAxes ?? existing.applicableAxes),
                JSON.stringify(templateData),
                updates.isPublic !== undefined ? (updates.isPublic ? 1 : 0) : (existing.isPublic ? 1 : 0),
                now,
                id
            ], (err) => {
                if (err) return reject(err);
                
                resolve({
                    ...existing,
                    ...updates,
                    ...templateData,
                    updatedAt: now
                });
            });
        });
    }

    /**
     * Delete a template
     * @param {string} id - Template ID
     * @returns {Promise<boolean>} Success
     */
    static async deleteTemplate(id) {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM initiative_templates WHERE id = ?`;

            db.run(sql, [id], function(err) {
                if (err) return reject(err);
                resolve(this.changes > 0);
            });
        });
    }

    /**
     * Apply template to a charter draft
     * @param {string} templateId - Template ID
     * @param {Object} charter - Existing charter draft
     * @returns {Promise<Object>} Charter with template applied
     */
    static async applyTemplate(templateId, charter) {
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
            killCriteria: charter.killCriteria?.length 
                ? charter.killCriteria 
                : template.killCriteria || [],
            
            // Tasks - merge, charter takes precedence
            suggestedTasks: charter.suggestedTasks?.length 
                ? charter.suggestedTasks 
                : template.suggestedTasks || [],
            
            // Team - use template if not specified
            suggestedTeam: charter.suggestedTeam?.length 
                ? charter.suggestedTeam 
                : (template.suggestedRoles || []).map(r => ({
                    id: uuidv4(),
                    role: r.role,
                    allocation: r.allocation
                })),
            
            // Timeline - use template if not specified
            timeline: charter.timeline || template.typicalTimeline,
            
            // Budget hint from template
            estimatedBudgetHint: template.typicalBudgetRange
        };
    }

    /**
     * Get templates by category with counts
     * @returns {Promise<Object>} Categories with template counts
     */
    static async getTemplateCategories() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT category, COUNT(*) as count 
                FROM initiative_templates 
                WHERE is_public = 1 
                GROUP BY category 
                ORDER BY category
            `;

            db.all(sql, [], (err, rows) => {
                if (err) return reject(err);

                const categories = {};
                (rows || []).forEach(row => {
                    categories[row.category] = row.count;
                });

                resolve(categories);
            });
        });
    }

    /**
     * Search templates
     * @param {string} query - Search query
     * @param {string} organizationId - Optional org filter
     * @returns {Promise<Array>} Matching templates
     */
    static async searchTemplates(query, organizationId = null) {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT * FROM initiative_templates
                WHERE (name LIKE ? OR description LIKE ?)
                AND (is_public = 1 ${organizationId ? 'OR organization_id = ?' : ''})
                ORDER BY name
                LIMIT 20
            `;

            const searchTerm = `%${query}%`;
            const params = [searchTerm, searchTerm];
            if (organizationId) params.push(organizationId);

            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                
                const templates = (rows || []).map(row => this.parseTemplateRow(row));
                resolve(templates);
            });
        });
    }

    /**
     * Parse database row to template object
     */
    static parseTemplateRow(row) {
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
            updatedAt: row.updated_at
        };
    }
}

module.exports = InitiativeTemplateService;

