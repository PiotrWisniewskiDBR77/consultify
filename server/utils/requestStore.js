const { AsyncLocalStorage } = require('async_hooks');
const { v4: uuidv4 } = require('uuid');

const storage = new AsyncLocalStorage();

/**
 * Middleware to initialize request context with a Correlation ID
 */
const correlationMiddleware = (req, res, next) => {
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

const getCorrelationId = () => {
    const store = storage.getStore();
    return store ? store.correlationId : null;
};

const getStore = () => storage.getStore();

module.exports = {
    correlationMiddleware,
    getCorrelationId,
    getStore
};
