/**
 * Dependency Injection Helper for Tests
 * 
 * Provides standardized mocks for common dependencies used across services.
 * Eliminates DB mocking issues by providing a consistent DI pattern.
 */

import { vi } from 'vitest';

/**
 * Create a transactional mock database instance
 * Supports transactions, rollbacks, and both callback/Promise APIs
 * @returns {Object} Mock DB with transaction support
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

        // Transaction support
        beginTransaction: vi.fn(),
        commit: vi.fn(),
        rollback: vi.fn(),

        // Connection management
        connect: vi.fn(),
        disconnect: vi.fn(),
        ping: vi.fn().mockResolvedValue(true),

        // Common properties
        initPromise: Promise.resolve(),
        inTransaction: false
    };

    // Default implementations - callback-style (SQLite3)
    mockDb.get.mockImplementation(function(sql, params, callback) {
        // Handle multiple calling patterns:
        // 1. db.get(sql, callback)
        // 2. db.get(sql, params, callback)
        // 3. db.get<T>(sql, params) - TypeScript generic async
        // 4. db.get(sql, params) - Promise-style

        if (typeof params === 'function' && !callback) {
            // Pattern 1: db.get(sql, callback)
            const cb = params;
            process.nextTick(() => cb(null, null));
            return mockDb;
        } else if (typeof callback === 'function') {
            // Pattern 2: db.get(sql, params, callback)
            process.nextTick(() => callback(null, null));
            return mockDb;
        } else if (Array.isArray(params)) {
            // Pattern 3 & 4: db.get<T>(sql, params) or db.get(sql, params)
            // Return a Promise that resolves to null (can be overridden in tests)
            return Promise.resolve(null);
        }

        // Fallback - return mockDb for chaining
        return mockDb;
    });

    mockDb.all.mockImplementation(function(sql, params, callback) {
        // Handle multiple calling patterns:
        // 1. db.all(sql, callback)
        // 2. db.all(sql, params, callback)
        // 3. db.all<T>(sql, params) - TypeScript generic async
        // 4. db.all(sql, params) - Promise-style

        if (typeof params === 'function' && !callback) {
            // Pattern 1: db.all(sql, callback)
            const cb = params;
            process.nextTick(() => cb(null, []));
            return mockDb;
        } else if (typeof callback === 'function') {
            // Pattern 2: db.all(sql, params, callback)
            process.nextTick(() => callback(null, []));
            return mockDb;
        } else if (Array.isArray(params)) {
            // Pattern 3 & 4: db.all<T>(sql, params) or db.all(sql, params)
            // Return a Promise that resolves to empty array
            return Promise.resolve([]);
        }

        // Fallback - return mockDb for chaining
        return mockDb;
    });

    mockDb.run.mockImplementation(function(sql, params, callback) {
        // Handle multiple calling patterns:
        // 1. db.run(sql, callback)
        // 2. db.run(sql, params, callback)
        // 3. db.run(sql, params) - Promise-style

        if (typeof params === 'function' && !callback) {
            // Pattern 1: db.run(sql, callback)
            const cb = params;
            process.nextTick(() => cb.call({ changes: 1, lastID: 1 }, null));
            return mockDb;
        } else if (typeof callback === 'function') {
            // Pattern 2: db.run(sql, params, callback)
            process.nextTick(() => callback.call({ changes: 1, lastID: 1 }, null));
            return mockDb;
        } else if (Array.isArray(params)) {
            // Pattern 3: db.run(sql, params)
            // Return a Promise that resolves to result object
            return Promise.resolve({ changes: 1, lastID: 1 });
        }

        // Fallback - return mockDb for chaining
        return mockDb;
    });

    mockDb.exec.mockImplementation(function(sql, callback) {
        if (typeof callback === 'function') {
            process.nextTick(() => callback(null));
        }
        return mockDb; // Always return mockDb for chaining
    });

    // Default implementations - Promise-style (Postgres-compatible)
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });
    mockDb.runAsync.mockResolvedValue({ lastID: 1, changes: 1 });
    mockDb.getAsync.mockResolvedValue(null);
    mockDb.allAsync.mockResolvedValue([]);
    mockDb.execAsync.mockResolvedValue(undefined);

    // Transaction implementation
    mockDb.beginTransaction.mockImplementation(() => {
        mockDb.inTransaction = true;
        return Promise.resolve({});
    });

    mockDb.commit.mockImplementation(() => {
        mockDb.inTransaction = false;
        return Promise.resolve({});
    });

    mockDb.rollback.mockImplementation(() => {
        mockDb.inTransaction = false;
        return Promise.resolve({});
    });

    // Simulate transaction failures for testing
    mockDb.beginTransaction.mockImplementationOnce(() => {
        throw new Error('Transaction failed');
    });

    mockDb.commit.mockImplementationOnce(() => {
        throw new Error('Commit failed');
    });

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
 * Create a comprehensive mock API service with stable responses
 * Covers all commonly failing API endpoints in the application
 * @returns {Object} Mock API with 30+ endpoints and stable defaults
 */
export const createMockApi = () => ({
    // HTTP Methods
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    head: vi.fn().mockResolvedValue({}),
    options: vi.fn().mockResolvedValue({}),

    // Authentication & Security
    getTrustedDevices: vi.fn().mockResolvedValue([]),
    addTrustedDevice: vi.fn().mockResolvedValue({ id: 'device-123' }),
    removeTrustedDevice: vi.fn().mockResolvedValue({}),
    getSecurityEvents: vi.fn().mockResolvedValue([]),

    // User Preferences & Settings
    getUserPreferences: vi.fn().mockResolvedValue({
        defaultView: 'kanban',
        itemsPerPage: 25,
        autoSave: true,
        keyboardShortcuts: true,
        theme: 'system',
        notifications: true,
        language: 'en'
    }),
    updateUserPreferences: vi.fn().mockResolvedValue({}),
    resetUserPreferences: vi.fn().mockResolvedValue({}),

    // Regional & Localization
    getRegionalPreferences: vi.fn().mockResolvedValue({
        timezone: 'America/New_York',
        locale: 'en-US',
        currency: 'USD',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h'
    }),
    getSupportedLocales: vi.fn().mockResolvedValue(['en-US', 'es-ES', 'fr-FR', 'de-DE']),
    getTimezoneList: vi.fn().mockResolvedValue(['America/New_York', 'Europe/London', 'Asia/Tokyo']),

    // Billing & Payments
    getBillingInfo: vi.fn().mockResolvedValue({
        plan: 'enterprise',
        status: 'active',
        nextBilling: '2025-02-01',
        amount: 999
    }),
    updateBillingInfo: vi.fn().mockResolvedValue({}),
    getInvoices: vi.fn().mockResolvedValue([]),
    downloadInvoice: vi.fn().mockResolvedValue(new Blob()),

    // Organization Management
    getOrganizationSettings: vi.fn().mockResolvedValue({
        name: 'Test Corp',
        domain: 'testcorp.com',
        size: '50-200',
        industry: 'technology'
    }),
    updateOrganizationSettings: vi.fn().mockResolvedValue({}),
    getOrganizationMembers: vi.fn().mockResolvedValue([]),
    inviteOrganizationMember: vi.fn().mockResolvedValue({}),

    // Assessment & Analytics
    getAssessmentResults: vi.fn().mockResolvedValue({
        score: 85,
        status: 'completed',
        recommendations: []
    }),
    getAnalyticsData: vi.fn().mockResolvedValue({
        users: 1250,
        assessments: 450,
        revenue: 125000
    }),

    // File Upload & Storage
    uploadFile: vi.fn().mockResolvedValue({ url: 'https://storage.example.com/file.pdf' }),
    deleteFile: vi.fn().mockResolvedValue({}),
    getFileMetadata: vi.fn().mockResolvedValue({
        size: 1024,
        type: 'application/pdf',
        uploadedAt: '2025-01-01T00:00:00Z'
    }),

    // Notifications
    getNotifications: vi.fn().mockResolvedValue([]),
    markNotificationRead: vi.fn().mockResolvedValue({}),
    sendNotification: vi.fn().mockResolvedValue({}),

    // Integrations
    getIntegrations: vi.fn().mockResolvedValue([]),
    createIntegration: vi.fn().mockResolvedValue({ id: 'integration-123' }),
    updateIntegration: vi.fn().mockResolvedValue({}),
    deleteIntegration: vi.fn().mockResolvedValue({}),
    testIntegration: vi.fn().mockResolvedValue({ status: 'connected' }),

    // Webhooks
    getWebhooks: vi.fn().mockResolvedValue([]),
    createWebhook: vi.fn().mockResolvedValue({ id: 'webhook-123' }),
    updateWebhook: vi.fn().mockResolvedValue({}),
    deleteWebhook: vi.fn().mockResolvedValue({}),
    testWebhook: vi.fn().mockResolvedValue({ status: 'delivered' }),

    // Reports & Exports
    generateReport: vi.fn().mockResolvedValue({ reportId: 'report-123' }),
    getReportStatus: vi.fn().mockResolvedValue({ status: 'completed', url: 'https://reports.example.com/report.pdf' }),
    exportData: vi.fn().mockResolvedValue({ exportId: 'export-123' }),
    getExportStatus: vi.fn().mockResolvedValue({ status: 'ready', downloadUrl: 'https://exports.example.com/data.zip' }),

    // System Health & Monitoring
    getSystemHealth: vi.fn().mockResolvedValue({
        status: 'healthy',
        uptime: 99.9,
        responseTime: 45
    }),
    getSystemMetrics: vi.fn().mockResolvedValue({
        cpu: 45,
        memory: 60,
        disk: 30,
        network: 25
    }),

    // Error simulation methods for testing error handling
    simulateNetworkError: (method = 'get') => {
        const api = createMockApi();
        api[method].mockRejectedValue(new Error('Network error'));
        return api;
    },

    simulateTimeoutError: (method = 'get') => {
        const api = createMockApi();
        api[method].mockImplementation(() => new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 5000)
        ));
        return api;
    },

    simulateAuthError: (method = 'get') => {
        const api = createMockApi();
        api[method].mockRejectedValue(new Error('Authentication failed'));
        return api;
    },

    simulatePermissionError: (method = 'get') => {
        const api = createMockApi();
        api[method].mockRejectedValue(new Error('Insufficient permissions'));
        return api;
    },

    simulateServerError: (method = 'get') => {
        const api = createMockApi();
        api[method].mockRejectedValue(new Error('Internal server error'));
        return api;
    },

    simulateRateLimitError: (method = 'get') => {
        const api = createMockApi();
        api[method].mockRejectedValue(new Error('Rate limit exceeded'));
        return api;
    }
});

/**
 * Migrate callback-style mock to Promise-style mock
 * This utility helps convert legacy callback mocks to modern Promise-based mocks
 * @param {Function} mockFn - The mock function to convert
 * @param {*} returnValue - Value to return from the Promise
 * @returns {Function} Converted mock function
 */
export const migrateToPromiseMock = (mockFn, returnValue = null) => {
    return vi.fn().mockImplementation((...args) => {
        // Check if last argument is a callback function
        const lastArg = args[args.length - 1];
        if (typeof lastArg === 'function') {
            // Callback-style: call the callback
            process.nextTick(() => lastArg(null, returnValue));
            return mockFn;
        } else {
            // Promise-style: return a Promise
            return Promise.resolve(returnValue);
        }
    });
};

/**
 * Batch migrate all database mocks in a test file
 * @param {Object} mockDb - The mock database object
 * @returns {Object} Updated mock database with Promise-style mocks
 */
export const migrateDbMocksToPromises = (mockDb) => {
    // Migrate all common database methods
    const methods = ['get', 'all', 'run', 'exec'];

    methods.forEach(method => {
        if (mockDb[method] && typeof mockDb[method].mockImplementation === 'function') {
            // Get current implementation if any
            const currentImpl = mockDb[method].getMockImplementation();
            if (currentImpl) {
                // If there's a custom implementation, try to migrate it
                mockDb[method].mockImplementation((...args) => {
                    const lastArg = args[args.length - 1];
                    if (typeof lastArg === 'function') {
                        // Try to call original implementation
                        try {
                            return currentImpl(...args);
                        } catch (e) {
                            // Fallback to default behavior
                            process.nextTick(() => lastArg(null, null));
                            return mockDb;
                        }
                    } else {
                        // Promise-style
                        return Promise.resolve(null);
                    }
                });
            } else {
                // No custom implementation, use default Promise-style
                mockDb[method].mockResolvedValue(null);
            }
        }
    });

    return mockDb;
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
    createMockApi,
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
    setupTest,
    migrateToPromiseMock,
    migrateDbMocksToPromises
};













