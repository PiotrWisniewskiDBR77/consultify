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
  ENABLE_RECORD_PROVENANCE: z.boolean().default(false),
  ENABLE_TABLE_AI_EDITOR: z.boolean().default(false),
  ENABLE_TABLE_QA_ENGINE: z.boolean().default(false),
  ENABLE_TABLE_SOURCE_PACK: z.boolean().default(false),
  ENABLE_TABLE_ARTIFACT_CONVERSION: z.boolean().default(false),
  ENABLE_TABLE_FORM_INTAKE_JWT: z.boolean().default(false),
  ENABLE_V8_GLOBAL: z.boolean().default(false),
  ENABLE_V8_SHADOW_MODE: z.boolean().default(false),
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
    ENABLE_TABLE_PLATFORM_METADATA_FIRST:
      process.env.ENABLE_TABLE_PLATFORM_METADATA_FIRST === 'true',

    // Table Platform: Records API
    ENABLE_TABLE_PLATFORM_RECORDS_API: process.env.ENABLE_TABLE_PLATFORM_RECORDS_API === 'true',

    // Block B (Record Provenance): per-record confidence + validation_status.
    // Gate sits inside ConfidenceScoringService.recompute() and the
    // validation-status route, so partial deploys cannot crash record writes.
    ENABLE_RECORD_PROVENANCE: process.env.ENABLE_RECORD_PROVENANCE === 'true',

    // Block C (AI Operator): 8-level AI Editor on top of TableAiEditorService.
    // Disabled by default until C-S2 lands real handlers; route layer still
    // honours the budget gate + audit pipeline so QA can exercise the wiring.
    ENABLE_TABLE_AI_EDITOR: process.env.ENABLE_TABLE_AI_EDITOR === 'true',

    // Block C (Table QA Engine): deterministic 5-axis health scoring +
    // suggestion synthesis on top of TableQaService. Disabled by default until
    // C-S5 ships TabeleQaPanel; routes still honour cross-tenant defenses so
    // backend QA can exercise the pipeline before the UI lands.
    ENABLE_TABLE_QA_ENGINE: process.env.ENABLE_TABLE_QA_ENGINE === 'true',

    // Block C (Source Pack Builder): curator-driven bundle of records that the
    // AI Editor can later consume (`payload.sourcePackId`). Disabled by default
    // until C-S6 frontend lands; the route layer still applies cross-tenant
    // defenses so backend QA can exercise the pipeline.
    ENABLE_TABLE_SOURCE_PACK: process.env.ENABLE_TABLE_SOURCE_PACK === 'true',

    // Block D (Table → Doc/Deck Conversion): bridges Tabele tables into
    // Document Studio v1 / DeckBuilder. Disabled by default until D-S3 ships
    // the lane UI; backend route still applies tenant guards so QA can
    // exercise the pipeline before the UI surface lands.
    ENABLE_TABLE_ARTIFACT_CONVERSION: process.env.ENABLE_TABLE_ARTIFACT_CONVERSION === 'true',

    // Block D (Form Intake JWT): per-recipient JWT links + field allow-list
    // + public submission rate limit on top of the existing slug-based
    // public form router. Disabled by default until D-S4 ships the
    // recipient form page; the slug router stays live for backward
    // compatibility regardless of this flag.
    ENABLE_TABLE_FORM_INTAKE_JWT: process.env.ENABLE_TABLE_FORM_INTAKE_JWT === 'true',

    // V8: global kill switch for all V8 features
    ENABLE_V8_GLOBAL: process.env.ENABLE_V8_GLOBAL === 'true',

    // V8: shadow mode — run V8 logic alongside legacy without user-visible effects
    ENABLE_V8_SHADOW_MODE: process.env.ENABLE_V8_SHADOW_MODE === 'true',
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
