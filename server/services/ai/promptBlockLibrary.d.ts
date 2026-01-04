export default promptBlockLibrary;
export class PromptBlockLibrary {
    cache: Map<any, any>;
    cacheMaxAge: number;
    /**
     * Get all available block categories
     */
    getCategories(): {
        ROLE: {
            name: string;
            description: string;
            icon: string;
            color: string;
        };
        BEHAVIOR: {
            name: string;
            description: string;
            icon: string;
            color: string;
        };
        OUTPUT: {
            name: string;
            description: string;
            icon: string;
            color: string;
        };
        CONSTRAINT: {
            name: string;
            description: string;
            icon: string;
            color: string;
        };
        CONTEXT: {
            name: string;
            description: string;
            icon: string;
            color: string;
        };
        TASK: {
            name: string;
            description: string;
            icon: string;
            color: string;
        };
    };
    /**
     * Get all blocks (from DB with fallback to defaults)
     */
    getAllBlocks(): Promise<any>;
    /**
     * Get blocks from database
     */
    getBlocksFromDB(): Promise<any>;
    /**
     * Get a specific block by code
     */
    getBlock(code: any): Promise<any>;
    /**
     * Get blocks by category
     */
    getBlocksByCategory(category: any): Promise<any[]>;
    /**
     * Search blocks by keyword
     */
    searchBlocks(query: any): Promise<any[]>;
    /**
     * Create a new block
     */
    createBlock(blockData: any): Promise<any>;
    /**
     * Update an existing block
     */
    updateBlock(code: any, updates: any): Promise<any>;
    /**
     * Increment usage count for a block
     */
    incrementUsage(code: any): Promise<void>;
    /**
     * Get most used blocks
     */
    getMostUsedBlocks(limit?: number): Promise<any>;
    /**
     * Validate a block's semantic instruction
     */
    validateBlock(block: any): {
        valid: boolean;
        issues: string[];
    };
    getFromCache(key: any): any;
    setCache(key: any, data: any): void;
    clearCache(): void;
}
export const promptBlockLibrary: PromptBlockLibrary;
export namespace BLOCK_CATEGORIES {
    namespace ROLE {
        let name: string;
        let description: string;
        let icon: string;
        let color: string;
    }
    namespace BEHAVIOR {
        let name_1: string;
        export { name_1 as name };
        let description_1: string;
        export { description_1 as description };
        let icon_1: string;
        export { icon_1 as icon };
        let color_1: string;
        export { color_1 as color };
    }
    namespace OUTPUT {
        let name_2: string;
        export { name_2 as name };
        let description_2: string;
        export { description_2 as description };
        let icon_2: string;
        export { icon_2 as icon };
        let color_2: string;
        export { color_2 as color };
    }
    namespace CONSTRAINT {
        let name_3: string;
        export { name_3 as name };
        let description_3: string;
        export { description_3 as description };
        let icon_3: string;
        export { icon_3 as icon };
        let color_3: string;
        export { color_3 as color };
    }
    namespace CONTEXT {
        let name_4: string;
        export { name_4 as name };
        let description_4: string;
        export { description_4 as description };
        let icon_4: string;
        export { icon_4 as icon };
        let color_4: string;
        export { color_4 as color };
    }
    namespace TASK {
        let name_5: string;
        export { name_5 as name };
        let description_5: string;
        export { description_5 as description };
        let icon_5: string;
        export { icon_5 as icon };
        let color_5: string;
        export { color_5 as color };
    }
}
export const DEFAULT_BLOCKS: {
    'ROLE.STRATEGIC_CONSULTANT': {
        category: string;
        name: string;
        semantic: string;
        variables: string[];
        example: string;
    };
    'ROLE.DATA_ANALYST': {
        category: string;
        name: string;
        semantic: string;
        variables: never[];
        example: string;
    };
    'ROLE.PMO_ARCHITECT': {
        category: string;
        name: string;
        semantic: string;
        variables: never[];
        example: string;
    };
    'ROLE.MENTOR': {
        category: string;
        name: string;
        semantic: string;
        variables: string[];
        example: string;
    };
    'ROLE.FINANCIAL_ADVISOR': {
        category: string;
        name: string;
        semantic: string;
        variables: never[];
        example: string;
    };
    'ROLE.IMPLEMENTER': {
        category: string;
        name: string;
        semantic: string;
        variables: never[];
        example: string;
    };
    'BEHAVIOR.LANGUAGE_ADAPTIVE': {
        category: string;
        name: string;
        semantic: string;
        variables: string[];
        example: string;
    };
    'BEHAVIOR.PROFESSIONAL': {
        category: string;
        name: string;
        semantic: string;
        variables: never[];
        example: string;
    };
    'BEHAVIOR.CHALLENGING': {
        category: string;
        name: string;
        semantic: string;
        variables: never[];
        example: string;
    };
    'BEHAVIOR.DATA_DRIVEN': {
        category: string;
        name: string;
        semantic: string;
        variables: never[];
        example: string;
    };
    'BEHAVIOR.CONCISE': {
        category: string;
        name: string;
        semantic: string;
        variables: never[];
        example: string;
    };
    'BEHAVIOR.EMPATHETIC': {
        category: string;
        name: string;
        semantic: string;
        variables: never[];
        example: string;
    };
    'BEHAVIOR.SOCRATIC': {
        category: string;
        name: string;
        semantic: string;
        variables: never[];
        example: string;
    };
    'OUTPUT.EXECUTIVE_SUMMARY': {
        category: string;
        name: string;
        semantic: string;
        variables: never[];
        example: string;
    };
    'OUTPUT.DETAILED_ANALYSIS': {
        category: string;
        name: string;
        semantic: string;
        variables: never[];
        example: string;
    };
    'OUTPUT.QUICK_ANSWER': {
        category: string;
        name: string;
        semantic: string;
        variables: never[];
        example: string;
    };
    'OUTPUT.ACTION_PLAN': {
        category: string;
        name: string;
        semantic: string;
        variables: never[];
        example: string;
    };
    'OUTPUT.COMPARISON_TABLE': {
        category: string;
        name: string;
        semantic: string;
        variables: never[];
        example: string;
    };
    'CONSTRAINT.NO_HALLUCINATION': {
        category: string;
        name: string;
        semantic: string;
        variables: never[];
        example: string;
    };
    'CONSTRAINT.CONTEXT_ONLY': {
        category: string;
        name: string;
        semantic: string;
        variables: never[];
        example: string;
    };
    'CONSTRAINT.GOVERNANCE_COMPLIANT': {
        category: string;
        name: string;
        semantic: string;
        variables: never[];
        example: string;
    };
    'CONSTRAINT.POSITIVE_FRAMING': {
        category: string;
        name: string;
        semantic: string;
        variables: never[];
        example: string;
    };
    'CONSTRAINT.CONFIDENTIALITY': {
        category: string;
        name: string;
        semantic: string;
        variables: never[];
        example: string;
    };
    'CONTEXT.PROJECT_DATA': {
        category: string;
        name: string;
        semantic: string;
        variables: string[];
        example: string;
    };
    'CONTEXT.USER_PROFILE': {
        category: string;
        name: string;
        semantic: string;
        variables: string[];
        example: string;
    };
    'CONTEXT.SCREEN_STATE': {
        category: string;
        name: string;
        semantic: string;
        variables: string[];
        example: string;
    };
    'CONTEXT.CONVERSATION_HISTORY': {
        category: string;
        name: string;
        semantic: string;
        variables: string[];
        example: string;
    };
    'CONTEXT.KNOWLEDGE_BASE': {
        category: string;
        name: string;
        semantic: string;
        variables: string[];
        example: string;
    };
    'TASK.ASSESS_MATURITY': {
        category: string;
        name: string;
        semantic: string;
        variables: string[];
        example: string;
    };
    'TASK.GENERATE_INITIATIVES': {
        category: string;
        name: string;
        semantic: string;
        variables: string[];
        example: string;
    };
    'TASK.BUILD_ROADMAP': {
        category: string;
        name: string;
        semantic: string;
        variables: string[];
        example: string;
    };
    'TASK.WRITE_REPORT_SECTION': {
        category: string;
        name: string;
        semantic: string;
        variables: string[];
        example: string;
    };
};
//# sourceMappingURL=promptBlockLibrary.d.ts.map