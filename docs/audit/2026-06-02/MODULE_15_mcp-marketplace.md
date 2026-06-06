# Module 15 — MCP Marketplace — Readiness Scorecard

**Readiness: 14/100 — Tier: Alpha**
**Route(s):** `/mcp/marketplace` — publicly routed, sidebar-visible, badge `soon`; no feature flag or auth gate beyond normal app session
**One-line verdict:** The user-facing Marketplace surface is a polished coming-soon landing page only; real catalog/search/import API routes exist and are mounted but require a per-org DBR77 Marketplace MCP provider to be manually configured by an admin before any call will succeed, and no frontend UI drives those APIs.

## What's REAL (verified + backend-wired)

- `server/src/routes/mcp.routes.ts:60-75` — `GET /api/mcp/providers` (list org MCP providers from `mcp_providers` table, auth-gated)
- `server/src/routes/mcp.routes.ts:77-106` — `POST /api/mcp/providers` (add provider, admin-only)
- `server/src/routes/mcp.routes.ts:412-441` — `GET /api/mcp/marketplace/search` (proxies `marketplace.catalog.search` tool via configured MCP provider)
- `server/src/routes/mcp.routes.ts:443-471` — `GET /api/mcp/marketplace/assets/:assetId` (proxies `marketplace.asset.get`)
- `server/src/routes/mcp.routes.ts:473-585` — `POST /api/mcp/marketplace/assets/:assetId/import` (imports asset, writes to `marketplace_imports` + optionally `presentation_templates`)
- `server/src/services/mcp/mcpProviderClient.ts` — real JSON-RPC-over-HTTP client with audit logging to `mcp_audit_logs`; `makeMarketplaceHeaders` injects bearer token from provider config
- `server/migrations/603_mcp_providers_registry.sql` — `mcp_providers`, `mcp_provider_allowlist`, `mcp_provider_tools_cache` tables
- `server/migrations/608_marketplace_imports_v3.sql` — `marketplace_imports` table
- `server/src/Gateway.ts:509` — routes mounted at `/api/mcp`
- `src/components/settings/IntegrationSettings.tsx:754,1748` — admin MCP tab with "Marketplace" preset (fills `baseUrl`, `marketplace_token`); real CRUD wired to backend
- Module-interest waitlist: `POST /api/module-interest` + `GET /api/module-interest/my` — real DB write, backend-wired (`server/src/routes/module-interest.routes.ts`)
- KB seeded with marketplace articles via `server/migrations/748_marketplace_kb_import_v1.sql`

## What's MOCK / hardcoded / stub

- `src/views/V4ComingSoonView.tsx:136-182` — entire user-facing Marketplace UI is hardcoded marketing copy (800+ vendors claim, 50% faster sourcing, etc.) with an Unsplash stock photo; no live data
- `server/src/routes/mcp.routes.ts:365-407` — `GET /api/mcp/discovery` returns a hardcoded static list of 6 providers; no DB lookup
- `src/views/V4ComingSoonView.tsx:41` — `MARKETPLACE_LP_URL` hardcoded to `https://marketplace.dbr77.com/marketplace` (external, unverified)

## What's BROKEN / NO_GO / missing

- Zero frontend component connects to the real `/api/mcp/marketplace/*` endpoints — search, asset detail, and import are completely UI-dark
- `getMarketplaceProvider` (mcp.routes.ts:39-49) will return `null` for any org that hasn't manually added a `%marketplace%`-named provider via the admin settings tab — every API call returns 404 with no self-service path for non-admins
- `server/src/routes/mcp.routes.ts:508-515` — import endpoint silently returns HTTP 503 if `marketplace_imports` table is missing (no migration guarantee check at startup)
- `module-interest.routes.ts:48` uses PostgreSQL placeholder `$1` but `mcp.routes.ts` uses SQLite `?` — parameter syntax mismatch suggests mixed DB assumptions; runtime behavior depends on which adapter is active
- No route guard or feature flag on `/mcp/marketplace`; any authenticated user can navigate there and see the coming-soon page, but also directly call the import API if they know the URL (import endpoint only requires `verifyAdmin`, search/get only require `isAuthenticated`)

## Backend wiring

Real: MCP provider CRUD, marketplace proxy (search/get/import), audit logs, KB seed. All gated behind a prerequisite: an admin must first configure a marketplace MCP provider with a valid `baseUrl` and `marketplace_token`. Without that row in `mcp_providers`, all marketplace API calls fail with 404. No UI wizard, no onboarding flow.

## UI/UX consistency

`V4ComingSoonView` uses the global design system (Tailwind, framer-motion, dark-mode tokens) and is visually consistent with other modules. Admin MCP tab in `IntegrationSettings` is also standard shell. The gap is that no marketplace-specific browse/search/import UI exists at all — the gap between the coming-soon page and the working API is not surfaced to any user.

## Tests

No dedicated unit or integration tests for the marketplace API routes or the MCP provider client. The only test touching "marketplace" is `EntryFooter.cta-authority.test.tsx:31` (checks the external LP link) and `ai-chat-artifact-contract.test.ts` (incidental mention in fixture data). MCP provider client (`mcpProviderClient.ts`) has zero test coverage.

## Doc-vs-code drift

Docs (last updated 2026-05-09) accurately classify the module as `stub + planned` and note `V4ComingSoonView` on the route. They do not mention the real backend API surface (`/api/mcp/marketplace/*`, `mcpProviderClient`, migrations 603/608/748) which exists and is mounted — a meaningful omission. CODEMAP says "no dedicated mounted marketplace runtime component" which is correct for the frontend but misleads about the backend.

## Top gaps to reach market-ready (prioritized)

1. Build a frontend browse/search UI at `/mcp/marketplace` that calls `GET /api/mcp/marketplace/search` and renders results — this is the entire missing product layer
2. Add a self-service provider-setup flow (or a default system-level Marketplace provider) so the search endpoints work without manual admin DB configuration
3. Resolve DB adapter inconsistency — `module-interest.routes.ts` uses `$1` (PostgreSQL) while `mcp.routes.ts` uses `?` (SQLite/better-sqlite3); one will fail at runtime depending on the active DB
4. Add a feature flag or pilot-access gate on the import endpoint (`POST /api/mcp/marketplace/assets/:assetId/import`) before any vendor data flows into production orgs
5. Write integration tests for `mcpProviderClient` and the marketplace proxy routes (search, get, import), including the 404 path when no provider is configured
