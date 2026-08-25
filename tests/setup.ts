import '@testing-library/jest-dom';
import { beforeAll, vi, beforeEach } from 'vitest';
import { mockLLMApi } from './__mocks__/llmApi.js';
import { setupAutoCleanup } from './helpers/testCleanup';

// Setup automatic cleanup for all tests
setupAutoCleanup();

// --------------------------------------------------------
// Billing/Stripe safety defaults for tests
// --------------------------------------------------------
// Some server-side config paths require Stripe secrets in production-like modes.
// Ensure tests never fail due to missing Stripe env vars.
process.env.MOCK_BILLING = process.env.MOCK_BILLING || 'true';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_dummy';

// Provide jest compatibility for legacy tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).jest = vi;

// --------------------------------------------------------
// JSDOM navigation stubs
// --------------------------------------------------------
// Some components trigger window.location navigation (assign/replace/reload),
// which JSDOM implements as "Not implemented: navigation to another Document".
// Stub these to no-op so tests stay signal-rich and deterministic.
if (typeof window !== 'undefined') {
  try {
    const noop = () => {};
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        assign: vi.fn(noop),
        replace: vi.fn(noop),
        reload: vi.fn(noop),
      },
      writable: true,
    });
  } catch {
    // If JSDOM makes window.location non-configurable in a given environment, skip.
  }
}

// Global mock for react-i18next to prevent "Cannot read properties of undefined (reading 'en')" errors
vi.mock('react-i18next', () => {
  // NOTE:
  // Component tests were hitting OOM with stacks involving `Builtins_ProxyGetProperty`.
  // The previous mock created/cached many Proxies (potentially unbounded across a large suite).
  // For tests we only need:
  // - `t()` to return a stable value
  // - `t(..., { returnObjects: true })` to return something that supports `.en` access
  //   and deep property/indexing without allocating new objects indefinitely.
  //
  // This singleton proxy returns itself for any nested property/index access, and returns
  // a deterministic string for language access. It is intentionally *key-agnostic* to
  // keep memory usage bounded across the entire test run.
  const LANGS = new Set(['en', 'pl', 'de', 'fr', 'es', 'it', 'ja', 'zh']);
  const RETURN_OBJECTS_LEAF = '__i18n__';

  const returnObjectsProxy: any = new Proxy(Object.create(null), {
    get(_target, prop: any) {
      if (typeof prop === 'symbol') {
        if (prop === Symbol.toPrimitive) return () => RETURN_OBJECTS_LEAF;
        return undefined;
      }

      if (prop === 'toString' || prop === 'valueOf') return () => RETURN_OBJECTS_LEAF;
      if (LANGS.has(String(prop))) return RETURN_OBJECTS_LEAF;

      // Allow deep chaining/indexing without allocating new proxies/objects.
      return returnObjectsProxy;
    },
    ownKeys() {
      return Array.from(LANGS);
    },
    has() {
      return true;
    },
    getOwnPropertyDescriptor() {
      return { enumerable: true, configurable: true };
    },
  });

  // Match react-i18next's stable `t` identity. Recreating this function for
  // every mocked hook call causes artificial callback/effect loops in tests.
  const translate = (key: string, options?: any) => {
    if (typeof options === 'string') return options;
    if (options?.returnObjects) return returnObjectsProxy;
    if (options && typeof options === 'object') {
      let result = options.defaultValue || key;
      Object.keys(options).forEach((optKey) => {
        if (optKey !== 'defaultValue' && optKey !== 'returnObjects') {
          result = String(result).replace(
            new RegExp(`\\{${optKey}\\}`, 'g'),
            String(options[optKey])
          );
        }
      });
      return result;
    }
    return key;
  };

  return {
    useTranslation: () => ({
      t: translate,
      i18n: {
        language: 'en',
        changeLanguage: vi.fn(),
        getResourceBundle: vi.fn(() => ({})),
        hasResourceBundle: vi.fn(() => false),
        addResourceBundle: vi.fn(),
      },
      ready: true,
    }),
    Trans: ({ children, i18nKey }: any) => children || i18nKey,
    I18nextProvider: ({ children }: any) => children,
    initReactI18next: {
      type: '3rdParty',
      init: vi.fn(),
    },
    Translation: ({ children }: any) => children({ t: (k: string) => k, i18n: {} }),
  };
});

// --------------------------------------------------------
// Global Mock for react-hot-toast
// --------------------------------------------------------
const mockToast = Object.assign(
  vi.fn((message: any) => 'toast-id'),
  {
    success: vi.fn(() => 'toast-id'),
    error: vi.fn(() => 'toast-id'),
    loading: vi.fn(() => 'toast-id'),
    dismiss: vi.fn(),
    remove: vi.fn(),
    custom: vi.fn(() => 'toast-id'),
    promise: vi.fn((promise: any) => promise),
  }
);

vi.mock('react-hot-toast', () => ({
  default: mockToast,
  toast: mockToast,
  Toaster: () => null,
  useToasterStore: vi.fn(() => ({ toasts: [] })),
}));

// --------------------------------------------------------
// Global Mock for react-router-dom (useNavigate safety)
// --------------------------------------------------------
// Many component tests render a router-aware component directly (no <Router>
// wrapper). When such a component calls useNavigate(), react-router throws
// "useNavigate() may be used only in the context of a <Router> component".
// Provide a no-op useNavigate fallback while keeping every real export
// (MemoryRouter, Routes, Route, Link, useLocation, useParams, …) intact so
// tests that DO wrap in a router still behave normally. A test that needs to
// assert navigation can override this with its own per-file vi.mock.
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// --------------------------------------------------------
// Global Mock for AIContext
// --------------------------------------------------------
const mockAIContext = {
  isChatOpen: false,
  toggleChat: vi.fn(),
  openChat: vi.fn(),
  screenContext: null,
  setScreenContext: vi.fn(),
  globalContext: {},
  pmoContext: {
    organizationId: null,
    projectId: null,
    currentPhase: 'planning',
    currentScreen: 'dashboard',
    userRole: 'user',
    selectedObject: { type: null, id: null },
    aiRole: 'ADVISOR' as const,
  },
  triggerProjectSummary: vi.fn(),
  autoSummaryEnabled: false,
  setAutoSummaryEnabled: vi.fn(),
  assessmentContext: {
    isInAssessmentMode: false,
    currentAxis: null,
    currentScore: null,
    targetScore: null,
    justification: null,
    completedAxes: [],
    assessmentProgress: 0,
  },
  updateAssessmentContext: vi.fn(),
  clearAssessmentContext: vi.fn(),
  requestAssessmentGuidance: vi.fn(),
  requestGapAnalysis: vi.fn(),
  workspaceContext: null,
  chatDisplayMode: 'floating' as const,
  isInSplitMode: false,
};

vi.mock('@/contexts/AIContext', () => ({
  AIContext: {
    Provider: ({ children }: any) => children,
    Consumer: ({ children }: any) => children(mockAIContext),
  },
  AIProvider: ({ children }: any) => children,
  useAIContext: () => mockAIContext,
}));

// --------------------------------------------------------
// Global Mock for FeatureFlagsContext
// --------------------------------------------------------
const mockFeatureFlags = {
  flags: {},
  flagDefinitions: [],
  isLoading: false,
  isEnabled: vi.fn((_id: string) => false),
  setFlag: vi.fn(),
  clearAllOverrides: vi.fn(),
  refresh: vi.fn(),
};

vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => mockFeatureFlags,
  FeatureFlagsProvider: ({ children }: any) => children,
  Feature: ({ children, fallback }: any) => fallback ?? children ?? null,
  default: ({ children }: any) => children,
}));

// --------------------------------------------------------
// Global Database Mock (SQLite-compatible)
// --------------------------------------------------------
// We define this on global so server/database.js picks it up.
// Note: vi.hoisted() should be used in test files, not in setup.ts
// Using regular vi.fn() here for global mock
const mockDb: any = {
  run: vi.fn(),
  get: vi.fn(),
  all: vi.fn(),
  exec: vi.fn(),
  serialize: vi.fn(),
  on: vi.fn().mockReturnThis(),
  close: vi.fn(),
  // Async wrappers often used by services
  getAsync: vi.fn().mockResolvedValue(null),
  runAsync: vi.fn().mockResolvedValue({ lastID: 0, changes: 0 }),
  allAsync: vi.fn().mockResolvedValue([]),
  execAsync: vi.fn().mockResolvedValue(undefined),
  // Polyfill for Postgres compatibility (Promise-based)
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  // Prepared statement support
  prepare: vi.fn().mockReturnValue({
    run: vi.fn().mockReturnThis(),
    get: vi.fn((cb?: any) => {
      if (typeof cb === 'function') {
        process.nextTick(() => cb(null, null));
      }
    }),
    all: vi.fn((cb?: any) => {
      if (typeof cb === 'function') {
        process.nextTick(() => cb(null, []));
      }
    }),
    finalize: vi.fn((cb?: any) => {
      if (typeof cb === 'function') {
        process.nextTick(() => cb(null));
      }
    }),
  }),
  // Transaction support
  beginTransaction: vi.fn((cb?: any) => {
    if (typeof cb === 'function') {
      process.nextTick(() => cb(null));
    }
  }),
  commit: vi.fn((cb?: any) => {
    if (typeof cb === 'function') {
      process.nextTick(() => cb(null));
    }
  }),
  rollback: vi.fn((cb?: any) => {
    if (typeof cb === 'function') {
      process.nextTick(() => cb(null));
    }
  }),
};

// Improved callback handling using process.nextTick for async simulation
// Set implementations after hoisting to avoid issues with 'this' context
mockDb.run.mockImplementation(function (this: any, sql: string, params?: any, cb?: any) {
  const callback = typeof params === 'function' ? params : cb;
  if (typeof callback === 'function') {
    process.nextTick(() => {
      try {
        callback.call({ lastID: 1, changes: 1 }, null);
      } catch (e) {
        // Silently handle callback errors to prevent test crashes
      }
    });
  }
  return this;
});

mockDb.get.mockImplementation(function (this: any, sql: string, params?: any, cb?: any) {
  const callback = typeof params === 'function' ? params : cb;
  if (typeof callback === 'function') {
    process.nextTick(() => {
      try {
        callback(null, null); // Default: no row found
      } catch (e) {
        // Silently handle callback errors
      }
    });
  }
  return this;
});

mockDb.all.mockImplementation(function (this: any, sql: string, params?: any, cb?: any) {
  const callback = typeof params === 'function' ? params : cb;
  if (typeof callback === 'function') {
    process.nextTick(() => {
      try {
        callback(null, []); // Default: empty array
      } catch (e) {
        // Silently handle callback errors
      }
    });
  }
  return this;
});

mockDb.exec.mockImplementation(function (this: any, sql: string, cb?: any) {
  if (typeof cb === 'function') {
    process.nextTick(() => {
      try {
        cb(null);
      } catch (e) {
        // Silently handle callback errors
      }
    });
  }
  return this;
});

mockDb.serialize.mockImplementation(function (this: any, cb?: any) {
  if (typeof cb === 'function') {
    process.nextTick(() => {
      try {
        cb();
      } catch (e) {
        // Silently handle callback errors
      }
    });
  }
  return this;
});

mockDb.close.mockImplementation(function (cb?: any) {
  if (typeof cb === 'function') {
    process.nextTick(() => {
      try {
        cb(null);
      } catch (e) {
        // Silently handle callback errors
      }
    });
  }
});

// Ensure consistent test-mode behavior across backend + frontend tests
if (typeof process !== 'undefined' && process.env) {
  process.env.NODE_ENV = 'test';
  process.env.DB_TYPE = process.env.DB_TYPE || 'postgres';
  process.env.MOCK_REDIS = process.env.MOCK_REDIS || 'true';
  process.env.MOCK_DB = process.env.MOCK_DB || 'true';
  process.env.POSTGRES_SKIP_INIT_IN_TEST = process.env.POSTGRES_SKIP_INIT_IN_TEST || 'true';
  // PostgreSQL required. Unit tests use MOCK_DB (no real connection).
  // Integration tests default to the same local DB credentials as CI.
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://iris:iris_test@localhost:5432/iris_test';
  }
  // Stub API keys to prevent real calls if mocking is accidentally bypassed
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.OPENAI_API_KEY = 'sk-test-openai-key';
  // Ensure consistent JWT secret (must be >= 32 chars for Config.ts validation)
  process.env.JWT_SECRET = 'test-jwt-secret-key-min-32-chars-long-for-validation';

  // Assign to global for server/database.js to use
  (global as any).__TEST_DB_MOCK__ = mockDb;

  // Export helper function for tests that need custom mocks
  // Note: Tests should import createMockDb directly from './helpers/mockDb.js'
  // This is kept for backward compatibility
  (global as any).createMockDb = async () => {
    // Dynamic import from mockDb helper
    const mockDbModule = await import('./helpers/mockDb.js');
    return mockDbModule.createMockDb();
  };

  // Remove require usage - use dynamic imports instead
  // const someModule = await import('./path/to/module.js');
}

// Removed global jsonwebtoken mock to allow real JWT usage in integration tests

// Mock Sentry to prevent native binding issues

// Mock legacy/broken route modules globally to prevent import crashes in Gateway.ts
const mockRouter = (req: any, res: any, next: any) => next();
// vi.mock('../server/src/routes/ai.routes.js', () => ({ default: mockRouter }));
vi.mock('../server/services/backupService.js', () => ({
  default: { backupDatabase: vi.fn(), restoreDatabase: vi.fn() },
}));

// Global Service Mocks (Prevent heavy initialization/external connections)
vi.mock('../server/services/smsService.js', () => ({
  default: {
    sendSMS: vi.fn().mockResolvedValue({ success: true, messageSid: 'MOCK_SMS_SID' }),
    sendOTP: vi.fn().mockResolvedValue({ success: true }),
    verifyOTP: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../server/services/emailService.js', () => ({
  default: {
    send: vi.fn().mockResolvedValue(true),
    sendEmail: vi.fn().mockResolvedValue(true),
  },
  // Named exports used by some unit tests
  send: vi.fn().mockResolvedValue(true),
  sendEmail: vi.fn().mockResolvedValue(true),
  setDependencies: vi.fn(),
}));

vi.mock('../server/services/notificationService.js', () => ({
  default: {
    sendNotification: vi.fn().mockResolvedValue(true),
    createNotification: vi.fn().mockResolvedValue(true),
    create: vi.fn().mockResolvedValue({ id: 'mock-notif-id' }), // Fix for AlertWatchdog
  },
}));

vi.mock('../server/src/services/ActivityService.js', () => {
  const mockService = {
    log: vi.fn().mockResolvedValue(undefined),
    getRecent: vi.fn().mockResolvedValue([]),
    getByOrganization: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockResolvedValue({ total: 0 }),
  };
  return {
    default: mockService,
    activityService: mockService,
  };
});
// Mock the TS resolve path as well
vi.mock('../server/src/services/ActivityService', () => {
  const mockService = {
    log: vi.fn().mockResolvedValue(undefined),
    getRecent: vi.fn().mockResolvedValue([]),
    getByOrganization: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockResolvedValue({ total: 0 }),
  };
  return {
    default: mockService,
    activityService: mockService,
  };
});

vi.mock('../server/src/services/MFAService.js', () => ({
  default: {
    generateSecret: vi.fn().mockResolvedValue({ secret: 'MOCK_SECRET', qrCode: 'MOCK_QR' }),
    verifyToken: vi.fn().mockResolvedValue(true),
    enableMFA: vi.fn().mockResolvedValue(true),
    disableMFA: vi.fn().mockResolvedValue(true),
    getMFAStatus: vi.fn().mockResolvedValue({ enabled: false, enforced: false }),
    isDeviceTrusted: vi.fn().mockResolvedValue(false),
    verifyTOTP: vi.fn().mockResolvedValue({ success: true }),
    trustDevice: vi.fn().mockResolvedValue(true),
  },
}));

// vi.mock('../server/src/services/RefreshTokenService.js', () => ({
//     default: {
//         generateTokenPair: vi.fn().mockResolvedValue({
//             accessToken: 'mock_access_token',
//             refreshToken: 'mock_refresh_token',
//             expiresIn: 3600
//         }),
//     }
// }));

vi.mock('../server/src/services/EmailVerificationService.js', () => ({
  default: {
    sendVerificationEmail: vi.fn().mockResolvedValue(true),
    verifyEmail: vi.fn().mockResolvedValue(true),
  },
}));

// Mock Plan Limits Middleware to avoid DB calls/hangs
// We use a factory that checks TEST_TYPE at runtime to allow real middleware in integration tests
vi.mock('../server/src/middleware/planLimits.middleware.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    checkPlanLimit: (limitKey: string) => {
      return (req: any, res: any, next: any) => {
        if (process.env.TEST_TYPE === 'integration') {
          return actual.checkPlanLimit(limitKey)(req, res, next);
        }
        return next();
      };
    },
  };
});

// Mock Permission Service to avoid DB calls
// COMMENTED OUT: We need real PermissionService for unit tests. Use DI instead.
// vi.mock('../server/services/permissionService.js', () => ({
//     default: {
//         can: vi.fn().mockReturnValue(true),
//     },
// }));
// Also mock the TS path just in case
// vi.mock('../server/src/services/permissionService.js', () => ({
//     default: {
//         can: vi.fn().mockReturnValue(true),
//     },
// }));

// --------------------------------------------------------
// Global Auth Middleware Mock
// --------------------------------------------------------
// Mock only for unit tests (MOCK_DB=true).
// Integration tests (MOCK_DB=false) should use the real middleware.
vi.mock('../server/src/middleware/auth.middleware.js', async (importOriginal) => {
  const actual = await importOriginal<any>();

  const mockAuth = (req: any, res: any, next: any) => {
    // If an Authorization header is present, ALWAYS use real middleware
    if (req.headers.authorization || req.headers.Authorization) {
      return actual.verifyToken(req, res, next);
    }

    // If NO token, AND we are in an integration test, use real middleware (which will return 401)
    if (process.env.MOCK_DB === 'false') {
      return actual.verifyToken(req, res, next);
    }

    // Unit test bypass logic (no token + MOCK_DB=true)
    const orgId = process.env.TEST_ORG_ID || 'test-org-id';
    const uId = process.env.TEST_USER_ID || 'test-user-id';

    req.user = {
      id: uId,
      email: 'test@example.com',
      name: 'Test User',
      role: 'owner',
      organizationId: orgId,
      isSuperAdmin: true,
      isDemo: false,
    };
    req.userId = uId;
    req.organizationId = orgId;
    return next();
  };

  return {
    ...actual,
    default: mockAuth,
    verifyToken: mockAuth,
    // Keep real implementations for other methods if they exist
    requireRole:
      actual.requireRole ||
      ((...args: any[]) =>
        (req: any, res: any, next: any) =>
          next()),
    requireSuperAdmin: actual.requireSuperAdmin || ((req: any, res: any, next: any) => next()),
    requireOrganization: actual.requireOrganization || ((req: any, res: any, next: any) => next()),
    requirePermission:
      actual.requirePermission ||
      ((...args: any[]) =>
        (req: any, res: any, next: any) =>
          next()),
    optionalAuth: actual.optionalAuth || ((req: any, res: any, next: any) => next()),
  };
});

// Global mock for Api service (keep real methods when needed).
vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<any>();
  const base = (actual as any)?.default || (actual as any)?.api || {};

  const Api = {
    ...base,

    // Dashboard & Overview
    getDashboardData: vi
      .fn()
      .mockResolvedValue({ overview: {}, recentActivity: [], quickStats: {} }),
    getRecentActivity: vi.fn().mockResolvedValue([]),
    getQuickStats: vi.fn().mockResolvedValue({}),
    getAnalysisBenefits: vi.fn().mockResolvedValue([]),

    // Tasks
    getTasks: vi.fn().mockResolvedValue([]),
    getTask: vi.fn().mockResolvedValue(null),
    createTask: vi.fn().mockResolvedValue({ id: 'task-1' }),
    updateTask: vi.fn().mockResolvedValue({}),
    deleteTask: vi.fn().mockResolvedValue({}),

    // Projects
    getProjects: vi.fn().mockResolvedValue([]),
    getProject: vi.fn().mockResolvedValue(null),
    createProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
    updateProject: vi.fn().mockResolvedValue({}),
    deleteProject: vi.fn().mockResolvedValue({}),

    // Users & Teams
    getUsers: vi.fn().mockResolvedValue([]),
    getUser: vi.fn().mockResolvedValue(null),
    createUser: vi.fn().mockResolvedValue({ id: 'user-1' }),
    updateUser: vi.fn().mockResolvedValue({}),
    deleteUser: vi.fn().mockResolvedValue({}),
    getUserPlans: vi.fn().mockResolvedValue([]),
    getTeamMembers: vi.fn().mockResolvedValue([]),

    // Organization
    getOrganization: vi.fn().mockResolvedValue({ id: 'org-1', name: 'Test Org' }),
    updateOrganization: vi.fn().mockResolvedValue({}),
    getOrganizationSettings: vi.fn().mockResolvedValue({}),
    updateOrganizationSettings: vi.fn().mockResolvedValue({}),

    // AI/LLM
    chatWithAI: vi.fn().mockResolvedValue('AI Response'),
    chatWithAIStream: vi.fn().mockResolvedValue({}),
    // Agent Audit Layer (used by UnifiedChatPanel on mount)
    agentAuditListAgents: vi.fn().mockResolvedValue({ success: true, agents: [] }),
    agentAuditSuggest: vi.fn().mockResolvedValue({ success: true, suggested: { agents: [] } }),
    agentAuditReview: vi
      .fn()
      .mockResolvedValue({ success: true, orchestratorRunId: 'run-1', verdict: {}, reviews: [] }),
    agentAuditAcceptRun: vi.fn().mockResolvedValue({ success: true }),
    getPublicLLMProviders: vi.fn().mockResolvedValue([]),
    getRecommendedProvider: vi.fn().mockResolvedValue({ recommendation: { model_id: 'gpt-4' } }),

    // Assessments
    getAssessments: vi.fn().mockResolvedValue([]),
    getAssessment: vi.fn().mockResolvedValue(null),
    createAssessment: vi.fn().mockResolvedValue({ id: 'assess-1' }),
    updateAssessment: vi.fn().mockResolvedValue({}),

    // Initiatives
    getInitiatives: vi.fn().mockResolvedValue([]),
    getInitiative: vi.fn().mockResolvedValue(null),
    createInitiative: vi.fn().mockResolvedValue({ id: 'init-1' }),

    // Admin
    getAdminStats: vi.fn().mockResolvedValue({}),
    getAuditLog: vi.fn().mockResolvedValue([]),
    getBillingInfo: vi.fn().mockResolvedValue({}),
    getSubscription: vi.fn().mockResolvedValue({}),

    // SuperAdmin
    getSuperAdminOrganizations: vi.fn().mockResolvedValue([]),
    getSuperAdminMetrics: vi.fn().mockResolvedValue({}),

    // Notifications
    getNotifications: vi.fn().mockResolvedValue([]),
    markNotificationRead: vi.fn().mockResolvedValue({}),

    // Settings
    getSettings: vi.fn().mockResolvedValue({}),
    updateSettings: vi.fn().mockResolvedValue({}),

    // Generic fallback for any other method
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  };

  return {
    ...actual,
    default: Api,
    Api,
    api: Api,
  };
});

// Also mock the path without @ alias (delegate to the same module)
vi.mock('../../src/services/api', async () => {
  const mod = await import('@/services/api');
  return mod as any;
});

// Mock the other aliases too

// Global mock for useAppStore - comprehensive mock for component tests
vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector?: any) => {
    const state = {
      user: { id: 'user-123', email: 'test@example.com', name: 'Test User', role: 'owner' },
      currentUser: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
      currentOrg: { id: 'org-123', name: 'Test Organization', plan: 'professional' },
      organization: { id: 'org-123', name: 'Test Organization' },
      aiConfig: { selectedTier: 'STANDARD', selectedModelId: null, autoMode: false },
      setAIConfig: vi.fn(),
      setCurrentView: vi.fn(),
      navigateTo: vi.fn(),
      theme: 'dark',
      setTheme: vi.fn(),
      language: 'en',
      setLanguage: vi.fn(),
      notifications: [],
      addNotification: vi.fn(),
      clearNotifications: vi.fn(),
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      // Panel Teresy (uiSlice). Atrapa ich nie miała, więc każdy artefakt
      // wpinający akcje kontekstowe do czatu (InsightViewer) wywracał się
      // w sprzątaniu na odmontowaniu: `setChatContextActions is not a function`.
      // W produkcji obie akcje istnieją w `uiSlice` — brakowało ich wyłącznie
      // w tej atrapie. (R2/defekt #4, 2026-07-23)
      chatSystemPrompt: null,
      setChatSystemPrompt: vi.fn(),
      chatContextActions: null,
      setChatContextActions: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

// Also mock the path without @ alias for useAppStore
vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: (selector?: any) => {
    const state = {
      user: { id: 'user-123', email: 'test@example.com', name: 'Test User', role: 'owner' },
      currentUser: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
      currentOrg: { id: 'org-123', name: 'Test Organization', plan: 'professional' },
      aiConfig: { selectedTier: 'STANDARD', selectedModelId: null, autoMode: false },
      setAIConfig: vi.fn(),
      setCurrentView: vi.fn(),
      navigateTo: vi.fn(),
      theme: 'dark',
      setTheme: vi.fn(),
      isAuthenticated: true,
      // Patrz komentarz przy atrapie '@/store/useAppStore' wyżej.
      chatSystemPrompt: null,
      setChatSystemPrompt: vi.fn(),
      chatContextActions: null,
      setChatContextActions: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

// Global mock for usePMOStore
vi.mock('../../src/store/usePMOStore', () => ({
  usePMOStore: (selector?: any) => {
    const state = {
      getTaskLabel: vi.fn().mockReturnValue([]),
      setTaskLabel: vi.fn(),
      labels: [],
    };
    return selector ? selector(state) : state;
  },
}));

// Global Setup
beforeAll(async () => {
  mockLLMApi.reset();
  // Ensure call history is cleared but implementations remain
  vi.clearAllMocks();
});

import { afterAll } from 'vitest';

afterAll(async () => {
  // Clean up database connection to prevent locking/leaks
  const db = (global as any).__ACTIVE_DB_INSTANCE__;
  if (db && typeof db.close === 'function') {
    // console.log('[Setup] Closing active database connection');
    await Promise.resolve(db.close());
    (global as any).__ACTIVE_DB_INSTANCE__ = undefined;
  }
});

// Reset LLM API mocks before each test
beforeEach(() => {
  // Ensure call history is cleared
  vi.clearAllMocks();
});

// REMOVED: Schema Initialization. Integration tests must use TestDatabaseFactory.create()

if (typeof window !== 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock scrollIntoView for ChatPanel and other components
  Element.prototype.scrollIntoView = vi.fn();
}

// Node Polyfills
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder as unknown as typeof TextEncoder;
global.TextDecoder = TextDecoder as unknown as any;

// PDF-Parse / Canvas Polyfills
global.DOMMatrix = class DOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
  constructor() {}
} as any;

// Mock Google Generative AI SDK - prevent real API calls in tests
vi.mock('@google/generative-ai', () => {
  const generateContentMock = vi.fn().mockResolvedValue({
    response: {
      text: () => 'Mock AI Response for testing',
      candidates: [{ content: { parts: [{ text: 'Mock AI Response' }] } }],
    },
  });

  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(function () {
      return {
        getGenerativeModel: vi.fn().mockReturnValue({
          getGenerativeModel: vi.fn().mockReturnThis(),
          generateContent: generateContentMock,
          generateContentStream: vi.fn().mockImplementation(async function* () {
            yield { text: () => 'Mock' };
            yield { text: () => ' AI' };
            yield { text: () => ' Response' };
          }),
          countTokens: vi.fn().mockResolvedValue({ totalTokens: 100 }),
        }),
      };
    }),
    HarmCategory: { HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT' },
    HarmBlockThreshold: { BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE' },
  };
});

// Mock removed to allow real middleware usage with DI
// Real middleware handles NODE_ENV=test automatically

// Mock RapidLeanReportService globally

// REMOVED dependency injection via require() as it fails in ESM environment.
// The global vi.mock('@google/generative-ai') above should suffice for most cases.
// Individual tests should mock the service using vi.mock() if they need specifically injected behavior.

// Mock global fetch to handle relative URLs in JSDOM and prevents network calls
global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : String(input);

  // Log for debugging if needed
  // console.log('[Mock Fetch]', url);

  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({ data: [] }),
    text: async () => '',
    blob: async () => new Blob(),
    arrayBuffer: async () => new ArrayBuffer(0),
    headers: new Headers(),
  } as Response);
});

// Mock multer globally
vi.mock('multer', () => {
  const inferMimeType = (filename: string | undefined): string => {
    const lower = String(filename ?? '').toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.txt')) return 'text/plain';
    return 'application/octet-stream';
  };

  const readRequestBody = (req: any): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  };

  const buildMockFile = (fieldName: string, req: any, body: Buffer) => {
    const contentType = String(req?.headers?.['content-type'] ?? '');
    if (!contentType.includes('multipart/form-data')) return undefined;

    const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.slice(1).find(Boolean);
    const filePart = boundary
      ? body
          .toString('binary')
          .split(`--${boundary}`)
          .find((part) => /filename="/i.test(part))
      : undefined;
    if (!filePart) return undefined;
    const filenameMatch = filePart.match(/filename="([^"]+)"/i);
    const contentTypeMatch = filePart.match(/Content-Type:\s*([^\r\n]+)/i);
    if (!filenameMatch) return undefined;
    const originalname = filenameMatch?.[1] ?? 'upload.bin';
    const mimetype = contentTypeMatch?.[1]?.trim() || inferMimeType(originalname);

    const headerEnd = filePart.indexOf('\r\n\r\n');
    const binaryContent =
      headerEnd >= 0 ? filePart.slice(headerEnd + 4).replace(/\r\n$/, '') : '';
    const fileBuffer = Buffer.from(binaryContent, 'binary');
    return {
      fieldname: fieldName,
      originalname,
      encoding: '7bit',
      mimetype,
      size: fileBuffer.length,
      buffer: fileBuffer,
    };
  };

  const parseMultipartFields = (req: any, body: Buffer): void => {
    const contentType = String(req?.headers?.['content-type'] ?? '');
    const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.slice(1).find(Boolean);
    if (!boundary) return;
    req.body ||= {};
    for (const part of body.toString('utf8').split(`--${boundary}`)) {
      if (/filename="/i.test(part)) continue;
      const name = part.match(/name="([^"]+)"/i)?.[1];
      const separator = part.indexOf('\r\n\r\n');
      if (name && separator >= 0) req.body[name] = part.slice(separator + 4).replace(/\r\n$/, '');
    }
  };

  const mock = vi.fn().mockReturnValue({
    array: vi.fn().mockReturnValue((req: any, res: any, next: any) => {
      req.files = [];
      next();
    }),
    single: vi.fn((fieldName = 'file') => async (req: any, res: any, next: any) => {
      const body = await readRequestBody(req);
      parseMultipartFields(req, body);
      const file = buildMockFile(fieldName, req, body);
      if (file) req.file = file;
      next();
    }),
    fields: vi.fn().mockReturnValue((req: any, res: any, next: any) => {
      req.files = {};
      next();
    }),
    any: vi.fn().mockReturnValue((req: any, res: any, next: any) => {
      req.files = [];
      next();
    }),
  }) as any;

  mock.diskStorage = vi.fn().mockReturnValue({});
  mock.memoryStorage = vi.fn().mockReturnValue({});

  return {
    default: mock,
    diskStorage: mock.diskStorage,
    memoryStorage: mock.memoryStorage,
  };
});

// Mock OpenAI SDK
vi.mock('openai', () => {
  const MockOpenAI = vi.fn(function () {
    return {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'Mock OpenAI Response' } }],
            usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
          }),
        },
      },
      audio: {
        speech: {
          create: vi.fn().mockResolvedValue({
            arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
          }),
        },
        transcriptions: {
          create: vi.fn().mockResolvedValue({
            text: 'Mock Transcription',
            language: 'en',
            words: [],
            segments: [],
          }),
        },
      },
      embeddings: {
        create: vi.fn().mockResolvedValue({
          data: [{ embedding: Array(1536).fill(0.1) }],
          usage: { prompt_tokens: 10, total_tokens: 10 },
        }),
      },
    };
  });

  return {
    default: MockOpenAI,
    OpenAI: MockOpenAI,
  };
});

// Mock html2canvas for PDF export tests
vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mockImageData'),
    width: 800,
    height: 600,
  }),
}));

// Mock canvas for PDF rendering
if (typeof window !== 'undefined') {
  const mockCanvas = {
    getContext: vi.fn().mockReturnValue({
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4) }),
      putImageData: vi.fn(),
      createImageData: vi.fn(),
      setTransform: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      translate: vi.fn(),
      transform: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 100 }),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      rect: vi.fn(),
    }),
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mockCanvasData'),
    width: 800,
    height: 600,
  };
  HTMLCanvasElement.prototype.getContext = mockCanvas.getContext;
  HTMLCanvasElement.prototype.toDataURL = mockCanvas.toDataURL;
}

// Handle uncaught exceptions - log but don't rethrow to prevent Vitest worker crashes
// Uncaught exceptions and rejections will now cause test failures (as they should).
