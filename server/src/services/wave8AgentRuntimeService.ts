import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { executeToolCall } from './ai/toolDefinitions.js';
import { authorizeAgentToolExecution } from './v8/agentToolExecutionGovernanceService.js';
import {
  executeWithAgentResourceReservation,
} from './v8/agentResourceGovernanceService.js';
import { projectCanonicalRunAfterExternalTransition } from './v8/agentCanonicalRunService.js';
import { revalidateCanonicalRunContextForWorker } from './v8/agentContextGroundingService.js';

export type Wave8AgentRisk = 'low' | 'medium' | 'high';
export type Wave8AgentRunStatus =
  'planned' | 'blocked' | 'scheduled' | 'running' | 'completed' | 'failed';

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
  editable?: boolean;
  source?: 'code' | 'database';
  updatedBy?: string | null;
}

type Wave8AgentDefinitionListItem = Wave8AgentDefinition & {
  editable: boolean;
  source: 'code' | 'database';
  updatedBy: string | null;
};

export interface LaunchWave8AgentInput {
  organizationId: string;
  userId: string;
  /** Canonical transformation run owning this bounded agent execution. */
  canonicalRunId?: string | null;
  agentId: string;
  goal: string;
  projectId?: string | null;
  requestedTools?: string[];
  schedule?: {
    cadence: 'once' | 'daily' | 'weekly';
    nextRunAt?: string | null;
    ownerUserId?: string | null;
    timezone?: string | null;
    timeoutSeconds?: number | null;
    maxAttempts?: number | null;
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
    trigger: 'launch_request' | 'manual_process_due' | 'durable_cron_worker';
  } | null;
}

function deterministicTokenCount(value: unknown): number {
  const text = typeof value === 'string' ? value : safeJsonStringify(value);
  return text.trim()
    ? text
        .trim()
        .split(/\s+|(?=[{}[\],:])/u)
        .filter(Boolean).length
    : 0;
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

type LocalDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function localParts(instant: Date, timezone: string): LocalDateTimeParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const values = Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, part.value])
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function localDateTimeToUtc(parts: LocalDateTimeParts, timezone: string): Date {
  const targetAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  let candidate = targetAsUtc;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const observed = localParts(new Date(candidate), timezone);
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second
    );
    const correction = targetAsUtc - observedAsUtc;
    candidate += correction;
    if (correction === 0) break;
  }
  return new Date(candidate);
}

export function calculateNextScheduleRun(
  afterIso: string,
  cadence: 'once' | 'daily' | 'weekly',
  timezone: string
): string | null {
  if (cadence === 'once') return null;
  const after = new Date(afterIso);
  if (!Number.isFinite(after.getTime())) throw new Error('invalid_schedule_instant');
  let current: LocalDateTimeParts;
  try {
    current = localParts(after, timezone);
  } catch {
    throw new Error('invalid_schedule_timezone');
  }
  const calendar = new Date(
    Date.UTC(
      current.year,
      current.month - 1,
      current.day + (cadence === 'daily' ? 1 : 7),
      current.hour,
      current.minute,
      current.second
    )
  );
  return localDateTimeToUtc(
    {
      year: calendar.getUTCFullYear(),
      month: calendar.getUTCMonth() + 1,
      day: calendar.getUTCDate(),
      hour: current.hour,
      minute: current.minute,
      second: current.second,
    },
    timezone
  ).toISOString();
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

function mapDefinitionRow(row: any): Wave8AgentDefinition | null {
  if (!row) return null;
  return {
    agentId: row.agent_id,
    name: row.name,
    role: row.role,
    purpose: row.purpose,
    persona: row.persona,
    allowedTools: safeJsonParse(row.allowed_tools_json, []),
    blockedTools: safeJsonParse(row.blocked_tools_json, []),
    sourceScope: safeJsonParse(row.source_scope_json, []),
    outputSchema: safeJsonParse(row.output_schema_json, {}),
    approvalPolicy: row.approval_policy,
    costClass: row.cost_class,
    riskLevel: row.risk_level,
    examples: safeJsonParse(row.examples_json, []),
    editable: Boolean(row.editable),
    source: 'database',
    updatedBy: row.updated_by || null,
  };
}

async function getDefinition(
  agentId: string,
  organizationId?: string | null
): Promise<Wave8AgentDefinition | null> {
  const definitions = await listWave8AgentDefinitions({ organizationId });
  return definitions.find((agent) => agent.agentId === agentId) || null;
}

function mapRun(row: any): any {
  if (!row) return null;
  return {
    runId: row.run_id,
    canonicalRunId: row.canonical_run_id || null,
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
    const strictRun = async (sql: string): Promise<void> => {
      const result = await dbRun(sql, [], { fallback: false });
      if (!result.success) throw new Error(result.error || 'wave8_schema_write_failed');
    };
    await strictRun(`
      CREATE TABLE IF NOT EXISTS wave8_agent_definitions (
        agent_id TEXT PRIMARY KEY,
        organization_id TEXT,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        purpose TEXT NOT NULL,
        persona TEXT NOT NULL,
        allowed_tools_json TEXT NOT NULL DEFAULT '[]',
        blocked_tools_json TEXT NOT NULL DEFAULT '[]',
        source_scope_json TEXT NOT NULL DEFAULT '[]',
        output_schema_json TEXT NOT NULL DEFAULT '{}',
        approval_policy TEXT NOT NULL,
        cost_class TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        examples_json TEXT NOT NULL DEFAULT '[]',
        editable INTEGER NOT NULL DEFAULT 1,
        updated_by TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await strictRun(`
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
    await dbRun(
      `ALTER TABLE wave8_agent_runs ADD COLUMN IF NOT EXISTS canonical_run_id TEXT`
    ).catch(() => undefined);
    await strictRun(`
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
    await strictRun(`
      CREATE TABLE IF NOT EXISTS wave8_agent_tool_governance_events (
        event_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        tool_id TEXT,
        tool_name TEXT NOT NULL,
        project_id TEXT,
        run_id TEXT,
        decision TEXT NOT NULL CHECK (decision IN ('allowed', 'denied')),
        reason TEXT NOT NULL,
        policy_ref TEXT,
        input_digest TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await strictRun(`
      CREATE TABLE IF NOT EXISTS wave8_agent_schedules (
        schedule_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        owner_user_id TEXT NOT NULL,
        cadence TEXT NOT NULL,
        goal TEXT NOT NULL DEFAULT '',
        project_id TEXT,
        timezone TEXT NOT NULL DEFAULT 'UTC',
        next_run_at TEXT,
        scheduler_mode TEXT NOT NULL DEFAULT 'durable_cron_worker',
        status TEXT NOT NULL,
        lease_owner TEXT,
        lease_expires_at TEXT,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        mandate_version INTEGER NOT NULL DEFAULT 1,
        mandate_json TEXT NOT NULL DEFAULT '{}',
        timeout_seconds INTEGER NOT NULL DEFAULT 900,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        retry_at TEXT,
        blocked_reason TEXT,
        last_run_at TEXT,
        last_error TEXT,
        cancelled_at TEXT,
        cancelled_by TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(
      `ALTER TABLE wave8_agent_schedules ADD COLUMN IF NOT EXISTS canonical_run_id TEXT`
    ).catch(() => undefined);
    await dbRun(
      `ALTER TABLE wave8_agent_schedules ADD COLUMN IF NOT EXISTS scheduler_mode TEXT DEFAULT 'durable_cron_worker'`
    ).catch(() => undefined);
    for (const column of [
      "goal TEXT NOT NULL DEFAULT ''",
      'project_id TEXT',
      "timezone TEXT NOT NULL DEFAULT 'UTC'",
      'lease_owner TEXT',
      'lease_expires_at TEXT',
      'attempt_count INTEGER NOT NULL DEFAULT 0',
      'mandate_version INTEGER NOT NULL DEFAULT 1',
      "mandate_json TEXT NOT NULL DEFAULT '{}'",
      'timeout_seconds INTEGER NOT NULL DEFAULT 900',
      'max_attempts INTEGER NOT NULL DEFAULT 3',
      'retry_at TEXT',
      'blocked_reason TEXT',
      'last_run_at TEXT',
      'last_error TEXT',
      'cancelled_at TEXT',
      'cancelled_by TEXT',
    ]) {
      await dbRun(`ALTER TABLE wave8_agent_schedules ADD COLUMN IF NOT EXISTS ${column}`).catch(
        () => undefined
      );
    }
    await strictRun(
      `CREATE INDEX IF NOT EXISTS idx_wave8_agent_definitions_org ON wave8_agent_definitions(organization_id, role)`
    );
    await strictRun(
      `CREATE INDEX IF NOT EXISTS idx_wave8_agent_runs_org ON wave8_agent_runs(organization_id, created_at)`
    );
    await strictRun(
      `CREATE INDEX IF NOT EXISTS idx_wave8_agent_schedules_org ON wave8_agent_schedules(organization_id, status)`
    );
    await strictRun(
      `CREATE INDEX IF NOT EXISTS idx_wave8_tool_governance_run ON wave8_agent_tool_governance_events(organization_id, run_id, tool_name, created_at)`
    );
    await strictRun(
      `CREATE INDEX IF NOT EXISTS idx_wave8_agent_notifications_org ON wave8_agent_notifications(organization_id, created_at)`
    );
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

export async function listWave8AgentDefinitions(params?: {
  organizationId?: string | null;
}): Promise<Wave8AgentDefinition[]> {
  await ensureWave8AgentRuntimeSchema();
  const base: Wave8AgentDefinitionListItem[] = AGENT_DEFINITIONS.map((agent) => ({
    ...agent,
    editable: true,
    source: 'code' as const,
    updatedBy: null,
  }));
  try {
    const rows = await dbAll(
      `SELECT * FROM wave8_agent_definitions
       WHERE organization_id IS NULL OR organization_id = ?
       ORDER BY organization_id, name ASC`,
      [params?.organizationId || null]
    );
    const overrides = (rows || [])
      .map(mapDefinitionRow)
      .filter(Boolean)
      .map(
        (definition) =>
          ({
            ...(definition as Wave8AgentDefinition),
            editable: Boolean((definition as Wave8AgentDefinition).editable),
            source: ((definition as Wave8AgentDefinition).source || 'database') as
              'code' | 'database',
            updatedBy: (definition as Wave8AgentDefinition).updatedBy || null,
          }) satisfies Wave8AgentDefinitionListItem
      );
    const byId = new Map(base.map((agent) => [agent.agentId, agent]));
    for (const override of overrides) byId.set(override.agentId, override);
    return Array.from(byId.values());
  } catch {
    return base;
  }
}

export async function upsertWave8AgentDefinition(input: {
  organizationId?: string | null;
  userId: string;
  definition: Wave8AgentDefinition;
}): Promise<Wave8AgentDefinition> {
  await ensureWave8AgentRuntimeSchema();
  const definition = input.definition;
  await dbRun(
    `INSERT INTO wave8_agent_definitions (
      agent_id, organization_id, name, role, purpose, persona, allowed_tools_json,
      blocked_tools_json, source_scope_json, output_schema_json, approval_policy,
      cost_class, risk_level, examples_json, editable, updated_by, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(agent_id) DO UPDATE SET
      name = excluded.name,
      role = excluded.role,
      purpose = excluded.purpose,
      persona = excluded.persona,
      allowed_tools_json = excluded.allowed_tools_json,
      blocked_tools_json = excluded.blocked_tools_json,
      source_scope_json = excluded.source_scope_json,
      output_schema_json = excluded.output_schema_json,
      approval_policy = excluded.approval_policy,
      cost_class = excluded.cost_class,
      risk_level = excluded.risk_level,
      examples_json = excluded.examples_json,
      editable = excluded.editable,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at`,
    [
      definition.agentId,
      input.organizationId || null,
      definition.name,
      definition.role,
      definition.purpose,
      definition.persona,
      safeJsonStringify(definition.allowedTools),
      safeJsonStringify(definition.blockedTools),
      safeJsonStringify(definition.sourceScope),
      safeJsonStringify(definition.outputSchema),
      definition.approvalPolicy,
      definition.costClass,
      definition.riskLevel,
      safeJsonStringify(definition.examples),
      1,
      input.userId,
      nowIso(),
    ]
  );
  return {
    ...definition,
    editable: true,
    source: 'database',
    updatedBy: input.userId,
  };
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
      schedulerMode: 'durable_cron_worker',
      cronBacked: true,
      trigger: 'launch_request',
      cadence: input.schedule.cadence,
      nextRunAt: input.schedule.nextRunAt || null,
      timezone: input.schedule.timezone || 'UTC',
      note: 'Schedule is persisted and claimed by the central cron worker using a durable lease.',
    };
  }
  if (
    input.schedulerContext?.trigger === 'manual_process_due' ||
    input.schedulerContext?.trigger === 'durable_cron_worker'
  ) {
    return {
      requested: false,
      status: 'triggered',
      schedulerMode:
        input.schedulerContext.trigger === 'durable_cron_worker'
          ? 'durable_cron_worker'
          : 'manual_process_due_endpoint',
      cronBacked: input.schedulerContext.trigger === 'durable_cron_worker',
      trigger: input.schedulerContext.trigger,
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
  const startedAtMs = Date.now();
  await ensureWave8AgentRuntimeSchema();
  const definition = await getDefinition(input.agentId, input.organizationId);
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
      usage: {
        inputTokens: deterministicTokenCount({ goal: input.goal, requestedTools }),
        outputTokens: deterministicTokenCount(output),
        totalTokens:
          deterministicTokenCount({ goal: input.goal, requestedTools }) +
          deterministicTokenCount(output),
        costUsd: 0,
        durationMs: Math.max(0, Date.now() - startedAtMs),
        source: 'deterministic_local_runtime',
      },
    },
  };
  await dbRun(
    `INSERT INTO wave8_agent_runs (
      run_id, organization_id, agent_id, user_id, project_id, status, goal,
      requested_tools_json, output_json, schema_valid, audit_json, schedule_json,
      owner_user_id, completed_at, canonical_run_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      input.canonicalRunId || null,
    ]
  );
  if (input.canonicalRunId) {
    await projectCanonicalRunAfterExternalTransition({
      canonicalRunId: input.canonicalRunId,
      organizationId: input.organizationId,
      aliasType: 'wave8_run',
      externalId: runId,
      actorUserId: input.userId,
      reason: `Wave8 agent run persisted with status ${status}.`,
    });
  }
  if (status === 'scheduled' && input.schedule) {
    const scheduleId = `sched8-${uuidv4()}`;
    await dbRun(
      `INSERT INTO wave8_agent_schedules (
        schedule_id, organization_id, agent_id, owner_user_id, cadence, goal, project_id,
        timezone, next_run_at, scheduler_mode, status, timeout_seconds, max_attempts, mandate_json,
        canonical_run_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        scheduleId,
        input.organizationId,
        input.agentId,
        input.schedule.ownerUserId || input.userId,
        input.schedule.cadence,
        input.goal,
        input.projectId || null,
        input.schedule.timezone || 'UTC',
        input.schedule.nextRunAt || null,
        'durable_cron_worker',
        'active',
        Math.max(1, Math.min(Number(input.schedule.timeoutSeconds || 900), 86_400)),
        Math.max(1, Math.min(Number(input.schedule.maxAttempts || 3), 10)),
        safeJsonStringify({
          version: 1,
          approvedAt: nowIso(),
          approvedBy: input.userId,
          approvalPolicy: definition.approvalPolicy,
          approvalDecision,
          agentId: input.agentId,
          goal: input.goal,
          projectId: input.projectId || null,
          ownerUserId: input.schedule.ownerUserId || input.userId,
          cadence: input.schedule.cadence,
          timezone: input.schedule.timezone || 'UTC',
          timeoutSeconds: Math.max(
            1,
            Math.min(Number(input.schedule.timeoutSeconds || 900), 86_400)
          ),
          maxAttempts: Math.max(1, Math.min(Number(input.schedule.maxAttempts || 3), 10)),
        }),
        input.canonicalRunId || null,
      ]
    );
    if (input.canonicalRunId) {
      await projectCanonicalRunAfterExternalTransition({
        canonicalRunId: input.canonicalRunId,
        organizationId: input.organizationId,
        aliasType: 'schedule',
        externalId: scheduleId,
        actorUserId: input.userId,
        reason: 'Wave8 durable schedule registered.',
      });
    }
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
  resourceIdempotencyKey?: string | null;
  estimatedCostUsd?: number | null;
}): Promise<any> {
  await ensureWave8AgentRuntimeSchema();
  const definition = await getDefinition(input.agentId, input.organizationId);
  if (!definition) throw new Error(`Unknown Wave 8 agent: ${input.agentId}`);
  const toolDecision = validateToolScope(definition, [input.toolName]);
  let preliminaryDenial = toolDecision.allowed ? null : toolDecision.reason;
  if (definition.approvalPolicy === 'airun_required') {
    const approvalDecision = await validateApprovedAIRun({
      organizationId: input.organizationId,
      aiRunId: input.aiRunId,
    });
    if (!approvalDecision.allowed) {
      preliminaryDenial = approvalDecision.reason;
    }
  }
  if (definition.approvalPolicy === 'budget_gate' && input.budgetApproved !== true) {
    preliminaryDenial = 'budget_gate_required';
  }
  const governanceDecision = await authorizeAgentToolExecution({
    organizationId: input.organizationId,
    userId: input.userId,
    agentId: input.agentId,
    toolName: input.toolName,
    toolInput: input.toolInput,
    projectId: input.projectId,
    runId: input.runId || input.aiRunId,
    preliminaryDenial,
  });
  if (!governanceDecision.allowed) {
    return {
      allowed: false,
      error: governanceDecision.reason,
      toolDecision,
      governanceDecision,
    };
  }
  const requestedResourceRunId = input.runId || input.aiRunId;
  const wave8CanonicalBinding = requestedResourceRunId
    ? await dbGet<{ canonical_run_id?: string | null }>(
        `SELECT canonical_run_id FROM wave8_agent_runs
         WHERE run_id = ? AND organization_id = ?`,
        [requestedResourceRunId, input.organizationId]
      )
    : null;
  const resourceRunId = wave8CanonicalBinding?.canonical_run_id || requestedResourceRunId;
  let resourceExecution;
  try {
    resourceExecution = await executeWithAgentResourceReservation({
      organizationId: input.organizationId,
      projectId: input.projectId,
      runId: resourceRunId,
      userId: input.userId,
      agentId: input.agentId,
      toolName: input.toolName,
      idempotencyKey: input.resourceIdempotencyKey,
      estimatedCostUsd: input.estimatedCostUsd,
      execute: () =>
        executeToolCall(input.toolName, input.toolInput, {
          organizationId: input.organizationId,
          userId: input.userId,
          projectId: input.projectId || undefined,
        }),
    });
  } catch (error) {
    return {
      allowed: false,
      error: error instanceof Error ? error.message : 'resource_governance_failed_closed',
      toolDecision,
      governanceDecision,
    };
  }
  if (!resourceExecution.allowed || resourceExecution.replayed) {
    return {
      allowed: resourceExecution.allowed,
      error: resourceExecution.allowed ? undefined : resourceExecution.reason,
      replayed: resourceExecution.replayed,
      toolDecision,
      governanceDecision,
      resourceDecision: resourceExecution.resourceDecision,
    };
  }
  return {
    allowed: true,
    result: resourceExecution.result,
    toolDecision,
    governanceDecision,
    resourceDecision: resourceExecution.resourceDecision,
  };
}

export async function processDueWave8AgentSchedules(params: {
  organizationId?: string;
  now?: string;
  workerId?: string;
  executeSchedule?: (input: LaunchWave8AgentInput, signal: AbortSignal) => Promise<any>;
}): Promise<any[]> {
  await ensureWave8AgentRuntimeSchema();
  const now = params.now || nowIso();
  const workerId = params.workerId || `manual-${uuidv4()}`;
  const leaseExpiresAt = new Date(Date.parse(now) + 5 * 60 * 1000).toISOString();
  const organizationClause = params.organizationId ? 'AND organization_id = ?' : '';
  const queryParams = params.organizationId
    ? [params.organizationId, now, now, now]
    : [now, now, now];
  const rows = await dbAll(
    `SELECT * FROM wave8_agent_schedules
     WHERE status = 'active'
       ${organizationClause}
       AND (next_run_at IS NULL OR next_run_at <= ?)
       AND (retry_at IS NULL OR retry_at <= ?)
       AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
     ORDER BY next_run_at ASC`,
    queryParams
  );
  const processed: any[] = [];
  for (const row of rows || []) {
    const claim = await dbRun(
      `UPDATE wave8_agent_schedules
       SET lease_owner = ?, lease_expires_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE schedule_id = ? AND status = 'active'
         AND (lease_expires_at IS NULL OR lease_expires_at <= ?)`,
      [workerId, leaseExpiresAt, row.schedule_id, now]
    );
    if (Number((claim as any)?.changes ?? (claim as any)?.rowCount ?? 0) !== 1) continue;
    if (row.canonical_run_id) {
      const contextDecision = await revalidateCanonicalRunContextForWorker({
        canonicalRunId: row.canonical_run_id,
        organizationId: row.organization_id,
        actorUserId: row.owner_user_id,
        workerKind: 'wave8_schedule',
        externalId: row.schedule_id,
      });
      if (contextDecision.decision !== 'allowed') {
        await dbRun(
          `UPDATE wave8_agent_schedules
             SET status = 'blocked_context', blocked_reason = ?, lease_owner = NULL,
                 lease_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE schedule_id = ? AND organization_id = ? AND lease_owner = ?`,
          [
            `${contextDecision.decision}:${contextDecision.reason}`,
            row.schedule_id,
            row.organization_id,
            workerId,
          ]
        );
        await recordWave8Notification({
          organizationId: row.organization_id,
          runId: row.schedule_id,
          ownerUserId: row.owner_user_id,
          notificationType: 'agent_schedule_context_blocked',
          payload: {
            scheduleId: row.schedule_id,
            decision: contextDecision.decision,
            reason: contextDecision.reason,
            revalidationId: contextDecision.revalidationId,
          },
        });
        continue;
      }
    }
    const cadence = String(row.cadence || 'weekly') as 'once' | 'daily' | 'weekly';
    try {
      const scheduleInput: LaunchWave8AgentInput = {
        organizationId: row.organization_id,
        userId: row.owner_user_id,
        canonicalRunId: row.canonical_run_id || null,
        agentId: row.agent_id,
        goal: row.goal || `Scheduled ${cadence} agent run`,
        projectId: row.project_id || null,
        requestedTools: [],
        schedule: null,
        approval: { budgetApproved: true },
        schedulerContext: {
          scheduleId: row.schedule_id,
          trigger: params.workerId ? 'durable_cron_worker' : 'manual_process_due',
        },
      };
      const timeoutMs = Math.max(1, Number(row.timeout_seconds || 900)) * 1000;
      const executeSchedule = params.executeSchedule || launchWave8Agent;
      const abortController = new AbortController();
      let timeoutHandle: NodeJS.Timeout | undefined;
      const result = await Promise.race([
        executeSchedule(scheduleInput, abortController.signal),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            abortController.abort(`schedule_execution_timeout:${row.timeout_seconds || 900}`);
            reject(new Error(`schedule_execution_timeout:${row.timeout_seconds || 900}`));
          }, timeoutMs);
        }),
      ]).finally(() => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      });
      const nextRunAt = calculateNextScheduleRun(now, cadence, row.timezone || 'UTC');
      await dbRun(
        `UPDATE wave8_agent_schedules
         SET next_run_at = ?, status = ?, lease_owner = NULL, lease_expires_at = NULL,
             attempt_count = attempt_count + 1, last_run_at = ?, last_error = NULL,
             retry_at = NULL, blocked_reason = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE schedule_id = ? AND lease_owner = ? AND status = 'active'`,
        [nextRunAt, cadence === 'once' ? 'completed' : 'active', now, row.schedule_id, workerId]
      );
      if (row.canonical_run_id) {
        await projectCanonicalRunAfterExternalTransition({
          canonicalRunId: row.canonical_run_id,
          organizationId: row.organization_id,
          aliasType: 'schedule',
          externalId: row.schedule_id,
          actorUserId: row.owner_user_id,
          reason: `Wave8 scheduled execution completed; schedule is ${
            cadence === 'once' ? 'completed' : 'active'
          }.`,
        });
      }
      await recordWave8Notification({
        organizationId: row.organization_id,
        runId: result.run.runId,
        ownerUserId: row.owner_user_id,
        notificationType: 'agent_schedule_processed',
        payload: {
          scheduleId: row.schedule_id,
          cadence,
          schedulerMode: params.workerId ? 'durable_cron_worker' : 'manual_process_due_endpoint',
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const nextAttempt = Number(row.attempt_count || 0) + 1;
      const maxAttempts = Math.max(1, Number(row.max_attempts || 3));
      const externalDependency = errorMessage.startsWith('external_dependency:');
      const terminal = nextAttempt >= maxAttempts;
      const status = externalDependency ? 'blocked_external' : terminal ? 'failed' : 'active';
      const retryAt =
        status === 'active'
          ? new Date(
              Date.parse(now) + Math.min(3600, 30 * 2 ** (nextAttempt - 1)) * 1000
            ).toISOString()
          : null;
      await dbRun(
        `UPDATE wave8_agent_schedules
         SET lease_owner = NULL, lease_expires_at = NULL, attempt_count = attempt_count + 1,
             last_error = ?, status = ?, retry_at = ?, blocked_reason = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE schedule_id = ? AND lease_owner = ?`,
        [
          errorMessage,
          status,
          retryAt,
          externalDependency ? errorMessage : null,
          row.schedule_id,
          workerId,
        ]
      );
      if (row.canonical_run_id) {
        await projectCanonicalRunAfterExternalTransition({
          canonicalRunId: row.canonical_run_id,
          organizationId: row.organization_id,
          aliasType: 'schedule',
          externalId: row.schedule_id,
          actorUserId: row.owner_user_id,
          reason: `Wave8 scheduled execution failed; schedule is ${status}.`,
        });
      }
      await recordWave8Notification({
        organizationId: row.organization_id,
        runId: row.schedule_id,
        ownerUserId: row.owner_user_id,
        notificationType: externalDependency
          ? 'agent_schedule_dependency_blocked'
          : terminal
            ? 'agent_schedule_failed'
            : 'agent_schedule_retry_scheduled',
        payload: {
          scheduleId: row.schedule_id,
          error: errorMessage,
          attempt: nextAttempt,
          maxAttempts,
          status,
          retryAt,
          actionable: externalDependency || terminal,
          actionUrl: `/my-work/agents?scheduleId=${row.schedule_id}`,
        },
      });
    }
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
    canonicalRunId: row.canonical_run_id || null,
    organizationId: row.organization_id,
    agentId: row.agent_id,
    ownerUserId: row.owner_user_id,
    cadence: row.cadence,
    nextRunAt: row.next_run_at || null,
    schedulerMode: row.scheduler_mode || 'durable_cron_worker',
    timezone: row.timezone || 'UTC',
    attemptCount: Number(row.attempt_count || 0),
    mandateVersion: Number(row.mandate_version || 1),
    mandate: safeJsonParse(row.mandate_json, {}),
    timeoutSeconds: Number(row.timeout_seconds || 900),
    maxAttempts: Number(row.max_attempts || 3),
    retryAt: row.retry_at || null,
    blockedReason: row.blocked_reason || null,
    lastRunAt: row.last_run_at || null,
    lastError: row.last_error || null,
    cancelledAt: row.cancelled_at || null,
    cancelledBy: row.cancelled_by || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at || null,
  }));
}

export async function transitionWave8AgentSchedule(input: {
  organizationId: string;
  scheduleId: string;
  actorUserId: string;
  action: 'pause' | 'resume' | 'cancel';
}): Promise<any> {
  await ensureWave8AgentRuntimeSchema();
  const current = await dbGet(
    `SELECT * FROM wave8_agent_schedules WHERE schedule_id = ? AND organization_id = ?`,
    [input.scheduleId, input.organizationId]
  );
  if (!current) throw new Error('schedule_not_found');
  const from = String(current.status);
  const allowed =
    (input.action === 'pause' && from === 'active') ||
    (input.action === 'resume' &&
      ['paused', 'blocked_external', 'blocked_context', 'failed'].includes(from)) ||
    (input.action === 'cancel' &&
      ['active', 'paused', 'blocked_external', 'blocked_context', 'failed'].includes(from));
  if (!allowed) throw new Error(`invalid_schedule_transition:${from}:${input.action}`);
  if (
    current.lease_owner &&
    current.lease_expires_at &&
    Date.parse(current.lease_expires_at) > Date.now()
  ) {
    throw new Error('schedule_currently_executing');
  }
  const target =
    input.action === 'pause' ? 'paused' : input.action === 'resume' ? 'active' : 'cancelled';
  const result = await dbRun(
    `UPDATE wave8_agent_schedules SET status = ?, mandate_version = mandate_version + 1,
       lease_owner = NULL, lease_expires_at = NULL, retry_at = NULL, blocked_reason = NULL,
       attempt_count = CASE WHEN ? = 'active' THEN 0 ELSE attempt_count END,
       cancelled_at = ?, cancelled_by = ?, updated_at = CURRENT_TIMESTAMP
     WHERE schedule_id = ? AND organization_id = ? AND status = ?
       AND (lease_expires_at IS NULL OR lease_expires_at <= ?)`,
    [
      target,
      target,
      target === 'cancelled' ? nowIso() : null,
      target === 'cancelled' ? input.actorUserId : null,
      input.scheduleId,
      input.organizationId,
      from,
      nowIso(),
    ]
  );
  if (Number(result.changes || 0) !== 1) throw new Error('schedule_transition_conflict');
  if (current.canonical_run_id) {
    await projectCanonicalRunAfterExternalTransition({
      canonicalRunId: current.canonical_run_id,
      organizationId: input.organizationId,
      aliasType: 'schedule',
      externalId: input.scheduleId,
      actorUserId: input.actorUserId,
      reason: `Wave8 schedule transitioned from ${from} to ${target}.`,
    });
  }
  await recordWave8Notification({
    organizationId: input.organizationId,
    runId: input.scheduleId,
    ownerUserId: current.owner_user_id,
    notificationType: `agent_schedule_${target}`,
    payload: {
      scheduleId: input.scheduleId,
      from,
      to: target,
      actorUserId: input.actorUserId,
      mandateVersion: Number(current.mandate_version || 1) + 1,
    },
  });
  return (await listWave8AgentSchedules({ organizationId: input.organizationId })).find(
    (schedule) => schedule.scheduleId === input.scheduleId
  );
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
