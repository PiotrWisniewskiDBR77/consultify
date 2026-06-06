# DEEP CONFIRM (short) — Modules 14 MCP/IRIS & 15 MCP/Marketplace

**Date:** 2026-06-03 | **Method:** code-verified, no builds | **Verdict: deferred status + shared DB-init/adapter defect CONFIRMED unchanged.**

## Deferred status (D7) — CONFIRMED
- **14 IRIS:** route `/mcp/iris` → `<Navigate to={ROUTES.AI_CHAT} replace />` (`AppRoutes.tsx:2099`). Sidebar removed (D7). Prior 22/100.
- **15 Marketplace:** route `/mcp/marketplace` → `<Navigate to={ROUTES.AI_CHAT} replace />` (`AppRoutes.tsx:2100`). Sidebar removed (D7). Prior 14/100.
- Both share the same backend (`mcp.routes.ts`, `mcpProviderClient.ts`, migration `603_mcp_providers_registry.sql`); the backend remains REAL and mounted but UI-dark. No change since COMPLETION_14/15. **Do not build for v1.**

## Shared structural defect — CONFIRMED (file:line)
1. **Tables missing from DatabaseInitializer (SQLite path).** `grep` for `mcp_providers | marketplace_imports | mcp_provider_allowlist | mcp_provider_tools_cache` in `server/src/database/DatabaseInitializer.ts` → **zero matches**. They exist only on the Postgres path: `PostgresDatabase.ts:1550` (`CREATE TABLE ... mcp_providers`), index at `:2975`. ⇒ On a fresh SQLite DB the tables never exist.
2. **Silent-failure guards.** `mcp.routes.ts:51` `tryGetColumns(table)` returns an empty `Set` when the table is absent; `getMarketplaceProvider` (`mcp.routes.ts:39`) then returns `null` → search/get 404, import returns **HTTP 503** at `mcp.routes.ts:508–515` (`tryGetColumns('marketplace_imports')` empty). No crash, no data — silent.
3. **`$1` vs `?` adapter mismatch.** `module-interest.routes.ts` uses PostgreSQL placeholders (`$1` — 6 occurrences) while `mcp.routes.ts` uses SQLite/better-sqlite3 placeholders (`?` — 69 occurrences). One of the two fails at runtime depending on the active adapter; with the SQLite path active, `module-interest.routes.ts` `$1` queries are the runtime hazard.

## Recommendation (unchanged)
Single shared **P0 (1 day):** add `mcp_providers`, `mcp_provider_allowlist`, `mcp_provider_tools_cache`, `marketplace_imports` to `DatabaseInitializer.ts`, and align `module-interest.routes.ts` placeholders to the active adapter. Everything else stays parked per D7 until un-park (~3–4 sprints post-v1 each). No new findings beyond the prior completion dossiers.
