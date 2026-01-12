export namespace TOOL_TYPE {
    let READ: string;
    let MUTATION: string;
}
export namespace ToolSchemas {
    namespace get_project_details {
        export let name: string;
        export let description: string;
        import type = TOOL_TYPE.READ;
        export { type };
        export let parameters: z.ZodObject<{
            projectId: z.ZodString;
        }, z.core.$strip>;
        export let returns: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            status: z.ZodString;
            progress: z.ZodNumber;
            team: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                role: z.ZodString;
            }, z.core.$strip>>>;
            metrics: z.ZodOptional<z.ZodObject<{}, z.core.$loose>>;
        }, z.core.$strip>;
    }
    namespace search_knowledge_base {
        let name_1: string;
        export { name_1 as name };
        let description_1: string;
        export { description_1 as description };
        import type_1 = TOOL_TYPE.READ;
        export { type_1 as type };
        let parameters_1: z.ZodObject<{
            query: z.ZodString;
            maxResults: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        }, z.core.$strip>;
        export { parameters_1 as parameters };
        let returns_1: z.ZodObject<{
            results: z.ZodArray<z.ZodObject<{
                content: z.ZodString;
                source: z.ZodOptional<z.ZodString>;
                relevance: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            totalFound: z.ZodNumber;
        }, z.core.$strip>;
        export { returns_1 as returns };
    }
    namespace calculate_roi_draft {
        let name_2: string;
        export { name_2 as name };
        let description_2: string;
        export { description_2 as description };
        import type_2 = TOOL_TYPE.READ;
        export { type_2 as type };
        let parameters_2: z.ZodObject<{
            initialInvestment: z.ZodNumber;
            annualBenefit: z.ZodNumber;
            years: z.ZodDefault<z.ZodNumber>;
            discountRate: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>;
        export { parameters_2 as parameters };
        let returns_2: z.ZodObject<{
            roi: z.ZodNumber;
            npv: z.ZodNumber;
            paybackYears: z.ZodNumber;
            breakdown: z.ZodArray<z.ZodObject<{
                year: z.ZodNumber;
                cashFlow: z.ZodNumber;
                discountedCashFlow: z.ZodNumber;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        export { returns_2 as returns };
    }
    namespace create_initiative {
        let name_3: string;
        export { name_3 as name };
        let description_3: string;
        export { description_3 as description };
        import type_3 = TOOL_TYPE.MUTATION;
        export { type_3 as type };
        let parameters_3: z.ZodObject<{
            projectId: z.ZodString;
            title: z.ZodString;
            description: z.ZodString;
            priority: z.ZodEnum<{
                LOW: "LOW";
                MEDIUM: "MEDIUM";
                HIGH: "HIGH";
                CRITICAL: "CRITICAL";
            }>;
            estimatedEffort: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        export { parameters_3 as parameters };
        let returns_3: z.ZodObject<{
            id: z.ZodString;
            status: z.ZodString;
            message: z.ZodString;
        }, z.core.$strip>;
        export { returns_3 as returns };
    }
    namespace update_assessment_score {
        let name_4: string;
        export { name_4 as name };
        let description_4: string;
        export { description_4 as description };
        import type_4 = TOOL_TYPE.MUTATION;
        export { type_4 as type };
        let parameters_4: z.ZodObject<{
            assessmentId: z.ZodString;
            axisId: z.ZodString;
            score: z.ZodNumber;
        }, z.core.$strip>;
        export { parameters_4 as parameters };
        let returns_4: z.ZodObject<{
            success: z.ZodBoolean;
            message: z.ZodString;
        }, z.core.$strip>;
        export { returns_4 as returns };
    }
}
export class MCPServer extends BaseService {
    tools: Map<any, any>;
    /**
     * Register built-in tools
     */
    registerDefaultTools(): void;
    /**
     * Register a tool handler
     */
    registerHandler(toolName: any, handler: any): void;
    /**
     * Get all available tools for LLM function calling
     */
    getToolDefinitions(): {
        name: any;
        description: any;
        parameters: {
            type: string;
            properties: {};
            required?: undefined;
            additionalProperties?: undefined;
        } | {
            type: string;
            properties: {};
            required: string[];
            additionalProperties: boolean;
        };
    }[];
    /**
     * Simple Zod to JSON Schema converter
     */
    zodToJsonSchema(zodSchema: any): {
        type: string;
        properties: {};
        required?: undefined;
        additionalProperties?: undefined;
    } | {
        type: string;
        properties: {};
        required: string[];
        additionalProperties: boolean;
    };
    /**
     * Execute a tool call
     * @returns {Object} { status: 'SUCCESS' | 'REQUIRES_APPROVAL' | 'ERROR', data?, error? }
     */
    execute(toolName: any, params: any, context?: {}): Object;
}
export const mcpServer: MCPServer;
export default mcpServer;
import { z } from 'zod';
import BaseService from '../BaseService.js';
//# sourceMappingURL=mcpServer.d.ts.map