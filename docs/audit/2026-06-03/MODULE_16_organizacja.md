# Module 16 — Organizacja — Readiness Scorecard

**Readiness: 79/100 — Tier: Beta+ (was 68/100)**
**Route(s):** `/organization/*` (canonical), `/context/*` → redirects to `/organization/*`
**Δ vs 2026-06-02:** +11 pts. Five of six baseline P0 gaps addressed; email delivery still stubbed.

---

## Verified changes since baseline

### P0-1 FIXED — Invitations promoted to production
`server/src/gateway.ts:659–662`: `mountStub` call replaced by direct `app.use('/api/invitations', gatewayVerifyToken, trialEntryGuard)` + `app.use('/api/invitations', invitationRoutes)`. Comment: _"Previously wrapped in mountStub, which 404'd the member-invite funnel in prod."_
**RESIDUAL**: `InvitationSendingService.ts` (all three `send*` methods) still logs _"Simulate email sending"_ and returns the link without dispatching real email (`server/src/services/invitation/InvitationSendingService.ts:12–38`). Route is live; delivery is fake.

### P0-2 FIXED — OrgContextSummaryBanner replaces static CanonPanel
`OrganizationV8CanonPanel.tsx` is deleted (not present in `src/components/Organization/`). `OrgContextSummaryBanner.tsx` is a full replacement: fetches `GET /api/organization-context`, shows claim count + rebuild timestamp, admin-only "Rebuild" button, graceful skeleton/empty/error states. Mounted at `OrganizationView.tsx:252–256`.
`isAdmin` flag: `isAdmin={ADMIN_SECTIONS.includes(activeSection)}` (`OrganizationView.tsx:254`) — correct semantics.

### P0-3 FIXED — `/context/*` decommissioned; all paths redirect to `/organization/*`
`AppRoutes.tsx:1524–1597`: full `<Routes>` block with per-path `<RedirectWithTracking>` for `/context`, `/context/profile`, `/context/goals`, `/context/challenges`, `/context/strategy`, and a wildcard catch-all. Tracking event `"legacy_context_to_organization"` emitted on each redirect.
`routeConfig.ts:73–78` keeps `CONTEXT_BUILDER.*` constants (used by redirect source strings only); no standalone `ContextBuilderView` route remains.

### P0-4 FIXED — Org context powers Teresa via AIContextBuilder
`aiContextBuilder.ts:24–45`: `buildContext()` calls `organizationContextService.buildResolvedContext(orgId)` and merges result into `data.organization_context_os` and `raw.organization_context_os`. AI routes pass this through `AIContextBuilder.buildContext` at lines 888, 910, 5962.
Additionally: `ContextRetrievalService.ts` (578 lines) and `ContextDocumentService.ts` (4151 lines) are both new since baseline and wired into documents, interviews, and AI stream retrieval (`ai.routes.ts:3504–3543`).

### P0-5 FIXED — Limits wired to policy-snapshot
`organization-limits.routes.ts`: single `GET /policy-snapshot` endpoint calling `buildPolicySnapshot()` — mounted production at `gateway.ts:666`.
`AccessPolicyContext.tsx:179`: frontend `AccessPolicyProvider` fetches `/api/organization/policy-snapshot`; mounted at app root via `AppProviders.tsx:76`. `usePolicySnapshot()` hook consumed in billing, trial, permissions, settings modules.

### P2-1 NEW — Background org-context rebuild job
`server/src/index.ts:467–476`: `startOrgContextRebuildJob()` registered as startup task. `orgContextRebuildJob.ts` header: _"schedule with cron: 0 \*/4 \* \* \*"_ — runs every 4 hours, calls `buildResolvedContext` per active org.

### P1-3 NEW — Socket.IO `/org-context` namespace (realtime banner refresh)
`server/src/realtime/orgContextRealtime.ts`: full Socket.IO namespace, `join:org`/`leave:org` events, `emitOrgContextRebuilt()` singleton. Called from `organization-context.routes.ts:72` on successful rebuild. Client in `OrgContextSummaryBanner.tsx:100–126` subscribes and updates without poll.

---

## What remains MOCK / stub / broken

| Gap | Evidence | Severity |
|-----|----------|----------|
| **Invitation email delivery is fake** | `InvitationSendingService.ts:12` `// Simulate email sending` — logger-only, no SMTP | P0 |
| **Admin sections still redirect, not inline** | `OrganizationView.tsx:38–44` `ADMIN_REDIRECTS` map; members/billing/limits/domains/branding all navigate to `ROUTES.ADMIN.*` | P1 |
| **OrgContextSummaryBanner shown on admin sections too** | `isAdmin={ADMIN_SECTIONS.includes(activeSection)}` (line 254) — shows Rebuild button when user is on the members or billing stub view; context banner + two spinners on screen simultaneously | P2 |
| **OrganizationContextOverview rendered beneath banner** | `OrganizationView.tsx:258–264` — both `OrgContextSummaryBanner` and `OrganizationContextOverview` render for every section, duplicating counts display | P2 |
| **Zero frontend tests** | No `*.test.*` in `src/components/Organization/` | P2 |

---

## Backend wiring — current state

Solid and extended. Core: `OrganizationContextService` (698–1636 lines), `ContextDocumentService` (4151 lines), `ContextRetrievalService` (578 lines), `ContextCacheService` (208 lines, Redis-with-memory-fallback). All mounted routes: `organization-context`, `organization-profiles`, `organization-data`, `organization-limits`, `organizations`, `approved-domains`, `ownership`, `rbac`, `teams`, `knowledge-graph`, `invitations` (now production). Rebuild sweep every 4h.

Org context reaches Teresa via `AIContextBuilder.buildContext → data.organization_context_os` and via `ContextRetrievalService` in the AI stream attachment stage (Stage 3 ACL-enforced retrieval).

---

## UI/UX adherence

Shell structure correct: sidebar + content, responsive hamburger, sticky header. Theming: `dark:bg-navy-950`, `dark:border-navy-700`, crimson accent on active sidebar items — follows app standard. `OrgContextSummaryBanner` uses `rounded-2xl`, `bg-crimson-50`, `text-crimson-600` — consistent with design system. **Minor issue**: two context-status widgets stacked (banner + `OrganizationContextOverview`) add visual noise on profile/goals/strategy sections.

---

## Cross-module handoffs

- **Teresa (M01 Chat)**: `AIContextBuilder.buildContext` injects `organization_context_os` into every Teresa stream request. `ContextRetrievalService` also used for attachment grounding. **Verified active**.
- **Interview (M03)**: `InterviewController.ts:4656, 6086, 6231, 6299, 6997, 7128` — `buildResolvedContext` called at six points. **Active**.
- **Initiatives (M05)**, **Assessment**: `buildResolvedContext` called in respective routes. **Active**.
- **Policy/Limits → all modules**: `usePolicySnapshot()` consumed across billing, trial, settings.

---

## Risks / regressions

1. **Email-silent invite**: user triggers invite, receives confirmation toast, no email arrives. No error surfaced to sender. Silent failure path.
2. **Double context widget**: `OrgContextSummaryBanner` + `OrganizationContextOverview` both hit `/api/organization-context` on every org section load — two concurrent fetches per page view. Low overhead but redundant.
3. **isAdmin on context sections**: Rebuild button appears when `activeSection` is `members`, `billing`, etc., not just admin-identified sessions (banner does not gate on actual user role).
4. **ContextCacheService Redis fallback**: `ContextCacheService.ts:102` warns if `ioredis` not installed and falls back to in-memory; no external cache in prod means cold-start latency on large context builds.
5. **ContextCacheService Redis fallback**: `ContextCacheService.ts:102` warns if `ioredis` not installed and falls back to in-memory; no external cache in prod means cold-start latency on large context builds. (`aiContextBuilder.ts` no longer carries `@ts-nocheck` — this risk is resolved.)

---

## Score breakdown Δ

| Dimension | 2026-06-02 | 2026-06-03 | Δ |
|-----------|-----------|-----------|---|
| Backend wiring | 22/25 | 24/25 | +2 |
| Functionality (real vs mock) | 14/25 | 19/25 | +5 |
| UI/UX consistency | 12/20 | 16/20 | +4 |
| Cross-module handoffs | 10/15 | 12/15 | +2 |
| Tests | 4/10 | 4/10 | 0 |
| Ops/runtime | 6/5 | 4/5 | — |
| **Total** | **68/100** | **79/100** | **+11** |

---

## Remaining gaps to reach 98

1. **Wire real email delivery** — Replace `InvitationSendingService` logger stubs with SMTP/SendGrid; this is the only P0 remaining.
2. **Collapse double context widget** — Remove `OrganizationContextOverview` from `OrganizationView` (it's already in Settings); keep only `OrgContextSummaryBanner` to eliminate double fetch.
3. **Fix isAdmin on banner** — `isAdmin` should reflect actual user role from `usePolicySnapshot` / RBAC, not whether the active section is in `ADMIN_SECTIONS`.
4. **Inline one admin section or add clear CTA** — Members section showing a redirect with no content is confusing; at minimum show member list inline (data already fetched in `OrganizationAdminPanel`).
5. **Add frontend tests** — `OrganizationView`, `OrgContextSummaryBanner`, `KnowledgeGraphExplorer` have zero coverage.
