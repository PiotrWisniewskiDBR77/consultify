# Q1 — Plan-edit state loop, runtime proof (packet Q1, 2026-08-12)

Worktree: `/Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809`
Branch: `claude/case-workspace-v1-20260809`
Fix under test: commit `cf709284d2` ("close the plan-edit state loop — no
more 409 after saving"), files `src/components/CaseWorkspace/PlanView.tsx`
and `src/components/CaseWorkspace/CaseDetailScreen.tsx`.

Backend used: the coordinator-owned LIVE server at `127.0.0.1:3001`
(PID 43176), pointed — confirmed via `ps eww -p 43176`, `DATABASE_URL` — at
the disposable Postgres container `case-workspace-test-pg`,
`127.0.0.1:55432`, db `case_workspace_test`. Frontend: the existing Vite
dev server on `:4501` for this exact worktree (confirmed via `lsof`/`ps`
cwd). Browser: isolated Chrome MCP tab, `location.href` re-verified before
every capture.

**Bottom line: the fix works, does not paper over real concurrency
conflicts, and the regression test fails without the wiring it protects.**

## 1. Baseline

Case `case-d58756d5-1a34-4bbb-9ed6-93d7c7006b9e` ("Zestawienie faktur"),
plan `planv-da4dd889-b100-4afa-a326-74debfc73c6d`, DB readback before any
action:

```
 version | plan_number | status |  updated_at
---------+-------------+--------+---------------------------
       1 |           1 | DRAFT  | 2026-08-10T22:16:04.828Z
```

## 2. Primary sequence — edit → save → propose → publish, NO manual refresh

UI steps (real browser, real backend, `cw.local@local.test`):

1. Opened `/zlecenia/case-d58756d5-1a34-4bbb-9ed6-93d7c7006b9e?ff_zlecenia=1`
   — screen rendered the DRAFT plan, two steps ("Krok pierwszy", "Krok
   drugi"), right panel showed exactly one action: **Zaproponuj do
   przeglądu** (matches the DRAFT-state action table from the M1 evidence).
2. Clicked **Edytuj plan**, changed the "Krok pierwszy" label to
   `Krok pierwszy - Q1 runtime test 2026-08-12` (semantic change).
3. Clicked **Zapisz zmiany**. Screen closed edit mode automatically and
   showed the new label with no error banner.
4. **Immediately** (no refresh, no navigation) clicked **Zaproponuj do
   przeglądu** in the right panel → confirm dialog → **Zaproponuj**.
   Result: green banner "Plan nr 1 ma teraz status: Do przeglądu." — no
   409, no stale-bundle error.
5. **Immediately** clicked **Publikuj** → confirm dialog → **Opublikuj**.
   Result: green banner "Plan nr 1 ma teraz status: Opublikowany." — no
   409.

Network requests captured for this sequence (`read_network_requests`,
filtered `plan`), in order, all `statusCode: 200`:

```
GET  /cases/.../plan-versions
GET  /plan-versions/.../graph
GET  /plan-versions/.../validate
PUT  /plan-versions/planv-da4dd889-...              200   <- save draft
GET  /plan-versions/planv-da4dd889-...               200   <- readback
GET  /cases/.../plan-versions                        200   <- bundle refetch (the fix)
GET  /plan-versions/.../graph                        200
GET  /plan-versions/.../validate                     200
POST /plan-versions/planv-da4dd889-.../propose       200   <- ZERO 409, was the repro step
GET  /plan-versions/planv-da4dd889-...               200
GET  /cases/.../plan-versions                        200   <- bundle refetch again
GET  /plan-versions/.../graph                        200
GET  /plan-versions/.../validate                     200
POST /plan-versions/planv-da4dd889-.../publish       200   <- ZERO 409
GET  /plan-versions/planv-da4dd889-...               200
GET  /cases/.../plan-versions                        200
GET  /plan-versions/.../graph                        200
GET  /plan-versions/.../validate                     200
```

**Zero 409s across the entire save→propose→publish sequence.** The `GET
/cases/:id/plan-versions` call after each mutation is exactly the
`tokenPrzeladowania`-triggered bundle refetch the fix added — visible
directly in the network log, not just inferred.

DB readback immediately after:

```
 version | plan_number |  status   |               proposed_at | published_at
---------+-------------+-----------+----------------------------+---------------------------
       4 |           1 | PUBLISHED |  2026-08-12T20:31:12.244Z | 2026-08-12T20:31:25.049Z

 semantic_graph.nodes[0].metadata.label = "Krok pierwszy - Q1 runtime test 2026-08-12"
```

`version` climbed 1→2 (save) →3 (propose) →4 (publish) — internal, never
shown in the UI (the UI's "(wersja N)" badge is `planNumber`, which
correctly stays 1 throughout, since this is still plan #1 of the case, now
published). The edited label persisted through the entire lifecycle.

## 3. Refresh persistence

Full page reload (`navigate` to the same URL, not SPA route change):
screen showed "Plan: Opublikowany (wersja 1)" and the edited step label
unchanged. Confirmed via accessibility-tree read and screenshot.

## 4. Close/reopen persistence

Navigated to `/zlecenia?ff_zlecenia=1` (case list — "closed" the case),
confirmed `location.href` matched the list route, then navigated back to
the case detail URL. Same result: "Plan: Opublikowany (wersja 1)", edited
label intact. Data survived a full unmount/remount of the screen, not just
a soft state refresh.

## 5. Negative control (a) — the fix actually does the work

**Direction 1 — wiring removed, defect reproduced.**

Edited `CaseDetailScreen.tsx` to comment out the prop wire:

```diff
- onDraftSaved={() => setTokenPrzeladowania((n) => n + 1)}
+ // TEMP — negative control (a): onDraftSaved={() => setTokenPrzeladowania((n) => n + 1)}
```

Used a second DRAFT case (`case-ebbba1ee-01d2-4073-82e3-4eca98d4504e`,
plan `planv-7c2f86ee-9e57-4609-a29d-28889b714859`, version 1 — a
`case_status = CANCELLED` case, chosen only because it was the only
convenient second DRAFT-plan fixture in `cw-local-org`; plan editability
gates on the *plan's* `DRAFT` status, not the case's status — confirmed by
the "Zaproponuj do przeglądu" action being offered normally). Reloaded the
page (Vite HMR churn required an explicit reload to pick up the edit).
Edited the step label to `Krok pierwszy - negative control A`, saved
(`Zapisano zmiany w szkicu planu (wersja 2).`), then **immediately**
clicked **Zaproponuj do przeglądu → Zaproponuj**.

Result: reproduced the exact pre-fix defect —

```
POST /plan-versions/planv-7c2f86ee-.../propose   409

UI banner: "Stan na serwerze jest inny niż na ekranie — ktoś zmienił to w
międzyczasie albo obiekt jest w innym stanie. Nic nie zostało zmienione.
Odśwież dane i zdecyduj ponownie."
```

DB readback confirmed no corruption from the rejected propose — the saved
draft is intact, nothing was silently overwritten or lost:

```
 version | status |  semantic_graph.nodes[0].metadata.label
---------+--------+-------------------------------------------
       2 | DRAFT  | "Krok pierwszy - negative control A"
```

**Direction 2 — wiring restored, defect gone.**

Restored `CaseDetailScreen.tsx` to the original (`git diff` clean,
confirmed with `git diff --stat` producing no output). Reloaded, edited the
same case's step label to `Krok pierwszy - restored fix confirmed`, saved,
then **immediately** clicked **Zaproponuj do przeglądu → Zaproponuj**.

```
POST /plan-versions/planv-7c2f86ee-.../propose (1st, with wiring removed)   409
POST /plan-versions/planv-7c2f86ee-.../propose (2nd, with wiring restored)  200

UI banner: "Plan nr 1 ma teraz status: Do przeglądu."
```

Both directions captured on the same plan version id in the same session,
back to back — this is the fix, not an artifact of two different fixtures.

## 6. Negative control (b) — a GENUINE conflict still 409s (the more important check)

This is the check that a "fix" could get wrong by silencing 409s
altogether, which would be a real regression in the optimistic-locking
concurrency control. It was run with the fix **fully in place** (no code
edits during this section).

Third DRAFT case: `case-767ccf73-e8f9-4ee9-b2c4-2277a5ef2bb9`, plan
`planv-eeb58914-ca0e-4a62-8058-649feccb34f3`, version 1.

1. In the UI: clicked **Edytuj plan** (loads `local.planVersion.version =
   1` into `PlanView`'s working state), typed a new label into the "Krok
   pierwszy" field — but did **not** click Zapisz zmiany yet.
2. Out of band, directly in Postgres (simulating a second actor editing
   the same plan concurrently, entirely outside the browser session):

   ```sql
   UPDATE case_plan_versions
   SET version = version + 1,
       semantic_graph = '{... "label":"Krok pierwszy - CHANGED OUT OF BAND" ...}',
       graph_digest = 'sha256-concurrent-simulated',
       updated_at = now()::text
   WHERE case_plan_version_id = 'planv-eeb58914-ca0e-4a62-8058-649feccb34f3'
   RETURNING case_plan_version_id, version, status, updated_at;
   ```

   ```
   version | status |          updated_at
   --------+--------+-------------------------------
        2  | DRAFT  | 2026-08-12 20:36:59.807396+00
   ```

3. Back in the still-open browser tab (still holding `expectedVersion = 1`
   from step 1, unaware of the out-of-band change), clicked **Zapisz
   zmiany**.

Result: the save was correctly rejected —

```
PUT /plan-versions/planv-eeb58914-...   409

UI banner: "Stan na serwerze jest inny niż na ekranie — ktoś zmienił to w
międzyczasie albo obiekt jest w innym stanie. Nic nie zostało zmienione.
Odśwież dane i zdecyduj ponownie."
```

The user's unsaved edit (`Krok pierwszy - my edit (will conflict)`)
remained visible in the input — not lost, matching the documented contract
in `PlanView.tsx`'s `handleSave` ("Rozjazd z serwerem wraca jako
`kind:'conflict'` ... i celowo NIE dotyka `draftGraph`").

DB readback after the rejected save — confirms the out-of-band write was
**not** clobbered by the failed client save (no corruption in either
direction):

```
 version | status |  semantic_graph.nodes[0].metadata.label
---------+--------+---------------------------------------------
       2 | DRAFT  | "Krok pierwszy - CHANGED OUT OF BAND"
```

**Conclusion: the fix closes the false-positive 409 (stale local bundle
after your own save) while leaving the true-positive 409 (a real
concurrent write from elsewhere) fully intact.**

## 7. Regression test

`tests/components/CaseWorkspace/PlanView.onDraftSaved.test.tsx` — two
tests, both against `PlanView` directly with `./api` mocked
(`updatePlanDraft`):

1. `fires onDraftSaved exactly once after a CONFIRMED successful save` —
   edits a step, saves, asserts `onDraftSaved` was called exactly once and
   that `updatePlanDraft` was called with the `expectedVersion` the
   component held before the save.
2. `does NOT fire onDraftSaved when the save is rejected (e.g. a genuine
   version conflict)` — same edit/save flow but `updatePlanDraft` resolves
   `{ ok: false, failure: { kind: 'conflict', ... } }`; asserts
   `onDraftSaved` is never called.

Run (`npx vitest run tests/components/CaseWorkspace/PlanView.onDraftSaved.test.tsx`):

```
✓ fires onDraftSaved exactly once after a CONFIRMED successful save
✓ does NOT fire onDraftSaved when the save is rejected (e.g. a genuine version conflict)
Test Files  1 passed (1)
     Tests  2 passed (2)
```

**Proof it fails without the wiring**: commented out the single line
`onDraftSaved?.();` in `PlanView.tsx`'s `handleSave` (the exact line the
fix added), re-ran the same test file:

```
❯ tests/components/CaseWorkspace/PlanView.onDraftSaved.test.tsx:147:46
  await waitFor(() => expect(onDraftSaved).toHaveBeenCalledTimes(1));
Test Files  1 failed (1)
     Tests  1 failed | 1 passed (2)
```

(Test 2 still passes when the wiring is removed, as expected — it's the
negative-space assertion and removing a call that shouldn't fire can't make
it fire.) Restored the line immediately after; `git diff --stat` on
`src/components/CaseWorkspace/PlanView.tsx` is empty. Re-ran once more to
confirm both tests pass again post-restore.

**Scope note on what this test does NOT assert.** `PlanView` is tested in
isolation, not mounted inside `CaseDetailScreen` (2000 lines, heavy
routing/API surface — judged too brittle for a focused regression test).
So this test does not exercise `CaseDetailScreen`'s
`tokenPrzeladowania` reload-effect dependency, i.e. it does not prove the
bundle actually refetches. That half of the fix is proven instead by the
live runtime sequence in §2 above (the `GET /cases/.../plan-versions` calls
interleaved after each mutation, visible in the real network log). What the
test *does* prove, and would catch on its own if regressed: `PlanView`
calls its `onDraftSaved` prop exactly once after a confirmed successful
save, and never after a failed one — the exact contract `CaseDetailScreen`
depends on to know when to reload.

## 8. Typecheck

```
NODE_OPTIONS="--max-old-space-size=8192" ./node_modules/.bin/tsc --noEmit ; echo "EXIT=$?"
EXIT=0
```

No `PlanView.tsx` / `CaseDetailScreen.tsx` changes remain in the working
tree — both files are exactly as committed in `cf709284d2`. The only net
diff from this packet is the new test file and this evidence directory.

## 9. What was NOT verified

- No new screenshot files were saved into this evidence directory. Every
  UI state in §2–§6 was visually confirmed live in-session (accessibility
  tree reads + screenshots viewed at each step), but late in the session
  the Chrome MCP extension became unresponsive (CDP `Input`/`Runtime`
  calls timing out, screenshots timing out) while capturing supplementary
  archive images, before any additional runtime checks were attempted. All
  proof steps in this document had already completed and been captured
  (network logs + DB readbacks) before that point — nothing in §1–§8 is
  affected, but there are no `.png` files alongside this `README.md`.
- Did not test the `IN_REVIEW → publish` conflict path specifically (only
  `DRAFT → propose` for negative control (b)); the same `expectedVersion`
  mechanism and the same `runCommand`/`toCommandFailure` code path handle
  both, and §2's positive run already exercised publish successfully, but
  a dedicated out-of-band conflict on publish was not separately run.
- Did not verify behavior under a genuinely concurrent second **browser**
  session (two real tabs racing) — the out-of-band Postgres `UPDATE` in §6
  is a faithful simulation of "someone/something else changed the row"
  (which is what the server-side `expectedVersion` check actually guards
  against, regardless of what mutated the row), but it is not literally two
  browser tabs.
