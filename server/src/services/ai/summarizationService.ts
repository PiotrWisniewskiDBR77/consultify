/**
 * Summarization Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import { createCachedLazyService } from '../../utils/lazyServiceLoader.js';

// Lazy load the JS service module
const loadSummarization = createCachedLazyService('../../ai/summarizationService.js');

// Export default instance (for backward compatibility)
export default loadSummarization();

// Export named class for tests
export class SummarizationService {
    constructor() {
        // Stub constructor
    }

    summarizeConversation() { return Promise.resolve('Summary stub'); }
    summarizeText() { return Promise.resolve('Summary stub'); }
}
