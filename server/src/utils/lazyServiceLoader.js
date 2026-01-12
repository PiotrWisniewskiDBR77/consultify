/**
 * Lazy Service Loader Utility (JS Proxy for Tests)
 */

export async function createLazyService(servicePath) {
    const module = await import(servicePath);
    return (module.default || module);
}

export function createCachedLazyService(servicePath) {
    let serviceCache = null;
    let servicePromise = null;

    return async () => {
        if (serviceCache) {
            return serviceCache;
        }
        if (!servicePromise) {
            servicePromise = createLazyService(servicePath).then((service) => {
                serviceCache = service;
                return service;
            });
        }
        return servicePromise;
    };
}
