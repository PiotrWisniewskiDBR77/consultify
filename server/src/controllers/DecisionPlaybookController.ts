import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import {
  type DecisionPlaybook,
  PlaybookSchema,
  validateRequiredFields,
} from '../services/decisionPlaybookService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { decodeHtmlEntities } from '../utils/htmlEntities.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

interface PlaybookRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  decision_type: string;
  required_fields_json: string;
  workflow_stages_json: string;
  approval_config_json: string | null;
  is_default: boolean | number;
  is_active: boolean | number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function rowToPlaybook(row: PlaybookRow): DecisionPlaybook {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description ?? undefined,
    decisionType: row.decision_type,
    requiredFields: JSON.parse(row.required_fields_json || '[]'),
    workflowStages: JSON.parse(row.workflow_stages_json || '[]'),
    approvalConfig: row.approval_config_json ? JSON.parse(row.approval_config_json) : undefined,
    isDefault: Boolean(row.is_default),
    isActive: Boolean(row.is_active),
  };
}

export class DecisionPlaybookController {
  static listPlaybooks = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const rows = await queryHelpers.queryAll<PlaybookRow>(
        `SELECT * FROM decision_playbooks WHERE organization_id = ? AND is_active = true ORDER BY created_at DESC`,
        [orgId]
      );

      res.json((rows || []).map(rowToPlaybook));
    }
  );

  static createPlaybook = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?.id;
      const orgId = req.user?.organizationId;
      if (!userId || !orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const body = req.body;
      // T5 (Z139 follow-up): decode HTML entities the global input-sanitization
      // middleware escaped, before storing.
      if (typeof body.name === 'string') body.name = decodeHtmlEntities(body.name);
      if (typeof body.description === 'string')
        body.description = decodeHtmlEntities(body.description);
      const id = uuidv4();

      if (body.isDefault) {
        await queryHelpers.queryRun(
          `UPDATE decision_playbooks SET is_default = false, updated_at = CURRENT_TIMESTAMP
           WHERE organization_id = ? AND decision_type = ? AND is_default = true`,
          [orgId, body.decisionType]
        );
      }

      await queryHelpers.queryRun(
        `INSERT INTO decision_playbooks (id, organization_id, name, description, decision_type, required_fields_json, workflow_stages_json, approval_config_json, is_default, is_active, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          id,
          orgId,
          body.name,
          body.description || null,
          body.decisionType,
          JSON.stringify(body.requiredFields || []),
          JSON.stringify(body.workflowStages || []),
          JSON.stringify(body.approvalConfig || {}),
          body.isDefault ? true : false,
          body.isActive !== false,
          userId,
        ]
      );

      res.status(201).json({ id, name: body.name, decisionType: body.decisionType });
    }
  );

  static getPlaybook = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { playbookId } = req.params;
      const row = await queryHelpers.queryOne<PlaybookRow>(
        `SELECT * FROM decision_playbooks WHERE id = ? AND organization_id = ?`,
        [playbookId, orgId]
      );

      if (!row) {
        res.status(404).json({ error: 'Playbook not found' });
        return;
      }

      res.json(rowToPlaybook(row));
    }
  );

  static updatePlaybook = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { playbookId } = req.params;
      const existing = await queryHelpers.queryOne<PlaybookRow>(
        `SELECT * FROM decision_playbooks WHERE id = ? AND organization_id = ?`,
        [playbookId, orgId]
      );

      if (!existing) {
        res.status(404).json({ error: 'Playbook not found' });
        return;
      }

      const body = req.body;
      // T5 (Z139 follow-up): decode HTML entities before storing — see createPlaybook.
      if (typeof body.name === 'string') body.name = decodeHtmlEntities(body.name);
      if (typeof body.description === 'string')
        body.description = decodeHtmlEntities(body.description);

      if (body.isDefault && !existing.is_default) {
        await queryHelpers.queryRun(
          `UPDATE decision_playbooks SET is_default = false, updated_at = CURRENT_TIMESTAMP
           WHERE organization_id = ? AND decision_type = ? AND is_default = true AND id != ?`,
          [orgId, body.decisionType, playbookId]
        );
      }

      await queryHelpers.queryRun(
        `UPDATE decision_playbooks SET name = ?, description = ?, decision_type = ?, required_fields_json = ?, workflow_stages_json = ?, approval_config_json = ?, is_default = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ?`,
        [
          body.name,
          body.description || null,
          body.decisionType,
          JSON.stringify(body.requiredFields || []),
          JSON.stringify(body.workflowStages || []),
          JSON.stringify(body.approvalConfig || {}),
          body.isDefault ? true : false,
          body.isActive !== false,
          playbookId,
          orgId,
        ]
      );

      res.json({ id: playbookId, message: 'Playbook updated' });
    }
  );

  static deletePlaybook = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { playbookId } = req.params;
      const existing = await queryHelpers.queryOne<PlaybookRow>(
        `SELECT * FROM decision_playbooks WHERE id = ? AND organization_id = ?`,
        [playbookId, orgId]
      );

      if (!existing) {
        res.status(404).json({ error: 'Playbook not found' });
        return;
      }

      const usageCount = await queryHelpers.queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM decisions WHERE playbook_id = ? AND organization_id = ?`,
        [playbookId, orgId]
      );

      if (usageCount && usageCount.count > 0) {
        res.status(409).json({
          error: 'Playbook is in use by decisions and cannot be deleted',
          usageCount: usageCount.count,
        });
        return;
      }

      await queryHelpers.queryRun(
        `DELETE FROM decision_playbooks WHERE id = ? AND organization_id = ?`,
        [playbookId, orgId]
      );

      res.json({ id: playbookId, message: 'Playbook deleted' });
    }
  );

  static getRequiredFieldsStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const decision = await queryHelpers.queryOne<{
        id: string;
        organization_id: string;
        playbook_id: string | null;
        type: string;
        workflow_status: string | null;
        title: string | null;
        description: string | null;
        priority: string | null;
        impact: string | null;
        deadline: string | null;
        decision_maker_id: string | null;
        decision_rationale: string | null;
      }>(
        `SELECT id, organization_id, playbook_id, type, workflow_status, title, description, priority, impact, deadline, decision_maker_id, decision_rationale FROM decisions WHERE id = ? AND organization_id = ?`,
        [id, orgId]
      );

      if (!decision) {
        res.status(404).json({ error: 'Decision not found' });
        return;
      }

      let playbookRow: PlaybookRow | null = null;

      if (decision.playbook_id) {
        playbookRow = await queryHelpers.queryOne<PlaybookRow>(
          `SELECT * FROM decision_playbooks WHERE id = ? AND organization_id = ?`,
          [decision.playbook_id, orgId]
        );
      }

      if (!playbookRow) {
        playbookRow = await queryHelpers.queryOne<PlaybookRow>(
          `SELECT * FROM decision_playbooks WHERE organization_id = ? AND decision_type = ? AND is_default = true AND is_active = true LIMIT 1`,
          [orgId, decision.type]
        );
      }

      if (!playbookRow) {
        res.json({ complete: true, missing: [], playbook: null });
        return;
      }

      const playbook = rowToPlaybook(playbookRow);
      const currentStage = decision.workflow_status || 'proposed';

      const decisionData: Record<string, unknown> = {
        title: decision.title,
        description: decision.description,
        priority: decision.priority,
        impact: decision.impact,
        deadline: decision.deadline,
        decisionMakerId: decision.decision_maker_id,
        rationale: decision.decision_rationale,
      };

      const result = validateRequiredFields(playbook, decisionData, currentStage);

      res.json({
        ...result,
        playbook: { id: playbook.id, name: playbook.name },
      });
    }
  );
}

export default DecisionPlaybookController;
