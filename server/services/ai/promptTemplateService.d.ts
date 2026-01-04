declare namespace _default {
    export { PromptTemplateService };
    export { promptTemplateService };
    export { DEFAULT_TEMPLATES };
}
export default _default;
export class PromptTemplateService {
    cache: Map<any, any>;
    cacheMaxAge: number;
    /**
     * Get a template by code
     */
    getTemplate(code: any): Promise<any>;
    /**
     * Get template from database
     */
    getTemplateFromDB(code: any): Promise<any>;
    /**
     * Assemble a complete prompt from template and context
     */
    assemblePrompt(templateCode: any, context?: {}): Promise<{
        template: any;
        prompt: string;
        blocks: any[];
        config: any;
        metadata: {
            resolvedAt: string;
            language: any;
            blockCount: number;
            characterCount: number;
        };
    }>;
    /**
     * Get category label for prompt section
     */
    getCategoryLabel(category: any): any;
    /**
     * Get language instruction (language-agnostic approach)
     */
    getLanguageInstruction(languageCode: any): string;
    /**
     * Get all available templates
     */
    getAllTemplates(): Promise<any[]>;
    /**
     * Get all templates from database
     */
    getAllTemplatesFromDB(): Promise<any>;
    /**
     * Create a new template
     */
    createTemplate(templateData: any): Promise<any>;
    /**
     * Update an existing template
     */
    updateTemplate(code: any, updates: any): Promise<any>;
    /**
     * Validate a template
     */
    validateTemplate(templateCode: any, context?: {}): Promise<{
        valid: boolean;
        issues: {
            severity: string;
            message: string;
        }[];
    }>;
    /**
     * Preview a template with sample context
     */
    previewTemplate(templateCode: any, language?: string): Promise<{
        template: any;
        prompt: string;
        blocks: any[];
        config: any;
        metadata: {
            resolvedAt: string;
            language: any;
            blockCount: number;
            characterCount: number;
        };
    }>;
    /**
     * Get templates by category
     */
    getTemplatesByCategory(category: any): Promise<any[]>;
    getFromCache(key: any): any;
    setCache(key: any, data: any): void;
    clearCache(): void;
}
export const promptTemplateService: PromptTemplateService;
export namespace DEFAULT_TEMPLATES {
    namespace CHAT_STRATEGIC {
        let name: string;
        let category: string;
        let description: string;
        let blocks: string[];
        let variableSchema: {
            'user.name': {
                required: boolean;
            };
            'user.language': {
                required: boolean;
            };
        };
        namespace config {
            let temperature: number;
            let maxTokens: number;
        }
    }
    namespace ASSESSMENT_COACH {
        let name_1: string;
        export { name_1 as name };
        let category_1: string;
        export { category_1 as category };
        let description_1: string;
        export { description_1 as description };
        let blocks_1: string[];
        export { blocks_1 as blocks };
        let variableSchema_1: {
            'context.screen.data': {
                required: boolean;
            };
        };
        export { variableSchema_1 as variableSchema };
        export namespace config_1 {
            let temperature_1: number;
            export { temperature_1 as temperature };
            let maxTokens_1: number;
            export { maxTokens_1 as maxTokens };
        }
        export { config_1 as config };
    }
    namespace REPORT_GENERATOR {
        let name_2: string;
        export { name_2 as name };
        let category_2: string;
        export { category_2 as category };
        let description_2: string;
        export { description_2 as description };
        let blocks_2: string[];
        export { blocks_2 as blocks };
        let variableSchema_2: {
            'context.project.name': {
                required: boolean;
            };
        };
        export { variableSchema_2 as variableSchema };
        export namespace config_2 {
            let temperature_2: number;
            export { temperature_2 as temperature };
            let maxTokens_2: number;
            export { maxTokens_2 as maxTokens };
        }
        export { config_2 as config };
    }
    namespace INITIATIVE_GENERATOR {
        let name_3: string;
        export { name_3 as name };
        let category_3: string;
        export { category_3 as category };
        let description_3: string;
        export { description_3 as description };
        let blocks_3: string[];
        export { blocks_3 as blocks };
        let variableSchema_3: {
            'context.assessment.gaps': {
                required: boolean;
            };
        };
        export { variableSchema_3 as variableSchema };
        export namespace config_3 {
            let temperature_3: number;
            export { temperature_3 as temperature };
            let maxTokens_3: number;
            export { maxTokens_3 as maxTokens };
        }
        export { config_3 as config };
    }
    namespace MENTOR_COACH {
        let name_4: string;
        export { name_4 as name };
        let category_4: string;
        export { category_4 as category };
        let description_4: string;
        export { description_4 as description };
        let blocks_4: string[];
        export { blocks_4 as blocks };
        let variableSchema_4: {};
        export { variableSchema_4 as variableSchema };
        export namespace config_4 {
            let temperature_4: number;
            export { temperature_4 as temperature };
            let maxTokens_4: number;
            export { maxTokens_4 as maxTokens };
        }
        export { config_4 as config };
    }
    namespace QUICK_ANALYST {
        let name_5: string;
        export { name_5 as name };
        let category_5: string;
        export { category_5 as category };
        let description_5: string;
        export { description_5 as description };
        let blocks_5: string[];
        export { blocks_5 as blocks };
        let variableSchema_5: {};
        export { variableSchema_5 as variableSchema };
        export namespace config_5 {
            let temperature_5: number;
            export { temperature_5 as temperature };
            let maxTokens_5: number;
            export { maxTokens_5 as maxTokens };
        }
        export { config_5 as config };
    }
}
//# sourceMappingURL=promptTemplateService.d.ts.map