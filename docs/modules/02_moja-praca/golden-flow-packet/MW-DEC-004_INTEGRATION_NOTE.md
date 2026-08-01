---
doc_id: MW-DEC-004_INTEGRATION_NOTE
module_id: MODULE_MY_WORK
line: Line B — MW-DEC-001 Canonical Decision Workflow
status: AWAITING_CODEX_REVIEW
last_updated: 2026-08-01
---

# MW-DEC-004 — Integration Note (for Codex, not acted on by this packet)

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
  fallback for all of them.
- No new global navigation, no edits to MyWorkHub.
- i18n keys added under a new namespace but not propagated to the 7 shared
  locale files (see MW-DEC-003 debt list) — falls back to English default
  text, not a hard blocker for integration but should be closed before a
  Polish-facing acceptance pass.
