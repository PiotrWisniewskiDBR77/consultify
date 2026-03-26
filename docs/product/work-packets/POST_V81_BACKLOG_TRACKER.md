# Post-V8/V8.1 Backlog Tracker

> Status: active execution tracker
> Parent program: `docs/product/work-packets/POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM.md`
> Last updated: 2026-03-26

---

## 1. How To Use

This file is the operational checklist for backlog exit.

Use it together with the parent program:

- the program explains tranche order, rules, and acceptance,
- this tracker is where we move statuses and tick completion evidence.

Status vocabulary:

- `parked` = visible but not active
- `active` = currently in execution
- `blocked` = active but waiting on one explicit blocker
- `done` = accepted and closed
- `deferred` = intentionally outside execution

---

## 2. Tranche Board

| lane | taxonomy | tranche | status | owner lane | next move |
| --- | --- | --- | --- | --- | --- |
| `Calendar` | `T0` | `Tranche 0` | `active` | `Agent B + Agent C` | verify final staging proof after submit-path hardening |
| `Organization / Admin / Superadmin` | `T0` | `Tranche 0` | `blocked` | `Agent A + Agent C` | obtain a staging session with true superadmin entitlement; fresh deploy proof is recorded in `evidence/102-v8-superadmin-post-deploy-staging-proof.md` |
| `Reports / Presentations` | `T1` | `Tranche 1` | `parked` | `Agent B` | map V8/legacy split-brain before promotion |
| `Idea workspace` | `T1` | `Tranche 1` | `parked` | `Agent B + Agent C` | map runtime and collaboration split-brain |
| `Execution / delivery control` | `T2` | `Tranche 2` | `parked` | `Agent A` | write charter before promotion |
| `Results / KPI / ROI` | `T2` | `Tranche 2` | `parked` | `Agent A` | write charter before promotion |
| `Finance` | `T2` | `Tranche 2` | `parked` | `Agent A` | write charter before promotion |
| `Partner Program` | `T2` | `Tranche 2` | `parked` | `Agent A` | write charter before promotion |
| `Sync / connectors / interoperability` | `T2` | `Tranche 2` | `parked` | `Agent A` | write charter before promotion |
| `Multiplayer / collaboration` | `T2` | `Tranche 2` | `parked` | `Agent A` | write charter before promotion |
| `Notes` adjuncts | `T3` | `Tranche 3` | `parked` | `Agent C` | keep out of core tranche work |
| `Mobile / Landing / Communication / Edukacja / sheet ArtifactRun parity` | `T4` | `Parking lot` | `deferred` | `Manager` | explicit product unlock required |

---

## 3. Active Lane Checklists

### `Calendar`

Current status: `active`

- [x] bounded scope defined
- [x] governed conflict-check warning for `503` added
- [x] automated regression for warning path added
- [x] modal submit path hardened to native form submit
- [x] automated regression for native submit added
- [ ] final staging proof for create-submit captured
- [ ] carried blocker formally declared if staging proof is still impossible
- [ ] lane accepted and moved to `done`

### `Organization / Admin / Superadmin`

Current status: `blocked`

- [x] bounded scope defined
- [x] V8 diagnostics panel added
- [x] client methods for diagnostics/shadow reads added
- [x] automated regression for diagnostics surface added
- [x] frontend role guard hardened for `SUPERADMIN` / `SUPER_ADMIN`
- [x] active sidebar and nav-item access normalized for role variants
- [x] admin/support surfaces normalized for role variants
- [x] OAuth callback redirect normalized for superadmin role variants
- [x] RouterSync redirect logic normalized for superadmin role variants
- [x] centralized permissions hook normalized for superadmin role variants
- [x] fresh staging deploy retested after hardening
- [ ] valid superadmin staging route/session obtained
- [ ] bounded diagnostics surface proven live on staging
- [ ] lane accepted and moved to `done`

---

## 4. Promotion Queue

Nothing below may move to `active` until `Tranche 0` is closed or explicitly risk-accepted.

Order:

1. `Reports / Presentations`
2. `Idea workspace`
3. one selected `T2` parity lane only

---

## 5. Change Log

- 2026-03-26: created execution tracker linked to the debt reduction program
- 2026-03-26: marked `Calendar` submit hardening complete and expanded `Admin / Superadmin` role-variant hardening across navigation and support surfaces
- 2026-03-26: added auth-callback redirect hardening and regression coverage for superadmin landing
- 2026-03-26: added RouterSync and centralized permissions hardening so superadmin role variants follow the same route and capability path
- 2026-03-26: recorded fresh post-deploy staging proof; `/superadmin` still falls back to `/chat`, so the remaining blocker is now narrowed to real session entitlement on staging
