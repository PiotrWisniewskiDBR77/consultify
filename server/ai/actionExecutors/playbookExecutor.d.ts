export default PlaybookExecutor;
declare namespace PlaybookExecutor {
    function execute(payload: Object, metadata: Object): Promise<{
        success: boolean;
        playbookKey: any;
        playbookTitle: any;
        targetUserId: any;
        eventId: any;
        message: string;
    }>;
}
//# sourceMappingURL=playbookExecutor.d.ts.map