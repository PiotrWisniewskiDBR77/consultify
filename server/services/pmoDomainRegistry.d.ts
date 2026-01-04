export namespace PMO_DOMAIN_IDS {
    let GOVERNANCE_DECISION_MAKING: string;
    let SCOPE_CHANGE_CONTROL: string;
    let SCHEDULE_MILESTONES: string;
    let RISK_ISSUE_MANAGEMENT: string;
    let RESOURCE_RESPONSIBILITY: string;
    let PERFORMANCE_MONITORING: string;
    let BENEFITS_REALIZATION: string;
}
/**
 * PMO Domains Registry - First-Class Certifiable Concepts
 */
export const PMO_DOMAINS: {
    id: string;
    name: string;
    description: string;
    iso21500Term: string;
    pmbokTerm: string;
    prince2Term: string;
    isConfigurable: boolean;
    sortOrder: number;
    scmsObjects: string[];
    certificationNotes: string;
}[];
export default pmoDomainRegistryInstance;
declare const pmoDomainRegistryInstance: PMODomainRegistry;
declare class PMODomainRegistry {
    _db: any;
    PMO_DOMAIN_IDS: {
        GOVERNANCE_DECISION_MAKING: string;
        SCOPE_CHANGE_CONTROL: string;
        SCHEDULE_MILESTONES: string;
        RISK_ISSUE_MANAGEMENT: string;
        RESOURCE_RESPONSIBILITY: string;
        PERFORMANCE_MONITORING: string;
        BENEFITS_REALIZATION: string;
    };
    PMO_DOMAINS: {
        id: string;
        name: string;
        description: string;
        iso21500Term: string;
        pmbokTerm: string;
        prince2Term: string;
        isConfigurable: boolean;
        sortOrder: number;
        scmsObjects: string[];
        certificationNotes: string;
    }[];
    get db(): any;
    /**
     * Initialize service dependencies
     */
    init(): Promise<this>;
    /**
     * Set dependencies manually (for testing)
     */
    setDependencies(customDeps: any): void;
    /**
     * Initialize the domain registry in the database
     */
    seedDomains(): Promise<any>;
    /**
     * Get all PMO domains with standards mapping
     */
    getAllDomains(): Promise<any>;
    /**
     * Get a specific domain by ID
     */
    getDomain(domainId: any): Promise<any>;
    /**
     * Get enabled domains for a project
     */
    getProjectDomains(projectId: any): Promise<any>;
    /**
     * Configure which domains are enabled for a project
     */
    configureProjectDomains(projectId: any, enabledDomainIds: any, userId: any): Promise<any>;
    /**
     * Get SCMS objects that belong to a specific domain
     */
    getDomainObjects(domainId: any): string[];
    /**
     * Determine which domain an SCMS object belongs to
     */
    getDomainForObject(objectType: any): {
        id: string;
        name: string;
        description: string;
        iso21500Term: string;
        pmbokTerm: string;
        prince2Term: string;
        isConfigurable: boolean;
        sortOrder: number;
        scmsObjects: string[];
        certificationNotes: string;
    } | undefined;
    /**
     * Get certification notes for a domain
     */
    getCertificationNotes(domainId: any): string;
    /**
     * Record an action in the PMO audit trail
     */
    recordAuditEntry(auditData: any): Promise<any>;
    /**
     * Get audit trail for a project
     */
    getProjectAuditTrail(projectId: any, options?: {}): Promise<any>;
}
//# sourceMappingURL=pmoDomainRegistry.d.ts.map