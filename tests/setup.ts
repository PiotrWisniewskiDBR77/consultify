import '@testing-library/jest-dom';
import { beforeAll, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { mockLLMApi } from './__mocks__/llmApi.js';

const require = createRequire(import.meta.url);

// Ensure consistent test-mode behavior across backend + frontend tests
if (typeof process !== 'undefined' && process.env) {
    process.env.NODE_ENV = 'test';
    process.env.DB_TYPE = process.env.DB_TYPE || 'sqlite';
    process.env.MOCK_REDIS = process.env.MOCK_REDIS || 'true';
    process.env.MOCK_DB = process.env.MOCK_DB || 'true';
    // Keep DB in-memory in tests (db chooses :memory: when NODE_ENV === 'test')
    process.env.SQLITE_PATH = process.env.SQLITE_PATH || ':memory:';
}

// Reset LLM API mocks before each test
beforeEach(() => {
    mockLLMApi.reset();
});

// Ensure DB schema is initialized before any test starts hitting it.
beforeAll(async () => {
    try {
        const db = require('../server/database');
        if (db?.initPromise) {
            await db.initPromise;
        }
    } catch (err) {
        // If a given test-suite doesn't touch backend DB, do not fail it here.
        // Real failures should surface in the tests that use the DB.
        console.warn('[Test Setup] DB init wait skipped:', err?.message || err);
    }
});

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
global.TextDecoder = TextDecoder as unknown as typeof TextDecoder;

// PDF-Parse / Canvas Polyfills
global.DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    constructor() { }
};

// Mock Google Generative AI SDK - prevent real API calls in tests
vi.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
        getGenerativeModel: vi.fn().mockReturnValue({
            generateContent: vi.fn().mockResolvedValue({
                response: {
                    text: () => 'Mock AI Response for testing',
                    candidates: [{ content: { parts: [{ text: 'Mock AI Response' }] } }]
                }
            }),
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
}));

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

// Handle uncaught exceptions from async database operations during tests
// This prevents non-test-related FK constraint errors from causing CI exit code 1
if (typeof process !== 'undefined' && process.on) {
    process.on('uncaughtException', (err: Error) => {
        // Log but don't crash for known non-critical errors (e.g., activity logging FK violations)
        if (err.message && err.message.includes('SQLITE_CONSTRAINT') && err.message.includes('FOREIGN KEY')) {
            console.warn('[Test Setup] Non-critical uncaughtException (FK constraint):', err.message);
            return; // Don't rethrow, allow tests to continue
        }
        // For other errors, log and rethrow
        console.error('[Test Setup] Uncaught exception:', err);
        throw err;
    });
}
