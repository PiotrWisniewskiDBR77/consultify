# F2-3 PMO E2 V8 fresh freeze — 2026-09-13 21:39 America/Chicago

Verdict: **READY_FOR_FRESH_INDEPENDENT_REREVIEW; NOT ACCEPTED; NOT COMMITTED**.

- Base and committed HEAD: `ba25e564592f4a803ecf53edf81b7d8c84524426`.
- Branch: `codex/pmo-projekty-role-statusy-20260913`.
- Scope: E2 only. E3 was not started.
- Migration: **NOT REQUIRED**. No migration file was created.
- Feature flag: `VITE_PMO_PROJECTS === 'true'`; absent or malformed remains OFF.
- Main menu: unchanged; the existing `/projects` route and standard components are reused.

## Post-V6 governed error closure

V6 independent review accepted manifest
`37b6a7e165254a7587f62a9c59ae843cac636af78172faa430942d61ff9d7a44`, but the ordinary commit
hook correctly blocked the candidate on one new English UI sentence. No commit was created. The
source was the team-member route's 400 response. It now returns only the governed machine code
`PROJECT_ORGANIZATION_MEMBERSHIP_REQUIRED` in both `code` and `error`, with no English sentence.
The existing API error normalizer maps the registered fallback and real en/pl locale resources;
the new behavior test proves the real route envelope becomes a Polish sentence without exposing
the raw code or HTTP fallback (`48_v8_governed_error_behavior.txt`). The ApiGateway/JWT/real
PostgreSQL route test proves the exact 400 envelope and retains the tenant/capacity assertions
(`49_v8_realpg.txt`). The prior `t('common.close')` fix remains in the modal, with no English
fallback literal. J0 is GREEN with no baseline update (`51_v8_j0.txt`).

## V5 HOLD closure

V5 found that converting the modal to a native form made the close X and Cancel buttons implicit submitters. Both controls now declare `type="button"`; the close X also has a human accessible name. A durable test mounts the production `CreateProjectModal` with a valid name and proves independently that Cancel closes with zero create calls, X closes with zero create calls, and the Create submitter calls `Api.createProject` exactly once and returns the saved record (`40_v6_modal_behavior.txt`, `41_v6_focused.txt`).

## Post-V4 hook closure

The V4 independent review accepted manifest `f98c766385b9d3785514907740ce20f2499bfc0d8ebea476b0108a69811ea865`, but the first ordinary commit attempt was correctly blocked by the action-coverage hook because the new PMO form used an action-like `onClick={save}`. No commit was created. The modal now uses native form semantics (`form onSubmit` and `button type="submit"`), which preserves the accepted create behavior while keeping a PMO form outside the Idea Workspace action registry. `check-action-coverage` reports 0 new violations and the full `check-actions` gate passes (234 actions, 124 runtime strings, 7 events, 4 API methods). Focused tests, the feature-enabled production build and the full TypeScript delta were rerun after this hook-driven change and the V5 cancel fix.

## V3 HOLD closure

1. The production role-assignment summary consumes canonical `projectRole` from the real members
   API. Legacy `role` is a controlled compatibility fallback and an absent role is rendered as a
   localized unassigned state; the false `MEMBER` fallback is gone.
2. A behavior test mounts the same production summary component with the real GET API shape:
   Anna is `PROJECT_SPONSOR`, Jan is `TASK_ASSIGNEE`, and a rerender after the persisted edit moves
   Jan to `PROJECT_LEADER`. It proves the two distinct human-labelled groups and absence of the
   false `MEMBER` group (`41_v6_focused.txt`).
3. The built-browser flow asserts those same two groups before editing, performs the real
   UI → PATCH → PostgreSQL change to `PROJECT_LEADER` / 75%, and then asserts the updated group and
   removal of the old assignee group (`14_browser_result.json`, `37_v3_browser_run.txt`).
4. The filled lower preview is now captured after scrolling each actual section into the viewport.
   Responsibilities, communication and approval inputs each have distinct 1440×900 light/dark
   evidence (`29_filled_responsibilities_*`, `30_filled_communication_*`,
   `31_filled_approval_*`). These six images were visually inspected after the run.

## Denominators

- Focused unit/behavior: 7 files, 19/19 PASS, including the modal submit/cancel regression test,
  actual production role summary with real API-shaped records, and governed Polish error behavior
  (`50_v8_focused.txt`).
- Real ApiGateway/JWT/PostgreSQL: 1 file, 5/5 PASS, retry 0. Capability-denied writes remain 403
  with zero SQL mutation, the foreign member response has the exact governed 400 envelope, and the
  read-only permissions contract remains proven (`49_v8_realpg.txt`).
- Feature-enabled production Vite build: PASS, 10,715 modules transformed, built in 34.88 s
  in the previously accepted V6 run. The fresh V8 build also passed with 10,715 modules transformed
  in 34.18 s using an 8 GB Node heap (`56_v8_build.txt`). The first default-heap run ended
  terminally at its 4 GB limit and is retained as resource evidence (`55_v8_build_oom.txt`). The
  default-OFF route behavior is covered separately in the focused tests.
- Built browser at 1440×900: 11/11 asserted behaviors, zero console/page/HTTP failures, role
  mutation readback `PROJECT_LEADER` / 75%, and cleanup `organizationRows=0`, `dependentRows=0`
  (`14_browser_result.json`, `17_fixture_cleanup.json`, `37_v3_browser_run.txt`). Telemetry request
  aborts on navigation/teardown remain listed separately and are not HTTP responses or business
  route failures.
- Required separate states remain captured in light/dark: loading (`18_*`), empty (`19_*`),
  no-permission (`20_*`) and required unassigned role (`21_*`). Filled role-dependent sections are
  the new `29_*`–`31_*` pairs.
- Full frontend TypeScript remains a neutral delta, not a repository-green claim: exact base and
  candidate each contain 866 diagnostic lines and are byte-identical, SHA-256
  `47bd5cef37ba70021bf6936106633cfd6ed97f64514f8b3dc9fc86375d3b68a5`. No diagnostic was added by
  E2 (`05_full_tsc_base_ba25e56459.txt`, `58_v8_tsc_candidate.txt`). A terminal default-heap OOM is
  retained separately and was not used as type evidence (`57_v8_tsc_oom.txt`).
- Language and actions: J0 GREEN with no increase and no baseline update; content parity 3/3 PASS;
  action coverage has 0 new violations; full action registry passes at 234 actions, 124 runtime
  strings, 7 events and 4 API methods (`51_v8_j0.txt`–`54_v8_check_actions.txt`).
- `git diff --check`: PASS. API and preview processes were stopped before freeze.

## Remaining gate

Historical HOLD and ACCEPT reports through V6 are retained as evidence. V6 acceptance predates the
hook-driven governed-error delta, so E2 remains unaccepted until a fresh skeptical V8 rereview
validates this exact manifest.
