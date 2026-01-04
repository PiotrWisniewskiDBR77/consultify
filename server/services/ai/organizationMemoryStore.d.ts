declare namespace _default {
    export { OrganizationMemoryStore };
    export { organizationMemoryStore };
    export { ORG_MEMORY_TYPES };
}
export default _default;
export class OrganizationMemoryStore {
    isPg: boolean;
    /**
     * Ensure the organization_memory table exists
     */
    ensureTable(): Promise<any>;
    /**
     * Add a pattern to organization memory
     * @param {string} organizationId - Organization ID
     * @param {Object} pattern - Pattern data
     */
    addPattern(organizationId: string, pattern: Object): Promise<any>;
    /**
     * Add a success pattern from a completed project
     * @param {string} organizationId - Organization ID
     * @param {Object} successData - Success pattern data
     */
    addSuccessPattern(organizationId: string, successData: Object): Promise<any>;
    /**
     * Add a best practice
     * @param {string} organizationId - Organization ID
     * @param {Object} practiceData - Best practice data
     */
    addBestPractice(organizationId: string, practiceData: Object): Promise<any>;
    /**
     * Search patterns using semantic similarity
     * @param {string} organizationId - Organization ID
     * @param {string} query - Search query
     * @param {Object} options - Search options
     */
    searchPatterns(organizationId: string, query: string, options?: Object): Promise<any>;
    /**
     * SQLite semantic search (cosine similarity in JS)
     * @private
     */
    private _searchSqlite;
    /**
     * PostgreSQL semantic search (pgvector)
     * @private
     */
    private _searchPg;
    /**
     * Keyword-based search fallback
     * @private
     */
    private _keywordSearch;
    /**
     * Get recent patterns without search
     */
    getRecentPatterns(organizationId: any, options?: {}): Promise<any>;
    /**
     * Extract patterns from a completed project using AI
     * @param {string} organizationId - Organization ID
     * @param {Object} projectData - Completed project data
     */
    extractPatternsFromProject(organizationId: string, projectData: Object): Promise<{
        extracted: number;
        error?: undefined;
    } | {
        extracted: number;
        error: any;
    }>;
    /**
     * Update usage count for accessed patterns
     * @private
     */
    private _updateUsageCounts;
    /**
     * Deactivate low-value patterns
     * @param {string} organizationId - Organization ID
     * @param {number} minUsage - Minimum usage count
     * @param {number} daysOld - Days since creation
     */
    deactivateLowValuePatterns(organizationId: string, minUsage?: number, daysOld?: number): Promise<any>;
    /**
     * Compute cosine similarity
     * @private
     */
    private _cosineSimilarity;
    /**
     * Safely parse JSON
     * @private
     */
    private _parseJSON;
}
export const organizationMemoryStore: OrganizationMemoryStore;
export namespace ORG_MEMORY_TYPES {
    namespace SUCCESS_PATTERN {
        let weight: number;
        let minApplicability: number;
    }
    namespace FAILURE_PATTERN {
        let weight_1: number;
        export { weight_1 as weight };
        let minApplicability_1: number;
        export { minApplicability_1 as minApplicability };
    }
    namespace BEST_PRACTICE {
        let weight_2: number;
        export { weight_2 as weight };
        let minApplicability_2: number;
        export { minApplicability_2 as minApplicability };
    }
    namespace LESSON_LEARNED {
        let weight_3: number;
        export { weight_3 as weight };
        let minApplicability_3: number;
        export { minApplicability_3 as minApplicability };
    }
    namespace BENCHMARK {
        let weight_4: number;
        export { weight_4 as weight };
        let minApplicability_4: number;
        export { minApplicability_4 as minApplicability };
    }
    namespace TEMPLATE {
        let weight_5: number;
        export { weight_5 as weight };
        let minApplicability_5: number;
        export { minApplicability_5 as minApplicability };
    }
    namespace STANDARD {
        let weight_6: number;
        export { weight_6 as weight };
        let minApplicability_6: number;
        export { minApplicability_6 as minApplicability };
    }
    namespace AI_INSIGHT {
        let weight_7: number;
        export { weight_7 as weight };
        let minApplicability_7: number;
        export { minApplicability_7 as minApplicability };
    }
}
//# sourceMappingURL=organizationMemoryStore.d.ts.map