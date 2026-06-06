# Module 14 — MCP IRIS — Readiness Scorecard

**Readiness: 22/100 — Tier: Alpha**
**Route(s):** `/mcp/iris` — visible in sidebar (badge: "soon"), renders `V4ComingSoonView` (marketing placeholder only). Backend API at `/api/mcp/*` is real and mounted, but not connected to this route or any IRIS-specific UI. Admin-only configuration lives in Settings > Integrations > MCP tab.
**One-line verdict:** The IRIS-branded entry point is a marketing placeholder; the generic MCP provider infrastructure underneath it is genuinely implemented and schema-backed, but the IRIS-specific UI, live data panel, and KPI/workorder read surface do not exist.

## What's REAL (verified + backend-wired)

- `server/src/services/mcp/mcpProviderClient.ts:53` — `parseStreamableHttpConfig`, `listRemoteTools`, `callRemoteTool`: real JSON-RPC-over-HTTP client with audit logging to `mcp_audit_logs`.
- `server/src/services/mcp/mcpProviderClient.ts:180` — `makeIrisHeaders`: injects `Authorization: Bearer <token>` and `X-Factory-Id` for IRIS providers; invoked by route when provider name contains "iris" (`mcp.routes.ts:313`).
- `server/src/routes/mcp.routes.ts` — Full CRUD for `mcp_providers`, allowlist management, provider test/cache, tool call endpoint, audit log read, marketplace search/import. Mounted unconditionally at `/api/mcp` via `Gateway.ts:509`.
- `server/migrations/603_mcp_providers_registry.sql` — `mcp_providers`, `mcp_provider_allowlist`, `mcp_provider_tools_cache` tables defined and indexed.
- `server/migrations/105_user_integrations.sql:132` — `mcp_audit_logs` table.
- `src/components/settings/IntegrationSettings.tsx:373` — `fetchMcpProviders` makes real API calls; admin UI for add/edit/test/delete MCP providers with "Add IRIS preset" button that pre-fills baseUrl `https://iris.dbr77.com`.
- `tests/integration/routes/mcp.l3.test.ts` — 9 L3 integration tests covering `/providers` and `/context` against a real SQLite DB.

## What's MOCK / hardcoded / stub

- `src/views/V4ComingSoonView.tsx:89` — The `/mcp/iris` route renders a static marketing page (Polish-language copy, hardcoded feature list, Unsplash image, link to `https://iris.dbr77.com`). No live data, no provider connection.
- `server/src/routes/mcp.routes.ts:368` — `/api/mcp/discovery` returns a hardcoded JSON list of provider presets (IRIS, Marketplace, GitHub, Slack, etc.). Not dynamically fetched from any registry.
- `V4ComingSoonView.tsx:405` — Only real API call is `POST /module-interest` (waitlist sign-up), not IRIS data.

## What's BROKEN / NO_GO / missing

- No dedicated IRIS runtime panel exists anywhere in the frontend. `IRIS_RUNTIME_TARGET` is documented as "planned, not mounted" (CODEMAP.md:29).
- `mcp_providers` table is NOT created in `DatabaseInitializer.ts` (SQLite path); it exists only in `PostgresDatabase.ts:1550` and `migrations/603_mcp_providers_registry.sql`. The routes use `tryGetColumns` guards that silently return `[]` when the table is absent — meaning the entire provider CRUD silently fails on a fresh SQLite dev/test DB unless migrations run.
- `marketplace_imports` table has the same gap — guarded with `tryGetColumns` at `mcp.routes.ts:509`, returns 503 when missing.
- IRIS-specific tool-call coverage is absent from tests: `makeIrisHeaders` path (provider name contains "iris") has zero test coverage in `mcp.l3.test.ts`.
- `pilotAccess.ts:69` — `MCP_IRIS` is explicitly locked for the pilot session, redirecting to `/interview`.

## Backend wiring

The generic MCP provider infrastructure is real: HTTP client, DB tables, audit log, allowlist enforcement, and admin settings UI are all wired. The IRIS-specific layer is limited to `makeIrisHeaders` (token + factory-id injection) triggered by provider name heuristic. There is no IRIS-domain schema (KPI tables, workorders, OEE), no server-side IRIS query service, and no frontend panel that consumes IRIS tool output.

## UI/UX consistency

The `/mcp/iris` route uses the shared `MainLayout` + `AnimationWrapper` shell, consistent with other modules. `V4ComingSoonView` is a module-shared coming-soon component reused across 6 modules — consistent with the "wkrótce" pattern. The admin MCP tab in Settings uses app-standard components. No bespoke IRIS shell exists yet to assess.

## Tests

- `tests/integration/routes/mcp.l3.test.ts` — 9 tests covering provider list, context, and table-missing fallbacks. No coverage of: provider create/update/delete, allowlist, tool-call, IRIS header injection, marketplace routes, or audit endpoint.

## Doc-vs-code drift

Docs accurately describe the as-is state: stub placeholder on the route, generic MCP infrastructure in the backend. The CODEMAP `IRIS_RUNTIME_TARGET` and PURPOSE's "pobierać dane produkcyjne na żywo" are forward-looking targets — not implemented. No drift between docs and code for what is claimed as "as-is."

## Top gaps to reach market-ready (prioritized)

1. **Build the IRIS runtime panel** — replace `V4ComingSoonView` at `/mcp/iris` with a real component: connect to a configured IRIS provider, call `tools/list`, render tool results (KPI, OEE, workorders) in a structured layout.
2. **Fix DB table availability on SQLite path** — add `mcp_providers`, `mcp_provider_allowlist`, `mcp_provider_tools_cache`, `marketplace_imports` to `DatabaseInitializer.ts` so the routes work without relying on silent `tryGetColumns` fallbacks.
3. **IRIS-specific tool schema and display** — define the IRIS MCP tool contract (iris.kpi.get, iris.workorder.list, etc.) and build typed frontend consumers.
4. **Expand test coverage** — CRUD, allowlist enforcement, IRIS header path, marketplace routes, audit endpoint.
5. **Unlock from pilot gating** — remove `MCP_IRIS` from `pilotAccess.ts` allowlist block when the real panel ships.
