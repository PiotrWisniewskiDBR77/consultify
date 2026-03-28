import type { Response } from 'express';

import staffingPlanService from '../services/staffingPlanService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export class StaffingPlanController {
  static listPlans = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const plans = await staffingPlanService.listPlans(initiativeId, orgId);
      res.json({ plans });
    }
  );

  static createPlan = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const { id: initiativeId } = req.params;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { name, status, plannedStart, plannedEnd, notes } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'name is required' });
        return;
      }

      const plan = await staffingPlanService.createPlan(
        initiativeId,
        orgId,
        { name: name.trim(), status, plannedStart, plannedEnd, notes },
        userId
      );
      res.status(201).json(plan);
    }
  );

  static getPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    const { planId } = req.params as any;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await staffingPlanService.getPlan(planId, orgId);
    if (!result) {
      res.status(404).json({ error: 'Staffing plan not found' });
      return;
    }

    res.json(result);
  });

  static updatePlan = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { planId } = req.params as any;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { name, status, plannedStart, plannedEnd, notes } = req.body;
      await staffingPlanService.updatePlan(planId, orgId, {
        name,
        status,
        plannedStart,
        plannedEnd,
        notes,
      });
      res.json({ success: true });
    }
  );

  static deletePlan = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { planId } = req.params as any;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await staffingPlanService.deletePlan(planId, orgId);
      res.json({ success: true });
    }
  );

  static addRole = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    const { planId } = req.params as any;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { roleName, requiredSkills, fteRequired, assignedUserId, startDate, endDate, priority } =
      req.body;
    if (!roleName || typeof roleName !== 'string' || !roleName.trim()) {
      res.status(400).json({ error: 'roleName is required' });
      return;
    }

    const role = await staffingPlanService.addRole(planId, {
      roleName: roleName.trim(),
      requiredSkills,
      fteRequired,
      assignedUserId,
      startDate,
      endDate,
      priority,
    });
    res.status(201).json(role);
  });

  static updateRole = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { planId, roleId } = req.params as any;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const {
        roleName,
        requiredSkills,
        fteRequired,
        fteAllocated,
        assignedUserId,
        startDate,
        endDate,
        priority,
        status,
      } = req.body;
      await staffingPlanService.updateRole(roleId, planId, {
        roleName,
        requiredSkills,
        fteRequired,
        fteAllocated,
        assignedUserId,
        startDate,
        endDate,
        priority,
        status,
      });
      res.json({ success: true });
    }
  );

  static deleteRole = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { planId, roleId } = req.params as any;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await staffingPlanService.deleteRole(roleId, planId);
      res.json({ success: true });
    }
  );

  static getGaps = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    const { planId } = req.params as any;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const gaps = await staffingPlanService.computeStaffingGaps(planId, orgId);
    res.json({ gaps });
  });

  static syncCapacity = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await staffingPlanService.syncInitiativeCapacity(initiativeId, orgId);
      res.json({ success: true });
    }
  );
}

export default StaffingPlanController;
