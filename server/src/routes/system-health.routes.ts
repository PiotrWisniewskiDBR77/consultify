/**
 * System Health Check API
 * Comprehensive health monitoring with auto-repair
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDatabaseAsync } from '../database/index.js';
import logger from '../utils/Logger.js';

const router = Router();

interface HealthCheck {
    name: string;
    status: 'healthy' | 'warning' | 'error';
    message: string;
    details?: any;
    autoFixAvailable?: boolean;
    autoFixed?: boolean;
}

interface SystemHealth {
    overall: 'healthy' | 'warning' | 'error';
    timestamp: string;
    checks: HealthCheck[];
    autoRepairsApplied: number;
}

/**
 * Check database connection
 */
async function checkDatabase(): Promise<HealthCheck> {
    try {
        const db = await getDatabaseAsync();
        await db.query('SELECT 1', []);

        return {
            name: 'Database Connection',
            status: 'healthy',
            message: 'Database is connected and responsive',
        };
    } catch (error) {
        return {
            name: 'Database Connection',
            status: 'error',
            message: `Database connection failed: ${error}`,
            autoFixAvailable: false,
        };
    }
}

/**
 * Check critical tables
 */
async function checkTables(): Promise<HealthCheck> {
    try {
        const db = await getDatabaseAsync();
        const criticalTables = [
            'users',
            'organizations',
            'sessions',
            'projects',
            'refresh_tokens',
            'mfa_settings',
        ];

        const missing: string[] = [];
        const existing: string[] = [];

        for (const table of criticalTables) {
            const result = await db.query(
                `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
                [table]
            );

            if (result.length > 0) {
                existing.push(table);
            } else {
                missing.push(table);
            }
        }

        if (missing.length === 0) {
            return {
                name: 'Critical Tables',
                status: 'healthy',
                message: `All ${criticalTables.length} critical tables present`,
                details: { existing },
            };
        } else {
            return {
                name: 'Critical Tables',
                status: 'error',
                message: `Missing ${missing.length} tables: ${missing.join(', ')}`,
                details: { missing, existing },
                autoFixAvailable: true,
            };
        }
    } catch (error) {
        return {
            name: 'Critical Tables',
            status: 'error',
            message: `Table check failed: ${error}`,
            autoFixAvailable: false,
        };
    }
}

/**
 * Check users and admin accounts
 */
async function checkUsers(): Promise<HealthCheck> {
    try {
        const db = await getDatabaseAsync();

        // Check if users table exists
        const tableCheck = await db.query(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='users'`,
            []
        );

        if (tableCheck.length === 0) {
            return {
                name: 'User Accounts',
                status: 'error',
                message: 'Users table does not exist',
                autoFixAvailable: true,
            };
        }

        // Count users
        const users = await db.query('SELECT COUNT(*) as count FROM users', []);
        const userCount = users[0].count;

        // Check for admin users
        const admins = await db.query(
            `SELECT email, role FROM users WHERE role IN ('ADMIN', 'SUPERADMIN')`,
            []
        );

        if (userCount === 0) {
            return {
                name: 'User Accounts',
                status: 'error',
                message: 'No users in database',
                details: { userCount: 0, adminCount: 0 },
                autoFixAvailable: true,
            };
        }

        if (admins.length === 0) {
            return {
                name: 'User Accounts',
                status: 'warning',
                message: `${userCount} users but no admin accounts`,
                details: { userCount, adminCount: 0 },
                autoFixAvailable: true,
            };
        }

        return {
            name: 'User Accounts',
            status: 'healthy',
            message: `${userCount} users, ${admins.length} admins`,
            details: {
                userCount,
                adminCount: admins.length,
                admins: admins.map((a: any) => ({ email: a.email, role: a.role })),
            },
        };
    } catch (error) {
        return {
            name: 'User Accounts',
            status: 'error',
            message: `User check failed: ${error}`,
            autoFixAvailable: false,
        };
    }
}

/**
 * Check default login credentials
 */
async function checkDefaultLogin(): Promise<HealthCheck> {
    try {
        const db = await getDatabaseAsync();
        const testEmail = 'admin@dbr77.com';
        const testPassword = '123456';

        const user = await db.query('SELECT * FROM users WHERE email = ?', [testEmail]);

        if (user.length === 0) {
            return {
                name: 'Default Login',
                status: 'warning',
                message: `Default user ${testEmail} not found`,
                details: { email: testEmail, password: testPassword },
                autoFixAvailable: true,
            };
        }

        // Verify password
        const isValid = await bcrypt.compare(testPassword, user[0].password);

        if (!isValid) {
            return {
                name: 'Default Login',
                status: 'warning',
                message: 'Default password incorrect',
                details: { email: testEmail, password: testPassword },
                autoFixAvailable: true,
            };
        }

        return {
            name: 'Default Login',
            status: 'healthy',
            message: 'Default credentials working',
            details: {
                email: testEmail,
                password: testPassword,
                role: user[0].role,
            },
        };
    } catch (error) {
        return {
            name: 'Default Login',
            status: 'error',
            message: `Login check failed: ${error}`,
            autoFixAvailable: false,
        };
    }
}

/**
 * Check LLM providers
 */
async function checkLLMProviders(): Promise<HealthCheck> {
    try {
        const db = await getDatabaseAsync();

        // Check if table exists
        const tableCheck = await db.query(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='llm_providers'`,
            []
        );

        if (tableCheck.length === 0) {
            return {
                name: 'LLM Providers',
                status: 'warning',
                message: 'LLM providers table missing',
                autoFixAvailable: false,
            };
        }

        const providers = await db.query(
            'SELECT name, provider, is_active FROM llm_providers WHERE is_active = 1',
            []
        );

        if (providers.length === 0) {
            return {
                name: 'LLM Providers',
                status: 'warning',
                message: 'No active LLM providers configured',
                details: { activeCount: 0 },
                autoFixAvailable: false,
            };
        }

        return {
            name: 'LLM Providers',
            status: 'healthy',
            message: `${providers.length} active LLM provider(s)`,
            details: {
                activeCount: providers.length,
                providers: providers.map((p: any) => ({
                    name: p.name,
                    provider: p.provider,
                })),
            },
        };
    } catch (error) {
        return {
            name: 'LLM Providers',
            status: 'error',
            message: `LLM check failed: ${error}`,
            autoFixAvailable: false,
        };
    }
}

/**
 * Check environment variables
 */
async function checkEnvironment(): Promise<HealthCheck> {
    const critical = ['NODE_ENV', 'JWT_SECRET', 'DATABASE_URL'];
    const missing: string[] = [];
    const present: string[] = [];

    for (const key of critical) {
        if (process.env[key]) {
            present.push(key);
        } else {
            missing.push(key);
        }
    }

    if (missing.length === 0) {
        return {
            name: 'Environment Variables',
            status: 'healthy',
            message: 'All critical env vars set',
            details: { present },
        };
    } else {
        return {
            name: 'Environment Variables',
            status: 'warning',
            message: `Missing: ${missing.join(', ')}`,
            details: { missing, present },
            autoFixAvailable: false,
        };
    }
}

/**
 * Check connection pool
 */
async function checkConnectionPool(): Promise<HealthCheck> {
    try {
        const { getConnectionPool } = await import('../database/index.js');
        const pool = getConnectionPool();

        if (!pool) {
            return {
                name: 'Connection Pool',
                status: 'warning',
                message: 'Connection pool not initialized',
                autoFixAvailable: false,
            };
        }

        const stats = pool.getStats();
        const utilization = (stats.active / stats.total) * 100;

        let status: 'healthy' | 'warning' | 'error' = 'healthy';
        let message = `Pool: ${stats.active}/${stats.total} active (${utilization.toFixed(0)}%)`;

        if (utilization > 80) {
            status = 'warning';
            message = `High utilization: ${utilization.toFixed(0)}%`;
        }

        if (stats.waiting > 0) {
            status = 'warning';
            message = `${stats.waiting} requests waiting`;
        }

        return {
            name: 'Connection Pool',
            status,
            message,
            details: stats,
        };
    } catch (error) {
        return {
            name: 'Connection Pool',
            status: 'warning',
            message: 'Pool not available (using singleton)',
            autoFixAvailable: false,
        };
    }
}

/**
 * GET /api/system/health
 * Comprehensive system health check
 */
router.get('/health', async (req: Request, res: Response) => {
    try {
        const checks: HealthCheck[] = [];

        // Run all health checks
        checks.push(await checkDatabase());
        checks.push(await checkTables());
        checks.push(await checkUsers());
        checks.push(await checkDefaultLogin());
        checks.push(await checkLLMProviders());
        checks.push(await checkEnvironment());
        checks.push(await checkConnectionPool());

        // Determine overall status
        const hasError = checks.some(c => c.status === 'error');
        const hasWarning = checks.some(c => c.status === 'warning');

        let overall: 'healthy' | 'warning' | 'error';
        if (hasError) {
            overall = 'error';
        } else if (hasWarning) {
            overall = 'warning';
        } else {
            overall = 'healthy';
        }

        const response: SystemHealth = {
            overall,
            timestamp: new Date().toISOString(),
            checks,
            autoRepairsApplied: 0,
        };

        res.json(response);
    } catch (error) {
        logger.error('[System Health] Check failed:', error);
        res.status(500).json({
            overall: 'error',
            timestamp: new Date().toISOString(),
            checks: [
                {
                    name: 'System Health',
                    status: 'error',
                    message: `Health check failed: ${error}`,
                },
            ],
            autoRepairsApplied: 0,
        });
    }
});

/**
 * POST /api/system/repair
 * Auto-repair system issues
 */
router.post('/repair', async (req: Request, res: Response) => {
    try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        logger.info('[System Health] Running auto-repair...');

        // Run the database test script which auto-fixes issues
        const { stdout, stderr } = await execAsync('npm run db:test', {
            cwd: process.cwd(),
        });

        logger.info('[System Health] Auto-repair completed');

        // Re-run health checks
        const checks: HealthCheck[] = [];
        checks.push(await checkDatabase());
        checks.push(await checkTables());
        checks.push(await checkUsers());
        checks.push(await checkDefaultLogin());

        const hasError = checks.some(c => c.status === 'error');
        const hasWarning = checks.some(c => c.status === 'warning');

        let overall: 'healthy' | 'warning' | 'error';
        if (hasError) {
            overall = 'error';
        } else if (hasWarning) {
            overall = 'warning';
        } else {
            overall = 'healthy';
        }

        res.json({
            overall,
            timestamp: new Date().toISOString(),
            checks,
            autoRepairsApplied: 1,
            repairOutput: stdout,
        });
    } catch (error) {
        logger.error('[System Health] Auto-repair failed:', error);
        res.status(500).json({
            overall: 'error',
            timestamp: new Date().toISOString(),
            error: `Auto-repair failed: ${error}`,
        });
    }
});

export default router;
