/**
 * ToolController
 * Tools -> Initiatives workflow
 */

import type { Response } from 'express';
import type { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

import { generateSwotProposals } from '../services/ai/swotProposalService.js';
import auditEventsService from '../services/AuditEventsService.js';
import { safePersistToolSessionConclusion } from '../services/conclusions/toolConclusionBridge.js';
import { createInitiative as funnelCreateInitiative } from '../services/initiative/createInitiativeService.js';
import { resolveInitiativeProjectId } from '../services/initiativeProjectPolicyService.js';
import { checkSimilarInitiatives } from '../services/initiativeSimilarityService.js';
import KnownToolsService from '../services/KnownToolsService.js';
import organizationContextService from '../services/organizationContext/OrganizationContextService.js';
import { hasPermission } from '../services/permissionService.js';
import * as ReportBuilderService from '../services/reportBuilderService.js';
import ToolInitiativeService from '../services/ToolInitiativeService.js';
import {
  handoffSwotRecommendation,
  SwotCandidateHandoffError,
} from '../services/tools/swotCandidateHandoffService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { decodeHtmlEntities } from '../utils/htmlEntities.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import {
  evaluateDoDGates,
  type ToolRuntimeContract,
  ToolRuntimeContractSchema,
} from '../validators/toolRuntime.validators.js';

type ToolSessionRow = {
  id: string;
  organization_id: string;
  project_id?: string | null;
  tool_type: string;
  name: string;
  status: string;
  completion_percent: number;
  confidence_avg: number;
  answers_json?: string | null;
  context_snapshot?: string | null;
  missing_items_json?: string | null;
  runtime_contract_json?: string | null;
  dod_status?: string | null;
  review_requested_at?: string | null;
  approved_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const safeParseJSON = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const normalizeStatus = (status: string | null | undefined) =>
  (status || 'DRAFT')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .toUpperCase();

const renderToolReportSection = (
  sectionTitle: string,
  sectionKey: string,
  session: ToolSessionRow,
  answers: Record<string, any>
): string => {
  const items = Array.isArray(answers.items) ? answers.items : [];
  const tensions = Array.isArray(answers.tensions) ? answers.tensions : [];
  const moves = Array.isArray(answers.recommendedMoves) ? answers.recommendedMoves : [];
  const summary = answers.summary && typeof answers.summary === 'object' ? answers.summary : {};
  const itemLines = items
    .slice(0, 20)
    .map(
      (item: any) =>
        `- **${item.quadrant || 'finding'}:** ${item.text || item.content || item.title || 'Finding'}`
    );
  const moveLines = moves
    .slice(0, 12)
    .map(
      (move: any) =>
        `- **${move.title || 'Recommendation'}** — ${move.rationale || move.description || 'Derived from the approved tool session.'}`
    );
  const tensionLines = tensions
    .slice(0, 12)
    .map(
      (tension: any) =>
        `- **${tension.title || 'Strategic tension'}** — ${tension.insight || tension.whyNow || 'Validated in the approved session.'}`
    );
  const executive = String(
    summary.executiveSummary || summary.verdict || 'Approved tool-session output.'
  );
  const base = [
    `# ${sectionTitle}`,
    '',
    `Source: ${session.name} (${session.tool_type})`,
    '',
    executive,
  ];

  if (sectionKey === 'cover')
    return [
      `# ${session.name}`,
      '',
      'Tool Evaluation Report',
      '',
      `Approved source session: ${session.id}`,
    ].join('\n');
  if (sectionKey.includes('recommend') || sectionKey.includes('next')) {
    return [
      ...base,
      '',
      '## Recommended actions',
      ...(moveLines.length ? moveLines : ['- No explicit actions were selected.']),
    ].join('\n');
  }
  if (
    sectionKey.includes('finding') ||
    sectionKey.includes('gap') ||
    sectionKey.includes('overview')
  ) {
    return [
      ...base,
      '',
      '## Approved findings',
      ...(itemLines.length ? itemLines : ['- No structured findings were recorded.']),
    ].join('\n');
  }
  return [
    ...base,
    '',
    '## Strategic tensions',
    ...(tensionLines.length ? tensionLines : ['- No explicit strategic tensions were recorded.']),
    '',
    '## Recommended actions',
    ...(moveLines.length ? moveLines : ['- No explicit actions were selected.']),
  ].join('\n');
};
const safeJsonParse = (value: string | null | undefined): Record<string, unknown> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

type ToolMissingItem = {
  id?: string;
  label?: string;
  severity?: string;
  resolved?: boolean;
  stepId?: string;
};

const safeJsonParseAny = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const normalizeMissingItems = (value: unknown): ToolMissingItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item: any) => ({
      id: typeof item.id === 'string' ? item.id : undefined,
      label: typeof item.label === 'string' ? item.label : undefined,
      severity: typeof item.severity === 'string' ? item.severity : undefined,
      resolved: Boolean(item.resolved),
      stepId: typeof item.stepId === 'string' ? item.stepId : undefined,
    }));
};

const getReadableMissingItemLabel = (item: ToolMissingItem, index: number) =>
  item.label || item.id || item.stepId || `missing-item-${index + 1}`;

const getMissingItemBlockers = (items: ToolMissingItem[]): string[] =>
  items
    .filter((item) => !item.resolved)
    .map((item, index) => getReadableMissingItemLabel(item, index));

const getRuntimeGateBlockers = (
  session: Pick<
    ToolSessionRow,
    | 'id'
    | 'organization_id'
    | 'runtime_contract_json'
    | 'answers_json'
    | 'dod_status'
    | 'completion_percent'
    | 'confidence_avg'
  >
): string[] => {
  if (session.runtime_contract_json) {
    try {
      const contract = ToolRuntimeContractSchema.parse(JSON.parse(session.runtime_contract_json));
      const result = evaluateDoDGates(contract, safeJsonParse(session.answers_json));
      return result.gates
        .filter((gate) => !gate.passed)
        .map((gate) => gate.label || gate.id || 'runtime-gate');
    } catch {
      return ['invalid runtime contract'];
    }
  }

  const blockers: string[] = [];
  if ((session.completion_percent || 0) < 100) {
    blockers.push(`completion ${session.completion_percent || 0}% < 100%`);
  }
  if ((session.confidence_avg || 0) < 3) {
    blockers.push(`confidence ${session.confidence_avg || 0} < 3`);
  }
  return blockers;
};

const getPromotionBlockers = (
  session: Pick<
    ToolSessionRow,
    | 'id'
    | 'organization_id'
    | 'runtime_contract_json'
    | 'answers_json'
    | 'dod_status'
    | 'completion_percent'
    | 'confidence_avg'
  >,
  missingItemsValue: unknown
): { missingItems: string[]; runtime: string[]; all: string[] } => {
  const missingItems = getMissingItemBlockers(normalizeMissingItems(missingItemsValue));
  const runtime = getRuntimeGateBlockers(session);
  return {
    missingItems,
    runtime,
    all: [...missingItems, ...runtime],
  };
};

let decisionColumnsCache: Set<string> | null = null;

const getDecisionColumns = async (): Promise<Set<string>> => {
  if (decisionColumnsCache) return decisionColumnsCache;
  try {
    const rows = await queryHelpers.getTableColumns('decisions');
    const cols = new Set((rows || []).map((row) => row.name).filter(Boolean) as string[]);
    if (cols.size > 0) {
      decisionColumnsCache = cols;
      return cols;
    }
  } catch {
    // fall through to default column set
  }

  decisionColumnsCache = new Set([
    'id',
    'organization_id',
    'project_id',
    'initiative_id',
    'task_id',
    'title',
    'description',
    'type',
    'decision_maker_id',
    'deadline',
    'escalation_deadline',
    'status',
    'created_by',
    'priority',
    'impact',
    'escalation_level',
    'pmo_domain',
    'required',
    'created_at',
    'updated_at',
  ]);
  return decisionColumnsCache;
};

const buildDecisionInsert = async (params: {
  orgId: string;
  projectId?: string | null;
  title: string;
  decisionType: string;
  decisionOwnerId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdBy: string;
  dueDate?: string | null;
  escalationDeadline?: string | null;
  priority?: string | null;
  pmoDomain?: string | null;
}) => {
  const columns = await getDecisionColumns();
  const createdAt = new Date().toISOString();
  const updatedAt = createdAt;

  const values: unknown[] = [];
  const cols: string[] = [];
  const push = (col: string, value: unknown) => {
    if (!columns.has(col)) return;
    cols.push(col);
    values.push(value);
  };

  push('id', uuidv4());
  push('organization_id', params.orgId);
  push('project_id', params.projectId || null);
  push('initiative_id', null);
  push('task_id', null);
  push('title', params.title);
  push('description', null);
  push('type', params.decisionType);
  push('decision_maker_id', params.decisionOwnerId);
  push('deadline', params.dueDate || null);
  push('escalation_deadline', params.escalationDeadline || null);
  push('status', params.status);
  push('created_by', params.createdBy);
  push('priority', params.priority || 'medium');
  push('impact', 'medium');
  push('escalation_level', 'none');
  push('pmo_domain', params.pmoDomain || 'GOVERNANCE_DECISION_MAKING');
  push('required', 1);
  push('created_at', createdAt);
  push('updated_at', updatedAt);

  const placeholders = cols.map(() => '?').join(', ');
  return {
    id: values[cols.indexOf('id')] as string,
    sql: `INSERT INTO decisions (${cols.join(', ')}) VALUES (${placeholders})`,
    values,
  };
};

const ensurePermission = async (
  req: AuthenticatedRequest,
  permissionKey: string
): Promise<boolean> => {
  const user = req.user;
  if (!user) return false;
  if (process.env.TOOLS_SKIP_PERMISSIONS === 'true') return true;
  // FIX (role-case family, continuation of AssessmentController fix): user.role on
  // AuthenticatedUser is lowercase (mapRoleForAuthenticatedUser in auth.middleware.ts
  // emits 'owner'/'administrator'/etc), while hasPermission()/ROLES compare against
  // UPPERCASE ('OWNER'/'ADMIN'/...). Passing the raw lowercase role made hasPermission's
  // own SUPERADMIN/OWNER bypass (permissionService.ts) silently fail, causing real
  // OWNER users to fall through to a 403. Verified empirically against :5443:
  // hasPermission(...,'owner') === false, hasPermission(...,'OWNER') === true.
  const allowed = await hasPermission(
    user.id,
    user.organizationId,
    permissionKey,
    String(user.role || '').toUpperCase() as any
  );
  if (allowed) return true;
  const role = String(user.role || '').toUpperCase();
  const key = String(permissionKey || '').toUpperCase();
  if (['ADMIN', 'ADMINISTRATOR'].includes(role) && key.startsWith('TOOLS_')) {
    return true;
  }
  return false;
};

const requireDoD = (session: ToolSessionRow): boolean => {
  return (session.completion_percent || 0) >= 100 && (session.confidence_avg || 0) >= 3;
};

const logAudit = async (
  orgId: string,
  userId: string,
  action: string,
  resourceId: string,
  details?: Record<string, unknown>
) => {
  try {
    await queryHelpers.queryRun(
      `INSERT INTO audit_log (id, organization_id, user_id, action, resource_type, resource_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        orgId,
        userId,
        action,
        'tool_session',
        resourceId,
        JSON.stringify(details || {}),
        new Date().toISOString(),
      ]
    );
  } catch {
    // audit_log table may not exist in all environments
  }
};

const ensureToolsSchema = async (): Promise<void> => {
  if (process.env.DB_MANAGED_SCHEMA === 'off') {
    return;
  }
  try {
    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS tool_sessions (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        project_id TEXT,
        tool_type TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'DRAFT',
        completion_percent INTEGER DEFAULT 0,
        confidence_avg REAL DEFAULT 0,
        answers_json TEXT DEFAULT '{}',
        context_snapshot TEXT DEFAULT '{}',
        review_requested_at TIMESTAMP,
        approved_at TIMESTAMP,
        created_by TEXT NOT NULL,
        updated_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS tool_decisions (
        id TEXT PRIMARY KEY,
        tool_session_id TEXT NOT NULL,
        decision_type TEXT NOT NULL,
        status TEXT DEFAULT 'APPROVED',
        decision_id TEXT,
        owner_id TEXT,
        due_date TIMESTAMP,
        comment TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    // Note: decision_id is already in CREATE TABLE above, so no need to ALTER
    // Migration 292_tools_decisions_link.sql handles adding it for existing tables
    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS tool_initiative_batches (
        id TEXT PRIMARY KEY,
        tool_session_id TEXT NOT NULL,
        methodology_id TEXT NOT NULL,
        initiatives_count INTEGER NOT NULL,
        include_chat_context INTEGER DEFAULT 1,
        generated_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS tool_initiative_links (
        id TEXT PRIMARY KEY,
        tool_session_id TEXT NOT NULL,
        batch_id TEXT NOT NULL,
        initiative_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    // V4-TOOL-02 / P27-B / H3 additive runtime columns. Inspect before ALTER
    // instead of relying on PostgreSQL-only `ADD COLUMN IF NOT EXISTS`: the
    // controller's persistence contract is also exercised against SQLite, and
    // silently swallowing its syntax error left the table half-provisioned.
    const sessionColumns = new Set(
      (await queryHelpers.getTableColumns('tool_sessions')).map((column) => column.name)
    );
    for (const col of [
      { name: 'runtime_contract_json', def: 'TEXT' },
      { name: 'dod_status', def: "TEXT DEFAULT 'pending'" },
      { name: 'wizard_state_json', def: 'TEXT' },
      { name: 'missing_items_json', def: 'TEXT' },
      { name: 'failure_reason', def: 'TEXT' },
      { name: 'last_generation_batch_id', def: 'TEXT' },
      { name: 'output_json', def: 'TEXT' },
    ]) {
      if (sessionColumns.has(col.name)) continue;
      try {
        await queryHelpers.queryRun(`ALTER TABLE tool_sessions ADD COLUMN ${col.name} ${col.def}`);
        sessionColumns.add(col.name);
      } catch {
        // Concurrent first-use initialization may have added it after the
        // column inspection. A following request re-reads the schema.
      }
    }

    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_tool_sessions_org ON tool_sessions(organization_id)`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_tool_sessions_status ON tool_sessions(status)`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_tool_sessions_tool ON tool_sessions(tool_type)`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_tool_sessions_dod ON tool_sessions(dod_status)`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_tool_decisions_session ON tool_decisions(tool_session_id)`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_tool_decisions_type ON tool_decisions(decision_type)`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_tool_batches_session ON tool_initiative_batches(tool_session_id)`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_tool_links_session ON tool_initiative_links(tool_session_id)`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_tool_links_batch ON tool_initiative_links(batch_id)`
    );

    // Note: permissions table may not have 'name' and 'icon' columns in PostgreSQL
    const permissionInsertSql = `INSERT OR IGNORE INTO permissions (key, description, category) VALUES
      ('TOOLS_REQUEST_REVIEW', 'Request review for tool session', 'TOOLS'),
      ('TOOLS_APPROVE', 'Approve tool session', 'TOOLS'),
      ('TOOLS_GENERATE_INITIATIVES', 'Generate initiatives from tool', 'TOOLS')`;
    try {
      await queryHelpers.queryRun(permissionInsertSql);
    } catch {
      await queryHelpers.queryRun(
        `INSERT INTO permissions (key, description, category) VALUES
          ('TOOLS_REQUEST_REVIEW', 'Request review for tool session', 'TOOLS'),
          ('TOOLS_APPROVE', 'Approve tool session', 'TOOLS'),
          ('TOOLS_GENERATE_INITIATIVES', 'Generate initiatives from tool', 'TOOLS')
        ON CONFLICT (key) DO NOTHING`
      );
    }

    // role_permissions may have (id, role, permission_key) only in Postgres; description optional
    const roleInsertSql = `INSERT OR IGNORE INTO role_permissions (id, role, permission_key) VALUES
      ('rp_tools_request_review_admin', 'ADMIN', 'TOOLS_REQUEST_REVIEW'),
      ('rp_tools_request_review_pm', 'PROJECT_MANAGER', 'TOOLS_REQUEST_REVIEW'),
      ('rp_tools_request_review_super', 'SUPERADMIN', 'TOOLS_REQUEST_REVIEW'),
      ('rp_tools_approve_admin', 'ADMIN', 'TOOLS_APPROVE'),
      ('rp_tools_approve_super', 'SUPERADMIN', 'TOOLS_APPROVE'),
      ('rp_tools_generate_admin', 'ADMIN', 'TOOLS_GENERATE_INITIATIVES'),
      ('rp_tools_generate_pm', 'PROJECT_MANAGER', 'TOOLS_GENERATE_INITIATIVES'),
      ('rp_tools_generate_super', 'SUPERADMIN', 'TOOLS_GENERATE_INITIATIVES')`;
    try {
      await queryHelpers.queryRun(roleInsertSql);
    } catch {
      await queryHelpers.queryRun(
        `INSERT INTO role_permissions (id, role, permission_key) VALUES
          ('rp_tools_request_review_admin', 'ADMIN', 'TOOLS_REQUEST_REVIEW'),
          ('rp_tools_request_review_pm', 'PROJECT_MANAGER', 'TOOLS_REQUEST_REVIEW'),
          ('rp_tools_request_review_super', 'SUPERADMIN', 'TOOLS_REQUEST_REVIEW'),
          ('rp_tools_approve_admin', 'ADMIN', 'TOOLS_APPROVE'),
          ('rp_tools_approve_super', 'SUPERADMIN', 'TOOLS_APPROVE'),
          ('rp_tools_generate_admin', 'ADMIN', 'TOOLS_GENERATE_INITIATIVES'),
          ('rp_tools_generate_pm', 'PROJECT_MANAGER', 'TOOLS_GENERATE_INITIATIVES'),
          ('rp_tools_generate_super', 'SUPERADMIN', 'TOOLS_GENERATE_INITIATIVES')
        ON CONFLICT (id) DO NOTHING`
      );
    }
  } catch {
    // no-op: schema might be managed elsewhere
  }
};

const ensureToolCommentsSchema = async (): Promise<void> => {
  await queryHelpers.queryRun(
    `CREATE TABLE IF NOT EXISTS tool_comments (
      id TEXT PRIMARY KEY,
      tool_session_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      priority TEXT DEFAULT 'normal',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );
};

const createDecisionRecord = async (params: {
  orgId: string;
  projectId?: string | null;
  title: string;
  decisionType: string;
  decisionOwnerId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdBy: string;
  dueDate?: string | null;
  priority?: string | null;
  pmoDomain?: string | null;
}) => {
  const {
    orgId,
    projectId,
    title,
    decisionType,
    decisionOwnerId,
    status,
    createdBy,
    dueDate,
    priority,
    pmoDomain,
  } = params;
  const id = uuidv4();
  const escalationDeadline =
    dueDate && new Date(new Date(dueDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const insert = await buildDecisionInsert({
    orgId,
    projectId,
    title,
    decisionType,
    decisionOwnerId,
    status,
    createdBy,
    dueDate,
    escalationDeadline,
    priority,
    pmoDomain,
  });

  await queryHelpers.queryRun(insert.sql, insert.values);

  await queryHelpers.queryRun(
    `INSERT INTO decision_history (id, decision_id, action, old_status, new_status, changed_by, details)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      insert.id,
      status === 'approved' ? 'decided' : status === 'rejected' ? 'decided' : 'created',
      null,
      status,
      createdBy,
      JSON.stringify({ notes: `Decision ${status}`, decisionType }),
    ]
  );

  return insert.id;
};

const upsertToolDecision = async (params: {
  toolSessionId: string;
  decisionType: string;
  status: string;
  decisionId?: string | null;
  comment?: string | null;
  createdBy: string;
}) => {
  const { toolSessionId, decisionType, status, decisionId, comment, createdBy } = params;
  const existing = await queryHelpers.queryOne<{ id: string }>(
    `SELECT id FROM tool_decisions WHERE tool_session_id = ? AND decision_type = ?`,
    [toolSessionId, decisionType]
  );
  if (existing?.id) {
    await queryHelpers.queryRun(
      `UPDATE tool_decisions SET status = ?, decision_id = ?, comment = ? WHERE id = ?`,
      [status, decisionId || null, comment || null, existing.id]
    );
    return existing.id;
  }
  const id = uuidv4();
  await queryHelpers.queryRun(
    `INSERT INTO tool_decisions (id, tool_session_id, decision_type, status, decision_id, comment, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      toolSessionId,
      decisionType,
      status,
      decisionId || null,
      comment || null,
      createdBy,
      new Date().toISOString(),
    ]
  );
  return id;
};

// TLS-04 — Teresa-assisted SWOT: a proposal is a durable, reviewable record
// (diff, sources/assumption, confidence, rationale) the user must explicitly
// accept/edit/reject before anything touches the real SWOT data. It NEVER
// auto-saves. See createSwotProposals/listSwotProposals/acceptSwotProposal/
// rejectSwotProposal below.
type SwotProposalRow = {
  id: string;
  tool_session_id: string;
  organization_id: string;
  quadrant: string;
  operation: string;
  target_item_id: string | null;
  before_json: string | null;
  proposed_after_json: string | null;
  final_after_json: string | null;
  rationale: string;
  source_refs_json: string | null;
  is_assumption: boolean;
  // NUMERIC comes back from `pg` as a string (no type-parser override in this
  // codebase) — mapSwotProposalRow coerces it back to a number for the client.
  confidence: number | string;
  model_metadata_json: string;
  status: string;
  expected_version: number;
  created_by: string;
  created_at: string;
  decided_by: string | null;
  decided_at: string | null;
};

const mapSwotProposalRow = (row: SwotProposalRow) => ({
  id: row.id,
  toolSessionId: row.tool_session_id,
  organizationId: row.organization_id,
  quadrant: row.quadrant,
  operation: row.operation,
  targetItemId: row.target_item_id,
  before: safeParseJSON<unknown>(row.before_json, null),
  proposedAfter: safeParseJSON<unknown>(row.proposed_after_json, null),
  finalAfter: safeParseJSON<unknown>(row.final_after_json, null),
  rationale: row.rationale,
  sourceRefs: safeParseJSON<string[] | null>(row.source_refs_json, null),
  isAssumption: Boolean(row.is_assumption),
  confidence: Number(row.confidence),
  modelMetadata: safeParseJSON<Record<string, unknown>>(row.model_metadata_json, {}),
  status: row.status,
  expectedVersion: row.expected_version,
  createdBy: row.created_by,
  createdAt: row.created_at,
  decidedBy: row.decided_by,
  decidedAt: row.decided_at,
});

export class ToolController {
  static createToolSession = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await ensureToolsSchema();

      const { toolType, name: rawName, projectId, derivedFrom, snapshotJson } = req.body;
      if (!toolType || !rawName) {
        res.status(400).json({ error: 'toolType and name are required' });
        return;
      }
      // Z139 (data-integrity): the global input-sanitization middleware escapes
      // HTML entities on every req.body string. Decode back to plain before
      // storing tool_sessions.name — same fix already applied to notebook/canvas
      // (server/src/utils/htmlEntities.ts) — so the DB holds plain text instead
      // of a literal `&amp;` that would otherwise render un-decoded in the UI.
      const name = decodeHtmlEntities(String(rawName));

      const availability = await KnownToolsService.getKnownToolAvailability(String(toolType));
      if (availability.exists && !availability.isActive) {
        res.status(409).json({ error: 'This tool is inactive and cannot start a session yet' });
        return;
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      // V3-C03: MYWORK sessions store derived_from + snapshot in context_snapshot
      let contextSnapshot = '{}';
      if (String(toolType).toUpperCase() === 'MYWORK' && (derivedFrom?.length || snapshotJson)) {
        contextSnapshot = JSON.stringify({
          derived_from: derivedFrom || [],
          snapshot: snapshotJson || {},
        });
      }

      await queryHelpers.queryRun(
        `INSERT INTO tool_sessions (
          id, organization_id, project_id, tool_type, name, status,
          completion_percent, confidence_avg, answers_json, context_snapshot,
          created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          user.organizationId,
          projectId || null,
          toolType,
          name,
          'DRAFT',
          0,
          0,
          '{}',
          contextSnapshot,
          user.id,
          user.id,
          now,
          now,
        ]
      );

      await organizationContextService.recordToolSession({
        organizationId: user.organizationId,
        userId: user.id,
        payload: {
          toolId: id,
          toolType,
          name,
          projectId: projectId || null,
          contextSnapshot: safeParseJSON(contextSnapshot, {}),
        },
      });

      res.json({ id, status: 'DRAFT' });
    }
  );

  /**
   * List all tool sessions for the organization
   * Supports filters: projectId, status, toolType, category
   * Supports pagination: limit, offset
   */
  static listToolSessions = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await ensureToolsSchema();

      const { projectId, status, toolType, category, limit = '50', offset = '0' } = req.query;

      // Build query with filters
      let sql = `SELECT 
          id, organization_id, project_id, tool_type, name, status,
          completion_percent, confidence_avg, created_by, updated_by,
          created_at, updated_at, review_requested_at, approved_at
        FROM tool_sessions 
        WHERE organization_id = ?`;
      const params: unknown[] = [user.organizationId];

      if (projectId) {
        sql += ` AND project_id = ?`;
        params.push(projectId);
      }

      if (status) {
        // Support comma-separated statuses
        const statuses = String(status)
          .split(',')
          .map((s) => s.trim().toUpperCase());
        sql += ` AND UPPER(status) IN (${statuses.map(() => '?').join(', ')})`;
        params.push(...statuses);
      }

      if (toolType) {
        sql += ` AND tool_type = ?`;
        params.push(toolType);
      }

      // Category filter maps to tool_type prefixes
      if (category) {
        const categoryMap: Record<string, string[]> = {
          strategic: [
            'dynamic-swot',
            'market-forces',
            'growth-paths',
            'value-chain',
            'portfolio-priority',
            'ambition-decomposer',
            'focus-tradeoff',
            'risk-uncertainty',
            'capability-mapper',
            'narrative-engine',
          ],
          operational: [
            'sop-builder',
            'a3-problem-solving',
            'smed-planner',
            'dms-builder',
            'inventory-autopilot',
            'vsm-builder',
            'automation-pipeline',
            'constraint-control',
            'decision-engine',
            'control-tower',
          ],
          digital: [
            'robotics-feasibility',
            'logistics-automation',
            'rpa-scanner',
            'ai-discovery',
            'integration-diagnostic',
            'digital-value-pool',
            'legacy-analyzer',
            'data-inventory',
            'pain-to-solution',
            'pain-explorer',
          ],
          automation: ['process-automation'],
        };
        const toolTypes = categoryMap[String(category).toLowerCase()] || [];
        if (toolTypes.length > 0) {
          sql += ` AND tool_type IN (${toolTypes.map(() => '?').join(', ')})`;
          params.push(...toolTypes);
        }
      }

      sql += ` ORDER BY updated_at DESC`;

      // Pagination
      const limitNum = Math.min(parseInt(String(limit), 10) || 50, 100);
      const offsetNum = parseInt(String(offset), 10) || 0;
      sql += ` LIMIT ? OFFSET ?`;
      params.push(limitNum, offsetNum);

      const sessions = (await queryHelpers.queryAll(sql, params)) as ToolSessionRow[];

      // Count total for pagination
      let countSql = `SELECT COUNT(*) as total FROM tool_sessions WHERE organization_id = ?`;
      const countParams: unknown[] = [user.organizationId];
      if (projectId) {
        countSql += ` AND project_id = ?`;
        countParams.push(projectId);
      }
      if (status) {
        const statuses = String(status)
          .split(',')
          .map((s) => s.trim().toUpperCase());
        countSql += ` AND UPPER(status) IN (${statuses.map(() => '?').join(', ')})`;
        countParams.push(...statuses);
      }
      if (toolType) {
        countSql += ` AND tool_type = ?`;
        countParams.push(toolType);
      }
      const countResult = (await queryHelpers.queryOne(countSql, countParams)) as {
        total: number;
      } | null;
      const total = Number(countResult?.total ?? 0);

      // Transform to frontend format
      const items = sessions.map((session) => ({
        id: session.id,
        name: session.name,
        toolType: session.tool_type,
        status: normalizeStatus(session.status),
        progress: session.completion_percent || 0,
        confidenceAvg: session.confidence_avg || 0,
        projectId: session.project_id,
        createdBy: session.created_by,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        reviewRequestedAt: session.review_requested_at,
        approvedAt: session.approved_at,
      }));

      res.json({
        items,
        total,
        limit: limitNum,
        offset: offsetNum,
      });
    }
  );

  /**
   * V4-TOOL-01: Tools hub — sessions + library in one response for unified navigation
   */
  static getToolsHub = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await ensureToolsSchema();

      const [sessionsRows, libraryResult] = await Promise.all([
        queryHelpers.queryAll(
          `SELECT id, name, tool_type, status, completion_percent, confidence_avg, project_id, created_by, created_at, updated_at
           FROM tool_sessions WHERE organization_id = ? ORDER BY updated_at DESC LIMIT 50`,
          [user.organizationId]
        ) as Promise<ToolSessionRow[]>,
        KnownToolsService.listKnownTools({ lang: 'en', limit: 100, offset: 0 }),
      ]);

      const sessions = (sessionsRows || []).map((s) => ({
        id: s.id,
        name: s.name,
        toolType: s.tool_type,
        status: normalizeStatus(s.status),
        progress: s.completion_percent || 0,
        confidenceAvg: s.confidence_avg || 0,
        projectId: s.project_id,
        createdAt: s.created_at,
        updatedAt: s.created_at,
      }));

      res.json({
        sessions: { items: sessions, total: sessions.length },
        library: libraryResult,
      });
    }
  );

  /**
   * #64: AI picker — "which tool do I pick?"
   * Free-text problem description in, top-3 candidate tools out, each with a
   * 1-sentence reasoning. Fail-soft: any error resolves to an empty list, the
   * client falls back to manual tool selection (never a 500).
   */
  static suggestTool = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { problemDescription, lang } = req.body as {
        problemDescription: string;
        lang?: 'en' | 'pl';
      };

      try {
        const { suggestTools } = await import('../services/toolSuggestService.js');
        const suggestions = await suggestTools(problemDescription, lang || 'en');
        res.json({ suggestions });
      } catch (err) {
        // Fail-open: a suggest error is never a 500 — the picker UI falls back
        // to manual selection.
        logger.warn('[ToolController] suggestTool threw unexpectedly, returning empty list', {
          err,
        });
        res.json({ suggestions: [] });
      }
    }
  );

  /**
   * V4-TOOL-02: DoD check — returns what's missing before tool can be approved
   */
  static getToolDoDCheck = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { toolId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const session = (await queryHelpers.queryOne(
        `SELECT completion_percent, confidence_avg, status FROM tool_sessions WHERE id = ? AND organization_id = ?`,
        [toolId, user.organizationId]
      )) as { completion_percent?: number; confidence_avg?: number; status?: string } | null;

      if (!session) {
        res.status(404).json({ error: 'Tool session not found' });
        return;
      }

      const completion = session.completion_percent || 0;
      const confidence = session.confidence_avg || 0;
      const missing: string[] = [];
      if (completion < 100) missing.push(`Completion ${completion}% (required 100%)`);
      if (confidence < 3) missing.push(`Confidence ${confidence} (required ≥3)`);
      const passed = missing.length === 0;

      res.json({
        passed,
        missing,
        completion,
        confidence,
        readyForApproval: passed && normalizeStatus(session.status) === 'REVIEW',
      });
    }
  );

  static getToolSession = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { toolId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const session = (await queryHelpers.queryOne(
        `SELECT * FROM tool_sessions WHERE id = ? AND organization_id = ?`,
        [toolId, user.organizationId]
      )) as ToolSessionRow | null;

      if (!session) {
        res.status(404).json({ error: 'Tool session not found' });
        return;
      }

      const initiatives = await queryHelpers.queryAll(
        `SELECT i.id, i.name as title, i.status, l.batch_id
         FROM tool_initiative_links l
         LEFT JOIN initiatives i ON l.initiative_id = i.id
         WHERE l.tool_session_id = ?
         ORDER BY l.created_at DESC`,
        [toolId]
      );

      const decisions = await queryHelpers.queryAll(
        `SELECT td.decision_type, td.status, td.decision_id, d.status as decision_status
         FROM tool_decisions td
         LEFT JOIN decisions d ON td.decision_id = d.id
         WHERE td.tool_session_id = ?`,
        [toolId]
      );

      const permissions = {
        canRequestReview: await ensurePermission(req, 'TOOLS_REQUEST_REVIEW'),
        canApproveTool: await ensurePermission(req, 'TOOLS_APPROVE'),
        canGenerate: await ensurePermission(req, 'TOOLS_GENERATE_INITIATIVES'),
      };

      res.json({
        id: session.id,
        name: session.name,
        toolType: session.tool_type,
        status: normalizeStatus(session.status),
        progress: session.completion_percent || 0,
        confidenceAvg: session.confidence_avg || 0,
        projectId: session.project_id,
        createdBy: session.created_by,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        reviewRequestedAt: session.review_requested_at,
        approvedAt: session.approved_at,
        // Fail-soft: a corrupt JSON blob must degrade to an empty object (the UI
        // shows an empty-but-editable session), never a 500 that blocks resume.
        answers: safeJsonParse(session.answers_json),
        contextSnapshot: safeJsonParse(session.context_snapshot),
        wizardState: safeParseJSON((session as any).wizard_state_json, null),
        missingItems: safeParseJSON((session as any).missing_items_json, []),
        failureReason: (session as any).failure_reason || null,
        lastGenerationBatchId: (session as any).last_generation_batch_id || null,
        generatedInitiatives: initiatives,
        decisions,
        permissions,
      });
    }
  );

  static updateToolSession = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { toolId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const {
        answers,
        completionPercent,
        confidenceAvg,
        contextSnapshot,
        status: requestedStatus,
        wizardState,
        missingItems,
        failureReason,
      } = req.body;

      const existing = (await queryHelpers.queryOne(
        `SELECT status, missing_items_json, runtime_contract_json, answers_json, dod_status, completion_percent, confidence_avg, tool_type, name, project_id
         FROM tool_sessions WHERE id = ? AND organization_id = ?`,
        [toolId, user.organizationId]
      )) as Pick<
        ToolSessionRow,
        | 'status'
        | 'missing_items_json'
        | 'runtime_contract_json'
        | 'answers_json'
        | 'dod_status'
        | 'completion_percent'
        | 'confidence_avg'
        | 'tool_type'
        | 'name'
        | 'project_id'
      > | null;
      if (!existing) {
        res.status(404).json({ error: 'Tool session not found' });
        return;
      }
      const existingStatus = normalizeStatus(existing.status);

      // Enforce report immutability after approval/generation
      if (
        (existingStatus === 'APPROVED' || existingStatus === 'GENERATED') &&
        requestedStatus !== 'FAILED'
      ) {
        res.status(409).json({ error: 'Tool session is locked after approval' });
        return;
      }

      // P27-B: Status transition validation
      const VALID_TRANSITIONS: Record<string, string[]> = {
        DRAFT: ['IN_PROGRESS', 'FAILED'],
        IN_PROGRESS: ['DRAFT', 'REVIEW', 'FINALIZED', 'FAILED'],
        REVIEW: ['DRAFT', 'FINALIZED', 'FAILED'],
        FINALIZED: ['FAILED'],
        FAILED: ['DRAFT', 'IN_PROGRESS'],
        APPROVED: ['FAILED'],
        GENERATED: ['FAILED'],
      };

      let newStatus = existingStatus;
      if (requestedStatus) {
        const allowed = VALID_TRANSITIONS[existingStatus] || [];
        if (!allowed.includes(requestedStatus)) {
          res.status(409).json({
            error: `Invalid status transition: ${existingStatus} → ${requestedStatus}`,
            allowedTransitions: allowed,
          });
          return;
        }
        newStatus = requestedStatus;
      }

      // P27-B: Finalize gating — block FINALIZED if unresolved blockers exist
      if (newStatus === 'FINALIZED') {
        const promotionBlockers = getPromotionBlockers(
          {
            id: toolId,
            organization_id: user.organizationId,
            runtime_contract_json: existing.runtime_contract_json || null,
            answers_json:
              answers !== undefined
                ? JSON.stringify(answers || {})
                : (existing.answers_json ?? null),
            dod_status: existing.dod_status || null,
            completion_percent:
              completionPercent !== undefined
                ? completionPercent
                : Number(existing.completion_percent || 0),
            confidence_avg:
              confidenceAvg !== undefined ? confidenceAvg : Number(existing.confidence_avg || 0),
          },
          missingItems !== undefined
            ? missingItems
            : safeJsonParseAny<ToolMissingItem[]>(existing.missing_items_json, [])
        );
        if (promotionBlockers.all.length > 0) {
          res.status(409).json({
            error: 'Cannot finalize: unresolved missing items or incomplete runtime gates',
            unresolvedMissingItems: promotionBlockers.missingItems,
            incompleteRuntimeGates: promotionBlockers.runtime,
          });
          return;
        }
      }

      const now = new Date().toISOString();
      // H3 resume-hardening: PARTIAL update semantics. All payload fields are
      // optional (UpdateToolSessionSchema) and live callers save different
      // slices (e.g. wizard auto-save sends only wizardState+status). The old
      // unconditional SET wiped answers_json/context_snapshot to '{}' and
      // zeroed completion/confidence on every partial save — destroying the
      // session state a user resumes into and permanently blocking the DoD
      // gate (confidence >= 3). Only update columns the caller actually sent.
      const setClauses = ['status = ?', 'updated_by = ?', 'updated_at = ?'];
      const params: unknown[] = [newStatus, user.id, now];

      if (answers !== undefined) {
        setClauses.push('answers_json = ?');
        params.push(JSON.stringify(answers || {}));
        // TLS-04 fix (Codex BLOCKER 1): every write to the SWOT/tool-session
        // content itself must bump `version` -- this is the CAS anchor
        // swot_proposals.expected_version is checked against. Before this
        // fix, only acceptSwotProposal incremented it, so a stale AI
        // proposal generated against an OLD version could still pass its
        // CAS check and clobber a manual edit/autosave made in between
        // (version never moved to reflect that edit). Scoped to ONLY this
        // branch -- a wizardState-only or status-only save must NOT bump
        // version, since it doesn't change SWOT content a proposal could
        // conflict with.
        setClauses.push('version = version + 1');
      }
      if (contextSnapshot !== undefined) {
        setClauses.push('context_snapshot = ?');
        params.push(JSON.stringify(contextSnapshot || {}));
      }
      if (completionPercent !== undefined) {
        setClauses.push('completion_percent = ?');
        params.push(completionPercent ?? 0);
      }
      if (confidenceAvg !== undefined) {
        setClauses.push('confidence_avg = ?');
        params.push(confidenceAvg ?? 0);
      }

      if (wizardState !== undefined) {
        setClauses.push('wizard_state_json = ?');
        params.push(JSON.stringify(wizardState));
      }
      if (missingItems !== undefined) {
        setClauses.push('missing_items_json = ?');
        params.push(JSON.stringify(missingItems));
      }
      if (failureReason !== undefined) {
        setClauses.push('failure_reason = ?');
        params.push(failureReason || null);
      }

      params.push(toolId, user.organizationId);

      await queryHelpers.queryRun(
        `UPDATE tool_sessions SET ${setClauses.join(', ')} WHERE id = ? AND organization_id = ?`,
        params
      );

      if (requestedStatus && requestedStatus !== existingStatus) {
        await logAudit(user.organizationId, user.id, 'tool_status_changed', toolId, {
          from: existingStatus,
          to: newStatus,
          failureReason: failureReason || undefined,
        });
      }

      await organizationContextService.recordToolSession({
        organizationId: user.organizationId,
        userId: user.id,
        payload: {
          toolId,
          toolType: req.body?.toolType || null,
          name: req.body?.name || null,
          answers,
          contextSnapshot,
          completionPercent,
          confidenceAvg,
        },
      });

      // CONCLUSION_LAYER bridge: when the synced answers carry a generated W2
      // conclusion (summary.verdict / executiveSummary), persist it as a
      // Conclusion candidate. Fire-and-forget + fail-safe — a Conclusion write
      // failure must never break the tool session save.
      void safePersistToolSessionConclusion(
        {
          organizationId: user.organizationId,
          projectId: existing.project_id ?? null,
          actorUserId: user.id,
          sessionId: toolId,
          toolType: req.body?.toolType || existing.tool_type || null,
          name: req.body?.name || existing.name || null,
          // Partial saves may omit answers — bridge from the persisted state so
          // a wizard-only save cannot erase an already-generated W2 conclusion.
          answers: answers !== undefined ? answers : safeJsonParse(existing.answers_json),
          confidenceAvg: confidenceAvg ?? Number(existing.confidence_avg || 0),
        },
        { logger }
      );

      res.json({ id: toolId, status: newStatus, updatedAt: now });
    }
  );

  static requestReview = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { toolId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const allowed = await ensurePermission(req, 'TOOLS_REQUEST_REVIEW');
      if (!allowed) {
        res.status(403).json({ error: 'Permission denied' });
        return;
      }

      const session = (await queryHelpers.queryOne(
        `SELECT * FROM tool_sessions WHERE id = ? AND organization_id = ?`,
        [toolId, user.organizationId]
      )) as ToolSessionRow | null;

      if (!session) {
        res.status(404).json({ error: 'Tool session not found' });
        return;
      }

      if (!['DRAFT', 'IN_PROGRESS', 'FINALIZED'].includes(normalizeStatus(session.status))) {
        res.status(409).json({ error: 'Tool session not ready for review request' });
        return;
      }

      const promotionBlockers = getPromotionBlockers(
        session,
        safeJsonParseAny<ToolMissingItem[]>((session as any).missing_items_json, [])
      );
      if (!requireDoD(session) || promotionBlockers.all.length > 0) {
        res.status(409).json({
          error: 'DoD not satisfied',
          unresolvedMissingItems: promotionBlockers.missingItems,
          incompleteRuntimeGates: promotionBlockers.runtime,
        });
        return;
      }

      const { decisionOwnerId, dueDate, priority } = req.body || {};
      const now = new Date().toISOString();
      const decisionId = await createDecisionRecord({
        orgId: user.organizationId,
        projectId: session.project_id,
        title: `Request review for tool ${session.name}`,
        decisionType: 'TOOL_REVIEW',
        decisionOwnerId: decisionOwnerId || user.id,
        status: 'pending',
        createdBy: user.id,
        dueDate: dueDate || null,
        priority: priority || null,
      });

      await upsertToolDecision({
        toolSessionId: toolId,
        decisionType: 'REQUEST_REVIEW',
        status: 'PENDING',
        decisionId,
        createdBy: user.id,
      });

      await queryHelpers.queryRun(
        `UPDATE tool_sessions SET status = 'REVIEW', review_requested_at = ?, updated_at = ? WHERE id = ?`,
        [now, now, toolId]
      );

      await logAudit(user.organizationId, user.id, 'tool_review_requested', toolId, {
        decisionId,
      });

      res.json({ id: toolId, status: 'REVIEW' });
    }
  );

  static approveTool = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { toolId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const allowed = await ensurePermission(req, 'TOOLS_APPROVE');
      if (!allowed) {
        res.status(403).json({ error: 'Permission denied' });
        return;
      }

      const session = (await queryHelpers.queryOne(
        `SELECT * FROM tool_sessions WHERE id = ? AND organization_id = ?`,
        [toolId, user.organizationId]
      )) as ToolSessionRow | null;

      if (!session) {
        res.status(404).json({ error: 'Tool session not found' });
        return;
      }

      if (normalizeStatus(session.status) !== 'REVIEW') {
        res.status(409).json({ error: 'Tool session not in review' });
        return;
      }

      const promotionBlockers = getPromotionBlockers(
        session,
        safeJsonParseAny<ToolMissingItem[]>((session as any).missing_items_json, [])
      );
      if (!requireDoD(session) || promotionBlockers.all.length > 0) {
        res.status(409).json({
          error: 'DoD not satisfied',
          unresolvedMissingItems: promotionBlockers.missingItems,
          incompleteRuntimeGates: promotionBlockers.runtime,
        });
        return;
      }

      const { decisionOwnerId, dueDate, priority } = req.body || {};
      const now = new Date().toISOString();
      const decisionId = await createDecisionRecord({
        orgId: user.organizationId,
        projectId: session.project_id,
        title: `Approve tool ${session.name}`,
        decisionType: 'TOOL_APPROVE',
        decisionOwnerId: decisionOwnerId || user.id,
        status: 'approved',
        createdBy: user.id,
        dueDate: dueDate || null,
        priority: priority || null,
      });

      await upsertToolDecision({
        toolSessionId: toolId,
        decisionType: 'APPROVE_TOOL',
        status: 'APPROVED',
        decisionId,
        createdBy: user.id,
      });

      // Freeze an immutable snapshot for the Tool Report export & audit trail
      // Store under context_snapshot to avoid schema changes (v1 approach).
      let approvedSnapshot: unknown = {};
      try {
        approvedSnapshot = {
          toolSessionId: toolId,
          toolType: session.tool_type,
          name: session.name,
          approvedAt: now,
          approvedBy: user.id,
          completionPercent: session.completion_percent ?? 0,
          confidenceAvg: session.confidence_avg ?? 0,
          answers: session.answers_json ? JSON.parse(session.answers_json) : {},
        };
      } catch {
        approvedSnapshot = { toolSessionId: toolId, approvedAt: now };
      }
      const frozenContextSnapshot = JSON.stringify({
        ...(session.context_snapshot ? safeJsonParse(session.context_snapshot) : {}),
        approvedSnapshot,
        snapshotVersion: 1,
      });

      await queryHelpers.queryRun(
        `UPDATE tool_sessions
         SET status = 'APPROVED', approved_at = ?, updated_at = ?, context_snapshot = ?
         WHERE id = ?`,
        [now, now, frozenContextSnapshot, toolId]
      );

      await logAudit(user.organizationId, user.id, 'tool_approved', toolId, {
        decisionId,
      });

      // CONCLUSION_LAYER bridge: the approve gate is the strongest evidence
      // signal — re-persist the session's W2 conclusion with the final answers.
      // Fire-and-forget + fail-safe (must never break approval).
      void safePersistToolSessionConclusion(
        {
          organizationId: user.organizationId,
          projectId: session.project_id ?? null,
          actorUserId: user.id,
          sessionId: toolId,
          toolType: session.tool_type || null,
          name: session.name || null,
          answers: safeParseJSON<Record<string, unknown>>(session.answers_json, {}),
          confidenceAvg: Number(session.confidence_avg || 0),
        },
        { logger }
      );

      res.json({ id: toolId, status: 'APPROVED' });
    }
  );

  static sendBackToDraft = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { toolId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const allowed = await ensurePermission(req, 'TOOLS_APPROVE');
      if (!allowed) {
        res.status(403).json({ error: 'Permission denied' });
        return;
      }

      const { comment } = req.body || {};
      const now = new Date().toISOString();

      const session = (await queryHelpers.queryOne(
        `SELECT * FROM tool_sessions WHERE id = ? AND organization_id = ?`,
        [toolId, user.organizationId]
      )) as ToolSessionRow | null;

      if (!session) {
        res.status(404).json({ error: 'Tool session not found' });
        return;
      }

      if (normalizeStatus(session.status) !== 'REVIEW') {
        res.status(409).json({ error: 'Tool session not in review' });
        return;
      }

      if (!comment || String(comment).trim().length === 0) {
        res.status(400).json({ error: 'Comment is required' });
        return;
      }

      const decisionId = await createDecisionRecord({
        orgId: user.organizationId,
        projectId: session.project_id,
        title: `Send back tool ${session.name}`,
        decisionType: 'TOOL_APPROVE',
        decisionOwnerId: user.id,
        status: 'rejected',
        createdBy: user.id,
      });

      await upsertToolDecision({
        toolSessionId: toolId,
        decisionType: 'APPROVE_TOOL',
        status: 'REJECTED',
        decisionId,
        comment: comment || null,
        createdBy: user.id,
      });

      await queryHelpers.queryRun(
        `UPDATE tool_sessions 
         SET status = 'DRAFT', approved_at = NULL, review_requested_at = NULL, updated_at = ?
         WHERE id = ?`,
        [now, toolId]
      );

      await logAudit(user.organizationId, user.id, 'tool_sent_back', toolId, {
        decisionId,
        comment,
      });

      res.json({ id: toolId, status: 'DRAFT' });
    }
  );

  static generateInitiatives = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { toolId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const allowed = await ensurePermission(req, 'TOOLS_GENERATE_INITIATIVES');
      if (!allowed) {
        res.status(403).json({ error: 'Permission denied' });
        return;
      }

      const { methodologyId, count, includeChatContext, decisionOwnerId, dueDate, priority } =
        req.body;
      if (!methodologyId || !count) {
        res.status(400).json({ error: 'methodologyId and count are required' });
        return;
      }
      if (count > 7) {
        res.status(400).json({ error: 'Initiative count exceeds limit 7' });
        return;
      }

      const session = (await queryHelpers.queryOne(
        `SELECT * FROM tool_sessions WHERE id = ? AND organization_id = ?`,
        [toolId, user.organizationId]
      )) as ToolSessionRow | null;

      if (!session) {
        res.status(404).json({ error: 'Tool session not found' });
        return;
      }

      const sessionStatus = normalizeStatus(session.status);
      if (sessionStatus !== 'APPROVED' && sessionStatus !== 'GENERATED') {
        res.status(409).json({ error: 'Tool session not approved' });
        return;
      }

      const promotionBlockers = getPromotionBlockers(
        session,
        safeJsonParseAny<ToolMissingItem[]>((session as any).missing_items_json, [])
      );
      if (!requireDoD(session) || promotionBlockers.all.length > 0) {
        res.status(409).json({
          error: 'DoD not satisfied',
          unresolvedMissingItems: promotionBlockers.missingItems,
          incompleteRuntimeGates: promotionBlockers.runtime,
        });
        return;
      }

      if (
        !session.answers_json ||
        session.answers_json === '{}' ||
        session.answers_json === 'null'
      ) {
        res.status(409).json({ error: 'Missing tool context for generation' });
        return;
      }

      // P27-B: Idempotency guard — check if this exact generation was already done
      const existingBatch = (await queryHelpers.queryOne(
        `SELECT b.id, COUNT(l.id) as link_count
         FROM tool_initiative_batches b
         LEFT JOIN tool_initiative_links l ON b.id = l.batch_id
         WHERE b.tool_session_id = ? AND b.methodology_id = ? AND b.initiatives_count = ?
         GROUP BY b.id
         ORDER BY b.created_at DESC LIMIT 1`,
        [toolId, methodologyId, count]
      )) as { id: string; link_count: number } | null;

      if (existingBatch && existingBatch.link_count > 0) {
        const existingInitiatives = await queryHelpers.queryAll(
          `SELECT i.id, COALESCE(i.title, i.name) as title, i.status
           FROM tool_initiative_links l
           LEFT JOIN initiatives i ON l.initiative_id = i.id
           WHERE l.batch_id = ?
           ORDER BY l.created_at`,
          [existingBatch.id]
        );
        res.json({
          batchId: existingBatch.id,
          initiatives: existingInitiatives,
          status: normalizeStatus(session.status),
          deduplicated: true,
        });
        return;
      }

      const batchId = uuidv4();
      const now = new Date().toISOString();
      await queryHelpers.queryRun(
        `INSERT INTO tool_initiative_batches (
          id, tool_session_id, methodology_id, initiatives_count, include_chat_context, generated_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [batchId, toolId, methodologyId, count, includeChatContext ? 1 : 0, user.id, now]
      );

      const decisionId = await createDecisionRecord({
        orgId: user.organizationId,
        projectId: session.project_id,
        title: `Generate initiatives from tool ${session.name}`,
        decisionType: 'TOOL_GENERATE',
        decisionOwnerId: decisionOwnerId || user.id,
        status: 'approved',
        createdBy: user.id,
        dueDate: dueDate || null,
        priority: priority || null,
      });
      await upsertToolDecision({
        toolSessionId: toolId,
        decisionType: 'GENERATE_INITIATIVES',
        status: 'APPROVED',
        decisionId,
        createdBy: user.id,
      });

      let initiatives: Awaited<ReturnType<typeof ToolInitiativeService.generateFromSession>>;
      let created: Awaited<ReturnType<typeof ToolInitiativeService.persistInitiatives>>;
      // #68b — functional parity with the canonical InitiativeWizardModal
      // (POST /initiatives/similarity-check): before persisting, compare the
      // AI-generated candidates against the org/project's existing active
      // initiatives so Tools -> Initiatives stops proposing initiatives the
      // portfolio already has. Informational only — mirrors the wizard's own
      // doctrine ("never blocks") and is intentionally isolated in its own
      // try/catch so a similarity-service outage never fails generation.
      const duplicateWarnings: Array<{
        title: string;
        verdict: 'duplicate' | 'similar' | 'related' | 'new';
        topMatch: { id: string; title: string; status: string; score: number } | null;
      }> = [];
      // I1 — actionable dedup (owner greenlight 07-19, I2/I3 on hold). When the
      // operator flag is ON, high-confidence duplicates (verdict === 'duplicate',
      // score ≥ the service's duplicate threshold) are SKIPPED at persist time
      // instead of being created and warned about after the fact. Lower-confidence
      // 'similar' candidates are NOT skipped (false-positive risk) — they stay
      // created + surfaced as a warning, exactly like today. Flag OFF (default)
      // → byte-for-byte the current behaviour: everything persisted.
      const dedupActionable = process.env.INITIATIVE_DEDUP_ACTIONABLE === 'true';
      const skipped: Array<{
        title: string;
        topMatch: { id: string; title: string; status: string; score: number } | null;
      }> = [];
      try {
        initiatives = await ToolInitiativeService.generateFromSession({
          toolSession: session,
          methodologyId,
          count,
          includeChatContext: Boolean(includeChatContext),
          userId: user.id,
        });

        const skipIndices = new Set<number>();
        try {
          const similarity = await checkSimilarInitiatives({
            orgId: user.organizationId,
            projectId: session.project_id || null,
            candidates: initiatives.map((i) => ({ title: i.title, description: i.description })),
          });
          for (const r of similarity.results) {
            if (r.verdict !== 'duplicate' && r.verdict !== 'similar') continue;
            const topMatch = r.matches[0]
              ? {
                  id: r.matches[0].id,
                  title: r.matches[0].title,
                  status: r.matches[0].status,
                  score: r.matches[0].score,
                }
              : null;
            // I1: only 'duplicate' (high confidence) is skippable; 'similar' stays a warning.
            if (dedupActionable && r.verdict === 'duplicate') {
              skipIndices.add(r.candidateIndex);
              skipped.push({ title: initiatives[r.candidateIndex]?.title || '', topMatch });
            } else {
              duplicateWarnings.push({
                title: initiatives[r.candidateIndex]?.title || '',
                verdict: r.verdict,
                topMatch,
              });
            }
          }
        } catch (similarityError: unknown) {
          logger.warn('[ToolController] similarity-check unavailable (non-blocking):', {
            toolId,
            error:
              similarityError instanceof Error ? similarityError.message : String(similarityError),
          });
        }

        // I1: persist only the non-skipped candidates (flag OFF → skipIndices empty → all).
        const toPersist =
          skipIndices.size > 0
            ? initiatives.filter((_, idx) => !skipIndices.has(idx))
            : initiatives;

        created = await ToolInitiativeService.persistInitiatives({
          toolSession: session,
          batchId,
          initiatives: toPersist,
          userId: user.id,
        });
      } catch (genError: unknown) {
        // ERR-LEAK (M11): log the real error server-side; never reflect raw
        // err.message / DB-driver text back to the client. The persisted
        // failure_reason is surfaced to the org owner via getToolSession, so it
        // is kept generic too.
        logger.error('Tool initiative generation failed', {
          toolId,
          batchId,
          orgId: user.organizationId,
          error: genError instanceof Error ? genError.message : String(genError),
        });
        const FAILURE_REASON = 'Initiative generation failed';
        // P27-B: Set FAILED state on generation error
        await queryHelpers.queryRun(
          `UPDATE tool_sessions SET status = 'FAILED', failure_reason = ?, updated_at = ? WHERE id = ?`,
          [FAILURE_REASON, now, toolId]
        );
        await logAudit(user.organizationId, user.id, 'tool_generation_failed', toolId, {
          batchId,
        });
        // Shape preserved: error / failureReason / batchId / status top-level keys.
        res.status(500).json({
          error: FAILURE_REASON,
          failureReason: FAILURE_REASON,
          code: 'TOOL_GENERATION_FAILED',
          batchId,
          status: 'FAILED',
        });
        return;
      }

      await logAudit(user.organizationId, user.id, 'initiatives_generated', toolId, {
        batchId,
        count: created.length,
        // I1: record how many high-confidence duplicates were skipped at persist time.
        skippedCount: skipped.length,
        decisionId,
      });

      // Mark session as GENERATED + store batch reference for idempotency
      await queryHelpers.queryRun(
        `UPDATE tool_sessions SET status = 'GENERATED', failure_reason = NULL, last_generation_batch_id = ?, updated_at = ? WHERE id = ?`,
        [batchId, now, toolId]
      );

      res.json({ batchId, initiatives: created, status: 'GENERATED', duplicateWarnings, skipped });
    }
  );

  /**
   * V4-TOOL-02: Evaluate runtime-contract DoD gates for a tool session.
   * Falls back to legacy completion/confidence check when no contract is stored.
   */
  static getRuntimeDoDStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { toolId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await ensureToolsSchema();

      const session = (await queryHelpers.queryOne(
        `SELECT id, answers_json, runtime_contract_json, dod_status, completion_percent, confidence_avg
         FROM tool_sessions WHERE id = ? AND organization_id = ?`,
        [toolId, user.organizationId]
      )) as ToolSessionRow | null;

      if (!session) {
        res.status(404).json({ error: 'Tool session not found' });
        return;
      }

      if (!session.runtime_contract_json) {
        const completion = session.completion_percent || 0;
        const confidence = session.confidence_avg || 0;
        const missing: string[] = [];
        if (completion < 100) missing.push(`Completion ${completion}% (required 100%)`);
        if (confidence < 3) missing.push(`Confidence ${confidence} (required ≥3)`);
        res.json({
          sessionId: toolId,
          allPassed: missing.length === 0,
          gates: [],
          legacy: true,
          missing,
        });
        return;
      }

      let contract: ToolRuntimeContract;
      try {
        contract = ToolRuntimeContractSchema.parse(JSON.parse(session.runtime_contract_json));
      } catch {
        res.status(422).json({ error: 'Invalid runtime contract stored on session' });
        return;
      }

      const sessionData = safeJsonParse(session.answers_json);
      const result = evaluateDoDGates(contract, sessionData);

      const dodStatus = result.allPassed ? 'passed' : 'pending';
      if (dodStatus !== session.dod_status) {
        await queryHelpers.queryRun(
          `UPDATE tool_sessions SET dod_status = ?, updated_at = ? WHERE id = ?`,
          [dodStatus, new Date().toISOString(), toolId]
        );
      }

      res.json({
        sessionId: toolId,
        allPassed: result.allPassed,
        gates: result.gates,
        legacy: false,
      });
    }
  );

  /**
   * V4-TOOL-02: Manually approve a specific DoD gate within the runtime contract.
   */
  static approveDoDGate = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { toolId, gateId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const allowed = await ensurePermission(req, 'TOOLS_APPROVE');
      if (!allowed) {
        res.status(403).json({ error: 'Permission denied' });
        return;
      }

      await ensureToolsSchema();

      const session = (await queryHelpers.queryOne(
        `SELECT id, runtime_contract_json, answers_json, dod_status
         FROM tool_sessions WHERE id = ? AND organization_id = ?`,
        [toolId, user.organizationId]
      )) as ToolSessionRow | null;

      if (!session) {
        res.status(404).json({ error: 'Tool session not found' });
        return;
      }

      if (!session.runtime_contract_json) {
        res.status(409).json({ error: 'No runtime contract on this session' });
        return;
      }

      let contract: ToolRuntimeContract;
      try {
        contract = ToolRuntimeContractSchema.parse(JSON.parse(session.runtime_contract_json));
      } catch {
        res.status(422).json({ error: 'Invalid runtime contract stored on session' });
        return;
      }

      const gateIndex = contract.dodGates.findIndex((g) => g.id === gateId);
      if (gateIndex === -1) {
        res.status(404).json({ error: `Gate ${gateId} not found in contract` });
        return;
      }

      const now = new Date().toISOString();
      contract.dodGates[gateIndex] = {
        ...contract.dodGates[gateIndex],
        passed: true,
        passedAt: now,
        passedBy: user.id,
      };

      const sessionData = safeJsonParse(session.answers_json);
      const result = evaluateDoDGates(contract, sessionData);
      const dodStatus = result.allPassed ? 'passed' : 'pending';

      await queryHelpers.queryRun(
        `UPDATE tool_sessions SET runtime_contract_json = ?, dod_status = ?, updated_at = ? WHERE id = ?`,
        [JSON.stringify(contract), dodStatus, now, toolId]
      );

      await logAudit(user.organizationId, user.id, 'dod_gate_approved', toolId, {
        gateId,
        dodStatus,
      });

      res.json({
        sessionId: toolId,
        gateId,
        approved: true,
        allPassed: result.allPassed,
        gates: result.gates,
      });
    }
  );

  /**
   * P27-B: Promote tool session results to a report or presentation
   * Creates a downstream artifact with traceability back to the tool session.
   */
  static promoteToOutput = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { toolId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { outputType, title: rawOutputTitle, description, selectedSections } = req.body;
      if (!outputType || !rawOutputTitle) {
        res.status(400).json({ error: 'outputType and title are required' });
        return;
      }
      // F15 (data-integrity, continuation of Z139): decode HTML entities the
      // global input-sanitization middleware escaped on this field before
      // storing — feeds initiatives.name / generic_assessment_reports.title /
      // my_ideas.title depending on outputType.
      const title = decodeHtmlEntities(String(rawOutputTitle));

      const validOutputTypes = ['initiative', 'report', 'presentation', 'idea'];
      if (!validOutputTypes.includes(outputType)) {
        res
          .status(400)
          .json({ error: `Invalid outputType. Must be one of: ${validOutputTypes.join(', ')}` });
        return;
      }

      const session = (await queryHelpers.queryOne(
        `SELECT * FROM tool_sessions WHERE id = ? AND organization_id = ?`,
        [toolId, user.organizationId]
      )) as ToolSessionRow | null;

      if (!session) {
        res.status(404).json({ error: 'Tool session not found' });
        return;
      }

      const sessionStatus = normalizeStatus(session.status);
      if (!['APPROVED', 'GENERATED', 'FINALIZED'].includes(sessionStatus)) {
        res.status(409).json({ error: 'Tool session must be approved/finalized before promotion' });
        return;
      }

      const promotionBlockers = getPromotionBlockers(
        session,
        safeJsonParseAny<ToolMissingItem[]>((session as any).missing_items_json, [])
      );
      if (promotionBlockers.all.length > 0) {
        res.status(409).json({
          error: 'Tool session is not eligible for promotion',
          unresolvedMissingItems: promotionBlockers.missingItems,
          incompleteRuntimeGates: promotionBlockers.runtime,
        });
        return;
      }

      const now = new Date().toISOString();
      const promoteBatchId = `promote-${outputType}`;
      const existingPromotion = (await queryHelpers.queryOne(
        `SELECT initiative_id FROM tool_initiative_links
         WHERE tool_session_id = ? AND batch_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [toolId, promoteBatchId]
      )) as { initiative_id?: string | null } | null;

      if (existingPromotion?.initiative_id) {
        if (outputType === 'report') {
          const existingReport = await ReportBuilderService.getReport(
            existingPromotion.initiative_id,
            user.organizationId
          );
          if (!existingReport) {
            res.status(409).json({ error: 'Existing report promotion is no longer available' });
            return;
          }
        }
        res.json({
          id: existingPromotion.initiative_id,
          outputType,
          title,
          sourceSessionId: toolId,
          sourceToolType: session.tool_type,
          createdAt: now,
          deduplicated: true,
        });
        return;
      }

      const outputId = uuidv4();
      const sourceVersion = 1;
      const toolTrace = {
        source_type: 'tool',
        source_id: toolId,
        source_version: sourceVersion,
        tool_type: session.tool_type,
        promoted_at: now,
        promotion_type: outputType,
      };

      let initiativeOutputId = outputId;
      if (outputType === 'initiative') {
        // Uspójnienie F1.8 — przez kanoniczny lejek (DRAFT + name/title + lineage).
        if (process.env.INITIATIVE_FUNNEL_ENABLED === 'true') {
          const __r = await funnelCreateInitiative(
            session.organization_id,
            {
              title,
              projectId: session.project_id || null,
              summary: description || '',
              axis: 'operations',
              sourceType: 'tool',
              sourceId: toolId,
            },
            { validate: false, actor: { id: user.id } }
          );
          initiativeOutputId = __r.id;
          // Extra column not set by the funnel — post-create UPDATE (best-effort).
          try {
            await queryHelpers.queryRun(
              `UPDATE initiatives SET priority_order = ? WHERE id = ? AND organization_id = ?`,
              [2, initiativeOutputId, session.organization_id]
            );
          } catch {
            // priority_order column may be absent on legacy schemas
          }
        } else {
          // D1 (Zwornik §9 Faza 3): live path (funnel flag off) — anchor to
          // the portfolio project instead of persisting project_id NULL.
          const anchoredProjectId = await resolveInitiativeProjectId(
            session.organization_id,
            session.project_id,
            { createdBy: user.id ?? null }
          );
          await queryHelpers.queryRun(
            `INSERT INTO initiatives (
              id, organization_id, project_id, name, summary, status, axis, source_type, source_id,
              priority_order, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              outputId,
              session.organization_id,
              anchoredProjectId,
              title,
              description || '',
              'DRAFT',
              'operations',
              'tool',
              toolId,
              2,
              now,
              now,
            ]
          );
        }
      }

      if (outputType === 'report') {
        if (process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL) {
          // Additive compatibility for pre-V3 Report Builder installations.
          // Both fields are required by the canonical quality/export read path.
          await queryHelpers.queryRun(
            `ALTER TABLE report_builder_sections ADD COLUMN IF NOT EXISTS source_refs_json TEXT`
          );
          await queryHelpers.queryRun(
            `ALTER TABLE report_builder_sections ADD COLUMN IF NOT EXISTS rag TEXT`
          );
        }
        const normalizedSections = Array.isArray(selectedSections)
          ? selectedSections.filter((value): value is string => typeof value === 'string')
          : [];
        const created = await ReportBuilderService.createReport({
          organizationId: session.organization_id,
          sourceType: 'TOOL',
          sourceId: toolId,
          sourceName: session.name,
          title,
          description: description || '',
          config: {
            toolType: session.tool_type,
            sourceVersion,
            selectedSections: normalizedSections,
            toolTrace,
          },
          createdBy: user.id,
        });
        initiativeOutputId = created.report.id;
        const approvedAnswers = safeJsonParseAny<Record<string, any>>(session.answers_json, {});
        const sectionSourceRefs = JSON.stringify([
          {
            artifact_id: toolId,
            artifact_type: 'tool_session',
            artifact_name: session.name,
          },
        ]);
        for (const section of created.sections) {
          await queryHelpers.queryRun(
            `UPDATE report_builder_sections
             SET generated_content = ?, source_refs_json = ?, updated_at = ?
             WHERE id = ? AND report_id = ?`,
            [
              renderToolReportSection(section.title, section.sectionKey, session, approvedAnswers),
              sectionSourceRefs,
              now,
              section.id,
              created.report.id,
            ]
          );
        }
        await queryHelpers.queryRun(
          `UPDATE report_builder_reports
           SET status = 'GENERATED', updated_at = ?
           WHERE id = ? AND organization_id = ?`,
          [now, created.report.id, session.organization_id]
        );
      }

      if (outputType === 'presentation') {
        try {
          await queryHelpers.queryRun(
            `INSERT INTO v8_artifact_runs (
              id, organization_id, artifact_type, output_type, status,
              config_json, result_json, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              outputId,
              session.organization_id,
              'tool_promotion',
              'presentation',
              'completed',
              JSON.stringify({ ...toolTrace, title }),
              JSON.stringify({
                title,
                description: description || '',
                promoted_from_session: toolId,
                tool_trace: toolTrace,
              }),
              user.id,
              now,
              now,
            ]
          );
        } catch {
          // Table may not exist
        }
      }

      if (outputType === 'idea') {
        try {
          await queryHelpers.queryRun(
            `INSERT INTO my_ideas (
              id, user_id, organization_id, title, body, tags, source_type, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              outputId,
              user.id,
              session.organization_id,
              title,
              description || '',
              JSON.stringify(['tool-output', session.tool_type]),
              'tool',
              now,
              now,
            ]
          );
        } catch {
          // Table may not exist
        }
      }

      // Thread the funnel-created id downstream for the initiative path (F1.8);
      // other output types keep the locally-generated outputId.
      const effectiveOutputId =
        outputType === 'initiative' || outputType === 'report' ? initiativeOutputId : outputId;

      // Record promotion link for traceability
      await queryHelpers.queryRun(
        `INSERT INTO tool_initiative_links (id, tool_session_id, batch_id, initiative_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), toolId, promoteBatchId, effectiveOutputId, now]
      );

      await logAudit(user.organizationId, user.id, `tool_promoted_to_${outputType}`, toolId, {
        outputId: effectiveOutputId,
        outputType,
        title,
      });

      res.json({
        id: effectiveOutputId,
        outputType,
        title,
        sourceSessionId: toolId,
        sourceToolType: session.tool_type,
        sourceVersion,
        toolTrace,
        createdAt: now,
      });
    }
  );

  /**
   * P27-B: Retry from FAILED state — resets to IN_PROGRESS, clears failure reason
   */
  static retryFromFailure = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { toolId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const session = (await queryHelpers.queryOne(
        `SELECT id, status FROM tool_sessions WHERE id = ? AND organization_id = ?`,
        [toolId, user.organizationId]
      )) as { id: string; status: string } | null;

      if (!session) {
        res.status(404).json({ error: 'Tool session not found' });
        return;
      }

      if (normalizeStatus(session.status) !== 'FAILED') {
        res.status(409).json({ error: 'Tool session is not in FAILED state' });
        return;
      }

      const now = new Date().toISOString();
      await queryHelpers.queryRun(
        `UPDATE tool_sessions SET status = 'IN_PROGRESS', failure_reason = NULL, updated_by = ?, updated_at = ? WHERE id = ?`,
        [user.id, now, toolId]
      );

      await logAudit(user.organizationId, user.id, 'tool_retry_from_failure', toolId);

      res.json({ id: toolId, status: 'IN_PROGRESS', updatedAt: now });
    }
  );

  static getGeneratedInitiatives = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { toolId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // SEC (wave-5 parent-ownership pattern): the generated-initiative listing must be
      // gated by the parent tool session's org. Without this, a foreign-org toolId would
      // leak that org's generated-initiative titles/statuses (tool_initiative_links has no
      // organization_id column of its own, so ownership is asserted via tool_sessions).
      const ownedSession = (await queryHelpers.queryOne(
        `SELECT id FROM tool_sessions WHERE id = ? AND organization_id = ?`,
        [toolId, user.organizationId]
      )) as { id: string } | null;

      if (!ownedSession) {
        res.status(404).json({ error: 'Tool session not found' });
        return;
      }

      const initiatives = await queryHelpers.queryAll(
        `SELECT i.id, COALESCE(i.title, i.name) as title, i.status, l.batch_id
         FROM tool_initiative_links l
         LEFT JOIN initiatives i ON l.initiative_id = i.id
         WHERE l.tool_session_id = ?
         ORDER BY l.created_at DESC`,
        [toolId]
      );

      res.json({ initiatives });
    }
  );

  static listComments = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { toolId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await ensureToolCommentsSchema();

      const session = (await queryHelpers.queryOne(
        `SELECT id FROM tool_sessions WHERE id = ? AND organization_id = ?`,
        [toolId, user.organizationId]
      )) as { id: string } | null;

      if (!session) {
        res.status(404).json({ error: 'Tool session not found' });
        return;
      }

      const comments = await queryHelpers.queryAll(
        `SELECT
          c.id,
          c.content,
          c.priority,
          c.user_id as "authorId",
          COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), u.email, 'User') as "authorName",
          c.created_at as "createdAt"
         FROM tool_comments c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.tool_session_id = ? AND c.organization_id = ?
         ORDER BY c.created_at DESC`,
        [toolId, user.organizationId]
      );

      res.json(comments);
    }
  );

  static addComment = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { toolId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const content = String(req.body?.content || req.body?.text || '').trim();
      if (!content) {
        res.status(400).json({ error: 'Comment content is required' });
        return;
      }

      await ensureToolCommentsSchema();

      const session = (await queryHelpers.queryOne(
        `SELECT id FROM tool_sessions WHERE id = ? AND organization_id = ?`,
        [toolId, user.organizationId]
      )) as { id: string } | null;

      if (!session) {
        res.status(404).json({ error: 'Tool session not found' });
        return;
      }

      const now = new Date().toISOString();
      const id = uuidv4();
      const priority = String(req.body?.priority || 'normal');

      await queryHelpers.queryRun(
        `INSERT INTO tool_comments (id, tool_session_id, organization_id, user_id, content, priority, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, toolId, user.organizationId, user.id, content, priority, now]
      );

      await logAudit(user.organizationId, user.id, 'tool_comment_added', toolId, { commentId: id });

      res.status(201).json({
        id,
        content,
        priority,
        authorId: user.id,
        authorName:
          [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'User',
        createdAt: now,
      });
    }
  );

  static deleteComment = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { toolId, commentId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await ensureToolCommentsSchema();

      const comment = (await queryHelpers.queryOne(
        `SELECT id, user_id FROM tool_comments WHERE id = ? AND tool_session_id = ? AND organization_id = ?`,
        [commentId, toolId, user.organizationId]
      )) as { id: string; user_id: string } | null;

      if (!comment) {
        res.status(404).json({ error: 'Comment not found' });
        return;
      }

      // FIX (role-case family): user.role is lowercase on AuthenticatedUser
      // (mapRoleForAuthenticatedUser emits 'owner'/'administrator'/...); this guard
      // compared against uppercase literals directly, so a real OWNER could never
      // delete another user's comment. Normalize before comparing.
      const commentGuardRole = String(user.role || '').toUpperCase();
      if (
        comment.user_id !== user.id &&
        commentGuardRole !== 'ADMIN' &&
        commentGuardRole !== 'OWNER'
      ) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      await queryHelpers.queryRun(`DELETE FROM tool_comments WHERE id = ?`, [commentId]);
      await logAudit(user.organizationId, user.id, 'tool_comment_deleted', toolId, { commentId });

      res.json({ ok: true });
    }
  );

  /**
   * GET /api/tools/:toolId/history
   * Was 404 (no route) — ToolDocumentView already calls this to render the
   * Activity tab. Every mutation on a tool session already writes to the
   * canonical audit_log (tool_status_changed, tool_review_requested,
   * tool_approved, tool_sent_back, initiatives_generated, dod_gate_approved,
   * tool_promoted_to_*, tool_comment_added/deleted, ...) via the local
   * logAudit() helper — this just reads that trail back out, same
   * ownership-check + row-shape pattern as listComments above.
   */
  static getHistory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { toolId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const session = (await queryHelpers.queryOne(
        `SELECT id FROM tool_sessions WHERE id = ? AND organization_id = ?`,
        [toolId, user.organizationId]
      )) as { id: string } | null;

      if (!session) {
        res.status(404).json({ error: 'Tool session not found' });
        return;
      }

      const rows = (await queryHelpers.queryAll(
        `SELECT
          al.id,
          al.action as "eventType",
          COALESCE(al.created_at, al.timestamp) as "createdAt",
          COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), u.email, al.actor_name) as "actorName",
          al.details
         FROM audit_log al
         LEFT JOIN users u ON u.id = al.user_id
         WHERE al.resource_type = 'tool_session' AND al.resource_id = ? AND al.organization_id = ?
         ORDER BY COALESCE(al.created_at, al.timestamp) DESC`,
        [toolId, user.organizationId]
      )) as Array<{
        id: string;
        eventType: string;
        createdAt: string;
        actorName: string | null;
        details: string | null;
      }>;

      const history = rows.map((row) => {
        let payload: unknown;
        if (row.details) {
          try {
            payload = JSON.parse(row.details);
          } catch {
            payload = undefined;
          }
        }
        return {
          id: row.id,
          eventType: row.eventType,
          createdAt: row.createdAt,
          actorName: row.actorName || undefined,
          payload,
        };
      });

      res.json(history);
    }
  );
  /** TLS-07 — governed, idempotent SWOT recommendation -> Candidate handoff. */
  static handoffSwotCandidate = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      try {
        const result = await handoffSwotRecommendation({
          organizationId: user.organizationId,
          toolSessionId: req.params.toolId,
          recommendationId: String(req.body?.id || ''),
          title: String(req.body?.title || ''),
          rationale: String(req.body?.rationale || ''),
          actorId: user.id,
        });
        res.status(result.created ? 201 : 200).json(result);
      } catch (error) {
        if (error instanceof SwotCandidateHandoffError) {
          res.status(error.status).json({ error: error.message, code: error.code });
          return;
        }
        throw error;
      }
    }
  );
  // ── TLS-04: Teresa-assisted SWOT proposals ────────────────────────────────

  /**
   * POST /api/tools/:toolId/swot-proposals
   * Teresa generates 1-5 candidate SWOT edits (add/update/remove), each a
   * standalone `swot_proposals` row with status='pending'. NOTHING in
   * tool_sessions.answers_json is touched here — generation is pure
   * propose-and-store, never auto-apply.
   */
  static createSwotProposals = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { toolId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const session = (await queryHelpers.queryOne(
        `SELECT id, tool_type, answers_json, version FROM tool_sessions WHERE id = ? AND organization_id = ?`,
        [toolId, user.organizationId]
      )) as { id: string; tool_type: string; answers_json: string | null; version: number } | null;

      // Cross-tenant convention: bare 404, never 403/leaky message.
      if (!session) {
        res.status(404).json({ error: 'Tool session not found' });
        return;
      }
      if (session.tool_type !== 'dynamic-swot') {
        res.status(400).json({ error: 'Tool session is not a SWOT tool' });
        return;
      }

      const answers = safeJsonParse(session.answers_json) as { items?: unknown };
      const items: any[] = Array.isArray(answers.items) ? answers.items : [];

      const generation = await generateSwotProposals({
        toolSessionId: toolId,
        organizationId: user.organizationId,
        currentItems: items,
        quadrantFocus: req.body?.quadrantFocus,
      });

      if (!generation.ok) {
        try {
          await auditEventsService.log({
            actorType: 'AI',
            action: 'SWOT_PROPOSAL_GENERATION_FAILED',
            resourceType: 'tool_session',
            resourceId: toolId,
            organizationId: user.organizationId,
            metadata: { code: generation.code },
          });
        } catch (auditErr) {
          logger.warn('[ToolController] failed to log SWOT_PROPOSAL_GENERATION_FAILED audit event', {
            auditErr,
          });
        }

        if (generation.code === 'PROVIDER_ERROR') {
          res.status(503).json({
            error: 'Teresa is unavailable right now',
            code: 'PROVIDER_ERROR',
            retryable: true,
          });
        } else {
          res.status(502).json({
            error: 'Teresa returned an unusable response',
            code: 'INVALID_MODEL_RESPONSE',
            retryable: true,
          });
        }
        return;
      }

      const now = new Date().toISOString();
      const rows: SwotProposalRow[] = generation.proposals.map((p) => {
        const existingItem =
          p.operation !== 'add' ? items.find((it) => it?.id === p.targetItemId) : undefined;

        // A full SWOTItem-shaped object (see src/store/useToolStore.ts) so the
        // client can render/apply it as-is. null for 'remove' — there is no
        // "after" item once removed.
        const proposedAfter =
          p.operation === 'remove'
            ? null
            : {
                id: p.operation === 'update' && p.targetItemId ? p.targetItemId : uuidv4(),
                text: p.proposedText || '',
                quadrant: p.quadrant,
                impact: existingItem?.impact || 'medium',
                source: 'ai',
                confidence: p.confidence,
                proposalStatus: 'ai-proposed',
              };

        return {
          id: uuidv4(),
          tool_session_id: toolId,
          organization_id: user.organizationId,
          quadrant: p.quadrant,
          operation: p.operation,
          target_item_id: p.targetItemId ?? null,
          before_json: existingItem ? JSON.stringify(existingItem) : null,
          proposed_after_json: proposedAfter ? JSON.stringify(proposedAfter) : null,
          final_after_json: null,
          rationale: p.rationale,
          source_refs_json:
            p.sourceRefs && p.sourceRefs.length > 0 ? JSON.stringify(p.sourceRefs) : null,
          is_assumption: p.isAssumption,
          confidence: p.confidence,
          // Honest/generic — never assert a provider/model we did not
          // actually observe (Codex BLOCKER 4). See swotProposalService.ts's
          // `attempt()` for exactly what is and isn't known at this seam.
          model_metadata_json: JSON.stringify({ ...generation.modelMetadata, generatedAt: now }),
          status: 'pending',
          expected_version: session.version,
          created_by: user.id,
          created_at: now,
          decided_by: null,
          decided_at: null,
        };
      });

      // All inserts atomically — a partial batch (some proposals persisted,
      // some not) would be a confusing half-state for the reviewer.
      await queryHelpers.withRawPgTransaction(async (client: PoolClient) => {
        for (const row of rows) {
          await client.query(
            `INSERT INTO swot_proposals (
              id, tool_session_id, organization_id, quadrant, operation, target_item_id,
              before_json, proposed_after_json, final_after_json, rationale, source_refs_json,
              is_assumption, confidence, model_metadata_json, status, expected_version,
              created_by, created_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
            [
              row.id,
              row.tool_session_id,
              row.organization_id,
              row.quadrant,
              row.operation,
              row.target_item_id,
              row.before_json,
              row.proposed_after_json,
              row.final_after_json,
              row.rationale,
              row.source_refs_json,
              row.is_assumption,
              row.confidence,
              row.model_metadata_json,
              row.status,
              row.expected_version,
              row.created_by,
              row.created_at,
            ]
          );
        }
      });

      try {
        await auditEventsService.log({
          actorType: 'AI',
          action: 'SWOT_PROPOSAL_CREATED',
          resourceType: 'swot_proposal',
          resourceId: rows[0]?.id || toolId,
          organizationId: user.organizationId,
          metadata: { count: rows.length, toolSessionId: toolId },
        });
      } catch (auditErr) {
        logger.warn('[ToolController] failed to log SWOT_PROPOSAL_CREATED audit event', { auditErr });
      }

      res.status(201).json({ proposals: rows.map(mapSwotProposalRow) });
    }
  );

  /**
   * GET /api/tools/:toolId/swot-proposals
   */
  static listSwotProposals = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { toolId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const session = (await queryHelpers.queryOne(
        `SELECT id FROM tool_sessions WHERE id = ? AND organization_id = ?`,
        [toolId, user.organizationId]
      )) as { id: string } | null;

      if (!session) {
        res.status(404).json({ error: 'Tool session not found' });
        return;
      }

      const rows = (await queryHelpers.queryAll(
        `SELECT * FROM swot_proposals WHERE tool_session_id = ? AND organization_id = ? ORDER BY created_at ASC`,
        [toolId, user.organizationId]
      )) as SwotProposalRow[];

      res.json({ proposals: rows.map(mapSwotProposalRow) });
    }
  );

  /**
   * POST /api/tools/:toolId/swot-proposals/:proposalId/accept
   *
   * The ONLY path by which a proposal's content can reach the real SWOT.
   * Two guarantees, both enforced by ONE transaction on ONE dedicated
   * PoolClient (queryHelpers.withPgTransaction — see that helper's docblock
   * for why a bare BEGIN/…/COMMIT through the pooled helpers would NOT be
   * atomic in this codebase):
   *
   *  1. Concurrency: the proposal flip is a SINGLE atomic conditional
   *     UPDATE (`WHERE status = 'pending'`), never read-then-write — under
   *     concurrent accept/reject/accept, Postgres row-level locking lets
   *     exactly one statement's WHERE match, so exactly one caller wins;
   *     the loser sees 0 rows and is told ALREADY_DECIDED.
   *  2. Optimistic concurrency on the session: the tool_sessions write is
   *     ALSO a conditional UPDATE (`WHERE version = expectedVersion`). If
   *     the session moved since the proposal was generated, this UPDATE
   *     matches 0 rows and we THROW inside the transaction callback — which
   *     rolls back the WHOLE transaction, including the proposal-status
   *     flip from step 1, leaving the proposal `pending` again for a
   *     legitimate retry (never left half-accepted).
   */
  static acceptSwotProposal = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { toolId, proposalId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // TLS-04 fix (Codex BLOCKER 2): `expectedVersion` is no longer trusted
      // as the CAS input. A client that GETs the live session (now at V2),
      // then calls accept on a proposal that was generated at V1, could
      // previously send `expectedVersion: 2` and bypass the stale-version
      // guard entirely -- the real source of truth is what THIS PROPOSAL was
      // actually generated against (swot_proposals.expected_version), never
      // whatever version number the client happens to send. `expectedVersion`
      // in the body is now, at most, an OPTIONAL client-side assertion that
      // must match the proposal's own recorded expected_version -- it is
      // never used as the CAS value itself.
      const { expectedVersion: clientAssertedVersion, editedAfter } = req.body as {
        expectedVersion?: number;
        editedAfter?: Record<string, unknown>;
      };

      type AcceptOutcome =
        | { kind: 'not_found' }
        | { kind: 'already_decided'; status: string }
        | { kind: 'accepted'; proposal: SwotProposalRow; sessionVersion: number };

      let outcome: AcceptOutcome;
      try {
        outcome = await queryHelpers.withRawPgTransaction<AcceptOutcome>(async (client) => {
          // TLS-04 fix (Codex BLOCKER 3): `editedAfter` may ONLY ever carry
          // `text` (enforced by AcceptSwotProposalSchema's `.strict()` at the
          // validation layer — any other key, including id/quadrant/source/
          // confidence/proposalStatus/__proto__/constructor, is rejected with
          // 400 before this handler ever runs). The server ALWAYS keeps every
          // other field from the proposal's own proposed_after_json — this is
          // an explicit field-by-field override of `text` only, never a
          // generic object spread of caller input, so no future relaxation of
          // the schema could silently reopen this to arbitrary-field
          // injection. A caller sending only `{ text }` (as the shipped UI
          // does) must not strip id/quadrant/impact/source/confidence/
          // proposalStatus from the item that ends up in
          // tool_sessions.answers_json (an item missing `quadrant` silently
          // vanishes from every quadrant grid, with no `id` left to ever
          // find/remove it again). This read is safe outside the mutual-
          // exclusion guard below: proposed_after_json is immutable before a
          // proposal is decided, and the UPDATE's own `WHERE status =
          // 'pending'` still resolves concurrent accepts to exactly one
          // winner regardless of when this SELECT ran.
          let finalAfterJsonParam: string | null = null;
          if (editedAfter !== undefined) {
            const baseRes = await client.query(
              `SELECT proposed_after_json FROM swot_proposals WHERE id = $1 AND tool_session_id = $2 AND organization_id = $3`,
              [proposalId, toolId, user.organizationId]
            );
            const baseJson = (baseRes.rows[0] as { proposed_after_json: string | null } | undefined)
              ?.proposed_after_json;
            let base: Record<string, unknown> = {};
            if (baseJson) {
              try {
                base = JSON.parse(baseJson);
              } catch {
                base = {};
              }
            }
            const editedText = (editedAfter as { text?: unknown }).text;
            finalAfterJsonParam = JSON.stringify({
              ...base,
              text: typeof editedText === 'string' ? editedText : base.text,
            });
          }

          // 1) Single atomic conditional UPDATE — not read-then-write. Under a
          // concurrent double-accept, Postgres resolves this to exactly one
          // winner via ordinary row-level locking on the UPDATE itself.
          const acceptRes = await client.query(
            `UPDATE swot_proposals
             SET status = 'accepted',
                 decided_by = $1,
                 decided_at = CURRENT_TIMESTAMP,
                 final_after_json = COALESCE($2::text, proposed_after_json)
             WHERE id = $3 AND tool_session_id = $4 AND organization_id = $5 AND status = 'pending'
             RETURNING *`,
            [user.id, finalAfterJsonParam, proposalId, toolId, user.organizationId]
          );

          if (acceptRes.rows.length === 0) {
            const check = await client.query(
              `SELECT status FROM swot_proposals WHERE id = $1 AND tool_session_id = $2 AND organization_id = $3`,
              [proposalId, toolId, user.organizationId]
            );
            if (check.rows.length === 0) {
              return { kind: 'not_found' };
            }
            return { kind: 'already_decided', status: (check.rows[0] as { status: string }).status };
          }

          const acceptedProposal = acceptRes.rows[0] as SwotProposalRow;

          // Optional client assertion: if the caller DID send expectedVersion,
          // it must agree with what this proposal was actually generated
          // against. A mismatch means the client is confused about which
          // proposal/version it's operating on -- treat it exactly like a
          // real stale-version conflict (same code, same rollback), not a
          // distinct error class the client could learn to route around.
          if (
            clientAssertedVersion !== undefined &&
            clientAssertedVersion !== acceptedProposal.expected_version
          ) {
            throw Object.assign(new Error('SWOT_PROPOSAL_EXPECTED_VERSION_ASSERTION_MISMATCH'), {
              code: 'STALE_VERSION',
              proposalVersion: acceptedProposal.expected_version,
            });
          }

          // 2) Re-read the session's CURRENT answers_json/version — same
          // client/transaction, so this sees the accepted-proposal write above
          // and is itself covered by the same rollback if the CAS below fails.
          const sessionRes = await client.query(
            `SELECT answers_json, version FROM tool_sessions WHERE id = $1 AND organization_id = $2`,
            [toolId, user.organizationId]
          );
          if (sessionRes.rows.length === 0) {
            // Parent session vanished mid-flight (shouldn't happen — FK CASCADE
            // would have deleted this proposal row too). Abort — rolls back.
            throw new Error('SWOT_PROPOSAL_PARENT_SESSION_MISSING');
          }
          const sessionRow = sessionRes.rows[0] as { answers_json: string | null; version: number };
          let answers: { items?: unknown; [k: string]: unknown };
          try {
            answers = sessionRow.answers_json ? JSON.parse(sessionRow.answers_json) : {};
          } catch {
            answers = {};
          }
          const items: any[] = Array.isArray(answers.items) ? [...(answers.items as any[])] : [];

          const appliedItem = acceptedProposal.final_after_json
            ? JSON.parse(acceptedProposal.final_after_json)
            : null;

          let newItems: any[];
          if (acceptedProposal.operation === 'add') {
            newItems = appliedItem ? [...items, appliedItem] : items;
          } else if (acceptedProposal.operation === 'update') {
            newItems = appliedItem
              ? items.map((it) => (it?.id === acceptedProposal.target_item_id ? appliedItem : it))
              : items;
          } else {
            // remove
            newItems = items.filter((it) => it?.id !== acceptedProposal.target_item_id);
          }

          const newAnswersJson = JSON.stringify({ ...answers, items: newItems });

          // Optimistic-concurrency CAS on the session — against the
          // PROPOSAL's OWN recorded expected_version (server truth, set at
          // generation time), never the client-supplied `expectedVersion`.
          // 0 rows ⇒ stale ⇒ throw ⇒ the whole transaction (including step
          // 1's proposal flip) rolls back, so the proposal is left `pending`
          // for a legitimate retry.
          const sessionUpdateRes = await client.query(
            `UPDATE tool_sessions
             SET answers_json = $1, version = version + 1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND organization_id = $3 AND version = $4
             RETURNING version`,
            [newAnswersJson, toolId, user.organizationId, acceptedProposal.expected_version]
          );

          if (sessionUpdateRes.rows.length === 0) {
            throw Object.assign(new Error('SWOT_PROPOSAL_STALE_VERSION'), {
              code: 'STALE_VERSION',
              proposalVersion: acceptedProposal.expected_version,
            });
          }

          return {
            kind: 'accepted',
            proposal: acceptedProposal,
            sessionVersion: (sessionUpdateRes.rows[0] as { version: number }).version,
          };
        });
      } catch (err) {
        const staleErr = err as { code?: string; proposalVersion?: number } | undefined;
        if (staleErr?.code === 'STALE_VERSION') {
          // Re-read OUTSIDE the rolled-back transaction so the client gets the
          // TRUE current version to retry with.
          const current = (await queryHelpers.queryOne(
            `SELECT version FROM tool_sessions WHERE id = ? AND organization_id = ?`,
            [toolId, user.organizationId]
          )) as { version: number } | null;
          res.status(409).json({
            error: 'Session has changed since this proposal was generated',
            code: 'STALE_VERSION',
            currentVersion: current?.version ?? null,
            proposalVersion: staleErr.proposalVersion ?? null,
          });
          return;
        }
        throw err;
      }

      if (outcome.kind === 'not_found') {
        res.status(404).json({ error: 'Proposal not found' });
        return;
      }
      if (outcome.kind === 'already_decided') {
        res.status(409).json({
          error: 'Proposal already decided',
          code: 'ALREADY_DECIDED',
          status: outcome.status,
        });
        return;
      }

      try {
        await auditEventsService.log({
          actorType: 'USER',
          actorId: user.id,
          action: 'SWOT_PROPOSAL_ACCEPTED',
          resourceType: 'swot_proposal',
          resourceId: proposalId,
          organizationId: user.organizationId,
          before: {
            quadrant: outcome.proposal.quadrant,
            operation: outcome.proposal.operation,
            previousItem: safeParseJSON<unknown>(outcome.proposal.before_json, null),
          },
          after: {
            appliedItem: safeParseJSON<unknown>(outcome.proposal.final_after_json, null),
          },
        });
      } catch (auditErr) {
        logger.warn('[ToolController] failed to log SWOT_PROPOSAL_ACCEPTED audit event', { auditErr });
      }

      res.json({
        proposal: mapSwotProposalRow(outcome.proposal),
        session: { id: toolId, version: outcome.sessionVersion },
      });
    }
  );

  /**
   * POST /api/tools/:toolId/swot-proposals/:proposalId/reject
   * Does NOT touch tool_sessions at all — the literal proof that rejecting a
   * proposal never changes the real SWOT.
   */
  static rejectSwotProposal = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { toolId, proposalId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Single atomic conditional UPDATE, wrapped in withPgTransaction purely
      // to go through a genuine writable client and get RETURNING rows back
      // (queryHelpers.queryRun discards RETURNING; queryAll reads via the
      // read pool, which is wrong for a write) — not because this needs
      // multi-statement rollback semantics.
      type RejectOutcome =
        | { kind: 'not_found' }
        | { kind: 'already_decided'; status: string }
        | { kind: 'rejected'; proposal: SwotProposalRow };

      const outcome = await queryHelpers.withRawPgTransaction<RejectOutcome>(async (client) => {
        const rejectRes = await client.query(
          `UPDATE swot_proposals
           SET status = 'rejected', decided_by = $1, decided_at = CURRENT_TIMESTAMP
           WHERE id = $2 AND tool_session_id = $3 AND organization_id = $4 AND status = 'pending'
           RETURNING *`,
          [user.id, proposalId, toolId, user.organizationId]
        );

        if (rejectRes.rows.length === 0) {
          const check = await client.query(
            `SELECT status FROM swot_proposals WHERE id = $1 AND tool_session_id = $2 AND organization_id = $3`,
            [proposalId, toolId, user.organizationId]
          );
          if (check.rows.length === 0) {
            return { kind: 'not_found' };
          }
          return { kind: 'already_decided', status: (check.rows[0] as { status: string }).status };
        }

        return { kind: 'rejected', proposal: rejectRes.rows[0] as SwotProposalRow };
      });

      if (outcome.kind === 'not_found') {
        res.status(404).json({ error: 'Proposal not found' });
        return;
      }
      if (outcome.kind === 'already_decided') {
        res.status(409).json({
          error: 'Proposal already decided',
          code: 'ALREADY_DECIDED',
          status: outcome.status,
        });
        return;
      }

      try {
        await auditEventsService.log({
          actorType: 'USER',
          actorId: user.id,
          action: 'SWOT_PROPOSAL_REJECTED',
          resourceType: 'swot_proposal',
          resourceId: proposalId,
          organizationId: user.organizationId,
        });
      } catch (auditErr) {
        logger.warn('[ToolController] failed to log SWOT_PROPOSAL_REJECTED audit event', { auditErr });
      }

      res.json({ proposal: mapSwotProposalRow(outcome.proposal) });
    }
  );
}

export default ToolController;
