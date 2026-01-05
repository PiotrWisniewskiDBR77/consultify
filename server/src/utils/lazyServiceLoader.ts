import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createLazyService<T = unknown>(servicePath: string): Promise<T> {
    const absolutePath = path.resolve(__dirname, servicePath);

    const module = await import(absolutePath);
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
