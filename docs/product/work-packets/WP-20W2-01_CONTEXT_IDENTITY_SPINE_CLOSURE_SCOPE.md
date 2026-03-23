# WP-20W2-01 — Context Identity Spine Closure Scope

> Status: Complete
> Wave: 20W-2 (Context and runtime identity spine)
> Type: Control packet
> Date: 2026-03-23
> Governing SSOT: AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md, AI_CORE_V8_READINESS_AUDIT.md

---

## 1. Wave 2 objective

Close the `ContextSnapshot` identity spine to production-grade closure across all 5 dimensions:
- **platform/core**: identity chain, drift detection, versioning runtime
- **integration**: consumer binding (Chat, Execution, Knowledge)
- **UI/product surface**: deferred to Wave 9+ (no UI work in Wave 2)
- **operator/support**: snapshot inspection, drift audit trail
- **content/seed**: not applicable

---

## 2. What exists (foundation from prior 7-wave cycle)

| Asset | Status |
|-------|--------|
| `contextSnapshot.ts` — types, interfaces, Zod schemas | Complete |
| `20260323_v8_context_snapshot.sql` — 1 table, 5 indexes | Complete |
| `contextSnapshotService.ts` — capture, get, getByConversation, getByRun, detectDrift, recordDriftEvent | Complete |
| `contextSnapshotService.test.ts` — unit tests | Complete |
| T1 contract integration test — schema compatibility verified | Complete |

---

## 3. What is missing (gap to closure)

### 3.1 Production identity chain (WP-20W2-02)

| Gap | Description | Binding decision |
|-----|-------------|-----------------|
| **Identity chain continuity** | Snapshots are captured but not chained — no `parent_snapshot_id` linking conversation→run→retrieval | D1 (runs bound to originating context) |
| **Snapshot versioning runtime** | `snapshot_version` field exists but no auto-increment logic when identity fields change within a session | §1.3 rule 2 (immutable after capture, new version on change) |
| **Drift detection runtime** | `detectDrift()` exists as pure function but is never called automatically — no runtime trigger on context change | D1, D10 |
| **Retention enforcement** | D3 mandates 30-day baseline retention — no cleanup/archival logic exists | D3 |
| **Multi-tab divergence detection** | `multi_tab_divergence` drift type defined but no detection mechanism | D1 |

### 3.2 Consumer integration (WP-20W2-03)

| Gap | Description | Binding decision |
|-----|-------------|-----------------|
| **Chat consumer binding** | `ChatExecutionHandoff` references `contextSnapshotId` but chat service doesn't call `captureSnapshot()` before handoff | D2 (user/run-visible retrieval must use full snapshot) |
| **Execution consumer binding** | `ExecutionAgentRun` has no `contextSnapshotId` field — runs are not bound to their originating snapshot | D1 |
| **Knowledge/retrieval consumer binding** | `RetrievalScopeToken` is derived from snapshot but `knowledgeRetrievalService` doesn't call snapshot capture | D2, W2-4 |
| **Consumer class enforcement** | Consumer class is declared in schema but no runtime validation that the declaring consumer matches | D4 |
| **Cross-consumer snapshot sharing** | When chat hands off to execution, the execution run should inherit the chat snapshot — no inheritance logic | D1, §1.3 rule 3 |

---

## 4. Acceptance criteria (Definition of Done)

### 4.1 Platform/core

- [ ] `ContextSnapshot` supports identity chain via `parentSnapshotId` field
- [ ] Snapshot versioning auto-increments within a session when identity fields change
- [ ] Drift detection runs automatically on snapshot capture (compares with previous in chain)
- [ ] Retention policy enforced: snapshots older than 30 days are marked for archival
- [ ] Multi-tab divergence detection implemented via workspace-scoped session tracking

### 4.2 Integration

- [ ] Chat service captures a `ContextSnapshot` before every handoff to execution
- [ ] `ExecutionAgentRun` creation requires and records a `contextSnapshotId`
- [ ] Knowledge retrieval requests bind to the active snapshot via `RetrievalScopeToken`
- [ ] Cross-consumer inheritance: execution run inherits chat conversation snapshot
- [ ] Consumer class is validated at capture time (declared class must match calling service)

### 4.3 Operator/support

- [ ] Snapshot chain is queryable: given any snapshot, traverse to root
- [ ] Drift events are queryable by organization + time range
- [ ] Retention status is visible in snapshot metadata

### 4.4 Verification (WP-20W2-04)

- [ ] Integration test: Chat → capture snapshot → handoff → Execution inherits snapshot → Knowledge retrieval binds to snapshot
- [ ] Integration test: Drift detection fires on project switch mid-session
- [ ] Integration test: Snapshot chain traversal from leaf to root
- [ ] Unit tests for all new service methods

---

## 5. Out of scope for Wave 2

- UI surfaces for snapshot inspection (Wave 9+)
- Admin controls for retention policy configuration (Wave 20)
- Privacy mode enforcement details (Wave 6 trust layer)
- Background/worker consumer specialization (deferred per D4)

---

## 6. Packet queue

| Packet | Type | Depends on | Parallelizable |
|--------|------|-----------|----------------|
| WP-20W2-01 | Control (this) | — | — |
| WP-20W2-02 | Implementation | WP-20W2-01 | Yes (with WP-20W2-03) |
| WP-20W2-03 | Implementation | WP-20W2-01 | Yes (with WP-20W2-02) |
| WP-20W2-04 | Verification | WP-20W2-02 + WP-20W2-03 | No |
