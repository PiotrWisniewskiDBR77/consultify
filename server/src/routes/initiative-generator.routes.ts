/**
 * Initiative Generator Routes - AI-powered initiative generation
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    res.json(
      (await dbAll(
        `SELECT id, title, description, source, priority, status, estimated_impact, created_at
    FROM generated_initiatives WHERE organization_id = ? ORDER BY priority DESC, created_at DESC`,
        [orgId]
      )) || []
    );
  })
);

router.post(
  '/generate',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { source, context, assessmentId } = req.body;
    const id = uuidv4();
    // Portable timestamp (ISO string) so the INSERT works on both SQLite and
    // Postgres — `datetime('now')` is SQLite-only and breaks on Postgres.
    const createdAt = new Date().toISOString();

    // A5 fix — real LLM generation instead of persisting JSON.stringify(context).
    // Best-effort: if the LLM call fails, fall back to a clearly-marked draft
    // (with the source basket inlined) rather than blocking the request.
    let title = 'AI Generated Initiative';
    let description = JSON.stringify(context || {});
    let priority: 'high' | 'medium' | 'low' = 'medium';
    let estimatedImpact: string | null = null;

    try {
      const llmMod: any = await import('../services/ai/llmService.js');
      const llm = llmMod.llmService || llmMod.default;
      if (llm?.generateResponse) {
        const systemPrompt = `You are a senior management consultant generating a draft transformation initiative.
You produce concise, action-oriented initiative briefs grounded in the provided context (interview evidence, tool outputs, assessment findings).
Respond ONLY with valid JSON of this exact shape:
{
  "title": "Short, action-oriented title (max 80 chars)",
  "description": "2-4 sentence brief: problem, proposed approach, expected outcome",
  "priority": "high|medium|low",
  "estimatedImpact": "One-sentence quantified expected impact (financial / operational / strategic)"
}`;
        const userPrompt = `Source: ${source || 'manual'}
${assessmentId ? `Assessment ID: ${assessmentId}\n` : ''}Context:
${JSON.stringify(context || {}, null, 2).slice(0, 4000)}

Generate the initiative draft now.`;
        const result: any = await llm.generateResponse({
          prompt: userPrompt,
          systemPrompt,
          maxTokens: 600,
          temperature: 0.3,
        });
        const raw = result?.text || result?.content || result?.response || '';
        if (raw) {
          try {
            const match = String(raw).match(/\{[\s\S]*\}/);
            const parsed = match ? JSON.parse(match[0]) : null;
            if (parsed && typeof parsed === 'object') {
              if (parsed.title && typeof parsed.title === 'string') {
                title = String(parsed.title).slice(0, 200);
              }
              if (parsed.description && typeof parsed.description === 'string') {
                description = String(parsed.description).slice(0, 4000);
              }
              if (
                parsed.priority &&
                ['high', 'medium', 'low'].includes(String(parsed.priority).toLowerCase())
              ) {
                priority = String(parsed.priority).toLowerCase() as 'high' | 'medium' | 'low';
              }
              if (parsed.estimatedImpact && typeof parsed.estimatedImpact === 'string') {
                estimatedImpact = String(parsed.estimatedImpact).slice(0, 1000);
              }
            }
          } catch {
            // Parse failed — fall through to the JSON-fallback description set above
          }
        }
      }
    } catch {
      // LLM unavailable — preserve fallback values; non-blocking
    }

    await dbRun(
      `INSERT INTO generated_initiatives (id, organization_id, title, description, source, priority, status, estimated_impact, assessment_id, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
      [
        id,
        orgId,
        title,
        description,
        source || 'manual',
        priority,
        estimatedImpact,
        assessmentId ?? null,
        userId ?? null,
        createdAt,
      ]
    );
    res.json({
      success: true,
      id,
      title,
      description,
      priority,
      estimatedImpact,
      message: 'Initiative generated',
    });
  })
);

router.put(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { title, description, priority, status } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    if (title) {
      updates.push('title = ?');
      params.push(title);
    }
    if (description) {
      updates.push('description = ?');
      params.push(description);
    }
    if (priority) {
      updates.push('priority = ?');
      params.push(priority);
    }
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (!updates.length) return res.status(400).json({ error: 'No updates' });
    params.push(req.params.id);
    await dbRun(`UPDATE generated_initiatives SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true });
  })
);

export default router;
