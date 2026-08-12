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

**LIVE-VERIFIED 2026-08-12, second pass, backend up.** See §"LIVE EVIDENCE"
below for the exact reproduction (held OCC version → out-of-band DB bump →
stale `propose` → real `409` → Polish banner, no raw code → "Odśwież dane" →
retry succeeds). Network tab confirms the actual HTTP status; DB reads
confirm the failed attempt mutated nothing.

## ★★★ TWO FINDINGS FROM THIS PACKET — carry forward, do not let these get

## lost as "implementation details" ★★★

1. **`case_core.current_plan_version_id` is never written by the backend.**
   This is a **backend gap**, not a UI workaround detail. Live-confirmed:
   after `publishPlanVersion` succeeded and the row's `status` flipped to
   `PUBLISHED` in `case_plan_versions`, a direct read of `case_core` for the
   same case still showed `current_plan_version_id: null`:
   ```
   case_core.current_plan_version_id (expected: still null, per known backend gap): [
     {
       "case_id": "case-eaccd54e-f4e2-4812-8df9-c597d9f93997",
       "current_plan_version_id": null
     }
   ]
   ```
   `casePlanVersionService.ts`'s own header names this as an unresolved open
   question (§ open_question 4) and states the packet's mandate forbade
   writing to `case_core` at all. Every screen that resolves "which plan is
   current" for a Case (this one, and potentially others) has to work around
   a column that looks like it should be the source of truth but silently
   never updates. This packet's `pinnedPlanVersionId` is a client-side,
   single-session workaround for the write path; it does **not** fix the
   underlying gap, and does not help any OTHER client (a second tab, a second
   user, a mobile app) learn which plan is current after a mutation. The real
   fix belongs in the backend — either `casePlanVersionService.ts` starts
   writing this column (inside the same transaction as the status change) or
   every reader is changed to stop trusting it and instead compute "current"
   from `case_plan_versions` directly (`status = 'PUBLISHED'` first, `DRAFT`/
   `IN_REVIEW` newest otherwise) — a decision for whoever owns E4/the Run-
   binding packet, per that file's own header.

2. **`updatePlanDraft` remains completely unwired.** This packet closes
   create → propose → publish → request-changes → withdraw (the plan's
   *status* lifecycle), but nobody can edit the *content* of a DRAFT plan's
   graph through the product yet — no node/edge editor exists in any
   allowlisted file. Concretely: a user can create a draft (seeded from a
   minimal two-node graph or a clone of a prior version) and can move it
   through review and publication, but cannot add, remove, or rewire a single
   step first. Saying the plan lifecycle is "done" without saying this
   plainly would overstate it — the lifecycle plumbing is real and
   live-verified, but plan *authoring* (in the sense of actually designing
   the steps) is still missing its editor.

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

## LIVE EVIDENCE (2026-08-12, second pass — backend up, verified by coordinator: PID 73750, later restarted externally to a fresh PID mid-session, `/api/health` → 200 both times)

Real DB used: `postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test`
(the backend process's actual `DATABASE_URL` env var, confirmed via `ps eww` on
its PID — this differs from `server/.env.test`'s `DATABASE_URL`, which points
at a native Postgres on port 5432 that does not have this role; the running
server does **not** load that file, whatever does start it sets the env
directly). Case used: `case-eaccd54e-f4e2-4812-8df9-c597d9f93997`
("Zlecenie B 06b70681"), STANDARD profile, org `cw-local-org`, zero plan
versions at the start of this run — a genuine clean-slate case, not a
pre-seeded fixture.

### 1. Draft → propose → publish, with DB readback after each step

**Create.** Clicked "Utwórz szkic planu" in the Akcje panel, typed a reason,
confirmed. UI banner: "Utworzono szkic planu nr 1." DB immediately after:

```sql
select case_plan_version_id, plan_number, status, version, change_reason, created_at
from case_plan_versions where case_id = 'case-eaccd54e-f4e2-4812-8df9-c597d9f93997'
order by plan_number desc;
```
```json
[{
  "case_plan_version_id": "planv-cb50ce05-c775-4812-bf56-de1fcfad8803",
  "plan_number": 1, "status": "DRAFT", "version": 1,
  "change_reason": "Ewidencja M1: pierwszy szkic planu (live evidence run).",
  "created_at": "2026-08-12T17:25:31.798Z"
}]
```

**Propose.** Clicked "Zaproponuj do przeglądu", confirmed. UI banner: "Plan
nr 1 ma teraz status: W recenzji." DB immediately after:

```sql
select case_plan_version_id, plan_number, status, version, proposed_at, proposed_by_actor_id, review_history
from case_plan_versions where case_id = '...' order by plan_number desc;
```
```json
[{
  "case_plan_version_id": "planv-cb50ce05-c775-4812-bf56-de1fcfad8803",
  "plan_number": 1, "status": "IN_REVIEW", "version": 2,
  "proposed_at": "2026-08-12T17:25:54.417Z",
  "proposed_by_actor_id": "cw-local-user",
  "review_history": "[{\"event\":\"PROPOSED\",\"actorId\":\"cw-local-user\",\"at\":\"2026-08-12T17:25:54.417Z\"}]"
}]
```

**Publish.** Clicked "Publikuj", confirmed. UI banner: "Plan nr 1 ma teraz
status: Zatwierdzony." Right panel switched to "Wycofaj plan" (destructive,
crimson) + "Nowy szkic (zmiana planu)" — exactly the PUBLISHED-state buttons.
DB immediately after:

```sql
select case_plan_version_id, plan_number, status, version, published_at, published_by_actor_id
from case_plan_versions where case_id = '...' order by plan_number desc;
```
```json
[{
  "case_plan_version_id": "planv-cb50ce05-c775-4812-bf56-de1fcfad8803",
  "plan_number": 1, "status": "PUBLISHED", "version": 3,
  "published_at": "2026-08-12T17:26:14.026Z",
  "published_by_actor_id": "cw-local-user"
}]
```
Same query against `case_core.current_plan_version_id` at this instant —
**still `null`**, proving finding #1 above live, not just from reading code.

**Replan (bonus — exercises `supersedesPlanVersionId`).** Clicked "Nowy
szkic (zmiana planu)" on the now-PUBLISHED plan #1. UI banner: "Utworzono
szkic planu nr 2." DB:
```json
[
  {"case_plan_version_id":"planv-cb50ce05-...","plan_number":1,"status":"PUBLISHED","version":3,"supersedes_plan_version_id":null},
  {"case_plan_version_id":"planv-339d8dd4-...","plan_number":2,"status":"DRAFT","version":1,"supersedes_plan_version_id":"planv-cb50ce05-c775-4812-bf56-de1fcfad8803"}
]
```
Plan #1 stays PUBLISHED and untouched; plan #2 correctly records which
version it supersedes.

### 2. Conflict path — held version, out-of-band mutation, real 409

With plan #2 loaded in the UI at `version=1` (its true DB value at that
moment), ran this directly against the DB, bypassing the app entirely, to
simulate a second actor editing concurrently:
```sql
update case_plan_versions set version = version + 1, updated_at = now()
where case_plan_version_id = 'planv-339d8dd4-f40b-440b-a1a9-07ec3cf1f283'
returning case_plan_version_id, version, status, updated_at;
-- -> version: 2 (was 1)
```
Then, **without reloading the page**, clicked "Zaproponuj do przeglądu" on
plan #2 in the still-open UI (which still held `expectedVersion=1` in
memory) and confirmed. Network tab:
```
POST .../plan-versions/planv-339d8dd4-.../propose → 409 Conflict
```
UI rendered, verbatim, no raw code visible anywhere:
> "Stan na serwerze jest inny niż na ekranie — ktoś zmienił to w
> międzyczasie albo obiekt jest w innym stanie. Nic nie zostało zmienione.
> Odśwież dane i zdecyduj ponownie." — with a working "Odśwież dane" button.

DB read immediately after the failed attempt — **untouched**, proving "Nic
nie zostało zmienione" is literally true, not just claimed:
```json
{"case_plan_version_id":"planv-339d8dd4-...","version":2,"status":"DRAFT","updated_at":"2026-08-12 17:27:15.316605+00"}
```
Clicked "Odśwież dane" → confirmed via network tab it re-fetched the plan
version (now correctly reading `version=2`). Clicked "Zaproponuj do
przeglądu" again → succeeded this time. DB:
```json
{"case_plan_version_id":"planv-339d8dd4-...","version":3,"status":"IN_REVIEW","proposed_at":"2026-08-12T17:28:04.406Z"}
```
Full cycle: stale write rejected honestly with zero side effects → user
refreshes → same intent now succeeds cleanly, on the very next click.

### 3. Light/dark, desktop/mobile — all four combinations, real renders

All four screenshots are of the same case/plan state (`case-eaccd54e-...`,
Plan #1 PUBLISHED, "wersja 1"), confirmed via `location.href` immediately
before each capture (a stray cross-tab redirect in this shared browser
session — see "Environment note" below — was caught and re-navigated past
every time a screenshot looked suspicious):
- **Desktop, dark** — default theme, `Plan: Zatwierdzony (wersja 1)` pill,
  "Wycofaj plan" (crimson) / "Nowy szkic (zmiana planu)" (neutral) buttons,
  canon-correct (crimson reserved for the destructive action only).
- **Desktop, light** — same content, same button semantics, light palette
  (theme is app-controlled via a persisted `zustand` store key
  `consultify-storage.state.theme`, not OS `prefers-color-scheme` — toggled
  directly for this capture since the app has its own switch, not a CSS
  media query).
- **Mobile (375×812), light** — content reflows into a single column, module
  toolbar collapses correctly, bottom mobile nav bar present, all plan text
  fully legible.
- **Mobile (375×812), dark** — same, dark palette, canon-correct crimson
  usage carried through responsively.

### 4. Refresh survival

Demonstrated repeatedly and incidentally: every fresh tab / full page load
against the same case URL through this session — including one that landed
mid-backend-restart and correctly showed the honest `CaseStateBlock` error
state ("Nie udało się wczytać danych" / "Spróbuj ponownie") rather than a
blank crash — consistently re-resolved to the correct plan without
corruption once the backend answered again. One nuance worth recording
plainly: a full reload has **no session pin** (the pin is React state, not
persisted), so it falls back to the priority chain's next rule
(`current_plan_version_id` match → `PUBLISHED` → newest) — which, per
finding #1, means it always shows the PUBLISHED plan after a refresh, not
whatever DRAFT/IN_REVIEW replan a user had open. This is arguably the
*correct* behavior (show the governance-approved plan by default), but it
does mean a mid-edit replan is not "remembered" across a hard refresh —
flagged here rather than left implicit.

### Also fixed during this pass

Found and fixed a real (if cosmetic) bug while capturing the "Utwórz szkic
planu" (no-supersedes, no-seed variant) dialog live: its reason field label
read **"Powód (opcjonalnie) (opcjonalny)"** — doubled, because
`planDialogConfig` supplied `'Powód (opcjonalnie)'` as the label text and
`CommandDialog` itself always appends `' (opcjonalny)'`/`' (wymagany)'`
based on the `required` flag. Fixed to `'Powód'` (single line, in
`CaseDetailScreen.tsx`). Re-verified live via the DRAFT→replan dialog, which
never had the duplication (its label was already the correct bare
`'Powód zmiany'`).

### Environment note (not caused by, not fixable by, this packet)

This browser session periodically got redirected — mid-navigation, on any
multi-second idle — to a *different* case (`case-b0a7d121-...`, titled "M2
evidence — sprawy do zatwierdzenia", `?zakladka=realizacja`) and, separately,
had tabs opened/closed that this packet's tool calls did not request. Ruled
out `sessionStorage`/`localStorage` as the cause (neither held that case id).
Given the sibling evidence directory `m2-approval-status-ui-2026-08-12/`
exists and is mid-flight in this same worktree (see "Also noticed" below),
the most likely explanation is a second, concurrent agent session driving
live evidence for that packet through the same shared Browser-pane
infrastructure at the same time. Worked around by re-navigating and
verifying `location.href` via `javascript_exec` immediately before every
screenshot in this section — every screenshot above is confirmed to be the
right case at capture time — but this is worth the coordinator knowing about
as a tooling constraint, not a product defect.

### Typecheck, final

`NODE_OPTIONS="--max-old-space-size=8192" ./node_modules/.bin/tsc --noEmit`
from the worktree root, run a third time after the label-duplication fix
above (the only code change made during this live-evidence pass):
**`EXIT=0`.** Three clean runs total across this packet's two passes, no
OOM/crash silently masquerading as success.

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
