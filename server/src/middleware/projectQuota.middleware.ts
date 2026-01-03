/**
 * Project Quota Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Enforces storage limits per project
 */

import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';
import * as fs from 'fs';

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
    file?: {
        path?: string;
    };
    body?: {
        project_id?: string;
    };
    query?: {
        projectId?: string;
    };
}

interface Dependencies {
    usageService: UsageService;
}

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

let deps: Dependencies;

const getDeps = (): Dependencies => {
    if (!deps) {
        const defaultUsageService = require('../../services/usageService');
        deps = { usageService: defaultUsageService };
    }
    return deps;
};

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Enforce project storage quota
 */
export async function enforceProjectQuota(
    req: FileRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { usageService } = getDeps();
        
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
                } catch (e) {
                    console.error('Failed to cleanup temp file:', e);
                }
            }

            res.status(429).json({
                error: 'Project storage quota exceeded',
                code: 'PROJECT_STORAGE_EXCEEDED',
                usage: {
                    usedGB: (quota.used / (1024 * 1024 * 1024)).toFixed(2),
                    limitGB: (quota.limit / (1024 * 1024 * 1024)).toFixed(2),
                    percentage: quota.percentage.toFixed(1)
                },
                message: 'This project has exceeded its storage limit.'
            });
            return;
        }

        next();
    } catch (error) {
        console.error('Project quota check error:', error);
        // Fail closed for safety
        res.status(500).json({ error: 'Failed to verify project quota' });
    }
}

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (newDeps: Partial<Dependencies>): void => {
    deps = { ...getDeps(), ...newDeps };
};

