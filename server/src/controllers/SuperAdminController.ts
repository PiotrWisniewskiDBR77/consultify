/**
 * Super Admin Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles all super admin-related business logic
 */

import type { Response } from 'express';

import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import type {
    _CreateAccessCodeRequest,
    CreateUserAdminRequest,
    ImpersonateUserRequest,
    UpdateOrganizationAdminRequest,
    UpdateUserAdminRequest,
} from '../validators/admin.validators.js';

// ==========================================
// CONTROLLER METHODS
// ==========================================

export class SuperAdminController {
    /**
     * Get all organizations
     */
    static getOrganizations = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const superAdminController = await import('../../controllers/superAdminController.js').then(
            (m) => m.default || m,
        );
        const orgs = await superAdminController.getOrganizations(req, res);
        res.json(orgs);
    });

    /**
     * Get dashboard stats
     */
    static getDashboardStats = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const superAdminController = await import('../../controllers/superAdminController.js').then(
            (m) => m.default || m,
        );
        const stats = await superAdminController.getDashboardStats(req, res);
        res.json(stats);
    });

    /**
     * Get all activities
     */
    static getActivities = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const superAdminController = await import('../../controllers/superAdminController.js').then(
            (m) => m.default || m,
        );
        const activities = await superAdminController.getActivities(req, res);
        res.json(activities);
    });

    /**
     * Update organization
     */
    static updateOrganization = asyncHandler(
        async (req: AuthenticatedRequest<UpdateOrganizationAdminRequest>, res: Response): Promise<void> => {
            const { id } = req.params;
            const updates = req.body;

            const superAdminController = await import('../../controllers/superAdminController.js').then(
                (m) => m.default || m,
            );
            await superAdminController.updateOrganization({ ...req, params: { id }, body: updates }, res);
        },
    );

    /**
     * Delete organization
     */
    static deleteOrganization = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;

        const superAdminController = await import('../../controllers/superAdminController.js').then(
            (m) => m.default || m,
        );
        await superAdminController.deleteOrganization({ ...req, params: { id } }, res);
    });

    /**
     * Get organization billing
     */
    static getOrgBilling = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;

        const superAdminController = await import('../../controllers/superAdminController.js').then(
            (m) => m.default || m,
        );
        const billing = await superAdminController.getOrgBilling({ ...req, params: { id } }, res);
        res.json(billing);
    });

    /**
     * Get all users
     */
    static getUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const superAdminController = await import('../../controllers/superAdminController.js').then(
            (m) => m.default || m,
        );
        const users = await superAdminController.getUsers(req, res);
        res.json(users);
    });

    /**
     * Create user
     */
    static createUser = asyncHandler(
        async (req: AuthenticatedRequest<CreateUserAdminRequest>, res: Response): Promise<void> => {
            const superAdminController = await import('../../controllers/superAdminController.js').then(
                (m) => m.default || m,
            );
            await superAdminController.createUser(req, res);
        },
    );

    /**
     * Update user
     */
    static updateUser = asyncHandler(
        async (req: AuthenticatedRequest<UpdateUserAdminRequest>, res: Response): Promise<void> => {
            const { id } = req.params;

            const superAdminController = await import('../../controllers/superAdminController.js').then(
                (m) => m.default || m,
            );
            await superAdminController.updateUser({ ...req, params: { id } }, res);
        },
    );

    /**
     * Impersonate user
     */
    static impersonateUser = asyncHandler(
        async (req: AuthenticatedRequest<ImpersonateUserRequest>, res: Response): Promise<void> => {
            const superAdminController = await import('../../controllers/superAdminController.js').then(
                (m) => m.default || m,
            );
            await superAdminController.impersonateUser(req, res);
        },
    );

    /**
     * Get system health
     */
    static getSystemHealth = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const superAdminController = await import('../../controllers/superAdminController.js').then(
            (m) => m.default || m,
        );
        const health = await superAdminController.getSystemHealth(req, res);
        res.json(health);
    });
}

export default SuperAdminController;
