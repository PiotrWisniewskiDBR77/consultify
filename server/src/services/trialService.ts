import { createCachedLazyService } from '../utils/lazyServiceLoader.js';

// Lazy load the JS service module
const loadTrialService = createCachedLazyService('./trialService.js');

// Export default instance (for backward compatibility)
export default loadTrialService();
