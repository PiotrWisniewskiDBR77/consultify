/**
 * Feature Flags Configuration
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Centralized feature toggles for the application.
 * Can be overridden by environment variables.
 */

import { z } from 'zod';

import logger from '../utils/Logger.js';

// ==========================================
// ZOD SCHEMAS
// ==========================================

const FeatureFlagsSchema = z.object({
  ENABLE_ACTION_EXECUTION: z.boolean().default(false),
  ENABLE_ACTION_DECISIONS: z.boolean().default(true),
  ENABLE_METRICS_DASHBOARD: z.boolean().default(true),
  ENABLE_AI_COACH: z.boolean().default(true),
  ENABLE_HELP_SYSTEM: z.boolean().default(true),
  ENABLE_TABLE_PLATFORM_METADATA_FIRST: z.boolean().default(false),
  ENABLE_TABLE_PLATFORM_RECORDS_API: z.boolean().default(false),
});

export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

// ==========================================
// CONFIGURATION LOADING
// ==========================================

/**
 * Load and validate feature flags
 */
export function loadFeatureFlags(): FeatureFlags {
  const rawFlags = {
    // Enable execution of AI-proposed actions (Dangerous)
    ENABLE_ACTION_EXECUTION: process.env.ENABLE_ACTION_EXECUTION === 'true' || false,

    // Enable human decision recording for AI actions
    ENABLE_ACTION_DECISIONS: process.env.ENABLE_ACTION_DECISIONS !== 'false', // Default true

    // Enable metrics dashboard
    ENABLE_METRICS_DASHBOARD: process.env.ENABLE_METRICS_DASHBOARD !== 'false', // Default true

    // Enable AI Coach guidance
    ENABLE_AI_COACH: process.env.ENABLE_AI_COACH !== 'false', // Default true

    // Enable self-serve help system
    ENABLE_HELP_SYSTEM: process.env.ENABLE_HELP_SYSTEM !== 'false', // Default true

    // Table Platform: metadata-first backend
    // Opt-in only. Default must stay off until parity with legacy table graph is complete.
    ENABLE_TABLE_PLATFORM_METADATA_FIRST: process.env.ENABLE_TABLE_PLATFORM_METADATA_FIRST === 'true',

    // Table Platform: Records API
    ENABLE_TABLE_PLATFORM_RECORDS_API: process.env.ENABLE_TABLE_PLATFORM_RECORDS_API === 'true',
  };

  // Validate configuration
  const result = FeatureFlagsSchema.safeParse(rawFlags);

  if (!result.success) {
    logger.error('[Feature Flags] Configuration validation failed:');
    result.error.issues.forEach((err: any) => {
      logger.error(`  - ${err.path.join('.')}: ${err.message}`);
    });

    // Use defaults on validation failure
    logger.warn('[Feature Flags] Using defaults for invalid values.');
    return FeatureFlagsSchema.parse({});
  }

  return result.data;
}

// ==========================================
// EXPORT
// ==========================================

export const featureFlags = loadFeatureFlags();
export default featureFlags;
