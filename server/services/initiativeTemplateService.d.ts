export default InitiativeTemplateService;
declare class InitiativeTemplateService {
    /**
     * Get all available templates
     * @param {Object} options - Filter options
     * @returns {Promise<Array>} List of templates
     */
    static getTemplates({ category, organizationId, includePublic }?: Object): Promise<any[]>;
    /**
     * Get template by ID
     * @param {string} id - Template ID
     * @returns {Promise<Object|null>} Template or null
     */
    static getTemplateById(id: string): Promise<Object | null>;
    /**
     * Create a new template
     * @param {Object} template - Template data
     * @param {string} userId - Creating user ID
     * @returns {Promise<Object>} Created template
     */
    static createTemplate(template: Object, userId: string): Promise<Object>;
    /**
     * Update an existing template
     * @param {string} id - Template ID
     * @param {Object} updates - Updated fields
     * @returns {Promise<Object>} Updated template
     */
    static updateTemplate(id: string, updates: Object): Promise<Object>;
    /**
     * Delete a template
     * @param {string} id - Template ID
     * @returns {Promise<boolean>} Success
     */
    static deleteTemplate(id: string): Promise<boolean>;
    /**
     * Apply template to a charter draft
     * @param {string} templateId - Template ID
     * @param {Object} charter - Existing charter draft
     * @returns {Promise<Object>} Charter with template applied
     */
    static applyTemplate(templateId: string, charter: Object): Promise<Object>;
    /**
     * Get templates by category with counts
     * @returns {Promise<Object>} Categories with template counts
     */
    static getTemplateCategories(): Promise<Object>;
    /**
     * Search templates
     * @param {string} query - Search query
     * @param {string} organizationId - Optional org filter
     * @returns {Promise<Array>} Matching templates
     */
    static searchTemplates(query: string, organizationId?: string): Promise<any[]>;
    /**
     * Parse database row to template object
     */
    static parseTemplateRow(row: any): {
        id: any;
        name: any;
        category: any;
        description: any;
        applicableAxes: any;
        problemStructured: any;
        targetState: any;
        killCriteria: any;
        suggestedTasks: any;
        suggestedRoles: any;
        typicalTimeline: any;
        typicalBudgetRange: any;
        isPublic: boolean;
        organizationId: any;
        createdBy: any;
        createdAt: any;
        updatedAt: any;
    };
}
//# sourceMappingURL=initiativeTemplateService.d.ts.map