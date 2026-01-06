/**
 * Database Initializer
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Ensures database schema is initialized and verified on startup
 * Prevents table loss by verifying schema integrity
 */

import { databaseConfig } from '../config/DatabaseConfig.js';
import logger from '../utils/Logger.js';
import { getDatabase, getDatabaseAsync } from './Database.js';
// @ts-ignore - Dynamic import of legacy module
const getLegacySqlite = async () => import('../../legacy_archive/database.sqlite.js');

// ==========================================
// SCHEMA VERIFICATION
// ==========================================

/**
 * Critical tables that must exist for the application to function
 */
const CRITICAL_TABLES = [
    'organizations',
    'users',
    'sessions',
    'projects',
    'tasks',
    'teams',
    'invitations',
    'notifications',
    'settings',
    'revoked_tokens',
    'superadmin_ai_settings',
    'organization_ai_settings',
    'user_ai_settings',
];

/**
 * Verify that critical tables exist
 */
async function verifySchema(): Promise<{ valid: boolean; missing: string[]; errors: string[] }> {
    const missing: string[] = [];
    const errors: string[] = [];

    try {
        const db = await getDatabaseAsync();
        const dbType = databaseConfig.type;

        if (dbType === 'postgres') {
            // PostgreSQL: Check information_schema
            for (const table of CRITICAL_TABLES) {
                try {
                    const result = await db.query<{ count: string }>(
                        `SELECT COUNT(*)::text as count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
                        [table],
                    );
                    const count = parseInt(result.rows[0]?.count || '0', 10);
                    if (count === 0) {
                        missing.push(table);
                    }
                } catch (err: any) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    errors.push(`Error checking table ${table}: ${error.message}`);
                }
            }
        } else {
            // SQLite: Check sqlite_master
            for (const table of CRITICAL_TABLES) {
                try {
                    const result = await db.query<{ count: number }>(
                        `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?`,
                        [table],
                    );
                    const count =
                        typeof result.rows[0]?.count === 'number'
                            ? result.rows[0].count
                            : parseInt(String(result.rows[0]?.count || '0'), 10);
                    if (count === 0) {
                        missing.push(table);
                    }
                } catch (err: any) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    errors.push(`Error checking table ${table}: ${error.message}`);
                }
            }
        }

        return {
            valid: missing.length === 0 && errors.length === 0,
            missing,
            errors,
        };
    } catch (err: any) {
        const error = err instanceof Error ? err : new Error(String(err));
        return {
            valid: false,
            missing: [],
            errors: [`Schema verification failed: ${error.message}`],
        };
    }
}

/**
 * Initialize database schema
 * This ensures all tables are created if they don't exist
 */
export async function initializeDatabase(): Promise<{ success: boolean; message: string }> {
    try {
        logger.info('[DatabaseInitializer] Starting database initialization...');

        // Get database instance
        const db = await getDatabaseAsync();
        const dbType = databaseConfig.type;

        logger.info(`[DatabaseInitializer] Database type: ${dbType}`);

        // For PostgreSQL, initDb() is called automatically when pool is created
        // But we'll verify it completed successfully
        if (dbType === 'postgres') {
            // Wait a bit for initDb() to complete (it's called asynchronously in getPool)
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Verify schema
            const verification = await verifySchema();
            if (!verification.valid) {
                if (verification.missing.length > 0) {
                    logger.error(`[DatabaseInitializer] Missing critical tables: ${verification.missing.join(', ')}`);
                    // Try to initialize schema manually
                    logger.info('[DatabaseInitializer] Attempting to initialize schema...');
                    // Note: initDb is not exported, so we'll trigger it by accessing the pool
                    await db.query('SELECT 1');
                    // Wait again for initDb
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                    // Verify again
                    const recheck = await verifySchema();
                    if (!recheck.valid) {
                        return {
                            success: false,
                            message: `Schema initialization incomplete. Missing tables: ${recheck.missing.join(', ')}`,
                        };
                    }
                }
                if (verification.errors.length > 0) {
                    logger.error(`[DatabaseInitializer] Schema verification errors: ${verification.errors.join(', ')}`);
                    return {
                        success: false,
                        message: `Schema verification failed: ${verification.errors.join(', ')}`,
                    };
                }
            }
        } else {
            // SQLite: Check if schema exists, if not, initialize
            const verification = await verifySchema();
            if (!verification.valid && verification.missing.length > 0) {
                logger.warn(
                    `[DatabaseInitializer] SQLite schema incomplete. Missing tables: ${verification.missing.join(', ')}`,
                );

                // Manually trigger schema initialization
                logger.info('[DatabaseInitializer] Manually triggering SQLite schema initialization...');
                
                // Use TEST_SCHEMA if available
                try {
                    const { TEST_SCHEMA } = await import('../../../tests/utils/testSchema.js');
                    logger.info('[DatabaseInitializer] Using TEST_SCHEMA for initialization');
                    for (const sql of TEST_SCHEMA) {
                        await new Promise<void>((resolve, reject) => {
                            db.run(sql, (err: Error | null) => {
                                if (err) {
                                    logger.error(`[DatabaseInitializer] Error executing schema SQL: ${err.message}`);
                                    // Some errors like "table already exists" might be okay if using IF NOT EXISTS
                                    if (err.message.includes('already exists')) resolve();
                                    else reject(err);
                                } else {
                                    resolve();
                                }
                            });
                        });
                    }
                } catch (schemaErr) {
                    logger.warn('[DatabaseInitializer] TEST_SCHEMA not found, falling back to legacy init');
                    const sqliteModule = await getLegacySqlite();
                    if (sqliteModule && sqliteModule.initDb) {
                        sqliteModule.initDb(db);
                        // Wait a bit for callbacks to fire
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }

            // ALWAYS attempt to run SEED statements from TEST_SCHEMA if in E2E_MODE
            // (Moved outside the 'missing tables' block to ensure seeds run on existing DBs too)
            if (process.env.E2E_MODE === 'true') {
                try {
                    const { TEST_SCHEMA } = await import('../../../tests/utils/testSchema.js');
                    logger.info('[DatabaseInitializer] E2E_MODE: Ensuring seed data from TEST_SCHEMA');
                    for (const sql of TEST_SCHEMA) {
                        if (sql.trim().toUpperCase().startsWith('INSERT')) {
                            try {
                                await new Promise<void>((resolve) => {
                                    db.run(sql, (err: Error | null) => {
                                        if (err) {
                                            if (!err.message.includes('UNIQUE constraint failed')) {
                                                logger.error(`[DatabaseInitializer] Seed Error: ${err.message}`);
                                            }
                                        }
                                        resolve(); // Continue anyway
                                    });
                                });
                            } catch (e) { /* ignore */ }
                        }
                    }
                } catch (e) { /* ignore */ }
            }

            // Verify again
            const recheck = await verifySchema();
            if (!recheck.valid && recheck.missing.length > 0) {
                logger.error(
                    `[DatabaseInitializer] SQLite schema still incomplete after initialization. Missing: ${recheck.missing.join(', ')}`,
                );
                return {
                    success: false,
                    message: `SQLite schema incomplete. Missing tables: ${recheck.missing.join(', ')}`,
                };
            }
        }

        // Final verification
        const finalVerification = await verifySchema();
        if (!finalVerification.valid) {
            return {
                success: false,
                message: `Database schema verification failed. Missing: ${finalVerification.missing.join(', ')}. Errors: ${finalVerification.errors.join(', ')}`,
            };
        }

        logger.info('[DatabaseInitializer] Database schema verified successfully');
        return {
            success: true,
            message: 'Database initialized and verified successfully',
        };
    } catch (err: any) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error(`[DatabaseInitializer] Database initialization failed: ${error.message}`);
        return {
            success: false,
            message: `Database initialization failed: ${error.message}`,
        };
    }
}

/**
 * Verify database connection and schema integrity
 * Called periodically to ensure database is healthy
 */
export async function verifyDatabaseHealth(): Promise<boolean> {
    try {
        const db = await getDatabaseAsync();
        // Simple connection test
        await db.query('SELECT 1');

        // Verify critical tables exist
        const verification = await verifySchema();
        if (!verification.valid) {
            logger.warn(
                `[DatabaseInitializer] Schema integrity check failed. Missing: ${verification.missing.join(', ')}`,
            );

            // Attempt to reinitialize if tables are missing
            if (verification.missing.length > 0) {
                logger.info('[DatabaseInitializer] Attempting to reinitialize missing tables...');
                const reinitResult = await initializeDatabase();
                if (!reinitResult.success) {
                    logger.error(`[DatabaseInitializer] Failed to reinitialize: ${reinitResult.message}`);
                    return false;
                }
                // Verify again after reinit
                const recheck = await verifySchema();
                if (!recheck.valid) {
                    logger.error(
                        `[DatabaseInitializer] Schema still invalid after reinit. Missing: ${recheck.missing.join(', ')}`,
                    );
                    return false;
                }
                logger.info('[DatabaseInitializer] Schema reinitialized successfully');
            }

            if (verification.errors.length > 0) {
                logger.error(`[DatabaseInitializer] Schema verification errors: ${verification.errors.join(', ')}`);
                return false;
            }
        }

        return true;
    } catch (err: any) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error(`[DatabaseInitializer] Database health check failed: ${error.message}`);
        return false;
    }
}

export default {
    initializeDatabase,
    verifyDatabaseHealth,
    verifySchema,
};
