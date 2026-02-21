/**
 * Integration Test Helper
 *
 * Centralized test infrastructure for L3 integration tests.
 * Provides:
 * - Singleton database initialization
 * - Express app without HTTP server binding
 * - Proper cleanup handling
 */

import { vi, beforeAll, afterAll, afterEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';

// Set test environment variables BEFORE any imports
vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.MOCK_DB = 'false';
  process.env.SKIP_STARTUP_VALIDATOR = 'true';
  process.env.DISABLE_SCHEDULER = 'true';
  process.env.DISABLE_CONNECTION_POOL = 'true';

  // Use worker-specific SQLite path for isolation
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-integration-worker-${workerId}.db`;
});

// State management
let isInitialized = false;
let testApp: Express | null = null;
let dbInstance: any = null;

/**
 * Initialize the test database (singleton)
 */
async function initializeTestDatabase(): Promise<void> {
  if (isInitialized) {
    return;
  }

  try {
    // Dynamic import to ensure env vars are set first
    const { initializeDatabase } =
      await import('../../../server/src/database/DatabaseInitializer.js');
    const { getDatabase } = await import('../../../server/src/database/Database.js');

    await initializeDatabase();
    dbInstance = getDatabase();

    // Wait for DB init promise if exists
    if (dbInstance && dbInstance.initPromise) {
      await dbInstance.initPromise;
    }

    isInitialized = true;
  } catch (error) {
    console.error('[IntegrationTestHelper] Database initialization failed:', error);
    throw error;
  }
}

/**
 * Create Express app for testing WITHOUT starting HTTP server
 */
async function createTestApp(): Promise<Express> {
  if (testApp) {
    return testApp;
  }

  // Create fresh Express instance
  const app = express();

  // Basic middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Import routes dynamically (avoiding the server startup)
  try {
    // Import Gateway routes module
    const { apiGateway } = await import('../../../server/src/Gateway.js');
    apiGateway.initializeRoutes(app);
  } catch (error) {
    console.warn('[IntegrationTestHelper] Could not load Gateway routes:', error);

    // Fallback: load individual route files
    try {
      const authRoutes = (await import('../../../server/src/routes/auth.routes.js')).default;
      const billingRoutes = (await import('../../../server/src/routes/billing/billing.routes.js'))
        .default;

      app.use('/api/auth', authRoutes);
      app.use('/api/billing', billingRoutes);
    } catch (routeError) {
      console.warn('[IntegrationTestHelper] Could not load fallback routes:', routeError);
    }
  }

  // Error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[IntegrationTestHelper] Error:', err.message);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
    });
  });

  testApp = app;
  return app;
}

/**
 * Setup integration test environment
 * Call this in beforeAll()
 */
export async function setupIntegrationTest(): Promise<void> {
  await initializeTestDatabase();
  await createTestApp();
}

/**
 * Get the test Express app
 * Use with supertest: request(getTestApp()).get('/api/...')
 */
export function getTestApp(): Express {
  if (!testApp) {
    throw new Error('Test app not initialized. Call setupIntegrationTest() in beforeAll() first.');
  }
  return testApp;
}

/**
 * Get the database instance
 */
export function getTestDatabase(): any {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call setupIntegrationTest() in beforeAll() first.');
  }
  return dbInstance;
}

/**
 * Cleanup integration test environment
 * Call this in afterAll()
 */
export async function cleanupIntegrationTest(): Promise<void> {
  // Close database connections if needed
  if (dbInstance && typeof dbInstance.close === 'function') {
    try {
      await dbInstance.close();
    } catch (error) {
      console.warn('[IntegrationTestHelper] Error closing database:', error);
    }
  }

  // Reset state for next test file
  testApp = null;
  dbInstance = null;
  isInitialized = false;
}

/**
 * Create a test user token for authenticated requests
 */
export function createTestToken(userId: string = 'test-user', role: string = 'ADMIN'): string {
  // This is a mock token - in real tests you'd generate a proper JWT
  return `test-token-${userId}-${role}`;
}

/**
 * Seed test data into the database
 */
export async function seedTestData(data: {
  organizations?: Array<{ id: string; name: string; status?: string }>;
  users?: Array<{ id: string; email: string; organization_id: string }>;
}): Promise<void> {
  const db = getTestDatabase();

  if (data.organizations) {
    for (const org of data.organizations) {
      await db.run(`INSERT OR IGNORE INTO organizations (id, name, status) VALUES (?, ?, ?)`, [
        org.id,
        org.name,
        org.status || 'active',
      ]);
    }
  }

  if (data.users) {
    for (const user of data.users) {
      await db.run(`INSERT OR IGNORE INTO users (id, email, organization_id) VALUES (?, ?, ?)`, [
        user.id,
        user.email,
        user.organization_id,
      ]);
    }
  }
}

/**
 * Clear test data from tables
 */
export async function clearTestData(tables: string[]): Promise<void> {
  const db = getTestDatabase();

  for (const table of tables) {
    try {
      await db.run(`DELETE FROM ${table}`);
    } catch (error) {
      // Table might not exist, that's OK
    }
  }
}

/**
 * Mock authentication middleware
 */
export function mockAuthMiddleware() {
  return vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
    verifyToken: (req: any, res: any, next: any) => {
      req.user = { id: 'test-user', organizationId: 'test-org', role: 'ADMIN' };
      req.org = { id: 'test-org', role: 'OWNER' };
      next();
    },
    requireSuperAdmin: (req: any, res: any, next: any) => next(),
    optionalAuth: (req: any, res: any, next: any) => next(),
    requireRole: () => (req: any, res: any, next: any) => next(),
    requirePermission: () => (req: any, res: any, next: any) => next(),
    requireOrganization: (req: any, res: any, next: any) => next(),
  }));
}

// Export all helpers
export default {
  setupIntegrationTest,
  getTestApp,
  getTestDatabase,
  cleanupIntegrationTest,
  createTestToken,
  seedTestData,
  clearTestData,
  mockAuthMiddleware,
};
