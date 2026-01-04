export default FeedbackService;
declare namespace FeedbackService {
    function saveFeedback(userId: any, context: any, prompt: any, response: any, rating: any, correction?: string): Promise<void>;
    function getLearningExamples(contextType: string): Promise<any>;
    function consolidateLearning(): Promise<{
        status: string;
        contextsAnalyzed: any;
    }>;
    function getFeedbackItems(filters?: {}): Promise<any>;
    function createFeedbackItem(feedbackData: any): Promise<any>;
    function voteFeedback(feedbackId: any, userId: any, voteType?: string): Promise<any>;
    function addFeedbackComment(feedbackId: any, userId: any, commentText: any, isInternal?: boolean): Promise<any>;
    function getFeatureRoadmap(status?: null): Promise<any>;
    function updateFeatureRoadmap(itemId: any, updates: any): Promise<any>;
}
//# sourceMappingURL=feedbackService.d.ts.map