export default VersioningService;
declare namespace VersioningService {
    function createVersion(analysisId: string, options: {
        versionName: string;
        versionType: string;
        notes: string;
    } | undefined, userId: string): Promise<Object>;
    function getNextVersionNumber(analysisId: any): Promise<any>;
    function getAnalysisSnapshot(analysisId: any): Promise<any>;
    function getVersion(versionId: any): Promise<any>;
    function getVersions(analysisId: any, options?: {}): Promise<any>;
    function getLatestVersion(analysisId: any): Promise<any>;
    function compareVersions(versionId1: any, versionId2: any): Object;
    function restoreVersion(versionId: any, userId: any, EconomicsService: any): Promise<Object>;
    function updateVersion(versionId: any, updates: any): Promise<any>;
    function deleteVersion(versionId: any): Promise<boolean>;
    function markAsBaseline(versionId: any): Promise<any>;
}
//# sourceMappingURL=versioningService.d.ts.map