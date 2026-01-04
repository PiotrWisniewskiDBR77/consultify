import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';

const storage = new AsyncLocalStorage();

/**
 * Middleware to initialize request context with a Correlation ID
 */
export const correlationMiddleware = (req, res, next) => {
    // Read existing correlation ID from frontend or generate a new one
    const correlationId = req.get('X-Correlation-ID') || uuidv4();

    // Store it in AsyncLocalStorage
    storage.run({ correlationId, startTime: Date.now() }, () => {
        // Also attach to request and response for convenience
        req.correlationId = correlationId;
        res.set('X-Correlation-ID', correlationId);
        next();
    });
};

export const getCorrelationId = () => {
    const store = storage.getStore();
    return store ? store.correlationId : null;
};

export const getStore = () => storage.getStore();

export {
correlationMiddleware,
    getCorrelationId,
    getStore
};

export default {
    correlationMiddleware,
    getCorrelationId,
    getStore
};
