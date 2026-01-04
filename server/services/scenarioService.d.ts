export default ScenarioService;
declare namespace ScenarioService {
    function setDependencies(newDeps?: {}): void;
    function createScenario(projectId: any, name: any, proposedChanges: any, userId: any, persist?: boolean): Promise<any>;
    function analyzeImpact(projectId: any, proposedChanges: any): Promise<{
        affectedInitiatives: any[];
        dependencyBreaks: string[];
        capacityOverloads: any[];
        delayedByDays: number;
        isValid: boolean;
        warnings: string[];
    }>;
    function getScenarios(projectId: any): Promise<any>;
    function compareScenarios(scenario1: any, scenario2: any): {
        scenario1: {
            name: any;
            delayDays: any;
        };
        scenario2: {
            name: any;
            delayDays: any;
        };
        recommendation: string;
    };
}
//# sourceMappingURL=scenarioService.d.ts.map