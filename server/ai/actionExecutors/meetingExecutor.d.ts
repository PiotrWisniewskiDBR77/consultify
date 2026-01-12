export default MeetingExecutor;
declare namespace MeetingExecutor {
    function execute(payload: Object, metadata: Object): Promise<{
        success: boolean;
        dry_run: boolean;
        would_do: any;
        external_calls: any;
        connector_key: any;
        sandbox_mode: any;
        meetingId?: undefined;
        summary?: undefined;
        participants?: undefined;
        scheduledAt?: undefined;
        result?: undefined;
        message?: undefined;
    } | {
        success: boolean;
        meetingId: any;
        summary: any;
        participants: any;
        scheduledAt: string;
        connector_key: any;
        result: any;
        message: string;
        dry_run?: undefined;
        would_do?: undefined;
        external_calls?: undefined;
        sandbox_mode?: undefined;
    }>;
    function dryRun(payload: Object, metadata: Object): Promise<{
        success: boolean;
        dry_run: boolean;
        would_do: any;
        external_calls: any;
        connector_key: any;
        sandbox_mode: any;
        meetingId?: undefined;
        summary?: undefined;
        participants?: undefined;
        scheduledAt?: undefined;
        result?: undefined;
        message?: undefined;
    } | {
        success: boolean;
        meetingId: any;
        summary: any;
        participants: any;
        scheduledAt: string;
        connector_key: any;
        result: any;
        message: string;
        dry_run?: undefined;
        would_do?: undefined;
        external_calls?: undefined;
        sandbox_mode?: undefined;
    }>;
}
//# sourceMappingURL=meetingExecutor.d.ts.map