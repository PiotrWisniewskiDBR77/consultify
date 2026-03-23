# V8 Decision Package — Post-20-Wave Closure Audit

> Status: Decision-ready draft for source-of-truth chat
> Owner: Manager Agent → Source-of-truth chat
> Date: 2026-03-23
> Scope: 6 strategic decisions required before V8 implementation can advance beyond maturity level 2/8

---

## 1. Audit interpretation

The post-20-wave closure audit reveals a program that is documentation-rich but integration-empty. The V8 backend contains 34 dedicated services in `server/src/services/v8/`, approximately 64 test files covering those services (unit + integration tiers t1–t3), and a substantial body of canonical product documentation spanning Chat, AI core, Initiatives, Finance, Reports, Multiplayer, and 20+ other domains. The documentation coverage map in `SYSTEMATYKA_PRZEGLADU_V8.md` shows "Mocne pokrycie" (strong coverage) for the majority of primary product branches.

However, the audit also shows that zero V8-specific API routes exist — no file in `server/src/routes/` references any V8 service. The frontend codebase (`src/`) contains zero imports from `services/v8`. All ~96 V8 test files mock the database layer; none execute against a real Postgres instance. The existing 384 route files serve the legacy V3/V4 runtime exclusively. The two SQL migration files in `server/src/database/migrations/` are infrastructure-level, not V8-schema-level. Socket.io is present but limited to two legacy gateways (`collaborativeSession.gateway.ts` and `ideaCollab.gateway.ts`) that predate V8 multiplayer doctrine.

This means the program sits at maturity level 2 of 8: documented and implemented in isolation, but with no wiring, no integration, no verification against real data, no operator surfaces, and no rollout path. The 8 P0 gaps (G-01 through G-08) are all integration-class gaps, not design gaps. The product canon is strong enough to build from; the question is sequencing, strategy, and resource allocation for the 16–35 weeks of integration work ahead.

---

## 2. Recommended decision order

1. **Decision 6: Migration strategy** — must be resolved first because every other decision depends on knowing whether V8 tables live in the same DB, a separate schema, or a separate database. This is a foundation-level constraint.
2. **Decision 1: Which modules to wire first** — determines the critical path for the first production feature and shapes team allocation for the first 4–8 weeks.
3. **Decision 2: V8 replaces V3/V4 or runs in parallel** — determines whether the API layer (G-01) and frontend integration (G-02) are additive or replacement work, which changes effort estimates by 30–50%.
4. **Decision 3: Target timeline for first V8 feature in production** — sets the delivery cadence and forces trade-offs between breadth and depth.
5. **Decision 5: WebSocket strategy** — must be decided before multiplayer work begins (Wave 7 in the 20-wave program), but can trail the first three decisions.
6. **Decision 4: Interview, Help/KB, Partner scope** — lowest urgency because these modules are in Wave 20 (roof hardening) and do not block the critical path.

Rationale: decisions are ordered by how many downstream decisions and work packets they unblock. Database strategy unblocks everything. Module priority unblocks team allocation. Replacement strategy unblocks API design patterns. Timeline unblocks release planning. WebSocket unblocks multiplayer. Peripheral module scope unblocks nothing on the critical path.

---

## 3. Decision package

---

### Decision 1: Which modules to wire first?

**1. Decision title**
First-wire module priority for V8 API and frontend integration

**2. Why it matters**
With 34 V8 services and zero API routes, the program must choose a beachhead. Wiring everything simultaneously is impossible within a single delivery wave. The choice of first module determines which canonical docs become the first real integration test of the V8 architecture, which team skills are needed first, and which users see value first.

**3. What it blocks**
- G-01 (no API routes): cannot begin route creation without knowing which service endpoints to expose first
- G-02 (no frontend integration): cannot begin frontend wiring without knowing which module's UI to connect
- Wave 2 (context and runtime identity spine) and Wave 9 (Chat + Prompt OS + Knowledge integration proof) from the 20-wave program
- First production deployment timeline (Decision 3)

**4. Options**

| Option | Description | First services wired |
| --- | --- | --- |
| A. Chat + AI Core first | Wire `chatExecutionService`, `contextSnapshotService`, `promptOsRuntimeService`, `knowledgeRetrievalService`, `governedRetrievalService` | 5–7 services |
| B. Initiatives + Execution first | Wire `planningContinuityService`, `executionSpineService`, `executionVisibilityService`, `sourceTruthService` | 4–6 services |
| C. Reports + Finance first | Wire `reportsPresModelService`, `financeIntegrationService`, `resultsROIService`, `publishReviewService` | 4–5 services |
| D. Broadest coverage first | Wire one thin route per service across all 34 services, then deepen | 34 services (shallow) |

**5. Recommendation**
**Option A: Chat + AI Core first.**

Justification from audit data:
- Chat has the strongest documentation coverage ("Mocne pokrycie" across all 8 sub-branches in `SYSTEMATYKA_PRZEGLADU_V8.md`)
- `chatExecutionService`, `contextSnapshotService`, and `promptOsRuntimeService` are the three services that the 20-wave program identifies as Wave 2 P0 targets
- Chat is the primary user-facing surface — wiring it first produces visible value fastest
- The AI operating environment proof (Wave 9) requires Chat + Prompt OS + Knowledge to be wired as a coherent system
- 5 of the 34 V8 services are Chat/AI-adjacent, making this a focused beachhead

**6. Pros of recommendation**
- Aligns with Wave 2 and Wave 9 of the existing 20-wave program
- Produces a user-visible feature (AI chat with V8 context spine) as the first deliverable
- Tests the hardest integration seam first (AI runtime + context + retrieval + trust)
- Chat documentation is the most mature — lowest risk of discovering missing product doctrine mid-implementation

**7. Cons of recommendation**
- Delays Initiatives and Finance wiring, which are also documentation-strong
- Chat + AI Core integration is the most complex first target — higher technical risk than starting with a simpler module
- Does not immediately serve the PMO/execution user persona

**8. Implementation consequence**
First 4–6 weeks focus on: V8 route files for chat execution, context snapshot, prompt OS runtime, knowledge retrieval, and governed retrieval. Frontend integration begins with the existing Chat UI connecting to V8 endpoints behind a feature flag. Auth middleware (G-05) must be solved as part of this work since chat routes require user identity.

**9. Risk if delayed**
Every week without a first-wire decision is a week where 34 services remain disconnected. The program stays at maturity 2/8 indefinitely. Team morale degrades as documentation work continues without production impact.

**10. Required source-of-truth decision**
**Yes.** This decision shapes the first 4–8 weeks of engineering work and determines which canonical docs become the binding integration contract. The manager agent cannot make this choice alone because it implies resource allocation and user-facing priority.

---

### Decision 2: V8 replaces V3/V4 or runs in parallel?

**1. Decision title**
V8-to-legacy relationship: replacement, parallel, or phased shadow

**2. Why it matters**
The existing codebase has 384 route files serving the V3/V4 runtime. V8 introduces 34 new services with different architectural assumptions (context snapshots, governed retrieval, execution spine, trust audit). The relationship between these two worlds determines whether V8 routes are additive (new endpoints alongside old ones) or replacement (new endpoints that eventually supersede old ones). This changes API naming, data migration strategy, frontend routing, and the total effort estimate.

**3. What it blocks**
- G-01 (API routes): route naming and versioning strategy
- G-02 (frontend integration): whether frontend components call V8 endpoints directly or through a compatibility layer
- G-08 (legacy cutover plan): the entire cutover strategy
- Database migration execution (G-03): whether V8 tables coexist with V3/V4 tables or replace them

**4. Options**

| Option | Description | Effort multiplier |
| --- | --- | --- |
| A. Full replacement | V8 replaces V3/V4 entirely. Legacy routes are deprecated and removed. | 1.0x (but high risk) |
| B. Long-term parallel | V8 runs alongside V3/V4 indefinitely. Users choose which version to use. | 1.5x (dual maintenance) |
| C. Phased replacement with shadow mode | V8 routes are deployed behind feature flags. Traffic is gradually shifted. Legacy routes remain until V8 is verified per module. | 1.2x (temporary dual, then converge) |

**5. Recommendation**
**Option C: Phased replacement with shadow mode.**

Justification from audit data:
- G-06 (no feature flags) must be solved regardless — shadow mode forces this gap to be closed early
- The 384 existing route files represent years of production-hardened behavior that cannot be safely replaced in one step
- The 20-wave program already assumes phased delivery (waves 1–20), which naturally maps to phased replacement
- Shadow mode allows real DB verification (closing G-04) by running V8 logic against production data without user-facing risk

**6. Pros of recommendation**
- Lowest risk: production users continue on V3/V4 until V8 is verified per module
- Forces feature flag infrastructure (G-06) to be built early, which benefits the entire program
- Enables real-data testing (G-04) by shadowing production traffic through V8 services
- Compatible with any first-wire choice (Decision 1)
- Natural alignment with the 20-wave phased delivery structure

**7. Cons of recommendation**
- Temporary dual maintenance cost (~1.2x effort) during the shadow period
- Requires a feature flag system that does not yet exist
- Shadow mode adds operational complexity (two code paths per feature during transition)
- Risk of "permanent shadow" if cutover discipline is weak

**8. Implementation consequence**
Feature flag infrastructure becomes a Wave 0 / pre-work item. Each V8 module gets a flag (`v8_chat_enabled`, `v8_initiatives_enabled`, etc.). API routes are versioned (`/api/v8/chat/...`) during shadow mode, then promoted to primary when verified. Frontend components check flags to determine which endpoint to call. Legacy routes are removed only after V8 verification passes for that module.

**9. Risk if delayed**
Without this decision, the team cannot design the API layer (G-01). Every route file created without knowing the replacement strategy may need to be restructured later. The longer this is delayed, the more likely ad-hoc decisions create inconsistent patterns across modules.

**10. Required source-of-truth decision**
**Yes.** This is an architectural decision that affects every module, every route, and every frontend component. It cannot be reversed cheaply once implementation begins.

---

### Decision 3: Target timeline for first V8 feature in production?

**1. Decision title**
Target date for first V8 feature visible to production users

**2. Why it matters**
The audit estimates 16–35 weeks for full V8 integration across all 6 phases. But the first visible feature is a different question — it determines team urgency, stakeholder expectations, and whether the program maintains momentum or stalls in infrastructure work.

**3. What it blocks**
- Release planning and sprint allocation
- Feature flag rollout schedule
- Stakeholder communication and demo planning
- Decision on whether to hire/contract additional engineering capacity

**4. Options**

| Option | Timeline | What ships | Prerequisite decisions |
| --- | --- | --- | --- |
| A. 4 weeks | V8 chat context spine behind flag for internal users | Decisions 1, 2, 6 resolved in week 1 |
| B. 8 weeks | V8 chat + knowledge retrieval for beta users | Decisions 1, 2, 6 resolved by week 2 |
| C. 12 weeks | V8 chat + AI core + first initiative flow | Decisions 1, 2, 5, 6 resolved by week 4 |
| D. 16+ weeks | Full Phase 1 (DB) + Phase 2 (API) before any user exposure | All 6 decisions resolved by week 6 |

**5. Recommendation**
**Option B: 8 weeks to V8 chat + knowledge retrieval for beta users.**

Justification from audit data:
- 8 weeks maps to completing Phase 1 (Database Foundation) and the first slice of Phase 2 (API Layer) from the audit's 6-phase model
- Chat + Knowledge retrieval involves 5–7 V8 services, which is a manageable scope for 8 weeks
- Beta users (not all production users) reduces risk while still producing real validation
- This timeline forces G-01 (API routes), G-03 (DB migration execution), G-04 (real DB tests), and G-05 (auth middleware) to be solved for at least one module within 8 weeks

**6. Pros of recommendation**
- Creates urgency without being reckless
- Forces the hardest infrastructure gaps (DB, auth, routes) to be solved early
- Beta exposure generates real feedback before committing to broader rollout
- 8 weeks is long enough to build properly, short enough to maintain program momentum

**7. Cons of recommendation**
- Requires Decisions 1, 2, and 6 to be resolved within the first 2 weeks
- Beta users may encounter rough edges that damage perception of V8
- 8 weeks may be tight if the DB migration strategy (Decision 6) reveals unexpected complexity

**8. Implementation consequence**
Weeks 1–2: resolve foundation decisions, build feature flag infrastructure, execute first DB migration. Weeks 3–6: wire Chat + Knowledge API routes, connect auth middleware, write first real-DB integration tests. Weeks 7–8: connect frontend chat UI to V8 endpoints behind beta flag, run shadow traffic, fix issues. Week 8: beta flag enabled for internal team + selected beta users.

**9. Risk if delayed**
Every additional week without a timeline target allows the program to drift into "perpetual infrastructure" mode. The 34 V8 services remain disconnected. Stakeholder confidence erodes. The gap between documentation maturity and production reality widens.

**10. Required source-of-truth decision**
**Yes.** Timeline commitments affect resource allocation, stakeholder communication, and the credibility of the entire V8 program. The manager agent cannot set deadlines unilaterally.

---

### Decision 4: Should Interview, Help/KB, Partner get V8 backend in this program?

**1. Decision title**
Scope inclusion of Interview, Help/Knowledge Base, and Partner Program in the active V8 integration program

**2. Why it matters**
All three modules have "Mocne pokrycie" in documentation. Interview has 15 canonical V8 docs. Help/KB has 17. Partner Program has 18+. But none of these modules are on the critical path for the first V8 feature. Including them expands the program scope by an estimated 4–8 weeks. Excluding them risks leaving strong documentation without implementation indefinitely.

**3. What it blocks**
- Total program duration estimate (16–35 weeks range narrows based on this decision)
- Team allocation: whether to assign engineers to these modules or keep them focused on core path
- Wave 20 (roof closure) scope in the 20-wave program

**4. Options**

| Option | Description | Impact on timeline |
| --- | --- | --- |
| A. Include in same program | All three modules get V8 API routes and frontend wiring within the 20-wave program | +6–8 weeks |
| B. Defer to later program | Explicitly exclude from V8 integration program; revisit after core modules are production-verified | +0 weeks now, separate program later |
| C. Include only if time permits | No dedicated waves; teams work on these modules if core waves finish ahead of schedule | +0–4 weeks (unpredictable) |

**5. Recommendation**
**Option B: Defer to later program.**

Justification from audit data:
- The 20-wave program already places these modules in Wave 20 (roof closure), which is the last wave
- The 8 P0 gaps (G-01 through G-08) are all core-path gaps that affect Chat, AI Core, Initiatives, and Multiplayer first
- Interview, Help/KB, and Partner have strong documentation but their V8 backend services are not yet in `server/src/services/v8/` — they would need new service creation, not just wiring
- The core path (Chat → AI Core → Initiatives → Execution → Results → Finance) already represents 20+ services to wire, which fills the 16–35 week estimate

**6. Pros of recommendation**
- Keeps the program focused on the 8 P0 gaps
- Reduces scope from ~34+ services to ~20 core services
- Aligns with the 20-wave program's own prioritization (these are Wave 20)
- Strong documentation means these modules can be picked up later without re-discovery

**7. Cons of recommendation**
- Interview, Help/KB, and Partner users see no V8 benefit during this program
- Documentation may drift if implementation is delayed too long
- Team members working on these modules may feel deprioritized

**8. Implementation consequence**
These three modules continue running on V3/V4 backend. Their V8 documentation is preserved and maintained but not actively wired. A separate "V8 Extension Program" is planned after the core program reaches maturity level 6/8 (verified + operator-ready).

**9. Risk if delayed**
Low for the core program. Moderate for documentation freshness — if the deferral extends beyond 6 months, the V8 docs for these modules may need updating. The Partner Program has commercial implications (partner portal, payouts) that may create external pressure.

**10. Required source-of-truth decision**
**Yes.** Scope decisions affect stakeholder expectations and resource allocation. The source-of-truth chat must explicitly approve the deferral to prevent scope creep later.

---

### Decision 5: WebSocket strategy for multiplayer?

**1. Decision title**
WebSocket transport strategy for V8 multiplayer and real-time collaboration

**2. Why it matters**
G-07 (no WebSocket transport) is a P0 gap. The V8 multiplayer doctrine (`MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md`) requires real-time presence, concurrent editing, and collaboration rooms. The existing codebase has Socket.io in two legacy gateways (`collaborativeSession.gateway.ts` for Deep Thinking sessions, `ideaCollab.gateway.ts` for Idea workspace). The V8 multiplayer services (`collaborationRoomService`, `concurrentEditingService`, `multiplayerHardeningService`, `workspaceCollaborationService`) have no transport layer.

**3. What it blocks**
- G-07 (WebSocket transport): the entire real-time layer
- Wave 7 (multiplayer platform baseline) and Wave 8 (version/replay/audit spine) in the 20-wave program
- Concurrent editing across Idea Workspace, Whiteboard, Mind Map, Process Flow, Table, and Notebook (Waves 13–16)
- The `collaborationRoomService` and `concurrentEditingService` cannot function without a transport

**4. Options**

| Option | Description | Effort | Risk |
| --- | --- | --- | --- |
| A. Extend existing Socket.io | Add V8 namespaces/rooms to the existing Socket.io server. Reuse the infrastructure in `server/src/index.ts`. | Low (2–3 weeks) | Medium: Socket.io's room model may not scale for V8's collaboration-room doctrine |
| B. New dedicated WS layer | Build a new WebSocket layer (raw WS or a framework like `ws` + custom protocol) specifically for V8 multiplayer. | High (5–8 weeks) | Low: purpose-built for V8 requirements |
| C. Defer multiplayer real-time | Ship V8 without real-time collaboration. Use polling or optimistic UI. Add WebSocket later. | Minimal (0 weeks) | High: multiplayer is a core V8 differentiator; deferral undermines the value proposition |

**5. Recommendation**
**Option A: Extend existing Socket.io.**

Justification from audit data:
- Socket.io is already in production (`server/src/index.ts`, two gateways). The infrastructure (server setup, CORS, auth handshake) exists.
- The V8 `collaborationRoomService` already defines room semantics that map naturally to Socket.io rooms
- The 20-wave program places multiplayer in Waves 7–8, which is mid-program — there is time to harden but not enough time to build a new transport from scratch
- The two existing gateways prove Socket.io works in this deployment environment (Railway)

**6. Pros of recommendation**
- Reuses proven infrastructure — no new deployment concerns
- Socket.io rooms map well to V8 collaboration rooms
- Lowest effort (2–3 weeks) allows multiplayer to start on schedule in Wave 7
- Existing auth handshake patterns can be reused for V8 rooms

**7. Cons of recommendation**
- Socket.io adds ~100KB to the client bundle
- Socket.io's abstraction layer may hide transport-level issues that matter for concurrent editing
- If V8 multiplayer scales beyond Socket.io's capacity, migration to a dedicated layer will be needed later
- Legacy gateways and V8 gateways share the same Socket.io server, creating potential namespace conflicts

**8. Implementation consequence**
V8 multiplayer gets dedicated Socket.io namespaces (`/v8/collab`, `/v8/presence`). The existing `collaborativeSession.gateway.ts` and `ideaCollab.gateway.ts` remain on their current namespaces. New V8 gateways are created for: room management, presence, concurrent editing events, and version/replay events. Auth middleware (G-05) is shared between HTTP routes and Socket.io handshake.

**9. Risk if delayed**
Multiplayer is Wave 7 in the 20-wave program. If the WebSocket decision is not made before Wave 7 begins, the entire collaboration track (Waves 7–8, 13–16) is blocked. That is 6 of 20 waves — 30% of the program.

**10. Required source-of-truth decision**
**No, with caveat.** Extending Socket.io is a technical implementation decision that the manager agent can make within the approved architecture. However, if the source-of-truth chat has a preference for a different transport (e.g., for future scale reasons), it should override this recommendation. Escalate only if there is a known scaling constraint.

---

### Decision 6: Migration strategy — existing DB or separate schema?

**1. Decision title**
Database schema strategy for V8 tables

**2. Why it matters**
G-03 (no DB migration execution) is a P0 gap. The V8 services assume data structures (context snapshots, execution spines, collaboration rooms, trust audit records, governed retrieval metadata) that do not exist in the current database. The current `server/src/database/migrations/` contains only 2 files (`add_resource_tables.sql` and `sqlUtils.ts`), neither of which is V8-specific. The choice of where V8 tables live determines migration complexity, data access patterns, join performance, and rollback safety.

**3. What it blocks**
- G-03 (DB migration execution): cannot create V8 tables without knowing where they go
- G-04 (real DB tests): cannot write real-DB tests without a migration strategy
- Every V8 service that persists data (all 34 services ultimately need storage)
- Phase 1 (Database Foundation) from the audit's 6-phase model — this is literally the first phase

**4. Options**

| Option | Description | Migration complexity | Rollback safety |
| --- | --- | --- | --- |
| A. Same DB, additive tables | V8 tables are added to the existing Postgres database alongside V3/V4 tables. Naming convention: `v8_` prefix. | Low | Medium: V8 tables can be dropped without affecting V3/V4 |
| B. Separate schema | V8 tables live in a `v8` schema within the same Postgres database. Cross-schema queries are possible but explicit. | Medium | High: entire schema can be dropped cleanly |
| C. Separate database | V8 gets its own Postgres instance on Railway. No shared tables. | High | Highest: complete isolation |

**5. Recommendation**
**Option B: Separate schema (`v8`) within the same Postgres database.**

Justification from audit data:
- The V8 services need to reference existing V3/V4 data (user IDs, organization IDs, initiative IDs) during the phased replacement period (Decision 2, Option C). A separate database (Option C) would require cross-database joins or data duplication, which is operationally expensive.
- A separate schema provides clean namespace isolation without the operational overhead of a second database instance on Railway.
- The `databaseTargetResolver.ts` in `server/src/config/` already handles database targeting — adding a schema qualifier is a smaller change than adding a second connection pool.
- Rollback is clean: `DROP SCHEMA v8 CASCADE` removes all V8 tables without touching V3/V4 data.
- The 45 migrations referenced in the audit (likely planned, not yet executed) can be organized as schema-scoped migrations.

**6. Pros of recommendation**
- Clean isolation: V8 tables are namespaced and cannot accidentally collide with V3/V4 tables
- Cross-schema joins are possible for the phased replacement period (e.g., `v8.context_snapshots` joining `public.users`)
- Single database instance on Railway — no additional infrastructure cost
- Clean rollback path: drop the schema to fully revert
- Compatible with the existing `databaseTargetResolver.ts` architecture

**7. Cons of recommendation**
- Cross-schema queries require explicit schema qualification (`v8.table_name`)
- Some ORMs handle multi-schema setups poorly — requires verification with the current ORM/query layer
- Schema-level permissions add a small operational overhead
- If V8 eventually fully replaces V3/V4, the schema separation becomes unnecessary overhead that must be cleaned up

**8. Implementation consequence**
First migration creates the `v8` schema: `CREATE SCHEMA IF NOT EXISTS v8`. All V8 table migrations are prefixed with the schema. The `databaseTargetResolver.ts` is extended to support schema-qualified queries. V8 services use `v8.` prefix in their queries. During phased replacement, V8 services can join against `public.` tables for user/org data. After full cutover, V8 tables are promoted to `public` and the `v8` schema is removed.

**9. Risk if delayed**
This is the single most blocking decision. Without it, no V8 table can be created, no real-DB test can run, and no API route can persist data. Every day this decision is delayed is a day the program cannot advance beyond maturity level 2/8. Phase 1 (Database Foundation) cannot begin.

**10. Required source-of-truth decision**
**Yes.** Database architecture is a foundational decision that affects every module, every service, and every migration for the entire program. It is irreversible in practice once tables are created and data is stored. The source-of-truth chat must approve.

---

## 4. Critical-path implications — what the decisions unlock

The 6 decisions form a dependency chain that unlocks the program in this order:

1. **Decision 6 (DB schema)** → unlocks Phase 1 (Database Foundation), G-03, G-04
2. **Decision 1 (first module)** + **Decision 2 (replacement strategy)** → unlocks Phase 2 (API Layer), G-01, G-05
3. **Decision 3 (timeline)** → unlocks release planning, beta flag schedule, stakeholder communication
4. **Decision 5 (WebSocket)** → unlocks Phase 4 (UI Integration) for multiplayer, Waves 7–8 and 13–16
5. **Decision 4 (peripheral scope)** → unlocks or explicitly defers Waves 20+ for Interview, Help/KB, Partner

Once Decisions 1, 2, and 6 are resolved, the program can advance from maturity 2/8 to maturity 4/8 (wired + integrated) within the first 8–12 weeks. Decisions 3 and 5 are needed to reach maturity 6/8 (verified + operator-ready). Decision 4 determines whether the program targets 8/8 or stops at 6/8 for peripheral modules.

The critical path through the 6 audit phases is:

```
Phase 1 (DB Foundation) ──[needs D6]──→ Phase 2 (API Layer) ──[needs D1, D2]──→ Phase 3 (Frontend Client) ──[needs D2]──→ Phase 4 (UI Integration) ──[needs D5]──→ Phase 5 (Operator Surfaces) ──→ Phase 6 (Legacy Cutover) ──[needs D2]
```

---

## 5. What can start before decisions (safe pre-work)

The following work is safe to begin immediately, regardless of which options are chosen for the 6 decisions:

1. **Feature flag infrastructure** — needed by all options for Decision 2 (even full replacement needs flags for gradual rollout). Build a simple flag system (`v8_<module>_enabled`) that can be checked in routes and frontend components.

2. **Auth middleware integration pattern** — G-05 must be solved regardless of first module choice. Design and implement the pattern for attaching V8 routes to the existing auth middleware. This is module-agnostic.

3. **V8 route scaffolding convention** — establish the file naming, folder structure, and Express router pattern for V8 routes. This is a 1-day task that prevents inconsistency once route creation begins.

4. **Real-DB test infrastructure** — set up a test database configuration that can run V8 tests against a real Postgres instance (using `DATABASE_PUBLIC_URL` per the Railway targeting rules). This is needed regardless of schema strategy.

5. **Migration runner setup** — extend the existing migration infrastructure to support V8-specific migrations. The runner itself is schema-strategy-agnostic; only the migration files depend on Decision 6.

6. **V8 service audit and dependency map** — catalog all 34 V8 services, their inter-dependencies, and their data persistence requirements. This informs Decisions 1 and 6 with concrete data.

7. **Socket.io namespace inventory** — document the existing Socket.io namespaces and events in the two legacy gateways. This informs Decision 5 regardless of which option is chosen.

Estimated pre-work duration: **1–2 weeks** with 1–2 engineers.

---

## 6. What must wait for decisions (blocked work)

The following work is blocked until specific decisions are made:

| Blocked work | Blocked by | Gap addressed |
| --- | --- | --- |
| Creating any V8 database table | Decision 6 (DB schema) | G-03 |
| Writing any real-DB integration test | Decision 6 (DB schema) | G-04 |
| Creating any V8 API route file | Decision 1 (first module) + Decision 2 (replacement strategy) | G-01 |
| Connecting any frontend component to V8 endpoint | Decision 1 + Decision 2 | G-02 |
| Setting feature flag values for production | Decision 2 (replacement strategy) + Decision 3 (timeline) | G-06 |
| Creating V8 WebSocket gateways | Decision 5 (WebSocket strategy) | G-07 |
| Writing the legacy cutover plan | Decision 2 (replacement strategy) | G-08 |
| Allocating engineers to Interview, Help/KB, Partner | Decision 4 (peripheral scope) | — |
| Committing to a stakeholder demo date | Decision 3 (timeline) | — |
| Designing the V8 API versioning scheme | Decision 2 (replacement strategy) | G-01 |

**Bottom line:** until Decisions 1, 2, and 6 are resolved, the program cannot create a single V8 table, a single V8 route, or a single real-DB test. The pre-work items in Section 5 are the only productive engineering work available.

---

## 7. Requested action from source-of-truth chat

Please resolve the 6 decisions in the order recommended in Section 2. For each decision, confirm or override the recommendation. The manager agent will begin pre-work (Section 5) immediately and will decompose Wave 1 work packets as soon as Decisions 6, 1, and 2 are confirmed.

---

## 8. Related canonical docs

- `V8_IMPLEMENTATION_MASTER_PROGRAM.md`
- `V8_FINAL_20_WAVE_IMPLEMENTATION_CLOSURE_PROGRAM.md`
- `AGENT_PROGRAM_OPERATING_MODEL_V8.md`
- `MANAGER_AGENT_HANDOFF_BRIEF_V8.md`
- `SYSTEMATYKA_PRZEGLADU_V8.md`
- `DOCUMENTATION_REGISTRY.md`
- `MULTIPLAYER_PLATFORM_ARCHITECTURE_AND_IMPLEMENTATION_CLOSURE_V8.md`
- `PM_SYNC_AND_CONNECTOR_IMPLEMENTATION_BACKLOG_V8.md`
