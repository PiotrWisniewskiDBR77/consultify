---
doc_id: MW-DEC-004_INTEGRATION_NOTE
module_id: MODULE_MY_WORK
line: Line B — MW-DEC-001 Canonical Decision Workflow
status: AWAITING_CODEX_REVIEW
last_updated: 2026-08-01
---

# MW-DEC-004 — Integration Note (for Codex, not acted on by this packet)

## Scope, stated unambiguously (per Codex review, 2026-08-01)

- **`DecisionWorkspace` supports an EXISTING decision only.** It does not
  implement decision creation. `decisionId === null` renders an honest "not
  supported yet" state — see "One functional gap" below.
- **The runtime golden flow described in MW-CORE-002/MW-DEC-002 is NOT yet
  complete end-to-end.** This packet delivers a real, tested backend and a
  real, tested, independently-mountable frontend component — but a real user
  today still cannot reach `DecisionWorkspace` through the live app, because
  it is not mounted anywhere (see below). "Backend + frontend exist and are
  tested" is not the same claim as "a user can use this" — do not conflate
  them when evaluating this packet.
- **The old `DecisionDetailView.tsx` (localStorage-faking) remains the ONLY
  live view for decisions** until a controlled swap is performed. This
  packet does not touch it, does not disable it, and does not degrade its
  current (already-imperfect) behavior in any way.
- **The controlled swap must happen only after Line A's own packet lands**,
  since the swap point (`MyWorkHub.tsx`'s `renderDocumentContent()`) is
  Line-A-adjacent territory this packet was explicitly forbidden from
  editing, and per this repo's own visual-acceptance doctrine the swap must
  go behind a default-OFF flag with a clean-screenshot owner acceptance pass
  before it becomes default-ON — it is a separate, later change, not part of
  MW-DEC-001.

## Current state: the new component is real, tested by nothing wiring to it, and NOT mounted anywhere

`src/components/MyWork/Decision/DecisionWorkspace.tsx` (and its 9 sibling
files) is a complete, independently-mountable, honest replacement for the
Decision "dossier" experience. It is committed, type-consistent with the new
backend, and has zero `localStorage`/`sessionStorage` usage for business
state (grepped independently by three separate agents in this pipeline, all
confirming the same empty result). But it currently has **zero importers
anywhere in the codebase** — confirmed with a repo-wide grep for both the
import path and the exported symbol name, re-verified by the final
falsification reviewer after an initial (corrected) false lead from the
adversarial reviewer, which had mis-attributed two unrelated pre-existing
files (`src/components/workspaces/PilotDecisionWorkspace.tsx` and
`FullStep3Workspace.tsx`, which merely share the substring "DecisionWorkspace"
in their own unrelated names) as importers. They are not.

This is the **expected and correct** state given the mandate: MyWorkHub.tsx
was explicitly off-limits to this line. The old `DecisionDetailView.tsx`
(still doing `localStorage.setItem('consultify-decision-enhancements:'+id, ...)`
at lines ~2053/2100) remains what's actually wired into every live surface
today: `MyWorkHub.tsx`, `TaskDetailView.tsx`, `NotebookContent.tsx`,
`Initiatives/*`, `AssessmentHub.tsx`, `InterviewWorkspace.tsx`. A real user
opening a decision today still hits the localStorage-faking legacy view —
this packet does not change that by itself. Wiring is the one remaining
mechanical step, and it is deliberately left for Codex.

## Exact integration point in MyWorkHub.tsx (read-only — not edited by this packet)

Lazy import, currently at `src/components/MyWork/MyWorkHub.tsx:164-166`:
```ts
const DecisionDetailView = lazyWithRetry(() =>
  import('./DecisionDetailView').then((m) => ({ default: m.DecisionDetailView }))
);
```

Mount point, `renderDocumentContent()`'s `case 'decision':` at **lines
3697-3706**:
```tsx
case 'decision':
  return (
    <React.Suspense fallback={lazyFallback}>
      <DecisionDetailView
        decisionId={activeDoc.data?.isNew ? null : activeDoc.id}
        onClose={() => handleCloseDocument(activeDoc.id)}
        onSaved={(data) => handleDocumentSaved(activeDoc.id, data)}
      />
    </React.Suspense>
  );
```

`DecisionWorkspace` was built with the **identical prop signature**
(`decisionId: string | null`, `onClose: () => void`,
`onSaved?: (data: unknown) => void`), so the mechanical swap is:

```ts
const DecisionWorkspace = lazyWithRetry(() =>
  import('./Decision/DecisionWorkspace').then((m) => ({ default: m.DecisionWorkspace }))
);
```

and rename the JSX tag in the `case 'decision':` branch — or, for a safer
gradual rollout, mount it behind a feature flag as an alternate branch first
(per this repo's own visual-acceptance doctrine: "Piotr never the first
visual tester" — the new view must go behind a default-OFF flag until Piotr
accepts a clean screenshot, exactly like the `m03InboxStandardTableEnabled`/
`m03TasksStandardTableEnabled` pattern already used elsewhere in this hub).

## One functional gap Codex must account for before swapping

`DecisionWorkspace` does **not** implement decision *creation*
(`decisionId === null` renders an honest "not supported yet" state) — it
only covers the detail/collaborate/decide flow for an existing decision. If
`isNew` decisions must keep working through this mount point, keep routing
`isNew` through the old `DecisionDetailView` (or a dedicated creation flow)
and only swap the existing-decision path — e.g.:

```tsx
case 'decision':
  return (
    <React.Suspense fallback={lazyFallback}>
      {activeDoc.data?.isNew ? (
        <DecisionDetailView decisionId={null} onClose={...} onSaved={...} />
      ) : (
        <DecisionWorkspace decisionId={activeDoc.id} onClose={...} onSaved={...} />
      )}
    </React.Suspense>
  );
```

## Other live callers of the old `DecisionDetailView.tsx` (not touched by this packet, listed for Codex's awareness)

`TaskDetailView.tsx`, `NotebookContent.tsx`, `Initiatives/*`,
`AssessmentHub.tsx`, `InterviewWorkspace.tsx` all also mount the old
component. This packet only produces the MyWorkHub-facing integration note
per the mandate's scope (My Work module); the other mount points are a
separate, larger rollout decision outside MW-DEC-001 and are not analyzed
here.

## UI Gate 0 checklist status for the new component

- Uses `src/components/shared/PreviewPane` primitives
  (`PreviewPaneShell`/`PreviewActionBar`/etc.) and `StandardTable`
  conventions per `docs/ui-standards/TRIADA_KANON.md` — no bespoke chrome
  invented.
- Crimson reserved for genuinely critical/destructive semantics only (reject
  confirmation), never default CTAs or active-state styling.
- Honest loading/empty/error states, including distinct copy for 403, 409
  `ALREADY_FINALIZED`, 409 `STALE_VERSION`, and 404 — not a generic error
  fallback for all of them. Covered by 14 real-mount automated tests under
  `tests/components/MyWork/Decision/`, including a proven red→green test for
  "no premature/optimistic success before the server responds" (the
  protection was temporarily disabled, the test went red, re-enabled, green
  again — not just asserted to work).
- No new global navigation, no edits to MyWorkHub.
- i18n: **resolved**. Real PL+EN translations for all 97 keys used by the
  Decision component tree are in `public/locales/{en,pl}/translation.json`
  under `myWork.decisionWorkspace.*` (commit `7b65e6554b`) — not just inline
  fallback strings. Other locales (ja/ar/de/es/jp) were explicitly out of
  scope for this review round.

## MANDATORY INTEGRATION GATE — do not swap the mount point until this is resolved

`decision_impacts.is_blocker` has a genuine, pre-existing schema conflict
across this repo's own migrations (`INTEGER` per migrations `292`/`297`,
`BOOLEAN` per `728_beta_missing_tables_2.sql`'s competing
`CREATE TABLE IF NOT EXISTS`) — see MW-DEC-001/MW-DEC-003 for the full
history of how this silently 500'd successful approvals and was fixed with
an `::text IN ('1','true')` workaround at every call site this packet
touched. That workaround is defensive, not a resolution: **whoever performs
the MyWorkHub swap must first confirm which schema variant is live on the
target environment (demo/prod)**, because:
- if `is_blocker` is `BOOLEAN` there, the original `= TRUE` comparisons
  elsewhere in the (untouched) codebase are fine and this packet's fix is a
  no-op;
- if it's `INTEGER` there (as observed in this packet's local Postgres
  testing), any **other, still-untouched** `is_blocker = TRUE` comparison
  outside the 4 call sites this packet fixed will 500 the same way bug #1
  did, and the swap would surface that failure to real users for the first
  time.
This is tracked separately (`server/src/routes/decisions.routes.ts`, the
835-line dead duplicate router, and the schema conflict itself were flagged
as a standalone background-task investigation, `task_bab77805`, still
pending at the time of this note). **Do not treat this packet's `decide()`
being fixed as proof the whole is_blocker surface is safe** — it is proof
only for the 4 call sites enumerated in MW-DEC-001.
