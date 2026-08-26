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
  // Krok C (rozdział flagi-długu): funkcja B (retrieval search_org_mindmaps)
  // wydzielona z ENABLE_TERESA_MINDMAP na WŁASNĄ flagę. Default OFF. Realne
  // gate'y czytają ten env per-call przez wspólny helper
  // `isTeresaMindmapSearchEnabled()` (orgRetrievalShared.ts) — OR'owany z
  // legacy ENABLE_TERESA_MINDMAP dla wstecznej kompatybilności (patrz
  // komentarz przy ENABLE_TERESA_MINDMAP niżej). To pole w schemacie jest
  // dokumentacyjne/SSOT; nie jest czytane z cache'owanego `featureFlags`
  // singletonu przez te gate'y (ten sam wzorzec co ENABLE_TERESA_RETRIEVAL).
  ENABLE_TERESA_MINDMAP_SEARCH: z.boolean().default(false),
  ENABLE_DELIVERABLES_DOC_STREAMING: z.boolean().default(false),
  ENABLE_DELIVERABLES_PREMIUM: z.boolean().default(false),
  ENABLE_DECK_CONCLUSION_SLIDE: z.boolean().default(false),
  ENABLE_SHARED_IDEA_MAPS: z.boolean().default(true),
  ENABLE_TERESA_CANVAS_TOOLS: z.boolean().default(true),
  ENABLE_TERESA_NOTE_CREATE: z.boolean().default(true),
  ENABLE_TERESA_RECORD_CREATE: z.boolean().default(true),
  // Z4 transport (fala „Teresa steruje Ideą przez rejestr"): pozwala frontowi
  // dołożyć do zapytania czatu manifest akcji OTWARTEJ reprezentacji Idei
  // (src/actions/teresaActionManifest.ts). Model widzi je jako narzędzia; ich
  // wywołanie NIE wykonuje się na serwerze (nie ma dostępu do płótna w
  // przeglądarce) — wraca SSE `idea_action`, a front wykonuje je przez
  // executeTeresaTool() (ta sama ścieżka, co klik człowieka). Default ON;
  // jawne `false` pozostaje bezpiecznym kill-switchem do legacy fallbacku.
  ENABLE_TERESA_IDEA_ACTIONS: z.boolean().default(true),
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
    // Krok C UPDATE (rozdział flagi-długu, 2026-07): the separate, still
    // opt-in `search_org_mindmaps` RETRIEVAL tool (persona.ts /
    // orgRetrievalShared.ts / ai.routes.ts / searchOrgMindmaps.ts) now has its
    // OWN flag, ENABLE_TERESA_MINDMAP_SEARCH (default OFF, see above) — read
    // through the shared `isTeresaMindmapSearchEnabled()` helper instead of
    // this one. That helper ORs the new flag with THIS one for backward
    // compat: any environment that relied on ENABLE_TERESA_MINDMAP=true as the
    // sole switch for retrieval keeps working unchanged. This flag alone still
    // governs Function A below (deliverable bridge) exactly as before.
    ENABLE_TERESA_MINDMAP: process.env.ENABLE_TERESA_MINDMAP !== 'false',

    // Krok C: dedicated flag for the search_org_mindmaps RETRIEVAL tool —
    // default OFF. Actual gates read `isTeresaMindmapSearchEnabled()`
    // (orgRetrievalShared.ts), not this cached singleton, so env changes in
    // tests apply without re-importing; this entry is the SSOT/documentation.
    ENABLE_TERESA_MINDMAP_SEARCH: process.env.ENABLE_TERESA_MINDMAP_SEARCH === 'true',

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

    // Oxford O2.5 — Deck CONCLUSION LAYER slide: appends a grounded K1→K4
    // "Wnioski" slide (werdykt→dlaczego→co robić→horyzont) to a generated deck,
    // per docs/standards/CONCLUSION_LAYER_STANDARD.md §W5. Additive (never
    // reshapes existing slides) + fail-safe (deterministic grounded fallback
    // when the LLM elevation fails). Opt-in, default OFF until owner accept.
    // NOTE: presentationGeneratorService.generateDeck reads process.env directly
    // at CALL time (not this singleton) so the gate reflects late env changes in
    // background generation; this registry entry is the SSOT/documentation.
    ENABLE_DECK_CONCLUSION_SLIDE: process.env.ENABLE_DECK_CONCLUSION_SLIDE === 'true',

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

    // Teresa routing-N (naprawa-rN-routing): "stwórz zadanie/decyzję" become real
    // N-objects (a `tasks` / `decisions` row) via the create_task / create_decision
    // MCP tools — NOT a document. Reuses the live-proven, column-defensive INSERTs
    // (TaskExecutor / the decisions INSERT the AI_TOOLS path already used). The
    // handler emits a `deliverable` event so the FE navigates to My Work
    // (Tasks / Decisions). Default ON; set to 'false' to omit both tools.
    ENABLE_TERESA_RECORD_CREATE: process.env.ENABLE_TERESA_RECORD_CREATE !== 'false',

    // Z4 transport dla akcji otwartej Idei — default ON, jawne `false` jest
    // rollbackiem do lokalnych detektorów bez dwóch aktywnych executorów naraz.
    ENABLE_TERESA_IDEA_ACTIONS: process.env.ENABLE_TERESA_IDEA_ACTIONS !== 'false',
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
