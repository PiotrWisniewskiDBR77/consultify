export default CapacityService;
declare namespace CapacityService {
    function setDependencies(newDeps?: {}): void;
    function getUserCapacity(userId: any, weekStart: any): Promise<any>;
    function calculateUserCapacity(userId: any, projectId?: null): Promise<any>;
    function detectOverloads(projectId: any): Promise<{
        projectId: any;
        totalUsersAnalyzed: any;
        overloadedUsers: {
            userId: any;
            userName: string;
            overloadedWeeks: any;
            sustainedOverload: boolean;
        }[];
        hasOverloads: boolean;
        sustainedOverloads: number;
    }>;
    function suggestResolutions(overloads: any): any[];
}
//# sourceMappingURL=capacityService.d.ts.map