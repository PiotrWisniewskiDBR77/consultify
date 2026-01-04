export default ConnectorAdapter;
declare namespace ConnectorAdapter {
    function setDependencies(newDeps?: {}): void;
    function execute(orgId: string, connectorKey: string, action: string, payload: Object, options?: {
        dry_run: boolean;
    }): Promise<Object>;
    function _generatePlan(connectorKey: any, action: any, payload: any): any;
    function _executeAction(connectorKey: any, action: any, payload: any, secrets: any): Promise<{
        success: boolean;
        result: {
            ok: boolean;
            ts: string;
            channel: any;
            mock: boolean;
        };
        message: string;
    } | {
        success: boolean;
        result: {
            id: string;
            mock: boolean;
        };
        message: string;
    } | {
        success: boolean;
        error: string;
    }>;
    function _executeJira(action: any, payload: any, secrets: any): Promise<{
        success: boolean;
        result: {
            id: string;
            key: string;
            self: string;
            mock: boolean;
        };
        message: string;
    }>;
    function _executeGoogleCalendar(action: any, payload: any, secrets: any): Promise<{
        success: boolean;
        result: {
            id: string;
            htmlLink: string;
            summary: any;
            mock: boolean;
        };
        message: string;
    }>;
    function _executeSlack(action: any, payload: any, secrets: any): Promise<{
        success: boolean;
        result: {
            ok: boolean;
            ts: string;
            channel: any;
            mock: boolean;
        };
        message: string;
    }>;
    function _executeTeams(action: any, payload: any, secrets: any): Promise<{
        success: boolean;
        result: {
            id: string;
            mock: boolean;
        };
        message: string;
    }>;
    function _executeHubSpot(action: any, payload: any, secrets: any): Promise<{
        success: boolean;
        result: {
            id: string;
            mock: boolean;
        };
        message: string;
    }>;
}
//# sourceMappingURL=connectorAdapter.d.ts.map