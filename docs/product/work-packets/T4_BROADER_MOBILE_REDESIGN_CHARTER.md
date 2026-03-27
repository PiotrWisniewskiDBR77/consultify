# T4 Charter - broader `Mobile` redesign

> Status: active
> Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
> Lane: broader `Mobile` redesign
> Taxonomy: `T4`
> Priority: highest
> Last updated: 2026-03-27

---

## 1. Goal

Promote the broader `Mobile` redesign lane from queued backlog into active execution and close the remaining split-brain between the already accepted bounded mobile continuity lanes and a coherent broader mobile product surface.

This lane exists because the accepted `Mobile / Landing` and `Mobile breadth` cuts closed bounded navigation and overlay continuity seams, but they explicitly left broader module-level responsive behavior and mobile-first product breadth outside their bounded scope.

---

## 2. In scope

- Broader mobile responsive/product breadth on the live public and authenticated surfaces
- Residual split-brain mapping across narrow-viewport layout behavior, module reachability, and mobile interaction coherence
- Bounded packets chosen only after the broader residual is written down
- Focused regression coverage for any promoted mobile packets
- Evidence updates and plan/tracker/program status updates

---

## 3. Explicitly out of scope

- Reopening accepted `Mobile / Landing` continuity packets
- Reopening accepted `Mobile breadth` shell/navigation packets
- Rewriting frozen sidebar/topbar layouts outside explicit bounded slices
- Whole-app redesign all at once
- Anna, public marketing, or other already accepted `T4` lanes

---

## 4. First bounded packet

### Packet name

`broader Mobile redesign split-brain map`

### Why this packet starts first

- the remaining residual is redesign-shaped rather than one obvious tiny runtime bug
- accepted mobile work already closed the smaller route/shell continuity seams
- forcing a code packet first would risk silently broadening into a whole responsive rewrite
- an explicit residual map is the smallest honest packet that can identify the first real broader mobile seam

### Packet scope

- document the current broader mobile residual after the accepted mobile cuts
- identify where narrow-viewport layout, module behavior, and mobile interaction truth still diverge across live surfaces
- name the smallest real follow-on packet only after that residual is explicit
- keep this packet evidence-first rather than pretending a larger redesign is already chosen

---

## 5. Lane acceptance target

This broader lane is not done after one redesign note.

The lane will be accepted only when:

1. the remaining broader mobile residuals are broken into honest bounded packets,
2. those packets land with real runtime and surface continuity,
3. no smaller real mobile packet remains,
4. and the lane can be accepted without silently broadening into a whole-app responsive rewrite.
