# WP-20W1-04 — Wave 2-6 Readiness Assessment

> Status: Complete
> Wave: 20W-1 (Registry, decision and packet convergence)
> Type: Manager-owned analysis packet
> Date: 2026-03-23

---

## 1. Objective

Assess readiness for Waves 2-6 of the 20-wave program. Determine which waves can proceed immediately, which need prerequisites, and propose the initial execution plan.

---

## 2. Assessment methodology

Each wave is assessed against:
- **Foundation**: Do types, schemas, migrations, services, and tests exist?
- **Canonical docs**: Are the governing SSOTs and runtime docs available?
- **Decisions**: Are all required architecture decisions made?
- **Dependencies**: Are upstream waves satisfied?
- **Gap severity**: What is the gap between foundation and closure?

---

## 3. Wave-by-wave assessment

### Wave 2 — Context and runtime identity spine

**Foundation**: EXISTS
- `contextSnapshot.ts` — types + Zod schemas
- `20260323_v8_context_snapshot.sql` — 4 DB tables
- `contextSnapshotService.ts` — full CRUD + capture + audit
- Unit test: passing

**Canonical docs**: Strong
- AI core SSOT, AI closure program, readiness audit all exist

**Decisions**: Complete
- D1-D4 (context binding, retrieval scope, retention, single family) — all valid
- D10 (ACL staleness windows) — valid

**Dependencies**: None — Wave 2 is the first implementation wave

**Gap to closure**:
- Production `ContextSnapshot` identity chain proof
- Drift detection runtime
- Real identity chain across Chat, Execution, Knowledge consumers
- Admin-facing controls for snapshot management

**Readiness**: **GREEN — ready to start**

**Proposed packets** (4):
1. `WP-20W2-01` — Control: Context identity spine closure scope + acceptance criteria
2. `WP-20W2-02` — Implementation: Production ContextSnapshot wiring (identity chain, drift detection)
3. `WP-20W2-03` — Implementation: Consumer integration (Chat, Execution, Knowledge bind to ContextSnapshot)
4. `WP-20W2-04` — Verification: Identity spine integration proof

---

### Wave 3 — Governed retrieval and source access

**Foundation**: EXISTS
- `governedRetrieval.ts` + `knowledgeRetrievalIntegration.ts` — types + schemas
- 2 migrations, 2 services, 2 unit tests, 1 integration test

**Canonical docs**: Strong
- Knowledge SSOT, retrieval architecture docs exist

**Decisions**: Complete
- D10-D12 (ACL staleness, admin presets, web search separation) — valid
- W2-4, W2-5 (working memory ref, connector vs internal freshness) — valid

**Dependencies**: Wave 2 (ContextSnapshot identity must exist for retrieval to bind to)

**Gap to closure**:
- Real ACL enforcement against live data sources
- Freshness runtime with staleness detection
- Scope traceability in production
- Sync-aware retrieval (connector-backed sources)

**Readiness**: **YELLOW — ready after Wave 2 closes**

**Proposed packets** (4):
1. `WP-20W3-01` — Control: Retrieval closure scope + ACL enforcement criteria
2. `WP-20W3-02` — Implementation: ACL enforcement + freshness runtime
3. `WP-20W3-03` — Implementation: Scope traceability + sync-aware retrieval
4. `WP-20W3-04` — Verification: Retrieval governance proof

---

### Wave 4 — Execution proposal and approval spine

**Foundation**: EXISTS
- `executionSpine.ts` — types + schemas
- 1 migration, 1 service, 1 unit test

**Canonical docs**: Strong
- Execution agent SSOT, AI closure program

**Decisions**: Complete
- D13-D15 (review SLA, rejection re-plan, batched approval) — valid
- D19-D22 (tool risk, policy overrides, subagent creds, background jobs) — valid

**Dependencies**: Wave 2 (ContextSnapshot for run binding), partially Wave 3 (retrieval for context enrichment)

**Gap to closure**:
- Real approval flow wiring (propose → review → approve/reject → apply)
- Rebaseline/review reuse from W3-10
- Chat handoff integration (from Wave 9, but basic spine can close independently)

**Readiness**: **YELLOW — ready after Wave 2 closes; can run parallel with Wave 3**

**Proposed packets** (4):
1. `WP-20W4-01` — Control: Execution spine closure scope
2. `WP-20W4-02` — Implementation: Approval flow wiring (propose → approve → apply)
3. `WP-20W4-03` — Implementation: Rebaseline integration + review reuse
4. `WP-20W4-04` — Verification: Execution spine proof

---

### Wave 5 — Tool governance, HITL and background mutation safety

**Foundation**: EXISTS
- `toolGovernance.ts` — types + schemas
- 1 migration, 1 service, 1 unit test, 1 integration test

**Canonical docs**: Strong
- Tool governance within AI core docs

**Decisions**: Complete
- D19-D22 (risk class, policy overrides, subagent creds, background jobs) — valid

**Dependencies**: Wave 4 (execution spine for proposal/approval), Wave 2 (context for consumer class)

**Gap to closure**:
- Real consumer class enforcement
- Deferred approval paths for background mutations
- Subagent governance runtime
- Prompt OS runtime discipline integration

**Readiness**: **YELLOW — ready after Wave 4 closes**

**Proposed packets** (4):
1. `WP-20W5-01` — Control: Tool governance closure scope
2. `WP-20W5-02` — Implementation: Consumer class enforcement + deferred approval
3. `WP-20W5-03` — Implementation: Subagent governance + background mutation safety
4. `WP-20W5-04` — Verification: Tool governance proof

---

### Wave 6 — Trust, provenance and support observability

**Foundation**: EXISTS
- `trustAudit.ts` — types + schemas
- 1 migration, 1 service, 1 unit test

**Canonical docs**: Strong
- Trust/audit within AI core docs, support observability

**Decisions**: Complete
- D23-D26 (hybrid trust class, baseline provenance, routing explanation, degraded state) — valid

**Dependencies**: Wave 2 (context identity), Wave 4 (execution for provenance), Wave 5 (tool governance for trust signals)

**Gap to closure**:
- Real routing explanation in production
- Degraded-state vocabulary runtime
- Operator/support surfaces for trust inspection
- Provenance ledger wiring to saved/approved/shared outputs

**Readiness**: **YELLOW — ready after Wave 5 closes; can partially overlap**

**Proposed packets** (5):
1. `WP-20W6-01` — Control: Trust/provenance closure scope
2. `WP-20W6-02` — Implementation: Provenance ledger wiring
3. `WP-20W6-03` — Implementation: Routing explanation + degraded-state runtime
4. `WP-20W6-04` — Implementation: Operator/support trust surfaces
5. `WP-20W6-05` — Verification: Trust observability proof

---

## 4. Execution plan for Waves 2-6

```
Timeline (sequential with overlap):

Wave 2 ─────────────┐
                     │
Wave 3 ──────(after W2)──────┐
                              │
Wave 4 ──────(after W2, parallel with W3)──────┐
                                                │
Wave 5 ──────(after W4)──────┐                  │
                              │                  │
Wave 6 ──────(after W5, can overlap W5 tail)────┘
```

**Critical path**: W2 → W4 → W5 → W6

**Parallel track**: W3 runs alongside W4 (both depend on W2, not on each other)

---

## 5. Summary

| Wave | Readiness | Dependencies | Proposed packets | Gap severity |
|------|-----------|-------------|-----------------|-------------|
| W2 | **GREEN** | None | 4 | Medium |
| W3 | YELLOW | W2 | 4 | Medium |
| W4 | YELLOW | W2 | 4 | Medium |
| W5 | YELLOW | W4 | 4 | Medium |
| W6 | YELLOW | W5 | 5 | Medium |
| **Total** | | | **21** | |

---

## 6. Recommendation

**Start Wave 2 immediately.** It has no dependencies, full foundation, complete decisions, and strong canonical docs. The 4 proposed packets fit the recommended shape (1 control + 2 implementation + 1 verification).

After Wave 2 verification passes, launch Wave 3 and Wave 4 in parallel. This maximizes throughput on the critical path while respecting dependency constraints.
