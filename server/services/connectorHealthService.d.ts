export default ConnectorHealthService;
declare namespace ConnectorHealthService {
    function testConnection(orgId: string, connectorKey: string): Promise<Object>;
    function _recordHealth(orgId: any, connectorKey: any, ok: any, errorCode: any, errorMessage: any): Promise<any>;
    function getHealth(orgId: string): Promise<Object[]>;
    function _testJira(secrets: any): Promise<{
        ok: boolean;
        error_code: string;
        error_message: string;
    } | {
        ok: boolean;
        error_code?: undefined;
        error_message?: undefined;
    }>;
    function _testSlack(secrets: any): Promise<{
        ok: boolean;
        error_code: string;
        error_message: string;
    } | {
        ok: boolean;
        error_code?: undefined;
        error_message?: undefined;
    }>;
    function _testGoogleCalendar(secrets: any): Promise<{
        ok: boolean;
        error_code: string;
        error_message: string;
    } | {
        ok: boolean;
        error_code?: undefined;
        error_message?: undefined;
    }>;
    function _testTeams(secrets: any): Promise<{
        ok: boolean;
        error_code: string;
        error_message: string;
    } | {
        ok: boolean;
        error_code?: undefined;
        error_message?: undefined;
    }>;
    function _testHubSpot(secrets: any): Promise<{
        ok: boolean;
        error_code: string;
        error_message: string;
    } | {
        ok: boolean;
        error_code?: undefined;
        error_message?: undefined;
    }>;
}
//# sourceMappingURL=connectorHealthService.d.ts.map