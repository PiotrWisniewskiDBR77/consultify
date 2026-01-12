export default pmoStandardsMappingInstance;
declare const pmoStandardsMappingInstance: PMOStandardsMapping;
declare class PMOStandardsMapping {
    STANDARDS_MAPPING: {};
    /**
     * Get the complete standards mapping table
     */
    getAllMappings(): {};
    /**
     * Get mapping for a specific SCMS concept
     */
    getMapping(concept: any): any;
    /**
     * Get terminology for a specific standard
     */
    getStandardTerm(concept: any, standard: any): any;
    /**
     * Get all concepts in a domain
     */
    getConceptsByDomain(domainId: any): any[];
    /**
     * Generate a certification mapping table
     */
    generateMappingTable(): {
        scmsConcept: string;
        scmsTerm: any;
        iso21500: any;
        pmbok7: any;
        prince2: any;
        domain: any;
        description: any;
    }[];
    /**
     * Get neutral (methodology-agnostic) description for a concept
     */
    getNeutralDescription(concept: any): any;
    /**
     * Validate that a term is methodology-neutral
     */
    isNeutralTerm(term: any): boolean;
    /**
     * Get documentation hook for certification audit
     */
    getAuditDocumentation(concept: any): {
        scmsObject: any;
        neutralTerm: any;
        standardsEquivalence: {
            iso21500: string;
            pmbok7: string;
            prince2: string;
        };
        description: any;
        domain: any;
    } | null;
}
//# sourceMappingURL=pmoStandardsMapping.d.ts.map