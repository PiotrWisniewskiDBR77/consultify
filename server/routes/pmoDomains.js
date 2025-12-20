/**
 * PMO Domains API Routes
 * 
 * SCMS Meta-PMO Framework: RESTful API for domain management
 * 
 * Provides endpoints for:
 * - Querying PMO domains with standards mapping
 * - Configuring per-project domain enablement
 * - Accessing the standards mapping table
 * - Retrieving audit trails for certification
 * 
 * Standards: ISO 21500, PMI PMBOK 7th Ed, PRINCE2
 * 
 * @module routes/pmoDomains
 */

const express = require('express');
const router = express.Router();
const PMODomainRegistry = require('../services/pmoDomainRegistry');
const PMOStandardsMapping = require('../services/pmoStandardsMapping');
const auth = require('../middleware/authMiddleware');

/**
 * GET /api/pmo-domains
 * 
 * Returns all PMO domains with standards mapping.
 * Used by UI for domain configuration and by auditors for certification.
 * 
 * @returns {Array} All 7 PMO domains with ISO/PMBOK/PRINCE2 terminology
 */
router.get('/', auth, async (req, res) => {
    try {
        const domains = await PMODomainRegistry.getAllDomains();
        res.json({
            success: true,
            data: domains,
            meta: {
                totalDomains: domains.length,
                standards: ['ISO 21500:2021', 'PMI PMBOK 7th Ed', 'PRINCE2'],
                description: 'Certifiable PMO domains with methodology-neutral terminology'
            }
        });
    } catch (error) {
        console.error('Error fetching PMO domains:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/pmo-domains/standards-mapping
 * 
 * Returns the complete SCMS → Standards mapping table.
 * Primary resource for certification audits.
 * 
 * @returns {Object} Full standards mapping with all concepts
 */
router.get('/standards-mapping', auth, async (req, res) => {
    try {
        const mappingTable = PMOStandardsMapping.generateMappingTable();
        const fullMapping = PMOStandardsMapping.getAllMappings();

        res.json({
            success: true,
            data: {
                table: mappingTable,
                detailed: fullMapping
            },
            meta: {
                standards: {
                    iso21500: 'ISO 21500:2021 - Guidance on Project Management',
                    pmbok7: 'PMI PMBOK 7th Edition - Project Management Body of Knowledge',
                    prince2: 'PRINCE2 - Projects IN Controlled Environments'
                },
                description: 'Explicit terminology mapping for certification and audit purposes'
            }
        });
    } catch (error) {
        console.error('Error fetching standards mapping:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/pmo-domains/:domainId
 * 
 * Returns details for a specific PMO domain.
 * 
 * @param {string} domainId - The PMO domain ID
 * @returns {Object} Domain details with standards mapping
 */
router.get('/:domainId', auth, async (req, res) => {
    try {
        const { domainId } = req.params;
        const domain = await PMODomainRegistry.getDomain(domainId);
        const objects = PMODomainRegistry.getDomainObjects(domainId);
        const certNotes = PMODomainRegistry.getCertificationNotes(domainId);

        res.json({
            success: true,
            data: {
                ...domain,
                scmsObjects: objects,
                certificationNotes: certNotes
            }
        });
    } catch (error) {
        console.error('Error fetching domain:', error);
        res.status(404).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/pmo-domains/:domainId/objects
 * 
 * Returns all SCMS objects belonging to a specific domain.
 * Useful for understanding domain scope.
 * 
 * @param {string} domainId - The PMO domain ID
 * @returns {Array} List of SCMS object types in this domain
 */
router.get('/:domainId/objects', auth, async (req, res) => {
    try {
        const { domainId } = req.params;
        const objects = PMODomainRegistry.getDomainObjects(domainId);
        const concepts = PMOStandardsMapping.getConceptsByDomain(domainId);

        res.json({
            success: true,
            data: {
                domainId,
                scmsObjects: objects,
                mappedConcepts: concepts
            }
        });
    } catch (error) {
        console.error('Error fetching domain objects:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/projects/:projectId/pmo-domains
 * 
 * Returns enabled PMO domains for a specific project.
 * 
 * @param {string} projectId - The project ID
 * @returns {Array} Domains with enabled status for this project
 */
router.get('/projects/:projectId', auth, async (req, res) => {
    try {
        const { projectId } = req.params;
        const domains = await PMODomainRegistry.getProjectDomains(projectId);

        res.json({
            success: true,
            data: domains,
            meta: {
                projectId,
                enabledCount: domains.filter(d => d.isEnabled).length,
                totalDomains: domains.length
            }
        });
    } catch (error) {
        console.error('Error fetching project domains:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/projects/:projectId/pmo-domains
 * 
 * Configure which PMO domains are enabled for a project.
 * Requires project admin permissions.
 * 
 * @param {string} projectId - The project ID
 * @body {Array} enabledDomains - Array of domain IDs to enable
 * @returns {Object} Updated configuration
 */
router.put('/projects/:projectId', auth, async (req, res) => {
    try {
        const { projectId } = req.params;
        const { enabledDomains } = req.body;
        const userId = req.user?.id;

        if (!Array.isArray(enabledDomains)) {
            return res.status(400).json({
                success: false,
                error: 'enabledDomains must be an array of domain IDs'
            });
        }

        // Validate domain IDs
        const validDomainIds = Object.values(PMODomainRegistry.PMO_DOMAIN_IDS);
        const invalidIds = enabledDomains.filter(id => !validDomainIds.includes(id));
        if (invalidIds.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Invalid domain IDs: ${invalidIds.join(', ')}`
            });
        }

        const result = await PMODomainRegistry.configureProjectDomains(
            projectId,
            enabledDomains,
            userId
        );

        // Record in audit trail
        await PMODomainRegistry.recordAuditEntry({
            projectId,
            pmoDomainId: 'GOVERNANCE_DECISION_MAKING',
            pmoPhase: 'Context', // Default, should be fetched from project
            objectType: 'PROJECT_PMO_CONFIG',
            objectId: projectId,
            action: 'DOMAINS_CONFIGURED',
            actorId: userId
        });

        res.json({
            success: true,
            data: result,
            message: `Updated PMO domain configuration for project ${projectId}`
        });
    } catch (error) {
        console.error('Error configuring project domains:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/projects/:projectId/pmo-audit-trail
 * 
 * Returns the PMO audit trail for a project.
 * Primary resource for certification compliance verification.
 * 
 * @param {string} projectId - The project ID
 * @query {string} domainId - Filter by domain (optional)
 * @query {string} objectType - Filter by object type (optional)
 * @query {number} limit - Max entries to return (optional)
 * @returns {Array} Audit trail entries with standards mapping
 */
router.get('/projects/:projectId/audit-trail', auth, async (req, res) => {
    try {
        const { projectId } = req.params;
        const { domainId, objectType, limit } = req.query;

        const auditTrail = await PMODomainRegistry.getProjectAuditTrail(projectId, {
            domainId,
            objectType,
            limit: limit ? parseInt(limit, 10) : undefined
        });

        res.json({
            success: true,
            data: auditTrail,
            meta: {
                projectId,
                totalEntries: auditTrail.length,
                filters: { domainId, objectType, limit }
            }
        });
    } catch (error) {
        console.error('Error fetching audit trail:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/pmo-domains/concept/:concept
 * 
 * Get audit documentation for a specific SCMS concept.
 * Useful for generating certification reports.
 * 
 * @param {string} concept - The SCMS concept name
 * @returns {Object} Audit documentation with standards equivalence
 */
router.get('/concept/:concept', auth, async (req, res) => {
    try {
        const { concept } = req.params;
        const auditDoc = PMOStandardsMapping.getAuditDocumentation(concept);

        if (!auditDoc) {
            return res.status(404).json({
                success: false,
                error: `Concept '${concept}' not found in standards mapping`
            });
        }

        res.json({
            success: true,
            data: auditDoc
        });
    } catch (error) {
        console.error('Error fetching concept documentation:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/pmo-domains/seed
 * 
 * Seed/refresh the PMO domains reference table.
 * Admin only - typically run during deployment.
 * 
 * @returns {Object} Seeding result
 */
router.post('/seed', auth, async (req, res) => {
    try {
        // Check admin permission
        if (req.user?.role !== 'SUPERADMIN' && req.user?.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                error: 'Admin permission required to seed PMO domains'
            });
        }

        const result = await PMODomainRegistry.seedDomains();

        res.json({
            success: true,
            data: result,
            message: 'PMO domains seeded successfully'
        });
    } catch (error) {
        console.error('Error seeding PMO domains:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
