# W05 AI evaluation — final independent review

2026-09-12. Verdict: **BOUNDED ACCEPT** for source `12bd6a32936c952b56328345b0a4b405821895ce`. Not full Interview/MVP acceptance.

## Exact source and independent execution

WT `codex4-w05-ai-evaluation` clean at entry and exit, same HEAD. Author handed over frozen API4214 PID33896 and Vite5214 PID91504; listener identity and both process cwd verified against this WT. Only owned local PG6455/cx4_pilot. No restarts, source edits, external provider, production or deployment.

Independent evidence directory: `/Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/w05-evaluation-independent-final/`.

- `pg-vitest.json`, `pg-result.json`, `pg.log`: **58/58 PASS, zero skipped**, actual Gateway/JWT/PostgreSQL and controlled provider, maxWorkers1. Both legacy and V8 endpoint families exercised. Includes anonymous recommendation/feedback/justification sentinel; own response and stored full snapshot retain it, reviewer response does not. Permission/tenant/project/team revocation and persisted drift during provider deny without response sentinel or persistence; timeout/late loser and two actual competing evaluations retain the winning snapshot. Approved explicit evaluation preserves lifecycle, answers and history.
- `frontend-vitest.json`, `frontend.log`: **10/10 PASS, zero skipped**, actual Workspace behavior including missing/present saved snapshot no-op remount and explicit Refresh. These are new independent runs, not source-text assertions.
- `ui/cycle-evidence.json`: **PASS_ONE_RECORD** on new assignment `c27e567d-6e24-46a3-ac1c-48375ebdf985`, session `28abcaec-d9fc-4c9a-83c5-72be4231b57b`. Real API login/JWT, frontend, PostgreSQL; answer → submit → manager return with reason → respondent correction → resubmit → manager approve → both reload. Final approved/completed, answer EUR4800, three immutable history rows. Existing approved author records were not reset. New initial fixture SQL-seeded; creation/publication flow NOT_PROVEN.
- In that same cycle, submitted reload: **0 evaluation POST and identical snapshot/reviewed_at/updated_at**. Explicit Refresh: **HTTP200 and changed persisted review timestamp**. Controlled local rubric dependency only: AI quality and real provider integration NOT_PROVEN.
- Inspected own light/dark 1440×900 PNGs (`evaluation-readonly-light.png`, `cycle-07-resubmitted-dark.png`): working question/review controls, no white/crash render. `luma.json` light245.15/dark27.58, delta217.56. Existing raw decision labels visible. No pageerror; **18 inherited GET insights403**, so no claim of zero HTTP errors.

## Source qualification

Read final shared evaluation guard, controller and Workspace plus test sentinel/competing completion assertions. Initial permission check precedes evaluated question/model work. Completion and timeout reauthorize in a short locked transaction and compare persisted session/assignment/question revision before writing. No transaction spans the model call; denied completion does not return its sensitive rubric. Assignment/session linkage and persisted tenant/project are checked, active organization membership required, respondent/team and explicit scoped reviewer remain distinct. Anonymous recommendations are now redacted alongside feedback/justification. Source hashes retained in `source-hashes.json`.

No new blocking finding in this bounded change. Existing UI `runAiQualityReview` late A→B local-state identity risk remains SOURCE_RISK, not an independently demonstrated runtime exploit and not claimed fixed. Tests do not prove every possible concurrent membership-policy write between final guard and COMMIT. Other AI entry points and the complete Interview module remain separate gates.

## Hook qualification and retained RED

Original12bd commit **did not execute hooks** because `.husky` was absent in sparse checkout. Author subsequently ran actual unmodified pre-commit and commit-msg against the exact 0dedb→12bd diff using isolated Git metadata/index, both exit0 (`HOOK_VALIDATION.md`, `hooks-retrospective.log`). Root independently confirmed staged diff byte identity50490/50490,8 files. This is retrospective validation, not original commit hookPASS.

Author retained baseline58 RED36FAIL/22PASS, auth mutation58 RED18FAIL/40PASS and open mutation10 RED3FAIL/7PASS. Anonymous recommendation targeted RED2/2 predates final privacy fix; earlier58GREEN did not prove that sentinel. Own final58 run above contains the corrected sentinel. No independent mutation rerun was needed or performed.

Runtime returned to integrator after browser exit; no remaining reviewer processes. Safe evidence and report are external; private-state.json contains credentials and must not be published.
