/**
 * ToolController
 * Tools -> Initiatives workflow
 */

import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import { hasPermission } from '../services/permissionService.js';
import ToolInitiativeService from '../services/ToolInitiativeService.js';

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
};

const normalizeStatus = (status: string | null | undefined) =>
  (status || 'DRAFT').toUpperCase();

const ensurePermission = async (
  req: AuthenticatedRequest,
  permissionKey: string
): Promise<boolean> => {
  const user = req.user;
  if (!user) return false;
  return hasPermission(user.id, user.organizationId, permissionKey, user.role as any);
};

const requireDoD = (session: ToolSessionRow): boolean => {
  return (session.completion_percent || 0) >= 100;
};

export class ToolController {
  static createToolSession = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

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
        `SELECT i.id, COALESCE(i.title, i.name) as title, i.status, l.batch_id
         FROM tool_initiative_links l
         LEFT JOIN initiatives i ON l.initiative_id = i.id
         WHERE l.tool_session_id = ?
         ORDER BY l.created_at DESC`,
        [toolId]
      );

      res.json({
        ...session,
        status: normalizeStatus(session.status),
        answers: session.answers_json ? JSON.parse(session.answers_json) : {},
        contextSnapshot: session.context_snapshot ? JSON.parse(session.context_snapshot) : {},
        generatedInitiatives: initiatives,
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

      if (!requireDoD(session)) {
        res.status(409).json({ error: 'DoD not satisfied' });
        return;
      }

      const now = new Date().toISOString();
      await queryHelpers.queryRun(
        `INSERT INTO tool_decisions (id, tool_session_id, decision_type, status, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), toolId, 'REQUEST_REVIEW', 'APPROVED', user.id, now]
      );

      await queryHelpers.queryRun(
        `UPDATE tool_sessions SET status = 'REVIEW', review_requested_at = ?, updated_at = ? WHERE id = ?`,
        [now, now, toolId]
      );

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

      if (!requireDoD(session)) {
        res.status(409).json({ error: 'DoD not satisfied' });
        return;
      }

      const now = new Date().toISOString();
      await queryHelpers.queryRun(
        `INSERT INTO tool_decisions (id, tool_session_id, decision_type, status, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), toolId, 'APPROVE_TOOL', 'APPROVED', user.id, now]
      );

      await queryHelpers.queryRun(
        `UPDATE tool_sessions SET status = 'APPROVED', approved_at = ?, updated_at = ? WHERE id = ?`,
        [now, now, toolId]
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

      await queryHelpers.queryRun(
        `INSERT INTO tool_decisions (id, tool_session_id, decision_type, status, comment, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), toolId, 'APPROVE_TOOL', 'REJECTED', comment || null, user.id, now]
      );

      await queryHelpers.queryRun(
        `UPDATE tool_sessions SET status = 'DRAFT', updated_at = ? WHERE id = ?`,
        [now, toolId]
      );

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

      const { methodologyId, count, includeChatContext } = req.body;
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

      if (normalizeStatus(session.status) !== 'APPROVED') {
        res.status(409).json({ error: 'Tool session not approved' });
        return;
      }

      const approveDecision = await queryHelpers.queryOne(
        `SELECT id FROM tool_decisions WHERE tool_session_id = ? AND decision_type = 'APPROVE_TOOL' AND status = 'APPROVED'`,
        [toolId]
      );
      if (!approveDecision) {
        res.status(409).json({ error: 'Approve decision missing' });
        return;
      }

      const batchId = uuidv4();
      const now = new Date().toISOString();
      await queryHelpers.queryRun(
        `INSERT INTO tool_initiative_batches (
          id, tool_session_id, methodology_id, initiatives_count, include_chat_context, generated_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          batchId,
          toolId,
          methodologyId,
          count,
          includeChatContext ? 1 : 0,
          user.id,
          now,
        ]
      );

      await queryHelpers.queryRun(
        `INSERT INTO tool_decisions (id, tool_session_id, decision_type, status, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), toolId, 'GENERATE_INITIATIVES', 'APPROVED', user.id, now]
      );

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

      res.json({ batchId, initiatives: created });
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
