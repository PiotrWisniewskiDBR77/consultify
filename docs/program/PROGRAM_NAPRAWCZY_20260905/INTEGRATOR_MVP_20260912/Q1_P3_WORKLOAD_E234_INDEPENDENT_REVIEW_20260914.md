# Q1 P3 Obciążenie E2–E4 — exact-SHA independent review

**Verdict: HOLD for candidate `660214cb9c2e2419f6ee65e841e05fa9576a6119` on base `29d1db9f00793dab6aeac5f68656200cddf9e529`.** The E2–E4 behavior and technical gates pass, but the freeze lacks a hash manifest and the two previews expose active Open buttons whose handlers do nothing.

## Findings

### P1 — no exact freeze manifest

The candidate tracks 17 Q1 freeze/evidence paths (the freeze document plus 16 E2–E4 screenshot and browser-receipt paths), but zero path contains a freeze manifest. `Q1_P3_WORKLOAD_E234_FREEZE_20260914.md` is a narrative receipt; it does not bind the reviewed files to byte counts and hashes or identify a self-excluded manifest/content commit. The Wpis 42 freeze gate therefore cannot prove that the reviewed evidence and source set are the exact frozen set.

Required closure: generate a self-excluding manifest from a content commit, include every path in the exact candidate delta with byte count and SHA-256, record the content SHA/base/evidence byte total, then create a new freeze commit and immutable backup.

### P1 — two active Open buttons are dead

`src/components/Initiatives/InitiativeWorkloadSurface.tsx:616` and `:711` pass `onOpenFull={() => undefined}` to `TableWithPreviewLayout`. The shared layout treats the presence of this callback as a backed capability and renders an enabled Open button. Both EN/PL screenshots visibly expose it, but clicking it cannot navigate or perform any action. This violates the Wpis 35 requirement that preview actions be real.

Required closure: connect each header Open to a real destination, or omit `onOpenFull` and either omit the control or provide an honest disabled reason supported by the shared component. Add a mounted behavior test that clicks the header action and proves the result, or proves the intentional disabled state.

### P2 — `Approved` can be read as proposal approval

The proposal preview uses the initiative status as a standalone `Approved` / `Zatwierdzony` pill next to `Planning only`. Since the screen says that suggestions require human approval, the unqualified pill can be read as the proposal's approval status. Label it with context (for example, `Initiative: Approved`) or move it to a named property.

## Passing evidence

- All four test files in the exact delta were run separately with `--retry=0`: **12/12 PASS**.
- Real PostgreSQL through ApiGateway and signed JWT on package port 5291: **2/2 PASS**. The test proves unauthenticated 401, tenant/project/status-scoped reads, durable profile availability readback, flag-OFF 404, planning-only proposals that exclude `IN_EXECUTION`, no task-assignee mutation, and a frozen `WORKLOAD_CAPACITY` snapshot in the shared `reportDefinition` / `reportRun` engine.
- Source review confirms that the availability writer checks self/admin authority, membership, and the target user's organization before update. No migration is included.
- Existing frontend flag test: **1/1 PASS**; workload remains explicit opt-in. Server gates for workload and the shared report adapter are strict `=== 'true'` checks.
- Server TypeScript with 8 GiB heap: **exit 0**. Focused esbuild: **15/15 changed TS/TSX files PASS**.
- Duplicate JSON keys: EN 0, PL 0. `git diff --check`: PASS. The production source delta contains no conflict markers; the narrative freeze honestly describes why the historical `1f0d65f778` escaped the inactive marker detector.
- Evidence is 848 KiB, below 2 MiB. Seven 1720×980 full-`InitiativesHub` captures cover availability EN light/dark + PL light and proposals EN light/dark + PL light/dark. Their receipts contain empty browser-error arrays.
- Visual inspection confirms `StandardModuleBar`, standard dropdowns, `StandardTable`, `StandardPreview`, row kebabs, human names, and EN+PL labels. No new `primary-*`/crimson token or native `<select>` is introduced by the production delta.

The review does not require proposal accept/reject/audit because the binding Q1 package SSOT asks E4 only for planning-stage proposals and a hard prohibition on mutating running assignments. That behavior passes. The author should close only the findings above, refresh the freeze, and return the new exact SHA for rereview.
