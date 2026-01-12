export default BaselineService;
declare namespace BaselineService {
    function setDependencies(newDeps?: {}): void;
    function captureBaseline(roadmapId: any, projectId: any, userId: any, rationale: any): Promise<any>;
    function getBaseline(roadmapId: any, version: any): Promise<any>;
    function getBaselineHistory(roadmapId: any): Promise<any>;
    function calculateVariance(roadmapId: any, baselineVersion?: null): Promise<{
        roadmapId: any;
        baselineVersion: any;
        totalInitiatives: number;
        onTrackCount: number;
        delayedCount: number;
        criticalDelays: number;
        onTrackPercent: number;
        initiativeVariances: {
            initiativeId: any;
            initiativeName: any;
            plannedStart: any;
            plannedEnd: any;
            actualStart: any;
            actualEnd: any;
            startVarianceDays: number;
            endVarianceDays: number;
            status: string;
        }[];
        generatedAt: string;
    }>;
}
//# sourceMappingURL=baselineService.d.ts.map