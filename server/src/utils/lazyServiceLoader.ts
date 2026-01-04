/**
 * Lazy Service Loader Utility
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Utility for lazy-loading ES module services to replace wrapper services
 */

/**
 * Create a lazy-loaded service wrapper
 * @param servicePath - Path to the service module (e.g., '../../services/serviceName.js')
 * @returns Promise that resolves to the service module
 */
export async function createLazyService<T = unknown>(servicePath: string): Promise<T> {
    const module = await import(servicePath);
    return (module.default || module) as T;
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



