/**
 * Report Template Service
 * 
 * Manages custom report templates for organizations.
 * 
 * PMO Standards:
 * - PRINCE2: Configuration Management
 * - ISO 21500: Document Management
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// Database helpers
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

const ReportTemplateService = {
    /**
     * Get all templates for an organization
     */
    getTemplates: async (organizationId) => {
        const templates = await dbAll(`
            SELECT * FROM management_report_templates
            WHERE (organization_id = ? OR organization_id = 'system') AND is_active = 1
            ORDER BY is_default DESC, name ASC
        `, [organizationId]);

        return templates.map(t => ({
            id: t.id,
            organizationId: t.organization_id,
            name: t.name,
            description: t.description,
            reportType: t.report_type,
            scope: t.scope,
            sections: JSON.parse(t.sections || '[]'),
            defaultPeriodDays: t.default_period_days,
            defaultApprovalConfig: t.default_approval_config ? JSON.parse(t.default_approval_config) : null,
            isDefault: !!t.is_default,
            isSystem: t.organization_id === 'system',
            createdAt: t.created_at,
            updatedAt: t.updated_at
        }));
    },

    /**
     * Get a specific template
     */
    getTemplate: async (templateId) => {
        const template = await dbGet(
            'SELECT * FROM management_report_templates WHERE id = ?',
            [templateId]
        );
        
        if (!template) return null;

        return {
            id: template.id,
            organizationId: template.organization_id,
            name: template.name,
            description: template.description,
            reportType: template.report_type,
            scope: template.scope,
            sections: JSON.parse(template.sections || '[]'),
            defaultPeriodDays: template.default_period_days,
            defaultAiEnhancement: !!template.default_ai_enhancement,
            defaultApprovalConfig: template.default_approval_config ? JSON.parse(template.default_approval_config) : null,
            customHeaderText: template.custom_header_text,
            customFooterText: template.custom_footer_text,
            includeLogo: !!template.include_logo,
            pdfOrientation: template.pdf_orientation,
            pptxTheme: template.pptx_theme,
            isDefault: !!template.is_default,
            isActive: !!template.is_active,
            createdBy: template.created_by,
            createdAt: template.created_at,
            updatedAt: template.updated_at
        };
    },

    /**
     * Get default template for a report type
     */
    getDefaultTemplate: async (organizationId, reportType) => {
        // First try org-specific default
        let template = await dbGet(`
            SELECT * FROM management_report_templates
            WHERE organization_id = ? AND report_type = ? AND is_default = 1 AND is_active = 1
        `, [organizationId, reportType]);

        // Fall back to system default
        if (!template) {
            template = await dbGet(`
                SELECT * FROM management_report_templates
                WHERE organization_id = 'system' AND report_type = ? AND is_default = 1
            `, [reportType]);
        }

        if (!template) return null;

        return ReportTemplateService.getTemplate(template.id);
    },

    /**
     * Create a new template
     */
    createTemplate: async (organizationId, data, userId) => {
        const id = uuidv4();

        await dbRun(`
            INSERT INTO management_report_templates 
            (id, organization_id, name, description, report_type, scope, sections, 
             default_period_days, default_ai_enhancement, default_approval_config,
             custom_header_text, custom_footer_text, include_logo, 
             pdf_orientation, pptx_theme, is_default, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            organizationId,
            data.name,
            data.description || null,
            data.reportType,
            data.scope || 'PROJECT',
            JSON.stringify(data.sections || []),
            data.defaultPeriodDays || 7,
            data.defaultAiEnhancement !== false ? 1 : 0,
            data.defaultApprovalConfig ? JSON.stringify(data.defaultApprovalConfig) : null,
            data.customHeaderText || null,
            data.customFooterText || null,
            data.includeLogo !== false ? 1 : 0,
            data.pdfOrientation || 'portrait',
            data.pptxTheme || 'professional',
            data.isDefault ? 1 : 0,
            userId
        ]);

        // If this is set as default, unset other defaults
        if (data.isDefault) {
            await dbRun(`
                UPDATE management_report_templates 
                SET is_default = 0 
                WHERE organization_id = ? AND report_type = ? AND id != ?
            `, [organizationId, data.reportType, id]);
        }

        return ReportTemplateService.getTemplate(id);
    },

    /**
     * Update a template
     */
    updateTemplate: async (templateId, data, userId) => {
        const existing = await dbGet(
            'SELECT * FROM management_report_templates WHERE id = ?',
            [templateId]
        );

        if (!existing) {
            throw new Error('Template not found');
        }

        if (existing.organization_id === 'system') {
            throw new Error('Cannot modify system templates');
        }

        await dbRun(`
            UPDATE management_report_templates 
            SET name = COALESCE(?, name),
                description = COALESCE(?, description),
                sections = COALESCE(?, sections),
                default_period_days = COALESCE(?, default_period_days),
                default_ai_enhancement = COALESCE(?, default_ai_enhancement),
                default_approval_config = COALESCE(?, default_approval_config),
                custom_header_text = COALESCE(?, custom_header_text),
                custom_footer_text = COALESCE(?, custom_footer_text),
                include_logo = COALESCE(?, include_logo),
                pdf_orientation = COALESCE(?, pdf_orientation),
                pptx_theme = COALESCE(?, pptx_theme),
                is_default = COALESCE(?, is_default),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            data.name,
            data.description,
            data.sections ? JSON.stringify(data.sections) : null,
            data.defaultPeriodDays,
            data.defaultAiEnhancement !== undefined ? (data.defaultAiEnhancement ? 1 : 0) : null,
            data.defaultApprovalConfig ? JSON.stringify(data.defaultApprovalConfig) : null,
            data.customHeaderText,
            data.customFooterText,
            data.includeLogo !== undefined ? (data.includeLogo ? 1 : 0) : null,
            data.pdfOrientation,
            data.pptxTheme,
            data.isDefault !== undefined ? (data.isDefault ? 1 : 0) : null,
            templateId
        ]);

        // Handle default flag change
        if (data.isDefault) {
            await dbRun(`
                UPDATE management_report_templates 
                SET is_default = 0 
                WHERE organization_id = ? AND report_type = ? AND id != ?
            `, [existing.organization_id, existing.report_type, templateId]);
        }

        return ReportTemplateService.getTemplate(templateId);
    },

    /**
     * Delete a template
     */
    deleteTemplate: async (templateId) => {
        const existing = await dbGet(
            'SELECT * FROM management_report_templates WHERE id = ?',
            [templateId]
        );

        if (!existing) {
            throw new Error('Template not found');
        }

        if (existing.organization_id === 'system') {
            throw new Error('Cannot delete system templates');
        }

        await dbRun(
            'UPDATE management_report_templates SET is_active = 0 WHERE id = ?',
            [templateId]
        );

        return { deleted: true, id: templateId };
    },

    /**
     * Clone a template (including system templates)
     */
    cloneTemplate: async (templateId, organizationId, newName, userId) => {
        const source = await ReportTemplateService.getTemplate(templateId);
        if (!source) {
            throw new Error('Source template not found');
        }

        return ReportTemplateService.createTemplate(organizationId, {
            name: newName || `${source.name} (Copy)`,
            description: source.description,
            reportType: source.reportType,
            scope: source.scope,
            sections: source.sections,
            defaultPeriodDays: source.defaultPeriodDays,
            defaultAiEnhancement: source.defaultAiEnhancement,
            defaultApprovalConfig: source.defaultApprovalConfig,
            customHeaderText: source.customHeaderText,
            customFooterText: source.customFooterText,
            includeLogo: source.includeLogo,
            pdfOrientation: source.pdfOrientation,
            pptxTheme: source.pptxTheme,
            isDefault: false
        }, userId);
    },

    /**
     * Get available section definitions
     */
    getSectionDefinitions: async (reportType = null) => {
        let query = 'SELECT * FROM management_report_section_definitions';
        const params = [];

        if (reportType) {
            query += ` WHERE report_types LIKE ?`;
            params.push(`%"${reportType}"%`);
        }

        query += ' ORDER BY display_order ASC';

        const sections = await dbAll(query, params);

        return sections.map(s => ({
            id: s.id,
            code: s.code,
            name: s.name,
            description: s.description,
            reportTypes: JSON.parse(s.report_types || '[]'),
            defaultConfig: s.default_config ? JSON.parse(s.default_config) : {},
            requiredDataSources: s.required_data_sources ? JSON.parse(s.required_data_sources) : [],
            displayOrder: s.display_order,
            isRequiredDefault: !!s.is_required_default
        }));
    }
};

module.exports = ReportTemplateService;



