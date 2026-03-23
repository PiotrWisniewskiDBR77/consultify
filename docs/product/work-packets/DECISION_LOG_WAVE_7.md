# V8 Program — Wave 7 Decision Log

> Status: Closed
> Authority: Source-of-truth chat decisions
> Date: 2026-03-23
> Scope: binding decisions for Wave 7 escalation items from packets WP-W7-ROOF-01, WP-W7-ROOF-02, WP-W7-ROOF-03

---

## MyWork roof package

### Decision W7-1 — Cross-surface state propagation

- One object keeps one canonical state across Home, Calendar, and Inbox.
- Surfaces may show different projections, not different truths.
- Deduplication by canonical object identity; state updates propagate to all surfaces.
- Surface-local UI state may differ; object state may not.
- Inbox may hold pre-materialized intake state, but once promoted, canonical object truth wins.

### Decision W7-2 — Non-Radar Home blocks

- Treat non-Radar Home blocks as mixed maturity.
- Wave 7 must explicitly classify all 8 blocks into: `backed by real service`, `partial / stitched`, `placeholder / non-canonical`.
- Do not present placeholder blocks as equal to Radar-grade blocks.
- Rule: `Home may stay heterogeneous temporarily, but truth labels must be explicit`.

### Decision W7-3 — Inbox materialization

- Inbox materialization is event-driven through the notification/signal spine.
- Baseline acceptable latency: target near-real-time; acceptable operational ≤ 60s; degraded but acceptable ≤ 5 min.
- Beyond that, surface shows delayed/degraded state honestly.

### Decision W7-4 — Calendar hardening phasing

- Formally split: Phase A = internal-only Calendar hardening in Wave 7; Phase B = external sync hardening after Wave 5 connector foundations are ready.
- Rule: `do not block internal Calendar quality on external sync readiness`.

---

## Tools v8 + Organization/Admin

### Decision W7-5 — Classic framework templates registry

- Use the Known Tools table as the primary shared registry.
- Do not create a disconnected parallel registry unless a later scale problem forces it.
- Classic framework templates live as a typed family/subtype inside the shared tools registry.
- Rule: `one shared registry, typed families`.

### Decision W7-6 — Consulting tool AI governance granularity

- Both session-level and action-level governance.
- Session-level defines broad mode, permissions, and context boundaries.
- Action-level decides whether a specific AI action can execute, propose, or requires approval.
- Rule: `session sets the sandbox, action decides the gate`.

### Decision W7-7 — Unified admin surface ownership

- Unified admin surface owned as a horizontal product layer, not by one module only.
- Organization Settings owns tenant-facing admin.
- Superadmin owns platform/operator-facing administration.
- Module-specific settings remain embedded sub-surfaces where needed.
- Rule: `shared IA at top, module settings underneath, not competing roots`.

### Decision W7-8 — Tools V8 SSOT

- Author a bridging `Tools V8 SSOT` in Wave 7.
- Connects: V3 tool contracts, V8 platform/runtime/governance requirements, AI governance, session/knowledge/promotion rules.
- Needed to stop Tools from remaining a strong-but-legacy island.

---

## Landing + broader Superadmin

### Decision W7-9 — `ANNA_LP_ASSISTANT_CONTRACT_V8.md`

- Recreate or restore. Missing-file state is not acceptable for a canonical reference.
- If original content cannot be recovered, recreate a minimal canonical contract first, then deepen later.

### Decision W7-10 — `SUPERADMIN_V8_SSOT.md`

- Create a horizontal `SUPERADMIN_V8_SSOT.md` as a Wave 7 deliverable.
- Existing vertical superadmin packages are not enough.
- Doc should mount the whole IA and ownership model across domains.

### Decision W7-11 — Demo/trial V8 refresh

- Demo/trial should be refreshed to V8 narrative as part of Landing V8.
- Do not leave demo/trial at V3 if Landing moves to V8.
- Can be a scoped Wave 7 refresh; not a blocker for earlier platform/runtime waves.
- Rule: `commercial narrative surfaces should converge together`.

---

## Wave 7 closure

Wave 7 is formally closed as of 2026-03-23 with 3 completed packets and 11 binding decisions.

---

## Related packets

- `WP-W7-ROOF-01_MYWORK_ROOF_PACKAGE.md`
- `WP-W7-ROOF-02_TOOLS_ORG_ADMIN.md`
- `WP-W7-ROOF-03_LANDING_SUPERADMIN.md`
