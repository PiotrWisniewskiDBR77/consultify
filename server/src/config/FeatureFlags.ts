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
  ENABLE_TABLE_PLATFORM_RECORDS_API: z.boolean().default(true),
  ENABLE_RECORD_PROVENANCE: z.boolean().default(false),
  ENABLE_TABLE_AI_EDITOR: z.boolean().default(true),
  ENABLE_TABLE_QA_ENGINE: z.boolean().default(true),
  ENABLE_TABLE_SOURCE_PACK: z.boolean().default(true),
  ENABLE_TABLE_ARTIFACT_CONVERSION: z.boolean().default(true),
  ENABLE_TABLE_FORM_INTAKE_JWT: z.boolean().default(false),
  ENABLE_V8_GLOBAL: z.boolean().default(false),
  ENABLE_V8_SHADOW_MODE: z.boolean().default(false),
  ENABLE_DELIVERABLES_LIGHT: z.boolean().default(false),
  ENABLE_TERESA_RETRIEVAL: z.boolean().default(false),
  ENABLE_TERESA_MINDMAP: z.boolean().default(true),
  ENABLE_DELIVERABLES_DOC_STREAMING: z.boolean().default(false),
  ENABLE_DELIVERABLES_PREMIUM: z.boolean().default(false),
  ENABLE_SHARED_IDEA_MAPS: z.boolean().default(true),
  ENABLE_TERESA_CANVAS_TOOLS: z.boolean().default(true),
  ENABLE_TERESA_NOTE_CREATE: z.boolean().default(true),
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
    // Default ON. The table platform (My Work table builder + /tabele lane)
    // is GA; the route layer still performs a live `tp_*` schema readiness
    // check (returns 503 SCHEMA_NOT_READY until the date-prefixed migration
    // runner has applied the 700-series DDL at boot). Set the env var to
    // 'false' to hard-disable the authenticated table endpoints.
    ENABLE_TABLE_PLATFORM_RECORDS_API: process.env.ENABLE_TABLE_PLATFORM_RECORDS_API !== 'false',

    // Block B (Record Provenance): per-record confidence + validation_status.
    // Gate sits inside ConfidenceScoringService.recompute() and the
    // validation-status route, so partial deploys cannot crash record writes.
    ENABLE_RECORD_PROVENANCE: process.env.ENABLE_RECORD_PROVENANCE === 'true',

    // Block C (AI Operator): 8-level AI Editor on top of TableAiEditorService.
    // Enabled by default; set ENABLE_TABLE_AI_EDITOR=false to disable.
    ENABLE_TABLE_AI_EDITOR: process.env.ENABLE_TABLE_AI_EDITOR !== 'false',

    // Block C (Table QA Engine): deterministic 5-axis health scoring +
    // suggestion synthesis on top of TableQaService.
    // Enabled by default; set ENABLE_TABLE_QA_ENGINE=false to disable.
    ENABLE_TABLE_QA_ENGINE: process.env.ENABLE_TABLE_QA_ENGINE !== 'false',

    // Block C (Source Pack Builder): curator-driven bundle of records that the
    // AI Editor can later consume (`payload.sourcePackId`).
    // Enabled by default; set ENABLE_TABLE_SOURCE_PACK=false to disable.
    ENABLE_TABLE_SOURCE_PACK: process.env.ENABLE_TABLE_SOURCE_PACK !== 'false',

    // Block D (Table → Doc/Deck Conversion): bridges Tabele tables into
    // Document Studio v1 / DeckBuilder.
    // Enabled by default; set ENABLE_TABLE_ARTIFACT_CONVERSION=false to disable.
    ENABLE_TABLE_ARTIFACT_CONVERSION: process.env.ENABLE_TABLE_ARTIFACT_CONVERSION !== 'false',

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

    // Deliverables light runtime (DELIVERABLES_LIGHT_TARGET.md): unified async
    // generation contract /api/deliverables/generations. Opt-in; when off the
    // router answers 404 and the legacy presentation flow is untouched.
    ENABLE_DELIVERABLES_LIGHT: process.env.ENABLE_DELIVERABLES_LIGHT === 'true',

    // Teresa org-content retrieval (ff_teresaRetrieval): chat-side READ tools
    // (search_org_notes / search_insights / get_initiative) that let Teresa
    // locate notes, insights and initiatives the user references by topic.
    // Opt-in; when off the chat stream and persona prompt are untouched.
    ENABLE_TERESA_RETRIEVAL: process.env.ENABLE_TERESA_RETRIEVAL === 'true',

    // Teresa mind-map deliverable creation (ff_teresaMindmap / M06 Fala 2):
    // generate_deliverable(type:'mindmap') handler self-gate — mounts a real
    // my_ideas + my_idea_maps row via the SAME idea-workspace "new idea" path
    // as process_flow/table/whiteboard. Default ON (2026-07-06,
    // collab-enable-flags): end-to-end since the seedGraph fix landed;
    // mirrors ENABLE_TERESA_CANVAS_TOOLS / ENABLE_TERESA_NOTE_CREATE. Set to
    // 'false' to omit 'mindmap' from the enum.
    // NOTE: this same env var ALSO co-gates the separate, still opt-in
    // `search_org_mindmaps` RETRIEVAL tool (persona.ts / orgRetrievalShared.ts
    // / ai.routes.ts org-retrieval block) which stays default OFF — those
    // call sites read process.env directly and are intentionally untouched
    // here; that tool only activates when ENABLE_TERESA_RETRIEVAL is ALSO on.
    ENABLE_TERESA_MINDMAP: process.env.ENABLE_TERESA_MINDMAP !== 'false',

    // Deliverables A3: per-section streaming for documents. Generates section
    // by section (each call sees prior sections for coherence) and writes the
    // draft progressively, so the first section paints in ~3-4s instead of
    // waiting ~19s for the one-shot. Opt-in; OFF ⇒ proven one-shot path.
    ENABLE_DELIVERABLES_DOC_STREAMING: process.env.ENABLE_DELIVERABLES_DOC_STREAMING === 'true',

    // Deliverables W4 (series B — premium generative brain): when on, the
    // deliverable GENERATION step (deck layout director / doc structure / table
    // schema) routes to the PREMIUM model tier instead of STANDARD, and cost is
    // tagged with purpose='deliverable_generation' for telemetry. Opt-in,
    // default OFF (live clients stay on STANDARD until quality is proven).
    // Fail-open: any resolution error falls back to STANDARD, never blocks.
    ENABLE_DELIVERABLES_PREMIUM: process.env.ENABLE_DELIVERABLES_PREMIUM === 'true',

    // DP-3 (M06/M07/M09 Ideas): shared/canonical idea maps — one my_idea_maps
    // row per idea_id instead of one per user_id, with membership-gated
    // read/write and server-persisted WS graph_patch. Default ON (2026-07-06,
    // collab-enable-flags): the read/write paths already fall back safely to
    // legacy per-user behavior when the `is_canonical` column is absent
    // (selectCanonicalMapRow / sharedIdeaMapsActive guards). Set
    // ENABLE_SHARED_IDEA_MAPS=false to force the old per-user rollback path
    // (Harvard/wdrozenie-100/_M06_DP3_MULTIPLAYER_PLAN_2026-07-04.md).
    ENABLE_SHARED_IDEA_MAPS: process.env.ENABLE_SHARED_IDEA_MAPS !== 'false',

    // Teresa creates all idea-workspace canvas tools (M07 Process Flow · M08
    // Ideas Table · Whiteboard) via generate_deliverable, following the exact
    // ENABLE_TERESA_MINDMAP pattern: a real skeleton {nodes,edges} handed to
    // the FE, which mounts it on the SAME "new idea" path as mind-map — a real
    // my_ideas + my_idea_maps row (preferred_tool set) survives reload.
    // Default ON (2026-07-06, collab-enable-flags); set to 'false' to omit
    // process_flow/table/whiteboard from the enum. Mirror this default in
    // server/src/services/ai/mcpServer.ts (raw process.env read, same flag).
    ENABLE_TERESA_CANVAS_TOOLS: process.env.ENABLE_TERESA_CANVAS_TOOLS !== 'false',

    // Teresa creates a real notebook page (notebook_pages row) via
    // generate_deliverable(type:'note'). Reuses the canonical
    // notebookService.createNote path (same INSERT the "save as note" chat
    // action already uses). Default ON (2026-07-06, collab-enable-flags); set
    // to 'false' to omit 'note'. Mirror this default in
    // server/src/services/ai/mcpServer.ts (raw process.env read, same flag).
    ENABLE_TERESA_NOTE_CREATE: process.env.ENABLE_TERESA_NOTE_CREATE !== 'false',
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
