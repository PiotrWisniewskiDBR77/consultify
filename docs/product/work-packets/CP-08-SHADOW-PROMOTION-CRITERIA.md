# CP-08: Shadow Mode Promotion Criteria

**Status:** Active  
**Owner:** V8 Program Control  
**Created:** 2026-03-24  
**Decision ref:** D2 — Phased replacement with shadow mode

---

## Purpose

This document defines the criteria that must be met before a V8 module can be promoted from **shadow mode** (legacy response returned, V8 response logged) to **live mode** (V8 response returned to users).

Shadow mode is the risk-mitigation layer mandated by Decision D2. Promotion is a controlled, per-organization, per-module gate.

---

## Automated Promotion Criteria

All five criteria below must pass simultaneously. They are evaluated by `getShadowPromotionReadiness()` in `server/src/services/v8/shadowModeService.ts` and exposed via the `/v8/admin/shadow/promotion-readiness` API.

| # | Criterion | Threshold | Rationale |
|---|-----------|-----------|-----------|
| 1 | **Minimum comparison volume** | >= 100 recorded comparisons | Ensures statistical significance before any promotion decision. |
| 2 | **Response match rate** | >= 95% | V8 output must be functionally equivalent to legacy in the vast majority of cases. |
| 3 | **V8 error rate** | < 5% | V8 must not introduce server errors (status >= 400) beyond acceptable limits. |
| 4 | **V8 latency overhead** | < 100ms average | V8 processing must not add unacceptable latency compared to legacy. |
| 5 | **Recent mismatch window** | 0 mismatches in last 24 hours | Ensures current stability, not just historical averages. |

---

## Manual Approval Gate

Even when all automated criteria pass, promotion requires:

1. **Source-of-truth review** — A designated V8 program owner must review the shadow comparison dashboard and confirm readiness.
2. **Stakeholder sign-off** — The module owner (product/engineering lead) must approve the transition.
3. **Rollback plan confirmation** — A documented rollback procedure must exist and be tested before promotion.

---

## Monitoring Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /v8/admin/shadow/stats` | SuperAdmin | Aggregate shadow mode statistics for the org |
| `GET /v8/admin/shadow/comparisons?limit=N` | SuperAdmin | Recent comparison results (max 200) |
| `GET /v8/admin/shadow/promotion-readiness` | SuperAdmin | Pass/fail evaluation of all promotion criteria |

---

## Promotion Workflow

```
1. Enable shadow mode for org+module (feature flag: shadow_mode=1)
2. Shadow middleware intercepts requests, runs both legacy and V8
3. Legacy response is always returned to user
4. V8 response is logged via recordShadowComparison()
5. Monitor /v8/admin/shadow/stats until volume threshold met
6. Check /v8/admin/shadow/promotion-readiness — all criteria must pass
7. Manual review + stakeholder sign-off
8. Promote: switch feature flag from shadow_mode to live V8
9. Monitor for 48h post-promotion with instant rollback capability
```

---

## Rollback Policy

If any of the following occur after promotion:

- Error rate exceeds 5% over a 1-hour window
- Response time degrades by more than 200ms average
- Any critical business logic mismatch is reported

The module must be immediately reverted to shadow mode or legacy-only. Rollback is achieved by toggling the V8 feature flag back to `shadow_mode` or disabling V8 for the module entirely.

---

## Data Retention

Shadow comparison records are retained for **90 days** after creation. After promotion, historical shadow data serves as an audit trail and regression baseline.
