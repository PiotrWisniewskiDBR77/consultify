export function createAssessmentWorkflow({ deps, initDeps, getAssessment, getAssessmentStatus }: {
    deps: any;
    initDeps: any;
    getAssessment: any;
    getAssessmentStatus: any;
}): {
    canEditAssessment: (projectId: any, userId: any) => Promise<boolean>;
    finalizeAssessment: (projectId: any, userId: any) => Promise<any>;
};
//# sourceMappingURL=assessmentWorkflow.d.ts.map