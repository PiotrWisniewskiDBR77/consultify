export default TeamsUserIntegration;
declare namespace TeamsUserIntegration {
    function getOAuthUrl(userId: any, redirectUri: any): string;
    function handleCallback(userId: any, code: any, redirectUri: any): Promise<{
        success: boolean;
        user: any;
    }>;
    function refreshToken(userId: any): Promise<{
        success: boolean;
    }>;
    function sendNotification(userId: any, notification: any): Promise<{
        success: boolean;
        reason?: undefined;
    } | {
        success: boolean;
        reason: string;
    }>;
    function _buildAdaptiveCard(notification: any): {
        $schema: string;
        type: string;
        version: string;
        body: {
            type: string;
            items: ({
                type: string;
                text: any;
                weight: string;
                size: string;
                color: any;
                isSubtle?: undefined;
                wrap?: undefined;
            } | {
                type: string;
                text: any;
                isSubtle: boolean;
                size: string;
                weight?: undefined;
                color?: undefined;
                wrap?: undefined;
            } | {
                type: string;
                text: any;
                wrap: boolean;
                weight?: undefined;
                size?: undefined;
                color?: undefined;
                isSubtle?: undefined;
            })[];
        }[];
        actions: {
            type: string;
            title: string;
            url: any;
        }[];
    };
    function testConnection(userId: any): any;
    function getTeams(userId: any): Promise<any>;
}
//# sourceMappingURL=teamsUserIntegration.d.ts.map