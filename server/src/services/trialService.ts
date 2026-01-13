import { createCachedLazyService } from '../utils/lazyServiceLoader.js';

// Lazy load the JS service module - pointed to non-existent file originally
// This service is now partially replaced by AccessTrialService
const loadTrialService = createCachedLazyService('./trialService.legacy.js');

// Export default instance (for backward compatibility)
export default loadTrialService();
