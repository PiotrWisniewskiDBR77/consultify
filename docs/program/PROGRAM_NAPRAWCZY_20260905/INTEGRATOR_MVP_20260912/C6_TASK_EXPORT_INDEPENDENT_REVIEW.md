# C6 tasks export — independent bounded acceptance

Verdict: ACCEPT for source `65fb1be3df9deaf6b8f6ad9156a14345486d3618`, parent `459069bf0e93d1b4a485e33d5e42856d8e2dab85`. This accepts the manual personal-task content slice, not full task export, full organization export/E4, or combined RC2.

## Independent execution
Clean worktree and all six author manifest SHA256 values verified before and after execution. No product/test edits. Fresh real fixture UUIDs, actual ApiGateway/JWT/PG on explicitly handed-over 127.0.0.1:6457/cx6_export_contract and API4216. One worker, sequential runs.

- `C6_TASK_INDEPENDENT_UNIT.json/log`: 10/10 PASS, zero failures/skips.
- `C6_TASK_INDEPENDENT_GATEWAY.json/log`: 1/1 PASS, zero failures/skips.
- `C6_TASK_INDEPENDENT_RESULT.json`: exact source, fullNames, six restored hashes, clean worktree and API listener closed.

The actual three My Work POSTs returned201, owned GET200, tenant JSON/CSV exports200. Own manual description survives; foreign tenant and notebook-linked content and supplemental SQL sentinels do not. Full task SQL snapshots are unchanged by export. Own fresh fixture cleanup and pool/server close completed. Existing fixtures were not reset.

Author mutation evidence inspected and programmatically compared with independent fullNames: source-edge unit 5PASS/5FAIL → author10PASS → independent10PASS; real HTTP private-linked leak0PASS/1FAIL → author1PASS → independent1PASS. Normal commit hook output reaches this SHA with successful gates; author server tsc reports exit0. These author runs are not relabeled independent.

## Source/security scope
`organizationExportTaskPrivacy.ts` requires exact personal type, explicit manual source and no source_type/source_id/project/initiative/roadmap/parent/idea/KPI/RAID/decision/list/workstream/sprint edge before exposing title/description/tags. Missing/null source is withheld. Other task payload fields never inherit permission from this test. Every populated tasks table keeps an unresolved-content manifest reason.

`organizationExportTaskContract.ts` declares the actual 80-column public.tasks schema, types, primary key and foreign keys; schema drift blocks the table before SELECT. The export service uses its tenant predicate and explicit projection, then the privacy projection before generic sanitation. This does not claim Runtime-v1 execution_task content coverage.

The actual personal writer is `server/src/services/personalTask/createPersonalTaskService.ts:127–188`; manual source default is migration20260213. AI proposal caller stamps ai_chat_proposal/sourceId. TaskController tenant-scoped administrative reader does not confer Notebook owner-only body access. No new blocker found in this bounded slice.

## Required integration and remaining evidence
1. Policy becomes v8. Root disclosure accepted v5/v7 at review time: reconcile known policy versions deliberately and retain completeness/manifest checks. Otherwise v8 safely becomes UNKNOWN; do not claim complete just by recognizing v8.
2. Preserve root policy rollback-discard, CSV manifest and UI disclosure fixes; this author checkout does not contain all combined RC2 prerequisites. Run combined tests after reconciliation.
3. Notebook source is an explicit reference fixture accepted by My Work, not an actual Notebook creation/access workflow. Supplemental risks/attachments were SQL adversarial fixtures. Project/initiative negatives are unit evidence only.
4. Persisted partial provenance is covered. The inherited personal writer writes source fields only when BOTH sourceType and sourceId are present; a one-sided HTTP input is dropped to a null pair. This is an evidence/provenance limitation, not a reproduced export exploit or a newly fixed writer defect.
5. Full supplemental/business/privacy denominator, historical source recovery, actual UI downloads and complete E4 remain open. No browser, staging, deployment or real AI proof is claimed.

Resources released after terminal runs: API4216 closed, all test pools closed, source remains exact/clean. DB handed back for coordinated next work.
