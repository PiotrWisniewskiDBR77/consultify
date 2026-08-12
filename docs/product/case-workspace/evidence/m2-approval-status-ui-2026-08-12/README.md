# Packet M2 — approval/proposal lifecycle UI (2026-08-12)

## Scope

Wired the four zero-caller proposal commands (`submitProposalForReview`,
`retryProposal`, `revokeProposal`, `markProposalFailed`) into
`RealizacjaView.tsx`'s existing "Sprawy do zatwierdzenia" preview panel.
`transitionCaseStatus` (case status) was found ALREADY wired end-to-end in
`CasesListScreen.tsx` (start/pause/resume/cancel, commit `be4bb504d9`,
pre-dating this session) — confirmed correct against
`ALLOWED_STATUS_TRANSITIONS` in `caseCoreService.ts:197`, left untouched.

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

## Live evidence — STATUS: BLOCKED, backend was down all session

`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/api/health`
returned `000` (connection refused) at every check performed during this
packet's work (repeated checks across the session, most recently at the
very end, immediately before writing this file). The disposable Postgres
container (`case-workspace-test-pg`, `127.0.0.1:55432`) IS up
(`docker ps` confirms it), but nothing is listening on `:3001`.

Per instructions this backend is coordinator-owned; I did not start,
restart, or attempt to bring it up. `fixture-and-check.sh` in this
directory is ready to run the moment it comes up: it logs in as the seeded
`cw.local@local.test` user, creates a REAL Case/plan-draft/Run through the
real API, creates ONE real DRAFT proposal through the real
`POST /cases/:caseId/proposals` route, and seeds three more starting rows
(FAILED / APPROVED / EXECUTING) directly into `case_workspace_action_proposals`
on the disposable local DB — because reaching those statuses organically
requires the full agent/run pipeline (createActionProposal → submit →
decide → transitionProposalToExecuting → ...), which is other packets'
scope, not this one's. The four TRANSITIONS this packet built are the
thing to exercise for real, through the real UI, against the real backend,
with a real DB readback — not how those four starting rows got seeded.

What this means for the required proof:

- Typecheck (`tsc --noEmit` from the worktree root): **EXIT=0**, clean —
  captured, see `tsc-exit.txt`.
- `esbuild` bundle of `RealizacjaView.tsx` alone: clean (only expected
  `import.meta`-in-iife warnings from unrelated files pulled into the
  bundle graph).
- CasesListScreen's pre-existing error state (not new work, but confirms
  the error-state pattern this packet's new commands reuse) rendered
  correctly against the down backend — observed live in the browser at
  `http://127.0.0.1:4501/zlecenia` (already-authenticated session):
  "Nie udało się wczytać danych — Połączenie z serwerem nie doszło do
  skutku. Spróbuj ponownie — nic nie zostało zmienione." with a working
  "Spróbuj ponownie" retry button (clicked, re-attempted the real request,
  failed the same honest way). This is real network failure handling
  against the real (down) backend, not a mock — no screenshot file saved
  (no file-capture tool available in this session), described here instead.
- Every other item in "PROOF REQUIRED" (drive each transition through the
  UI, DB readback per transition, conflict path, refusal path, light/dark,
  desktop/mobile, refresh survival) is **NOT VERIFIED** — stated plainly,
  not papered over. `fixture-and-check.sh` plus a manual click-through is
  the exact next step once `127.0.0.1:3001/api/health` returns `200`.

## Files

- `fixture-and-check.sh` — ready-to-run fixture + DB readback helper (see above).
- `tsc-exit.txt` — captured EXIT code from the required typecheck command.
