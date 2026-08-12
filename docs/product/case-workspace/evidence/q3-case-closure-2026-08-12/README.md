# Q3 — Case closure, client + UI wiring (packet Q3, 2026-08-12)

Worktree: `/Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809`
Branch: `claude/case-workspace-v1-20260809`
Files touched: `src/components/CaseWorkspace/api.ts`,
`src/components/CaseWorkspace/CaseDetailScreen.tsx` (additive, localised —
see §7 for the merge note with Q1's concurrent `tokenPrzeladowania` work).
`src/components/CaseWorkspace/ui.tsx` and `src/utils/enumLabels.ts` were
**not modified** — every UI primitive and label function this packet needed
(`FormDialog`, `FormField`, `FORM_INPUT_CLASS`, `closureAxisLabel`,
`closureAxisStatusLabel`, `closureTypeLabel`) already existed.

Backend used: the coordinator-owned LIVE server at `127.0.0.1:3001`
(PID 43176), confirmed via `lsof -p 43176` to hold open connections to
`127.0.0.1:55432` (`case_workspace_test`, disposable Postgres). Frontend:
the existing Vite dev server on `:4501` for this worktree. Browser: isolated
Chrome MCP tab (`tabs_create`), `location.href` re-verified before every
capture per the session's browser-hazard warning. DB readbacks used a small
disposable Node script (`pg` client, deleted after use — zero files left in
`server/`).

**Bottom line:** the server contract was already complete; this packet's gap
was 100% client — zero closure functions in `api.ts`, zero UI. Both are now
wired end-to-end, driven live: happy path, refusal path (axis not ready),
conflict path (double-record and terminal-state transition), light/dark,
refresh, close/reopen all verified with SQL readbacks pasted below.

## 0. The real server contract (quoted, not invented)

`server/src/services/caseWorkspace/caseCoreService.ts`:

```
export type ClosureType =
  | 'DELIVERY_COMPLETED'
  | 'DECISION_COMPLETED'
  | 'IMPLEMENTATION_COMPLETED'
  | 'OUTCOME_VALIDATED'
  | 'COMPLETED_PARTIAL';
export type ClosureAxisStatus = 'NOT_APPLICABLE' | 'PENDING' | 'COMPLETED';
export type OutcomeAxisStatus = 'NOT_APPLICABLE' | 'PENDING' | 'VALIDATED';
export type ClosureAxis = 'delivery' | 'decision' | 'implementation' | 'outcome';

const CLOSURE_TYPE_AXIS: Record<Exclude<ClosureType, 'COMPLETED_PARTIAL'>, ClosureAxis> = {
  DELIVERY_COMPLETED: 'delivery',
  DECISION_COMPLETED: 'decision',
  IMPLEMENTATION_COMPLETED: 'implementation',
  OUTCOME_VALIDATED: 'outcome',
};
```

Two commands, two routes (`server/src/routes/caseWorkspace/cases.routes.ts`):

- `POST /cases/:caseId/closure-axis` — body `{ axis, status }` — updates
  exactly one of `delivery_status`/`decision_status`/`implementation_status`/
  `outcome_status`. Callable any number of times.
- `POST /cases/:caseId/closure` — body `{ closureType, evidenceRef? }` —
  `recordClosure`. Callable **at most once** per Case: `if (row.closure_type)
  throw new Error('case_closure_already_recorded')`. For `COMPLETED_PARTIAL`
  requires `evidenceRef` or an existing `acceptance_criteria_ref`; for the
  other four types requires the matching axis to already read `COMPLETED`
  (or `VALIDATED` for `outcome`) — otherwise
  `case_closure_axis_not_ready:<axis>`. **Does not** itself flip
  `case_status`.
- `POST /cases/:caseId/status` with `targetStatus: 'CLOSED'` — the existing
  `transitionCaseStatus` route — refuses with `case_closure_not_recorded`
  unless `closure_type` is already set (`if (targetStatus === 'CLOSED' &&
  !row.closure_type) throw ...`).

Neither the closure-axis nor the closure route accepts `expectedVersion` —
`caseCoreService.ts` computes the row version itself under `SELECT ... FOR
UPDATE` (same as `/status`/`/cancel`), and reports a conflict as
`case_closure_already_recorded` (409) or
`case_status_transition_not_allowed:<from>-><to>` (409), never as a version
mismatch. §6 below demonstrates both.

## 1. Which closure model V1 requires — four axes, ONE record

`00_CASE_WORKSPACE_CANON.md:84`: *"Delivery, Decision, Implementation and
Outcome are separate closure levels."* `04_DOMAIN_RUNTIME_AND_STATE_
MACHINES.md §4.1`: *"`CLOSED` records **one** immutable `CaseClosureRecord`
with **the** contracted closure type... A closed Case is not rewritten or
reopened."* `12_CASE_WORKSPACE_MODULE_SSOT.md §6.4` repeats the same
five-value enum as the single "explicit contracted type."

Read together: the **four axes are independent, ongoing tracking** (a Case
can honestly sit at `implementation_status=COMPLETED` while
`outcome_status=PENDING` — the canon's own worked example,
`IMPLEMENTATION_COMPLETED / OUTCOME_PENDING`), but **closing the Case writes
exactly one immutable record** with one of the five `ClosureType` values.
This is not a design choice this packet made — it is exactly what the server
already enforces (`recordClosure` rejects a second call; `updateClosure
AxisStatus` allows unlimited calls, one axis at a time).

**What was wired, matching this 1:1:** the "Zamknięcie zlecenia" dialog has
two sections — four independent axis `<select>`s (autosave per row, calls
`updateCaseClosureAxis`) and one closure-type choice (contracted type or
`COMPLETED_PARTIAL`, calls `recordCaseClosure` then `closeCase`). Getting
this wrong the other way — offering four separate "close" buttons, one per
axis — would have produced four case-closure records for one Case, which
the server's own schema (`closure_type` is a single nullable column, written
once) cannot even represent, and would have been the "closed on the wrong
axis is a false record" failure the packet brief warned about.

## 2. What was wired, file by file

- **`src/components/CaseWorkspace/api.ts`** — new section "ZAMKNIĘCIE"
  after `cancelCase`: `CaseClosureAxis` type (server has no client-facing
  type for this, so it lives here, not invented vocabulary — copied from
  `caseCoreService.ts`'s own `ClosureAxis`), `updateCaseClosureAxis`,
  `recordCaseClosure`, `closeCase` (thin alias for
  `transitionCaseStatus(caseId, 'CLOSED', ...)`, already defined above it —
  no new command shape). All three follow the file's own documented
  contract: `runCommand` wrapper, idempotency key per call, authoritative
  `getCase` readback, `CaseCommandResult`. Added `ClosureType`,
  `ClosureAxisStatus`, `OutcomeAxisStatus` to the existing `./types` import
  (already fully modelled there — zero edits needed to `types.ts`, which was
  outside this packet's allowlist anyway).

- **`src/components/CaseWorkspace/CaseDetailScreen.tsx`** — additive only:
  - A local, comment-cited mirror of the server's `CLOSURE_TYPE_AXIS` map
    (display-only — the dialog shows the required axis and its current
    value so a refusal is never a surprise, but the server is the only
    thing that actually enforces it; see §1's "false record" note).
  - New state block (`closureDialogOpen`, `closureCommandBusy`,
    `closureNotice`, `axisNotice`, `axisSaving`, `closureTypeForm`,
    `closureEvidenceForm`, own idempotency-key-per-intent map) placed
    **after** `load`'s declaration — first placement was before it and hit
    a real `Block-scoped variable 'load' used before its declaration` /
    `used before being assigned` TS error (caught by the mandated
    typecheck, not by inspection), moved down, fixed.
  - `otworzDialogZamkniecia` / `zamknijDialogZamkniecia` / `zmienOsZamkniecia`
    (axis autosave, dialog stays open) / `potwierdzZamkniecie` (record +
    close, dialog always closes after any outcome — same convention as
    `runPlanCommand`/`uruchomKomendeArtefaktu` in this file and
    `RezultatyView.tsx`).
  - One new toolbar entry point in the "Akcje" `PreviewActionBar`: "Zamknij
    zlecenie" / "Dokończ zamknięcie zlecenia" (label depends on whether
    `closureType` is already recorded — covers the recovery case where step
    1 succeeded and step 2 failed on a prior attempt). Placed in the main
    row when it fits the ≤5-visible-action budget
    (`DOKTRYNA_GESTOSCI.md §1`), otherwise in `overflowActions` — computed,
    never hardcoded, so it never silently breaks the budget as other
    conditional buttons on this screen change.
  - Two read-only rows added to "Właściwości": kontraktowy typ zamknięcia
    (always) and zarejestrowany typ zamknięcia (once set).
  - One `FormDialog` at the bottom of the file (next to the existing plan
    `CommandDialog`), containing the four-axis grid + type/evidence form
    described in §1.

### Merge with Q1's concurrent `CaseDetailScreen.tsx` work

Q1 owns the plan-edit reload loop: `tokenPrzeladowania` state (declared once,
bumped from `PlanView.onDraftSaved`) and its effect on `load`'s dependency
array. This packet never touches `tokenPrzeladowania`, never touches
`PlanView.tsx`, and only *calls* the existing `load()` — it does not change
`load`'s own definition, its dependency array, or the `useEffect` that
invokes it on mount. All new state/handlers/JSX are insertions at three
distinct points (after `load`'s declaration, inside the existing
`prawyPanel.actions` children, at the file's tail next to the existing plan
dialog) — no line Q1 is likely to be mid-editing was modified. Confirmed no
overlap by re-reading the file after every edit and running the mandated
typecheck clean (§8).

## 3. Crimson/neutral decision

**Neutral (`colorScheme: 'primary'`, which in this preview-pill system —
`previewStyles.ts` — is navy/white, explicitly "never crimson," not the
`primary-*` Tailwind scale), not red.**

Justification: crimson (`red` scheme → `danger-*` tokens) is already used on
this exact screen for "Wycofaj plan" — an action that **undoes** something
that was in force. Closing a Case is the opposite: it is the **intended,
successful completion** of the contract this Case exists to satisfy — the
same category as "Zatwierdź i rozpocznij" (also `primary`), not a rollback.
`COMPLETED_PARTIAL` is an honest admission of incomplete scope, but it is
still a **deliberate, informed** business decision the dialog makes fully
visible (axis statuses shown inline, evidence required) — not a destructive
slip a user needs a red guard-rail against. Reserving crimson for this would
also dilute the one real destructive action already on this screen ("Wycofaj
plan"), which is the opposite of TRIADA_KANON's "crimson only for genuinely
critical" rule.

## 4. Live evidence — happy path (DELIVERY_COMPLETED)

Case `case-9bdba805-8597-4f10-8340-aa5827bb233e` ("Q3 dowod zamkniecia -
Delivery"), created via the same `POST /cases` route the UI itself uses,
`contractedClosureType: DELIVERY_COMPLETED`, transitioned DRAFT→ACTIVE.

DB before any UI action:

```
 case_status | closure_type | delivery_status | version
-------------+--------------+------------------+---------
 ACTIVE      | null         | NOT_APPLICABLE   | 2
```

UI: opened `/zlecenia/case-9bdba805-...`, right panel showed **Zamknij
zlecenie** (main row — fit the ≤5 budget for this Case's state). Dialog
opened: four axis rows all "Nie dotyczy", type pre-selected "Zgodnie z
kontraktem — Dostarczenie zakończone", helper text: *"Wymaga poziomu
„Dostarczenie" ustawionego na „Zrobione" — serwer odmówi (409), jeśli poziom
wyżej jeszcze na to nie wskazuje."*

Set "Dostarczenie" → "Zrobione" (autosave). Dialog showed inline success:
*"Poziom „Dostarczenie" ustawiony na „zrobione"."* DB readback:

```
 case_status | closure_type | delivery_status | version
-------------+--------------+------------------+---------
 ACTIVE      | null         | COMPLETED        | 3
```

Filled evidence ("Raport odbioru Q3 zaakceptowany przez sponsora
2026-08-12."), clicked **Zamknij zlecenie** (confirm). Result: header pill
flipped to "Zakończone", Akcje panel showed *"Zlecenie zamknięte jako
„dostarczenie zakończone"."* DB readback:

```
     case_status | closure_type       | delivery_status | closed_at                | closure_evidence_ref                                        | version
-----------------+--------------------+------------------+---------------------------+--------------------------------------------------------------+---------
 CLOSED           | DELIVERY_COMPLETED | COMPLETED        | 2026-08-12T21:08:35.300Z | Raport odbioru Q3 zaakceptowany przez sponsora 2026-08-12.   | 5
```

`version` 3→5 = two mutating calls (`recordCaseClosure` then `closeCase`),
exactly the two-step server contract in §0.

## 5. Refusal path — attempt closure before the axis is ready

Same case, **before** the delivery axis was set (all axes "Nie dotyczy",
`contracted_closure_type = DELIVERY_COMPLETED`). Clicked **Zamknij
zlecenie** immediately, without changing anything, confirmed with the
default (contracted) type.

Result: dialog closed, Akcje panel showed the honest, Polish, non-raw
message (`toCommandFailure`'s generic 409 text — this screen does not
invent per-code copy, matching every other command on it):

> "Stan na serwerze jest inny niż na ekranie — ktoś zmienił to w
> międzyczasie albo obiekt jest w innym stanie. Nic nie zostało zmienione.
> Odśwież dane i zdecyduj ponownie."

DB readback immediately after — **nothing changed**:

```
 case_status | closure_type | delivery_status | version
-------------+--------------+------------------+---------
 ACTIVE      | null         | NOT_APPLICABLE   | 2
```

Same `version` (2) as before the attempt — the server's own
`case_closure_axis_not_ready:delivery` (409) refused before any write, and
the client correctly did not call `load()`-and-pretend on a failed mutation
(the api.ts §3 rule: "409 = stan inny niż na ekranie, nic nie zmieniono").

Note on scope: the entry **button** is only shown for non-terminal
`caseStatus` (`ZLECENIE_TERMINALNE` gate — a case already CLOSED/FAILED/
CANCELLED never shows it, verified in §7). The axis-readiness refusal above
is a **content** precondition inside an otherwise-legal state transition,
deliberately left attemptable (not client-blocked) because the same dialog
shows the real axis state before the click — an informed attempt with an
honest server-backed refusal, not a button that "usually fails" blind.

## 6. Conflict path — no `expectedVersion` on these routes, so real conflicts instead

Neither `/closure` nor `/closure-axis` nor `/status` takes `expectedVersion`
(§0) — `caseCoreService.ts` computes it itself under `FOR UPDATE`. The real
conflict family these routes produce is a **second call on an already-
terminal fact**, demonstrated directly against the API (the UI correctly
hides the trigger once terminal — see §7 — so this proves the *server*
invariant the client's hidden-button relies on):

Case `case-20c1d022-c822-401e-9ca3-c90dd4b0f957`, already closed via the UI
as `COMPLETED_PARTIAL` (§ below) — `version = 4`.

```bash
$ curl -s -w "\nHTTP %{http_code}\n" -X POST .../cases/$CASE/closure \
    -H "Authorization: Bearer $TOKEN" -d '{"closureType":"IMPLEMENTATION_COMPLETED"}'
{"error":{"message":"case_closure_already_recorded", ...,"statusCode":409,"code":"CASE_CLOSURE_ALREADY_RECORDED"}}
HTTP 409

$ curl -s -w "\nHTTP %{http_code}\n" -X POST .../cases/$CASE/status \
    -H "Authorization: Bearer $TOKEN" -d '{"targetStatus":"ACTIVE"}'
{"error":{"message":"case_status_transition_not_allowed:CLOSED->ACTIVE", ...,"statusCode":409,"code":"CASE_STATUS_TRANSITION_NOT_ALLOWED"}}
HTTP 409
```

DB readback after both attempts — version still 4, nothing moved:

```
 case_status | closure_type      | version
-------------+-------------------+---------
 CLOSED      | COMPLETED_PARTIAL | 4
```

Both map through the *same* `toCommandFailure` 409 branch the UI already
showed in §5 — no separate code path, no raw status leaked.

## 7. COMPLETED_PARTIAL path + client-side required-evidence gate (dark mode)

Case `case-20c1d022-...` (`contractedClosureType: IMPLEMENTATION_COMPLETED`,
ACTIVE). Opened dialog, switched "Typ zamknięcia" to "Częściowo — Zakończone
częściowo": evidence field's label switched to "(WYMAGANE)", helper text
*"Wymaga dowodu/opisu pozostałego zakresu poniżej albo już zapisanych
kryteriów odbioru zlecenia."*, and the confirm button visibly disabled
(`confirmDisabled` — this is the one place this packet DOES block client-
side, because it is a pure input-completeness check with zero ambiguity,
matching the existing `reason.required` pattern used by every other
command dialog on this screen — not the same thing as guessing a business
outcome).

Filled evidence ("Wdrożenie w toku dla modułu raportowania — pozostały
zakres: integracja z SSO, planowana na Q4."), confirm button re-enabled,
clicked. Result: *"Zlecenie zamknięte jako „zakończone częściowo"."* DB:

```
 case_status | closure_type       | contracted_closure_type  | closure_evidence_ref                                                                             | version
-------------+---------------------+---------------------------+---------------------------------------------------------------------------------------------------+---------
 CLOSED      | COMPLETED_PARTIAL  | IMPLEMENTATION_COMPLETED | Wdrożenie w toku dla modułu raportowania — pozostały zakres: integracja z SSO, planowana na Q4.   | 4
```

This is exactly the canon's own worked example generalised
(`closure_type` diverges honestly from `contracted_closure_type`, with the
remaining scope named) — captured live in dark mode (screenshots taken via
`resize_window(colorScheme: 'dark')` + the app's own persisted Zustand
`theme`, confirmed `document.documentElement.classList.contains('dark') ===
true` before every dark capture).

## 8. Light/dark, refresh, close/reopen

- **Light, desktop** — §4 (happy path), §5 (refusal), header/property panel
  screenshots (`Kontraktowy typ zamknięcia: Dostarczenie zakończone`,
  `Zarejestrowany typ zamknięcia: Dostarczenie zakończone`, `Zamknięte:
  12.08.2026, 23:08`).
- **Dark, desktop** — §7 (COMPLETED_PARTIAL flow, closed-state header).
- **Refresh** — navigated to the same closed-case URL again (full page
  load, not SPA route change): "Zakończone" badge persisted, "Zamknij
  zlecenie" button correctly **absent** (terminal-state gate re-evaluated
  fresh from the server, not stale client state).
- **Close/reopen** — closed the browser tab entirely (`tabs_close`), opened
  a brand-new tab (`tabs_create`, fresh navigation stack), navigated
  straight to the closed case's URL: same result — "Zakończone" persisted,
  no closure button, all Właściwości rows correct.
- **Mobile** — see §9. The closure control is unreachable at true phone
  width, but this is a pre-existing platform-shell gap, not something this
  packet introduced or could fix within its allowlist.

## 9. Mobile — could NOT fully verify (pre-existing shell gap, flagged separately)

`src/components/shared/NModeLayout/NModeShell.tsx` renders the entire
artifact right panel (Akcje/Właściwości/Powiązania/Źródła/Historia) as
`<div className="hidden lg:block ...">` with **no fallback below 1024px** —
confirmed by grep across the whole `NModeLayout` directory (no drawer/sheet
component exists there at all). Verified live at a real 375×812 viewport:
the Plan/Realizacja/Rezultaty content renders fine, but **every** Akcje
action — "Utwórz szkic planu", "Wczytaj ponownie", "Wróć do listy zleceń",
and this packet's "Zamknij zlecenie" — is equally inaccessible; there is no
kebab, FAB, or sheet trigger anywhere in the mobile layout. At exactly
1024px the panel and the closure button both appear correctly.

This is a shared-shell limitation (`StandardArtifactShell.tsx` /
`NModeShell.tsx`, both outside this packet's allowlist, and both used by
artifact screens beyond Case Workspace) that predates this packet and
affects every action on this screen equally, not a closure-specific defect.
Flagged as a follow-up task (`task_e72a8e39`, "Add mobile access path for
artifact right panel") rather than fixed here — fixing it would mean editing
shared platform files well outside Q3's four-file allowlist and with a much
larger blast radius than one feature.

## 10. Typecheck

```
$ NODE_OPTIONS="--max-old-space-size=8192" ./node_modules/.bin/tsc --noEmit ; echo "EXIT=$?"
EXIT=0
```

Zero output, exit 0 — trusted per the packet's own warning that a crash can
silently resemble success; this run printed no lines at all (not even a
truncated crash trace) and echoed `EXIT=0` from the shell's own `$?`, not
from tsc's stdout, so a background OOM would have shown as a non-0 echo.

One real error *was* caught by this exact run mid-session: the closure
state block referenced `load` in a `useCallback` dependency array before
`load`'s own `const load = useCallback(...)` declaration (`TS2448`/`TS2454`,
"used before its declaration" / "used before being assigned") — moved the
whole block after `load`, re-ran, clean.

## 11. What could NOT be verified

- True mobile-width (<1024px) closure flow — blocked by the pre-existing
  shell gap in §9, flagged separately, not fixable within this packet's
  allowlist.
- `expectedVersion`-based OCC conflict — the closure routes don't take one
  (§0); substituted the real conflict family these routes actually produce
  (`case_closure_already_recorded`, `case_status_transition_not_allowed`),
  both proven in §6.
- Multi-tab/concurrent-session race on the SAME case at the SAME instant
  (e.g. two browser tabs both mid-dialog) — not attempted; §6's sequential
  double-call already proves the server-side guard that would catch it.
