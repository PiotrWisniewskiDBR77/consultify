declare namespace _default {
    export { processMessage };
    export { logInteraction };
    export { findRelevantContent };
    export { loadHelpContent };
}
export default _default;
/**
 * Process a chat message
 */
export function processMessage(message: any, options?: {}): Promise<{
    message: any;
    sources: any[];
}>;
/**
 * Log chat interaction for analytics
 */
export function logInteraction(userId: any, sessionId: any, message: any, response: any): Promise<void>;
/**
 * Find relevant help content based on query
 */
export function findRelevantContent(query: any, contextModule: any): Promise<{
    modules: never[];
    cards: never[];
    faqs: never[];
}>;
/**
 * Load all help content for context
 */
export function loadHelpContent(): Promise<any>;
//# sourceMappingURL=helpChatService.d.ts.map