/**
 * Migration Rollback System
 * Safely rollback database migrations
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabase } from '../database/index.js';
import logger from '../utils/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RollbackResult {
    success: boolean;
    version: string;
    message: string;
    error?: string;
}

export async function rollbackMigration(version?: string): Promise<RollbackResult> {
    const db = getDatabase();

    try {
        // Get last applied migration if version not specified
        if (!version) {
            const result = await db.query(
                'SELECT version FROM schema_migrations WHERE status = ? ORDER BY applied_at DESC LIMIT 1',
                ['success']
            );

            if (result.rows.length === 0) {
                return {
                    success: false,
                    version: '',
                    message: 'No migrations to rollback',
                };
            }

            version = result.rows[0].version;
        }

        logger.info(`[Rollback] Rolling back migration ${version}...`);

        // Create backup before rollback
        logger.info('[Rollback] Creating safety backup...');
        const { execSync } = await import('child_process');
        const backupPath = path.join(__dirname, `../../backups/pre-rollback-${version}-${Date.now()}.db`);
        execSync(`sqlite3 server/consultinity.db ".backup '${backupPath}'"`);

        // Mark migration as rolled back
        await db.query(
            'UPDATE schema_migrations SET status = ?, applied_at = ? WHERE version = ?',
            ['rolled_back', new Date().toISOString(), version]
        );

        logger.info(`[Rollback] ✅ Migration ${version} rolled back successfully`);
        logger.info(`[Rollback] Safety backup: ${backupPath}`);

        return {
            success: true,
            version,
            message: `Migration ${version} rolled back. Manual schema changes may be required.`,
        };
    } catch (error) {
        logger.error('[Rollback] Rollback failed:', error);
        return {
            success: false,
            version: version || '',
            message: 'Rollback failed',
            error: String(error),
        };
    }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const version = process.argv[2];
    rollbackMigration(version).then((result) => {
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.success ? 0 : 1);
    });
}
