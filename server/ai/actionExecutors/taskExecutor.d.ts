export default TaskExecutor;
declare namespace TaskExecutor {
    function execute(payload: Object, metadata: Object): Promise<{
        success: boolean;
        taskId: string;
        title: any;
        message: string;
    }>;
}
//# sourceMappingURL=taskExecutor.d.ts.map