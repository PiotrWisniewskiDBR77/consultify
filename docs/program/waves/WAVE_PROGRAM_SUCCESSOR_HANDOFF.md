# Consultify closure program — successor map

Date: `2026-08-21`  
Workspace: `/Users/piotrwisniewski/Developer/Consultify`  
Branch at preparation: `codex/wave2-browser-transfer-20260821`  
Document status: `WAVE_2_CLOSED / WAVE_3_HANDOFF`

## Purpose

This document tells the next integrator where the full closure program is
defined and how the current Wave documents relate to the authoritative
82-task denominator. It is an index, not a replacement for the source files.

Do not treat a green local test, historical screenshot or a completed bounded
subpacket as product, owner, staging or release acceptance. Do not push,
deploy, touch production or infer release authority from this handoff.

## Read order and authority

1. `docs/cleanup/POST_CLEANUP_COMPLETION_PLAN.md` — master completion plan.
   It defines the `74 module tasks + 8 cross-program tasks = 82` denominator,
   statuses, dependencies, owner decisions, evidence contract, release gates
   and the eight-step execution sequence.
2. `docs/program/waves/WAVE_02_REMAINING_11_RECONCILIATION.md` — truthful
   reconciliation of the eleven tasks inherited as incomplete. The current
   reported denominator is `73 DONE_CURRENT_SHA / 9 PARTIAL`.
3. `docs/program/waves/WAVE_01_GATE_REPORT.md` plus the other `WAVE_01_*`
   files — Wave 1 critical recovery, dispositions and evidence.
4. `docs/program/waves/WAVE_02_CORE_CLOSURE_BACKLOG.md` and
   `docs/program/waves/WAVE_02_GATE_REPORT.md` — Wave 2 scope, gates and exact
   bounded results.
5. `docs/program/waves/WAVE_03_16_MODULE_OWNER_ACCEPTANCE_REGISTER.md` — the
   exact-SHA collaborative UI/UX acceptance register for all 16 modules.
6. `docs/cleanup/agents/` — executable task packets and ownership allocations.
   These packets do not override the master denominator or integrator-only
   authority.

Historical wave/phase documents elsewhere in `docs/` are evidence and design
context only unless one of the current documents above explicitly incorporates
them. They are not a second completion plan.

## What the current Waves contain

### Wave 1 — critical recovery and truthful baseline

Wave 1 triaged inherited critical risks and separated technical closure from
release claims. Its files cover:

- Chat NFR disposition;
- Finance PostgreSQL `25P02` root-cause evidence;
- Teresa UI/action parity inventory;
- the critical recovery triage and Wave 1 gate report.

Wave 1 promoted `CHAT-NFR-001` only within its accepted technical scope. It did
not authorize production or silently close the other inherited partial tasks.

### Wave 2 — bounded core closure

Wave 2 contains four bounded packets:

- P1: Finance Statement exact-six API/identity contract;
- P2: Results legacy-writer disposition plus the Dynamic SWOT transformation
  subflow on real PostgreSQL;
- P3: Teresa explicit MVP action denominator/parity;
- P4: Dynamic SWOT header behavior and the mandatory browser click gate.

The real-PostgreSQL Transform proof is `4 passed / 1 retired legacy skipped`.
This closes the SWOT subflow, not the parent end-to-end transformation task.
The full parent still requires Organization/Interview/DRD/SWOT → Initiative →
Execution → Results Actual → Finance reconciliation → PIR, desktop/mobile and
rollback proof.

The durable-workspace transfer candidate is recorded in the Wave 2 and Wave 3
reports. Before continuing, the successor must re-read the actual current Git
branch, clean/dirty state and HEAD; document metadata never replaces that
check.

Piotr recorded `OWNER_ACCEPTED` on `2026-08-21` for the bounded P4 result on
product SHA `a36d9d51edc87bb63e7211754e22106d02d2d3d0`. The decision was explicitly
qualified: the current UX is unsatisfactory but accepted as-is for Wave 2, and
the broader quality work is carried into Wave 3. This does not authorize push,
deployment or production contact.

### Wave 3 — collaborative acceptance of all 16 modules

Wave 3 is the owner-assisted UI/UX round for:

`Chat, My Work/Agent, Interview, Tools, Assessment, Initiatives, Execution,
Results, Finance, Materials, Audits, Meetings, Organization, Admin, Settings,
Partner`.

Each module requires one frozen exact SHA, mounted runtime readback, realistic
persona and fixtures, positive plus negative journeys, desktop/tablet,
light/dark, PL/EN, screenshots, console/network, keyboard/focus and axe
evidence. Every finding is P0-P3; P0/P1 must close and P2/P3 require an explicit
disposition. Only Piotr can record `OWNER_ACCEPTED` with date and exact SHA.
Mobile remains a separate future development workstream and is
`DEFERRED_NON_GATING` until Piotr freezes that scope.

Browser control is available in the durable workspace, but the 16 module
rounds have not been replayed on the transfer candidate. All rows therefore
remain fail-closed.

## Later program work: defined sequence, not yet frozen Wave files

There are currently no authoritative standalone `WAVE_04_*` through
`WAVE_07_*` documents in this repository. The master plan nevertheless defines
the remaining work and order. Until Piotr freezes names and packet boundaries,
the successor must call the following a proposed mapping, not completed or
approved Waves:

1. **Proposed Wave 4 — full transformation integration.** Finish the parent
   `FLOW-TRANSFORM-MVP-001` chain, real PostgreSQL, desktop/mobile, lineage,
   idempotency and rollback. Preserve the completed SWOT proof as one subflow.
2. **Proposed Wave 5 — remaining domain and owner-policy closure.** Finish the
   outstanding Finance writer families and obtain explicit decisions for
   Materials provider/provenance, Audits rights/methodology, Settings deletion
   boundary and Partner economics boundary.
3. **Proposed Wave 6 — NFR, recovery and release-candidate rehearsal.** Run the
   broad performance, observability, security/privacy, DR, static/type/build/
   test and fresh+upgrade database matrices only after source freeze. Admin
   backup remains open until an authorized staging restore rehearsal exists.
4. **Proposed Wave 7 — demo and separately authorized release.** Replay 16
   golden flows on one exact candidate and prepare release evidence. Production
   release `REL-001-T01` remains `NOT_AUTHORIZED` until all predecessor gates
   and Piotr's explicit release authorization exist.

This mapping follows the master plan's execution dependencies; it must not be
used to promote any of the nine remaining partial tasks.

## The 82-task register in one view

The master denominator consists of 74 module tasks:

| Module | Count | Module | Count |
|---|---:|---|---:|
| Chat | 3 | My Work + Agent | 4 |
| Interview | 3 | Tools | 3 |
| Assessment | 3 | Initiatives | 6 |
| Execution | 5 | Results | 5 |
| Finance | 6 | Materials | 7 |
| Audits | 7 | Meeting | 3 |
| Organization | 3 | Admin | 4 |
| Settings | 6 | Partner | 6 |

plus eight cross-program tasks. Machine reconciliation is performed by
`scripts/cleanup/report-closure-progress.mjs`; packet structure is verified by
`scripts/cleanup/verify-closure-plan.mjs`. Never edit totals by hand to match a
desired verdict.

## Current inherited open boundary

The original eleven incomplete tasks are reconciled individually in
`WAVE_02_REMAINING_11_RECONCILIATION.md`. Two were technically promoted:
`CHAT-NFR-001` and `RES-MVP-LEGACY-CUTOVER-001`. Nine remain partial or gated:

- `FIN-MVP-CUTOVER-001`;
- `FIN-UI-CANON-001`;
- `MAT-POL-001` (`BLOCKED_OWNER`);
- `AUD-POL-001` (`BLOCKED_OWNER`);
- `ADM-MVP-BACKUP-001`;
- `SET-MVP-DELETE-001` (`APPROVED_OUT_BOUNDARY`);
- `PRT-MVP-ACCRUAL-001` (`APPROVED_OUT_BOUNDARY`);
- `FLOW-TRANSFORM-MVP-001`;
- `REL-001-T01` (`NOT_AUTHORIZED`).

The successor must use each row's literal missing gate and next authorized
action. “Partial” is not a generic coding queue: some rows need owner, legal,
staging or release authority before mutation.

## Successor start protocol

1. Work only in the durable workspace above unless Piotr explicitly changes
   the canonical location.
2. Read this index and all six authoritative sources in the order listed.
3. Verify Git branch, HEAD, status and candidate ancestry without reset, clean
   or stash.
4. Run the two closure-plan verification scripts and record exact output.
5. Re-establish a single exact-SHA non-production runtime before browser work.
6. Resume only the explicitly authorized Wave. Do not mix Wave 3 owner rounds
   with later release qualification.
7. Update evidence and gate reports on the exact tested SHA; preserve
   `PARTIAL`, `BLOCKED_OWNER`, `EVIDENCE_MISSING` and `NOT_AUTHORIZED` literally.

## Completion semantics

- `INTEGRATION_READY` means the bounded candidate and evidence are coherent.
- `DEMO_READY` additionally requires mounted exact-SHA golden-flow replay.
- `PRODUCTION_READY` additionally requires all external gates and explicit
  release authority.

None of those states may be inferred from the other two.
