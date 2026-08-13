# E04 — Mind Map acceptance

Candidate: HEAD `deb103fcde`, base `origin/demo` @ `9d17cac114`. Canon:
`docs/standards/idea-workspace/11_SPECYFIKACJE_NARZEDZI.md`. DoD:
`docs/qa/ideas-manual-audit-2026-08-09/11_..._PROTOCOL.md` §4 E04 ("original 18+ node scene
builds; 20 mixed rapid sibling operations never create two editors; two cross-links,
comments/evidence and AI proposal persist; first-level PPM fits 1280×800 without dead/duplicate
action").

## 1. Four-state summary

| State | Result |
|---|---|
| Code exists | Yes — 72 registry actions carry `tools` including `mindmap` (edge, pane, node-edit/structure/delete, convert, AI/style menus) |
| Mounted in a real consumer | Yes — N5.1–N5.5 packages (commits `768e44010d`, `e6ac31f10b`, `bb5b971282`, `4508c0c196`, `d02f734b23`) wire `NodeContextMenu.tsx`, `PaneContextMenu.tsx`, `EdgeContextMenu.tsx` and the node AI/style menu to the registry |
| Executed at runtime | NOT VERIFIED — no live-server pass in this program |
| Persisted and read back | NOT VERIFIED |

## 2. Evidence from this program's git history

- N5.1 edge menu, N5.2 pane/background menu, N5.3 node edit/structure/delete, N5.4 convert menu,
  N5.5 AI/style menu — each its own commit, each stated by its commit body as verified via targeted
  vitest + `check-actions.sh` re-run, not the full-scene DoD scenario.
- Program C P1: **MM-P1-01** "sibling reentrancy" fixed (`c5a7603c0b`, re-dispatched after a network
  failure during the original attempt — the commit body itself documents the retry, not a silent
  redo). The 00_PROGRAM_STATUS reconciliation table lists this among Program C's IMPLEMENTED-per-
  commit-record items, not independently re-run by this task.
- Wave 5 (`111868e07a`) commit body: "MM invisible line-style" defect found and fixed (listed among
  Program C's fixed defects), "canvas undo now covers strokes" (cross-cutting with Whiteboard, not
  Mind-Map-specific).
- `idea.node.mm_convert_initiative` / `_decision` / `_tasks` (verified directly in
  `src/actions/ideaActionRegistry.ts:8914` onward): each `requiresPreview: true`, `undo.kind:
  'manual_delete'`, source cites `NodeContextMenu.tsx:314` + `IdeaRecommendationMap.tsx
  convertSingleNode(...)`. This is the E11-adjacent "single-node Convert no longer cascades to all
  descendants" fix Wave 5 also claims — cross-referenced, not independently re-verified at runtime
  here.
- `idea.node.mm_apply_ai_suggestion` (QG-02 remediation, `deb103fcde`): one id shared by
  `NodeDetailDrawer` and `UnifiedNodeDetailDrawer` — verified by this program's own QG-02 pass to
  have byte-identical `handleApplyAISuggestion` bodies, mutually exclusive per the
  `mindmapDrawerUnified` flag (not two competing implementations).

## 3. Explicitly NOT VERIFIED for this epic

- The doc-11 §4 E04 DoD scenario itself — an 18+ node scene, 20 mixed rapid sibling operations, two
  cross-links persisting, AI proposal persistence, and the first-level PPM fitting 1280×800 without
  dead/duplicate actions — has **not been run against this or any SHA in this program**. Program A's
  baseline four-scene readback (`96ed5637cb`) exercised representation-switch survival with mock
  data on a small scene, not this scenario.
- No cold-reopen or server-persistence check for any Mind Map mutation in this program's history.

## 4. Verdict

**WIRED TO REGISTRY, DoD NOT CLOSED** — unchanged from `00_PROGRAM_STATUS_AND_VERSION.md`'s own
E04 line. This report adds the specific commit/file evidence for the wiring claim and confirms no
new runtime or persistence evidence exists beyond what that file already states.

---

**Re-verified at `6fec03f7a0` (stream S11-DOCS, 2026-08-12):** verdict
unchanged — **WIRED TO REGISTRY, DoD NOT CLOSED**. One visual defect closed
this wave and worth recording here: the depth-3+ "L{n}" node badge measured
4.41:1 in light theme against the 4.5:1 text bar (an earlier stream had called
this "hypothetical" for lack of a depth-3 fixture node; the integrator
rejected that and built one — `getNodeDepth()` walks a real edge chain, so
depth 3 is production-reachable). Fixed with a `c-*` token swap, re-measured
9.32:1/11.48:1. See `16_OPEN_RISKS_AND_LIMITATIONS.csv` RISK-35 and
`21_FOCUS_AND_CONTRAST.md` §9. **This is a visual/contrast fix only — it does
not close any part of this epic's functional DoD** (18-node scene, cross-link,
AI-proposal persistence remain not independently rerun).
