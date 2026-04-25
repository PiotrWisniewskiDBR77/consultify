import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { executeToolCall } from './ai/toolDefinitions.js';

export type Wave8AgentRisk = 'low' | 'medium' | 'high';
export type Wave8AgentRunStatus =
  | 'planned'
  | 'blocked'
  | 'scheduled'
  | 'running'
  | 'completed'
  | 'failed';

export interface Wave8AgentDefinition {
  agentId: string;
  name: string;
  role:
    | 'research'
    | 'docs'
    | 'reports'
    | 'slides'
    | 'sheets_finance'
    | 'decision'
    | 'execution'
    | 'governance'
    | 'cfo'
    | 'coo'
    | 'ciso'
    | 'consultant';
  purpose: string;
  persona: string;
  allowedTools: string[];
  blockedTools: string[];
  sourceScope: string[];
  outputSchema: Record<string, unknown>;
  approvalPolicy: 'none' | 'tool_scope' | 'airun_required' | 'budget_gate';
  costClass: 'low' | 'medium' | 'high';
  riskLevel: Wave8AgentRisk;
  examples: string[];
}

export interface LaunchWave8AgentInput {
  organizationId: string;
  userId: string;
  agentId: string;
  goal: string;
  projectId?: string | null;
  requestedTools?: string[];
  schedule?: {
    cadence: 'once' | 'daily' | 'weekly';
    nextRunAt?: string | null;
    ownerUserId?: string | null;
  } | null;
  swarm?: {
    enabled: boolean;
    agentIds?: string[];
    approved?: boolean;
    budgetApproved?: boolean;
  } | null;
  approval?: {
    aiRunId?: string | null;
    budgetApproved?: boolean;
  } | null;
  evalRun?: {
    enabled: boolean;
    evaluatorAgentId?: string | null;
    criteria?: string[];
  } | null;
  schedulerContext?: {
    scheduleId?: string | null;
    trigger: 'launch_request' | 'manual_process_due';
  } | null;
}

let schemaReady: Promise<void> | null = null;

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return 'null';
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

const AGENT_DEFINITIONS: Wave8AgentDefinition[] = [
  {
    agentId: 'research-agent',
    name: 'Research Agent',
    role: 'research',
    purpose: 'Plan and run cited research with source transparency.',
    persona: 'Evidence-first researcher. Never invent sources.',
    allowedTools: [
      'search_web',
      'search_knowledge_base',
      'list_enterprise_connectors',
      'search_enterprise_connector',
    ],
    blockedTools: ['create_initiative_draft', 'schedule_meeting'],
    sourceScope: ['web', 'knowledge_base', 'wave7_connectors'],
    outputSchema: { type: 'research_brief', required: ['summary', 'evidence', 'openQuestions'] },
    approvalPolicy: 'tool_scope',
    costClass: 'medium',
    riskLevel: 'medium',
    examples: [
      'Research market benchmark for ERP migration',
      'Find cited risks for a cloud strategy',
    ],
  },
  {
    agentId: 'docs-agent',
    name: 'Docs Agent',
    role: 'docs',
    purpose: 'Draft governed document sections and fill structured templates.',
    persona: 'Precise documentation specialist. Ask for missing fields.',
    allowedTools: ['search_knowledge_base', 'generate_report_section'],
    blockedTools: ['schedule_meeting', 'query_structured_data'],
    sourceScope: ['knowledge_base', 'wave5_artifacts'],
    outputSchema: { type: 'document_draft', required: ['title', 'sections', 'missingFields'] },
    approvalPolicy: 'tool_scope',
    costClass: 'low',
    riskLevel: 'low',
    examples: ['Prepare client memo section', 'Draft implementation note'],
  },
  {
    agentId: 'reports-agent',
    name: 'Reports Agent',
    role: 'reports',
    purpose: 'Produce executive reports with claims, citations and next actions.',
    persona: 'Consulting report writer with board-level clarity.',
    allowedTools: ['search_knowledge_base', 'query_structured_data', 'generate_report_section'],
    blockedTools: ['schedule_meeting'],
    sourceScope: ['knowledge_base', 'structured_data', 'wave5_artifacts'],
    outputSchema: {
      type: 'executive_report',
      required: ['executiveSummary', 'findings', 'recommendations'],
    },
    approvalPolicy: 'tool_scope',
    costClass: 'medium',
    riskLevel: 'medium',
    examples: ['Generate operating model report', 'Summarize initiative portfolio'],
  },
  {
    agentId: 'slides-agent',
    name: 'Slides Agent',
    role: 'slides',
    purpose: 'Turn approved artifacts into board-ready slide outlines.',
    persona: 'Board deck strategist. Keep one message per slide.',
    allowedTools: ['search_knowledge_base', 'generate_report_section'],
    blockedTools: ['query_structured_data', 'schedule_meeting'],
    sourceScope: ['wave5_artifacts', 'knowledge_base'],
    outputSchema: {
      type: 'slide_deck_outline',
      required: ['slides', 'speakerNotes', 'sourceRefs'],
    },
    approvalPolicy: 'tool_scope',
    costClass: 'medium',
    riskLevel: 'medium',
    examples: ['Create board deck outline', 'Convert research into 10 slides'],
  },
  {
    agentId: 'sheets-finance-agent',
    name: 'Sheets / Finance Agent',
    role: 'sheets_finance',
    purpose: 'Build finance tables, ROI logic and KPI reviews.',
    persona: 'CFO-grade analytical modeler. Show assumptions.',
    allowedTools: ['calculate_financial', 'run_monte_carlo', 'query_structured_data'],
    blockedTools: ['schedule_meeting'],
    sourceScope: ['structured_data', 'finance'],
    outputSchema: {
      type: 'financial_model',
      required: ['assumptions', 'scenarios', 'recommendation'],
    },
    approvalPolicy: 'tool_scope',
    costClass: 'medium',
    riskLevel: 'medium',
    examples: ['Build ROI model', 'Run risk-adjusted finance scenario'],
  },
  {
    agentId: 'decision-agent',
    name: 'Decision Agent',
    role: 'decision',
    purpose: 'Compare options, prior decisions and governance tradeoffs.',
    persona: 'Decision facilitator. Make uncertainty explicit.',
    allowedTools: ['find_similar_decisions', 'get_stakeholder_analysis', 'search_knowledge_base'],
    blockedTools: ['schedule_meeting'],
    sourceScope: ['decision_memory', 'knowledge_base'],
    outputSchema: { type: 'decision_brief', required: ['options', 'criteria', 'recommendation'] },
    approvalPolicy: 'tool_scope',
    costClass: 'low',
    riskLevel: 'medium',
    examples: ['Compare vendor options', 'Review strategic decision'],
  },
  {
    agentId: 'execution-agent',
    name: 'Execution Agent',
    role: 'execution',
    purpose: 'Prepare execution plans and governed action proposals.',
    persona: 'Execution manager. No silent mutations.',
    allowedTools: ['get_initiative_status', 'create_initiative_draft', 'create_notebook_entry'],
    blockedTools: ['search_web'],
    sourceScope: ['initiatives', 'notebook'],
    outputSchema: { type: 'execution_plan', required: ['milestones', 'owners', 'approvalItems'] },
    approvalPolicy: 'airun_required',
    costClass: 'medium',
    riskLevel: 'high',
    examples: ['Prepare initiative execution plan', 'Create action proposal backlog'],
  },
  {
    agentId: 'governance-agent',
    name: 'Governance Agent',
    role: 'governance',
    purpose: 'Audit AI outputs, tool use, source trace and policy compliance.',
    persona: 'Strict reviewer. Prefer blocking risky ambiguity.',
    allowedTools: ['search_knowledge_base', 'list_enterprise_connectors'],
    blockedTools: ['create_initiative_draft', 'schedule_meeting', 'query_structured_data'],
    sourceScope: ['audit', 'knowledge_base', 'wave7_connectors'],
    outputSchema: { type: 'audit_review', required: ['findings', 'risks', 'gateDecision'] },
    approvalPolicy: 'budget_gate',
    costClass: 'low',
    riskLevel: 'high',
    examples: ['Audit a report for hallucination', 'Review connector source trace'],
  },
  {
    agentId: 'cfo-agent',
    name: 'CFO Agent',
    role: 'cfo',
    purpose: 'Provide finance-first review of initiatives and ROI.',
    persona: 'CFO perspective. Focus on cash, risk and payback.',
    allowedTools: ['calculate_financial', 'run_monte_carlo', 'query_structured_data'],
    blockedTools: ['schedule_meeting'],
    sourceScope: ['finance', 'kpi', 'initiatives'],
    outputSchema: {
      type: 'financial_model',
      required: ['assumptions', 'scenarios', 'investmentDecision'],
    },
    approvalPolicy: 'tool_scope',
    costClass: 'medium',
    riskLevel: 'medium',
    examples: ['CFO review of portfolio', 'Cash impact scenario'],
  },
  {
    agentId: 'coo-agent',
    name: 'COO Agent',
    role: 'coo',
    purpose: 'Prepare operating plans, owners, cadence and delivery risks.',
    persona: 'COO perspective. Focus on throughput, dependencies and accountability.',
    allowedTools: ['get_initiative_status', 'query_structured_data', 'create_notebook_entry'],
    blockedTools: ['search_web'],
    sourceScope: ['operations', 'initiatives', 'tasks'],
    outputSchema: { type: 'operating_plan', required: ['milestones', 'owners', 'risks'] },
    approvalPolicy: 'tool_scope',
    costClass: 'medium',
    riskLevel: 'medium',
    examples: ['Weekly operating review', 'Delivery plan for transformation backlog'],
  },
  {
    agentId: 'ciso-agent',
    name: 'CISO Agent',
    role: 'ciso',
    purpose: 'Produce security packs and risk controls.',
    persona: 'Security leader. Prioritize confidentiality and control gaps.',
    allowedTools: ['search_knowledge_base', 'list_enterprise_connectors'],
    blockedTools: ['search_web', 'schedule_meeting'],
    sourceScope: ['security', 'knowledge_base', 'audit'],
    outputSchema: { type: 'security_pack', required: ['threats', 'controls', 'residualRisk'] },
    approvalPolicy: 'tool_scope',
    costClass: 'low',
    riskLevel: 'high',
    examples: ['CISO risk pack', 'Security controls review'],
  },
];

function getDefinition(agentId: string): Wave8AgentDefinition | null {
  return AGENT_DEFINITIONS.find((agent) => agent.agentId === agentId) || null;
}

function mapRun(row: any): any {
  if (!row) return null;
  return {
    runId: row.run_id,
    organizationId: row.organization_id,
    agentId: row.agent_id,
    userId: row.user_id,
    projectId: row.project_id || null,
    status: row.status,
    goal: row.goal,
    requestedTools: safeJsonParse(row.requested_tools_json, []),
    output: safeJsonParse(row.output_json, null),
    schemaValid: Boolean(row.schema_valid),
    audit: safeJsonParse(row.audit_json, {}),
    schedule: safeJsonParse(row.schedule_json, null),
    ownerUserId: row.owner_user_id || null,
    createdAt: row.created_at,
    completedAt: row.completed_at || null,
  };
}

export async function ensureWave8AgentRuntimeSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS wave8_agent_runs (
        run_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        project_id TEXT,
        status TEXT NOT NULL,
        goal TEXT NOT NULL,
        requested_tools_json TEXT NOT NULL DEFAULT '[]',
        output_json TEXT NOT NULL DEFAULT '{}',
        schema_valid INTEGER NOT NULL DEFAULT 0,
        audit_json TEXT NOT NULL DEFAULT '{}',
        schedule_json TEXT,
        owner_user_id TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT
      )
    `);
    await dbRun(`
      CREATE TABLE IF NOT EXISTS wave8_agent_notifications (
        notification_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        owner_user_id TEXT NOT NULL,
        notification_type TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(`
      CREATE TABLE IF NOT EXISTS wave8_agent_schedules (
        schedule_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        owner_user_id TEXT NOT NULL,
        cadence TEXT NOT NULL,
        next_run_at TEXT,
        scheduler_mode TEXT NOT NULL DEFAULT 'manual_process_due_endpoint',
        status TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(
      `ALTER TABLE wave8_agent_schedules ADD COLUMN scheduler_mode TEXT DEFAULT 'manual_process_due_endpoint'`
    ).catch(() => undefined);
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_wave8_agent_runs_org ON wave8_agent_runs(organization_id, created_at)`
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_wave8_agent_schedules_org ON wave8_agent_schedules(organization_id, status)`
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_wave8_agent_notifications_org ON wave8_agent_notifications(organization_id, created_at)`
    );
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

export async function listWave8AgentDefinitions(): Promise<Wave8AgentDefinition[]> {
  return AGENT_DEFINITIONS;
}

function validateToolScope(definition: Wave8AgentDefinition, requestedTools: string[]): any {
  const blocked = requestedTools.filter((tool) => definition.blockedTools.includes(tool));
  const outsideScope = requestedTools.filter((tool) => !definition.allowedTools.includes(tool));
  if (blocked.length > 0) return { allowed: false, reason: 'blocked_tool', tools: blocked };
  if (outsideScope.length > 0) {
    return { allowed: false, reason: 'tool_outside_agent_scope', tools: outsideScope };
  }
  return { allowed: true, reason: 'allowed' };
}

function validateSwarmGate(input: LaunchWave8AgentInput): any {
  if (!input.swarm?.enabled) return { allowed: true, reason: 'not_swarm' };
  if (!input.swarm.approved || !input.swarm.budgetApproved) {
    return { allowed: false, reason: 'swarm_requires_approval_and_budget_gate' };
  }
  return { allowed: true, reason: 'swarm_approved' };
}

async function validateApprovedAIRun(params: {
  organizationId: string;
  aiRunId?: string | null;
}): Promise<any> {
  if (!params.aiRunId) return { allowed: false, reason: 'airun_required' };
  const row = await dbGet(
    `SELECT run_id, organization_id, status FROM ai_run_ledger
     WHERE run_id = ? AND organization_id = ?`,
    [params.aiRunId, params.organizationId]
  ).catch(() => null);
  const status = String((row as any)?.status || '').toLowerCase();
  if (!row || !['approved', 'executing'].includes(status)) {
    return { allowed: false, reason: 'airun_not_approved' };
  }
  return { allowed: true, reason: 'approved_airun', aiRunId: params.aiRunId };
}

async function validateApprovalPolicy(
  definition: Wave8AgentDefinition,
  input: LaunchWave8AgentInput
): Promise<any> {
  if (definition.approvalPolicy === 'budget_gate') {
    return input.approval?.budgetApproved === true || input.swarm?.budgetApproved === true
      ? { allowed: true, reason: 'budget_gate_approved' }
      : { allowed: false, reason: 'budget_gate_required' };
  }
  if (definition.approvalPolicy === 'airun_required') {
    if (input.schedule) {
      return { allowed: false, reason: 'airun_schedule_requires_manual_launch' };
    }
    return validateApprovedAIRun({
      organizationId: input.organizationId,
      aiRunId: input.approval?.aiRunId || null,
    });
  }
  return { allowed: true, reason: definition.approvalPolicy };
}

async function recordWave8Notification(input: {
  organizationId: string;
  runId: string;
  ownerUserId: string;
  notificationType: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  await dbRun(
    `INSERT INTO wave8_agent_notifications (
      notification_id, organization_id, run_id, owner_user_id, notification_type, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      `notif8-${uuidv4()}`,
      input.organizationId,
      input.runId,
      input.ownerUserId,
      input.notificationType,
      safeJsonStringify(input.payload),
    ]
  );
}

function buildSchedulerAudit(input: LaunchWave8AgentInput): Record<string, unknown> {
  if (input.schedule) {
    return {
      requested: true,
      status: 'registered',
      schedulerMode: 'manual_process_due_endpoint',
      cronBacked: false,
      trigger: 'launch_request',
      cadence: input.schedule.cadence,
      nextRunAt: input.schedule.nextRunAt || null,
      note: 'Schedule is registered for explicit process-due sweeps; no background cron is implied here.',
    };
  }
  if (input.schedulerContext?.trigger === 'manual_process_due') {
    return {
      requested: false,
      status: 'triggered',
      schedulerMode: 'manual_process_due_endpoint',
      cronBacked: false,
      trigger: 'manual_process_due',
      scheduleId: input.schedulerContext.scheduleId || null,
    };
  }
  return { requested: false, status: 'not_scheduled', trigger: 'direct_launch' };
}

function buildEvalRunHook(input: LaunchWave8AgentInput): Record<string, unknown> {
  if (!input.evalRun?.enabled) {
    return { requested: false, status: 'not_requested' };
  }
  return {
    requested: true,
    status: 'registered',
    mode: 'audit_hook_only',
    evaluatorAgentId: input.evalRun.evaluatorAgentId || 'governance-agent',
    criteria: Array.isArray(input.evalRun.criteria) ? input.evalRun.criteria : [],
    executed: false,
    note: 'Eval hook is recorded for a downstream evaluator; this launch path does not execute an eval run.',
  };
}

function outputForAgent(definition: Wave8AgentDefinition, input: LaunchWave8AgentInput): any {
  const base = {
    agentId: definition.agentId,
    role: definition.role,
    goal: input.goal,
    rolePrompt: definition.persona,
    sourceScope: definition.sourceScope,
  };
  switch (definition.role) {
    case 'cfo':
    case 'sheets_finance':
      return {
        ...base,
        type: 'financial_model',
        assumptions: ['Use current organization data and explicit user-provided numbers only'],
        scenarios: ['base', 'upside', 'downside'],
        investmentDecision: 'requires_review',
        recommendation: 'Review assumptions before committing financial actions.',
      };
    case 'coo':
      return { ...base, type: 'operating_plan', milestones: [], owners: [], risks: [] };
    case 'ciso':
      return {
        ...base,
        type: 'security_pack',
        threats: [],
        controls: [],
        residualRisk: 'review_required',
      };
    case 'governance':
      return {
        ...base,
        type: 'audit_review',
        findings: [],
        risks: [],
        gateDecision: 'review_required',
      };
    case 'slides':
      return { ...base, type: 'slide_deck_outline', slides: [], speakerNotes: [], sourceRefs: [] };
    case 'execution':
      return { ...base, type: 'execution_plan', milestones: [], owners: [], approvalItems: [] };
    case 'decision':
      return {
        ...base,
        type: 'decision_brief',
        options: [],
        criteria: [],
        recommendation: 'review_required',
      };
    case 'reports':
      return {
        ...base,
        type: 'executive_report',
        executiveSummary: '',
        findings: [],
        recommendations: [],
      };
    case 'docs':
      return {
        ...base,
        type: 'document_draft',
        title: input.goal,
        sections: [],
        missingFields: [],
      };
    default:
      return { ...base, type: 'research_brief', summary: '', evidence: [], openQuestions: [] };
  }
}

function validateOutputSchema(definition: Wave8AgentDefinition, output: any): boolean {
  const required = Array.isArray((definition.outputSchema as any).required)
    ? ((definition.outputSchema as any).required as string[])
    : [];
  return required.every((key) => Object.prototype.hasOwnProperty.call(output, key));
}

export async function launchWave8Agent(input: LaunchWave8AgentInput): Promise<any> {
  await ensureWave8AgentRuntimeSchema();
  const definition = getDefinition(input.agentId);
  if (!definition) throw new Error(`Unknown Wave 8 agent: ${input.agentId}`);
  const requestedTools = input.requestedTools || [];
  const toolDecision = validateToolScope(definition, requestedTools);
  const swarmDecision = validateSwarmGate(input);
  const approvalDecision = await validateApprovalPolicy(definition, input);
  const status: Wave8AgentRunStatus =
    toolDecision.allowed && swarmDecision.allowed && approvalDecision.allowed
      ? input.schedule
        ? 'scheduled'
        : 'completed'
      : 'blocked';
  const runId = `agent8-${uuidv4()}`;
  const output = status === 'completed' ? outputForAgent(definition, input) : null;
  const schemaValid = output ? validateOutputSchema(definition, output) : false;
  const schedulerAudit = buildSchedulerAudit(input);
  const evalRunHook = buildEvalRunHook(input);
  const audit = {
    toolDecision,
    swarmDecision,
    approvalDecision,
    scheduler: schedulerAudit,
    evalRunHook,
    approvalPolicy: definition.approvalPolicy,
    costClass: definition.costClass,
    noSilentExecution: true,
    telemetry: {
      launchedAt: nowIso(),
      requestedToolCount: requestedTools.length,
    },
  };
  await dbRun(
    `INSERT INTO wave8_agent_runs (
      run_id, organization_id, agent_id, user_id, project_id, status, goal,
      requested_tools_json, output_json, schema_valid, audit_json, schedule_json,
      owner_user_id, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      runId,
      input.organizationId,
      input.agentId,
      input.userId,
      input.projectId || null,
      status,
      input.goal,
      safeJsonStringify(requestedTools),
      safeJsonStringify(output),
      schemaValid ? 1 : 0,
      safeJsonStringify(audit),
      input.schedule ? safeJsonStringify(input.schedule) : null,
      input.schedule?.ownerUserId || input.userId,
      status === 'completed' || status === 'blocked' ? nowIso() : null,
    ]
  );
  if (status === 'scheduled' && input.schedule) {
    await dbRun(
      `INSERT INTO wave8_agent_schedules (
        schedule_id, organization_id, agent_id, owner_user_id, cadence, next_run_at, scheduler_mode, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `sched8-${uuidv4()}`,
        input.organizationId,
        input.agentId,
        input.schedule.ownerUserId || input.userId,
        input.schedule.cadence,
        input.schedule.nextRunAt || null,
        'manual_process_due_endpoint',
        'active',
      ]
    );
  }
  if (status === 'completed' || status === 'scheduled') {
    await recordWave8Notification({
      organizationId: input.organizationId,
      runId,
      ownerUserId: input.schedule?.ownerUserId || input.userId,
      notificationType: status === 'scheduled' ? 'agent_scheduled' : 'agent_run_completed',
      payload: {
        agentId: input.agentId,
        status,
        schemaValid,
        scheduler: schedulerAudit,
        evalRunHook,
        delivery: {
          channel: 'in_app_audit',
          dispatchMode: 'audit_log_only',
          deliveredExternally: false,
        },
      },
    });
  }
  if (evalRunHook.requested === true) {
    await recordWave8Notification({
      organizationId: input.organizationId,
      runId,
      ownerUserId: input.schedule?.ownerUserId || input.userId,
      notificationType: 'agent_eval_hook_registered',
      payload: {
        agentId: input.agentId,
        evalRunHook,
        delivery: {
          channel: 'in_app_audit',
          dispatchMode: 'audit_log_only',
          deliveredExternally: false,
        },
      },
    });
  }
  const run = mapRun(await dbGet(`SELECT * FROM wave8_agent_runs WHERE run_id = ?`, [runId]));
  return { definition, run, allowed: status !== 'blocked' };
}

export async function executeWave8AgentTool(input: {
  organizationId: string;
  userId: string;
  agentId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  projectId?: string | null;
  runId?: string | null;
  aiRunId?: string | null;
  budgetApproved?: boolean;
}): Promise<any> {
  const definition = getDefinition(input.agentId);
  if (!definition) throw new Error(`Unknown Wave 8 agent: ${input.agentId}`);
  const toolDecision = validateToolScope(definition, [input.toolName]);
  if (!toolDecision.allowed) {
    return { allowed: false, error: toolDecision.reason, toolDecision };
  }
  if (definition.approvalPolicy === 'airun_required') {
    const approvalDecision = await validateApprovedAIRun({
      organizationId: input.organizationId,
      aiRunId: input.aiRunId,
    });
    if (!approvalDecision.allowed) {
      return { allowed: false, error: approvalDecision.reason, toolDecision, approvalDecision };
    }
  }
  if (definition.approvalPolicy === 'budget_gate' && input.budgetApproved !== true) {
    return {
      allowed: false,
      error: 'budget_gate_required',
      toolDecision,
      approvalDecision: { allowed: false, reason: 'budget_gate_required' },
    };
  }
  const result = await executeToolCall(input.toolName, input.toolInput, {
    organizationId: input.organizationId,
    userId: input.userId,
    projectId: input.projectId || undefined,
  });
  return { allowed: true, result, toolDecision };
}

export async function processDueWave8AgentSchedules(params: {
  organizationId: string;
  now?: string;
}): Promise<any[]> {
  await ensureWave8AgentRuntimeSchema();
  const now = params.now || nowIso();
  const rows = await dbAll(
    `SELECT * FROM wave8_agent_schedules
     WHERE organization_id = ? AND status = 'active'
       AND (next_run_at IS NULL OR next_run_at <= ?)
     ORDER BY next_run_at ASC`,
    [params.organizationId, now]
  );
  const processed: any[] = [];
  for (const row of rows || []) {
    const cadence = String(row.cadence || 'weekly') as 'once' | 'daily' | 'weekly';
    const result = await launchWave8Agent({
      organizationId: row.organization_id,
      userId: row.owner_user_id,
      agentId: row.agent_id,
      goal: `Scheduled ${cadence} agent run`,
      requestedTools: [],
      schedule: null,
      approval: { budgetApproved: true },
      schedulerContext: {
        scheduleId: row.schedule_id,
        trigger: 'manual_process_due',
      },
    });
    const nextRunAt =
      cadence === 'daily'
        ? new Date(Date.parse(now) + 24 * 60 * 60 * 1000).toISOString()
        : cadence === 'weekly'
          ? new Date(Date.parse(now) + 7 * 24 * 60 * 60 * 1000).toISOString()
          : null;
    await dbRun(
      `UPDATE wave8_agent_schedules
       SET next_run_at = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE schedule_id = ?`,
      [nextRunAt, cadence === 'once' ? 'completed' : 'active', row.schedule_id]
    ).catch(() => undefined);
    await recordWave8Notification({
      organizationId: row.organization_id,
      runId: result.run.runId,
      ownerUserId: row.owner_user_id,
      notificationType: 'agent_schedule_processed',
      payload: {
        scheduleId: row.schedule_id,
        cadence,
        schedulerMode: row.scheduler_mode || 'manual_process_due_endpoint',
        nextRunAt,
        scheduleStatus: cadence === 'once' ? 'completed' : 'active',
        delivery: {
          channel: 'in_app_audit',
          dispatchMode: 'audit_log_only',
          deliveredExternally: false,
        },
      },
    });
    processed.push(result.run);
  }
  return processed;
}

export async function listWave8AgentRuns(params: {
  organizationId: string;
  limit?: number;
}): Promise<any[]> {
  await ensureWave8AgentRuntimeSchema();
  const rows = await dbAll(
    `SELECT * FROM wave8_agent_runs WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?`,
    [params.organizationId, params.limit || 50]
  );
  return (rows || []).map(mapRun);
}

export async function listWave8AgentSchedules(params: { organizationId: string }): Promise<any[]> {
  await ensureWave8AgentRuntimeSchema();
  const rows = await dbAll(
    `SELECT * FROM wave8_agent_schedules WHERE organization_id = ? ORDER BY created_at DESC`,
    [params.organizationId]
  );
  return (rows || []).map((row: any) => ({
    scheduleId: row.schedule_id,
    organizationId: row.organization_id,
    agentId: row.agent_id,
    ownerUserId: row.owner_user_id,
    cadence: row.cadence,
    nextRunAt: row.next_run_at || null,
    schedulerMode: row.scheduler_mode || 'manual_process_due_endpoint',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at || null,
  }));
}

export async function listWave8AgentNotifications(params: {
  organizationId: string;
  limit?: number;
}): Promise<any[]> {
  await ensureWave8AgentRuntimeSchema();
  const rows = await dbAll(
    `SELECT * FROM wave8_agent_notifications
     WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?`,
    [params.organizationId, params.limit || 50]
  );
  return (rows || []).map((row: any) => ({
    notificationId: row.notification_id,
    organizationId: row.organization_id,
    runId: row.run_id,
    ownerUserId: row.owner_user_id,
    notificationType: row.notification_type,
    payload: safeJsonParse(row.payload_json, {}),
    createdAt: row.created_at,
  }));
}
