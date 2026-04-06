/**
 * AI Tool Definitions for Function Calling (R5)
 *
 * Defines the tools available to the AI during chat conversations.
 * When the AI decides it needs data, it can call these tools autonomously.
 *
 * @version 1.0.0
 */

import logger from '../../utils/Logger.js';

// ==========================================
// TOOL DEFINITIONS (OpenAI Function Calling format)
// ==========================================

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export const AI_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_web',
      description:
        'Search the web for current information about a topic. Use when the user asks about external data, market trends, competitors, or information not in the organization context.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Search query — be specific and include relevant context (industry, region, year)',
          },
          max_results: {
            type: 'number',
            description: 'Maximum results to return (1-10, default 5)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_knowledge_base',
      description:
        "Search the organization's internal knowledge base (uploaded documents, reports, policies). Use when user asks about internal data or when you need to verify claims against organizational documents.",
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for internal documents',
          },
          document_type: {
            type: 'string',
            enum: ['all', 'policy', 'report', 'procedure', 'strategy'],
            description: 'Filter by document type',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_assessment_data',
      description:
        'Retrieve digital maturity assessment scores for the current project. Use when discussing maturity gaps, benchmarks, or improvement areas.',
      parameters: {
        type: 'object',
        properties: {
          axis: {
            type: 'string',
            description:
              'Specific DRD axis to query (e.g., "cybersecurity", "data_analytics"). Leave empty for all axes.',
          },
          include_benchmarks: {
            type: 'boolean',
            description: 'Whether to include industry benchmarks alongside scores',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_financial',
      description:
        'Calculate financial metrics for initiatives. Use when discussing ROI, NPV, IRR, payback period, or comparing investment scenarios.',
      parameters: {
        type: 'object',
        properties: {
          calculation_type: {
            type: 'string',
            enum: ['roi', 'npv', 'irr', 'payback', 'scenario_comparison'],
            description: 'Type of financial calculation',
          },
          initiative_id: {
            type: 'string',
            description:
              'ID of the initiative to calculate for (optional — uses current context if not provided)',
          },
          parameters: {
            type: 'object',
            description:
              'Calculation parameters (investment, revenue, discount_rate, period_months)',
            properties: {
              investment: { type: 'number' },
              annual_benefit: { type: 'number' },
              discount_rate: { type: 'number' },
              period_months: { type: 'number' },
            },
          },
        },
        required: ['calculation_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_monte_carlo',
      description:
        'Run a Monte Carlo simulation to forecast ROI under uncertainty. Use when the user asks about risk-adjusted ROI, probability of success, scenario modeling, or "what are the chances" of an investment succeeding.',
      parameters: {
        type: 'object',
        properties: {
          base_roi: {
            type: 'number',
            description: 'Expected base ROI in percent (e.g. 150 for 150% ROI)',
          },
          capex: {
            type: 'number',
            description: 'Capital expenditure (one-time investment) in monetary units',
          },
          opex: {
            type: 'number',
            description: 'Annual operational expenditure',
          },
          uncertainty: {
            type: 'number',
            description: 'Uncertainty band (0.1 = ±10%, 0.3 = ±30%). Default 0.3',
          },
          iterations: {
            type: 'number',
            description: 'Number of Monte Carlo iterations. Default 10000',
          },
        },
        required: ['base_roi', 'capex'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_initiative_status',
      description:
        'Get current status, progress, and details of a specific initiative or all initiatives in the project.',
      parameters: {
        type: 'object',
        properties: {
          initiative_id: {
            type: 'string',
            description: 'Specific initiative ID. Leave empty to get summary of all.',
          },
          include_tasks: {
            type: 'boolean',
            description: 'Whether to include task breakdown',
          },
          include_risks: {
            type: 'boolean',
            description: 'Whether to include risk register',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_benchmarks',
      description:
        "Compare organization's metrics against industry benchmarks. Use when the user wants to know how they compare to peers.",
      parameters: {
        type: 'object',
        properties: {
          industry: {
            type: 'string',
            description:
              'Industry to benchmark against (e.g., "manufacturing", "financial_services", "retail")',
          },
          metric_type: {
            type: 'string',
            enum: ['maturity', 'financial', 'operational', 'technology'],
            description: 'Type of benchmark comparison',
          },
        },
        required: ['industry'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_similar_decisions',
      description:
        "Search the organization's decision history for similar past decisions and their outcomes. Use when the user faces a decision that resembles something done before.",
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'Description of the current decision or problem',
          },
          decision_type: {
            type: 'string',
            enum: ['technology', 'vendor', 'process', 'investment', 'organizational', 'strategic'],
            description: 'Type of decision',
          },
        },
        required: ['description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_stakeholder_analysis',
      description:
        'Run multi-stakeholder analysis on a topic from different executive perspectives (CFO, CTO, COO, CMO, CHRO, CEO). Use for strategic decisions needing broad executive buy-in.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'Topic or proposal to analyze from multiple stakeholder perspectives',
          },
          stakeholders: {
            type: 'array',
            items: { type: 'string', enum: ['CFO', 'CTO', 'COO', 'CMO', 'CHRO', 'CEO'] },
            description: 'Which stakeholder perspectives to include (default: all)',
          },
        },
        required: ['topic'],
      },
    },
  },
];

// ==========================================
// TOOL EXECUTOR
// ==========================================

export interface ToolExecutionContext {
  userId: string;
  organizationId: string;
  projectId?: string;
}

/**
 * Execute a tool call made by the AI.
 * Returns the result as a string to be fed back into the conversation.
 */
export async function executeToolCall(
  toolName: string,
  args: Record<string, any>,
  context: ToolExecutionContext
): Promise<string> {
  logger.info(`[ToolExecutor] Executing tool: ${toolName}`, {
    args: JSON.stringify(args).slice(0, 200),
  });

  try {
    switch (toolName) {
      case 'search_web':
        return await executeWebSearch(args, context);
      case 'search_knowledge_base':
        return await executeKBSearch(args, context);
      case 'get_assessment_data':
        return await executeGetAssessment(args, context);
      case 'calculate_financial':
        return await executeFinancialCalc(args, context);
      case 'run_monte_carlo':
        return await executeMonteCarloTool(args);
      case 'get_initiative_status':
        return await executeGetInitiativeStatus(args, context);
      case 'compare_benchmarks':
        return await executeCompareBenchmarks(args, context);
      case 'find_similar_decisions':
        return await executeFindDecisions(args, context);
      case 'get_stakeholder_analysis':
        return await executeStakeholderAnalysis(args, context);
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (err: any) {
    logger.error(`[ToolExecutor] Error executing ${toolName}: ${err.message}`);
    return JSON.stringify({ error: err.message });
  }
}

// ==========================================
// TOOL IMPLEMENTATIONS
// ==========================================

async function executeWebSearch(args: any, ctx: ToolExecutionContext): Promise<string> {
  try {
    const orgId = ctx.organizationId;
    if (!orgId) {
      return JSON.stringify({
        source: 'web_search',
        error: 'Web search unavailable: missing organization context',
      });
    }

    const govMod = (await import('./webSearchGovernance.js')) as any;
    const getEffectiveWebSearchPolicy =
      govMod.getEffectiveWebSearchPolicy || govMod.default?.getEffectiveWebSearchPolicy;
    const sanitizeQuery = govMod.sanitizeQuery || govMod.default?.sanitizeQuery;
    const filterResults = govMod.filterResults || govMod.default?.filterResults;
    const getCached = govMod.getCached || govMod.default?.getCached;
    const setCache = govMod.setCache || govMod.default?.setCache;

    const policy =
      typeof getEffectiveWebSearchPolicy === 'function'
        ? await getEffectiveWebSearchPolicy(orgId, ctx.projectId || undefined)
        : { internetEnabled: false, reason: 'Policy engine unavailable' };

    if (!policy?.internetEnabled) {
      return JSON.stringify({
        source: 'web_search',
        error: policy?.reason || 'Internet disabled by policy',
      });
    }

    const { RuntimeWebSearchService } = await import('./runtimeWebSearchService.js');
    const webSearch = new RuntimeWebSearchService();
    const cleanQuery =
      typeof sanitizeQuery === 'function' ? sanitizeQuery(String(args.query || '')) : args.query;

    const cached =
      typeof getCached === 'function' ? getCached(orgId, cleanQuery, (ctx as any)?.language) : null;
    const results =
      cached ||
      (await webSearch.search(cleanQuery, {
        maxResults: Math.min(args.max_results || 5, policy.maxCitations || 8),
        searchDepth: 'basic',
        language: (ctx as any)?.language,
      }));
    const rawResults = Array.isArray((results as any)?.results) ? (results as any).results : [];
    const filtered =
      typeof filterResults === 'function' ? filterResults(rawResults, policy) : rawResults;
    const out = { ...(results as any), query: cleanQuery, results: filtered };

    if (!cached && typeof setCache === 'function') {
      try {
        setCache(orgId, cleanQuery, out, (ctx as any)?.language);
      } catch {
        // ignore
      }
    }
    return JSON.stringify({
      source: 'web_search',
      query: cleanQuery,
      results: (out as any).results.slice(0, 5).map((r: any) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet?.slice(0, 300),
      })),
      answer: (out as any).answer || null,
    });
  } catch (err: any) {
    return JSON.stringify({
      source: 'web_search',
      error: `Web search unavailable: ${err.message}`,
    });
  }
}

async function executeKBSearch(args: any, ctx: ToolExecutionContext): Promise<string> {
  try {
    const ragMod = await import('../ragService.js');
    const ragService = (ragMod.default || ragMod) as {
      hybridSearch?: (
        query: string,
        opts?: { organizationId?: string; limit?: number }
      ) => Promise<
        Array<{
          content?: string;
          metadata?: { documentTitle?: string; documentId?: string };
          score?: number;
        }>
      >;
    };
    if (!ragService?.hybridSearch) {
      return JSON.stringify({
        source: 'knowledge_base',
        results: [],
        note: 'RAG service not available',
      });
    }
    const results = await ragService.hybridSearch(args.query, {
      organizationId: ctx.organizationId,
      limit: 5,
    });
    return JSON.stringify({
      source: 'knowledge_base',
      query: args.query,
      results: (results || []).slice(0, 5).map((r: any) => ({
        content: r.content?.slice(0, 500),
        documentTitle: r.metadata?.documentTitle || r.documentId,
        score: r.score,
      })),
    });
  } catch (err: any) {
    return JSON.stringify({ source: 'knowledge_base', error: err.message });
  }
}

async function executeGetAssessment(args: any, ctx: ToolExecutionContext): Promise<string> {
  try {
    const { get: dbGet, all: dbAll } = await import('../../utils/DbPromise.js');
    const projectId = ctx.projectId;
    if (!projectId) return JSON.stringify({ source: 'assessment', note: 'No active project' });

    const assessment = (await dbGet(
      `SELECT id, name, framework, status, overall_score, target_score 
       FROM maturity_assessments WHERE project_id = ? ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    )) as any;

    if (!assessment) return JSON.stringify({ source: 'assessment', note: 'No assessment found' });

    const axes = await dbAll(
      `SELECT axis_id, axis_name, current_score, target_score, (target_score - current_score) as gap
       FROM assessment_scores WHERE assessment_id = ? ORDER BY gap DESC`,
      [assessment.id]
    );

    return JSON.stringify({
      source: 'assessment',
      assessment: {
        name: assessment.name,
        framework: assessment.framework,
        overallScore: assessment.overall_score,
        targetScore: assessment.target_score,
      },
      axes: (axes || []).slice(0, 12).map((a: any) => ({
        axis: a.axis_name || a.axis_id,
        current: a.current_score,
        target: a.target_score,
        gap: a.gap,
      })),
    });
  } catch (err: any) {
    return JSON.stringify({ source: 'assessment', error: err.message });
  }
}

async function executeFinancialCalc(args: any, ctx: ToolExecutionContext): Promise<string> {
  const params = args.parameters || {};
  const investment = params.investment || 0;
  const annualBenefit = params.annual_benefit || 0;
  const discountRate = params.discount_rate || 0.1;
  const periodMonths = params.period_months || 36;
  const years = periodMonths / 12;

  const results: any = { source: 'financial_calculation', calculation_type: args.calculation_type };

  switch (args.calculation_type) {
    case 'roi':
      results.roi =
        investment > 0
          ? (((annualBenefit * years - investment) / investment) * 100).toFixed(1) + '%'
          : 'N/A';
      break;
    case 'npv': {
      let npv = -investment;
      for (let y = 1; y <= years; y++) {
        npv += annualBenefit / Math.pow(1 + discountRate, y);
      }
      results.npv = Math.round(npv);
      results.profitable = npv > 0;
      break;
    }
    case 'payback':
      results.paybackMonths =
        annualBenefit > 0 ? Math.ceil(investment / (annualBenefit / 12)) : 'N/A';
      break;
    default:
      results.note = `Calculation type "${args.calculation_type}" — provide investment, annual_benefit, discount_rate, period_months in parameters.`;
  }

  return JSON.stringify(results);
}

async function executeMonteCarloTool(args: any): Promise<string> {
  try {
    const { runMonteCarloROI } = await import('./advancedFeatures.js');
    const result = runMonteCarloROI(
      args.base_roi ?? 100,
      args.capex ?? 100000,
      args.opex ?? 0,
      args.uncertainty ?? 0.3,
      args.iterations ?? 10000
    );
    return JSON.stringify({
      source: 'monte_carlo_simulation',
      iterations: result.iterations,
      mean_roi: result.mean + '%',
      median_roi: result.percentiles.p50 + '%',
      probability_positive_roi: result.probabilityOfPositiveROI + '%',
      standard_deviation: result.standardDeviation,
      scenarios: result.scenarios.map((s: any) => ({
        scenario: s.label,
        roi: s.roi + '%',
      })),
      interpretation:
        result.probabilityOfPositiveROI >= 80
          ? 'High confidence — strong investment case'
          : result.probabilityOfPositiveROI >= 50
            ? 'Moderate risk — further analysis recommended'
            : 'High risk — consider risk mitigation before proceeding',
    });
  } catch (err: any) {
    return JSON.stringify({ error: err.message, source: 'monte_carlo_simulation' });
  }
}

async function executeGetInitiativeStatus(args: any, ctx: ToolExecutionContext): Promise<string> {
  try {
    const { all: dbAll } = await import('../../utils/DbPromise.js');
    const projectId = ctx.projectId;
    if (!projectId) return JSON.stringify({ source: 'initiatives', note: 'No active project' });

    if (args.initiative_id) {
      const initiative = await dbAll(
        `SELECT id, name, status, priority, progress, cost_capex, cost_opex, expected_roi, start_date, end_date
         FROM initiatives WHERE id = ? AND project_id = ?`,
        [args.initiative_id, projectId]
      );
      return JSON.stringify({ source: 'initiatives', data: initiative });
    }

    const initiatives = await dbAll(
      `SELECT id, name, status, priority, progress, cost_capex, expected_roi
       FROM initiatives WHERE project_id = ? ORDER BY priority DESC, created_at DESC LIMIT 20`,
      [projectId]
    );

    return JSON.stringify({
      source: 'initiatives',
      total: (initiatives || []).length,
      summary: (initiatives || []).map((i: any) => ({
        name: i.name,
        status: i.status,
        priority: i.priority,
        progress: i.progress,
        roi: i.expected_roi,
      })),
    });
  } catch (err: any) {
    return JSON.stringify({ source: 'initiatives', error: err.message });
  }
}

async function executeCompareBenchmarks(args: any, ctx: ToolExecutionContext): Promise<string> {
  try {
    const benchmarkMod = await import('./industryBenchmarkService.js');
    const benchmarkService = (benchmarkMod.default || benchmarkMod) as {
      getBenchmarks?: (industry: string, metricType?: string) => unknown[];
    };
    if (benchmarkService?.getBenchmarks) {
      const benchmarks = await benchmarkService.getBenchmarks(args.industry, args.metric_type);
      return JSON.stringify({ source: 'benchmarks', industry: args.industry, data: benchmarks });
    }
    return JSON.stringify({ source: 'benchmarks', note: 'Benchmark service not available' });
  } catch {
    return JSON.stringify({
      source: 'benchmarks',
      note: 'Industry benchmarks not configured for this deployment',
    });
  }
}

async function executeFindDecisions(args: any, ctx: ToolExecutionContext): Promise<string> {
  try {
    const decisionMod = await import('./decisionMemoryService.js');
    if (decisionMod?.findSimilarDecisions) {
      const similar = await decisionMod.findSimilarDecisions({
        organizationId: ctx.organizationId,
        query: args.description,
        limit: 3,
      });
      return JSON.stringify({
        source: 'decision_memory',
        similar_decisions: (similar || []).map((d: any) => ({
          problem: d.summary || d.problem,
          chosen: d.chosenOption,
          outcome: d.outcome,
          confidence: d.confidence,
          date: d.createdAt,
        })),
      });
    }
    return JSON.stringify({ source: 'decision_memory', similar_decisions: [] });
  } catch (err: any) {
    return JSON.stringify({ source: 'decision_memory', error: err.message });
  }
}

async function executeStakeholderAnalysis(args: any, ctx: ToolExecutionContext): Promise<string> {
  try {
    const stakeholderMod = (await import('./multiStakeholderService.js')) as any;
    const analyzeFromMultiplePerspectives =
      stakeholderMod.analyzeFromMultiplePerspectives ||
      stakeholderMod.default?.analyzeFromMultiplePerspectives;
    if (analyzeFromMultiplePerspectives) {
      const analysis = await analyzeFromMultiplePerspectives(
        args.topic,
        args.stakeholders || ['CFO', 'CTO', 'COO'],
        ctx.organizationId
      );
      return JSON.stringify({ source: 'stakeholder_analysis', topic: args.topic, analysis });
    }
    return JSON.stringify({
      source: 'stakeholder_analysis',
      note: 'Multi-stakeholder service not available',
    });
  } catch (err: any) {
    return JSON.stringify({ source: 'stakeholder_analysis', error: err.message });
  }
}

/**
 * Get tool definitions filtered by context (e.g., don't offer web search if no Tavily key).
 */
export function getAvailableTools(options?: {
  hasWebSearch?: boolean;
  hasRAG?: boolean;
}): ToolDefinition[] {
  let tools = [...AI_TOOLS];

  if (!options?.hasWebSearch) {
    tools = tools.filter((t) => t.function.name !== 'search_web');
  }

  if (!options?.hasRAG) {
    tools = tools.filter((t) => t.function.name !== 'search_knowledge_base');
  }

  return tools;
}
