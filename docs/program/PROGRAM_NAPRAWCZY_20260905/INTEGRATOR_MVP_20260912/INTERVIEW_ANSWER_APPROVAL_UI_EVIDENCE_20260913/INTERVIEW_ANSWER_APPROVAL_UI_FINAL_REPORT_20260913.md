# Interview answer approval UI — final evidence V4

Date: 2026-09-13  
Base: `cfea70de8a02df900f22416e0728de383d1bde26`  
HEAD before UI slice: `b0a2642f9152fd36e590aff2cdb36278c26688b3`  
Verdict: **FROZEN FOR INDEPENDENT REVIEW**. The previously missing final-build runtime gate is GREEN on the exact V3 distribution.

## Delivered behavior

- Organization policy supports `manager`, `ai`, and `two_stage`; absent policy defaults to manager, unsupported future versions fail closed, and unrelated JSON keys survive policy editing.
- Managers approve or send back each answer separately; send-back requires a reason. Respondents see status and reason, can edit only the returned answer, and resubmit only its changed revision while an approved sibling remains frozen.
- Approval projection loading, error, and identity/scope changes fail closed. No answer writer, submit action, per-answer manager action, or legacy whole-assignment manager action is enabled before a successful GET for the exact organization/user/assignment scope. A resolved empty projection keeps the legacy path; a non-empty projection selects exact per-answer behavior.
- `messageKey` translation accepts both normalized `error.data.messageKey` and Axios-compatible `error.response.data.messageKey`.
- Respondents issue no manager-only template/insight reads. Superadmin health uses guarded `/api/system-health/detailed`.

The approval collection is an inline decision form in the canonical Interview document; it is not a second module-level list.

## Automated gate

- Focused UI: **44/44 PASS**, 12/12 suites (`FOCUSED_GREEN_V17_44_OF_44.json`).
- Mutation proof: **5/25 RED** when the new fail-closed/message-key guards are removed; **25/25 GREEN** restored (`RED_V3_FAIL_OPEN_MUTATION.json`).
- Server TypeScript: **0 diagnostics** (`SERVER_TSC_V2_ZERO.log`).
- Frontend TypeScript: **189 inherited diagnostics, 0 on changed product/test paths** (`FRONTEND_TSC_V5_BASELINE_CHANGED_PATH.log`).
- `check:ui`, scoped formatting, `git diff --check`, and build: PASS.
- Exact accepted distribution: `dist/index.html` SHA-256 `49299c4447ca620a049bee24de302e9df163513ec234f16708b438bca0d590d9` (`BUILD_V7_GREEN.log`).

## Exact-final-build runtime gate

The V4 run used only the assigned local resources: API `4214`, preview `5290`, and a separate named `pgvector/pgvector:pg18` container and named volume on `6454`. Port `6456` was occupied and never used. The source staging schema SHA-256 was exactly `bf580feb5a9edd7960a2b38708fa31e5d8b16c7014ec82870f700882aa4aba78`; it restored successfully, and additive migration `20262170_interview_answer_decisions.sql` succeeded twice. The restored database had 1,820 public tables after the migration (`RUNTIME_V4_PG_SETUP_GREEN.txt`, restore/migration logs).

All accepted browser journeys loaded the exact distribution SHA above through preview `5290`, used signed JWTs through the real Gateway/Auth chain, and read/wrote the isolated PostgreSQL database:

- **Manager, light, 1440×900:** both pending answers rendered; q1 Approve and q2 Send back executed as separate POSTs, both HTTP 200. The reason was `Provide the validated source date before final approval.` Page errors 0, console errors 0, local HTTP failures 0 (`RUNTIME_V4_MANAGER_BUSINESS_GREEN.json` and two manager screenshots).
- **Respondent, dark, 1440×900:** approved q1 stayed locked; q2 showed the exact send-back reason. The respondent changed q2 through the rendered answer editor; PATCH returned 200. Resubmission ran inside the same signed browser session; POST returned 200 and the response froze only q2 in a new submission. Page errors 0, console errors 0, local HTTP failures 0 (`RUNTIME_V4_RESPONDENT_BUSINESS_GREEN.json` and two respondent screenshots).
- **Superadmin, light, 1440×900:** the policy selector loaded live `manager`, saved a `two_stage` draft with PUT 200, and `/api/system-health/detailed` returned 200 through its guarded route. Future keys `futureModeKey=keep-me`, `futureInterviewKey`, and `futureTop` survived. Page errors 0, console errors 0, local HTTP failures 0 (`RUNTIME_V4_SUPERADMIN_POLICY_HEALTH_GREEN.json` and screenshot).
- **Controlled loading:** the real same-scope approval GET reached API/PostgreSQL and its response was briefly held. Before resolution there were 0 Approve controls, 0 Send back controls, 0 Review & Submit controls, and 0 enabled answer editors. After resolution the applicable manager control appeared. Page/console/local HTTP failures were 0 (`RUNTIME_V4_LOADING_FAIL_CLOSED_GREEN.json` and screenshot).

Cold SQL readback contains four applied commands and five immutable receipts: initial q1/q2 submission, q1 manager approval, q2 manager send-back with the reason, and a new q2-only submitted receipt after correction. Assignment/session returned to `submitted`; q2 contains the corrected text; q1 retains its original approved revision. The live policy remains manager while the separately versioned draft is `two_stage`, with future keys preserved (`RUNTIME_V4_SQL_READBACK.json`).

## Cleanup

The final cleanup removes the synthetic tenant rows, API and preview processes, the V4 container, and its named volume. `RUNTIME_V4_CLEANUP_ZERO.log` is the final readback for zero fixture rows, zero owned processes/resources, and free ports 4214, 5290, and 6454. Older package-5 disposable containers are also removed; unrelated containers and port 6456 remain untouched.

## Limits

- Full frontend TypeScript remains nonzero because of 189 inherited repository diagnostics; the changed-path denominator is zero.
- This is isolated local acceptance and does not authorize staging, deployment, or production changes.
