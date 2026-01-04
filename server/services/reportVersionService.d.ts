export default ReportVersionService;
declare namespace ReportVersionService {
    function createVersion(reportId: string, content: Object, userId: string, changeSummary?: string, options?: Object): Promise<Object>;
    function getVersions(reportId: string, options?: Object): Promise<Object>;
    function getVersion(reportId: string, versionNumber: number): Promise<Object>;
    function getCurrentVersion(reportId: string): Promise<Object>;
    function compareVersions(reportId: string, v1: number, v2: number): Promise<Object>;
    function restoreVersion(reportId: string, versionNumber: number, userId: string): Promise<Object>;
    function incrementVersion(reportId: string, type?: string): Promise<string>;
    function _calculateVersionLabel(versionNumber: any, type: any): string;
    function _compareContents(content1: any, content2: any, path?: string): any;
    function _generateChangeSummary(changes: any): string;
    function snapshotCurrentState(reportId: string, userId: string, changeSummary?: string): Promise<Object>;
}
//# sourceMappingURL=reportVersionService.d.ts.map