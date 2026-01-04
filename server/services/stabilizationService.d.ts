export default StabilizationService;
declare namespace StabilizationService {
    export { STABILIZATION_STATUSES };
    export function checkEntryCriteria(projectId: any): Promise<{
        projectId: any;
        canEnterStabilization: boolean;
        completionCriteria: {
            criterion: string;
            isMet: boolean;
            evidence: string;
        }[];
    }>;
    export function setStabilizationStatus(initiativeId: any, status: any, userId: any): Promise<any>;
    export function getStabilizationSummary(projectId: any): Promise<any>;
    export function checkExitCriteria(projectId: any): Promise<{
        projectId: any;
        canCloseProject: boolean;
        completionCriteria: {
            criterion: string;
            isMet: boolean;
            evidence: string;
        }[];
    }>;
    export function closeProject(projectId: any, closureType: any, userId: any, lessonsLearned?: null): Promise<any>;
}
declare namespace STABILIZATION_STATUSES {
    let STABILIZED: string;
    let PARTIALLY_STABILIZED: string;
    let UNSTABLE: string;
    let NOT_APPLICABLE: string;
}
//# sourceMappingURL=stabilizationService.d.ts.map