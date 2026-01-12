export namespace AIContextBuilder {
    function setDependencies(newDeps?: {}): void;
    function buildContext(userId: string, organizationId: string, projectId?: string | null, options?: {
        focusMode: string;
        currentScreen: string;
        selectedObjectId: string;
        selectedObjectType: string;
    }): Promise<{
        focusMode: string;
        builtAt: string;
        contextHash: string;
        currentScreen: string | null;
        selectedObjectId: string | null;
        selectedObjectType: string | null;
        constructor: Function;
        toString(): string;
        toLocaleString(): string;
        valueOf(): Object;
        hasOwnProperty(v: PropertyKey): boolean;
        isPrototypeOf(v: Object): boolean;
        propertyIsEnumerable(v: PropertyKey): boolean;
    }>;
    function _applyFocusModeFilter(fullContext: Object, focusMode: string): Object;
    function _buildPlatformContext(userId: any, organizationId: any): Promise<{
        role: string;
        tenantId: any;
        userId: any;
        policyLevel: any;
        globalPolicies: {
            internetEnabled: boolean;
            maxPolicyLevel: any;
            auditRequired: boolean;
        };
    }>;
    function _buildOrganizationContext(organizationId: any): Promise<{
        organizationId: any;
        organizationName: any;
        locations: never[];
        activeProjectIds: any;
        activeProjectCount: any;
        pmoMaturityLevel: any;
    }>;
    function _buildProjectContext(projectId: any): Promise<{
        projectId: any;
        projectName: any;
        currentPhase: any;
        phaseNumber: number;
        governanceRules: {
            requireApprovalForPhaseTransition: any;
            stageGatesEnabled: any;
            aiPolicyOverride: null;
        };
        sponsorId: any;
        projectManagerId: any;
        roadmapStatus: any;
        initiativeCount: any;
        completedInitiatives: any;
    } | null>;
    function _buildExecutionContext(userId: any, projectId: any): Promise<{
        userId: any;
        userTasks: any;
        userInitiatives: any;
        pendingDecisions: any;
        blockers: any;
        capacityStatus: string;
    }>;
    function _buildKnowledgeContext(projectId: string | null, focusMode?: string): Promise<{
        ragDisabled: boolean;
        projectDocuments: never[];
        previousDecisions: never[];
        changeRequests: never[];
        lessonsLearned: never[];
        phaseHistory: never[];
        message: string;
        strategicDirections?: undefined;
        approvedIdeas?: undefined;
    } | {
        ragDisabled: boolean;
        projectDocuments: any;
        previousDecisions: any;
        changeRequests: never[];
        lessonsLearned: never[];
        phaseHistory: any;
        strategicDirections: any;
        approvedIdeas: any;
        message?: undefined;
    }>;
    function _buildExternalContext(organizationId: string, focusMode?: string): Promise<{
        internetEnabled: boolean;
        externalSourcesUsed: never[];
    }>;
    function _buildPendingApprovalsContext(userId: any, organizationId: any, projectId: any): Promise<{
        count: number;
        actions: never[];
        summary: null;
        oldestCreatedAt?: undefined;
        hasLearnedPatterns?: undefined;
    } | {
        count: any;
        actions: any[];
        summary: string;
        oldestCreatedAt: any;
        hasLearnedPatterns: boolean;
    }>;
    function _generateHash(platform: any, organization: any, project: any): string;
}
export default AIContextBuilder;
//# sourceMappingURL=aiContextBuilder.d.ts.map