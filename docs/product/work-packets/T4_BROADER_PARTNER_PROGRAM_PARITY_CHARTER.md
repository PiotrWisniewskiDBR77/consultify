# T4 Charter - broader `Partner Program` parity

> Status: active
> Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
> Lane: broader `Partner Program` parity
> Taxonomy: `T4`
> Priority: highest
> Last updated: 2026-03-27

---

## 1. Goal

Promote the broader `Partner Program` parity lane from visible backlog into active execution and close the remaining split-brain between the already accepted bounded `Partner Program` lane and a coherent broader partner product/runtime parity surface.

This lane exists because the accepted `Partner Program` cut proved bounded V8-first continuity around payout request, campaign create/delete, and visible organization profile settings, but it explicitly left onboarding, client-access, statement and payout history data sources, and wider partner workflow breadth outside that bounded scope.

---

## 2. In scope

- Broader partner parity breadth on live partner-authenticated portal surfaces
- Residual split-brain mapping across statements, payouts, onboarding/client-access, and wider partner workflow continuity
- Bounded packets chosen only after the remaining active broader partner residual stays explicit
- Focused regression coverage for any promoted broader partner packets
- Evidence updates and plan/tracker/program status updates

---

## 3. Explicitly out of scope

- Reopening the accepted bounded `Partner Program` continuity packets around payout request, campaign create/delete, or organization settings
- Placeholder-only `payout-settings` save behavior that still lacks a real backend contract
- Whole-partner redesign, full onboarding rebuild, or one-shot client/project/certification/resource migration
- Finance, Sync, Multiplayer, or other already accepted/bounded non-partner lanes
- Unbounded backend or product restructures framed as one more parity packet

---

## 4. First bounded packet

### Packet name

`partner payout history read V8 seam`

### Why this packet starts first

- the live partner portal already exposes a real `Payout History` surface backed by a real legacy route, not placeholder-only UI
- live proof already shows that `GET /api/partners/payouts` is the most visibly broken active residual because it fails on staging while the governed V8 summary above it succeeds
- this packet is smaller and more honest than pulling in broader client-access onboarding breadth or commission-statement dataset migration in one step
- it closes one active partner-facing read seam without silently broadening into all earnings/statement workflow parity

### Packet scope

- add governed V8 parity for `GET /api/partners/payouts`
- move the active payout-history read in `src/views/partner/sections/EarningsSection.tsx` onto a governed V8-first seam
- keep commission-transaction history, client-access onboarding, payout-settings save, and wider partner breadth outside this packet

---

## 5. Lane acceptance target

This broader lane is not done after one payout-history read packet.

The lane will be accepted only when:

1. the remaining broader `Partner Program` residuals are broken into honest bounded packets,
2. those packets land with real runtime and surface continuity,
3. no smaller real packet remains,
4. and the lane can be accepted without silently broadening into a whole partner-platform redesign.
