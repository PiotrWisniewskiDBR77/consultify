// @ts-nocheck
/**
 * Project Quota Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Enforces storage limits per project
 */

import { NextFunction, Request, Response } from 'express';
import * as fs from 'fs';

import usageService from '../../services/usageService.js';
import logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// TYPES
// ==========================================

interface UsageService {
    checkProjectQuota: (projectId: string) => Promise<{
        allowed: boolean;
        used: number;
        limit: number;
        percentage: number;
    }>;
}

interface FileRequest extends Request {
    file?: any;
    body: any;
    query: any;
}

interface Dependencies {
    usageService: UsageService;
}

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

let deps: Dependencies = { usageService };

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Enforce project storage quota
 */
export async function enforceProjectQuota(req: FileRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const { usageService } = deps;

        const projectId = req.body?.project_id || req.query?.projectId;

        // If no project specified, skip project-level check (falls back to Org check)
        if (!projectId || typeof projectId !== 'string') {
            next();
            return;
        }

        const quota = await usageService.checkProjectQuota(projectId);

        if (!quota.allowed) {
            // Cleanup temp file if it exists (since we are rejecting after upload)
            if (req.file?.path) {
                try {
                    fs.unlinkSync(req.file.path);
                } catch (e: unknown) {
                    logger.error('Failed to cleanup temp file:', e);
                }
            }

            res.status(429).json({
                error: 'Project storage quota exceeded',
                code: 'PROJECT_STORAGE_EXCEEDED',
                usage: {
                    usedGB: (quota.used / (1024 * 1024 * 1024)).toFixed(2),
                    limitGB: (quota.limit / (1024 * 1024 * 1024)).toFixed(2),
                    percentage: quota.percentage.toFixed(1),
                },
                message: 'This project has exceeded its storage limit.',
            });
            return;
        }

        next();
    } catch (error: unknown) {
        logger.error('Project quota check error:', error);
        // Fail closed for safety
        res.status(500).json({ error: 'Failed to verify project quota' });
    }
}

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (newDeps: Partial<Dependencies>): void => {
    deps = { ...deps, ...newDeps };
};
