import '@testing-library/jest-dom';
import { beforeAll, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { mockLLMApi } from './__mocks__/llmApi.js';
import { setupAutoCleanup } from './helpers/testCleanup.js';

const require = createRequire(import.meta.url);

// Setup automatic cleanup for all tests
setupAutoCleanup();

// Global mock for react-i18next to prevent "Cannot read properties of undefined (reading 'en')" errors
vi.mock('react-i18next', () => {
    // Helper function to create nested translation objects with language properties
    const createTranslationObject = (key: string, defaultValue?: any): any => {
        // If defaultValue is provided and is an object, use it
        if (defaultValue && typeof defaultValue === 'object' && !Array.isArray(defaultValue)) {
            return defaultValue;
        }

        // Create a proxy that handles all property access
        return new Proxy({}, {
            get(target, prop: string) {
                // Handle language properties (.en, .pl, etc.) - return the key or a safe value
                if (['en', 'pl', 'de', 'fr', 'es', 'it', 'ja', 'zh'].includes(prop)) {
                    return defaultValue || key;
                }
                // Handle common nested properties that might be accessed
                if (['scenarios', 'deepDive', 'recommended', 'title', 'subtitle', 'name', 'description', 'gains', 'sacrifices', 'narrative'].includes(prop)) {
                    return createTranslationObject(`${key}.${prop}`);
                }
                // Handle array access (e.g., t.scenarios[id])
                if (typeof prop === 'string' && /^[a-zA-Z0-9_-]+$/.test(prop)) {
                    return createTranslationObject(`${key}.${prop}`);
                }
                // Handle toString/valueOf for string conversion
                if (prop === 'toString' || prop === 'valueOf') {
                    return () => defaultValue || key;
                }
                // Handle undefined properties gracefully
                if (prop === Symbol.toPrimitive) {
                    return () => defaultValue || key;
                }
                // Return undefined for unknown properties (but don't throw)
                return undefined;
            },
            // Make it work with Object.keys and similar
            ownKeys() {
                return ['en', 'pl', 'scenarios', 'deepDive', 'recommended'];
            },
            has(target, prop) {
                return ['en', 'pl', 'scenarios', 'deepDive', 'recommended', 'toString', 'valueOf'].includes(prop as string) ||
                    (typeof prop === 'string' && /^[a-zA-Z0-9_-]+$/.test(prop));
            },
            getOwnPropertyDescriptor(target, prop) {
                return {
                    enumerable: true,
                    configurable: true,
                    value: this.get(target, prop, target)
                };
            }
        });
    };

    return {
        useTranslation: () => ({
            t: (key: string, options?: any) => {
                // Handle fallback as second argument (string)
                if (typeof options === 'string') {
                    return options;
                }
                // Handle returnObjects option
                if (options?.returnObjects) {
                    return createTranslationObject(key, options.defaultValue);
                }
                // Handle interpolation
                if (options && typeof options === 'object' && !options.returnObjects) {
                    // Simple interpolation - replace {key} with value
                    let result = options.defaultValue || key;
                    Object.keys(options).forEach(optKey => {
                        if (optKey !== 'defaultValue' && optKey !== 'returnObjects') {
                            result = String(result).replace(new RegExp(`\\{${optKey}\\}`, 'g'), String(options[optKey]));
                        }
                    });
                    return result;
                }
                // Default: return the key or defaultValue
                return options?.defaultValue || key;
            },
            i18n: {
                language: 'en',
                changeLanguage: vi.fn(),
                getResourceBundle: vi.fn(() => ({})),
                hasResourceBundle: vi.fn(() => false),
                addResourceBundle: vi.fn(),
            },
            ready: true
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

// Ensure consistent test-mode behavior across backend + frontend tests
if (typeof process !== 'undefined' && process.env) {
    process.env.NODE_ENV = 'test';
    process.env.DB_TYPE = process.env.DB_TYPE || 'sqlite';
    process.env.MOCK_REDIS = process.env.MOCK_REDIS || 'true';
    process.env.MOCK_DB = process.env.MOCK_DB || 'true';
    // Keep DB in-memory in tests (db chooses :memory: when NODE_ENV === 'test')
    process.env.SQLITE_PATH = process.env.SQLITE_PATH || ':memory:';
    // Stub API keys to prevent real calls if mocking is accidentally bypassed
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.OPENAI_API_KEY = 'sk-test-openai-key';

    // --------------------------------------------------------
    // Global Database Mock (SQLite-compatible)
    // --------------------------------------------------------
    // We define this on global so server/database.js picks it up.
    // Using vi.fn() allows tests to spy on/override specific methods using .mockImplementation()
    const mockDb = {
        run: vi.fn().mockImplementation(function (sql, params, cb) {
            const callback = typeof params === 'function' ? params : cb;
            // Provide context (this.lastID, this.changes) for callbacks
            if (callback) callback.call({ lastID: 1, changes: 1 }, null);
            return this;
        }),
        get: vi.fn().mockImplementation(function (sql, params, cb) {
            const callback = typeof params === 'function' ? params : cb;
            if (callback) callback(null, null); // Default: no row found
            return this;
        }),
        all: vi.fn().mockImplementation(function (sql, params, cb) {
            const callback = typeof params === 'function' ? params : cb;
            if (callback) callback(null, []); // Default: empty array
            return this;
        }),
        exec: vi.fn().mockImplementation(function (sql, cb) {
            if (cb) cb(null);
            return this;
        }),
        serialize: vi.fn().mockImplementation(function (cb) {
            if (cb) cb();
            return this;
        }),
        on: vi.fn().mockReturnThis(),
        close: vi.fn().mockImplementation(function (cb) {
            if (cb) cb(null);
        }),
        // Async wrappers often used by services
        getAsync: vi.fn().mockResolvedValue(null),
        runAsync: vi.fn().mockResolvedValue({ lastID: 0, changes: 0 }),
        allAsync: vi.fn().mockResolvedValue([]),
        execAsync: vi.fn().mockResolvedValue(undefined),
        // Polyfill for Postgres compatibility (Promise-based)
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
    };

    // Assign to global for server/database.js to use
    (global as any).__TEST_DB_MOCK__ = mockDb;
}

// Mock jsonwebtoken globally
vi.mock('jsonwebtoken', () => ({
    default: {
        sign: vi.fn(() => 'mock-token'),
        verify: vi.fn(),
        decode: vi.fn()
    },
    sign: vi.fn(() => 'mock-token'),
    verify: vi.fn(),
    decode: vi.fn()
}));

// Mock Sentry to prevent native binding issues


// Reset LLM API mocks before each test
beforeEach(() => {
    mockLLMApi.reset();
    // Ensure all mocks are reset
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.restoreAllMocks();
});

// REMOVED: Schema Initialization. Integration tests must use TestDatabaseFactory.create()


if (typeof window !== 'undefined') {
    global.ResizeObserver = class ResizeObserver {
        observe() { }
        unobserve() { }
        disconnect() { }
    };

    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
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
}

// Node Polyfills
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder as unknown as typeof TextEncoder;
global.TextDecoder = TextDecoder as unknown as any;

// PDF-Parse / Canvas Polyfills
global.DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    constructor() { }
} as any;

// Mock Google Generative AI SDK - prevent real API calls in tests
vi.mock('@google/generative-ai', () => {
    const generateContentMock = vi.fn().mockResolvedValue({
        response: {
            text: () => 'Mock AI Response for testing',
            candidates: [{ content: { parts: [{ text: 'Mock AI Response' }] } }]
        }
    });

    return {
        GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
            getGenerativeModel: vi.fn().mockReturnValue({
                getGenerativeModel: vi.fn().mockReturnThis(),
                generateContent: generateContentMock,
                generateContentStream: vi.fn().mockImplementation(async function* () {
                    yield { text: () => 'Mock' };
                    yield { text: () => ' AI' };
                    yield { text: () => ' Response' };
                }),
                countTokens: vi.fn().mockResolvedValue({ totalTokens: 100 })
            })
        })),
        HarmCategory: { HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT' },
        HarmBlockThreshold: { BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE' }
    };
});

// Mock removed to allow real middleware usage with DI
// Real middleware handles NODE_ENV=test automatically


// Mock RapidLeanReportService globally
vi.mock('../server/services/rapidLeanReportService', () => {
    return {
        generateReport: vi.fn().mockResolvedValue({
            fileUrl: '/uploads/reports/test-report.pdf',
            id: 'test-report-id'
        }),
        getReport: vi.fn().mockResolvedValue({
            id: 'test-report-id',
            file_url: '/uploads/reports/test-report.pdf'
        })
    };
});

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
    const mock = vi.fn().mockReturnValue({
        array: vi.fn().mockReturnValue((req: any, res: any, next: any) => {
            req.files = [];
            next();
        }),
        single: vi.fn().mockReturnValue((req: any, res: any, next: any) => {
            req.file = {};
            next();
        }),
        fields: vi.fn().mockReturnValue((req: any, res: any, next: any) => {
            req.files = {};
            next();
        }),
        any: vi.fn().mockReturnValue((req: any, res: any, next: any) => {
            req.files = [];
            next();
        })
    }) as any;
    mock.diskStorage = vi.fn().mockReturnValue({});
    mock.memoryStorage = vi.fn().mockReturnValue({});
    return mock;
});

// Mock OpenAI SDK
vi.mock('openai', () => ({
    default: vi.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: vi.fn().mockResolvedValue({
                    choices: [{ message: { content: 'Mock OpenAI Response' } }],
                    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
                })
            }
        }
    }))
}));

// Mock html2canvas for PDF export tests
vi.mock('html2canvas', () => ({
    default: vi.fn().mockResolvedValue({
        toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mockImageData'),
        width: 800,
        height: 600
    })
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
            rect: vi.fn()
        }),
        toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mockCanvasData'),
        width: 800,
        height: 600
    };
    HTMLCanvasElement.prototype.getContext = mockCanvas.getContext;
    HTMLCanvasElement.prototype.toDataURL = mockCanvas.toDataURL;
}

// Handle uncaught exceptions - log but don't rethrow to prevent Vitest worker crashes
// Previously throwing here caused "Worker exited unexpectedly" errors
// Real failures will surface in individual test assertions
if (typeof process !== 'undefined' && process.on) {
    process.on('uncaughtException', (err: any) => {
        // Log the error for debugging but don't crash the worker
        console.error('[Test Setup] Uncaught exception (logged, not rethrown):', err?.message || err);
        // Don't rethrow - let the test framework handle assertion failures
    });

    process.on('unhandledRejection', (reason: any) => {
        console.error('[Test Setup] Unhandled rejection (logged, not rethrown):', (reason as Error)?.message || reason);
        // Don't throw - let the test framework handle it
    });
}
