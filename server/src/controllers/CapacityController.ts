/**
 * Capacity Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles user and project capacity analysis
 */

import type { Response } from 'express';

import type { AuthenticatedRequest } from '../types/index.js';
import {
  CAPACITY_POLICY,
  capacityHoursForAllocation,
  isOverloaded,
  utilizationPercent,
} from '../services/capacityPolicy.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

export class CapacityController {
  /**
   * Get capacity for a user
   */
  static getUserCapacity = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { userId } = req.params;
      const orgId = req.user?.organizationId;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      let totalCapacity: number = CAPACITY_POLICY.weeklyHoursPerFte;
      const projectId = req.query.projectId ? String(req.query.projectId) : null;
      const allocRows =
        (await queryHelpers.queryAll<{ allocation_percent: number }>(
          `SELECT COALESCE(allocation_percent, 100) as allocation_percent FROM project_members
           WHERE user_id = ? AND project_id IN (SELECT id FROM projects WHERE organization_id = ?)
           ${projectId ? 'AND project_id = ?' : ''}`,
          projectId ? [userId, orgId, projectId] : [userId, orgId]
        )) || [];
      if (allocRows.length > 0) {
        totalCapacity = allocRows.reduce(
          (sum, r) =>
            sum +
            capacityHoursForAllocation(r.allocation_percent),
          0
        );
      }
      const assignedResult = await queryHelpers.queryOne<{ hours: number }>(
        `SELECT COALESCE(SUM(estimated_hours), 0) as hours FROM tasks
         WHERE assignee_id = ? AND organization_id = ?
         AND lower(coalesce(status,'')) NOT IN ('done','completed','validated','cancelled')
         ${projectId ? 'AND project_id = ?' : ''}`,
        projectId ? [userId, orgId, projectId] : [userId, orgId]
      );
      const assignedHours = Number(assignedResult?.hours || 0);
      const availableHours = Math.max(0, totalCapacity - assignedHours);
      const utilization = utilizationPercent(assignedHours, totalCapacity);
      res.json({
        userId,
        totalCapacity: Math.round(totalCapacity * 10) / 10,
        assignedHours: Math.round(assignedHours * 10) / 10,
        availableHours: Math.round(availableHours * 10) / 10,
        utilization,
        projectId: projectId || undefined,
      });
    }
  );

  /**
   * Get overloads for a project
   */
  static getProjectOverloads = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId } = req.params;
      const orgId = req.user?.organizationId;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const members =
        (await queryHelpers.queryAll<{ user_id: string; allocation_percent: number }>(
          `SELECT user_id, COALESCE(allocation_percent, 100) as allocation_percent
           FROM project_members WHERE project_id = ?`,
          [projectId]
        )) || [];
      const overloads: Array<{
        userId: string;
        assignedHours: number;
        capacity: number;
        overload: number;
      }> = [];
      for (const m of members) {
        const cap = capacityHoursForAllocation(m.allocation_percent);
        const row = await queryHelpers.queryOne<{ hours: number }>(
          `SELECT COALESCE(SUM(estimated_hours), 0) as hours FROM tasks
           WHERE assignee_id = ? AND project_id = ? AND organization_id = ?
           AND lower(coalesce(status,'')) NOT IN ('done','completed','validated','cancelled')`,
          [m.user_id, projectId, orgId]
        );
        const assigned = Number(row?.hours || 0);
        if (isOverloaded(assigned, cap)) {
          overloads.push({
            userId: m.user_id,
            assignedHours: Math.round(assigned * 10) / 10,
            capacity: Math.round(cap * 10) / 10,
            overload: Math.round((assigned - cap) * 10) / 10,
          });
        }
      }
      res.json(overloads);
    }
  );

  /**
   * Get capacity summary for a project
   */
  static getProjectSummary = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId } = req.params;
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const teamCap = await queryHelpers.queryOne<{ cap: number }>(
        `SELECT COALESCE(SUM((COALESCE(pm.allocation_percent, 100) / 100.0) * ?), 0) as cap
         FROM project_members pm WHERE pm.project_id = ?`,
        [CAPACITY_POLICY.weeklyHoursPerFte, projectId]
      );
      const required = await queryHelpers.queryOne<{ hours: number }>(
        `SELECT COALESCE(SUM(estimated_hours), 0) as hours FROM tasks
         WHERE project_id = ? AND organization_id = ?
         AND lower(coalesce(status,'')) NOT IN ('done','completed','validated','cancelled')`,
        [projectId, orgId]
      );
      const totalTeamCapacity = Number(teamCap?.cap || 0);
      const totalRequiredHours = Number(required?.hours || 0);
      const shortfall = Math.max(0, totalRequiredHours - totalTeamCapacity);
      res.json({
        projectId,
        totalTeamCapacity: Math.round(totalTeamCapacity * 10) / 10,
        totalRequiredHours: Math.round(totalRequiredHours * 10) / 10,
        shortfall: Math.round(shortfall * 10) / 10,
        updatedAt: new Date().toISOString(),
      });
    }
  );
}

export default CapacityController;
