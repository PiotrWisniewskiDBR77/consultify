# T4 Charter - Landing Anna backend analytics / dashboard breadth

> Status: active
> Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
> Lane: `Landing Anna backend analytics / dashboard breadth`
> Taxonomy: `T4`
> Priority: highest
> Last updated: 2026-03-27

---

## 1. Goal

Promote the broader Landing Anna backend analytics / dashboard lane from visible backlog into active execution and close the split-brain between thin client-side widget telemetry and durable backend/operator truth.

This lane exists because the accepted Anna continuity, prompt-quality, and multilingual lanes improved the live public experience, but the public Anna funnel still lacks reliable anonymous backend ingest and a bounded operator-facing read summary.

---

## 2. In scope

- Public Anna funnel-event ingest for the already-shipped `landing_anna_*` event set
- Reuse of existing backend analytics storage where possible instead of inventing a new analytics system
- Thin backend/operator read summary for Landing Anna funnel activity
- Bounded frontend forwarding from the live Anna widget to the new backend seam
- Focused regression coverage for the promoted packet
- Evidence updates and plan/tracker/program status updates

---

## 3. Explicitly out of scope

- Full BI/dashboard productization or a bespoke Anna analytics UI module
- Broader authenticated journey analytics redesign
- Google Analytics / tag-manager rollout work
- Broader Anna voice UX / architecture product work
- Public landing redesign or broader marketing system work
- Tenant-level or customer-private analytics

---

## 4. First bounded packet

### Packet name

`Landing Anna public funnel ingest continuity`

### Why this packet starts first

- the live widget already emits `landing_anna_*` events
- those events still lack durable anonymous backend truth on the public path
- existing worker analytics already cover conversation/voice data partially, so the clearest first residual is funnel ingest continuity
- reusing the existing `conversion_events` seam keeps the packet bounded and avoids inventing a new analytics stack

### Packet scope

- add a bounded public ingest route for the existing Landing Anna funnel events
- persist those events into reusable backend analytics storage with a clear Anna source marker
- expose one thin superadmin summary read for the new Anna funnel data
- forward bounded public widget events to the backend seam without changing current UX behavior
- add focused backend and frontend regression

---

## 5. Lane acceptance target

This broader lane is not done after one backend write seam lands.

The lane will be accepted only when:

1. the remaining Anna analytics / dashboard residuals are broken into honest bounded packets,
2. those packets land with durable backend truth and operator-facing read continuity,
3. no smaller real analytics/dashboard packet remains,
4. and the lane can be accepted without silently broadening into full BI, broader voice-product work, or public redesign work.
