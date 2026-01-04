/**
 * Admin Alert Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles admin alert-related business logic
 */

import type { Response } from 'express';

import { createAdminAlert, getAlertHistory } from '../services/adminAlertService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { CreateAdminAlertRequest } from '../validators/admin.validators.js';

// ==========================================
// CONTROLLER METHODS
// ==========================================

export class AdminAlertController {
    /**
     * Get all admin alerts for organization
     */
    static getAlerts = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const orgId = req.user?.organizationId;
        const limit = parseInt(String(req.query.limit || 50), 10);
        if (!orgId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const alerts = await getAlertHistory(orgId, limit);

        res.json({ alerts });
    });

    /**
     * Create admin alert
     */
    static createAlert = asyncHandler(
        async (req: AuthenticatedRequest<CreateAdminAlertRequest>, res: Response): Promise<void> => {
            const orgId = req.user?.organizationId;
            const alertConfig = req.body;
            if (!orgId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const alert = await createAdminAlert(orgId, alertConfig);

            res.json({ success: true, alert });
        },
    );

    /**
     * Get alert history
     */
    static getAlertHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const orgId = req.user?.organizationId;
        const limit = parseInt(String(req.query.limit || 50), 10);
        if (!orgId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const alerts = await getAlertHistory(orgId, limit);
        const triggered = alerts.filter((a) => (a.trigger_count || 0) > 0);

        res.json({ alerts: triggered });
    });
}

export default AdminAlertController;
