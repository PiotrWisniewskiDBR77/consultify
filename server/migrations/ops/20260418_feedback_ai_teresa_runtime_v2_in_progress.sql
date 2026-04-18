-- Feedback cluster: ai-teresa-runtime second pass (2 items)
--
-- Items resolved in commit 8da124ad8:
--   #a9fcdd99 MEDIUM — Chat suggestion "5 pomysłów na produkty" replied
--                       with "Circuit [openrouter] is OPEN. Retry in 18s"
--   #3b6c0287 HIGH   — AI unavailable from VTS HQ "wspólne" list (both
--                       right-hand assistant panel and left-hand Teresa
--                       chat panel rendered nothing / raw error).
--
-- Root cause (single bug, two user symptoms):
--   `llmService.callStream` + `callWithToolsStream` threw a plain
--   `new Error(circuitCheck.reason)` when the provider circuit breaker
--   refused execution (no `code`, no `isCircuitOpen` flag). `AIPipeline.
--   handleError` then collapsed it to `{ code: 'AI_ERROR', message }`,
--   the SSE route forwarded `code: 'AI_ERROR'`, and the frontend SSE
--   parser only mapped a short allow-list of codes to friendly copy —
--   everything else fell through to `String(data.error)` and dumped the
--   raw diagnostic directly into the chat bubble.
--
--   The VTS HQ symptom was the same outage viewed from a different entry
--   point: with all fallback-chain models routed through OpenRouter
--   (TIER_FALLBACK_CHAINS entries are all `openai/…` / `anthropic/…`
--   namespaced OpenRouter IDs), an OpenRouter circuit-open state takes
--   the entire AI stack offline for that session and both chat panels
--   opened from VTS HQ surface the same broken response.
--
-- Fix:
--   - llmService now throws tagged errors with code=CIRCUIT_OPEN,
--     isCircuitOpen=true, breakerName=<provider>, circuitState.
--   - AIPipeline.handleError preserves the underlying error's code (and
--     infers CIRCUIT_OPEN / INVALID_API_KEY / RATE_LIMIT from the
--     message as a safety net for older call sites).
--   - Frontend maps CIRCUIT_OPEN to a localized message with the
--     remaining cooldown extracted from the reason text, maps the legacy
--     AI_ERROR code, and ships a generic friendly fallback so the raw
--     backend string can never reach the chat bubble again.
--
-- Follow-up (not in this commit): the fallback chain is OpenRouter-only
-- (`TIER_FALLBACK_CHAINS` in `modelRouter.ts`). When the OpenRouter
-- circuit is open, every candidate hits the same open circuit and there
-- is no cross-provider rescue even if `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`
-- are configured. Tracking separately — for this sprint we fix the UX
-- leak and keep the auto-recovery probes handling the real outage.
--
-- Audit commit: 8da124ad8
-- Staging deploy: pending (Railway auto-deploy on push to develop)

BEGIN;

UPDATE feedback_items
   SET status = 'IN_PROGRESS',
       updated_at = NOW(),
       metadata_json = (
           COALESCE(metadata_json::jsonb, '{}'::jsonb)
           || jsonb_build_object(
                'in_progress_at', NOW()::text,
                'commit_sha', '8da124ad8',
                'root_cause',
                  CASE substring(id::text, 1, 8)
                    WHEN 'a9fcdd99' THEN 'llmService threw an un-coded Error when the provider circuit breaker was open; AIPipeline.handleError collapsed it to AI_ERROR; the frontend SSE handler only had friendly copy for a short allow-list of codes and fell through to String(data.error), leaking "Circuit [openrouter] is OPEN. Retry in 18s" into the chat bubble.'
                    WHEN '3b6c0287' THEN 'Same circuit-open leak as #a9fcdd99, triggered from the VTS HQ "wspólne" entry point. Because the entire tier-fallback chain routes through OpenRouter, an OpenRouter circuit-open state knocked out both the right-hand assistant panel and the left-hand Teresa chat window simultaneously.'
                    ELSE NULL
                  END,
                'fix_summary',
                  'Tag circuit-breaker errors with code=CIRCUIT_OPEN and preserve that code through AIPipeline; add a CIRCUIT_OPEN branch (with a cooldown-aware message) plus a safe generic fallback in the frontend SSE handler so raw backend diagnostics can never surface in the chat bubble.',
                'files',
                jsonb_build_array(
                  'server/src/services/ai/llmService.ts',
                  'server/src/services/ai/AIPipeline.ts',
                  'src/services/api.ts'
                ),
                'timeline_entry',
                jsonb_build_object(
                  'at', NOW()::text,
                  'by', 'system',
                  'type', 'progress',
                  'note',
                  'Cluster fix landed in 8da124ad8. Circuit-breaker errors now carry a CIRCUIT_OPEN code from llmService through AIPipeline.handleError, and the frontend renders a localized message with the remaining cooldown ("Spróbuj ponownie za 18 s lub wybierz inny model") instead of the raw engineering text. A generic friendly fallback now protects against any future unmapped error codes, and the cross-provider fallback gap in modelRouter (OpenRouter-only chain) is captured as a follow-up.'
                )
              )
       )::text
 WHERE substring(id::text, 1, 8) IN (
   'a9fcdd99', '3b6c0287'
 );

COMMIT;
