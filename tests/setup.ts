import '@testing-library/jest-dom';
import { vi } from 'vitest';

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
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// PDF-Parse / Canvas Polyfills
global.DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    constructor() { }
} as any;
