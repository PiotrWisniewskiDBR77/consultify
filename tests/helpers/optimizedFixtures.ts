/**
 * Optimized Test Fixtures
 * 
 * Provides optimized fixtures with caching and reuse to improve test performance.
 */

import { v4 as uuidv4 } from 'uuid';

// Cache for fixtures to reuse across tests
const fixtureCache = new Map<string, any>();

/**
 * Create a cached test fixture
 * Reuses fixtures when possible to improve performance
 */
export async function createCachedFixture<T>(
    key: string,
    factory: () => Promise<T>,
    options: {
        ttl?: number; // Time to live in milliseconds
        reuse?: boolean; // Whether to reuse cached fixture
    } = {}
): Promise<T> {
    const { ttl = 60000, reuse = true } = options;

    if (reuse && fixtureCache.has(key)) {
        const cached = fixtureCache.get(key);
        if (Date.now() - cached.timestamp < ttl) {
            return cached.data;
        }
        fixtureCache.delete(key);
    }

    const data = await factory();
    fixtureCache.set(key, {
        data,
        timestamp: Date.now(),
    });

    return data;
}

/**
 * Clear fixture cache
 */
export function clearFixtureCache(): void {
    fixtureCache.clear();
}

/**
 * Create optimized test fixture with all dependencies
 * Uses caching and batch operations for better performance
 */
export async function createOptimizedFixture(
    db: any,
    options: {
        orgId?: string;
        userId?: string;
        projectId?: string;
        createProject?: boolean;
        createTask?: boolean;
        createDecision?: boolean;
        createInitiative?: boolean;
        [key: string]: any;
    } = {}
): Promise<{
    orgId: string;
    userId: string;
    projectId: string | null;
    taskId: string | null;
    decisionId: string | null;
    initiativeId: string | null;
}> {
    const orgId = options.orgId || uuidv4();
    const userId = options.userId || uuidv4();
    const projectId = options.projectId || (options.createProject !== false ? uuidv4() : null);

    // Batch database operations for better performance
    const operations: Array<() => Promise<void>> = [];

    // Create organization
    operations.push(async () => {
        await dbRun(db, 
            'INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
            [orgId, options.orgName || 'Test Org', options.plan || 'free', options.status || 'active']
        );
    });

    // Create user
    operations.push(async () => {
        await dbRun(db,
            'INSERT OR IGNORE INTO users (id, organization_id, email, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)',
            [
                userId,
                orgId,
                options.email || `test-${Date.now()}@test.com`,
                options.firstName || 'Test',
                options.lastName || 'User',
                options.role || 'USER'
            ]
        );
    });

    // Create project if requested
    if (projectId && options.createProject !== false) {
        operations.push(async () => {
            await dbRun(db,
                'INSERT OR IGNORE INTO projects (id, organization_id, name, status) VALUES (?, ?, ?, ?)',
                [projectId, orgId, options.projectName || 'Test Project', 'active']
            );
        });
    }

    // Execute all operations in parallel for better performance
    await Promise.all(operations.map(op => op()));

    // Create dependent entities sequentially (they depend on parent entities)
    let taskId: string | null = null;
    if (options.createTask && projectId) {
        taskId = options.taskId || uuidv4();
        await dbRun(db,
            'INSERT OR IGNORE INTO tasks (id, project_id, organization_id, name, status, assigned_to) VALUES (?, ?, ?, ?, ?, ?)',
            [taskId, projectId, orgId, options.taskName || 'Test Task', 'TODO', userId]
        );
    }

    let decisionId: string | null = null;
    if (options.createDecision && projectId) {
        decisionId = options.decisionId || uuidv4();
        await dbRun(db,
            'INSERT OR IGNORE INTO decisions (id, project_id, organization_id, title, status, decision_owner_id) VALUES (?, ?, ?, ?, ?, ?)',
            [decisionId, projectId, orgId, options.decisionTitle || 'Test Decision', 'PENDING', userId]
        );
    }

    let initiativeId: string | null = null;
    if (options.createInitiative && projectId) {
        initiativeId = options.initiativeId || uuidv4();
        await dbRun(db,
            'INSERT OR IGNORE INTO initiatives (id, project_id, organization_id, name, status) VALUES (?, ?, ?, ?, ?)',
            [initiativeId, projectId, orgId, options.initiativeName || 'Test Initiative', 'PLANNING']
        );
    }

    return {
        orgId,
        userId,
        projectId,
        taskId,
        decisionId,
        initiativeId
    };
}

/**
 * Helper to run database operations
 */
function dbRun(db: any, sql: string, params: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err: Error | null) {
            if (err && !err.message.includes('UNIQUE constraint')) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

/**
 * Batch cleanup fixtures
 * More efficient than cleaning one by one
 */
export async function cleanupFixturesBatch(
    db: any,
    fixtures: Array<{
        orgId?: string;
        userId?: string;
        projectId?: string;
        taskId?: string;
        decisionId?: string;
        initiativeId?: string;
    }>
): Promise<void> {
    // Collect all IDs to delete
    const taskIds: string[] = [];
    const decisionIds: string[] = [];
    const initiativeIds: string[] = [];
    const projectIds: string[] = [];
    const userIds: string[] = [];
    const orgIds: string[] = [];

    fixtures.forEach(fixture => {
        if (fixture.taskId) taskIds.push(fixture.taskId);
        if (fixture.decisionId) decisionIds.push(fixture.decisionId);
        if (fixture.initiativeId) initiativeIds.push(fixture.initiativeId);
        if (fixture.projectId) projectIds.push(fixture.projectId);
        if (fixture.userId) userIds.push(fixture.userId);
        if (fixture.orgId) orgIds.push(fixture.orgId);
    });

    // Disable foreign keys for faster cleanup
    await dbRun(db, 'PRAGMA foreign_keys = OFF', []);

    try {
        // Batch delete operations
        const deleteOps: Array<() => Promise<void>> = [];

        if (taskIds.length > 0) {
            deleteOps.push(() => dbRun(db, `DELETE FROM tasks WHERE id IN (${taskIds.map(() => '?').join(',')})`, taskIds));
        }
        if (decisionIds.length > 0) {
            deleteOps.push(() => dbRun(db, `DELETE FROM decisions WHERE id IN (${decisionIds.map(() => '?').join(',')})`, decisionIds));
        }
        if (initiativeIds.length > 0) {
            deleteOps.push(() => dbRun(db, `DELETE FROM initiatives WHERE id IN (${initiativeIds.map(() => '?').join(',')})`, initiativeIds));
        }
        if (projectIds.length > 0) {
            deleteOps.push(() => dbRun(db, `DELETE FROM projects WHERE id IN (${projectIds.map(() => '?').join(',')})`, projectIds));
        }
        if (userIds.length > 0) {
            deleteOps.push(() => dbRun(db, `DELETE FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`, userIds));
        }
        if (orgIds.length > 0) {
            deleteOps.push(() => dbRun(db, `DELETE FROM organizations WHERE id IN (${orgIds.map(() => '?').join(',')})`, orgIds));
        }

        // Execute all deletions in parallel
        await Promise.all(deleteOps.map(op => op()));
    } finally {
        await dbRun(db, 'PRAGMA foreign_keys = ON', []);
    }
}

