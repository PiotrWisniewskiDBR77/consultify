/**
 * AIContext Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

// Lazy load the JS service module
// @ts-ignore - JS module without types, will be migrated to TS
// import service from '../../ai/aiContext.js';
import logger from '../../utils/Logger.js';

let _contextBuilder: any = null;
async function getContextBuilder() {
  if (!_contextBuilder) {
    try {
      const mod = await import('../aiContextBuilder.js');
      _contextBuilder = mod.AIContextBuilder || mod.default || mod;
    } catch (e) {
      logger.debug(`[AIContext] ${(e as Error).message}`);
      _contextBuilder = {};
    }
  }
  return _contextBuilder;
}

export async function buildContext(options: {
  userId: string;
  organizationId?: string;
  projectId?: string;
  focusMode?: string;
  screenContext?: string;
}) {
  const builder = await getContextBuilder();
  if (typeof builder.buildContext === 'function') return builder.buildContext(options);
  if (typeof builder === 'function') {
    const instance = new builder(options);
    return instance.build?.() || instance;
  }
  return { layers: [], totalTokens: 0 };
}

const aiContext = { buildContext, getContextBuilder };
export default aiContext;
