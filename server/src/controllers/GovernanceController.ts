/**
 * Governance Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles change requests and governance policies
 */

import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

export class GovernanceController {
  /**
   * Get change requests for an organization
   */
  static getChangeRequests = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const sql = `SELECT * FROM change_requests WHERE organization_id = ? ORDER BY created_at DESC`;
      const requests = await queryHelpers.queryAll(sql, [orgId]);

      res.json(requests);
    }
  );

  /**
   * Create a new change request
   */
  static createChangeRequest = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { projectId, title, description, reason, impact } = req.body;

      if (!title) {
        res.status(400).json({ error: 'Title is required' });
        return;
      }

      const id = uuidv4();
      const sql = `
            INSERT INTO change_requests (id, organization_id, project_id, requester_id, title, description, reason, impact, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

      await queryHelpers.queryRun(sql, [
        id,
        orgId,
        projectId || null,
        userId,
        title,
        description || null,
        reason || null,
        impact || null,
        'PENDING',
      ]);

      res.status(201).json({ id, title, status: 'PENDING', message: 'Change request created' });
    }
  );

  /**
   * List governance policies
   */
  static getPolicies = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const sql = `SELECT * FROM governance_policies WHERE organization_id = ? OR organization_id IS NULL`;
      const policies = await queryHelpers.queryAll(sql, [orgId]);

      res.json(policies);
    }
  );
}

export default GovernanceController;
