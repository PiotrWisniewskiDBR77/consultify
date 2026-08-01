import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import DbPromise from '../utils/DbPromise.js';

export interface InitiativeTemplate {
  id: string;
  name: string;
  category: string;
  description: string | null;
  applicableAxes: string[];
  /**
   * Card scope determines which sections are visible/required in the initiative UI.
   * Stored inside template_data.cardScope for flexibility.
   */
  cardScope?: {
    showTasks?: boolean;
    showDecisions?: boolean;
    showRaid?: boolean;
    showGates?: boolean;
    showFinancialAnalysis?: boolean;
    showFinancialImpact?: boolean;
    showTeam?: boolean;
  };
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
  // V2 fields
  level?: string;
  isSystem?: boolean;
  sourceTypes?: string[];
  visibleSections?: Record<string, boolean>;
  requiredFields?: string[];
  workflowConfig?: Record<string, any>;
  notificationConfig?: Record<string, boolean>;
  suggestedDecisions?: any[];
  suggestedMilestones?: any[];
  suggestedKpis?: any[];
  sectionsCount?: number;
  sectionOrder?: Record<string, number>;
  sectionConfig?: Record<string, any>;
  // V3 fields – full project management config
  suggestedTaskItems?: any[];
  teamConfig?: Record<string, any>;
  escalationConfig?: Record<string, any>;
  gateConfig?: Record<string, any>;
  raidTemplates?: any[];
  financialConfig?: Record<string, any>;
  benefitsConfig?: Record<string, any>;
  statusReportConfig?: Record<string, any>;
  validationRules?: Record<string, any>;
}

export interface CreateTemplateParams {
  id?: string;
  name: string;
  category: string;
  description?: string;
  applicableAxes?: string[];
  cardScope?: InitiativeTemplate['cardScope'];
  problemStructured?: string;
  targetState?: string;
  killCriteria?: string[];
  suggestedTasks?: string[];
  suggestedRoles?: { role: string; allocation: number }[];
  typicalTimeline?: string;
  typicalBudgetRange?: string;
  isPublic?: boolean;
  organizationId?: string;
  // V2 fields
  level?: string;
  sourceTypes?: string[];
  visibleSections?: Record<string, boolean>;
  requiredFields?: string[];
  workflowConfig?: Record<string, any>;
  notificationConfig?: Record<string, boolean>;
  suggestedDecisions?: any[];
  suggestedMilestones?: any[];
  suggestedKpis?: any[];
  sectionOrder?: Record<string, number>;
  sectionConfig?: Record<string, any>;
  // V3 fields
  suggestedTaskItems?: any[];
  teamConfig?: Record<string, any>;
  escalationConfig?: Record<string, any>;
  gateConfig?: Record<string, any>;
  raidTemplates?: any[];
  financialConfig?: Record<string, any>;
  benefitsConfig?: Record<string, any>;
  statusReportConfig?: Record<string, any>;
  validationRules?: Record<string, any>;
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
  }: {
    category?: string | null;
    organizationId?: string | null;
    includePublic?: boolean;
  } = {}): Promise<InitiativeTemplate[]> {
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
  async createTemplate(
    template: CreateTemplateParams,
    userId: string
  ): Promise<InitiativeTemplate> {
    const id = template.id || uuidv4();
    const now = new Date().toISOString();

    const templateData = {
      cardScope: template.cardScope || undefined,
      problemStructured: template.problemStructured || null,
      targetState: template.targetState || null,
      killCriteria: template.killCriteria || [],
      suggestedTasks: template.suggestedTasks || [],
      suggestedRoles: template.suggestedRoles || [],
      typicalTimeline: template.typicalTimeline || null,
      typicalBudgetRange: template.typicalBudgetRange || null,
    };

    const visibleSections = template.visibleSections || {};
    const sectionOrder = template.sectionOrder || {};
    const sectionConfig = template.sectionConfig || {};
    const sectionsCount = Object.values(visibleSections).filter(Boolean).length;

    const sql = `
            INSERT INTO initiative_templates 
            (id, name, category, description, applicable_axes, template_data, 
             is_public, organization_id, created_by, created_at, updated_at,
             level, source_types, is_system, visible_sections, required_fields,
             workflow_config, notification_config, suggested_decisions,
             suggested_milestones, suggested_kpis, sections_count,
             section_order, section_config,
             suggested_tasks, team_config, escalation_config, gate_config,
             raid_templates, financial_config, benefits_config,
             status_report_config, validation_rules)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      template.level || 'standard',
      JSON.stringify(template.sourceTypes || ['assessment', 'tool', 'manual']),
      0, // is_system always false for user-created
      JSON.stringify(visibleSections),
      JSON.stringify(template.requiredFields || []),
      JSON.stringify(template.workflowConfig || {}),
      JSON.stringify(template.notificationConfig || {}),
      JSON.stringify(template.suggestedDecisions || []),
      JSON.stringify(template.suggestedMilestones || []),
      JSON.stringify(template.suggestedKpis || []),
      sectionsCount,
      JSON.stringify(sectionOrder),
      JSON.stringify(sectionConfig),
      // V3 fields
      JSON.stringify(template.suggestedTaskItems || []),
      JSON.stringify(template.teamConfig || {}),
      JSON.stringify(template.escalationConfig || {}),
      JSON.stringify(template.gateConfig || {}),
      JSON.stringify(template.raidTemplates || []),
      JSON.stringify(template.financialConfig || {}),
      JSON.stringify(template.benefitsConfig || {}),
      JSON.stringify(template.statusReportConfig || {}),
      JSON.stringify(template.validationRules || {}),
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
      // Return the same persisted composition contract immediately. Previously
      // create omitted these fields, so the UI saw a different card set until
      // the template was fetched again.
      level: template.level || 'standard',
      isSystem: false,
      sourceTypes: template.sourceTypes || ['assessment', 'tool', 'manual'],
      visibleSections,
      requiredFields: template.requiredFields || [],
      workflowConfig: template.workflowConfig || {},
      notificationConfig: template.notificationConfig || {},
      suggestedDecisions: template.suggestedDecisions || [],
      suggestedMilestones: template.suggestedMilestones || [],
      suggestedKpis: template.suggestedKpis || [],
      sectionsCount,
      sectionOrder,
      sectionConfig,
      suggestedTaskItems: template.suggestedTaskItems || [],
      teamConfig: template.teamConfig || {},
      escalationConfig: template.escalationConfig || {},
      gateConfig: template.gateConfig || {},
      raidTemplates: template.raidTemplates || [],
      financialConfig: template.financialConfig || {},
      benefitsConfig: template.benefitsConfig || {},
      statusReportConfig: template.statusReportConfig || {},
      validationRules: template.validationRules || {},
    };
  }

  /**
   * Update an existing template
   */
  async updateTemplate(
    id: string,
    updates: Partial<CreateTemplateParams>,
    userId?: string
  ): Promise<InitiativeTemplate> {
    const existing = await this.getTemplateById(id);
    if (!existing) {
      throw new Error('Template not found');
    }

    const now = new Date().toISOString();

    const templateData = {
      cardScope: updates.cardScope ?? existing.cardScope,
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
            SET name = ?, category = ?, description = ?,
                applicable_axes = ?, template_data = ?, is_public = ?,
                level = ?, source_types = ?, visible_sections = ?,
                required_fields = ?, workflow_config = ?, notification_config = ?,
                suggested_decisions = ?, suggested_milestones = ?, suggested_kpis = ?,
                sections_count = ?, section_order = ?, section_config = ?,
                suggested_tasks = ?, team_config = ?, escalation_config = ?,
                gate_config = ?, raid_templates = ?, financial_config = ?,
                benefits_config = ?, status_report_config = ?, validation_rules = ?,
                updated_at = ?
            WHERE id = ?
        `;

    const visibleSections = updates.visibleSections ?? existing.visibleSections ?? {};
    const sectionOrder = updates.sectionOrder ?? existing.sectionOrder ?? {};
    const sectionConfig = updates.sectionConfig ?? existing.sectionConfig ?? {};
    const sectionsCount = Object.values(visibleSections).filter(Boolean).length;

    await DbPromise.run(this.db, sql, [
      updates.name ?? existing.name,
      updates.category ?? existing.category,
      updates.description ?? existing.description,
      JSON.stringify(updates.applicableAxes ?? existing.applicableAxes),
      JSON.stringify(templateData),
      updates.isPublic !== undefined ? (updates.isPublic ? 1 : 0) : existing.isPublic ? 1 : 0,
      updates.level ?? existing.level ?? 'standard',
      JSON.stringify(
        updates.sourceTypes ?? existing.sourceTypes ?? ['assessment', 'tool', 'manual']
      ),
      JSON.stringify(visibleSections),
      JSON.stringify(updates.requiredFields ?? existing.requiredFields ?? []),
      JSON.stringify(updates.workflowConfig ?? existing.workflowConfig ?? {}),
      JSON.stringify(updates.notificationConfig ?? existing.notificationConfig ?? {}),
      JSON.stringify(updates.suggestedDecisions ?? existing.suggestedDecisions ?? []),
      JSON.stringify(updates.suggestedMilestones ?? existing.suggestedMilestones ?? []),
      JSON.stringify(updates.suggestedKpis ?? existing.suggestedKpis ?? []),
      sectionsCount,
      JSON.stringify(sectionOrder),
      JSON.stringify(sectionConfig),
      // V3 fields
      JSON.stringify(updates.suggestedTaskItems ?? existing.suggestedTaskItems ?? []),
      JSON.stringify(updates.teamConfig ?? existing.teamConfig ?? {}),
      JSON.stringify(updates.escalationConfig ?? existing.escalationConfig ?? {}),
      JSON.stringify(updates.gateConfig ?? existing.gateConfig ?? {}),
      JSON.stringify(updates.raidTemplates ?? existing.raidTemplates ?? []),
      JSON.stringify(updates.financialConfig ?? existing.financialConfig ?? {}),
      JSON.stringify(updates.benefitsConfig ?? existing.benefitsConfig ?? {}),
      JSON.stringify(updates.statusReportConfig ?? existing.statusReportConfig ?? {}),
      JSON.stringify(updates.validationRules ?? existing.validationRules ?? {}),
      now,
      id,
    ]);

    return {
      ...existing,
      ...updates,
      ...templateData,
      visibleSections,
      sectionOrder,
      sectionConfig,
      sectionsCount,
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

  async searchTemplates(
    query: string,
    organizationId: string | null = null
  ): Promise<InitiativeTemplate[]> {
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
      cardScope: templateData.cardScope || undefined,
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
      // V2 fields
      level: row.level || 'standard',
      isSystem: !!row.is_system,
      sourceTypes: JSON.parse(row.source_types || '["assessment","tool","manual"]'),
      visibleSections: JSON.parse(row.visible_sections || '{}'),
      requiredFields: JSON.parse(row.required_fields || '[]'),
      workflowConfig: JSON.parse(row.workflow_config || '{}'),
      notificationConfig: JSON.parse(row.notification_config || '{}'),
      suggestedDecisions: JSON.parse(row.suggested_decisions || '[]'),
      suggestedMilestones: JSON.parse(row.suggested_milestones || '[]'),
      suggestedKpis: JSON.parse(row.suggested_kpis || '[]'),
      sectionsCount: row.sections_count || 0,
      sectionOrder: JSON.parse(row.section_order || '{}'),
      sectionConfig: JSON.parse(row.section_config || '{}'),
      // V3 fields
      suggestedTaskItems: JSON.parse(row.suggested_tasks || '[]'),
      teamConfig: JSON.parse(row.team_config || '{}'),
      escalationConfig: JSON.parse(row.escalation_config || '{}'),
      gateConfig: JSON.parse(row.gate_config || '{}'),
      raidTemplates: JSON.parse(row.raid_templates || '[]'),
      financialConfig: JSON.parse(row.financial_config || '{}'),
      benefitsConfig: JSON.parse(row.benefits_config || '{}'),
      statusReportConfig: JSON.parse(row.status_report_config || '{}'),
      validationRules: JSON.parse(row.validation_rules || '{}'),
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
