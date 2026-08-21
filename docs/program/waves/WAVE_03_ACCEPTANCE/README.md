# Consultify Wave 3 — 16-module acceptance system

Date opened: `2026-08-21`

Branch: `codex/wave3-16-module-acceptance-20260821`

Entry checkpoint: `ec43f3c60b6998012da680380cdc28604dee3bec`

Status: `WAVE_3_STARTED / ORGANIZATION_PREPARATION_PENDING`

## Authority

This folder is the execution system for Wave 3. The existing
`../WAVE_03_16_MODULE_OWNER_ACCEPTANCE_REGISTER.md` remains the program-level
readiness and verdict register. This folder owns detailed execution state,
owner observations, evidence paths, remediation and retest records.

There is no second findings queue. A Piotr observation is captured only when it
has a durable ID in the relevant module register. Chat and temporary screenshot
paths are intake channels, never the source of truth.

## Objective

Qualify all 16 Consultify modules through the agreed complete cycle:

1. open the module packet;
2. freeze baseline;
3. map product journeys;
4. prepare personas;
5. prepare realistic reproducible local fixtures;
6. pass functional preflight;
7. pass technical and visual preflight;
8. prepare the Piotr review card;
9. capture first impression;
10. run the guided customer journey;
11. review alternate states;
12. capture every owner observation and screenshot;
13. reconcile and confirm the owner register;
14. analyze solution and impact;
15. implement;
16. pass integrator self-QA;
17. prepare owner retest;
18. obtain owner retest decisions;
19. close the module on an exact SHA;
20. run later-change regression;
21. complete the final 16/16 replay.

The numbered module checklists use gates `G00`–`G20` matching this sequence.

## Non-negotiable controls

- Work only in an isolated or explicitly authorized non-production runtime.
- No push, deployment or production contact without separate authorization.
- Mobile is `DEFERRED_NON_GATING` for Wave 3.
- Desktop `1440`, tablet `768`, PL/EN and light/dark are gating.
- Every checklist row is `PASS`, `FAIL`, `BLOCKED` or justified
  `NOT_APPLICABLE`; blank is incomplete.
- Every owner observation keeps Piotr's original wording and receives an ID.
- Every chat/temporary screenshot is copied into durable module evidence and
  hashed before the source can disappear.
- A changed product SHA invalidates affected acceptance evidence until retest.
- P0/P1 must close. P2/P3 require an explicit disposition.
- `DEFERRED` requires a target Wave, reason, owner and reopen condition.
- An implementation is not a closure. Self-QA and owner retest are mandatory.

## Execution order

1. Organization
2. Interview
3. Tools
4. Assessment
5. Initiatives
6. Execution
7. My Work / Agent
8. Meetings
9. Results
10. Finance
11. Materials
12. Audits
13. Chat
14. Admin
15. Settings
16. Partner

## Control files

- `MASTER_STATUS_REGISTER.md` — one row per module and the current gate.
- `SHA_RUNTIME_LEDGER.md` — exact candidate/runtime chain and invalidations.
- `CROSS_MODULE_FINDINGS.md` — shared-component findings only; module detail
  remains in its module register.
- `FINAL_16_MODULE_REPLAY.md` — final one-SHA replay contract.
- `MODULE_TEMPLATE.md` — canonical structure copied into every module packet.
- `modules/*/MODULE_ACCEPTANCE.md` — the 16 authoritative module registers.

Structural integrity is fail-closed and can be replayed with:

```bash
node scripts/wave3/verify-acceptance-packages.mjs
```

The verifier requires exactly 16 canonical directories and master rows, one
`G00`–`G20` checklist per module, all durable register sections and
`Mobile: DEFERRED_NON_GATING` in every package. It verifies structure only; it
does not promote any functional, browser or owner gate.

## Status lifecycle

`NOT_STARTED → PREPARING → READY_FOR_OWNER_REVIEW → OWNER_REVIEW_IN_PROGRESS →
REGISTER_CONFIRMATION_REQUIRED → REGISTER_CONFIRMED → IN_IMPLEMENTATION →
SELF_QA → READY_FOR_OWNER_RETEST → OWNER_RETEST_IN_PROGRESS →
MODULE_ACCEPTED_ON_SHA → REGRESSION_REQUIRED → FINAL_ACCEPTED`

`FIX_REQUIRED`, `BLOCKED`, `ACCEPTED_OUT` and `DEFERRED` are explicit branch
states; none silently means acceptance.
