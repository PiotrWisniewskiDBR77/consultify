export interface FeedbackData {
    type: 'BUG' | 'FEATURE' | 'OTHER';
    userEmail?: string;
    message: string;
}
export interface WhatsappServiceInterface {
    sendNewFeedbackAlert: (feedback: FeedbackData) => Promise<void>;
}
declare class WhatsappService implements WhatsappServiceInterface {
    private client;
    private fromNumber;
    private toNumber;
    private isEnabled;
    constructor();
    sendNewFeedbackAlert(feedback: FeedbackData): Promise<void>;
}
declare const _default: WhatsappService;
export default _default;
//# sourceMappingURL=whatsappService.d.ts.map