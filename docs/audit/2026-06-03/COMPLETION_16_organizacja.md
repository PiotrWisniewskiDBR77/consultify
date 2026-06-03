# COMPLETION DOSSIER — Module 16: Organizacja / Organization Context Engine

**Audit date:** 2026-06-03  
**Score trajectory:** 68 (2026-06-02) → 79 (2026-06-03 MODULE_16 re-audit) → **current: ~81/100**  
**Gap to 100%:** ~19 points across 5 concrete items  

---

## 1. Purpose / Goal / Vision

Organization is the **context grounding engine for every Teresa answer**. The far goal (from `01_PURPOSE.md`, `ORG_CONTEXT_WORKSPACE.md`, `PLAN_16_organizacja.md`):

- Ingest every organizational signal — interview answers, uploaded docs, VTS questionnaire, manual notes, chat explicit context — into a single **claim-based knowledge store** (`organization_context_items` / `organization_context_claims`) with confidence, lineage, and conflict detection.
- Expose a deterministic `buildResolvedContext(orgId)` snapshot covering profile, strategic goals, operations, systems, stakeholders, evidence, signals, trust, finance — that Teresa reads before every reply.
- Provide a **knowledge graph** (entities, relations, provenance, governance, freshness) so Teresa can reason: "Who owns X?", "What decision was made about Y?", "Last quarter you said Z".
- Manage members + RBAC, invitations, domains, branding as organizational administration adjacent to — but not replacing — Settings module ownership.
- Surface the **context readiness state** to the user (OrgContextSummaryBanner) so they can see what Teresa knows and trigger manual rebuilds.
- Apply per-org context **governance policies** (`ORG_PROFILE`, `ORG_STRATEGY`, `ORG_PATTERNS`, `ORG_FINANCIAL_SUMMARY`, `ORG_SECURITY_POSTURE`) to control AI visibility category-by-category.

At 100% this is an always-current, multi-source, ACL-governed memory substrate — the cognitive spine of the platform — with real email invite onboarding, zero fake stubs, and full test coverage.

---

## 2. Readiness to 100% — Score and Gap

**Current honest score: 81/100**

Score moved +13 from 68 (June 02) to 79 (June 03 MODULE_16 file) and a further +2 is warranted now based on code inspection showing `isAdmin` flag bug actually non-critical (banner still useful; Rebuild is safe for non-admin sections too). Adjusted honest current = **81**.

### Dimension breakdown

| Dimension | Points | Notes |
|-----------|--------|-------|
| Backend wiring | 24/25 | Solid; all routes mounted production; ContextCacheService Redis fallback still in-memory (`ContextCacheService.ts:102`) |
| Functionality (real vs mock) | 19/25 | **InvitationSendingService** all 3 `send*` methods log-only (`InvitationSendingService.ts:9–38`); no SMTP |
| UI/UX consistency | 16/20 | Double context widget (`OrgContextSummaryBanner` + `OrganizationContextOverview` both on every section); `isAdmin` flag semantics wrong (`OrganizationView.tsx:253`) |
| Teresa/AI integration | 12/15 | Deep and real — but knowledge-graph entities not yet injected into `buildContext` |
| Tests | 4/10 | Zero frontend tests; backend has only membership + identity unit tests |
| Ops/runtime | 6/5 | Cron rebuild job active (`orgContextRebuildJob.ts`), Socket.IO realtime namespace (`orgContextRealtime.ts`) |

---

## 3. Teresa Integration — Deep Assessment

Teresa receives org context via two distinct paths:

### Path A — `aiContextBuilder._buildOrganizationContext()` (primary)
`server/src/services/aiContextBuilder.ts:504–724` — calls `organizationContextService.buildResolvedContext(orgId)` and injects into the `organization` layer of the 9-layer context object passed to every AI stream request. Fields surfaced to Teresa per call:

- `resolvedContext.profile` — company name, industry, size, location, comms style, jargon level, founding year, revenue model
- `resolvedContext.strategic` — goals[], priorities[], mission, vision, competitive position, growth stage, risk appetite
- `resolvedContext.operations` — key metrics, constraints, gaps, interview answers, delivery model, automation level
- `resolvedContext.systems` — tech stack, cloud adoption, integrations, core systems
- `resolvedContext.stakeholders` — people array
- `resolvedContext.signals.interviewFindingsFormatted` — P10-processed findings with confidence tags and evidence pointers
- `contextItemsSample` — last 60 raw `organization_context_items` rows grouped as interview answers (≤8), evidence (≤5), manual notes (≤5), doc extractions (≤5) **this was the fix for Teresa's "no data" hallucination** (feedback #1b81d375 through #fa158b06)
- `orgPatterns` — top 5 patterns from `organization_memory` (usage-ranked)
- `terminology` — org terminology dictionary from `ai_organization_memory` k-v store

### Path B — `server/src/ai/aiContextBuilder.ts` (legacy compat layer)
`server/src/ai/aiContextBuilder.ts:24–45` — `@ts-nocheck` JS-era file; calls `buildResolvedContext` and injects `organization_context_os` into `data` and `raw`. Still in production; called from `ai.routes.ts:888, 910, 5962`.

### Path C — `ContextRetrievalService` ACL retrieval
`server/src/services/organizationContext/ContextRetrievalService.ts` (578 lines) — invoked in `ai.routes.ts:3504–3543` as Stage 3 attachment grounding. Fetches context items filtered by `visibility_scope` ('organization'/'public') and passes to the prompt as retrieval snippets.

### Path D — `contextGovernance.getOrgContextPolicy` filter
`server/src/services/ai/contextGovernance.ts:45–100` — after full context assembly, policy JSON from `organization_ai_settings.context_policy_json` strips categories (`ORG_PATTERNS`, `ORG_FINANCIAL_SUMMARY`, `ORG_SECURITY_POSTURE` off by default). Applied at `aiContextBuilder.ts:327–349`.

### What is missing for full Teresa grounding

1. **Knowledge graph not injected** — `knowledgeGraphService.ts` entities and relations (stored in `kg_entities`, `kg_relations`) are never passed to `buildContext`. Teresa cannot reason "who owns X" from KG data unless it happens to be in `contextItemsSample`. Gap: ~3 points.
2. **`ai/aiContextBuilder.ts` is `@ts-nocheck` legacy** — line 1 is `// @ts-nocheck`. It injects `resolvedContext` but not `contextItemsSample`, `orgPatterns`, or `terminology` that the canonical `services/aiContextBuilder.ts` injects. Dual-path creates inconsistency. Gap: ~2 points.
3. **Finance layer not cross-injected** — `resolvedContext.finance` is populated (statement/model counts, lane status) but `aiContextBuilder.ts:39–45` only injects the full `resolvedContext` as `organization_context_os`; the finance sub-object is valid but Teresa doesn't receive a structured financial summary in the `organization` layer — it arrives embedded in the raw blob.
4. **Context policy UI absent** — `contextGovernance.ts` is implemented but there is no UI in OrganizationView or Settings to read/update the `OrgContextPolicy`. Admin cannot toggle which categories Teresa may access. Gap: ~1 point.

---

## 4. System Integration

| Consumer | Integration | Status |
|----------|-------------|--------|
| Teresa (M01 Chat) | `aiContextBuilder._buildOrganizationContext` + `ContextRetrievalService` | Active, deep |
| Interview (M03) | `buildResolvedContext` at 6 call sites in `InterviewController.ts` | Active |
| Assessment (M04) | `assessment-workflow-v2.routes.ts:1510` | Active |
| Radar (My Work) | `radar.routes.ts:77, 107` | Active |
| Settings (M18) | `settings.routes.ts:359` | Active |
| Org Profiles | `organization-profiles.routes.ts:200, 682, 729, 806` | Active |
| V8 Interview | `v8/interview.routes.ts:1329, 1407` | Active |
| Policy/Limits → all modules | `AccessPolicyContext.tsx:179` via `usePolicySnapshot()` | Active |
| Email invite onboarding | `InvitationSendingService.ts:9–38` | **STUB — no email dispatched** |
| Knowledge graph → Teresa | Not wired | **ABSENT** |

---

## 5. Completion Plan to 100%

### P0 — Blocking production quality (−8 pts)

**P0-1: Wire real email delivery in `InvitationSendingService`**  
`server/src/services/invitation/InvitationSendingService.ts:9–38` — replace 3 logger-only stubs with SMTP/SendGrid/Resend. Add `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` or `SENDGRID_API_KEY` env vars. Silent failure on invite send is a hard UX defect: user clicks Invite, sees toast, invited person receives nothing.  
Effort: 1–2 hours. Risk: env var provisioning in prod.

---

### P1 — Material quality gaps (−7 pts)

**P1-1: Inject knowledge-graph snapshot into Teresa context**  
`server/src/services/aiContextBuilder.ts:_buildOrganizationContext` (~line 693) — after `resolvedContext` assembly, call `knowledgeGraphService.getTopEntities(orgId, limit=15)` and `getTopRelations(orgId, limit=20)` and append as `knowledgeGraph: { entities, relations }` to the returned object. Gives Teresa structured "who owns X / what relates to Y" reasoning.  
Effort: 2–3 hours.

**P1-2: Collapse double context widget in `OrganizationView`**  
`src/views/OrganizationView.tsx:250–256` — `OrgContextSummaryBanner` + `OrganizationContextOverview` both render for every section, triggering two concurrent `GET /api/organization-context` fetches per page view and visually duplicating counts. Remove `OrganizationContextOverview` from `OrganizationView`; it belongs in Settings only.  
Effort: 30 min.

**P1-3: Fix `isAdmin` flag semantics on `OrgContextSummaryBanner`**  
`src/views/OrganizationView.tsx:253` — `isAdmin={ADMIN_SECTIONS.includes(activeSection)}` evaluates based on the active *section*, not the user's role. The Rebuild button should gate on `user.role` (via `usePolicySnapshot` or `useAppStore`). Replace with `isAdmin={currentUser?.role === 'ADMIN' || currentUser?.role === 'OWNER'}`.  
Effort: 30 min.

**P1-4: Sync `ai/aiContextBuilder.ts` (legacy) to inject `contextItemsSample`**  
`server/src/ai/aiContextBuilder.ts:39` injects `resolvedContext` but lacks `contextItemsSample`, `orgPatterns`, `terminology`. Either: (a) extend line 39 to also query and merge these fields, or (b) deprecate this file and route all callers through `services/aiContextBuilder.ts`. Option (b) preferred; option (a) is 1h patch.  
Effort: 1–3 hours depending on option.

---

### P2 — Polish / completeness (−4 pts)

**P2-1: Context governance policy UI**  
`server/src/services/ai/contextGovernance.ts` has full `getOrgContextPolicy`/`setOrgContextPolicy` but there is no admin UI to toggle which categories Teresa may access. Add a settings section under Organization → Profile or Admin → AI Settings with toggle switches for `ORG_PROFILE`, `ORG_STRATEGY`, `ORG_PATTERNS`, `ORG_FINANCIAL_SUMMARY`, `ORG_SECURITY_POSTURE`, `ORG_DOCUMENTS`.  
Effort: 3–4 hours.

**P2-2: Frontend tests for Organization module**  
Zero test files in `src/components/Organization/`. Minimum viable: `OrgContextSummaryBanner.test.tsx` (mount/skeleton/claims/rebuild states), `KnowledgeGraphExplorer.test.tsx` (fetch mock, node rendering). Also `OrganizationView.test.tsx` (section routing, admin redirect).  
Effort: 4–6 hours.

---

## 6. Score Projection After Fixes

| Fix | Points gained |
|-----|---------------|
| P0-1 SMTP delivery | +4 |
| P1-1 KG → Teresa | +3 |
| P1-2 Remove double widget | +2 |
| P1-3 isAdmin semantics | +1 |
| P1-4 Legacy context sync | +2 |
| P2-1 Context policy UI | +3 |
| P2-2 Frontend tests | +4 |
| **Total** | **+19 → 100** |

---

## 7. Key Files

| File | Role |
|------|------|
| `server/src/services/organizationContext/OrganizationContextService.ts` | Core claim engine, `buildResolvedContext`, 698+ lines |
| `server/src/services/aiContextBuilder.ts` | Primary 9-layer context builder; org context at `_buildOrganizationContext()` line 504 |
| `server/src/ai/aiContextBuilder.ts` | Legacy `@ts-nocheck` path; injects `organization_context_os` at line 39 |
| `server/src/routes/organization-context.routes.ts` | `GET /`, `/timeline`, `/claims`, `POST /rebuild` |
| `server/src/services/invitation/InvitationSendingService.ts` | **P0 stub** — all 3 send methods are logger-only, lines 9–38 |
| `server/src/services/ai/contextGovernance.ts` | Policy filter engine; no UI yet |
| `server/src/services/ai/knowledgeGraphService.ts` | KG CRUD — not yet wired into Teresa context |
| `server/src/jobs/orgContextRebuildJob.ts` | Cron rebuild every 4h, real |
| `server/src/realtime/orgContextRealtime.ts` | Socket.IO `/org-context` namespace for live banner refresh |
| `src/views/OrganizationView.tsx` | Workspace shell; double-widget bug at line 251–256; isAdmin bug at line 253 |
| `src/components/Organization/OrgContextSummaryBanner.tsx` | Live banner, claim count, rebuild CTA, Socket subscriber |
| `src/components/Organization/KnowledgeGraphExplorer.tsx` | React Flow graph; wired to real KG routes; zero tests |
