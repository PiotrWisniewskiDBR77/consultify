/**
 * Voicehealthmonitor Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createCachedLazyService } from '../../utils/lazyServiceLoader.ts';

// Lazy load the JS service module
const loadVoicehealthmonitor = createCachedLazyService('../../services/ai/voiceHealthMonitor.js');

// Export default instance (for backward compatibility)
export default loadVoicehealthmonitor();
