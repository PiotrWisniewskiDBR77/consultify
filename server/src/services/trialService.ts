import { createCachedLazyService } from '../utils/lazyServiceLoader.js';

// Lazy load the JS service module - legacy file doesn't exist
// This service is now partially replaced by AccessTrialService
// The lazyServiceLoader will return a stub proxy if the file is not found
// This is expected behavior and allows backward compatibility
const loadTrialService = createCachedLazyService('./trialService.legacy.js');

// Export default instance (for backward compatibility)
// Note: This will be a stub proxy if the legacy file doesn't exist
export default loadTrialService();
