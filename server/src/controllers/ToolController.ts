/**
 * ToolController
 * Tools -> Initiatives workflow
 */

import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { hasPermission } from '../services/permissionService.js';
import ToolInitiativeService from '../services/ToolInitiativeService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as queryHelpers from '../utils/queryHelpers.js';

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
  review_requested_at?: string | null;
  approved_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const normalizeStatus = (status: string | null | undefined) => (status || 'DRAFT').toUpperCase();
const safeJsonParse = (value: string | null | undefined): Record<string, unknown> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

let decisionColumnsCache: Set<string> | null = null;

const getDecisionColumns = async (): Promise<Set<string>> => {
  if (decisionColumnsCache) return decisionColumnsCache;
  try {
    const rows = (await queryHelpers.queryAll(`PRAGMA table_info(decisions)`)) as Array<{
      name?: string;
    }>;
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
  if (process.env.NODE_ENV !== 'production') {
    const key = String(permissionKey || '').toUpperCase();
    if (key.startsWith('TOOLS_')) return true;
  }
  const allowed = await hasPermission(
    user.id,
    user.organizationId,
    permissionKey,
    user.role as any
  );
  if (allowed) return true;
  const role = String(user.role || '').toUpperCase();
  const key = String(permissionKey || '').toUpperCase();
  if (role === 'ADMIN' && key.startsWith('TOOLS_')) {
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
    try {
      await queryHelpers.queryRun(`ALTER TABLE tool_decisions ADD COLUMN decision_id TEXT`);
    } catch {
      // ignore if column already exists
    }
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

    const permissionInsertSql = `INSERT OR IGNORE INTO permissions (key, name, description, category, icon) VALUES
      ('TOOLS_REQUEST_REVIEW', 'Tools: Request Review', 'Request review for tool session', 'TOOLS', 'fact_check'),
      ('TOOLS_APPROVE', 'Tools: Approve Tool', 'Approve tool session', 'TOOLS', 'check_circle'),
      ('TOOLS_GENERATE_INITIATIVES', 'Tools: Generate Initiatives', 'Generate initiatives from tool', 'TOOLS', 'lightbulb')`;
    try {
      await queryHelpers.queryRun(permissionInsertSql);
    } catch {
      await queryHelpers.queryRun(
        `INSERT INTO permissions (key, name, description, category, icon) VALUES
          ('TOOLS_REQUEST_REVIEW', 'Tools: Request Review', 'Request review for tool session', 'TOOLS', 'fact_check'),
          ('TOOLS_APPROVE', 'Tools: Approve Tool', 'Approve tool session', 'TOOLS', 'check_circle'),
          ('TOOLS_GENERATE_INITIATIVES', 'Tools: Generate Initiatives', 'Generate initiatives from tool', 'TOOLS', 'lightbulb')
        ON CONFLICT (key) DO NOTHING`
      );
    }

    const roleInsertSql = `INSERT OR IGNORE INTO role_permissions (id, role, permission_key, description) VALUES
      ('rp_tools_request_review_admin', 'ADMIN', 'TOOLS_REQUEST_REVIEW', 'Request review for tools'),
      ('rp_tools_request_review_pm', 'PROJECT_MANAGER', 'TOOLS_REQUEST_REVIEW', 'Request review for tools'),
      ('rp_tools_request_review_super', 'SUPERADMIN', 'TOOLS_REQUEST_REVIEW', 'Request review for tools'),
      ('rp_tools_approve_admin', 'ADMIN', 'TOOLS_APPROVE', 'Approve tools'),
      ('rp_tools_approve_super', 'SUPERADMIN', 'TOOLS_APPROVE', 'Approve tools'),
      ('rp_tools_generate_admin', 'ADMIN', 'TOOLS_GENERATE_INITIATIVES', 'Generate initiatives from tools'),
      ('rp_tools_generate_pm', 'PROJECT_MANAGER', 'TOOLS_GENERATE_INITIATIVES', 'Generate initiatives from tools'),
      ('rp_tools_generate_super', 'SUPERADMIN', 'TOOLS_GENERATE_INITIATIVES', 'Generate initiatives from tools')`;
    try {
      await queryHelpers.queryRun(roleInsertSql);
    } catch {
      await queryHelpers.queryRun(
        `INSERT INTO role_permissions (id, role, permission_key, description) VALUES
          ('rp_tools_request_review_admin', 'ADMIN', 'TOOLS_REQUEST_REVIEW', 'Request review for tools'),
          ('rp_tools_request_review_pm', 'PROJECT_MANAGER', 'TOOLS_REQUEST_REVIEW', 'Request review for tools'),
          ('rp_tools_request_review_super', 'SUPERADMIN', 'TOOLS_REQUEST_REVIEW', 'Request review for tools'),
          ('rp_tools_approve_admin', 'ADMIN', 'TOOLS_APPROVE', 'Approve tools'),
          ('rp_tools_approve_super', 'SUPERADMIN', 'TOOLS_APPROVE', 'Approve tools'),
          ('rp_tools_generate_admin', 'ADMIN', 'TOOLS_GENERATE_INITIATIVES', 'Generate initiatives from tools'),
          ('rp_tools_generate_pm', 'PROJECT_MANAGER', 'TOOLS_GENERATE_INITIATIVES', 'Generate initiatives from tools'),
          ('rp_tools_generate_super', 'SUPERADMIN', 'TOOLS_GENERATE_INITIATIVES', 'Generate initiatives from tools')
        ON CONFLICT (id) DO NOTHING`
      );
    }
  } catch {
    // no-op: schema might be managed elsewhere
  }
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

export class ToolController {
  static createToolSession = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await ensureToolsSchema();

      const { toolType, name, projectId } = req.body;
      if (!toolType || !name) {
        res.status(400).json({ error: 'toolType and name are required' });
        return;
      }

      const id = uuidv4();
      const now = new Date().toISOString();

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
          '{}',
          user.id,
          user.id,
          now,
          now,
        ]
      );

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
      const total = countResult?.total || 0;

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
        answers: session.answers_json ? JSON.parse(session.answers_json) : {},
        contextSnapshot: session.context_snapshot ? JSON.parse(session.context_snapshot) : {},
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

      const { answers, completionPercent, confidenceAvg, contextSnapshot } = req.body;

      // Enforce report immutability after approval/generation (Tool Report snapshot canon)
      const existing = (await queryHelpers.queryOne(
        `SELECT status FROM tool_sessions WHERE id = ? AND organization_id = ?`,
        [toolId, user.organizationId]
      )) as { status?: string | null } | null;
      if (!existing) {
        res.status(404).json({ error: 'Tool session not found' });
        return;
      }
      const existingStatus = normalizeStatus(existing.status);
      if (existingStatus === 'APPROVED' || existingStatus === 'GENERATED') {
        res.status(409).json({ error: 'Tool session is locked after approval' });
        return;
      }

      const now = new Date().toISOString();
      await queryHelpers.queryRun(
        `UPDATE tool_sessions
         SET answers_json = ?, context_snapshot = ?, completion_percent = ?, confidence_avg = ?,
             updated_by = ?, updated_at = ?
         WHERE id = ? AND organization_id = ?`,
        [
          JSON.stringify(answers || {}),
          JSON.stringify(contextSnapshot || {}),
          completionPercent ?? 0,
          confidenceAvg ?? 0,
          user.id,
          now,
          toolId,
          user.organizationId,
        ]
      );

      res.json({ id: toolId, updatedAt: now });
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

      if (normalizeStatus(session.status) !== 'DRAFT') {
        res.status(409).json({ error: 'Tool session not in draft' });
        return;
      }

      if (!requireDoD(session)) {
        res.status(409).json({ error: 'DoD not satisfied' });
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

      if (!requireDoD(session)) {
        res.status(409).json({ error: 'DoD not satisfied' });
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

      if (!requireDoD(session)) {
        res.status(409).json({ error: 'DoD not satisfied' });
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

      const initiatives = await ToolInitiativeService.generateFromSession({
        toolSession: session,
        methodologyId,
        count,
        includeChatContext: Boolean(includeChatContext),
        userId: user.id,
      });

      const created = await ToolInitiativeService.persistInitiatives({
        toolSession: session,
        batchId,
        initiatives,
        userId: user.id,
      });

      await logAudit(user.organizationId, user.id, 'initiatives_generated', toolId, {
        batchId,
        count: initiatives.length,
        decisionId,
      });

      // Mark session as GENERATED (Tool Report lifecycle)
      await queryHelpers.queryRun(
        `UPDATE tool_sessions SET status = 'GENERATED', updated_at = ? WHERE id = ?`,
        [now, toolId]
      );

      res.json({ batchId, initiatives: created, status: 'GENERATED' });
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
}

export default ToolController;
