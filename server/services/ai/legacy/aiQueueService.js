export const createAIQueueService = ({ deps }) => ({
    queueTask: async (taskType, payload, userId) => {
        const job = await deps.aiQueue.add(taskType, {
            taskType,
            payload,
            userId
        });
        return { jobId: job.id, status: 'queued' };
    },

    getJobStatus: async (jobId) => {
        const job = await deps.aiQueue.getJob(jobId);
        if (!job) return null;

        const state = await job.getState();
        const result = job.returnvalue;
        const error = job.failedReason;
        const progress = job.progress;

        return { id: job.id, state, result, error, progress };
    }
});
