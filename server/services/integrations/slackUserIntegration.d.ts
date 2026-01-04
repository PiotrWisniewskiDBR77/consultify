export default SlackUserIntegration;
declare namespace SlackUserIntegration {
    function getOAuthUrl(userId: any, redirectUri: any): string;
    function handleCallback(userId: any, code: any, redirectUri: any): Promise<{
        success: boolean;
        workspace: any;
    }>;
    function sendMessage(userId: any, message: any, options?: {}): Promise<{
        success: boolean;
        messageTs: any;
        channel: any;
    }>;
    function sendNotification(userId: any, notification: any): Promise<{
        success: boolean;
        messageTs: any;
        channel: any;
    }>;
    function _buildNotificationBlocks(notification: any): ({
        type: string;
        text: {
            type: string;
            text: any;
            emoji: boolean;
        };
        elements?: undefined;
    } | {
        type: string;
        elements: {
            type: string;
            text: string;
        }[];
        text?: undefined;
    } | {
        type: string;
        text: {
            type: string;
            text: any;
            emoji?: undefined;
        };
        elements?: undefined;
    } | {
        type: string;
        elements: {
            type: string;
            text: {
                type: string;
                text: string;
                emoji: boolean;
            };
            url: any;
            action_id: string;
        }[];
        text?: undefined;
    } | {
        type: string;
        elements: ({
            type: string;
            text: {
                type: string;
                text: string;
                emoji: boolean;
            };
            style: string;
            action_id: string;
        } | {
            type: string;
            text: {
                type: string;
                text: string;
                emoji: boolean;
            };
            action_id: string;
            style?: undefined;
        })[];
        text?: undefined;
    })[];
    function testConnection(userId: any): Promise<{
        success: boolean;
        error: any;
        user?: undefined;
        team?: undefined;
    } | {
        success: boolean;
        user: any;
        team: any;
        error?: undefined;
    }>;
    function getChannels(userId: any): Promise<any>;
}
//# sourceMappingURL=slackUserIntegration.d.ts.map