export function createAIQueueService({ deps }: {
    deps: any;
}): {
    queueTask: (taskType: any, payload: any, userId: any) => Promise<{
        jobId: any;
        status: string;
    }>;
    getJobStatus: (jobId: any) => Promise<{
        id: any;
        state: any;
        result: any;
        error: any;
        progress: any;
    } | null>;
};
//# sourceMappingURL=aiQueueService.d.ts.map