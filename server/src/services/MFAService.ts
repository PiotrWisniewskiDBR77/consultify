import { createCachedLazyService } from '../utils/lazyServiceLoader.js';

const loadMFAService = createCachedLazyService<any>('./mfaService.js');

/**
 * MFA Service Wrapper
 * Handles lazy loading and dependency injection for integration tests
 */
const serviceWrapper = {
    setDependencies: (deps: any) => {
        loadMFAService().then((service) => {
            if (service.setDependencies) {
                service.setDependencies(deps);
            }
        });
    },
};

// Export default proxy to handle all method calls lazily
export default new Proxy(serviceWrapper, {
    get: (target: any, prop: string) => {
        if (prop in target) return target[prop];

        return (...args: any[]) => {
            return loadMFAService().then((service) => {
                if (typeof service[prop] === 'function') {
                    return service[prop](...args);
                }
                return service[prop];
            });
        };
    },
});
