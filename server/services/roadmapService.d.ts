export default RoadmapService;
declare namespace RoadmapService {
    function setDependencies(newDeps?: {}): void;
    function getWaves(projectId: any): Promise<any>;
    function createWave(projectId: any, waveData: any): Promise<any>;
    function assignToWave(initiativeId: any, waveId: any): Promise<any>;
    function baselineRoadmap(projectId: any): Promise<any>;
    function getRoadmapSummary(projectId: any): Promise<any>;
    function updateInitiativeSchedule(initiativeId: any, updates: any, userId: any, projectId: any): Promise<{
        changeRequestCreated: boolean;
        crId: string;
        message: string;
        proposedChanges: any;
        success?: undefined;
        initiativeId?: undefined;
        updates?: undefined;
    } | {
        success: boolean;
        message: string;
        changeRequestCreated?: undefined;
        crId?: undefined;
        proposedChanges?: undefined;
        initiativeId?: undefined;
        updates?: undefined;
    } | {
        success: boolean;
        initiativeId: any;
        updates: any;
        changeRequestCreated?: undefined;
        crId?: undefined;
        message?: undefined;
        proposedChanges?: undefined;
    }>;
}
//# sourceMappingURL=roadmapService.d.ts.map