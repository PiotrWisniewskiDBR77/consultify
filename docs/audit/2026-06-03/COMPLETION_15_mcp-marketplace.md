# Module 15 — MCP Marketplace — Completion Dossier

**Status: DEFERRED (Decision D7) — do not build for v1 GA**
**Prior score: 14/100 — Tier: Alpha**
**Date: 2026-06-03**

---

## 1. Purpose / Goal / Vision

DBR77 Marketplace is a governed asset catalog: users discover, preview, and **import** templates, playbooks, prompts, and presentation components published by DBR77 and third-party vendors. The module proxies calls to an external MCP Marketplace provider (`marketplace.dbr77.com`) — search catalog → fetch asset detail → one-click import into Consultify objects (presentation templates, tools). License/provenance metadata travels with the import; every install is audit-logged.

Strategic relevance: this is the monetisation and ecosystem flywheel. Once the DBR77 Marketplace external service exists and vendors publish assets, Consultify users get live supply without Consultify owning the catalog infrastructure.

Source: `docs/modules/15_mcp-marketplace/01_PURPOSE.md`, `docs/product/INTEGRATIONS_SYNC_MCP_PLAN_V3.md`.

---

## 2. Current State (code-verified)

**Route:** `/mcp/marketplace` — redirects to `/chat` (`AppRoutes.tsx:2100`). Removed from sidebar nav per D7 (`menuConfig.ts:157`). Previously rendered `V4ComingSoonView` (marketing placeholder); that surface is now route-dead.

**Backend — REAL and mounted:**
- `server/src/routes/mcp.routes.ts:412-441` — `GET /api/mcp/marketplace/search` proxies `marketplace.catalog.search` tool via configured provider.
- `server/src/routes/mcp.routes.ts:443-471` — `GET /api/mcp/marketplace/assets/:assetId` proxies `marketplace.asset.get`.
- `server/src/routes/mcp.routes.ts:473-585` — `POST /api/mcp/marketplace/assets/:assetId/import` writes to `marketplace_imports` + optionally `presentation_templates`.
- `server/src/routes/mcp.routes.ts:365-407` — `GET /api/mcp/discovery` returns hardcoded 6-provider list (IRIS, Marketplace, GitHub, Slack, etc.) — no DB lookup.
- `server/src/services/mcp/mcpProviderClient.ts` — JSON-RPC-over-HTTP client; `makeMarketplaceHeaders` injects bearer token from provider config row.
- DB: `server/migrations/603_mcp_providers_registry.sql` (`mcp_providers`), `server/migrations/608_marketplace_imports_v3.sql` (`marketplace_imports`), `server/migrations/748_marketplace_kb_import_v1.sql` (KB seed articles).
- Admin UI: `src/components/settings/IntegrationSettings.tsx:754,1748` — "Marketplace" MCP preset; real CRUD to backend.

**Frontend — zero marketplace UI:**
- No component calls `/api/mcp/marketplace/*`. Browse/search/import are completely UI-dark.
- `V4ComingSoonView.tsx:41` contained `MARKETPLACE_LP_URL = 'https://marketplace.dbr77.com/marketplace'` (external, unverified); now that view is not mounted on this route.

**Structural defects (inherited from Module 14):**
- `mcp_providers` and `marketplace_imports` tables absent from `DatabaseInitializer.ts` (SQLite path only in `PostgresDatabase.ts:1550`); routes use `tryGetColumns` guards — silent `[]` returns on fresh SQLite, import endpoint returns HTTP 503 (`mcp.routes.ts:508-515`).
- `getMarketplaceProvider` (`mcp.routes.ts:39-49`) returns `null` for any org without a `%marketplace%`-named provider row — all API calls fail 404 with no self-service path.
- DB parameter mismatch: `module-interest.routes.ts` uses `$1` (PostgreSQL), `mcp.routes.ts` uses `?` (SQLite/better-sqlite3); one fails at runtime depending on active adapter.
- Import endpoint lacks a feature flag — any authenticated user who knows the URL can trigger vendor data import (search/get require `isAuthenticated` only; import requires `verifyAdmin`).

**Tests:** Zero marketplace-specific tests. `mcpProviderClient.ts` has zero coverage. Two incidental references: `EntryFooter.cta-authority.test.tsx:31` (checks LP link) and `ai-chat-artifact-contract.test.ts` (fixture mention).

---

## 3. Teresa Integration (intended)

Not wired. The intended flow: user asks Teresa to find a template → Teresa detects marketplace intent → calls `GET /api/mcp/marketplace/search` → streams catalog results into chat → user picks asset → Teresa invokes import endpoint. No Teresa tool-use hooks exist yet (Phase 2 chat tooling prerequisite). Teresa voice instruction does not reference Marketplace explicitly.

---

## 4. System Integration Points

| System | Status |
|---|---|
| DBR77 Marketplace (external) | Backend proxy exists; external service existence unverified |
| Teresa (Module 01 Chat) | Planned catalog search surface; no bridge code |
| Settings > Integrations | Admin MCP tab wired (`IntegrationSettings.tsx:754,1748`) |
| Presentation Templates (Module 12) | Import endpoint can write to `presentation_templates` — code path real but untested |
| Module 14 MCP IRIS | Shares entire backend (`mcp.routes.ts`, `mcpProviderClient.ts`, DB migrations) |
| Sidebar nav | Removed (`menuConfig.ts:157` comment: "removed per decision") |
| Pilot gating | No explicit `pilotAccess` guard; route redirect is the only barrier |

---

## 5. Completion Plan (when un-parked — DO NOT BUILD for v1)

Estimated effort from 14 → 100: **~3–4 sprints post-v1** (heavier than IRIS due to zero frontend).

### P0 — Shared DB fix (1 day, same as IRIS P0 — do once)
- Add `mcp_providers`, `marketplace_imports` to `DatabaseInitializer.ts`.
- File: `server/src/database/DatabaseInitializer.ts`.

### P1 — Default system-level provider (0.5 sprint)
- Add a seeded default Marketplace provider row (or a config-env fallback) so search endpoints work without manual admin DB row. Currently every call returns 404 without it.
- File: `server/src/routes/mcp.routes.ts:39-49` (`getMarketplaceProvider`).

### P2 — Marketplace Browse UI (1.5 sprints)
- Replace redirect at `AppRoutes.tsx:2100` with real component.
- Build `MarketplaceBrowseView`: search bar → calls `GET /api/mcp/marketplace/search`, grid of asset cards, asset detail drawer, "Import" CTA calling import endpoint with confirm dialog.
- Files to create: `src/views/MarketplaceView.tsx`, `src/components/Marketplace/AssetCard.tsx`, `src/components/Marketplace/AssetDetailDrawer.tsx`.
- Reuse app-standard shell (ModuleNavBar, hub grid patterns).

### P3 — Import guard + feature flag (0.5 sprint)
- Wrap import endpoint with pilot-access gate before any vendor data flows to production orgs.
- File: `src/utils/pilotAccess.ts` (add `MCP_MARKETPLACE`), `server/src/routes/mcp.routes.ts:473`.

### P4 — Fix DB adapter mismatch (0.5 sprint)
- Audit `module-interest.routes.ts` vs `mcp.routes.ts` parameter syntax; align to single adapter.
- File: `server/src/routes/module-interest.routes.ts:48`.

### P5 — Teresa → Marketplace Bridge (1 sprint, depends on Teresa Phase 2)
- Tool-use hook: marketplace search intent → `GET /api/mcp/marketplace/search` → asset cards in chat.
- Requires Teresa Phase 2 tool infrastructure.

### P6 — Test coverage (0.5 sprint)
- Integration tests: `mcpProviderClient` (search/get/import paths), 404 when no provider configured, 503 on missing table, import writes to `presentation_templates`.
- File: `tests/integration/routes/mcp.l3.test.ts` (extend existing fixture).

---

## Decision Record

**D7** (`docs/plans/CONSULTIFY_PRODUCT_DECISIONS_2026-06-02.md:22`): "chowamy całkowicie z produktu na ten moment, rozwój później" — hide completely from product, develop later. Route now redirects to `/chat`; sidebar entry removed. Backend MCP infrastructure is preserved and shared with Module 14 IRIS.

The P0 DB fix is the only pre-un-park item: it costs 1 day, is shared with Module 14, and prevents silent failures if an admin reaches the MCP settings tab. External dependency (DBR77 Marketplace service must exist and publish assets) is the real gating constraint for full activation.
