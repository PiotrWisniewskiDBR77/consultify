import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_ROOT = path.resolve(__dirname, '..');

export async function createLazyService<T = unknown>(servicePath: string): Promise<T> {
    // In test mode, try to use mocks first
    if (process.env.NODE_ENV === 'test') {
        try {
            const mockModule = await tryLoadMock<T>(servicePath);
            if (mockModule) {
                console.log(`[LazyServiceLoader] Using mock for: ${servicePath}`);
                return mockModule;
            }
        } catch (error) {
            // Continue to normal loading if mock not found
        }
    }

    // Try to find the file
    let absolutePath: string;
    if (servicePath.startsWith('./') || servicePath.startsWith('../')) {
        absolutePath = path.resolve(SRC_ROOT, 'services', servicePath);
    } else {
        absolutePath = path.resolve(SRC_ROOT, servicePath);
    }

    // Handle TS mapping for dynamic imports
    if (absolutePath.endsWith('.js')) {
        const tsPath = absolutePath.slice(0, -3) + '.ts';
        if (fs.existsSync(tsPath)) {
            absolutePath = tsPath;
        } else if (absolutePath.endsWith('.legacy.js')) {
            const nonLegacyTsPath = absolutePath.slice(0, -10) + '.ts';
            if (fs.existsSync(nonLegacyTsPath)) {
                absolutePath = nonLegacyTsPath;
            }
        }
    } else if (!absolutePath.endsWith('.ts')) {
        const tsPath = absolutePath + '.ts';
        if (fs.existsSync(tsPath)) {
            absolutePath = tsPath;
        }
    }

    // Check if we are trying to load the same file that is currently executing
    // This prevents infinite recursion/hangs in wrappers
    if (absolutePath === fileURLToPath(import.meta.url)) {
        console.warn(`[LazyServiceLoader] Circular load detected for: ${absolutePath}. Returning stub.`);
        return createStubProxy(servicePath);
    }

    console.log(`[LazyServiceLoader] Loading: ${servicePath} -> ${absolutePath}`);
    try {
        const module = await import(absolutePath);
        return (module.default || module) as T;
    } catch (error) {
        // One last try: if it's mfaService.js, try MFAService.ts
        if (absolutePath.endsWith('mfaService.ts')) {
            const capitalPath = absolutePath.replace('mfaService.ts', 'MFAService.ts');
            if (fs.existsSync(capitalPath) && capitalPath !== fileURLToPath(import.meta.url)) {
                try {
                    const module = await import(capitalPath);
                    return (module.default || module) as T;
                } catch (e) { /* ignore */ }
            }
        }

        console.error(`[LazyServiceLoader] Error loading ${absolutePath}:`, error);
        return createStubProxy(servicePath, absolutePath);
    }
}

/**
 * Try to load a mock service in test mode
 */
async function tryLoadMock<T>(servicePath: string): Promise<T | null> {
    // Extract service name from path
    const serviceName = path.basename(servicePath, path.extname(servicePath));

    // Try to load from serviceMocks helper
    try {
        // Use path.resolve to get absolute path to tests directory
        const testsDir = path.resolve(SRC_ROOT, '../../tests');
        const mockPath = path.join(testsDir, 'helpers/serviceMocks.js');
        const { serviceMocks } = await import(mockPath);

        // Map common service names to mocks
        const mockMap: Record<string, any> = {
            'enhancedContextBuilder': serviceMocks.EnhancedContextBuilder,
            'regulatoryModeGuard': serviceMocks.RegulatoryModeGuard,
            'pmoDomainRegistry': serviceMocks.PMODomainRegistry,
            'integrationService': serviceMocks.IntegrationService,
            'workqueueService': serviceMocks.WorkqueueService,
            'organizationService': serviceMocks.OrganizationService,
            'aiActionExecutor': serviceMocks.AIActionExecutor,
            'persistentSessionStore': serviceMocks.PersistentSessionStore,
            'summarizationService': serviceMocks.SummarizationService,
            'aiExplainabilityService': serviceMocks.AIExplainabilityService,
            'docIndexer': serviceMocks.DocIndexer,
        };

        const mockKey = serviceName.replace(/Service$/, '').toLowerCase();
        if (mockMap[mockKey]) {
            return mockMap[mockKey] as T;
        }
    } catch (error) {
        // Mock file not available, continue to normal loading
    }

    return null;
}

function createStubProxy<T>(servicePath: string, absolutePath?: string): T {
    if (absolutePath) {
        console.warn(`[LazyServiceLoader] Failed to load: ${absolutePath}`);
    }
    console.warn(`[LazyServiceLoader] Returning stub proxy for: ${servicePath}`);

    // Return a Proxy that provides stub methods for any property access
    const stubTarget = {} as Record<string | symbol, any>;
    return new Proxy(stubTarget, {
        get(_target, prop) {
            if (prop === 'then') return undefined; // Prevent it from looking like a promise
            if (typeof prop === 'string' || typeof prop === 'symbol') {
                return (..._args: any[]) => {
                    const propName = typeof prop === 'symbol' ? prop.toString() : prop;
                    console.debug(`[LazyServiceLoader] Stub method called: ${servicePath}.${propName}()`);
                    return Promise.resolve(null);
                };
            }
            return undefined;
        },
        set(_target, prop, _value) {
            const propName = typeof prop === 'symbol' ? prop.toString() : String(prop);
            console.debug(`[LazyServiceLoader] Stub property set: ${servicePath}.${propName}`);
            return true;
        },
        construct(_target, _args) {
            console.debug(`[LazyServiceLoader] Stub constructor called: new ${servicePath}()`);
            return createStubProxy(servicePath);
        }
    }) as T;
}

/**
 * Create a cached lazy service loader
 * This ensures the service is only loaded once and cached for subsequent calls
 */
export function createCachedLazyService<T = unknown>(servicePath: string): () => Promise<T> {
    let serviceCache: T | null = null;
    let servicePromise: Promise<T> | null = null;

    return async (): Promise<T> => {
        if (serviceCache) {
            return serviceCache;
        }
        if (!servicePromise) {
            servicePromise = createLazyService<T>(servicePath).then((service) => {
                serviceCache = service;
                return service;
            });
        }
        return servicePromise;
    };
}

