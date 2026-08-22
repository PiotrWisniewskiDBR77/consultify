# Wave 3 — guided owner replay

Status: `READY_FOR_GUIDED_REPLAY / OWNER_DECISIONS_PENDING`

This card is the single operator sequence for Piotr's desktop owner review. It
does not replace the sixteen module acceptance registers. A technical browser
pass, fixture readback or green test is not an owner decision.

## Operating rules

- Use only the exact-SHA local runtime and the matching retained FINAL fixture
  manifest for the module under review.
- Run exactly one owned owner-review runtime at a time. Stop and verify the
  complete owned process groups and both ports before starting the next row;
  preserve the retained fixture database unless its reset is the explicit
  subject of the test.
- Before each runtime start, inspect listeners and high-RSS processes. A prior
  owner-review runtime without a live review must be identity-bound and stopped
  before continuing; never terminate protected `3940/3941` or an independently
  owned rebuild runtime.
- Verify the LOCAL build badge before the first action.
- Record every observation in the module owner register with a screenshot or a
  precise `NO_FINDING` result.
- Do not silently substitute demo, legacy or staging data.
- Mobile remains `DEFERRED_NON_GATING`.
- External providers, production actions, push and deployment remain outside
  this replay unless separately authorized.

## Replay order

| # | Module | Start surface | Guided owner check | Decision required for closure |
| -: | --- | --- | --- | --- |
| 1 | Chat | Exact retained `/chat/:conversationId` | Verify source text and two citations; distinguish proposal from action; inspect the materialized document and cold reopen | Citation trust, proposal/action clarity, decision feedback; live-provider boundary acknowledged |
| 2 | My Work / Agent | `/my-work` with the retained OWNER, then requester | Review Inbox decision, task, three-step plan, materialization receipt and completed-task cold reopen | Task/decision clarity, exactly-once confidence and requester/owner handoff |
| 3 | Interview | `/interview` and retained public token | Compare manager Sessions/Inbox with the submitted 3/3 response; open public and revoked token states | Authoring vs V8-only capability split; whether archived/escalation belongs in Wave 3 |
| 4 | Tools | Guided and approved Dynamic SWOT `docId` links | Verify mission, SWOT evidence, tensions, recommended move and derived `80%`/`100%` progress | Consulting flow quality, evidence clarity and output readiness |
| 5 | Assessment | `/assessment` then exact active/frozen DRD sessions | Inspect Method Core list, active evidence, distinct approval, immutable Output and Initiative Draft | DRD navigation, approval clarity and report/reopen boundary |
| 6 | Initiatives | `/initiatives`, Candidates and exact Initiative Card | Verify one complete `IN_EXECUTION` aggregate, pending candidate at `42%`, accepted-candidate absence and stable deep link | Register/card usability; provider-free create and scenario-data scope |
| 7 | Execution | `/execution` and exact `/execution/:caseId` | Inspect accepted delivery, Case v1 workbench and honest empty task/allocation/control/report states | Case/workbench clarity and whether additional operational fixture rows are required |
| 8 | Results | `/results` owner-review entry | Inspect KPI measurements/deviation/receipt, ROI approved-vs-Actual reconciliation/PIR and OKR review/check-in | Executive usefulness, source truth and Actual/reconciliation clarity |
| 9 | Finance | `/finance` through all five retained artifacts | Reopen approved Statement, Analysis, Baseline, Prediction and Valuation; compare lineage, version and computed outputs | Five-workspace usability and confidence in approval/readback chain |
| 10 | Materials | Exact Document Studio, Deck Builder and Excele links | Inspect two document sections, four-slide deck with notes/alt text and saved workbook/formula preview | Editing usability; rights, export/share and provider boundaries acknowledged |
| 11 | Audits | `/audit-programs` then exact program/criterion | Inspect internal pack, program, evidence/finding/remediation, report and proposal | Internal-audit policy, role separation and finding navigation |
| 12 | Meetings | `/meeting?meetingId=...` for pending/rejected/materialized notes | Compare proposal, rejection reason and exactly-one materialization receipt | Proposal vs note clarity, participant naming and provider-off behavior |
| 13 | Organization | Current rebuilt `/organization/*` shell | Review the agreed profile/navigation interpretation, governed context and cold persisted readback | Resolve remaining IA/localization questions; approve rebuilt presentation |
| 14 | Admin | Current rebuilt `/admin/*` shell | Review the seven real IAM domains, invite/role/revoke states and denied safeguards | Confirm ADMIN/OWNER/SUPERADMIN policy and destructive-action confidence |
| 15 | Settings | `/settings/profile`, preferences, access and data controls | Confirm the already accepted direction; verify cold save, export/deletion honesty and legal-hold state | Reconfirm accepted UI direction on the frozen candidate |
| 16 | Partner | `/partner` with retained bound Partner | Inspect profile, certification `1/10`, referral `W3PARTNER`, participant ledger and economics policy denial | Operational journey clarity and explicit economics-OFF acceptance |

## Per-module closure loop

For every row, execute the same sequence:

1. Open the exact deep link and verify fixture identity.
2. Complete the guided happy path and one prepared denial/replay case.
3. Cold refresh or reopen and compare the durable state.
4. Capture screenshots and record every UI/UX/CX observation verbatim.
5. Reconcile the owner register with Piotr: accept, reject or request a change.
6. Implement only the agreed changes, then run focused QA and the same replay.
7. Set the module to `OWNER_ACCEPTED` only after the re-review is explicit.

Wave 3 reaches `WAVE_3_OWNER_ACCEPTED` only after all sixteen rows complete
this loop and the final exact-candidate 16/16 replay is green.
