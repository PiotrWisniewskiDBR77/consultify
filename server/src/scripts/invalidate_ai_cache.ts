import { appCache } from '../services/redis/CacheService.js';
import logger from '../utils/Logger.js';

const invalidate = async () => {
    try {
        const timestamp = Date.now();
        logger.info('Broadcasting cache invalidation event...', { timestamp });

        await appCache.publish('router:config_update', `invalidate:${timestamp}`);

        logger.info('Published router:config_update event.');
        process.exit(0);
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to invalidate cache', err);
        process.exit(1);
    }
};

invalidate();
