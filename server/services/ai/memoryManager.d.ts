declare namespace _default {
    export { MemoryManager };
    export { memoryManager };
    export { LAYER_CONFIG };
}
export default _default;
export class MemoryManager {
    sessionStore: PersistentSessionStore;
    projectStore: import("./projectMemoryStore.js").ProjectMemoryStore;
    orgStore: import("./organizationMemoryStore.js").OrganizationMemoryStore;
    knowledgeStore: import("./embeddingService.js").EmbeddingService;
    webResearchService: import("./webResearchService.js").WebResearchService | null;
    /**
     * Retrieve relevant memory from all enabled layers
     * @param {Object} query - Memory query parameters
     * @returns {Object} Memory result with chunks and metadata
     */
    retrieve(query: Object): Object;
    /**
     * Retrieve from a specific layer
     * @private
     */
    private _retrieveFromLayer;
    /**
     * Retrieve from external web research
     * @private
     */
    private _retrieveExternal;
    /**
     * Parse project memory into chunks
     * @private
     */
    private _parseProjectMemory;
    /**
     * Merge and rank chunks from all layers
     * @private
     */
    private _mergeAndRank;
    /**
     * Summarize sources for metadata
     * @private
     */
    private _summarizeSources;
    /**
     * Estimate token count for chunks
     * @private
     */
    private _estimateTokens;
    /**
     * Record a significant interaction to memory
     * @param {Object} interaction - Interaction data
     */
    recordIfSignificant(interaction: Object): Promise<{
        recorded: boolean;
        reason: string;
    } | {
        recorded: boolean;
        reason?: undefined;
    }>;
    /**
     * Record a decision to project memory
     * @param {string} projectId - Project ID
     * @param {Object} decision - Decision data
     */
    recordDecision(projectId: string, decision: Object): Promise<any>;
    /**
     * Record a learning from project
     * @param {string} projectId - Project ID
     * @param {Object} learning - Learning data
     */
    recordLearning(projectId: string, learning: Object): Promise<any>;
    /**
     * Extract patterns from a completed project
     * @param {string} organizationId - Organization ID
     * @param {Object} projectData - Project data
     */
    extractPatterns(organizationId: string, projectData: Object): Promise<{
        extracted: number;
        error?: undefined;
    } | {
        extracted: number;
        error: any;
    }>;
    /**
     * Serialize memory context for AI prompt
     * @param {Object} memoryResult - Result from retrieve()
     * @returns {string} Formatted context string
     */
    serializeForPrompt(memoryResult: Object): string;
    /**
     * Get memory stats for diagnostics
     */
    getStats(organizationId: any, projectId: any): Promise<{
        session: {
            available: boolean;
        };
        project: {
            available: boolean;
        };
        organization: {
            available: boolean;
        };
        knowledge: {
            available: boolean;
        };
        external: {
            available: boolean;
        };
    }>;
}
export const memoryManager: MemoryManager;
export namespace LAYER_CONFIG {
    namespace session {
        let weight: number;
        let maxChunks: number;
        let ttlMinutes: number;
        let enabled: boolean;
    }
    namespace project {
        let weight_1: number;
        export { weight_1 as weight };
        let maxChunks_1: number;
        export { maxChunks_1 as maxChunks };
        let enabled_1: boolean;
        export { enabled_1 as enabled };
    }
    namespace organization {
        let weight_2: number;
        export { weight_2 as weight };
        let maxChunks_2: number;
        export { maxChunks_2 as maxChunks };
        let enabled_2: boolean;
        export { enabled_2 as enabled };
    }
    namespace knowledge {
        let weight_3: number;
        export { weight_3 as weight };
        let maxChunks_3: number;
        export { maxChunks_3 as maxChunks };
        let enabled_3: boolean;
        export { enabled_3 as enabled };
    }
    namespace external {
        let weight_4: number;
        export { weight_4 as weight };
        let maxChunks_4: number;
        export { maxChunks_4 as maxChunks };
        let enabled_4: boolean;
        export { enabled_4 as enabled };
    }
}
import { PersistentSessionStore } from './persistentSessionStore.js';
//# sourceMappingURL=memoryManager.d.ts.map