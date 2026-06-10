/**
 * MCP Server - Central Tool Registry
 * Model Context Protocol implementation for AI Tool Calling.
 */

import { z } from 'zod';

import { aiLogger } from './logger.js';

export const TOOL_TYPE = {
  READ: 'READ',
  MUTATION: 'MUTATION',
} as const;

type ToolType = (typeof TOOL_TYPE)[keyof typeof TOOL_TYPE];

type ToolHandler = (params: unknown, context?: Record<string, unknown>) => Promise<unknown>;

type ToolEntry = {
  name: string;
  description: string;
  type: ToolType;
  parameters: z.ZodTypeAny;
  returns: z.ZodTypeAny;
  handler: ToolHandler | null;
};

export const ToolSchemas: Record<string, Omit<ToolEntry, 'handler'>> = {
  get_project_details: {
    name: 'get_project_details',
    description: 'Retrieve full project details including status, team, timeline, and metrics',
    type: TOOL_TYPE.READ,
    parameters: z.object({
      projectId: z.string().describe('The UUID of the project to retrieve'),
    }),
    returns: z.object({
      id: z.string(),
      name: z.string(),
      status: z.string(),
      progress: z.number(),
      team: z.array(z.object({ name: z.string(), role: z.string() })).optional(),
      metrics: z.object({}).passthrough().optional(),
    }),
  },
  search_knowledge_base: {
    name: 'search_knowledge_base',
    description: 'Search the DRD methodology knowledge base for relevant information',
    type: TOOL_TYPE.READ,
    parameters: z.object({
      query: z.string().describe('The search query for the knowledge base'),
      maxResults: z.number().optional().default(5).describe('Maximum number of results to return'),
    }),
    returns: z.object({
      results: z.array(
        z.object({
          content: z.string(),
          source: z.string().optional(),
          relevance: z.number().optional(),
        })
      ),
      totalFound: z.number(),
    }),
  },
  calculate_roi_draft: {
    name: 'calculate_roi_draft',
    description: 'Calculate ROI, NPV, and payback period for an initiative',
    type: TOOL_TYPE.READ,
    parameters: z.object({
      initialInvestment: z.number().describe('Initial investment cost'),
      annualBenefit: z.number().describe('Expected annual benefit/savings'),
      years: z.number().default(5).describe('Analysis period in years'),
      discountRate: z.number().default(0.1).describe('Discount rate for NPV calculation'),
    }),
    returns: z.object({
      roi: z.number().describe('Return on Investment percentage'),
      npv: z.number().describe('Net Present Value'),
      paybackYears: z.number().describe('Payback period in years'),
      breakdown: z.array(
        z.object({
          year: z.number(),
          cashFlow: z.number(),
          discountedCashFlow: z.number(),
        })
      ),
    }),
  },
  create_initiative: {
    name: 'create_initiative',
    description: 'Create a new initiative in the project. REQUIRES USER APPROVAL before execution.',
    type: TOOL_TYPE.MUTATION,
    parameters: z.object({
      projectId: z.string().describe('The project to add the initiative to'),
      title: z.string().describe('Title of the initiative'),
      description: z.string().describe('Detailed description'),
      priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).describe('Priority level'),
      estimatedEffort: z.string().optional().describe('Estimated effort (e.g., "2 weeks")'),
    }),
    returns: z.object({
      id: z.string(),
      status: z.string(),
      message: z.string(),
    }),
  },
  // ── Teresa org-content retrieval (ff_teresaRetrieval / ENABLE_TERESA_RETRIEVAL) ──
  search_org_notes: {
    name: 'search_org_notes',
    description:
      'Search the organization notebook (notes) by topic using hybrid FTS + semantic search. ' +
      'Org-scoped and permission-safe. Use when the user references a note by subject, e.g. "notatka o spotkaniu z Elkomtech".',
    type: TOOL_TYPE.READ,
    parameters: z.object({
      query: z.string().describe('Topic or phrase to search notes for (user language is fine)'),
      limit: z.number().optional().default(5).describe('Max results to return (1-10)'),
    }),
    returns: z.object({
      results: z.array(
        z.object({
          pageId: z.string(),
          title: z.string(),
          snippet: z.string(),
          updatedAt: z.string().nullable(),
        })
      ),
      truncated: z.boolean(),
    }),
  },
  search_insights: {
    name: 'search_insights',
    description:
      'Search interview insights (wnioski) of the organization by topic. ' +
      'Org-scoped. Use when the user references an insight/analysis by subject.',
    type: TOOL_TYPE.READ,
    parameters: z.object({
      query: z.string().describe('Topic or phrase to search insights for (user language is fine)'),
      limit: z.number().optional().default(5).describe('Max results to return (1-10)'),
    }),
    returns: z.object({
      results: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          snippet: z.string(),
          type: z.string(),
        })
      ),
      truncated: z.boolean(),
    }),
  },
  get_initiative: {
    name: 'get_initiative',
    description:
      'Fetch one initiative (core fields: title, summary, status) by id. ' +
      'Org-scoped — returns a not-found result when the id belongs to another organization.',
    type: TOOL_TYPE.READ,
    parameters: z.object({
      initiativeId: z.string().describe('The UUID of the initiative to retrieve'),
    }),
    returns: z.object({
      results: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          summary: z.string(),
          status: z.string(),
          axis: z.string().nullable(),
          area: z.string().nullable(),
          updatedAt: z.string().nullable(),
        })
      ),
      truncated: z.boolean(),
      notFound: z.boolean().optional(),
    }),
  },
  update_assessment_score: {
    name: 'update_assessment_score',
    description: 'Update a maturity assessment score. REQUIRES USER APPROVAL before execution.',
    type: TOOL_TYPE.MUTATION,
    parameters: z.object({
      assessmentId: z.string().describe('Assessment ID'),
      axisId: z.string().describe('Axis/Dimension ID'),
      score: z.number().min(1).max(5).describe('New maturity score (1-5)'),
    }),
    returns: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
  },
};

export class MCPServer {
  tools: Map<string, ToolEntry>;

  constructor() {
    this.tools = new Map();
    this.registerDefaultTools();
  }

  registerDefaultTools(): void {
    Object.entries(ToolSchemas).forEach(([name, schema]) => {
      this.tools.set(name, {
        ...schema,
        handler: null,
      });
    });
  }

  registerHandler(toolName: string, handler: ToolHandler): void {
    if (!this.tools.has(toolName)) {
      aiLogger.error('MCP', `Attempted to register handler for unknown tool: ${toolName}`);
      throw new Error(`Unknown tool: ${toolName}`);
    }
    const toolEntry = this.tools.get(toolName);
    if (!toolEntry) {
      throw new Error(`Unknown tool: ${toolName}`);
    }
    toolEntry.handler = handler;
    this.tools.set(toolName, toolEntry);
    aiLogger.debug('MCP', `Handler registered for: ${toolName}`);
  }

  getToolDefinitions(): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> {
    const definitions: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }> = [];

    for (const [, toolEntry] of this.tools) {
      definitions.push({
        name: toolEntry.name,
        description: toolEntry.description,
        parameters: this.zodToJsonSchema(toolEntry.parameters),
      });
    }

    return definitions;
  }

  zodToJsonSchema(zodSchema: z.ZodTypeAny): Record<string, unknown> {
    if (!zodSchema) return { type: 'object', properties: {} };

    let shape: Record<string, z.ZodTypeAny> = {};
    const defShape = (zodSchema as { _def?: { shape?: unknown } })._def?.shape;
    if (typeof defShape === 'function') {
      shape = defShape() as Record<string, z.ZodTypeAny>;
    } else if ((zodSchema as { shape?: unknown }).shape) {
      shape = (zodSchema as { shape?: Record<string, z.ZodTypeAny> }).shape || {};
    } else if (defShape) {
      shape = defShape as Record<string, z.ZodTypeAny>;
    }

    const properties: Record<string, Record<string, unknown>> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const def = (value as { _def?: { typeName?: string; isOptional?: boolean } })._def;
      let type = 'string';

      if (def?.typeName === 'ZodNumber') type = 'number';
      else if (def?.typeName === 'ZodBoolean') type = 'boolean';
      else if (def?.typeName === 'ZodArray') type = 'array';
      else if (def?.typeName === 'ZodEnum') type = 'string';

      properties[key] = {
        type,
        description: (value as { description?: string }).description || '',
      };

      const isOptional =
        (value as { isOptional?: () => boolean }).isOptional?.() || def?.isOptional;
      if (!isOptional) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    };
  }

  async execute(
    toolName: string,
    params: unknown,
    context: Record<string, unknown> = {}
  ): Promise<Record<string, unknown>> {
    const toolEntry = this.tools.get(toolName);

    if (!toolEntry) {
      aiLogger.error('MCP', `Execution failed: Unknown tool ${toolName}`);
      return { status: 'ERROR', error: `Unknown tool: ${toolName}` };
    }

    try {
      const validated = toolEntry.parameters.parse(params);

      if (toolEntry.type === TOOL_TYPE.MUTATION) {
        aiLogger.tool(toolName, 'REQUIRES_APPROVAL', { params: validated });
        return {
          status: 'REQUIRES_APPROVAL',
          toolName,
          params: validated,
          message: 'This action requires your approval before execution.',
        };
      }

      if (!toolEntry.handler) {
        aiLogger.error('MCP', `No handler for tool ${toolName}`);
        return { status: 'ERROR', error: `No handler registered for tool: ${toolName}` };
      }

      aiLogger.tool(toolName, 'EXECUTING', { params: validated });
      const result = await toolEntry.handler(validated, context);
      aiLogger.tool(toolName, 'SUCCESS');

      return {
        status: 'SUCCESS',
        data: result,
      };
    } catch (error: unknown) {
      const err = error as Error;
      aiLogger.error('MCP', `Execution failed for ${toolName}`, err);
      return {
        status: 'ERROR',
        error: err.message,
      };
    }
  }
}

export const mcpServer = new MCPServer();
export default mcpServer;
