# M1 — Plan authoring UI (draft → propose → publish, + request-changes/withdraw)

Worktree: `/Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809`
Branch: `claude/case-workspace-v1-20260809`

## What this closes

Before this packet: `PlanView.tsx` called only the READ functions in `api.ts`
(`listPlanVersions`, `getPlanGraph`, `validatePlanVersion`). All six WRITE
functions (`createPlanDraft`, `updatePlanDraft`, `proposePlanVersion`,
`publishPlanVersion`, `requestChangesOnPlanVersion`, `withdrawPlanVersion`)
had zero callers anywhere in `src/`. A user could not author, propose or
publish a plan through the product.

This packet wires the plan **status** lifecycle end to end:
`createPlanDraft → proposePlanVersion → publishPlanVersion`, plus
`requestChangesOnPlanVersion` and `withdrawPlanVersion` where the state
machine allows. `updatePlanDraft` (free-form graph editing) remains
unwired — see "What is NOT covered" below.

## State machine implemented against

`server/src/services/caseWorkspace/casePlanVersionService.ts`, constant
`ALLOWED_TRANSITIONS` (lines ~313-319 as of this packet) — the actual runtime
enforcement, not just the doc:

```
DRAFT     -> [IN_REVIEW]
IN_REVIEW -> [DRAFT, PUBLISHED]
PUBLISHED -> [WITHDRAWN]
SUPERSEDED -> []   (only ever reached as publishPlanVersion's own
                     side-effect — never a standalone user action)
WITHDRAWN  -> []
```

Matches `docs/product/case-workspace/04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md`
§4.3 (`DRAFT -> IN_REVIEW -> PUBLISHED -> SUPERSEDED | WITHDRAWN`,
`IN_REVIEW -> DRAFT` for "changes requested").

The UI (`CaseDetailScreen.tsx`, right panel "Akcje") only ever offers the
one or two buttons that the *current* plan version's status actually allows:

| `currentPlanVersion` state | Buttons offered |
| --- | --- |
| no plan version at all | Utwórz szkic planu |
| `DRAFT` | Zaproponuj do przeglądu |
| `IN_REVIEW` | Publikuj (disabled when `validation.valid === false`) · Poproś o zmiany |
| `PUBLISHED` | Wycofaj plan · Nowy szkic (zmiana planu) |
| `WITHDRAWN` | Nowy szkic planu |
| `SUPERSEDED` | none (historical row; the resolution priority below means a superseded row is never shown as "current" in normal operation) |

## Files changed, by file

- **`src/components/CaseWorkspace/CaseDetailScreen.tsx`** (main wiring):
  - imports the five write functions from `./api` (`createPlanDraft`,
    `proposePlanVersion`, `publishPlanVersion`, `requestChangesOnPlanVersion`,
    `withdrawPlanVersion`) and `CommandBanner`/`CommandDialog`/`CommandNotice`
    from `./ui`.
  - `PendingPlanCommand` + `runPlanCommand` + `planDialogConfig`: one
    dispatcher for all five commands, mirroring the existing
    `RealizacjaView.tsx` `PendingCommand`/`runPendingCommand` pattern already
    established in this module (idempotency key per *intent* via
    `keyForPlanIntent`, re-used until the command actually succeeds; dialog
    always closes in a `finally`, regardless of outcome; every success is
    followed by a full authoritative `load()`, never a local state paint).
  - `planActionButtons`: computed per `currentPlanVersion.status`, rendered
    into the existing "Akcje" `PreviewActionBar` (same slot as the LIGHT
    "Zatwierdź i rozpocznij" one-click button already there).
  - `pinnedPlanVersionId` / `pinnedPlanVersionIdRef`: `case_core.
    current_plan_version_id` is never written by `casePlanVersionService.ts`
    (its own header names this as an open question, out of that packet's
    mandate). Without a client-side pin, the screen's existing "which plan
    version is current" resolution (`currentPlanVersionId` match → `PUBLISHED`
    → newest) would silently revert to an older `PUBLISHED` plan immediately
    after e.g. proposing a new draft, hiding the very thing the user just
    acted on. The pin is set to the mutated plan version's id after every
    successful command and is the first-priority match in both `load()` and
    the `currentPlanVersion` memo. Reset on `caseId` change.
  - `MINIMAL_SEED_GRAPH`: this packet's allowlist has no graph-editor file,
    so "Utwórz szkic planu" (when a case has zero plan versions) seeds
    `createPlanDraft` with a two-node start→end graph that passes
    `computeValidationBlockers`'s LOCAL_STRUCTURAL checks (single entry,
    single reachable terminal, no dangling edges, no cycle). Replanning from
    an existing version (PUBLISHED or WITHDRAWN) instead clones that
    version's own `semanticGraph` via `structuredClone` — never a fabricated
    graph when a real one is available. Every seed source is named explicitly
    in the confirmation dialog text (`planDialogConfig`), never silently
    substituted.

- **`src/components/CaseWorkspace/PlanView.tsx`** (minor, in-scope): the
  empty-state message ("Ten plan nie ma jeszcze kroków") now distinguishes
  "no plan version exists — create one in the Akcje panel" from "this plan
  version exists but its graph is empty" — previously one message covered
  both and pointed nowhere actionable.

- **`src/components/CaseWorkspace/ui.tsx`**: no changes. `CommandDialog` /
  `CommandBanner` / `CommandNotice` already existed there (built for
  `RealizacjaView.tsx`/`CasesListScreen.tsx`) and are reused as-is.

- **`src/utils/enumLabels.ts`**: no changes needed. `planVersionStatusLabel`
  already covers all five statuses (`DRAFT`/`IN_REVIEW`/`PUBLISHED`/
  `SUPERSEDED`/`WITHDRAWN`).

## `expectedVersion` conflict handling

Every write call passes `plan.version` (the OCC counter read from the
authoritative `CasePlanVersion` object already in `bundle`, never guessed).
`api.ts`'s `toCommandFailure` turns a `409` into
`{ kind: 'conflict', refreshSuggested: true, message: 'Stan na serwerze jest
inny niż na ekranie — ktoś zmienił to w międzyczasie albo obiekt jest w
innym stanie. Nic nie zostało zmienione. Odśwież dane i zdecyduj ponownie.' }`
— this is rendered through `CommandBanner` (amber "warning" tone) with a
visible "Odśwież dane" button wired to `load()`. No raw HTTP status ever
reaches the UI text; 403/404 get their own SEC-009-safe Polish messages from
the same `toCommandFailure`, unchanged by this packet.

**NOT independently exercised against the live server in this session** —
see "What could not be verified" below. Verified by code inspection: the
call sites pass `plan.version`; `runPlanCommand`'s failure branch renders
`result.failure.message` (already Polish) directly, with `refresh:
result.failure.refreshSuggested` driving the banner's refresh button.

## Governance — STANDARD/TRANSFORMATION cannot start without a published plan

Not weakened, because not touched. `server/src/services/caseWorkspace/
runLifecycleService.ts` (header, "THE HARD RULE THIS FILE EXISTS TO
ENFORCE") confirms `createRun` requires an already-`PUBLISHED`
`CasePlanVersion` and creates zero `NodeRun`s; only a separate `startRun`
call ever moves a Run into `RUNNING`. LIGHT's one-click path
(`lightOneClickService.startLightOneClick`) is a distinct, pre-existing
service this packet does not call or modify. This packet's allowlist did not
include any Run-starting control (`RealizacjaView.tsx` is out of scope), so
there is no new client-side path that could bypass this — the plan actions
added here only ever move a `CasePlanVersion` between
DRAFT/IN_REVIEW/PUBLISHED/WITHDRAWN, never start a Run. All governance stays
server-enforced, exactly as it was before this packet.

## What could NOT be verified — stated plainly

**The backend at `127.0.0.1:3001` was down for this entire packet.**
Checked repeatedly with
`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/api/health`
→ connection refused (`000`) every time, from the start of the session
through to writing this file. `docker ps` shows a `case-workspace-test-pg`
Postgres container running, but the app server process itself was never
reachable. Per the packet's own hard rule ("Do NOT start, restart or kill
it"), it was left alone.

Concretely NOT done, and not faked:
- No login (`cw.local@local.test`) — the app shell's own bootstrap calls
  (`/api/organizations/current`, `/api/feature-flags/runtime`, etc.) all
  returned `500` through the Vite proxy, confirmed via the browser's network
  tab, so the app never got past its loading screen.
- No live draft → propose → publish walkthrough, no screenshots, no DB
  readback of `case_plan_versions` after each transition.
- No conflict-path demonstration (forcing a stale `expectedVersion`).
- No light/dark, desktop/mobile, or refresh-survival screenshots.
- No confirmation that the disposable Postgres the backend would use is the
  one reachable at `localhost:5432` — that role/connection didn't match
  `server/.env.test`'s `DATABASE_URL` when queried directly (`role
  "consultinity" does not exist` against the native Postgres on that port);
  reconciling that is the coordinator's environment to own, not this
  packet's.

What WAS verified instead, honestly, without a live server:
- `NODE_OPTIONS="--max-old-space-size=8192" ./node_modules/.bin/tsc --noEmit`
  from the worktree root → `EXIT=0` (run twice, once before and once after a
  small cleanup pass; both times a clean pass, no crash/OOM masking).
- `esbuild` per-file bundling of all three edited files
  (`CaseDetailScreen.tsx`, `PlanView.tsx`, `ui.tsx` — unchanged, checked
  anyway) → no syntax errors.
- The Vite dev server on `:4501` served the app shell with zero console
  errors (checked via the browser console) — the only failures were the
  expected `500`s from the down backend, confirmed via the network tab.
- Every state-machine claim above is cited from
  `casePlanVersionService.ts`'s own `ALLOWED_TRANSITIONS` and each command
  function's implementation (`proposePlanVersion`, `publishPlanVersion`,
  `requestChangesOnPlanVersion`, `withdrawPlanVersion`), read directly, not
  assumed from the doc.

**This is a code-complete, type-checked, unexercised-against-a-live-backend
state.** Whoever picks this up next with a live backend should run exactly
the lifecycle this README describes and replace this section with real
screenshots + `SELECT * FROM case_plan_versions WHERE case_id = '<id>'
ORDER BY plan_number DESC;` readbacks after each transition.

## Also noticed, not caused, not touched

`src/components/CaseWorkspace/RealizacjaView.tsx` had substantial uncommitted
changes already present in this worktree at the start of this session (file
mtime ~19:11, before this packet's first edit at ~19:13) — proposal-lifecycle
wiring (`submitProposalForReview`/`retryProposal`/`revokeProposal`/
`markProposalFailed`), matching the sibling evidence directory
`docs/product/case-workspace/evidence/m2-approval-status-ui-2026-08-12/`.
That file is outside this packet's allowlist and was left untouched, per the
hard rule against reverting anyone else's files — flagging it here because
it means this worktree currently carries two packets' uncommitted work at
once (the exact pattern the orchestration memory note warns about), which
the session coordinator should be aware of before any commit/merge step.
