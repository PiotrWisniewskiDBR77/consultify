export default AssessmentService;
declare namespace AssessmentService {
    function setDependencies(newDeps: any): void;
    let getAssessment: (projectId: any) => Promise<any>;
    let saveAssessment: (projectId: any, assessmentData: any) => Promise<any>;
    let generateGapSummary: (assessment: any) => {
        prioritizedGaps: any;
        gapAnalysisSummary: string;
    };
    let getAssessmentStatus: (projectId: any) => Promise<any>;
    let canEditAssessment: (projectId: any, userId: any) => Promise<boolean>;
    let finalizeAssessment: (projectId: any, userId: any) => Promise<any>;
}
//# sourceMappingURL=assessmentService.d.ts.map