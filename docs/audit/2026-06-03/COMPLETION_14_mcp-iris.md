# Module 14 — MCP IRIS — Completion Dossier

**Status: DEFERRED (Decision D7) — do not build for v1 GA**
**Prior score: 22/100 — Tier: Alpha**
**Date: 2026-06-03**

---

## 1. Purpose / Goal / Vision

IRIS (DBR77 Industrial Runtime Intelligence System) is DBR77's plant operating system — 19 modules covering KPI, OEE, workorders, and AI-assisted production ops. The MCP (Model Context Protocol) module is the **controlled integration bridge** between Consultify and IRIS: it exposes IRIS tool calls (read-first: KPI reads, evidence pulls, workorder lists) through an audited, allowlisted transport layer.

Strategic relevance: IRIS is also the natural integration point for **DBR77 Vector** (proprietary industrial LLM, decision D-Vector). When Vector goes live, IRIS tools become the grounding corpus — Consultify's Teresa would call `iris.kpi.get` / `iris.workorder.list` via the MCP protocol, with Vector as the reasoning backbone. This makes the backend MCP plumbing valuable to preserve even while the module is hidden.

Source: `docs/modules/14_mcp-iris/01_PURPOSE.md`, `src/utils/teresaVoiceInstruction.ts:107–108`.

---

## 2. Current State (as-is, code-verified)

**Route:** `/mcp/iris` — redirects to `/chat` (`AppRoutes.tsx:2099`). Removed from sidebar nav per D7 (`menuConfig.ts:157`). Pilot-gated at `pilotAccess.ts:69`.

**Backend — REAL and wired:**
- `server/src/services/mcp/mcpProviderClient.ts` — JSON-RPC-over-HTTP client: `listRemoteTools`, `callRemoteTool`, `parseStreamableHttpConfig`, plus `makeIrisHeaders` (injects `Authorization: Bearer` + `X-Factory-Id` for IRIS providers) triggered by provider name heuristic (`mcp.routes.ts:315`).
- `server/src/routes/mcp.routes.ts` — Full CRUD for `mcp_providers`, allowlist, health/test, tool-call, audit log, marketplace search/import. Mounted unconditionally at `/api/mcp` via `Gateway.ts:509`.
- DB schema: `server/migrations/603_mcp_providers_registry.sql` — `mcp_providers`, `mcp_provider_allowlist`, `mcp_provider_tools_cache`.
- `src/components/settings/IntegrationSettings.tsx:373` — admin UI: add/edit/test/delete providers, "Add IRIS preset" button pre-fills `https://iris.dbr77.com`.
- 9 L3 integration tests: `tests/integration/routes/mcp.l3.test.ts`.

**Frontend — stub/placeholder:**
- `V4ComingSoonView` previously rendered at `/mcp/iris`; now the route is a redirect (no marketing placeholder either).
- No IRIS runtime panel exists. `IRIS_RUNTIME_TARGET` documented as "planned, not mounted" (`docs/modules/14_mcp-iris/CODEMAP.md:29`).

**Known structural defect:** `mcp_providers` table missing from `DatabaseInitializer.ts` (SQLite path); only in `PostgresDatabase.ts:1550`. Routes use `tryGetColumns` guards that silently return `[]` on fresh SQLite — entire provider CRUD fails silently without migrations. Same gap for `marketplace_imports`.

---

## 3. Teresa Integration (intended)

Teresa's voice instruction explicitly names IRIS as DBR77 ecosystem product #3 (`teresaVoiceInstruction.ts:108`) but there is **no live tool wiring**. The intended architecture (not yet implemented):

1. User asks Teresa about factory KPIs or a workorder.
2. Teresa calls the MCP tool-call endpoint (`POST /api/mcp/providers/:id/tools/call`).
3. Backend routes call through `mcpProviderClient.ts` → IRIS `https://iris.dbr77.com/mcp`.
4. IRIS responds with structured tool output; Teresa surfaces it in chat.

No Teresa → MCP bridge code exists yet. Teresa currently has no tool-use hooks of any kind — that wiring requires Phase 2 chat tooling + MCP provider selection logic.

---

## 4. System Integration Points

| System | Status |
|---|---|
| DBR77 Vector | Intended backend for IRIS tool reasoning; no Consultify integration yet |
| Teresa (Module 01 Chat) | Planned tool consumer; no bridge code |
| Settings > Integrations | Admin MCP tab wired and real (`IntegrationSettings.tsx:373`) |
| Admin > AI Mission Control | References MCP health but no IRIS-specific panel |
| Pilot gating | `pilotAccess.ts:69` blocks `MCP_IRIS` — redirects to `/interview` |
| Sidebar nav | Removed from menu (`menuConfig.ts:157` comment confirms D7) |

---

## 5. Completion Plan (when un-parked — DO NOT BUILD for v1)

Estimated effort from 22 → 100: **~3–4 sprints post-v1**.

### P0 — DB fix (1 day, do now or on un-park)
- Add `mcp_providers`, `mcp_provider_allowlist`, `mcp_provider_tools_cache`, `marketplace_imports` to `DatabaseInitializer.ts` so SQLite path works without silent failures.
- File: `server/src/database/DatabaseInitializer.ts`.

### P1 — IRIS Runtime Panel (1 sprint)
- Replace redirect at `AppRoutes.tsx:2099` with real component.
- Build `IrisRuntimePanel` component: connect to configured IRIS provider, call `tools/list`, render tool results (KPI cards, OEE gauge, workorder table) using app-standard shell.
- Remove `MCP_IRIS` from `pilotAccess.ts:69` block.
- Files to create: `src/components/IRIS/IrisRuntimePanel.tsx`, `src/views/IRISView.tsx`.

### P2 — IRIS Tool Contract (0.5 sprint)
- Define typed IRIS tool schema: `iris.kpi.get`, `iris.workorder.list`, `iris.oee.summary`.
- Add typed frontend consumers matching IRIS MCP server contract.
- Add `makeIrisHeaders` test coverage to `mcp.l3.test.ts`.

### P3 — Teresa → MCP Bridge (1 sprint, depends on Teresa Phase 2)
- Implement tool-use hook in Teresa's AI handler: detect IRIS-scoped intent, resolve active IRIS provider, invoke `POST /api/mcp/providers/:id/tools/call`, stream result back into chat.
- Requires Teresa Phase 2 (tool-use infrastructure) to land first.

### P4 — Test coverage (0.5 sprint)
- Provider CRUD, allowlist enforcement, IRIS header path, marketplace routes, audit endpoint.
- Currently: 9 tests covering only `providers/list` and `context`; `makeIrisHeaders` path has zero coverage.

### P5 — Unlock nav + re-add to sidebar
- Re-enable `MCP_IRIS` in `menuConfig.ts` with appropriate access guard (org has IRIS integration configured).

---

## Decision Record

**D7** (`docs/plans/CONSULTIFY_PRODUCT_DECISIONS_2026-06-02.md:22`): "chowamy całkowicie z produktu na ten moment, rozwój później" — hide completely, keep backend code (it's real and will be needed). NOT "coming soon" in UI.

Backend MCP infrastructure is worth preserving as-is. The DB initialization fix (P0) is the only item worth doing before un-park — it costs 1 day and prevents silent data loss if any admin accidentally reaches the MCP settings tab.
