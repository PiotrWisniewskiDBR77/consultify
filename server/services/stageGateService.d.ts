export default stageGateServiceInstance;
declare const stageGateServiceInstance: StageGateService;
declare class StageGateService {
    _db: any;
    GATE_TYPES: {
        READINESS_GATE: string;
        DESIGN_GATE: string;
        PLANNING_GATE: string;
        EXECUTION_GATE: string;
        CLOSURE_GATE: string;
    };
    PHASE_ORDER: string[];
    get db(): any;
    /**
     * Initialize service dependencies
     */
    init(): Promise<this>;
    /**
     * Set dependencies for testing
     */
    setDependencies(mockDeps: any): void;
    /**
     * Get the gate type for a phase transition
     */
    getGateType(fromPhase: any, toPhase: any): any;
    /**
     * Evaluate gate readiness for a project
     */
    evaluateGate(projectId: any, gateType: any): Promise<{
        gateType: any;
        projectId: any;
        status: string;
        completionCriteria: {
            criterion: string;
            isMet: any;
            evidence: string;
        }[];
        missingElements: string[];
    }>;
    /**
     * Evaluate a specific criterion
     */
    _evaluateCriterion(projectId: any, field: any): Promise<any>;
    _checkContextField(projectId: any, field: any, validator: any): Promise<any>;
    _checkContextReadiness(projectId: any): Promise<any>;
    _checkAssessmentComplete(projectId: any): Promise<any>;
    _countInitiatives(projectId: any): Promise<any>;
    _checkAllInitiativesHaveOwners(projectId: any): Promise<any>;
    _checkRoadmapBaselined(projectId: any): Promise<any>;
    _checkAllInWaves(projectId: any): Promise<any>;
    _checkAllInitiativesClosed(projectId: any): Promise<any>;
    _checkNoBlockingDecisions(projectId: any): Promise<any>;
    _countKPIs(projectId: any): Promise<any>;
    /**
     * Record gate passage
     */
    passGate(projectId: any, gateType: any, userId: any, notes: any): Promise<any>;
}
//# sourceMappingURL=stageGateService.d.ts.map