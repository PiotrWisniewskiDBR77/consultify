/**
 * Project Quota Middleware
 * Enforces storage limits per project
 */

const usageService = require('../services/usageService');

async function enforceProjectQuota(req, res, next) {
    try {
        const projectId = req.body.project_id || req.query.projectId;

        // If no project specified, skip project-level check (falls back to Org check)
        if (!projectId) {
            return next();
        }

        const quota = await usageService.checkProjectQuota(projectId);

        if (!quota.allowed) {
            // Cleanup temp file if it exists (since we are rejecting after upload)
            if (req.file && req.file.path) {
                const fs = require('fs');
                try { fs.unlinkSync(req.file.path); } catch (e) { console.error('Failed to cleanup temp file:', e); }
            }

            return res.status(429).json({
                error: 'Project storage quota exceeded',
                code: 'PROJECT_STORAGE_EXCEEDED',
                usage: {
                    usedGB: (quota.used / (1024 * 1024 * 1024)).toFixed(2),
                    limitGB: (quota.limit / (1024 * 1024 * 1024)).toFixed(2),
                    percentage: quota.percentage.toFixed(1)
                },
                message: 'This project has exceeded its storage limit.'
            });
        }

        next();
    } catch (error) {
        console.error('Project quota check error:', error);
        // Fail open or closed? Closed for safety.
        res.status(500).json({ error: 'Failed to verify project quota' });
    }
}

module.exports = enforceProjectQuota;
