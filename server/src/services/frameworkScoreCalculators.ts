import { createCachedLazyService } from '../utils/lazyServiceLoader.js';

// Lazy load the JS service module
const loadFrameworkscorecalculators = createCachedLazyService('./frameworkScoreCalculators.js');

// Export default instance (for backward compatibility)
export default loadFrameworkscorecalculators();
