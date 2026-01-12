export default CriticalPathService;
declare namespace CriticalPathService {
    function setDependencies(newDeps?: {}): void;
    function calculateCriticalPath(projectId: any): Promise<{
        criticalPath: never[];
        totalDuration: number;
        criticalInitiativeCount?: undefined;
        nonCriticalCount?: undefined;
    } | {
        criticalPath: {
            id: any;
            name: any;
            duration: any;
            earliestStart: any;
            earliestFinish: any;
        }[];
        totalDuration: number;
        criticalInitiativeCount: number;
        nonCriticalCount: number;
    }>;
    function detectSchedulingConflicts(projectId: any): Promise<{
        projectId: any;
        hasConflicts: boolean;
        conflictCount: number;
        conflicts: ({
            type: string;
            predecessorId: any;
            predecessorName: any;
            successorId: any;
            successorName: any;
            message: string;
            gapDays: number;
            cycles?: undefined;
        } | {
            type: string;
            message: string;
            cycles: any[];
            predecessorId?: undefined;
            predecessorName?: undefined;
            successorId?: undefined;
            successorName?: undefined;
            gapDays?: undefined;
        })[];
    }>;
    function analyzeScheduleRisks(projectId: any): Promise<{
        projectId: any;
        criticalPath: any[];
        totalDuration: number;
        risks: {
            level: string;
            type: string;
            message: string;
        }[];
        recommendations: string[];
        overallRisk: string;
    }>;
    function _setDb(mockDb: any): void;
}
//# sourceMappingURL=criticalPathService.d.ts.map