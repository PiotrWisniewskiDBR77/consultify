# F3 — PARTIAL and SKIPPED result states — live evidence (2026-08-12)

Closes the gap Packet E5 left open: E5 closed 28/28 width×theme a11y cells for
the "Wyniki wykonania kroków" table (`RezultatyView.tsx`) but could not
produce the `partial` and `skipped` `resultAcceptance` states for real. This
packet drives both through the REAL HTTP API against the REAL backend
(`127.0.0.1:3001`) and the REAL disposable Postgres
(`postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test`),
reads them back from Postgres directly, and opens the real UI to confirm it
tells the truth about both.

**NO STATIC MOCK. NO HAND-CRAFTED DOM. NO STUBBED `/api/*`.** Every state was
produced by a real `fetch` against the real Express app, which ran real SQL
against the real container. No source code was changed — the states are
reachable through the runtime exactly as documented in this packet's own
brief, and the UI already tells the truth about both without modification.

## Runtime IDs

| Entity | id |
|---|---|
| Case | `case-b0ffee7b-6e32-46e6-a9cd-ddc08154c028` ("F3 partial+skipped states (2026-08-12T12-56-54-559Z)") |
| Plan version | `planv-6abf17ff-e59b-427e-b844-cc9603e041da` (graph digest `sha256:99c44a49f886bee3904b1a1d56e4285f0ab84741c95c4cb135f7c9b305eca81e`) |
| Run | `cwrun-281457d86a89a55aabcb99b7a44b98d7` |
| Gateway NodeRun (`gw`, DECISION_GATEWAY, SUCCEEDED) | `cwnode-81cb507e-2130-4578-ab77-3cb265beba37` |
| BranchA NodeRun (`branchA`, CAPABILITY, READY — real, created by `advanceRun`) | `cwnode-f37531c1-1ae6-41c2-807a-65e19fa7d648` (this NodeRun's PARTIAL row) |
| BranchB "NodeRun" (`branchB`) | **never created** — deterministic id `cwskip-4a333d9184afed5e2195a38ae808a685` used ONLY for the acceptance row, per `deterministicSkippedNodeRunId`; confirmed absent from `case_workspace_node_runs` below |
| Deliverable (artifact link, DELIVERABLE) | `f3-deliverable-2026-08-12T12-56-54-559Z`, link `cwlink-8cc3fd23-cbcf-44cb-aabe-0f42a4e6a75b` |

## 1. Graph and why it needs no predecessor CAPABILITY node

There is **no HTTP route** to claim/attempt/complete a plain `CAPABILITY`
NodeRun (`nodeRunService.claimNodeRun`/`startNodeRunAttempt`/
`completeNodeRunAttempt` are called directly by the `*.pg.test.ts` suites and
by an internal worker — grepping `server/src/routes/` for those three names
returns nothing). To reach a real `DECISION_GATEWAY` resolution purely
through HTTP, the graph below makes the gateway itself the entry node, so
`startRun` mints it READY with no predecessor to progress first:

```
entryNodeIds: ['gw']
gw (DECISION_GATEWAY) --[e_a CONDITIONAL]--> branchA (CAPABILITY)
                       --[e_b CONDITIONAL]--> branchB (CAPABILITY)
```

## 2. Exact API sequence (both states, one Case, one Run)

Full request/response trace: `drive-states-output.json` (machine-readable,
includes every response body) and `drive-states-stderr.log` (compact
one-line-per-step log). Script: `drive-states.mjs`, run as:

```bash
node drive-states.mjs > drive-states-output.json
```

| # | Call | Result |
|---|---|---|
| 1 | `POST /api/auth/login` (`cw.local@local.test`) | 200, real JWT |
| 2 | `POST /cases` `{caseProfile:'STANDARD', contractedClosureType:'DELIVERY_COMPLETED'}` | 201, `caseStatus:'DRAFT'` |
| 3 | `POST /cases/:caseId/plan-versions` (graph above) | 201, `version:1` |
| 4 | `POST /plan-versions/:id/propose` | 200, `version:2` |
| 5 | `POST /plan-versions/:id/publish` | 200, `version:3`, real `graphDigest` |
| 6 | `POST /cases/:caseId/runs` `{casePlanVersionId, idempotencyKey}` | 201 — **this call ALSO creates the `v8_execution_runs` row and the `case_workspace_run_bindings` row internally** (`runLifecycleService.createRun`, read from source — confirmed no separate `/run-bindings` call was needed) |
| 7 | `POST /runs/:runId/start` | 200, `nodeRunIds:['cwnode-81cb...']` — `gw` minted READY |
| 8 | `POST /runs/:runId/gateway-evaluations` `{nodeRunId: gwNodeRunId, outcomeStatus:'BRANCH_SELECTED', outcomeDetail:{selectedEdgeId:'e_a'}}` | 201, real `case_workspace_gateway_evaluations` row |
| 9 | `POST /runs/:runId/advance` | 200 — **in one call**: resolves `gw` -> SUCCEEDED, creates `branchA`'s real NodeRun READY (`createdNodeRunIds:['cwnode-f375...']`), and (inside `recordUnselectedBranchesSkipped`) writes the SKIPPED/NOT_APPLICABLE row for `branchB` |
| 10 | `POST /cases/:caseId/artifact-links` (deliverable, so the PARTIAL row's snapshot points at something real) | 201 |
| 11 | `POST /runs/:runId/node-result-acceptances` `{nodeRunId: branchANodeRunId, nodeType:'CAPABILITY', nodeCompletionState:'COMPLETED', resultAcceptance:'PARTIAL', acceptanceInputSnapshot:{summary, artifactType:'document', artifactId: deliverableId}}` | **201 — THE PARTIAL ROW** |
| 12 | `GET /cases/:caseId/node-result-acceptances` (the exact route `RezultatyView.tsx` calls) | 200, 2 rows: SKIPPED + PARTIAL |
| 13 | Second, independent `GET` of the same route | 200, byte-identical to #12 (refresh-safety at the API layer) |

## 3. Which layer holds which "partial" value — established from the code, not guessed

The task brief warned the true value could be `PARTIAL`, `PARTIALLY_ACCEPTED`,
or `COMPLETED_PARTIAL` depending on layer. All three exist, at three
different layers, confirmed by reading the source (not by inference):

| Layer | Table / field | Enum values (source) | Value used here | UI surface |
|---|---|---|---|---|
| **Node result acceptance** (per-step) | `case_workspace_node_result_acceptances.result_acceptance` | `resultAcceptanceEnum` in `server/src/routes/caseWorkspace/executionGraph.routes.ts:58` = `ACCEPTED \| PARTIAL \| REJECTED \| NOT_APPLICABLE` | **`PARTIAL`** ← this packet | `RezultatyView.tsx` "Wyniki wykonania kroków" table, column "Status akceptacji", label `resultAcceptanceLabel('PARTIAL') = 'Częściowo zakończone'` (`apiResults.ts:145-158`), tone `warning` (amber pill) |
| **Run outcome** (whole Run, after it is technically terminal) | `case_workspace_runs.outcome_status` | `outcomeBody` in `server/src/routes/caseWorkspace/runLifecycle.routes.ts:198` = `PENDING_REVIEW \| ACCEPTED \| REJECTED \| PARTIALLY_ACCEPTED \| NOT_APPLICABLE` | **`PARTIALLY_ACCEPTED`** — NOT produced (see §6) | `RealizacjaView.tsx:1379` renders `selectedRun.outcomeStatus` via `runOutcomeStatusLabelDisplay`; label table `RUN_OUTCOME_STATUS_LABELS['PARTIALLY_ACCEPTED'] = 'Wynik częściowo zaakceptowany'` (`src/utils/enumLabels.ts:513`) |
| **Case closure** (whole Case) | `case_core.closure_type` / `contracted_closure_type` | `closureTypeEnum` in `server/src/routes/caseWorkspace/cases.routes.ts:31` = `...\| COMPLETED_PARTIAL` | **`COMPLETED_PARTIAL`** — NOT produced (see §6) | `closureTypeLabel('COMPLETED_PARTIAL') = 'Zakończone częściowo'` (`src/utils/enumLabels.ts:234`) |

The state this packet's brief actually names — `runLifecycleService.
recordUnselectedBranchesSkipped`'s sibling non-skipped completion outcome, in
the SAME table as the SKIPPED row, feeding the SAME table E5 was blocked on —
is the first row: node-level `PARTIAL`. That is what was produced, verified
in the DB, and verified in the UI below.

## 4. DB readback

```
$ docker exec case-workspace-test-pg psql -U case_workspace -d case_workspace_test -c \
"SELECT node_run_id, case_id, run_id, node_type, node_completion_state, result_acceptance, \
        skip_authorized_by_graph_condition, skip_condition_ref, caused_by_gateway_node_run_id, occurred_at \
 FROM case_workspace_node_result_acceptances WHERE case_id = 'case-b0ffee7b-6e32-46e6-a9cd-ddc08154c028' \
 ORDER BY occurred_at;"

                 node_run_id                 |                  case_id                  | ... | node_completion_state | result_acceptance | skip_authorized_by_graph_condition |          skip_condition_ref          |        caused_by_gateway_node_run_id
---------------------------------------------+--------------------------------------------+-----+------------------------+--------------------+-------------------------------------+---------------------------------------+----------------------------------------------
 cwskip-4a333d9184afed5e2195a38ae808a685     | case-b0ffee7b-6e32-46e6-a9cd-ddc08154c028 | ... | SKIPPED                | NOT_APPLICABLE     | t                                   | ref:decision-gateway:gw:selected:e_a | cwnode-81cb507e-2130-4578-ab77-3cb265beba37
 cwnode-f37531c1-1ae6-41c2-807a-65e19fa7d648 | case-b0ffee7b-6e32-46e6-a9cd-ddc08154c028 | ... | COMPLETED               | PARTIAL            |                                      |                                        |
(2 rows)
```

And the CW-RT-037 invariant this packet's brief cites directly — branchB's
NodeRun was NEVER created (only its acceptance ROW exists, with a
deterministic id that is not present in `case_workspace_node_runs`):

```
$ docker exec case-workspace-test-pg psql -U case_workspace -d case_workspace_test -c \
"SELECT node_run_id, node_id, status FROM case_workspace_node_runs WHERE run_id = 'cwrun-281457d86a89a55aabcb99b7a44b98d7' ORDER BY created_at;"

                 node_run_id                 | node_id |  status
---------------------------------------------+---------+-----------
 cwnode-81cb507e-2130-4578-ab77-3cb265beba37 | gw      | SUCCEEDED
 cwnode-f37531c1-1ae6-41c2-807a-65e19fa7d648 | branchA | READY
(2 rows)
```

Two rows only — `branchB` never appears here, exactly matching
`gatewayAdvance.pg.test.ts`'s own locked assertion.

## 5. UI evidence

All screenshots taken against the live vite dev server (`127.0.0.1:4501`,
proxying to the live backend on `127.0.0.1:3001`), real login
(`cw.local@local.test`), real theme toggle (same
`localStorage['consultify-storage']` mechanism the app's own theme switch
uses — not a CSS hack), real navigation. Script: `capture.mjs`, run as:

```bash
node capture.mjs "$(pwd)" case-b0ffee7b-6e32-46e6-a9cd-ddc08154c028
```

- `desktop-dark-node-results-table.png` / `desktop-light-node-results-table.png`
  (1440×900) — both rows visible: `Robi to system | Zakończony | Częściowo
  zakończone (amber pill) | 12.08.2026` and `Robi to system | Pominięty |
  Nie dotyczy (neutral pill) | 12.08.2026`.
- `desktop-dark-partial-preview.png` — the PARTIAL row's detail panel:
  pills `Częściowo zakończone` + `Zakończony`, real `Źródłowy Run`/`NodeRun`
  ids matching the table above, `DOWÓD` showing the exact
  `acceptanceInputSnapshot.summary` text sent in step 11. The linked
  deliverable correctly shows **"Tego obiektu nie otworzymy — Ten dokument
  nie istnieje w module Dokumenty"** — truthful, not a defect: the
  `artifact-links` row was created without a matching Document Studio row
  (same pre-existing, already-documented gap `RezultatyView.tsx`'s own file
  header describes: "0 z 70 powiązań... wskazuje realny wiersz").
- `desktop-dark-skipped-preview.png` — the SKIPPED row's detail panel: pills
  `Nie dotyczy` + `Pominięty`, `Autoryzacja pominięcia: tak — warunek grafu`
  (truthfully reflecting `skip_authorized_by_graph_condition=true`), real
  `Źródłowy Run`/`NodeRun` (the deterministic `cwskip-...` id) matching the DB
  row above, `KONTEKST RUN` showing the real plan version and graph digest.
- `mobile-dark-node-results-table.png` / `mobile-light-node-results-table.png`
  (390×844) — both rows present (confirmed via `run-results.json`
  `mobile-*-partial-row-visible`/`mobile-*-skipped-row-visible: true`); the
  STATUS AKCEPTACJI column is off-screen at this scroll position (same
  established horizontal-scroll table behavior C4's evidence already
  documented for this component).
- `mobile-dark-node-results-scrolled-right.png` — the SAME table's own
  horizontal scroller moved right, confirming both pills (`Częściowo
  zakończone` amber, `Nie dotyczy` neutral) are genuinely reachable on
  mobile, not just cut off (`scroll-check.mjs`).

## 6. Refresh, close/reopen — both survive

From `run-results.json`:

| Check | Result |
|---|---|
| Hard `page.reload()` on the Rezultaty tab | `partialVisibleAfterRefresh: true`, `skippedVisibleAfterRefresh: true` |
| Navigate away to `/zlecenia` (case list — `desktop-dark-case-list-after-close.png` shows the synthetic Case in the real list, "W toku"), then back into the SAME Case's Rezultaty tab | `partialVisibleAfterReopen: true`, `skippedVisibleAfterReopen: true` (`desktop-dark-after-reopen.png`) |

Both are genuine — `RezultatyView.tsx`'s own `useEffect` re-fetches
`GET /cases/:caseId/node-result-acceptances` on every mount (no client cache,
no session storage), so "survives refresh/reopen" here means exactly what it
says: the row lives in Postgres, not in anything the browser could lose.

## 7. UI truthfulness verdict — no defect found

Both states render **truthfully**:

- Label, tone and description all match the underlying data exactly
  (`nodeCompletionStateLabel`/`resultAcceptanceLabel`/`resultAcceptanceTone`
  in `apiResults.ts`, verified against this packet's own DB rows).
- The SKIPPED row's preview correctly states it was authorized by a graph
  condition ("tak — warunek grafu") rather than implying an error.
- The PARTIAL row's preview correctly surfaces the acceptance snapshot text
  and correctly reports the linked deliverable as unopenable, with an honest
  reason, rather than a silent dead link.
- No source file under `src/components/CaseWorkspace/` was modified for this
  packet — the existing implementation already tells the truth for both
  states.

## 8. What was NOT produced, stated plainly

The two SIBLING "partial" values at other layers (§3) were **not** produced:

- `case_workspace_runs.outcome_status = 'PARTIALLY_ACCEPTED'` — `POST
  /runs/:runId/outcome` (`runLifecycleService.recordRunOutcome`) hard-requires
  the Run to already be technically terminal (`COMPLETED`/
  `COMPLETED_WITH_WARNINGS`/`FAILED`/`CANCELLED`/`COMPENSATED` — verified by
  reading `runLifecycleService.ts:1691`). Reaching that requires driving
  `branchA`'s NodeRun through claim → attempt → complete, and **no HTTP route
  exists for that** (`nodeRunService.claimNodeRun`/`startNodeRunAttempt`/
  `completeNodeRunAttempt` are called only from `*.pg.test.ts` suites and an
  internal worker — confirmed absent from every file under
  `server/src/routes/`). Producing this would have required calling internal
  service functions directly rather than through the HTTP surface this
  packet was asked to drive through, so it was left undone rather than faked.
- `case_core.closure_type = 'COMPLETED_PARTIAL'` — reachable via `POST
  /cases/:caseId/closure`, but recording a real Case closure was out of this
  packet's scope (the brief's target was specifically the
  `node_result_acceptances` SKIPPED/PARTIAL pair) and was not attempted.

No UI code under `src/components/CaseWorkspace/` was changed — investigation
found the existing implementation already renders both target states
truthfully, so no edit was justified.

## Files

| File | Contents |
|---|---|
| `drive-states.mjs` | Driver — real HTTP sequence producing both states |
| `drive-states-output.json` | Full JSON trace: every request's response body, plus the two independent list reads |
| `drive-states-stderr.log` | Compact per-step log from the same run |
| `capture.mjs` | Playwright — desktop/mobile × light/dark, preview panels, refresh, close/reopen |
| `scroll-check.mjs` | Supplementary — mobile horizontal-scroll proof for the status column |
| `run-results.json` | Machine-readable capture results (visibility booleans, URLs, full preview panel text) |
| `*.png` | Screenshots listed in §5 |
