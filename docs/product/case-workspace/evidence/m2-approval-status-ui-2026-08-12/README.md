# Packet M2 — approval/proposal lifecycle UI (2026-08-12)

## Scope

Wired the four zero-caller proposal commands (`submitProposalForReview`,
`retryProposal`, `revokeProposal`, `markProposalFailed`) into
`RealizacjaView.tsx`'s existing "Sprawy do zatwierdzenia" preview panel.

### Correction — the real `transitionCaseStatus` call chain

`transitionCaseStatus` (case status) was ALREADY wired end-to-end before
this packet started, in `CasesListScreen.tsx` (commit `be4bb504d9`,
pre-dating this session) — confirmed correct against
`ALLOWED_STATUS_TRANSITIONS` in `caseCoreService.ts:197`, so it was left
untouched. My first pass through this README stated it was "wired via
CasesListScreen" without naming the actual chain, and the coordinator's own
audit independently made the mirror-image mistake — flagging
`transitionCaseStatus` itself as an unwired gap. Both were wrong in
opposite directions. The real chain, for the next reader:

- **No `.tsx` file calls `transitionCaseStatus` directly.**
- `src/components/CaseWorkspace/api.ts` wraps it in three named helpers —
  `startCase`, `pauseCase`, `resumeCase` (plus the sibling `cancelCase`,
  which calls the separate `POST /cases/:caseId/cancel` route, not
  `transitionCaseStatus`) — each a thin function that calls
  `transitionCaseStatus(caseId, targetStatus, reason, options)` with a
  fixed `targetStatus`.
- `CasesListScreen.tsx`'s `runPendingCommand` calls those three named
  helpers (`kind === 'start' | 'pause' | 'resume'`), gated by
  `rowMenu()`'s `statusTransitions` array so only the transitions
  `ALLOWED_STATUS_TRANSITIONS` actually permits for the row's current
  status are ever offered (DRAFT→start, ACTIVE→pause, BLOCKED→resume).

So: the exported function `transitionCaseStatus` has zero direct callers
in any `.tsx` file, but it is fully reachable and exercised through three
named wrappers — a real, working mechanism, just one level removed from
the function name itself.

Live evidence for this pre-existing mechanism (not new work, verified as
part of this packet's session): see "Live evidence" below.

## State machine implemented against

`server/src/services/caseWorkspace/proposalApprovalService.ts:448`
(`ALLOWED_TRANSITIONS`) — the literal, enforced state graph, not the prose
in `04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md` §4.6 (which is consistent with
it but omits the DEFER self-loop detail):

```
DRAFT             -> [PENDING_REVIEW]
PENDING_REVIEW    -> [APPROVED, REJECTED, REQUESTED_CHANGES]   (DEFER: no status change)
APPROVED          -> [EXECUTING, REVOKED]
EXECUTING         -> [EXECUTED, FAILED]
EXECUTED          -> [AUDITED]
FAILED            -> [APPROVED]      (the "controlled idempotent retry" edge)
AUDITED / REJECTED / REQUESTED_CHANGES / REVOKED -> []  (terminal)
```

UI control gating (`proposalPreviewActions()` in `RealizacjaView.tsx`) maps
1:1 onto this table. `APPROVED -> EXECUTING` (`transitionProposalToExecuting`)
is the autonomy-gated MATERIAL action — not exposed by `api.ts`, not built
here; it is worker/system-triggered, matching canon §1 decision 6 ("execution
retains a separate execute step") and §3.6 ("Approved is never silently
equivalent to executed").

## What was wired, file by file

- `src/components/CaseWorkspace/RealizacjaView.tsx` (only file changed):
  - `proposalPreviewActions(proposal, setPending)` — new helper, one
    `StandardPreviewAction[]` set per proposal status, returns `undefined`
    for terminal statuses (no dangling button that would always 409).
  - `proposalRecommendation(status)` — one Polish sentence per status for
    the preview's meta-card recommendation line.
  - `PendingCommand` union extended with four new kinds
    (`proposal-submit` / `proposal-retry` / `proposal-revoke` /
    `proposal-mark-failed`), each carrying the `CaseActionProposal` so the
    command has `proposal.version` for `expectedVersion` without guessing.
  - `runPendingCommand` extended with four new branches, each calling its
    api.ts function and following the existing authoritative-readback /
    conflict / busy pattern used by every other command in this file.
  - `dialogConfig` extended with four new cases (title/description/confirm
    label/optional-or-required reason field).
  - Preview JSX for the selected proposal now calls
    `proposalPreviewActions(selectedProposal, setPending)` instead of the
    old `status === 'PENDING_REVIEW' ? {...} : undefined` inline block
    (behavior for PENDING_REVIEW is unchanged, just moved into the helper).

  Caller → function mapping:
  - "Wyślij do przeglądu" (DRAFT) → `submitProposalForReview(id, expectedVersion)`
  - "Ponów" (FAILED) → `retryProposal(id, expectedVersion)`
  - "Cofnij zatwierdzenie" (APPROVED) → `revokeProposal(id, reason, expectedVersion)`
  - "Oznacz jako nieudane" (EXECUTING) → `markProposalFailed(id, reason, expectedVersion)`

- No changes to `CasesListScreen.tsx`, `ui.tsx`, `enumLabels.ts` — every
  label (`proposalStatusLabel` already covers DRAFT/APPROVED/FAILED/
  EXECUTING) and shared component (`CommandDialog`, `CommandBanner`,
  `StandardPreviewAction`) needed already existed.

## Destructive styling — which controls and why

Per `PreviewActionButton.tsx` (`danger-*` tokens, never raw `primary-*`):

| Control | Variant | Why |
|---|---|---|
| Wyślij do przeglądu (submit) | `positive` | forward-moving, reversible-in-spirit — same class as "Uruchom"/"Wznów" elsewhere in this file |
| Ponów (retry) | `positive` | recovery/forward-moving, same class as "Wznów" |
| **Cofnij zatwierdzenie (revoke)** | **`destructive`** | explicitly called out by the packet brief; canon §3.6: revocation "blocks execution" — a hard stop on an approval that was in force |
| **Oznacz jako nieudane (mark failed)** | **`destructive`** | explicitly called out by the packet brief; records a failure of a currently-EXECUTING action, same weight as "Odrzuć"/"Anuluj przebieg" elsewhere in this file |
| Zatwierdź / Odrzuć / Poproś o zmiany / Odłóż | unchanged (pre-existing) | positive / destructive / neutral / neutral, not touched by this packet |

Confirmed no ordinary CTA in this file uses `destructive`/crimson:
`grep -n "variant: 'destructive'"` in `RealizacjaView.tsx` matches exactly
five call sites — Odrzuć, Anuluj oczekiwanie, Anuluj przebieg (all three
pre-existing, untouched by this packet) plus the two new controls, Cofnij
zatwierdzenie and Oznacz jako nieudane. Every other action in the file
(Zatwierdź, Wyślij do przeglądu, Ponów, Wznów, Uruchom, Poproś o zmiany,
Odłóż, Podaj dane, Wstrzymaj) is `positive`/`neutral`/`warning` — none of
this file's ordinary CTAs use `destructive`.

## Conflict and refusal surfacing

Both come from `api.ts`'s existing, unmodified `toCommandFailure()` — this
packet did not touch `api.ts`:

- **Stale `expectedVersion`** → HTTP 409 → `CaseCommandFailure.kind ===
  'conflict'` → Polish message "Stan na serwerze jest inny niż na ekranie
  (...) Nic nie zostało zmienione. Odśwież dane i zdecyduj ponownie." +
  `CommandBanner`'s "Odśwież dane" button (`refreshSuggested: true`). Never
  a raw `409`.
- **Refusal** (insufficient permission / self-approval-forbidden — GOV-022,
  `proposalApprovalService.ts:1041`) → HTTP 403 →
  `CaseCommandFailure.kind === 'blocked'` → "Nie masz uprawnień do tej
  operacji. Nic nie zostało zmienione." Never a raw `403`.

## Live evidence — STATUS: COMPLETE, run against the real stack

Backend confirmed live (`curl .../api/health` → `200`, PID `11390`,
launched detached by the coordinator). `fixture-and-check.sh` was run for
real: it logged in as `cw.local@local.test`, created a real STANDARD-profile
Case (`case-b0a7d121-f08c-40ab-ab99-3edb99e6e57f`) and a real Run through the
real API (`POST /cases`, `POST /cases/:id/plan-versions`, propose+publish,
`POST /cases/:id/runs`), created one real DRAFT proposal through the real
`POST /cases/:caseId/proposals` route, and seeded four more starting rows
(FAILED×2, APPROVED, EXECUTING) directly into
`case_workspace_action_proposals` on the disposable local DB — reaching
those statuses organically needs the full agent/run pipeline
(`createActionProposal → submit → decide → transitionProposalToExecuting →
...`), out of this packet's scope. The four *transitions this packet
built* are what was exercised for real; the seeded starting rows are the
fixture, not the evidence.

★ Environment note for whoever runs this next: the shared browser-pane MCP
in this session was contended by concurrent activity from elsewhere on the
machine — tabs kept jumping to an unrelated case, random viewport sizes,
and stray theme changes with no action from this session. Switching to the
`claude-in-chrome` tool with a freshly-created, isolated tab (own Chrome
profile, own `localStorage`) made the session stable. Logging in there
required visiting `?ff_zlecenia=1` once (`caseWorkspaceFlag.ts`'s
localStorage-persisted flag — the module route isn't even registered
without it) since the fresh profile had no flag set.

### 1. submit for review — DRAFT → PENDING_REVIEW

Clicked "Wyślij do przeglądu" on proposal `cwprop-26256637-d05b-4fd5-b36d-67d48b8218d5`
("Tylko dodaje coś nowego"), confirmed the dialog. UI banner updated to "1
sprawa czeka na Twoją decyzję".

```sql
SELECT action_proposal_id, status, version, updated_at
FROM case_workspace_action_proposals
WHERE action_proposal_id = 'cwprop-26256637-d05b-4fd5-b36d-67d48b8218d5';
```
```
 action_proposal_id                          | status         | version | updated_at
 cwprop-26256637-d05b-4fd5-b36d-67d48b8218d5  | PENDING_REVIEW | 2       | 2026-08-12T17:44:10.360Z
```
(was `DRAFT`, version 1, before the click.)

### 2. refusal path — self-approval forbidden (GOV-022)

Immediately after, clicked "Zatwierdź" on that same now-PENDING_REVIEW
proposal — I am both the actor and its `createdByActorId`
(`proposer_type='AGENT'`, `created_by_actor_id='cw-local-user'`, and I am
logged in as `cw-local-user`), so the server's
`self_approval_forbidden` check fires. UI showed a red banner:

> **Nie masz uprawnień do tej operacji. Nic nie zostało zmienione.** [Zamknij]

Never a raw `403`. DB readback proves zero mutation:

```sql
SELECT status, version FROM case_workspace_action_proposals
WHERE action_proposal_id = 'cwprop-26256637-d05b-4fd5-b36d-67d48b8218d5';
-- status=PENDING_REVIEW, version=2 (unchanged)

SELECT decision_id, action_proposal_id, decision, decided_by_actor_id
FROM case_workspace_action_proposal_decisions
WHERE action_proposal_id = 'cwprop-26256637-d05b-4fd5-b36d-67d48b8218d5';
-- (0 rows) — no decision row was ever written
```

### 3. revoke — APPROVED → REVOKED

Clicked "Cofnij zatwierdzenie" on `m2fx-prop-approved` ("Wrażliwa zmiana"),
confirmation dialog required and enforced a non-blank reason ("POWÓD
COFNIĘCIA (WYMAGANY)" — confirm button stayed disabled until text was
entered), typed a reason, confirmed.

```sql
SELECT action_proposal_id, status, version, updated_at
FROM case_workspace_action_proposals WHERE action_proposal_id = 'm2fx-prop-approved';
```
```
 m2fx-prop-approved | REVOKED | 2 | 2026-08-12T17:45:53.646Z
```
(was `APPROVED`, version 1.)

### 4. retry — FAILED → APPROVED

Clicked "Ponów" on `m2fx-prop-failed` ("Bezpieczna zmiana"), confirmed.

```sql
SELECT action_proposal_id, status, version, updated_at
FROM case_workspace_action_proposals WHERE action_proposal_id = 'm2fx-prop-failed';
```
```
 m2fx-prop-failed | APPROVED | 2 | 2026-08-12T17:46:40.057Z
```
(was `FAILED`, version 1.)

### 5. mark failed — EXECUTING → FAILED

Clicked "Oznacz jako nieudane" on `m2fx-prop-executing` ("Usuwa lub
nadpisuje dane"), required-reason dialog enforced identically to revoke's,
typed a reason, confirmed.

```sql
SELECT action_proposal_id, status, version, updated_at
FROM case_workspace_action_proposals WHERE action_proposal_id = 'm2fx-prop-executing';
```
```
 m2fx-prop-executing | FAILED | 2 | 2026-08-12T17:47:22.344Z
```
(was `EXECUTING`, version 1.)

### 6. expectedVersion conflict path — real stale-OCC race

Opened the preview for `m2fx-prop-conflict` ("Bezpieczna zmiana", FAILED,
version 1) so the client held `expectedVersion=1` in React state. Then, in
a *separate* channel (simulating a concurrent actor), bumped the row's
version directly in Postgres:

```sql
UPDATE case_workspace_action_proposals SET version = version + 1, updated_at = now()
WHERE action_proposal_id = 'm2fx-prop-conflict' RETURNING status, version;
-- FAILED, 2
```

Then clicked "Ponów" in the still-open UI — the client sent its stale
`expectedVersion=1`, the server's `UPDATE ... WHERE version = ?` matched
zero rows, and `retryProposal` returned 409. UI banner:

> **Stan na serwerze jest inny niż na ekranie — ktoś zmienił to w
> międzyczasie albo obiekt jest w innym stanie. Nic nie zostało zmienione.
> Odśwież dane i zdecyduj ponownie.** [Odśwież dane] [Zamknij]

Never a raw `409`. DB confirms zero mutation from the failed retry
(`status=FAILED, version=2`, exactly what the external bump left it at —
no version 3, no status change). Clicked "Odśwież dane" — banner cleared,
proposal reloaded from the server, no leftover stale state.

### 7. case status transitions (pre-existing mechanism, verified this session)

Opened the case list, exercised `startCase`/`pauseCase`/`resumeCase` (the
three named wrappers around `transitionCaseStatus` — see the correction
above) through `CasesListScreen.tsx`'s kebab menu; the row's status pill
and "Uwaga"/"Następna akcja" columns updated from the authoritative
readback (`GET /cases/:caseId`) after each command, matching the gating in
`rowMenu()` (DRAFT→Rozpocznij only, ACTIVE→Wstrzymaj only, BLOCKED→Wznów
only). Not re-tested exhaustively with fresh DB readbacks in this session
since it is unmodified, pre-existing, already-committed code — confirmed
functioning, not re-proven line-by-line.

### 8. Light / dark, desktop / mobile, refresh survival

- **Dark, desktop** (1512×793–1728×906 depending on the tool): the primary
  surface for every transition above — table, preview panel, dialogs, and
  both banner tones (conflict/warning amber, refusal/blocked red) all
  confirmed.
- **Light, desktop**: switched theme via Ustawienia → Wygląd → Motyw →
  Jasny, then reloaded `/zlecenia/case-.../?zakladka=realizacja`. Table,
  status tags (Nieudane/Zatwierdzone/Cofnięte/Czeka na Twoją decyzję), and
  the "Ponów" positive-styled button all rendered correctly on a white/light
  surface with dark text — no unreadable or unstyled elements.
- **Dark, mobile** (375×812, real narrow viewport via
  `resize_window{preset:"mobile"}`): the "Sprawy do zatwierdzenia" table
  correctly collapsed to the single-column "waski" tier (name + status pill
  + "Zgłosił: ... · dzisiaj" stacked in one card per row, per
  `proposalColumnsByTier.waski` in `RealizacjaView.tsx`) — no horizontal
  scroll, no clipped content, row selection worked (tap highlighted the
  row). Did not additionally confirm the mobile action-button rendering
  pixel-for-pixel (the panel scrolled below the visible capture and the
  tool's scroll became unreliable at that point) — stated plainly as the
  one sub-item not independently re-screenshotted, though the same shared
  `StandardPreview`/`PreviewActionButton` components already confirmed
  correct on desktop in both themes render unchanged on mobile (only the
  container width class differs, per the canon component's own
  contract — this packet did not touch layout/breakpoint code).
- **Refresh survival**: every one of the five DB-verified transitions above
  was followed by a full page reload (`navigate` to the same URL, not a
  client-side route change) before the next step, and each time the
  freshly-loaded page showed exactly the DB-confirmed state — proposal
  statuses, the "N sprawa(y) czeka(ją)" count, and row ordering all matched
  the server, never a stale client cache.

## Files

- `fixture-and-check.sh` — fixture + DB readback helper, run for real this
  session (see above); safe to re-run (idempotent case/run creation is not
  guaranteed idempotent across re-runs — it creates a NEW case each time —
  but the proposal seed step is idempotent via `ON CONFLICT`).
- `tsc-exit.txt` — captured EXIT code from the required typecheck command
  (`EXIT=0`).
- `run-fixture.log` — captured stdout from the fixture script run.
