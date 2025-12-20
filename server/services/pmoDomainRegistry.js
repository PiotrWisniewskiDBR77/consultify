/**
 * PMO Domain Registry Service
 * 
 * SCMS Meta-PMO Framework: Certifiable, Methodology-Neutral PMO Model
 * 
 * This service implements the core principle:
 * "SCMS implements common denominators of professional PMO standards 
 *  with no proprietary terminology and clear traceability to known norms."
 * 
 * Standards Compatibility:
 * - ISO 21500:2021 (Guidance on Project Management)
 * - PMI PMBOK 7th Edition (Project Management Body of Knowledge)
 * - PRINCE2 (Projects IN Controlled Environments)
 * 
 * @module pmoDomainRegistry
 */

let db = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * PMO Domain IDs - Certifiable Core Domains
 * 
 * @mapping ISO 21500: Subject Groups (Integration, Stakeholder, Scope, Resource, Time, Cost, Risk, Quality, Procurement, Communication)
 * @mapping PMBOK 7: Performance Domains (Stakeholder, Team, Development Approach, Planning, Project Work, Delivery, Measurement, Uncertainty)
 * @mapping PRINCE2: Themes (Business Case, Organization, Quality, Plans, Risk, Change, Progress)
 */
const PMO_DOMAIN_IDS = {
    GOVERNANCE_DECISION_MAKING: 'GOVERNANCE_DECISION_MAKING',
    SCOPE_CHANGE_CONTROL: 'SCOPE_CHANGE_CONTROL',
    SCHEDULE_MILESTONES: 'SCHEDULE_MILESTONES',
    RISK_ISSUE_MANAGEMENT: 'RISK_ISSUE_MANAGEMENT',
    RESOURCE_RESPONSIBILITY: 'RESOURCE_RESPONSIBILITY',
    PERFORMANCE_MONITORING: 'PERFORMANCE_MONITORING',
    BENEFITS_REALIZATION: 'BENEFITS_REALIZATION'
};

/**
 * PMO Domains Registry - First-Class Certifiable Concepts
 * 
 * Each domain:
 * - Is optional and configurable per project
 * - Has neutral naming (no vendor-specific terminology)
 * - Maps explicitly to ISO 21500, PMBOK, and PRINCE2
 * - Contains documentation hooks for certification audits
 */
const PMO_DOMAINS = [
    {
        id: PMO_DOMAIN_IDS.GOVERNANCE_DECISION_MAKING,
        name: 'Governance & Decision Making',
        description: 'Authority structures, decision rights, escalation paths, and approval workflows.',
        iso21500Term: 'Integration Subject Group (Decision Making)',
        pmbokTerm: 'Project Governance / Stakeholder Performance Domain',
        prince2Term: 'Organization Theme / Exception Management',
        isConfigurable: true,
        sortOrder: 1,
        scmsObjects: ['Decision', 'Escalation', 'GovernancePolicy', 'StageGate', 'ChangeRequest'],
        certificationNotes: 'Provides traceability for governance audit trails. Maps to ISO 21500 Clause 4.3 (Governance framework).'
    },
    {
        id: PMO_DOMAIN_IDS.SCOPE_CHANGE_CONTROL,
        name: 'Scope & Change Control',
        description: 'Baseline management, scope definition, and integrated change control.',
        iso21500Term: 'Scope Subject Group',
        pmbokTerm: 'Development Approach & Life Cycle Performance Domain',
        prince2Term: 'Change Theme / Configuration Management',
        isConfigurable: true,
        sortOrder: 2,
        scmsObjects: ['Initiative', 'Task', 'ScheduleBaseline', 'ChangeRequest'],
        certificationNotes: 'Supports ISO 21500 Clause 4.4.4 (Define scope) and PMBOK integrated change control.'
    },
    {
        id: PMO_DOMAIN_IDS.SCHEDULE_MILESTONES,
        name: 'Schedule & Milestones',
        description: 'Project lifecycle phases, stage gates, timeline management, and variance tracking.',
        iso21500Term: 'Time Subject Group / Project Phase',
        pmbokTerm: 'Planning Performance Domain / Schedule Management',
        prince2Term: 'Plans Theme / Stage',
        isConfigurable: true,
        sortOrder: 3,
        scmsObjects: ['Phase', 'StageGate', 'Roadmap', 'RoadmapInitiative', 'Wave'],
        certificationNotes: 'Maps to ISO 21500 Clause 4.4.6 (Define sequence of activities). Phase gates align with PRINCE2 Stage boundaries.'
    },
    {
        id: PMO_DOMAIN_IDS.RISK_ISSUE_MANAGEMENT,
        name: 'Risk & Issue Management',
        description: 'Risk identification, assessment, response planning, and issue tracking.',
        iso21500Term: 'Risk Subject Group',
        pmbokTerm: 'Uncertainty Performance Domain',
        prince2Term: 'Risk Theme',
        isConfigurable: true,
        sortOrder: 4,
        scmsObjects: ['Risk', 'Issue', 'BlockedReason', 'RiskAssessment'],
        certificationNotes: 'Provides RAID log functionality. Maps to ISO 21500 Clause 4.4.13 (Identify risks).'
    },
    {
        id: PMO_DOMAIN_IDS.RESOURCE_RESPONSIBILITY,
        name: 'Resource & Responsibility',
        description: 'Team assignments, capacity management, and accountability structures.',
        iso21500Term: 'Resource Subject Group',
        pmbokTerm: 'Team Performance Domain',
        prince2Term: 'Organization Theme (Roles & Responsibilities)',
        isConfigurable: true,
        sortOrder: 5,
        scmsObjects: ['User', 'Team', 'Assignment', 'Capacity', 'Owner'],
        certificationNotes: 'Supports RACI matrices and resource leveling. Maps to ISO 21500 Clause 4.4.8 (Develop team).'
    },
    {
        id: PMO_DOMAIN_IDS.PERFORMANCE_MONITORING,
        name: 'Performance Monitoring',
        description: 'Project health metrics, KPIs, variance analysis, and progress tracking.',
        iso21500Term: 'Integration Subject Group (Control)',
        pmbokTerm: 'Measurement Performance Domain',
        prince2Term: 'Progress Theme / Highlight Report',
        isConfigurable: true,
        sortOrder: 6,
        scmsObjects: ['PMOHealth', 'KPI', 'VarianceReport', 'Progress', 'ExecutiveReport'],
        certificationNotes: 'Provides earned value and health scoring. Maps to ISO 21500 Clause 4.4.22 (Control project work).'
    },
    {
        id: PMO_DOMAIN_IDS.BENEFITS_REALIZATION,
        name: 'Benefits Realization',
        description: 'Value hypothesis tracking, benefits validation, and project closure.',
        iso21500Term: 'Integration Subject Group (Benefits)',
        pmbokTerm: 'Delivery Performance Domain / Benefits Management',
        prince2Term: 'Business Case Theme',
        isConfigurable: true,
        sortOrder: 7,
        scmsObjects: ['ValueHypothesis', 'FinancialAssumption', 'ProjectClosure', 'StabilizationStatus'],
        certificationNotes: 'Placeholder domain for future enhancement. Maps to PRINCE2 continued business justification principle.'
    }
];

/**
 * PMO Domain Registry Service
 */
const PMODomainRegistry = {
    PMO_DOMAIN_IDS,
    PMO_DOMAINS,

    /**
     * Initialize the domain registry in the database
     * Called during database initialization
     */
    async seedDomains() {
        return new Promise((resolve, reject) => {
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO pmo_domains 
                (id, name, description, iso21500_term, pmbok_term, prince2_term, is_configurable, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            PMO_DOMAINS.forEach(domain => {
                stmt.run([
                    domain.id,
                    domain.name,
                    domain.description,
                    domain.iso21500Term,
                    domain.pmbokTerm,
                    domain.prince2Term,
                    domain.isConfigurable ? 1 : 0,
                    domain.sortOrder
                ]);
            });

            stmt.finalize((err) => {
                if (err) reject(err);
                else resolve({ seeded: PMO_DOMAINS.length });
            });
        });
    },

    /**
     * Get all PMO domains with standards mapping
     * @returns {Promise<Array>} All domains
     */
    getAllDomains() {
        return new Promise((resolve, reject) => {
            db.all(`SELECT * FROM pmo_domains ORDER BY sort_order`, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || PMO_DOMAINS);
            });
        });
    },

    /**
     * Get a specific domain by ID
     * @param {string} domainId - The domain ID
     * @returns {Promise<Object>} Domain details
     */
    getDomain(domainId) {
        return new Promise((resolve, reject) => {
            const domain = PMO_DOMAINS.find(d => d.id === domainId);
            if (!domain) {
                reject(new Error(`Unknown PMO domain: ${domainId}`));
                return;
            }

            db.get(`SELECT * FROM pmo_domains WHERE id = ?`, [domainId], (err, row) => {
                if (err) reject(err);
                else resolve(row || domain);
            });
        });
    },

    /**
     * Get enabled domains for a project
     * @param {string} projectId - The project ID
     * @returns {Promise<Array>} Enabled domain IDs
     */
    getProjectDomains(projectId) {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT pd.*, ppd.is_enabled, ppd.enabled_at
                FROM pmo_domains pd
                LEFT JOIN project_pmo_domains ppd ON pd.id = ppd.domain_id AND ppd.project_id = ?
                ORDER BY pd.sort_order
            `, [projectId], (err, rows) => {
                if (err) reject(err);
                else {
                    // If no project config exists, all domains are enabled by default
                    const domains = (rows || []).map(row => ({
                        ...row,
                        isEnabled: row.is_enabled !== 0 // null or 1 = enabled
                    }));
                    resolve(domains);
                }
            });
        });
    },

    /**
     * Configure which domains are enabled for a project
     * @param {string} projectId - The project ID
     * @param {Array} enabledDomainIds - Array of domain IDs to enable
     * @param {string} userId - The user making the change
     * @returns {Promise<Object>} Configuration result
     */
    async configureProjectDomains(projectId, enabledDomainIds, userId) {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                // First, set all domains to disabled for this project
                db.run(`
                    INSERT OR REPLACE INTO project_pmo_domains (project_id, domain_id, is_enabled, enabled_by, enabled_at)
                    SELECT ?, id, 0, ?, CURRENT_TIMESTAMP FROM pmo_domains
                `, [projectId, userId]);

                // Then enable the specified domains
                if (enabledDomainIds.length > 0) {
                    const placeholders = enabledDomainIds.map(() => '?').join(',');
                    db.run(`
                        UPDATE project_pmo_domains 
                        SET is_enabled = 1, enabled_by = ?, enabled_at = CURRENT_TIMESTAMP
                        WHERE project_id = ? AND domain_id IN (${placeholders})
                    `, [userId, projectId, ...enabledDomainIds], function (err) {
                        if (err) reject(err);
                        else resolve({ projectId, enabledDomains: enabledDomainIds, changes: this.changes });
                    });
                } else {
                    resolve({ projectId, enabledDomains: [], changes: 0 });
                }
            });
        });
    },

    /**
     * Get SCMS objects that belong to a specific domain
     * @param {string} domainId - The domain ID
     * @returns {Array} SCMS object types in this domain
     */
    getDomainObjects(domainId) {
        const domain = PMO_DOMAINS.find(d => d.id === domainId);
        return domain ? domain.scmsObjects : [];
    },

    /**
     * Determine which domain an SCMS object belongs to
     * @param {string} objectType - The SCMS object type (e.g., 'Decision', 'Initiative')
     * @returns {Object|null} The domain containing this object
     */
    getDomainForObject: (objectType) => {
        return PMO_DOMAINS.find(d => d.scmsObjects.includes(objectType)) || PMO_DOMAINS.find(d => d.id === 'integration_management');
    },

    // Test helper
    _setDb: (mockDb) => { db = mockDb; },

    /**
     * Get certification notes for a domain
     * Useful for audit documentation
     * @param {string} domainId - The domain ID
     * @returns {string} Certification notes
     */
    getCertificationNotes(domainId) {
        const domain = PMO_DOMAINS.find(d => d.id === domainId);
        return domain ? domain.certificationNotes : '';
    },

    /**
     * Record an action in the PMO audit trail
     * Provides certification traceability
     * @param {Object} auditData - Audit entry data
     * @returns {Promise<Object>} Created audit entry
     */
    recordAuditEntry(auditData) {
        return new Promise((resolve, reject) => {
            const {
                projectId,
                pmoDomainId,
                pmoPhase,
                objectType,
                objectId,
                action,
                actorId
            } = auditData;

            const id = uuidv4();
            const domain = PMO_DOMAINS.find(d => d.id === pmoDomainId);

            const sql = `
                INSERT INTO pmo_audit_trail 
                (id, project_id, pmo_domain_id, pmo_phase, object_type, object_id, action, actor_id, iso21500_mapping, pmbok_mapping, prince2_mapping)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.run(sql, [
                id,
                projectId,
                pmoDomainId,
                pmoPhase,
                objectType,
                objectId,
                action,
                actorId,
                domain?.iso21500Term || 'N/A',
                domain?.pmbokTerm || 'N/A',
                domain?.prince2Term || 'N/A'
            ], function (err) {
                if (err) reject(err);
                else resolve({ id, ...auditData });
            });
        });
    },

    /**
     * Get audit trail for a project
     * @param {string} projectId - The project ID
     * @param {Object} options - Filter options
     * @returns {Promise<Array>} Audit entries
     */
    getProjectAuditTrail(projectId, options = {}) {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT pat.*, pd.name as domain_name
                FROM pmo_audit_trail pat
                LEFT JOIN pmo_domains pd ON pat.pmo_domain_id = pd.id
                WHERE pat.project_id = ?
            `;
            const params = [projectId];

            if (options.domainId) {
                sql += ` AND pat.pmo_domain_id = ?`;
                params.push(options.domainId);
            }
            if (options.objectType) {
                sql += ` AND pat.object_type = ?`;
                params.push(options.objectType);
            }

            sql += ` ORDER BY pat.created_at DESC`;

            if (options.limit) {
                sql += ` LIMIT ?`;
                params.push(options.limit);
            }

            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }
};

module.exports = PMODomainRegistry;
