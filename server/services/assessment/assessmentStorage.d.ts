export function createAssessmentStorage({ deps, initDeps }: {
    deps: any;
    initDeps: any;
}): {
    getAssessment: (projectId: any) => Promise<any>;
    saveAssessment: (projectId: any, assessmentData: any) => Promise<any>;
    getAssessmentStatus: (projectId: any) => Promise<any>;
};
//# sourceMappingURL=assessmentStorage.d.ts.map