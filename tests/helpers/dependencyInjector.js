/**
 * Dependency Injection Helper for Tests
 * 
 * Provides standardized mocks for common dependencies used across services.
 * Eliminates DB mocking issues by providing a consistent DI pattern.
 */

import { vi } from 'vitest';

/**
 * Create a mock database instance
 * Supports both callback-style (SQLite3) and Promise-style (Postgres-compatible) APIs
 * @returns {Object} Mock DB with all SQLite3 and Postgres methods
 */
export const createMockDb = () => {
    const mockDb = {
        // Callback-style (SQLite3)
        get: vi.fn(),
        all: vi.fn(),
        run: vi.fn(),
        exec: vi.fn(),
        prepare: vi.fn(),
        serialize: vi.fn((cb) => {
            if (cb) cb();
        }),
        
        // Promise-style (Postgres-compatible)
        query: vi.fn(),
        
        // Async wrappers
        runAsync: vi.fn(),
        getAsync: vi.fn(),
        allAsync: vi.fn(),
        execAsync: vi.fn(),
        
        // Common properties
        initPromise: Promise.resolve()
    };

    // Default implementations - callback-style (SQLite3)
    mockDb.get.mockImplementation(function(sql, params, callback) {
        // Handle both (sql, callback) and (sql, params, callback) signatures
        const cb = typeof params === 'function' ? params : callback;
        if (typeof cb === 'function') {
            process.nextTick(() => cb(null, null));
        }
        return mockDb;
    });

    mockDb.all.mockImplementation(function(sql, params, callback) {
        const cb = typeof params === 'function' ? params : callback;
        if (typeof cb === 'function') {
            process.nextTick(() => cb(null, []));
        }
        return mockDb;
    });

    mockDb.run.mockImplementation(function(sql, params, callback) {
        const cb = typeof params === 'function' ? params : callback;
        if (typeof cb === 'function') {
            process.nextTick(() => cb.call({ changes: 1, lastID: 1 }, null));
        }
        return mockDb;
    });

    mockDb.exec.mockImplementation(function(sql, callback) {
        if (typeof callback === 'function') {
            process.nextTick(() => callback(null));
        }
        return mockDb;
    });

    // Default implementations - Promise-style (Postgres-compatible)
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });
    mockDb.runAsync.mockResolvedValue({ lastID: 1, changes: 1 });
    mockDb.getAsync.mockResolvedValue(null);
    mockDb.allAsync.mockResolvedValue([]);
    mockDb.execAsync.mockResolvedValue(undefined);

    // Prepare mock - returns statement object
    mockDb.prepare.mockReturnValue({
        run: vi.fn().mockImplementation(function(params, callback) {
            const cb = typeof params === 'function' ? params : callback;
            if (typeof cb === 'function') {
                process.nextTick(() => cb.call({ changes: 1, lastID: 1 }, null));
            }
            return this;
        }),
        get: vi.fn().mockImplementation(function(params, callback) {
            const cb = typeof params === 'function' ? params : callback;
            if (typeof cb === 'function') {
                process.nextTick(() => cb(null, null));
            }
            return this;
        }),
        all: vi.fn().mockImplementation(function(params, callback) {
            const cb = typeof params === 'function' ? params : callback;
            if (typeof cb === 'function') {
                process.nextTick(() => cb(null, []));
            }
            return this;
        }),
        finalize: vi.fn().mockImplementation(function(callback) {
            if (typeof callback === 'function') {
                process.nextTick(() => callback(null));
            }
            return this;
        })
    });

    return mockDb;
};

/**
 * Create a mock LLM API client
 * @returns {Object} Mock LLM API with chat and stream methods
 */
export const createMockLLMApi = () => ({
    chat: vi.fn().mockResolvedValue({
        text: 'Mock AI Response',
        tokens: { input: 100, output: 50 },
        model: 'mock-model',
        cost: 0.001
    }),
    
    stream: vi.fn().mockImplementation(async function* () {
        const chunks = ['Mock', ' AI', ' Response'];
        for (const chunk of chunks) {
            yield chunk;
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }),
    
    reset: () => {
        createMockLLMApi().chat.mockClear();
        createMockLLMApi().stream.mockClear();
    }
});

/**
 * Create a mock UUID generator (deterministic for tests)
 * @param {string} prefix - Prefix for generated UUIDs
 * @returns {Function} UUID generator function
 */
export const createMockUuid = (prefix = 'uuid') => {
    let counter = 0;
    return () => `${prefix}-${++counter}`;
};

/**
 * Create a mock token billing service
 * @returns {Object} Mock TokenBillingService
 */
export const createMockTokenBillingService = () => ({
    hasSufficientBalance: vi.fn().mockResolvedValue(true),
    deductTokens: vi.fn().mockResolvedValue(true),
    getBalance: vi.fn().mockResolvedValue({ tokens: 1000, usd: 10.0 }),
    addTokens: vi.fn().mockResolvedValue({ success: true })
});

/**
 * Create a mock analytics service
 * @returns {Object} Mock AnalyticsService
 */
export const createMockAnalyticsService = () => ({
    logUsage: vi.fn().mockResolvedValue({ success: true }),
    logEvent: vi.fn().mockResolvedValue({ success: true }),
    getUsageStats: vi.fn().mockResolvedValue({})
});

/**
 * Create a mock access policy service
 * @returns {Object} Mock AccessPolicyService
 */
export const createMockAccessPolicyService = () => ({
    checkAccess: vi.fn().mockResolvedValue({ allowed: true }),
    getTrialStatus: vi.fn().mockResolvedValue({ isActive: true, remainingDays: 30 })
});

/**
 * Create a mock permission service
 * @returns {Object} Mock PermissionService
 */
export const createMockPermissionService = () => ({
    hasPermission: vi.fn().mockResolvedValue(true),
    getUserPermissions: vi.fn().mockResolvedValue([]),
    grantPermission: vi.fn().mockResolvedValue({ success: true }),
    revokePermission: vi.fn().mockResolvedValue({ success: true })
});

/**
 * Inject dependencies into a service
 * @param {Object} service - Service object with setDependencies method
 * @param {Object} deps - Dependencies to inject
 */
export const injectDependencies = (service, deps) => {
    if (service && typeof service.setDependencies === 'function') {
        service.setDependencies(deps);
    } else {
        console.warn(
            `[DependencyInjector] Service does not support setDependencies. ` +
            `Service: ${service?.constructor?.name || 'Unknown'}`
        );
    }
};

/**
 * Create standard dependency set for most services
 * @param {Object} overrides - Override specific dependencies
 * @returns {Object} Standard dependency set
 */
export const createStandardDeps = (overrides = {}) => {
    return {
        db: createMockDb(),
        uuidv4: createMockUuid(),
        TokenBillingService: createMockTokenBillingService(),
        AnalyticsService: createMockAnalyticsService(),
        AccessPolicyService: createMockAccessPolicyService(),
        PermissionService: createMockPermissionService(),
        ...overrides
    };
};

/**
 * Reset all mocks in a dependency set
 * @param {Object} deps - Dependency set to reset
 */
export const resetDependencies = (deps) => {
    Object.values(deps).forEach(dep => {
        if (dep && typeof dep === 'object') {
            // Reset vi.fn() mocks
            if (dep.mockClear) dep.mockClear();
            if (dep.mockReset) dep.mockReset();
            
            // Reset nested mocks (e.g., db.get, db.all)
            Object.values(dep).forEach(nested => {
                if (nested && typeof nested === 'object' && nested.mockClear) {
                    nested.mockClear();
                }
            });
        }
    });
};

/**
 * Create a mock AI context builder
 * @returns {Object} Mock AI Context Builder
 */
export const createMockAIContextBuilder = () => ({
    buildContext: vi.fn().mockResolvedValue({
        context: 'Mock AI Context',
        tokens: 100
    }),
    addDocument: vi.fn().mockResolvedValue({ success: true }),
    clearContext: vi.fn().mockResolvedValue({ success: true })
});

/**
 * Create a mock AI pipeline
 * @returns {Object} Mock AI Pipeline
 */
export const createMockAIPipeline = () => ({
    execute: vi.fn().mockResolvedValue({
        response: 'Mock AI Response',
        tokens: { input: 100, output: 50 },
        cost: 0.001
    }),
    stream: vi.fn().mockImplementation(async function* () {
        yield { text: 'Mock', tokens: 10 };
        yield { text: ' AI', tokens: 10 };
        yield { text: ' Response', tokens: 30 };
    })
});

/**
 * Create a mock Stripe service
 * @returns {Object} Mock Stripe Service
 */
export const createMockStripeService = () => ({
    createCustomer: vi.fn().mockResolvedValue({ id: 'cus_mock' }),
    createSubscription: vi.fn().mockResolvedValue({ id: 'sub_mock' }),
    createWebhookEvent: vi.fn().mockResolvedValue({ id: 'evt_mock' }),
    verifyWebhook: vi.fn().mockResolvedValue({ valid: true })
});

/**
 * Create a mock Redis client
 * @returns {Object} Mock Redis Client
 */
export const createMockRedis = () => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    expire: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    flushdb: vi.fn().mockResolvedValue('OK')
});

export const createMockPMOHealthService = () => ({
    getHealthSnapshot: vi.fn().mockResolvedValue({
        projectId: 'test-project',
        projectName: 'Test Project',
        phase: { id: 1, name: 'Planning' },
        overall: 'healthy',
        metrics: {
            tasks: { overdueCount: 0, dueSoonCount: 1, blockedCount: 0 },
            decisions: { pendingCount: 2, overdueCount: 0 },
            initiatives: { atRiskCount: 0, blockedCount: 0 }
        },
        recommendations: []
    })
});

export const createMockAISettingsService = () => ({
    getEffectiveSettings: vi.fn().mockResolvedValue({
        policyLevel: 'ASSISTED',
        proactivityMode: 'BALANCED',
        contextDepth: 'DETAILED',
        actionThreshold: 'MEDIUM'
    }),
    getSuperAdminSettings: vi.fn(),
    getOrgSettings: vi.fn(),
    getUserSettings: vi.fn()
});

/**
 * Create unified test setup helper
 * Standardizes mock setup across all tests
 * @param {Object} options - Setup options
 * @returns {Object} Standardized test setup
 */
export const createUnifiedTestSetup = (options = {}) => {
    const {
        useRealDb = false,
        useRealRedis = false,
        useRealLLM = false,
        customMocks = {}
    } = options;

    const setup = {
        db: useRealDb ? null : createMockDb(),
        redis: useRealRedis ? null : createMockRedis(),
        llmApi: useRealLLM ? null : createMockLLMApi(),
        aiContextBuilder: createMockAIContextBuilder(),
        aiPipeline: createMockAIPipeline(),
        stripe: createMockStripeService(),
        tokenBilling: createMockTokenBillingService(),
        analytics: createMockAnalyticsService(),
        accessPolicy: createMockAccessPolicyService(),
        permission: createMockPermissionService(),
        pmoHealthService: createMockPMOHealthService(),
        aiSettingsService: createMockAISettingsService(),
        uuid: createMockUuid(),
        ...customMocks
    };

    return {
        ...setup,
        /**
         * Reset all mocks in the setup
         */
        reset: () => {
            resetDependencies(setup);
        },
        /**
         * Cleanup all resources
         */
        cleanup: async () => {
            resetDependencies(setup);
            if (setup.db && typeof setup.db.close === 'function') {
                await Promise.resolve(setup.db.close());
            }
        }
    };
};

/**
 * Standard beforeEach setup for tests
 * Use this in every test file for consistent setup
 * @param {Object} options - Setup options
 * @returns {Object} Test setup object
 */
export const setupTest = (options = {}) => {
    const testSetup = createUnifiedTestSetup(options);
    
    // Auto-reset before each test
    if (typeof beforeEach !== 'undefined') {
        beforeEach(() => {
            testSetup.reset();
        });
    }

    return testSetup;
};

export default {
    createMockDb,
    createMockLLMApi,
    createMockUuid,
    createMockTokenBillingService,
    createMockAnalyticsService,
    createMockAccessPolicyService,
    createMockPermissionService,
    createMockAIContextBuilder,
    createMockAIPipeline,
    createMockStripeService,
    createMockRedis,
    createMockPMOHealthService,
    createMockAISettingsService,
    injectDependencies,
    createStandardDeps,
    resetDependencies,
    createUnifiedTestSetup,
    setupTest
};













