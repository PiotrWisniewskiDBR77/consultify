/**
 * MCP Server - Central Tool Registry
 * Model Context Protocol implementation for AI Tool Calling
 */

const { z } = require('zod');

// Tool Type Constants
const TOOL_TYPE = {
    READ: 'READ',           // Safe, auto-approved
    MUTATION: 'MUTATION'    // Requires user approval
};

// Tool schemas using Zod
const ToolSchemas = {
    get_project_details: {
        name: 'get_project_details',
        description: 'Retrieve full project details including status, team, timeline, and metrics',
        type: TOOL_TYPE.READ,
        parameters: z.object({
            projectId: z.string().describe('The UUID of the project to retrieve')
        }),
        returns: z.object({
            id: z.string(),
            name: z.string(),
            status: z.string(),
            progress: z.number(),
            team: z.array(z.object({ name: z.string(), role: z.string() })).optional(),
            metrics: z.object({}).passthrough().optional()
        })
    },

    search_knowledge_base: {
        name: 'search_knowledge_base',
        description: 'Search the DRD methodology knowledge base for relevant information',
        type: TOOL_TYPE.READ,
        parameters: z.object({
            query: z.string().describe('The search query for the knowledge base'),
            maxResults: z.number().optional().default(5).describe('Maximum number of results to return')
        }),
        returns: z.object({
            results: z.array(z.object({
                content: z.string(),
                source: z.string().optional(),
                relevance: z.number().optional()
            })),
            totalFound: z.number()
        })
    },

    calculate_roi_draft: {
        name: 'calculate_roi_draft',
        description: 'Calculate ROI, NPV, and payback period for an initiative',
        type: TOOL_TYPE.READ,
        parameters: z.object({
            initialInvestment: z.number().describe('Initial investment cost'),
            annualBenefit: z.number().describe('Expected annual benefit/savings'),
            years: z.number().default(5).describe('Analysis period in years'),
            discountRate: z.number().default(0.1).describe('Discount rate for NPV calculation')
        }),
        returns: z.object({
            roi: z.number().describe('Return on Investment percentage'),
            npv: z.number().describe('Net Present Value'),
            paybackYears: z.number().describe('Payback period in years'),
            breakdown: z.array(z.object({
                year: z.number(),
                cashFlow: z.number(),
                discountedCashFlow: z.number()
            }))
        })
    },

    // MUTATION TOOLS (Require User Approval)
    create_initiative: {
        name: 'create_initiative',
        description: 'Create a new initiative in the project. REQUIRES USER APPROVAL before execution.',
        type: TOOL_TYPE.MUTATION,
        parameters: z.object({
            projectId: z.string().describe('The project to add the initiative to'),
            title: z.string().describe('Title of the initiative'),
            description: z.string().describe('Detailed description'),
            priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).describe('Priority level'),
            estimatedEffort: z.string().optional().describe('Estimated effort (e.g., "2 weeks")')
        }),
        returns: z.object({
            id: z.string(),
            status: z.string(),
            message: z.string()
        })
    },

    update_assessment_score: {
        name: 'update_assessment_score',
        description: 'Update a maturity assessment score. REQUIRES USER APPROVAL before execution.',
        type: TOOL_TYPE.MUTATION,
        parameters: z.object({
            assessmentId: z.string().describe('Assessment ID'),
            axisId: z.string().describe('Axis/Dimension ID'),
            score: z.number().min(1).max(5).describe('New maturity score (1-5)')
        }),
        returns: z.object({
            success: z.boolean(),
            message: z.string()
        })
    }
};

const { aiLogger } = require('./logger');

class MCPServer {
    constructor() {
        this.tools = new Map();
        this.registerDefaultTools();
    }

    /**
     * Register built-in tools
     */
    registerDefaultTools() {
        Object.entries(ToolSchemas).forEach(([name, schema]) => {
            this.tools.set(name, {
                ...schema,
                handler: null // Handlers set separately
            });
        });
    }

    /**
     * Register a tool handler
     */
    registerHandler(toolName, handler) {
        if (!this.tools.has(toolName)) {
            aiLogger.error('MCP', `Attempted to register handler for unknown tool: ${toolName}`);
            throw new Error(`Unknown tool: ${toolName}`);
        }
        const tool = this.tools.get(toolName);
        tool.handler = handler;
        this.tools.set(toolName, tool);
        aiLogger.debug('MCP', `Handler registered for: ${toolName}`);
    }

    /**
     * Get all available tools for LLM function calling
     */
    getToolDefinitions() {
        const definitions = [];

        for (const [name, tool] of this.tools) {
            definitions.push({
                name: tool.name,
                description: tool.description,
                parameters: this.zodToJsonSchema(tool.parameters) // Convert to plain JSON Schema
            });
        }

        return definitions;
    }

    /**
     * Simple Zod to JSON Schema converter
     */
    zodToJsonSchema(zodSchema) {
        if (!zodSchema) return { type: 'object', properties: {} };

        // Handle ZodObject
        let shape = {};
        if (zodSchema._def && typeof zodSchema._def.shape === 'function') {
            shape = zodSchema._def.shape();
        } else if (zodSchema.shape) {
            shape = zodSchema.shape;
        } else if (zodSchema._def && zodSchema._def.shape) {
            shape = zodSchema._def.shape;
        }
        const properties = {};
        const required = [];

        for (const [key, value] of Object.entries(shape)) {
            const def = value._def;
            let type = 'string';

            if (def.typeName === 'ZodNumber') type = 'number';
            else if (def.typeName === 'ZodBoolean') type = 'boolean';
            else if (def.typeName === 'ZodArray') type = 'array';
            else if (def.typeName === 'ZodEnum') type = 'string';

            properties[key] = {
                type,
                description: value.description || ''
            };

            if (!value.isOptional?.() && !value._def.isOptional) {
                required.push(key);
            }
        }

        return {
            type: 'object',
            properties,
            required,
            additionalProperties: false
        };
    }

    /**
     * Execute a tool call
     * @returns {Object} { status: 'SUCCESS' | 'REQUIRES_APPROVAL' | 'ERROR', data?, error? }
     */
    async execute(toolName, params, context = {}) {
        const tool = this.tools.get(toolName);

        if (!tool) {
            aiLogger.error('MCP', `Execution failed: Unknown tool ${toolName}`);
            return { status: 'ERROR', error: `Unknown tool: ${toolName}` };
        }

        // Validate parameters
        try {
            const validated = tool.parameters.parse(params);

            // Check governance
            if (tool.type === TOOL_TYPE.MUTATION) {
                aiLogger.tool(toolName, 'REQUIRES_APPROVAL', { params: validated });
                return {
                    status: 'REQUIRES_APPROVAL',
                    toolName,
                    params: validated,
                    message: `This action requires your approval before execution.`
                };
            }

            // Execute READ tools directly
            if (!tool.handler) {
                aiLogger.error('MCP', `No handler for tool ${toolName}`);
                return { status: 'ERROR', error: `No handler registered for tool: ${toolName}` };
            }

            aiLogger.tool(toolName, 'EXECUTING', { params: validated });
            const result = await tool.handler(validated, context);
            aiLogger.tool(toolName, 'SUCCESS');

            return {
                status: 'SUCCESS',
                data: result
            };

        } catch (error) {
            aiLogger.error('MCP', `Execution failed for ${toolName}`, error);
            return {
                status: 'ERROR',
                error: error.message
            };
        }
    }
}

// Singleton instance
const mcpServer = new MCPServer();

module.exports = {
    MCPServer,
    mcpServer,
    TOOL_TYPE,
    ToolSchemas
};
