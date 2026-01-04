export class BaseAgent {
    constructor(config?: {});
    id: string;
    name: any;
    domain: any;
    expertise: any;
    systemPrompt: any;
    confidenceThreshold: any;
    maxTokens: any;
    temperature: any;
    canInitiateDebate: boolean;
    debateWeight: any;
    costConscious: any;
    shortTermMemory: any[];
    maxMemoryItems: any;
    /**
     * Check if this agent is relevant for the given query
     * @param {string} query - User query
     * @param {object} context - Full context object
     * @returns {object} { isRelevant: boolean, confidence: number, reason: string }
     */
    checkRelevance(query: string, context: object): object;
    /**
     * Get domain-specific keywords for relevance matching
     * Override in subclasses
     */
    getKeywords(): never[];
    /**
     * Process query within agent's domain
     * @param {string} query - User query
     * @param {object} context - Full context object
     * @returns {object} Agent response with insights
     */
    process(query: string, context: object): object;
    /**
     * Generate domain-specific prompt
     * @param {string} query - User query
     * @param {object} context - Context object
     * @returns {string} Full prompt for LLM
     */
    buildPrompt(query: string, context: object): string;
    /**
     * Resolve model configuration, respecting cost-conscious settings
     */
    resolveModelConfig(context: any): Promise<any>;
    /**
     * Summarize context for prompt injection
     * Override for domain-specific context handling
     */
    summarizeContext(context: any): string;
    /**
     * Participate in debate with other agents
     * @param {string} topic - Debate topic
     * @param {array} otherPerspectives - Insights from other agents
     * @param {object} context - Full context
     * @returns {object} Debate contribution
     */
    contributeToDebate(topic: string, otherPerspectives: array, context: object): object;
    /**
     * Add item to short-term memory
     */
    remember(item: any): void;
    /**
     * Get recent memory items
     */
    getRecentMemory(count?: number): any[];
    /**
     * Clear short-term memory
     */
    clearMemory(): void;
    /**
     * Get agent metadata
     */
    getMetadata(): {
        id: string;
        name: any;
        domain: any;
        expertise: any;
        confidenceThreshold: any;
        canInitiateDebate: boolean;
        debateWeight: any;
    };
}
export default BaseAgent;
//# sourceMappingURL=baseAgent.d.ts.map