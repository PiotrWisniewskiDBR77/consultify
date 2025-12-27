/**
 * Dependency Injection Helper for Tests
 * 
 * Provides standardized mocks for common dependencies used across services.
 * Eliminates DB mocking issues by providing a consistent DI pattern.
 */

import { vi } from 'vitest';

/**
 * Create a mock database instance
 * @returns {Object} Mock DB with all SQLite3 methods
 */
export const createMockDb = () => {
    const mockDb = {
        get: vi.fn(),
        all: vi.fn(),
        run: vi.fn(),
        exec: vi.fn(),
        prepare: vi.fn().mockReturnValue({
            run: vi.fn(),
            get: vi.fn(),
            all: vi.fn(),
            finalize: vi.fn()
        }),
        serialize: vi.fn((cb) => {
            if (cb) cb();
        }),
        initPromise: Promise.resolve()
    };

    // Default implementations (can be overridden in tests)
    mockDb.get.mockImplementation((...args) => {
        const cb = args[args.length - 1];
        if (typeof cb === 'function') {
            cb(null, null);
        }
    });

    mockDb.all.mockImplementation((...args) => {
        const cb = args[args.length - 1];
        if (typeof cb === 'function') {
            cb(null, []);
        }
    });

    mockDb.run.mockImplementation((...args) => {
        const cb = args[args.length - 1];
        if (typeof cb === 'function') {
            cb.call({ changes: 1, lastID: 1 }, null);
        }
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

export default {
    createMockDb,
    createMockLLMApi,
    createMockUuid,
    createMockTokenBillingService,
    createMockAnalyticsService,
    createMockAccessPolicyService,
    createMockPermissionService,
    injectDependencies,
    createStandardDeps,
    resetDependencies
};






