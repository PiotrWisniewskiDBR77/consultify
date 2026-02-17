/**
 * Intelligence Routes
 * Project Intelligence Hub - Interview sessions and insights
 */
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(demoContextMiddleware);

const DEFAULT_PROGRESS = {
  completed: [],
  current: 'objective',
  remaining: [
    'stakeholder',
    'risk',
    'assumption',
    'constraint',
    'decision',
    'dependency',
    'success_criteria',
  ],
};

const ensureIntelligenceSchema = async (): Promise<void> => {
  await queryHelpers.queryRun(
    `CREATE TABLE IF NOT EXISTS project_intelligence_sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      topic TEXT,
      status TEXT DEFAULT 'active',
      progress_completed TEXT DEFAULT '[]',
      progress_current TEXT,
      progress_remaining TEXT DEFAULT '[]',
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      duration_minutes INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await queryHelpers.queryRun(
    `CREATE TABLE IF NOT EXISTS project_intelligence_insights (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      session_id TEXT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '{}',
      source_type TEXT,
      source_text TEXT,
      confidence TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'draft',
      related_insights TEXT DEFAULT '[]',
      pmo_domain TEXT,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await queryHelpers.queryRun(
    `CREATE INDEX IF NOT EXISTS idx_intelligence_sessions_project
     ON project_intelligence_sessions(project_id)`
  );
  await queryHelpers.queryRun(
    `CREATE INDEX IF NOT EXISTS idx_intelligence_insights_project
     ON project_intelligence_insights(project_id)`
  );
  await queryHelpers.queryRun(
    `CREATE INDEX IF NOT EXISTS idx_intelligence_insights_session
     ON project_intelligence_insights(session_id)`
  );
};

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    logger.warn('[intelligence] Failed to parse JSON field:', error);
    return fallback;
  }
};

const requireUser = (req: AuthenticatedRequest) => {
  const user = req.user;
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
};

const buildInsightResponse = (row: any) => {
  if (!row) return null;
  return {
    id: row.id,
    project_id: row.project_id,
    session_id: row.session_id || undefined,
    category: row.category,
    title: row.title,
    content: parseJson(row.content, {}),
    source:
      row.source_text || row.source_type
        ? {
            type: row.source_type || 'chat',
            text: row.source_text || '',
          }
        : undefined,
    confidence: row.confidence || 'medium',
    status: row.status || 'draft',
    related_insights: parseJson(row.related_insights, []),
    pmo_domain: row.pmo_domain || undefined,
    created_by: row.created_by || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

const buildSessionResponse = (row: any) => {
  if (!row) return null;
  return {
    id: row.id,
    project_id: row.project_id,
    user_id: row.user_id,
    topic: row.topic,
    status: row.status || 'active',
    progress: {
      completed: parseJson(row.progress_completed, []),
      current: row.progress_current || null,
      remaining: parseJson(row.progress_remaining, []),
    },
    started_at: row.started_at,
    completed_at: row.completed_at || undefined,
    duration_minutes: row.duration_minutes || undefined,
  };
};

router.use(
  asyncHandler(async (_req, _res, next) => {
    await ensureIntelligenceSchema();
    next();
  })
);

router.get(
  '/projects/:projectId/insights',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { projectId } = req.params;
    const rows = await queryHelpers.queryAll(
      `SELECT * FROM project_intelligence_insights
       WHERE project_id = ? AND organization_id = ?
       ORDER BY created_at DESC`,
      [projectId, user.organizationId]
    );
    res.json(rows.map(buildInsightResponse));
  })
);

router.get(
  '/projects/:projectId/sessions',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { projectId } = req.params;
    const rows = await queryHelpers.queryAll(
      `SELECT * FROM project_intelligence_sessions
       WHERE project_id = ? AND organization_id = ?
       ORDER BY started_at DESC`,
      [projectId, user.organizationId]
    );
    res.json(rows.map(buildSessionResponse));
  })
);

router.post(
  '/projects/:projectId/sessions',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { projectId } = req.params;
    const { topic } = req.body || {};
    const id = uuidv4();
    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `INSERT INTO project_intelligence_sessions
       (id, project_id, organization_id, user_id, topic, status, progress_completed, progress_current, progress_remaining, started_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        projectId,
        user.organizationId,
        user.id,
        topic || 'Project Interview',
        'active',
        JSON.stringify(DEFAULT_PROGRESS.completed),
        DEFAULT_PROGRESS.current,
        JSON.stringify(DEFAULT_PROGRESS.remaining),
        now,
        now,
        now,
      ]
    );
    res.json(
      buildSessionResponse({
        id,
        project_id: projectId,
        user_id: user.id,
        topic: topic || 'Project Interview',
        status: 'active',
        progress_completed: JSON.stringify(DEFAULT_PROGRESS.completed),
        progress_current: DEFAULT_PROGRESS.current,
        progress_remaining: JSON.stringify(DEFAULT_PROGRESS.remaining),
        started_at: now,
      })
    );
  })
);

router.post(
  '/projects/:projectId/seed',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { projectId } = req.params;

    const sessionId = uuidv4();
    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `INSERT INTO project_intelligence_sessions
       (id, project_id, organization_id, user_id, topic, status, progress_completed, progress_current, progress_remaining, started_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        projectId,
        user.organizationId,
        user.id,
        'Discovery Interview (Demo)',
        'completed',
        JSON.stringify([
          'objective',
          'stakeholder',
          'risk',
          'assumption',
          'constraint',
          'decision',
          'dependency',
          'success_criteria',
        ]),
        null,
        JSON.stringify([]),
        now,
        now,
        now,
      ]
    );

    const insights = [
      {
        category: 'objective',
        title: 'Improve delivery predictability',
        content: { description: 'Reduce delivery delays by 20% within the next 2 quarters.' },
        confidence: 'high',
        source_text: 'We need to ship on time consistently.',
      },
      {
        category: 'stakeholder',
        title: 'IT and Operations alignment required',
        content: { description: 'IT and Ops leadership must co-own the execution roadmap.' },
        confidence: 'medium',
        source_text: 'IT and operations have different priorities right now.',
      },
      {
        category: 'risk',
        title: 'Legacy integrations are fragile',
        content: { description: 'Current integrations fail frequently during peak loads.' },
        confidence: 'high',
        source_text: 'Our legacy stack breaks when volume spikes.',
      },
      {
        category: 'constraint',
        title: 'Fixed budget for FY',
        content: { description: 'Budget capped at 1.2M PLN for the year.' },
        confidence: 'medium',
        source_text: 'We cannot exceed 1.2M PLN this year.',
      },
      {
        category: 'success_criteria',
        title: 'Real-time KPI visibility',
        content: { description: 'Executives need real-time KPI dashboards across sites.' },
        confidence: 'low',
        source_text: 'Leadership wants dashboards on every site.',
      },
    ];

    for (const insight of insights) {
      const insightId = uuidv4();
      await queryHelpers.queryRun(
        `INSERT INTO project_intelligence_insights
         (id, project_id, organization_id, session_id, category, title, content, source_type, source_text, confidence, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          insightId,
          projectId,
          user.organizationId,
          sessionId,
          insight.category,
          insight.title,
          JSON.stringify(insight.content),
          'demo',
          insight.source_text,
          insight.confidence,
          'draft',
          user.id,
          now,
          now,
        ]
      );
    }

    res.json({ success: true });
  })
);

router.post(
  '/insights',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const {
      projectId,
      sessionId,
      category,
      title,
      content,
      source,
      confidence,
      status,
      relatedInsights,
      pmoDomain,
    } = req.body || {};

    if (!projectId || !category || !title) {
      res.status(400).json({ error: 'projectId, category and title are required' });
      return;
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `INSERT INTO project_intelligence_insights
       (id, project_id, organization_id, session_id, category, title, content, source_type, source_text, confidence, status, related_insights, pmo_domain, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        projectId,
        user.organizationId,
        sessionId || null,
        category,
        title,
        JSON.stringify(content || {}),
        source?.type || null,
        source?.text || null,
        confidence || 'medium',
        status || 'draft',
        JSON.stringify(relatedInsights || []),
        pmoDomain || null,
        user.id,
        now,
        now,
      ]
    );

    res.json({
      insight: buildInsightResponse({
        id,
        project_id: projectId,
        session_id: sessionId || null,
        category,
        title,
        content: JSON.stringify(content || {}),
        source_type: source?.type || null,
        source_text: source?.text || null,
        confidence: confidence || 'medium',
        status: status || 'draft',
        related_insights: JSON.stringify(relatedInsights || []),
        pmo_domain: pmoDomain || null,
        created_by: user.id,
        created_at: now,
        updated_at: now,
      }),
    });
  })
);

router.patch(
  '/insights/:id',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { id } = req.params;
    const { status, title, content, confidence, category } = req.body || {};

    const updates: string[] = [];
    const params: unknown[] = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (title) {
      updates.push('title = ?');
      params.push(title);
    }
    if (content) {
      updates.push('content = ?');
      params.push(JSON.stringify(content));
    }
    if (confidence) {
      updates.push('confidence = ?');
      params.push(confidence);
    }
    if (category) {
      updates.push('category = ?');
      params.push(category);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No updates provided' });
      return;
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id, user.organizationId);

    await queryHelpers.queryRun(
      `UPDATE project_intelligence_insights
       SET ${updates.join(', ')}
       WHERE id = ? AND organization_id = ?`,
      params
    );

    const updated = await queryHelpers.queryOne(
      `SELECT * FROM project_intelligence_insights WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );
    res.json(buildInsightResponse(updated));
  })
);

router.delete(
  '/insights/:id',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { id } = req.params;
    await queryHelpers.queryRun(
      `DELETE FROM project_intelligence_insights WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );
    res.json({ success: true });
  })
);

export default router;
