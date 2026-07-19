/**
 * AiLearning Routes
 * API endpoints for aiLearning (SuperAdmin AI Intelligence → Learning System)
 *
 * RECOVERY (self-import wrapper family): the previous `createLazyRoute('./aiLearning.js')`
 * wrapper resolved its relative specifier against utils/ (the loader's dir), not this dir,
 * so every request to /api/ai/learning/* returned HTTP 500 "Failed to load route" — while the
 * REAL 192-line router in ./aiLearning.ts sat unused. Replaced the broken lazy wrapper with a
 * direct static re-export of the real implementation. Verified: ./aiLearning.ts imports cleanly
 * and exports an express Router (no hang, no circular import).
 */

export { default } from './aiLearning.js';
