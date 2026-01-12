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

import { PMO_DOMAIN_IDS } from './pmoDomainRegistry.js';

class PMOStandardsMapping {
    constructor() {
        this.STANDARDS_MAPPING = STANDARDS_MAPPING;
    }

    /**
     * Get the complete standards mapping table
     */
    getAllMappings() {
        return this.STANDARDS_MAPPING;
    }

    /**
     * Get mapping for a specific SCMS concept
     */
    getMapping(concept) {
        return this.STANDARDS_MAPPING[concept] || null;
    }

    /**
     * Get terminology for a specific standard
     */
    getStandardTerm(concept, standard) {
        const mapping = this.STANDARDS_MAPPING[concept];
        if (!mapping) return null;
        return mapping[standard] || null;
    }

    /**
     * Get all concepts in a domain
     */
    getConceptsByDomain(domainId) {
        return Object.entries(this.STANDARDS_MAPPING)
            .filter(([_, mapping]) => mapping.domainId === domainId)
            .map(([concept, mapping]) => ({ concept, ...mapping }));
    }

    /**
     * Generate a certification mapping table
     */
    generateMappingTable() {
        return Object.entries(this.STANDARDS_MAPPING).map(([concept, mapping]) => ({
            scmsConcept: concept,
            scmsTerm: mapping.scmsTerm,
            iso21500: mapping.iso21500.term,
            pmbok7: mapping.pmbok7.term,
            prince2: mapping.prince2.term,
            domain: mapping.domainId,
            description: mapping.neutralDescription
        }));
    }

    /**
     * Get neutral (methodology-agnostic) description for a concept
     */
    getNeutralDescription(concept) {
        const mapping = this.STANDARDS_MAPPING[concept];
        return mapping ? mapping.neutralDescription : 'No description available';
    }

    /**
     * Validate that a term is methodology-neutral
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
    }

    /**
     * Get documentation hook for certification audit
     */
    getAuditDocumentation(concept) {
        const mapping = this.STANDARDS_MAPPING[concept];
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
}

/**
 * SCMS to Standards Mapping Table
 */
const STANDARDS_MAPPING = {
    // -------------------------------------------------------------
    // Domain 1: Governance & Decision Making
    // -------------------------------------------------------------
    'Decision': {
        scmsTerm: 'Decision',
        scmsObject: 'Decision',
        domainId: PMO_DOMAIN_IDS.GOVERNANCE_DECISION_MAKING,
        neutralDescription: 'A formal conclusion requiring authorized approval to resolve a choice or problem.',
        iso21500: { term: 'Decision', clause: '3.6.4 Manage issues' },
        pmbok7: { term: 'Decision', domain: 'Performance Domain' },
        prince2: { term: 'Decision', theme: 'Directing a Project' }
    },
    'Escalation': {
        scmsTerm: 'Escalation',
        scmsObject: 'Escalation',
        domainId: PMO_DOMAIN_IDS.GOVERNANCE_DECISION_MAKING,
        neutralDescription: 'Elevation of an issue to a higher authority for resolution when outside existing tolerance.',
        iso21500: { term: 'Escalation', clause: '3.6.4' },
        pmbok7: { term: 'Threshold Excursion', domain: 'Delivery' },
        prince2: { term: 'Exception Report', theme: 'Progress' }
    },
    'StageGate': {
        scmsTerm: 'Project Phase',
        scmsObject: 'ProjectPhase',
        domainId: PMO_DOMAIN_IDS.GOVERNANCE_DECISION_MAKING,
        neutralDescription: 'A logical division of the project lifecycle marked by a review point.',
        iso21500: { term: 'Project Phase', clause: '3.3.3' },
        pmbok7: { term: 'Phase Gate', domain: 'Lifecycle' },
        prince2: { term: 'Stage Boundary', theme: 'Progress' }
    },

    // -------------------------------------------------------------
    // Domain 2: Scope & Change Control
    // -------------------------------------------------------------
    'ChangeRequest': {
        scmsTerm: 'Change Request',
        scmsObject: 'ChangeRequest',
        domainId: PMO_DOMAIN_IDS.SCOPE_CHANGE_CONTROL,
        neutralDescription: 'A formal proposal to modify any document, deliverable, or baseline.',
        iso21500: { term: 'Change Request', clause: '3.3.6 Control changes' },
        pmbok7: { term: 'Change Request', domain: 'Uncertainty' },
        prince2: { term: 'Issue (Request for Change)', theme: 'Change' }
    },
    'ProjectScope': {
        scmsTerm: 'Project Scope',
        scmsObject: 'ProjectScope',
        domainId: PMO_DOMAIN_IDS.SCOPE_CHANGE_CONTROL,
        neutralDescription: 'The work that needs to be accomplished to deliver a product, service, or result.',
        iso21500: { term: 'Scope', clause: '3.5.2 Define scope' },
        pmbok7: { term: 'Scope', domain: 'Delivery' },
        prince2: { term: 'Project Product Description', theme: 'Plans' }
    },

    // -------------------------------------------------------------
    // Domain 3: Resource & Capacity Management
    // -------------------------------------------------------------
    'ResourcePlan': {
        scmsTerm: 'Resource Plan',
        scmsObject: 'ResourcePlan',
        domainId: PMO_DOMAIN_IDS.RESOURCE_CAPACITY,
        neutralDescription: 'Identification and scheduling of resources required to execute work.',
        iso21500: { term: 'Resource Plan', clause: '3.7.3 Estimate resources' },
        pmbok7: { term: 'Resource Management Plan', domain: 'Team' },
        prince2: { term: 'Resource Schedule', theme: 'Plans' }
    },

    // -------------------------------------------------------------
    // Domain 4: Schedule & Roadmap
    // -------------------------------------------------------------
    'Milestone': {
        scmsTerm: 'Milestone',
        scmsObject: 'Milestone',
        domainId: PMO_DOMAIN_IDS.SCHEDULE_ROADMAP,
        neutralDescription: 'A significant point or event in a project, program, or portfolio.',
        iso21500: { term: 'Milestone', clause: '3.4.4 Develop schedule' },
        pmbok7: { term: 'Milestone', domain: 'Planning' },
        prince2: { term: 'Management Stage', theme: 'Plans' }
    },
    'Initiative': {
        scmsTerm: 'Initiative',
        scmsObject: 'Initiative',
        domainId: PMO_DOMAIN_IDS.SCHEDULE_ROADMAP,
        neutralDescription: 'A defined body of work to achieve specific objectives.',
        iso21500: { term: 'Work Package', clause: '3.5.4 Define activities' },
        pmbok7: { term: 'Product Backlog Item', domain: 'Delivery' },
        prince2: { term: 'Work Package', theme: 'Plans' }
    },

    // -------------------------------------------------------------
    // Domain 5: Economics & Value Realization
    // -------------------------------------------------------------
    'BusinessCase': {
        scmsTerm: 'Business Case',
        scmsObject: 'Economics',
        domainId: PMO_DOMAIN_IDS.ECONOMICS_VALUE,
        neutralDescription: 'Justification for a project based on estimated costs and benefits.',
        iso21500: { term: 'Business Case', clause: '3.2.2 Develop project charter' },
        pmbok7: { term: 'Business Case', domain: 'Business Context' },
        prince2: { term: 'Business Case', theme: 'Business Case' }
    },
    'BenefitsRealization': {
        scmsTerm: 'Benefits Realization',
        scmsObject: 'BenefitsRegister',
        domainId: PMO_DOMAIN_IDS.ECONOMICS_VALUE,
        neutralDescription: 'Tracking of the realized value against the initial justification.',
        iso21500: { term: 'Benefits Management', clause: '4.2.3' },
        pmbok7: { term: 'Benefits Realization Plan', domain: 'Value' },
        prince2: { term: 'Benefits Review Plan', theme: 'Business Case' }
    }
};

const pmoStandardsMappingInstance = new PMOStandardsMapping();
export default pmoStandardsMappingInstance;
