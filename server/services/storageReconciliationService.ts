import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import db from '../database.js';
import StorageService from './storageService.js';

interface Database {
    get: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
    run: (
        sql: string,
        params: unknown[],
        callback: (this: { lastID: number; changes: number }, err: Error | null) => void,
    ) => void;
}

interface StorageReconciliationServiceInterface {
    runReconciliation: () => Promise<void>;
}

const StorageReconciliationService: StorageReconciliationServiceInterface = {
    /**
     * Run storage reconciliation
     */
    runReconciliation: async (): Promise<void> => {
        console.log('[Reconciliation] Starting Storage Audit...');

        // 1. Calculate Physical Sizes per Organization/Project
        const uploadRoot = path.resolve(__dirname, '../../uploads');
        if (!fs.existsSync(uploadRoot)) return;

        const orgDirs = fs.readdirSync(uploadRoot, { withFileTypes: true }).filter((d) => d.isDirectory());

        let discrepancies = 0;
        const scandFiles = 0;

        for (const orgDir of orgDirs) {
            const orgId = orgDir.name;
            const orgPath = path.join(uploadRoot, orgId);

            // Structure: /uploads/{orgId}/{projectId}/...
            const projectDirs = fs.readdirSync(orgPath, { withFileTypes: true }).filter((d) => d.isDirectory());

            for (const projDir of projectDirs) {
                if (projDir.name === '.trash') continue; // Skip trash for now

                const projectId = projDir.name === 'global' ? null : projDir.name;
                const projPath = path.join(orgPath, projDir.name);

                // Calculate actual size recursively
                const actualSizeBytes = await StorageService.getDirectorySize(projPath);

                // Get Reported Size from DB
                if (projectId) {
                    const projectRow = await new Promise<unknown>((resolve) => {
                        (db as Database).get(
                            'SELECT storage_used_bytes FROM projects WHERE id = ?',
                            [projectId],
                            (err, row) => resolve(row),
                        );
                    });

                    const reportedBytes = projectRow ? projectRow.storage_used_bytes : 0;

                    if (Math.abs(actualSizeBytes - reportedBytes) > 1024 * 1024) {
                        // > 1MB difference
                        console.warn(
                            `[Reconciliation] Discrepancy for Project ${projectId}: Physical=${actualSizeBytes}, Reported=${reportedBytes}`,
                        );
                        discrepancies++;

                        // Auto-fix?
                        // db.run("UPDATE projects SET storage_used_bytes = ? WHERE id = ?", [actualSizeBytes, projectId]);
                    }
                }
            }
        }

        // Log result to Audit Table
        const id = uuidv4();
        (db as Database).run(
            `INSERT INTO storage_audit_logs (id, organization_id, action, files_scanned, discrepancies_found) VALUES (?, 'system', 'daily_reconciliation', ?, ?)`,
            [id, scandFiles, discrepancies],
        );

        console.log(`[Reconciliation] Completed. Discrepancies found: ${discrepancies}`);
    },
};

export default StorageReconciliationService;
