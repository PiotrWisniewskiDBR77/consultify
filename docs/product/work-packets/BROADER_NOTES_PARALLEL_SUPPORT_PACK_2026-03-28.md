# Broader Notes Parallel Support Pack

> Date: 2026-03-28
> Purpose: reduce decision friction for the active broader `Notes` lane without interfering with the in-flight implementation work
> Scope: planning, packet selection, acceptance prep, and doc-closeout support only
> Status: ready

---

## 1. Current lane truth

The active lane is still broader `Notes` adjunct / object-linked outputs breadth.

As of `evidence/509-v81-broader-notes-post-assessment-output-readback-residual-assessment.md`, the narrower direct-readback seams are already closed.

What is already landed:

- `502` notebook capture upload authority continuity
- `503` direct notebook output readback continuity
- `505` notebook output-menu persistence continuity
- `506` notebook list output summary continuity
- `507` upload source readback continuity
- `508` direct assessment output readback continuity

What the latest reassessment says:

- do not keep slicing one more tiny notebook readback patch
- the next honest packet should now come from either:
  - notebook attachment breadth
  - broader notebook-origin output propagation across remaining surfaces

---

## 2. Decision rule for the next packet

Choose `notebook attachment breadth` next only if the active user-visible split-brain is:

- attachments already exist in runtime truth but are missing or misleading on live notebook surfaces
- the missing continuity can be closed on one bounded notebook surface
- the packet does not silently become full attachment lifecycle redesign

Choose `wider output propagation` next only if the active user-visible split-brain is:

- notebook-origin outputs are already persisted in canonical truth
- at least one important live surface still ignores or misreads that persisted truth
- the packet can be closed on one bounded surface without reopening taxonomy or registry redesign

Do not choose the next packet if it depends on:

- whole notebook architecture rewrite
- cross-product artifact taxonomy cleanup
- broad attachment storage redesign
- reworking already accepted `T3` proposal / convert seams

---

## 3. Fast packet-selection matrix

Use this matrix before starting the next implementation packet.

### Option A - notebook attachment breadth

Promote this option if all are true:

- the gap is visible on a live notebook surface
- the missing behavior is attachment-specific, not generic output propagation
- the packet can be expressed as one continuity seam with one focused regression story

Expected bounded result:

- attachment truth becomes visible and trustworthy on one active notebook surface
- no claim is made about full attachment management breadth

### Option B - wider notebook-origin output propagation

Promote this option if all are true:

- notebook-origin output truth is already persisted
- one remaining high-value surface still fails to honor that truth
- the packet can be scoped to one surface or one propagation seam

Expected bounded result:

- one remaining surface stops disagreeing with notebook persisted truth
- no claim is made about full artifact propagation across the whole app

### Tie-breaker

If both seem possible, choose the option that:

1. touches fewer surfaces
2. has a clearer readback contract already present in data truth
3. can be regression-covered with one focused test slice

---

## 4. Acceptance-prep checklist for the active lane

Before broader `Notes` can honestly move to acceptance review, confirm all of the following:

- the next packet is no longer a tiny readback seam disguised as progress
- the remaining residual is either attachment breadth or wider output propagation, not another hidden micro-slice
- every landed packet has focused regression on the real production path
- the broader lane does not silently reopen the accepted bounded `T3` notes lane
- the lane can be capped without claiming a whole notebook/output redesign

If these are all true after the next packet and reassessment, the lane may be close to honest acceptance review rather than one more implementation packet.

---

## 5. Ready-made closeout skeleton for the next evidence note

Use this structure for the next broader-notes evidence note:

1. What changed
2. Why this is the right bounded packet
3. Regression coverage
4. Residual after this packet

For the residual section, force one explicit decision:

- another bounded packet remains, or
- no smaller honest packet remains before acceptance review

---

## 6. Files to update once the next packet lands

If the active agent lands the next packet, these docs should be checked immediately after:

- `docs/product/work-packets/POST_V81_BACKLOG_TRACKER.md`
- `docs/product/work-packets/POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM.md`
- `docs/product/work-packets/Plan V8.1 Final.md`
- `docs/product/work-packets/BROADER_NOTES_ACCEPTANCE_TEMPLATE_2026-03-28.md`
- `docs/product/work-packets/BROADER_NOTES_ACCEPTANCE_CLOSEOUT_RUNBOOK_2026-03-28.md`

If the lane is accepted, also update:

- the active lane ledger in `Plan V8.1 Final.md`
- the tranche board row in `POST_V81_BACKLOG_TRACKER.md`
- any final acceptance evidence reference for broader `Notes`

---

## 7. What this support pack avoids on purpose

This document does not:

- pick the next packet unilaterally
- introduce new product scope
- assign evidence numbers
- change the active implementation path

Its purpose is only to remove admin friction once the in-flight work reaches the next decision point.
