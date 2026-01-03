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
    // ... same as before
};

const pmoStandardsMappingInstance = new PMOStandardsMapping();
export default pmoStandardsMappingInstance;
