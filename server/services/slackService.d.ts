export default slackServiceInstance;
declare const slackServiceInstance: SlackService;
declare class SlackService {
    webhookUrl: string | undefined;
    sendSystemAlert(title: any, message: any, severity: any): Promise<void>;
    sendClientTicket(title: any, message: any, clientName: any): Promise<void>;
    sendNewFeedbackAlert(feedback: any): Promise<void>;
    /**
     * Send AI Health Alert to Slack
     * @param {Object} alertData - Alert data containing title, message, severity, failedTests, color
     */
    sendAIHealthAlert(alertData: Object): Promise<{
        sent: boolean;
        reason: string;
        severity?: undefined;
    } | {
        sent: boolean;
        severity: any;
        reason?: undefined;
    }>;
}
//# sourceMappingURL=slackService.d.ts.map