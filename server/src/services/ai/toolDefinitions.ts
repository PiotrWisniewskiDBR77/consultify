/**
 * AI Tool Definitions for Function Calling (R5)
 *
 * Defines the tools available to the AI during chat conversations.
 * When the AI decides it needs data, it can call these tools autonomously.
 *
 * @version 1.0.0
 */

import logger from '../../utils/Logger.js';
import { evaluateRetrievalPolicyDecision } from './chatPolicyGateway.js';

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
          // AGT-008 — klocek "Vault-kontekst" (AgentPlanCanvas.tsx): gdy podane,
          // retrieval jest ograniczony do JEDNEGO poziomu sejfu Vault (VLT-001)
          // zamiast domyślnego widoku łączonego. Egzekwowane w executeKBSearch
          // przez tę samą regułę dostępu co GET /api/knowledge/vault-safes.
          vault_scope: {
            type: 'string',
            enum: ['user', 'organization', 'project'],
            description:
              'Optional Vault level restriction (agent-plan "Vault-kontekst" block): "user" restricts to the caller\'s own private safe, "organization" to the shared org safe, "project" to one project safe. When set, retrieval never crosses into another safe\'s documents.',
          },
          vault_project_id: {
            type: 'string',
            description:
              'Project id for vault_scope="project". When omitted, falls back to the projects the caller is a member of.',
          },
          // ★ VLT-FOLDERS — drugi, opcjonalny select klocka "Vault-kontekst":
          // folder WEWNĄTRZ wybranego sejfu. Gdy podane, `executeKBSearch`
          // wyprowadza poziom/projekt AUTORYTATYWNIE z rekordu folderu (nie z
          // `vault_scope`/`vault_project_id` powyżej — te są tylko podpowiedzią
          // UI), więc niespójny/spreparowany `vault_scope` nie rozszerza
          // dostępu. Fail-closed: folder niewidoczny dla wołającego lub
          // nieistniejący → pusty wynik, tak jak pusty sejf.
          vault_folder_id: {
            type: 'string',
            description:
              'Optional Vault folder id (agent-plan "Vault-kontekst" block, second selector). Narrows retrieval to documents filed in this ONE folder inside the selected safe. The folder\'s own level/project — not the vault_scope/vault_project_id above — determines which safe is queried.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_enterprise_connectors',
      description:
        'List enterprise connectors available to this organization with health, freshness and ACL state. Read-only.',
      parameters: {
        type: 'object',
        properties: {
          project_id: {
            type: 'string',
            description: 'Optional project id to apply project-level connector ACL filtering.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_enterprise_connector',
      description:
        'Search an approved enterprise connector through the Wave 7 governed connector runtime. Read/search only; write actions require separate AIRun approval.',
      parameters: {
        type: 'object',
        properties: {
          connector_id: {
            type: 'string',
            description: 'Wave 7 connector id returned by list_enterprise_connectors.',
          },
          query: {
            type: 'string',
            description: 'Query to filter records from the connector source.',
          },
          project_id: {
            type: 'string',
            description: 'Optional project id for ACL enforcement.',
          },
        },
        required: ['connector_id', 'query'],
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
  {
    type: 'function',
    function: {
      name: 'create_initiative_draft',
      description:
        'Create a draft initiative proposal for user review. Does NOT save to database — returns a structured proposal that the user must approve before it becomes an initiative.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Initiative title' },
          description: { type: 'string', description: 'Detailed description of the initiative' },
          category: {
            type: 'string',
            enum: ['technology', 'process', 'organizational', 'strategic', 'financial'],
          },
          estimated_roi: { type: 'number', description: 'Estimated ROI percentage' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          timeline_weeks: { type: 'number', description: 'Estimated timeline in weeks' },
        },
        required: ['title', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_report_section',
      description:
        'Generate a structured report section with data, analysis, and recommendations. Returns formatted content ready for inclusion in a report document.',
      parameters: {
        type: 'object',
        properties: {
          section_title: { type: 'string', description: 'Title of the report section' },
          section_type: {
            type: 'string',
            enum: [
              'executive_summary',
              'analysis',
              'recommendations',
              'financial',
              'risk',
              'appendix',
            ],
          },
          data_sources: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Data sources to draw from (e.g., "assessment", "financials", "initiatives")',
          },
          format: {
            type: 'string',
            enum: ['narrative', 'table', 'bullet_points', 'mixed'],
            description: 'Output format preference',
          },
        },
        required: ['section_title', 'section_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'schedule_meeting',
      description:
        'Propose scheduling a meeting. Creates a meeting proposal for user approval — does NOT directly create a calendar event.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Meeting title' },
          description: { type: 'string', description: 'Meeting agenda and objectives' },
          duration_minutes: { type: 'number', description: 'Meeting duration in minutes' },
          suggested_attendees: {
            type: 'array',
            items: { type: 'string' },
            description: 'Suggested attendee roles or names',
          },
          urgency: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['title', 'duration_minutes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_notebook_entry',
      description:
        'Propose creating a notebook entry with insights, notes, or action items. Returns the entry for user approval before saving to the Notebook module.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Entry title' },
          content: { type: 'string', description: 'Entry content in markdown format' },
          entry_type: {
            type: 'string',
            enum: ['insight', 'action_item', 'meeting_note', 'decision', 'research'],
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags for categorization',
          },
        },
        required: ['title', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_structured_data',
      description:
        'Query structured organizational data using natural language. Translates the query into SQL, executes against read-only database views, and returns formatted results. Use for questions like "which initiatives have ROI > 200%?" or "show me budget allocation by department".',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'Natural language question about organizational data',
          },
          data_domain: {
            type: 'string',
            enum: ['initiatives', 'assessments', 'financials', 'tasks', 'decisions', 'kpis'],
            description: 'Data domain to query',
          },
          limit: { type: 'number', description: 'Maximum rows to return (default 25)' },
        },
        required: ['question'],
      },
    },
  },
  // -------------------------------------------------------------------------
  // Teresa last-mile (backlog #6): direct My Work writes (Tasks / Decisions).
  // 2026-07-26 (decyzja właściciela, Harvey benchmark — agent proponuje,
  // człowiek zatwierdza): all three are now in `SIDE_EFFECT_TOOLS`
  // (sideEffectTools.ts), so when called through a plan
  // (agentPlannerService.createPlan/executePlan) they PAUSE at
  // `awaiting_approval` instead of writing immediately — same gate as
  // create_initiative_draft/schedule_meeting/create_notebook_entry. The
  // hard-coded /task and /decision slash commands are a SEPARATE path and are
  // unaffected (still instant — no model call involved).
  // -------------------------------------------------------------------------
  {
    type: 'function',
    function: {
      name: 'create_task',
      description:
        "Propose a real task in the user's My Work. Use when the user asks you to add/create a task, action item, or to-do. Requires the user's approval before it is created.",
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short task title' },
          description: { type: 'string', description: 'Optional details' },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Task priority (default medium)',
          },
          due_date: {
            type: 'string',
            description:
              'Optional ISO date (YYYY-MM-DD), STRICTLY in the future relative to today. ' +
              "Never invent a date before today's date. Omit this field entirely if the user " +
              'did not state or imply a deadline — the system will assign a sane default from priority.',
          },
          assignee_id: {
            type: 'string',
            description: 'Optional assignee user id; defaults to self',
          },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description:
        "Propose an update to an existing task (status, title, priority, or due date). Use when the user asks to change/complete/reprioritize a task. Requires the user's approval before the change is applied.",
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'The id of the task to update' },
          status: {
            type: 'string',
            enum: ['todo', 'in_progress', 'done', 'blocked'],
            description: 'New status',
          },
          title: { type: 'string', description: 'New title' },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'New priority',
          },
          due_date: { type: 'string', description: 'New due date (ISO)' },
        },
        required: ['task_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_decision',
      description:
        "Propose a real decision record in the user's My Work. Use when the user asks to log/track a decision to be made. Requires the user's approval before it is created.",
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The decision to be made' },
          description: { type: 'string', description: 'Optional context / options' },
        },
        required: ['title'],
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
  sessionId?: string;
  conversationId?: string;
  contextSnapshotId?: string;
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
      case 'list_enterprise_connectors':
        return await executeListEnterpriseConnectors(args, context);
      case 'search_enterprise_connector':
        return await executeSearchEnterpriseConnector(args, context);
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
      case 'create_initiative_draft':
        return JSON.stringify(
          await (
            await import('../v8/teresaToolOperatorService.js')
          ).proposeInitiativeDraftOperator({
            organizationId: context.organizationId,
            userId: context.userId,
            sessionId:
              context.sessionId || context.conversationId || `initiative-tool-${context.userId}`,
            conversationId: context.conversationId || context.sessionId || null,
            contextSnapshotId: context.contextSnapshotId || null,
            sourceSurface: 'agent',
            title: String(args.title || ''),
            description: String(args.description || ''),
            category: args.category || null,
            estimatedRoi:
              typeof args.estimated_roi === 'number' ? Number(args.estimated_roi) : undefined,
            priority: args.priority || null,
            timelineWeeks:
              typeof args.timeline_weeks === 'number' ? Number(args.timeline_weeks) : undefined,
          })
        );
      case 'generate_report_section':
        return JSON.stringify({
          type: 'content',
          action: 'report_section',
          section: {
            title: args.section_title,
            type: args.section_type,
            format: args.format || 'mixed',
            dataSources: args.data_sources || [],
          },
          message: `Report section "${args.section_title}" generated.`,
        });
      case 'schedule_meeting':
        return JSON.stringify({
          type: 'proposal',
          action: 'schedule_meeting',
          requiresApproval: true,
          meeting: {
            title: args.title,
            description: args.description || '',
            durationMinutes: args.duration_minutes,
            suggestedAttendees: args.suggested_attendees || [],
            urgency: args.urgency || 'medium',
          },
          message: `Meeting "${args.title}" proposed. Approve to schedule.`,
        });
      case 'create_notebook_entry':
        return JSON.stringify(
          await (
            await import('../v8/teresaToolOperatorService.js')
          ).proposeNotebookEntryOperator({
            organizationId: context.organizationId,
            userId: context.userId,
            sessionId:
              context.sessionId || context.conversationId || `notebook-tool-${context.userId}`,
            conversationId: context.conversationId || context.sessionId || null,
            contextSnapshotId: context.contextSnapshotId || null,
            sourceSurface: 'agent',
            title: String(args.title || ''),
            content: String(args.content || ''),
            entryType: args.entry_type || null,
            tags: Array.isArray(args.tags) ? args.tags.map((tag: unknown) => String(tag)) : [],
          })
        );
      case 'query_structured_data': {
        try {
          const result = await (
            await import('../v8/teresaToolOperatorService.js')
          ).runStructuredQueryOperator({
            question: args.question,
            organizationId: context.organizationId,
            userId: context.userId,
            sessionId:
              context.sessionId || context.conversationId || `tables-tool-${context.userId}`,
            conversationId: context.conversationId || context.sessionId || null,
            contextSnapshotId: context.contextSnapshotId || null,
            dataDomain: args.data_domain,
            limit: args.limit || 25,
          });
          return JSON.stringify(result);
        } catch (err: any) {
          return JSON.stringify({ error: `Text-to-SQL query failed: ${err?.message}` });
        }
      }
      case 'wait_until':
        // Odczekaj (pauza, Fala 1 2026-07-26) — no-op. Rzeczywiste czekanie już
        // się odbyło jako czas między pauzą kroku (`awaiting_approval`,
        // agentPlannerService.executePlan) a auto-zdjęciem bramki przez cron
        // (`resumeWaitStep`, gdy `toolInput.resumeAt` minie). Ten case istnieje
        // WYŁĄCZNIE po to, żeby krok miał wynik zamiast trafić w `default`
        // ("Unknown tool") po wznowieniu.
        return JSON.stringify({ type: 'info', action: 'wait_until', message: 'Pauza zakończona.' });
      case 'create_task':
        return await executeCreateTask(args, context);
      case 'update_task':
        return await executeUpdateTask(args, context);
      case 'create_decision':
        return await executeCreateDecision(args, context);
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (err: any) {
    logger.error(`[ToolExecutor] Error executing ${toolName}: ${err.message}`);
    return JSON.stringify({ error: err.message });
  }
}

// ==========================================
// Teresa My Work writers (backlog #6) — real, column-defensive, Postgres-safe.
// ==========================================

async function executeCreateTask(args: any, ctx: ToolExecutionContext): Promise<string> {
  const { default: TaskExecutor } = await import('../../ai/actionExecutors/taskExecutor.js');
  const result = await TaskExecutor.execute(
    {
      title: args.title,
      description: args.description,
      priority: args.priority,
      due_date: args.due_date,
      assignee_id: args.assignee_id,
    },
    { userId: ctx.userId, organizationId: ctx.organizationId }
  );
  return JSON.stringify(
    result.success
      ? { type: 'created', entity: 'task', ...(result.result as object) }
      : { error: result.error || 'Failed to create task' }
  );
}

async function executeUpdateTask(args: any, ctx: ToolExecutionContext): Promise<string> {
  const taskId = String(args.task_id || '').trim();
  if (!taskId) return JSON.stringify({ error: 'task_id is required' });
  const { getTableColumns } = await import('../../utils/dbSchema.js');
  const queryHelpers = await import('../../utils/queryHelpers.js');
  const cols = await getTableColumns('tasks');
  const sets: string[] = [];
  const params: any[] = [];
  const set = (col: string, val: any) => {
    if (!cols.has(col) || val === undefined) return;
    sets.push(`${col} = ?`);
    params.push(val);
  };
  set('status', args.status);
  set('title', args.title ? String(args.title).slice(0, 500) : undefined);
  set('priority', args.priority);
  set('due_date', args.due_date);
  if (cols.has('updated_at')) sets.push('updated_at = CURRENT_TIMESTAMP');
  if (sets.length === 0) return JSON.stringify({ error: 'No updatable fields provided' });
  params.push(taskId, ctx.organizationId);
  const res = await queryHelpers.queryRun(
    `UPDATE tasks SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`,
    params
  );
  const changed = (res as any)?.changes ?? (res as any)?.rowCount ?? 0;
  return JSON.stringify(
    changed > 0
      ? { type: 'updated', entity: 'task', taskId }
      : { error: 'Task not found or not in your organization' }
  );
}

async function executeCreateDecision(args: any, ctx: ToolExecutionContext): Promise<string> {
  const { v4: uuidv4 } = await import('uuid');
  const { getTableColumns } = await import('../../utils/dbSchema.js');
  const queryHelpers = await import('../../utils/queryHelpers.js');
  const id = uuidv4();
  const cols = await getTableColumns('decisions');
  const insertCols: string[] = ['id'];
  const insertVals: string[] = ['?'];
  const insertParams: any[] = [id];
  const add = (col: string, val: any) => {
    if (!cols.has(col)) return;
    insertCols.push(col);
    insertVals.push('?');
    insertParams.push(val);
  };
  add('organization_id', ctx.organizationId);
  add('title', String(args.title || 'New Decision').slice(0, 500));
  add('description', args.description || null);
  add('status', 'pending');
  add('created_by', ctx.userId);
  add('decision_maker_id', ctx.userId);
  await queryHelpers.queryRun(
    `INSERT INTO decisions (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
    insertParams
  );
  return JSON.stringify({ type: 'created', entity: 'decision', id, title: args.title });
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
    const policyResult = await evaluateRetrievalPolicyDecision({
      consumerClass: 'agent',
      query: args.query,
      organizationId: ctx.organizationId || 'system',
      userId: ctx.userId || 'tool:kb_search',
    });
    logger.info(
      `[executeKBSearch] Policy decision: id=${policyResult.decision.id}, allowed=${policyResult.decision.allowed}, outcome=${policyResult.decision.outcome}`
    );
    if (!policyResult.decision.allowed) {
      return JSON.stringify({
        source: 'knowledge_base',
        results: [],
        note: 'Blocked by policy gateway',
      });
    }
  } catch (policyErr: any) {
    logger.warn(
      `[executeKBSearch] Policy gateway error (fail-closed): ${policyErr?.message || String(policyErr)}`
    );
    return JSON.stringify({
      source: 'knowledge_base',
      results: [],
      note: 'Blocked by policy gateway',
    });
  }

  try {
    const ragMod = await import('../ragService.js');
    const ragService = (ragMod.default || ragMod) as {
      hybridSearch?: (
        query: string,
        opts?: { organizationId?: string; limit?: number; documentIds?: string[] }
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

    // AGT-008 — klocek "Vault-kontekst" (AgentPlanCanvas.tsx) niesie
    // `toolInput.vault_scope` (+ opcjonalnie `vault_project_id`) wybrany przez
    // usera z listy `GET /api/knowledge/vault-safes`. Gdy podane, ograniczamy
    // retrieval do dokumentów TEGO JEDNEGO sejfu przez `documentIds` allow-list
    // — TĄ SAMĄ regułą dostępu co `KnowledgeService.getDocuments` używaną przez
    // tabelę sejfów (scope='user' => WYŁĄCZNIE owner_id === ctx.userId;
    // scope='project' => WYŁĄCZNIE projekty, w których wołający jest członkiem).
    // To jest test izolacji z KRYTERIUM ODBIORU AGT-008: prywatny dokument
    // właściciela wchodzi w JEGO proces, nigdy w cudzy.
    let documentIds: string[] | undefined;
    const vaultScope =
      args?.vault_scope === 'user' ||
      args?.vault_scope === 'organization' ||
      args?.vault_scope === 'project'
        ? (args.vault_scope as 'user' | 'organization' | 'project')
        : undefined;

    // AGT-008-bis — bez `vault_scope` (klocek zostawiony na "wszystko"/domyślnie)
    // `documentIds` zostawało `undefined`, co dla `ragService.hybridSearch`
    // oznacza "cała organizacja" — `appendKnowledgeDocAccessFilter` wyklucza
    // WYŁĄCZNIE dokumenty scope='user' w ogóle (żaden, nawet własne wołającego),
    // ale NIE zawęża dokumentów scope='project' do projektów, w których
    // wołający jest członkiem. To szerszy zakres niż domyślny widok Vault
    // (`KnowledgeService.getDocuments` bez scope: własne prywatne + org/legacy +
    // WYŁĄCZNIE projekty-gdzie-jest-członkiem). Naprawa: gdy brak vault_scope,
    // policz TĘ SAMĄ allow-listę co domyślny widok Vault (memberProjectIds +
    // getDocuments bez scope) i użyj jej jako `documentIds` — fail-closed: pusta
    // lista → pusty wynik, tak jak w gałęzi z jawnym vault_scope poniżej.
    const { default: KnowledgeService } = await import('../KnowledgeService.js');
    let memberProjectIds: string[] = [];
    const explicitProjectId =
      typeof args.vault_project_id === 'string' && args.vault_project_id
        ? args.vault_project_id
        : null;
    const requestedFolderId =
      typeof args.vault_folder_id === 'string' && args.vault_folder_id.trim()
        ? args.vault_folder_id.trim()
        : undefined;
    // `vault_project_id` is model-controlled input, so every project-scoped
    // retrieval must load the caller's memberships, including explicit IDs.
    if (vaultScope === 'project' || !vaultScope || requestedFolderId) {
      const { all: dbAll } = await import('../../utils/DbPromise.js');
      const rows = await dbAll<{ project_id: string }>(
        `SELECT project_id FROM project_members WHERE user_id = ?`,
        [ctx.userId]
      );
      memberProjectIds = (rows || []).map((r: any) => String(r.project_id)).filter(Boolean);
    }

    // ★ VLT-FOLDERS — drugi select klocka "Vault-kontekst" (folder WEWNĄTRZ
    // sejfu). Poziom/projekt idą AUTORYTATYWNIE z rekordu folderu — nie z
    // `vault_scope`/`vault_project_id` powyżej (te są tylko podpowiedzią UI;
    // niespójny/spreparowany `vault_scope` nie może rozszerzyć dostępu ponad to,
    // co pozwala sam folder). Widoczność folderu = TA SAMA reguła co dokumenty:
    // scope='user' wymaga owner_id === wołający, scope='project' wymaga
    // członkostwa, scope='organization' zawsze widoczny. Fail-closed: folder
    // nieistniejący / niewidoczny → pusty wynik, hybridSearch NIE jest wołane
    // (żaden przeciek do pełnego indeksu sejfu).
    let folderId: string | undefined;
    let folderName: string | undefined;
    let effectiveVaultScope = vaultScope;
    let effectiveProjectId = explicitProjectId;
    if (requestedFolderId) {
      const folder = KnowledgeService.getFolderById
        ? await KnowledgeService.getFolderById(ctx.organizationId, requestedFolderId)
        : null;
      const folderVisible =
        !!folder &&
        (folder.scope === 'organization' ||
          (folder.scope === 'user' && String(folder.owner_id || '') === String(ctx.userId || '')) ||
          (folder.scope === 'project' &&
            !!folder.project_id &&
            memberProjectIds.includes(String(folder.project_id))));

      if (!folderVisible) {
        return JSON.stringify({
          source: 'knowledge_base',
          query: args.query,
          results: [],
          note: 'Folder Vault nie istnieje lub jest niewidoczny',
        });
      }
      folderId = folder.id;
      folderName = folder.name;
      effectiveVaultScope = folder.scope;
      effectiveProjectId = folder.scope === 'project' ? folder.project_id || null : null;
    }

    if (
      effectiveVaultScope === 'project' &&
      effectiveProjectId &&
      !memberProjectIds.includes(String(effectiveProjectId))
    ) {
      logger.warn(
        `[executeKBSearch] Rejected vault_project_id outside caller memberships: user=${ctx.userId} project=${effectiveProjectId}`
      );
      return JSON.stringify({
        source: 'knowledge_base',
        query: args.query,
        vaultScope: 'project',
        results: [],
        note: 'Brak dostępu do wskazanego sejfu projektowego',
      });
    }

    if (effectiveVaultScope) {
      const scopedDocs = await KnowledgeService.getDocuments(
        ctx.organizationId,
        ctx.userId,
        undefined,
        { scope: effectiveVaultScope, projectId: effectiveProjectId, memberProjectIds, folderId }
      );
      documentIds = (scopedDocs || []).map((d: any) => String(d.id)).filter(Boolean);

      if (documentIds.length === 0) {
        return JSON.stringify({
          source: 'knowledge_base',
          query: args.query,
          vaultScope: effectiveVaultScope,
          ...(folderName ? { vaultFolder: folderName } : {}),
          results: [],
          note: folderId
            ? 'Brak dokumentów w wybranym folderze Vault'
            : 'Brak dokumentów w wybranym sejfie Vault',
        });
      }
    } else {
      const defaultViewDocs = await KnowledgeService.getDocuments(
        ctx.organizationId,
        ctx.userId,
        undefined,
        { memberProjectIds }
      );
      documentIds = (defaultViewDocs || []).map((d: any) => String(d.id)).filter(Boolean);

      if (documentIds.length === 0) {
        return JSON.stringify({
          source: 'knowledge_base',
          query: args.query,
          results: [],
          note: 'Brak dokumentów w dostępnym zakresie Vault',
        });
      }
    }

    const results = await ragService.hybridSearch(args.query, {
      organizationId: ctx.organizationId,
      limit: 5,
      documentIds,
    });
    return JSON.stringify({
      source: 'knowledge_base',
      query: args.query,
      ...(effectiveVaultScope ? { vaultScope: effectiveVaultScope } : {}),
      ...(folderName ? { vaultFolder: folderName } : {}),
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

async function executeListEnterpriseConnectors(
  args: any,
  ctx: ToolExecutionContext
): Promise<string> {
  try {
    const { listWave7Connectors } = await import('../wave7ConnectorRuntimeService.js');
    const connectors = await listWave7Connectors({
      organizationId: ctx.organizationId,
      projectId: args.project_id || ctx.projectId || null,
    });
    return JSON.stringify({
      source: 'wave7_connectors',
      connectors: connectors.map((connector: any) => ({
        connectorId: connector.connectorId,
        provider: connector.provider,
        displayName: connector.displayName,
        status: connector.status,
        freshnessAgeMinutes: connector.freshnessAgeMinutes,
        failureState: connector.failureState,
        sourceBinding: connector.tenantPolicy?.externalConnectorId ? 'linked' : 'registry_only',
      })),
    });
  } catch (err: any) {
    return JSON.stringify({ source: 'wave7_connectors', error: err.message });
  }
}

async function executeSearchEnterpriseConnector(
  args: any,
  ctx: ToolExecutionContext
): Promise<string> {
  try {
    const { executeWave7ConnectorTool } = await import('../wave7ConnectorRuntimeService.js');
    const result = await executeWave7ConnectorTool({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      connectorId: String(args.connector_id || ''),
      toolName: 'search_enterprise_connector',
      toolKind: 'search',
      query: String(args.query || ''),
      projectId: args.project_id || ctx.projectId || null,
    });
    return JSON.stringify({
      source: 'wave7_connector_search',
      allowed: result.allowed,
      connector: result.connector
        ? {
            connectorId: result.connector.connectorId,
            provider: result.connector.provider,
            status: result.connector.status,
          }
        : null,
      freshnessWarning: result.freshnessWarning,
      sourceTrace: result.sourceTrace,
      results: result.results,
      error: result.run?.error || null,
    });
  } catch (err: any) {
    return JSON.stringify({ source: 'wave7_connector_search', error: err.message });
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
