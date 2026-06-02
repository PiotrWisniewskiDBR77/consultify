# Module 16 — Organizacja — Readiness Scorecard

**Readiness: 68/100 — Tier: Beta**
**Route(s):** `/organization/*` (canonical), `/context/*` (legacy compatibility)
**One-line verdict:** Core org profile, context engine, and knowledge graph are genuinely backend-wired and functional, but admin sub-sections are shallow redirect stubs, OrganizationV8CanonPanel is a static marketing panel with no live data, and the invitation route is disabled in production via `mountStub`.

## What's REAL (verified + backend-wired)

- `server/src/services/organizationContext/OrganizationContextService.ts:698–1636` — Full claim-based context engine: `recordContextSource`, `buildResolvedContext`, `rebuildSnapshot`, `listTimeline`, `listClaims` — all writing to real SQLite tables (`organization_context_items`, `organization_context_claims`, `organization_context_snapshots`).
- `server/src/routes/organization-context.routes.ts` — Mounted at `GET/POST /api/organization-context` in Gateway:660; endpoints `/`, `/timeline`, `/claims`, `/rebuild` all wired.
- `server/src/routes/knowledge-graph.routes.ts` — Mounted at `/api/knowledge-graph` (Gateway:606); search, traverse, provenance, governance, freshness — all implemented via `unifiedKGService`.
- `src/components/Organization/KnowledgeGraphExplorer.tsx:155–243` — Full React Flow graph UI calling `Api.kgGetStats`, `kgSearchEntities`, `kgGetEntityRelations`, `kgTraverse`, `kgGetProvenance` — all API methods exist in `src/services/api.ts`.
- `src/components/settings/OrganizationContextOverview.tsx` — Renders live context counts, timeline, claims from `/api/organization-context/*`; mounted inside `OrganizationView` for every section.
- `server/src/services/organizationService.ts` + `organizationIdentityService.ts` — Member management, canonical name uniqueness; tested at `server/src/controllers/__tests__/OrganizationController.membership.test.ts`.
- `server/src/routes/organization/organizations.routes.ts`, `approved-domains.routes.ts`, `ownership.routes.ts`, `rbac.routes.ts`, `teams.routes.ts` — All imported and mounted in Gateway:655–697.
- `server/src/routes/competency.routes.ts` — Mounted at `/api/competency` (Gateway:622); `CompetencyCatalog.tsx` calls real endpoints.
- Context engine is populated by multiple real cross-module callers: interview answers (`interview-insights.routes.ts:240`), AI attachment extraction (`ai.routes.ts`), settings changes (`settings.routes.ts`).
- `server/src/services/ai/organizationMemoryStore.ts` — Real embedding-backed pattern store (used in AI routes, not exposed as a standalone org route).

## What's MOCK / hardcoded / stub

- `src/components/Organization/OrganizationV8CanonPanel.tsx:17–46` — Pure static marketing panel; four hardcoded PILLARS array, zero API calls, zero live data. Renders on every org section as a "canon" panel but is entirely decorative.
- `OrganizationAdminPanel.tsx` — `section === 'members'` fetches `Api.getUserOrganizations()` but sections `billing`, `limits`, `domains`, `branding`, `competencies` are all handled as **redirects** to admin routes (Gateway-side) rather than rendering inline content; the panel shows a loading spinner with a stub redirect message.
- `src/views/OrganizationView.tsx:38–45` — Six admin sections (`ADMIN_SECTIONS`) immediately redirect to `ROUTES.ADMIN.*`; the organization surface owns the nav items but renders no content for them.
- `server/src/routes/organization/invitations.routes.ts` — Imported but mounted via `mountStub` (Gateway:659); **disabled in production** (`enableStubRoutes = !isProduction`).

## What's BROKEN / NO_GO / missing

- **Invitation flow disabled in production** — `mountStub('/api/invitations', invitationRoutes, ...)` (Gateway:659) will log a warning and skip the route in production. Any UI that calls `/api/invitations` will 404.
- **Branding routes not org-namespaced** — `brandingRoutes` is mounted at `/api/branding` (Gateway:698–703), not under `/api/organizations/:id/branding`; the org admin surface redirects to a different admin sub-module (`ROUTES.ADMIN.OPERATIONS`), creating a UX split.
- **OrganizationV8CanonPanel pollutes all sections** — A large static panel renders above all content including Goals, Challenges, Strategy — adding noise without value to every section view (`OrganizationView.tsx:252`).
- **Legacy `/context/*` + canonical `/organization/*` duplication** — `ContextBuilderView` and `OrganizationView` both render the same `OrganizationProfileModule`, `GoalsExpectationsModule`, `ChallengeMapModule`, `StrategicSynthesisModule` without coordination; context-builder store state (`useContextBuilderStore`) is independent of org-view state.
- **No frontend tests** — Zero `*.test.*` files in `src/components/Organization/`; `OrganizationView`, `KnowledgeGraphExplorer`, `OrganizationAdminPanel` have no frontend test coverage.

## Backend wiring

Solid for the core context engine and knowledge graph. `OrganizationContextService` is real and cross-module integrated. Knowledge graph has full CRUD + governance routes mounted. Organization CRUD (`organizations.routes`, `approved-domains`, `ownership`, `rbac`, `teams`) all mounted. **Gap:** invitations disabled in production; branding split across admin vs org; no standalone org-context worker/cron (rebuild is manual or triggered by event calls).

## UI/UX consistency

Shell structure (sidebar + content area with responsive mobile toggle) follows the app pattern. Dark/light theming correct throughout. **Inconsistency:** OrganizationV8CanonPanel is a bespoke marketing component not matching any other module's info-panel pattern. Admin sections redirect rather than render inline, giving users a jarring navigation handoff. `ContextBuilderView` at `/context/*` duplicates the same modules without the context-overview panel.

## Tests

**Server:** `OrganizationController.membership.test.ts` (unit, mocked DB), `organizationIdentityService.test.ts` (unit, mocked). No integration tests for context routes. **Frontend:** Zero tests for Organization module components.

## Doc-vs-code drift

CODEMAP (2026-05-09) correctly identifies `OrganizationView` as canonical and `/context/*` as transitional — matches code. STATUS "real + partial" is accurate. SSOT references `ORG_CONTEXT_WORKSPACE` and `ORG_LEGACY_CONTEXT_BUILDER` — both verified as mounted. **Drift:** docs do not mention that 6 admin sections are redirect stubs, nor that `invitationRoutes` is production-disabled via `mountStub`. KnowledgeGraphExplorer is not mentioned in CODEMAP at all despite being a full routed section.

## Top gaps to reach market-ready (prioritized)

1. **Fix invitations in production** — Move `invitationRoutes` out of `mountStub` or promote to a production mount; email invite flow is broken for prod deployments.
2. **Replace OrganizationV8CanonPanel with live data** — Wire to `/api/organization-context` summary, or remove from every section; static pillar marketing copy adds no user value.
3. **Inline admin content or document redirect contract** — Members/billing/limits/domains/branding sections should either render inline content or display a clear "go to Admin" link, not silently redirect users who clicked the org sidebar.
4. **Add frontend tests for OrganizationView + KnowledgeGraphExplorer** — Zero coverage for the primary surface and the graph explorer.
5. **Decommission or converge `/context/*` legacy surface** — Remove duplicate module rendering; route all context-builder traffic to `/organization/*` sections with a proper redirect, then delete `ContextBuilderView`.
6. **Add cron/background rebuild for org context snapshot** — Currently snapshot only rebuilds on explicit admin POST or event-triggered calls; add a scheduled job to keep snapshots fresh for AI context injection.
