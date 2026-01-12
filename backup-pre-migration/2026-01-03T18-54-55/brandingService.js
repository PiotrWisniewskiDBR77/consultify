/**
 * Branding Service
 * 
 * Manages organization white-label and branding configuration.
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

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
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

const BrandingService = {
    /**
     * Get all organization brandings (SuperAdmin)
     */
    async listAll() {
        const brandings = await dbAll(`
            SELECT ob.*, o.name as organization_name 
            FROM organization_branding ob
            LEFT JOIN organizations o ON ob.organization_id = o.id
            ORDER BY ob.created_at DESC
        `);
        
        // Also get orgs without branding
        const orgsWithoutBranding = await dbAll(`
            SELECT o.id, o.name 
            FROM organizations o
            LEFT JOIN organization_branding ob ON o.id = ob.organization_id
            WHERE ob.id IS NULL
            ORDER BY o.name
        `);
        
        return {
            brandings: brandings.map(b => this._formatBranding(b)),
            orgsWithoutBranding
        };
    },
    
    /**
     * Get branding for specific organization
     */
    async getByOrganization(organizationId) {
        const branding = await dbGet(
            `SELECT ob.*, o.name as organization_name 
             FROM organization_branding ob
             LEFT JOIN organizations o ON ob.organization_id = o.id
             WHERE ob.organization_id = ?`,
            [organizationId]
        );
        
        if (!branding) return null;
        return this._formatBranding(branding);
    },
    
    /**
     * Create branding for organization
     */
    async create(organizationId, config, createdBy = null) {
        const existing = await dbGet(
            `SELECT id FROM organization_branding WHERE organization_id = ?`,
            [organizationId]
        );
        
        if (existing) {
            throw new Error('Branding already exists for this organization. Use update instead.');
        }
        
        const id = uuidv4();
        
        await dbRun(
            `INSERT INTO organization_branding (
                id, organization_id,
                logo_light_url, logo_dark_url, logo_icon_url, favicon_url,
                primary_color, secondary_color, accent_color, background_color, text_color,
                dark_primary_color, dark_secondary_color, dark_background_color, dark_text_color,
                font_family, heading_font_family,
                login_tagline, login_welcome_message,
                custom_support_email, custom_terms_url, custom_privacy_url,
                hide_powered_by,
                created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id, organizationId,
                config.logoLightUrl, config.logoDarkUrl, config.logoIconUrl, config.faviconUrl,
                config.primaryColor || '#8B5CF6',
                config.secondaryColor || '#3B82F6',
                config.accentColor || '#10B981',
                config.backgroundColor || '#F8FAFC',
                config.textColor || '#1E293B',
                config.darkPrimaryColor || '#A78BFA',
                config.darkSecondaryColor || '#60A5FA',
                config.darkBackgroundColor || '#0F172A',
                config.darkTextColor || '#F8FAFC',
                config.fontFamily || 'Inter',
                config.headingFontFamily || 'Inter',
                config.loginTagline,
                config.loginWelcomeMessage,
                config.customSupportEmail,
                config.customTermsUrl,
                config.customPrivacyUrl,
                config.hidePoweredBy ? 1 : 0,
                createdBy
            ]
        );
        
        return { id, success: true };
    },
    
    /**
     * Update branding for organization
     */
    async update(organizationId, updates, updatedBy = null) {
        const existing = await dbGet(
            `SELECT id FROM organization_branding WHERE organization_id = ?`,
            [organizationId]
        );
        
        if (!existing) {
            throw new Error('Branding not found. Use create instead.');
        }
        
        const fieldMappings = {
            logoLightUrl: 'logo_light_url',
            logoDarkUrl: 'logo_dark_url',
            logoIconUrl: 'logo_icon_url',
            faviconUrl: 'favicon_url',
            primaryColor: 'primary_color',
            secondaryColor: 'secondary_color',
            accentColor: 'accent_color',
            backgroundColor: 'background_color',
            textColor: 'text_color',
            darkPrimaryColor: 'dark_primary_color',
            darkSecondaryColor: 'dark_secondary_color',
            darkBackgroundColor: 'dark_background_color',
            darkTextColor: 'dark_text_color',
            fontFamily: 'font_family',
            headingFontFamily: 'heading_font_family',
            loginTagline: 'login_tagline',
            loginWelcomeMessage: 'login_welcome_message',
            loginBackgroundUrl: 'login_background_url',
            customSupportEmail: 'custom_support_email',
            customTermsUrl: 'custom_terms_url',
            customPrivacyUrl: 'custom_privacy_url',
            hidePoweredBy: 'hide_powered_by',
            customCss: 'custom_css',
        };
        
        const fields = [];
        const params = [];
        
        for (const [key, value] of Object.entries(updates)) {
            const dbKey = fieldMappings[key];
            if (dbKey) {
                fields.push(`${dbKey} = ?`);
                params.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
            }
        }
        
        if (fields.length === 0) {
            return { success: true, message: 'No changes' };
        }
        
        fields.push('updated_at = datetime("now")');
        params.push(organizationId);
        
        await dbRun(
            `UPDATE organization_branding SET ${fields.join(', ')} WHERE organization_id = ?`,
            params
        );
        
        return { success: true };
    },
    
    /**
     * Create or update branding
     */
    async upsert(organizationId, config, createdBy = null) {
        const existing = await dbGet(
            `SELECT id FROM organization_branding WHERE organization_id = ?`,
            [organizationId]
        );
        
        if (existing) {
            return this.update(organizationId, config, createdBy);
        } else {
            return this.create(organizationId, config, createdBy);
        }
    },
    
    /**
     * Delete branding (reset to defaults)
     */
    async delete(organizationId) {
        await dbRun(
            `DELETE FROM organization_branding WHERE organization_id = ?`,
            [organizationId]
        );
        
        return { success: true };
    },
    
    /**
     * Clone branding from one org to another
     */
    async clone(sourceOrgId, targetOrgId, createdBy = null) {
        const source = await this.getByOrganization(sourceOrgId);
        if (!source) {
            throw new Error('Source branding not found');
        }
        
        // Remove id and organization-specific fields
        const { id, organizationId, organizationName, createdAt, updatedAt, ...config } = source;
        
        return this.upsert(targetOrgId, config, createdBy);
    },
    
    // ==========================================
    // PRIVATE HELPERS
    // ==========================================
    
    _formatBranding(row) {
        return {
            id: row.id,
            organizationId: row.organization_id,
            organizationName: row.organization_name,
            // Logos
            logoLightUrl: row.logo_light_url,
            logoDarkUrl: row.logo_dark_url,
            logoIconUrl: row.logo_icon_url,
            faviconUrl: row.favicon_url,
            // Colors
            primaryColor: row.primary_color,
            secondaryColor: row.secondary_color,
            accentColor: row.accent_color,
            backgroundColor: row.background_color,
            textColor: row.text_color,
            // Dark mode
            darkPrimaryColor: row.dark_primary_color,
            darkSecondaryColor: row.dark_secondary_color,
            darkBackgroundColor: row.dark_background_color,
            darkTextColor: row.dark_text_color,
            // Typography
            fontFamily: row.font_family,
            headingFontFamily: row.heading_font_family,
            // Login
            loginBackgroundUrl: row.login_background_url,
            loginTagline: row.login_tagline,
            loginWelcomeMessage: row.login_welcome_message,
            // Custom domain
            customDomain: row.custom_domain,
            customDomainVerified: !!row.custom_domain_verified,
            customDomainSslStatus: row.custom_domain_ssl_status,
            // Features
            hidePoweredBy: !!row.hide_powered_by,
            customSupportEmail: row.custom_support_email,
            customTermsUrl: row.custom_terms_url,
            customPrivacyUrl: row.custom_privacy_url,
            customCss: row.custom_css,
            // Meta
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    },
};

module.exports = BrandingService;

