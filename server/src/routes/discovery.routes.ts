/**
 * Discovery routes — backend for the Discovery Consultant canvas.
 *
 * Why this exists (Discovery revive):
 * The Discovery Consultant canvas frontend (React Flow nodes, SPIN prompts,
 * useDiscoveryStore) shipped with NO backend — the store fired
 * GET/PUT/DELETE/convert/attach at routes that 404'd, so sessions never
 * persisted, convert-to-project did nothing, and the SPIN extraction pipeline
 * was inert (the prompt was never invoked server-side). The audit scored it
 * 14/100 ("dead demo code"). The owner's directive was to develop and finish
 * it, not delete it. This module is that backend:
 *
 *   GET    /discovery/sessions            — list the caller's sessions
 *   GET    /discovery/sessions/:id        — load one session
 *   PUT    /discovery/sessions/:id        — upsert (the store saves the full
 *                                           DiscoverySession blob)
 *   DELETE /discovery/sessions/:id        — delete
 *   POST   /discovery/sessions/convert    — create a real project (+ optional
 *                                           initiatives) from the canvas
 *   POST   /discovery/sessions/:id/attach — attach the session to a project
 *   POST   /discovery/extract             — run the SPIN extraction over
 *                                           conversation text → structured
 *                                           pain points / insights / quotes
 *
 * Persistence model: the session's rich nested shape (nodes/edges/
 * recommendations/clientContext/versions) is stored as a JSON blob plus a few
 * indexed columns. Org-scoped on every query.
 */

import { Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { llmService } from '../services/ai/llmService.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

// ---------------------------------------------------------------------------
// Auth context
// ---------------------------------------------------------------------------
function authContext(req: AuthRequest): { organizationId: string; userId: string } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = (req as any).user || {};
  return {
    organizationId: String(user.organizationId || user.organization_id || ''),
    userId: String(user.id || user.userId || ''),
  };
}

// ---------------------------------------------------------------------------
// Lazy schema
// ---------------------------------------------------------------------------
let schemaReady = false;
async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  await dbRun(
    `CREATE TABLE IF NOT EXISTS discovery_sessions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      conversation_id TEXT,
      name TEXT,
      current_phase TEXT DEFAULT 'welcome',
      outcome TEXT,
      converted_project_id TEXT,
      attached_project_id TEXT,
      session_json TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    []
  );
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_discovery_sessions_org ON discovery_sessions(organization_id)`,
    []
  ).catch(() => {});
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_discovery_sessions_owner ON discovery_sessions(owner_id)`,
    []
  ).catch(() => {});
  schemaReady = true;
}

function parseSessionRow(row: Record<string, unknown> | undefined | null) {
  if (!row) return null;
  let session: Record<string, unknown> = {};
  try {
    session = JSON.parse(String(row.session_json || '{}'));
  } catch {
    session = {};
  }
  // Surface the indexed columns onto the returned session so the client sees
  // the authoritative server state (outcome / project links) even if the blob
  // was stale.
  return {
    ...session,
    id: row.id,
    outcome: row.outcome ?? session.outcome,
    convertedProjectId: row.converted_project_id ?? session.convertedProjectId,
    attachedProjectId: row.attached_project_id ?? session.attachedProjectId,
    currentPhase: row.current_phase ?? session.currentPhase,
  };
}

router.use(verifyToken);

// ---------------------------------------------------------------------------
// GET /sessions — list
// ---------------------------------------------------------------------------
router.get('/sessions', async (req: AuthRequest, res) => {
  await ensureSchema();
  const { organizationId, userId } = authContext(req);
  if (!organizationId) return res.status(400).json({ error: 'Missing organization context' });
  const rows = await dbAll<Record<string, unknown>>(
    `SELECT * FROM discovery_sessions
     WHERE organization_id = ? AND owner_id = ?
     ORDER BY updated_at DESC`,
    [organizationId, userId],
    { fallback: false }
  );
  res.json({ sessions: (rows || []).map(parseSessionRow) });
});

// ---------------------------------------------------------------------------
// GET /sessions/:id
// ---------------------------------------------------------------------------
router.get('/sessions/:id', async (req: AuthRequest, res) => {
  await ensureSchema();
  const { organizationId } = authContext(req);
  const row = await dbGet<Record<string, unknown>>(
    `SELECT * FROM discovery_sessions WHERE id = ? AND organization_id = ?`,
    [req.params.id, organizationId],
    { fallback: false }
  );
  if (!row) return res.status(404).json({ error: 'Discovery session not found' });
  res.json({ session: parseSessionRow(row) });
});

// ---------------------------------------------------------------------------
// PUT /sessions/:id — upsert (store saves the full session)
// ---------------------------------------------------------------------------
router.put('/sessions/:id', async (req: AuthRequest, res) => {
  await ensureSchema();
  const { organizationId, userId } = authContext(req);
  if (!organizationId) return res.status(400).json({ error: 'Missing organization context' });
  const id = req.params.id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = (req.body || {}) as Record<string, any>;
  const now = new Date().toISOString();

  const existing = await dbGet<Record<string, unknown>>(
    `SELECT id, owner_id FROM discovery_sessions WHERE id = ? AND organization_id = ?`,
    [id, organizationId],
    { fallback: false }
  );

  const values = {
    name: session.name ?? null,
    conversation_id: session.conversationId ?? null,
    current_phase: session.currentPhase ?? 'welcome',
    outcome: session.outcome ?? null,
    converted_project_id: session.convertedProjectId ?? null,
    attached_project_id: session.attachedProjectId ?? null,
    session_json: JSON.stringify(session),
  };

  if (existing) {
    await dbRun(
      `UPDATE discovery_sessions
       SET name = ?, conversation_id = ?, current_phase = ?, outcome = ?,
           converted_project_id = ?, attached_project_id = ?, session_json = ?, updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [
        values.name,
        values.conversation_id,
        values.current_phase,
        values.outcome,
        values.converted_project_id,
        values.attached_project_id,
        values.session_json,
        now,
        id,
        organizationId,
      ],
      { fallback: false }
    );
  } else {
    await dbRun(
      `INSERT INTO discovery_sessions
       (id, organization_id, owner_id, conversation_id, name, current_phase, outcome,
        converted_project_id, attached_project_id, session_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        organizationId,
        userId,
        values.conversation_id,
        values.name,
        values.current_phase,
        values.outcome,
        values.converted_project_id,
        values.attached_project_id,
        values.session_json,
        now,
        now,
      ],
      { fallback: false }
    );
  }
  res.json({ success: true, id });
});

// ---------------------------------------------------------------------------
// DELETE /sessions/:id
// ---------------------------------------------------------------------------
router.delete('/sessions/:id', async (req: AuthRequest, res) => {
  await ensureSchema();
  const { organizationId } = authContext(req);
  await dbRun(
    `DELETE FROM discovery_sessions WHERE id = ? AND organization_id = ?`,
    [req.params.id, organizationId],
    { fallback: false }
  );
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// POST /sessions/convert — create a real project (+ initiatives)
// ---------------------------------------------------------------------------
router.post('/sessions/convert', async (req: AuthRequest, res) => {
  await ensureSchema();
  const { organizationId, userId } = authContext(req);
  if (!organizationId) return res.status(400).json({ error: 'Missing organization context' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (req.body || {}) as Record<string, any>;
  const sessionId = String(body.sessionId || '');
  const projectName = String(body.projectName || 'Discovery Project').slice(0, 200);
  const painPoints = Array.isArray(body.painPoints) ? body.painPoints : [];
  const insights = Array.isArray(body.insights) ? body.insights : [];
  const createInitiatives = body.createInitiatives !== false;

  try {
    // Create the project via the canonical command handler.
    const { CreateProjectCommand, CreateProjectHandler } =
      await import('../services/cqrs/project/commands/CreateProjectCommand.js');
    const summary = `Created from a discovery session. ${painPoints.length} pain point(s), ${insights.length} insight(s) captured.`;
    const handler = new CreateProjectHandler();
    const project = await handler.execute(
      new CreateProjectCommand(projectName, organizationId, userId, summary)
    );

    // Optionally seed initiatives from the highest-severity pain points via the
    // canonical initiative service (same path Canvas + Interview use).
    const createdInitiativeIds: string[] = [];
    if (createInitiatives && painPoints.length > 0) {
      const { default: initiativeService } = await import('../services/initiativeService.js');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ranked = [...painPoints].sort(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a: any, b: any) => (Number(b?.severity) || 0) - (Number(a?.severity) || 0)
      );
      for (const pain of ranked.slice(0, 5)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = pain as any;
        const title = String(p.text || p.title || 'Discovery initiative').slice(0, 200);
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const initiative = await initiativeService.createInitiative({
            organization_id: organizationId,
            project_id: project.id,
            title,
            summary: [
              p.impact ? `Impact: ${p.impact}` : '',
              p.area ? `Area: ${p.area}` : '',
              p.severity ? `Severity: ${p.severity}/5` : '',
            ]
              .filter(Boolean)
              .join('\n'),
            status: 'DRAFT',
            owner_id: userId,
            market_context: `Created from discovery session ${sessionId}`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);
          if (initiative?.id) createdInitiativeIds.push(initiative.id);
        } catch (initErr) {
          logger.warn('[Discovery] initiative creation skipped', initErr);
        }
      }
    }

    // Mark the session converted. Best-effort (the project is already created
    // and the response is about to be sent), but H5.5: a swallowed failure here
    // leaves the session's outcome stuck as un-converted with NO trace — log
    // with correlation so the stale state is diagnosable.
    if (sessionId) {
      await dbRun(
        `UPDATE discovery_sessions
         SET outcome = 'converted', converted_project_id = ?, updated_at = ?
         WHERE id = ? AND organization_id = ?`,
        [project.id, new Date().toISOString(), sessionId, organizationId],
        { fallback: false }
      ).catch((err: unknown) => {
        logger.warn(
          `[Discovery] failed to mark session converted session=${sessionId} ` +
            `project=${project.id} org=${organizationId}: ${
              err instanceof Error ? err.message : String(err)
            }`
        );
      });
    }

    res.json({
      projectId: project.id,
      initiativeIds: createdInitiativeIds,
      initiativesCreated: createdInitiativeIds.length,
    });
  } catch (error) {
    logger.error('[Discovery] convert-to-project failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to convert discovery session',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /sessions/:id/attach — attach session to an existing project
// ---------------------------------------------------------------------------
router.post('/sessions/:id/attach', async (req: AuthRequest, res) => {
  await ensureSchema();
  const { organizationId } = authContext(req);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectId = String((req.body as any)?.projectId || '');
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });
  // Validate the project belongs to the org before attaching.
  const project = await dbGet<{ id: string }>(
    `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
    [projectId, organizationId],
    { fallback: false }
  );
  if (!project) return res.status(404).json({ error: 'Project not found' });
  await dbRun(
    `UPDATE discovery_sessions SET attached_project_id = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [projectId, new Date().toISOString(), req.params.id, organizationId],
    { fallback: false }
  );
  res.json({ success: true, projectId });
});

// ---------------------------------------------------------------------------
// POST /extract — SPIN extraction over conversation text
// ---------------------------------------------------------------------------
const ExtractionSchema = z.object({
  painPoints: z
    .array(
      z.object({
        text: z.string(),
        severity: z.number().min(1).max(5).default(3),
        area: z.enum(['process', 'technology', 'people', 'data']).default('process'),
        impact: z.string().optional(),
      })
    )
    .default([]),
  insights: z
    .array(
      z.object({
        text: z.string(),
        linkedPains: z.array(z.string()).default([]),
      })
    )
    .default([]),
  quotes: z
    .array(
      z.object({
        text: z.string(),
        sentiment: z.enum(['positive', 'negative', 'neutral']).default('neutral'),
      })
    )
    .default([]),
  clientContext: z
    .object({
      companyName: z.string().optional(),
      industry: z.string().optional(),
      size: z.enum(['small', 'medium', 'large', 'enterprise']).optional(),
      role: z.string().optional(),
      primaryGoal: z.string().optional(),
    })
    .partial()
    .default({}),
  phaseProgress: z
    .object({
      contextComplete: z.boolean().default(false),
      painsIdentified: z.number().default(0),
      impactQuantified: z.boolean().default(false),
      readyForRecommendations: z.boolean().default(false),
    })
    .partial()
    .default({}),
});

const DISCOVERY_EXTRACTION_SYSTEM_PROMPT = `You are an expert transformation consultant running a discovery call using the SPIN methodology (Situation, Problem, Implication, Need-payoff).

From the conversation transcript provided, EXTRACT structured entities. Return ONLY a JSON object matching this schema:
{
  "painPoints": [{ "text": "...", "severity": 1-5, "area": "process|technology|people|data", "impact": "optional" }],
  "insights": [{ "text": "consultant observation", "linkedPains": ["related pain text"] }],
  "quotes": [{ "text": "exact user words", "sentiment": "positive|negative|neutral" }],
  "clientContext": { "companyName": "", "industry": "", "size": "small|medium|large|enterprise", "role": "", "primaryGoal": "" },
  "phaseProgress": { "contextComplete": bool, "painsIdentified": number, "impactQuantified": bool, "readyForRecommendations": bool }
}

Severity scale: 1 minor → 5 blocking. Areas: process / technology / people / data.
Extract only what is genuinely present in the transcript — do not invent pain points. Respond in the language of the transcript.`;

router.post('/extract', async (req: AuthRequest, res) => {
  const { organizationId } = authContext(req);
  if (!organizationId) return res.status(400).json({ error: 'Missing organization context' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (req.body || {}) as Record<string, any>;
  // Accept either a flat conversation string or a messages array.
  const conversation: string =
    typeof body.conversation === 'string'
      ? body.conversation
      : Array.isArray(body.messages)
        ? body.messages
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((m: any) => `[${String(m.role || 'user').toUpperCase()}]: ${m.content || ''}`)
            .join('\n')
        : '';

  if (!conversation.trim()) {
    return res.status(400).json({ error: 'conversation or messages is required' });
  }

  try {
    const result = await llmService.call({
      type: 'structured',
      modelConfig: { id: 'standard' },
      systemPrompt: DISCOVERY_EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Conversation transcript:\n"""\n${conversation.slice(0, 12000)}\n"""\n\nExtract the structured entities.`,
        },
      ],
      schema: ExtractionSchema,
      maxTokens: 2000,
      temperature: 0.2,
      cache: false,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extraction = (result as any).object || {
      painPoints: [],
      insights: [],
      quotes: [],
      clientContext: {},
      phaseProgress: {},
    };
    res.json({ extraction });
  } catch (error) {
    logger.error('[Discovery] extraction failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Discovery extraction failed',
    });
  }
});

export default router;
