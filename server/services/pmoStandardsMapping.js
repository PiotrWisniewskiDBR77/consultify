/**
 * PMO Standards Mapping Service
 * 
 * SCMS Meta-PMO Framework: Explicit Terminology Mapping
 * 
 * This service provides explicit mappings between SCMS concepts
 * and professional PMO standards for certification and audit purposes.
 * 
 * Standards:
 * - ISO 21500:2021 - Guidance on Project Management
 * - PMI PMBOK 7th Edition - Project Management Body of Knowledge
 * - PRINCE2 - Projects IN Controlled Environments
 * 
 * IMPORTANT: This mapping is the SINGLE SOURCE OF TRUTH for terminology.
 * All documentation, UI labels, and audit trails should reference this mapping.
 * 
 * @module pmoStandardsMapping
 */

const { PMO_DOMAIN_IDS } = require('./pmoDomainRegistry');

/**
 * SCMS to Standards Mapping Table
 * 
 * Each entry maps an SCMS concept to its equivalent terminology
 * in professional PMO standards.
 */
const STANDARDS_MAPPING = {
    // ============================================
    // GOVERNANCE & DECISION MAKING DOMAIN
    // ============================================

    /**
     * Phase → Project Lifecycle Phase
     * @mapping ISO 21500: 4.2 Project life cycle
     * @mapping PMBOK 7: Development Approach and Life Cycle Performance Domain
     * @mapping PRINCE2: Stage (Management Stage)
     */
    Phase: {
        scmsObject: 'SCMSPhase',
        scmsTerm: 'Phase',
        iso21500: {
            term: 'Project Phase',
            clause: 'Clause 4.2 - Project life cycle',
            description: 'A collection of logically related project activities that culminates in the completion of one or more deliverables'
        },
        pmbok7: {
            term: 'Project Life Cycle Phase',
            domain: 'Development Approach and Life Cycle',
            description: 'A distinct portion of the project performed to produce deliverables'
        },
        prince2: {
            term: 'Stage (Management Stage)',
            theme: 'Plans',
            description: 'A section of the project with defined Products and tolerances'
        },
        domainId: PMO_DOMAIN_IDS.SCHEDULE_MILESTONES,
        neutralDescription: 'A logical grouping of project activities with defined entry and exit criteria'
    },

    /**
     * Stage Gate → Management Gate
     * @mapping ISO 21500: Phase gate / Decision point
     * @mapping PMBOK 7: Management Gate / Phase Gate
     * @mapping PRINCE2: Stage Gate / End Stage Assessment
     */
    StageGate: {
        scmsObject: 'StageGate',
        scmsTerm: 'Stage Gate',
        iso21500: {
            term: 'Phase Gate',
            clause: 'Clause 4.3 - Project governance',
            description: 'A control point at the end of a phase where a decision is made to continue, modify, or terminate the project'
        },
        pmbok7: {
            term: 'Management Gate / Phase Gate',
            domain: 'Planning Performance Domain',
            description: 'A review at end of phase to decide whether to proceed to the next phase'
        },
        prince2: {
            term: 'Stage Gate / End Stage Assessment',
            theme: 'Progress',
            description: 'Authorization point at the boundary between stages'
        },
        domainId: PMO_DOMAIN_IDS.GOVERNANCE_DECISION_MAKING,
        neutralDescription: 'A formal checkpoint requiring authorization before proceeding to the next phase'
    },

    /**
     * Decision → Governance Decision
     * @mapping ISO 21500: Decision point
     * @mapping PMBOK 7: Decision / Authorization
     * @mapping PRINCE2: Project Board Decision / Exception
     */
    Decision: {
        scmsObject: 'Decision',
        scmsTerm: 'Decision',
        iso21500: {
            term: 'Governance Decision',
            clause: 'Clause 4.3.4 - Responsibilities of the project governance body',
            description: 'Formal authorization made by the governance body'
        },
        pmbok7: {
            term: 'Project Decision / Authorization',
            domain: 'Stakeholder Performance Domain',
            description: 'Key decision requiring stakeholder engagement and approval'
        },
        prince2: {
            term: 'Project Board Decision',
            theme: 'Organization',
            description: 'Formal decision by the Project Board, may include Exception handling'
        },
        domainId: PMO_DOMAIN_IDS.GOVERNANCE_DECISION_MAKING,
        neutralDescription: 'A formal governance authorization or determination requiring documented accountability'
    },

    // ============================================
    // SCOPE & CHANGE CONTROL DOMAIN
    // ============================================

    /**
     * Initiative → Work Package / Deliverable Group
     * @mapping ISO 21500: Work package
     * @mapping PMBOK 7: Deliverable / Work Package
     * @mapping PRINCE2: Work Package / Product
     */
    Initiative: {
        scmsObject: 'Initiative',
        scmsTerm: 'Initiative',
        iso21500: {
            term: 'Work Package',
            clause: 'Clause 4.4.4 - Define scope',
            description: 'Lowest level of work breakdown with defined deliverables'
        },
        pmbok7: {
            term: 'Deliverable Group / Work Package',
            domain: 'Delivery Performance Domain',
            description: 'A related set of deliverables managed as a unit'
        },
        prince2: {
            term: 'Work Package',
            theme: 'Plans',
            description: 'A set of products and work assigned to a Team Manager'
        },
        domainId: PMO_DOMAIN_IDS.SCOPE_CHANGE_CONTROL,
        neutralDescription: 'A managed unit of scope containing related deliverables and activities'
    },

    /**
     * Task → Activity
     * @mapping ISO 21500: Activity
     * @mapping PMBOK 7: Activity
     * @mapping PRINCE2: Activity / Product (part of)
     */
    Task: {
        scmsObject: 'Task',
        scmsTerm: 'Task',
        iso21500: {
            term: 'Activity',
            clause: 'Clause 4.4.5 - Create work breakdown structure',
            description: 'Identified unit of work within a work package'
        },
        pmbok7: {
            term: 'Activity',
            domain: 'Project Work Performance Domain',
            description: 'Distinct scheduled portion of work performed during the course of a project'
        },
        prince2: {
            term: 'Activity',
            theme: 'Plans',
            description: 'Work performed to produce a Product or part of a Product'
        },
        domainId: PMO_DOMAIN_IDS.SCOPE_CHANGE_CONTROL,
        neutralDescription: 'A granular unit of work with defined completion criteria'
    },

    /**
     * Baseline → Approved Baseline
     * @mapping ISO 21500: Baseline
     * @mapping PMBOK 7: Performance Measurement Baseline
     * @mapping PRINCE2: Stage Plan (baselined)
     */
    Baseline: {
        scmsObject: 'ScheduleBaseline',
        scmsTerm: 'Baseline',
        iso21500: {
            term: 'Baseline',
            clause: 'Clause 4.4.10 - Develop schedule',
            description: 'Approved version of scope, schedule, or cost against which performance is measured'
        },
        pmbok7: {
            term: 'Performance Measurement Baseline',
            domain: 'Measurement Performance Domain',
            description: 'Approved scope, schedule, and cost baselines used as basis for comparison'
        },
        prince2: {
            term: 'Stage Plan (baselined)',
            theme: 'Plans',
            description: 'Approved version of Stage Plan used for progress comparison'
        },
        domainId: PMO_DOMAIN_IDS.SCOPE_CHANGE_CONTROL,
        neutralDescription: 'An approved reference point for scope, schedule, or cost against which variance is measured'
    },

    /**
     * Change Request → Integrated Change Control
     * @mapping ISO 21500: Change request
     * @mapping PMBOK 7: Change Request (Integrated Change Control)
     * @mapping PRINCE2: Request for Change (RFC) / Off-Specification
     */
    ChangeRequest: {
        scmsObject: 'ChangeRequest',
        scmsTerm: 'Change Request',
        iso21500: {
            term: 'Change Request',
            clause: 'Clause 4.4.23 - Control changes',
            description: 'Formal proposal for modification to baseline or documents'
        },
        pmbok7: {
            term: 'Change Request',
            domain: 'Project Work Performance Domain',
            description: 'Formal proposal to modify documents, deliverables, or baselines'
        },
        prince2: {
            term: 'Request for Change (RFC)',
            theme: 'Change',
            description: 'Proposal for change to baseline, may also be Off-Specification'
        },
        domainId: PMO_DOMAIN_IDS.SCOPE_CHANGE_CONTROL,
        neutralDescription: 'A formal proposal to modify approved scope, schedule, cost, or other controlled items'
    },

    // ============================================
    // SCHEDULE & MILESTONES DOMAIN
    // ============================================

    /**
     * Roadmap → Schedule
     * @mapping ISO 21500: Project schedule
     * @mapping PMBOK 7: Project Schedule
     * @mapping PRINCE2: Project Plan / Stage Plan
     */
    Roadmap: {
        scmsObject: 'Roadmap',
        scmsTerm: 'Roadmap',
        iso21500: {
            term: 'Project Schedule',
            clause: 'Clause 4.4.10 - Develop schedule',
            description: 'Output of scheduling presenting linked activities with dates and durations'
        },
        pmbok7: {
            term: 'Project Schedule',
            domain: 'Planning Performance Domain',
            description: 'Output of schedule model presenting activities with dates, durations, and milestones'
        },
        prince2: {
            term: 'Project Plan / Stage Plan',
            theme: 'Plans',
            description: 'High-level plan showing the major products, activities, and resources'
        },
        domainId: PMO_DOMAIN_IDS.SCHEDULE_MILESTONES,
        neutralDescription: 'A time-bound sequence of activities and milestones for project delivery'
    },

    // ============================================
    // PERFORMANCE MONITORING DOMAIN
    // ============================================

    /**
     * Governance Settings → Project Governance Framework
     * @mapping ISO 21500: Project governance framework
     * @mapping PMBOK 7: Governance Framework
     * @mapping PRINCE2: Project Board Terms of Reference
     */
    GovernanceSettings: {
        scmsObject: 'GovernancePolicy',
        scmsTerm: 'Governance Settings',
        iso21500: {
            term: 'Project Governance Framework',
            clause: 'Clause 4.3 - Project governance',
            description: 'Framework by which a project is directed, controlled, and led'
        },
        pmbok7: {
            term: 'Governance Framework',
            domain: 'Stakeholder Performance Domain',
            description: 'The framework of authority and accountability directing project decisions'
        },
        prince2: {
            term: 'Project Board Terms of Reference',
            theme: 'Organization',
            description: 'Document defining authority and responsibility of the Project Board'
        },
        domainId: PMO_DOMAIN_IDS.GOVERNANCE_DECISION_MAKING,
        neutralDescription: 'The rules, policies, and authorities governing project decision-making'
    },

    /**
     * PMO Health → Project Performance
     * @mapping ISO 21500: Project performance measurement
     * @mapping PMBOK 7: Measurement Performance Domain
     * @mapping PRINCE2: Highlight Report / Project Progress
     */
    PMOHealth: {
        scmsObject: 'PMOHealthSnapshot',
        scmsTerm: 'PMO Health',
        iso21500: {
            term: 'Project Performance Measurement',
            clause: 'Clause 4.4.22 - Control project work',
            description: 'Measurement of actual performance against planned performance'
        },
        pmbok7: {
            term: 'Project Performance Information',
            domain: 'Measurement Performance Domain',
            description: 'Information on project health, progress, and forecasts'
        },
        prince2: {
            term: 'Highlight Report',
            theme: 'Progress',
            description: 'Time-driven report from Project Manager to Project Board on stage progress'
        },
        domainId: PMO_DOMAIN_IDS.PERFORMANCE_MONITORING,
        neutralDescription: 'Current health metrics and progress status of the project'
    },

    // ============================================
    // RESOURCE & RESPONSIBILITY DOMAIN
    // ============================================

    /**
     * Escalation → Escalation Process
     * @mapping ISO 21500: Escalation
     * @mapping PMBOK 7: Escalation Path
     * @mapping PRINCE2: Exception Report / Escalation
     */
    Escalation: {
        scmsObject: 'Escalation',
        scmsTerm: 'Escalation',
        iso21500: {
            term: 'Escalation',
            clause: 'Clause 4.3.4 - Responsibilities',
            description: 'Process for raising issues to higher authority for resolution'
        },
        pmbok7: {
            term: 'Escalation Path',
            domain: 'Team Performance Domain',
            description: 'The process for raising issues beyond the project manager authority'
        },
        prince2: {
            term: 'Exception Report',
            theme: 'Progress',
            description: 'Report to Project Board when tolerances are forecast to be exceeded'
        },
        domainId: PMO_DOMAIN_IDS.GOVERNANCE_DECISION_MAKING,
        neutralDescription: 'A formal process for raising issues to higher authority when tolerance is exceeded'
    },

    // ============================================
    // BENEFITS REALIZATION DOMAIN
    // ============================================

    /**
     * Value Hypothesis → Benefits Identification
     * @mapping ISO 21500: Benefits identification
     * @mapping PMBOK 7: Benefits Documentation
     * @mapping PRINCE2: Business Case (Expected Benefits)
     */
    ValueHypothesis: {
        scmsObject: 'ValueHypothesis',
        scmsTerm: 'Value Hypothesis',
        iso21500: {
            term: 'Benefits Identification',
            clause: 'Clause 4.4.1 - Develop project charter',
            description: 'Description of the benefits the project will produce'
        },
        pmbok7: {
            term: 'Benefits Documentation',
            domain: 'Delivery Performance Domain',
            description: 'Documented description of expected project outcomes and benefits'
        },
        prince2: {
            term: 'Expected Benefits (Business Case)',
            theme: 'Business Case',
            description: 'Measurable improvements expected from the project investment'
        },
        domainId: PMO_DOMAIN_IDS.BENEFITS_REALIZATION,
        neutralDescription: 'A stated expected benefit or value outcome from project delivery'
    }
};

/**
 * PMO Standards Mapping Service
 */
const PMOStandardsMapping = {
    STANDARDS_MAPPING,

    /**
     * Get the complete standards mapping table
     * @returns {Object} All mappings
     */
    getAllMappings() {
        return STANDARDS_MAPPING;
    },

    /**
     * Get mapping for a specific SCMS concept
     * @param {string} concept - The SCMS concept name
     * @returns {Object|null} Mapping or null
     */
    getMapping(concept) {
        return STANDARDS_MAPPING[concept] || null;
    },

    /**
     * Get terminology for a specific standard
     * @param {string} concept - The SCMS concept
     * @param {string} standard - 'iso21500', 'pmbok7', or 'prince2'
     * @returns {Object|null} Standard-specific terminology
     */
    getStandardTerm(concept, standard) {
        const mapping = STANDARDS_MAPPING[concept];
        if (!mapping) return null;
        return mapping[standard] || null;
    },

    /**
     * Get all concepts in a domain
     * @param {string} domainId - The PMO domain ID
     * @returns {Array} Concepts in the domain
     */
    getConceptsByDomain(domainId) {
        return Object.entries(STANDARDS_MAPPING)
            .filter(([_, mapping]) => mapping.domainId === domainId)
            .map(([concept, mapping]) => ({ concept, ...mapping }));
    },

    /**
     * Generate a certification mapping table
     * Useful for audit documentation
     * @returns {Array} Array of mapping rows for documentation
     */
    generateMappingTable() {
        return Object.entries(STANDARDS_MAPPING).map(([concept, mapping]) => ({
            scmsConcept: concept,
            scmsTerm: mapping.scmsTerm,
            iso21500: mapping.iso21500.term,
            pmbok7: mapping.pmbok7.term,
            prince2: mapping.prince2.term,
            domain: mapping.domainId,
            description: mapping.neutralDescription
        }));
    },

    /**
     * Get neutral (methodology-agnostic) description for a concept
     * @param {string} concept - The SCMS concept
     * @returns {string} Neutral description
     */
    getNeutralDescription(concept) {
        const mapping = STANDARDS_MAPPING[concept];
        return mapping ? mapping.neutralDescription : 'No description available';
    },

    /**
     * Validate that a term is methodology-neutral
     * Checks against vendor-specific terminology
     * @param {string} term - The term to validate
     * @returns {boolean} True if neutral
     */
    isNeutralTerm(term) {
        const vendorTerms = [
            'sprint', 'epic', 'story', 'backlog', // Scrum
            'ceremony', 'standup', // Agile generic
            'tollgate', // Specific vendors
            'wave', // SAFe
            'kanban', // Kanban specific
        ];
        return !vendorTerms.some(vt => term.toLowerCase().includes(vt));
    },

    /**
     * Get documentation hook for certification audit
     * @param {string} concept - The SCMS concept
     * @returns {Object} Documentation data for audit
     */
    getAuditDocumentation(concept) {
        const mapping = STANDARDS_MAPPING[concept];
        if (!mapping) return null;

        return {
            scmsObject: mapping.scmsObject,
            neutralTerm: mapping.scmsTerm,
            standardsEquivalence: {
                iso21500: `${mapping.iso21500.term} (${mapping.iso21500.clause})`,
                pmbok7: `${mapping.pmbok7.term} (${mapping.pmbok7.domain})`,
                prince2: `${mapping.prince2.term} (${mapping.prince2.theme} Theme)`
            },
            description: mapping.neutralDescription,
            domain: mapping.domainId
        };
    }
};

module.exports = PMOStandardsMapping;
