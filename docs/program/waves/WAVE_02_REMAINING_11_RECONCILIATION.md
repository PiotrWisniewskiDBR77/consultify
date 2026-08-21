# Consultify — reconciliation of the 11 pre-Wave-2 incomplete tasks

Date: `2026-08-21`  
Branch: `codex/wave2-browser-transfer-20260821`
Wave 2 transfer merge candidate: `26592bcf2b`

Wave 2 P4 product candidate: `a36d9d51edc87bb63e7211754e22106d02d2d3d0`

Owner decision: `OWNER_ACCEPTED_WITH_WAVE_3_QUALITY_FOLLOWUP` (`2026-08-21`)
Report HEAD at audit start: `f5a5db9e10`

## Authority and counting rule

The authority is the 82-task denominator parsed by
`scripts/cleanup/report-closure-progress.mjs` from
`docs/cleanup/POST_CLEANUP_COMPLETION_PLAN.md` and the four allocation files.
After the Results owner/telemetry closure it returns exactly
`73 DONE_CURRENT_SHA / 9 PARTIAL`, with
zero missing and zero invalid evidence records.

The original 11 are the current ten plus `CHAT-NFR-001`, which Wave 1 promoted
under the explicit internal-beta technical-completion decision. No other task is
promoted merely because a narrower Wave 2 packet passed.

## Requirement-by-requirement reconciliation

| # | Task | Current truthful state | Evidence gained in Wave 1/2 | Missing literal gate | Next authorized action |
|---:|---|---|---|---|---|
| 1 | `CHAT-NFR-001` | `DONE_CURRENT_SHA` | Wave 1 reconciled the existing NFR evidence and owner decision; external provider stability remains a release boundary. | No repository-technical gate for the accepted scope. | Retest provider window only at release qualification; do not reopen the technical task without new evidence. |
| 2 | `RES-MVP-LEGACY-CUTOVER-001` | `DONE_CURRENT_SHA` | All 28 Results writer doors have a decision: 23 disabled behind proven successors and narrow rollback; five retained as `canonical_current` with exact owner contracts. Registry `8/8`, real-PG `25/25`, retained-owner telemetry `5/5`, fresh `815`, repeat/dry `0/0`. | None for the bounded Wave 2 cutover contract. No backfill is required because the five retained writers keep their existing owner identities and were not retired. | Reopen only if a future product decision replaces one of the five retained contracts; require successor parity before disabling it. |
| 3 | `FIN-MVP-CUTOVER-001` | `PARTIAL` | Finance exact-six and Statement identity are closed; the final audit restored eight governed V8 budget handlers lost by merge `826dac93da`, then ECO-W41 unlink gained a DRAFT/CAS/idempotent successor with immutable snapshot receipt and rollback. Exact-current count is `26/52 retired`, `26 open`; focused `101/101`, real-PG `72/72`, fresh/repeat/dry `816/0/0`. | The remaining enabled legacy Finance mutation doors still require governed successors or explicit retained-owner decisions, ID-space/backfill/usage proof and rollback across the full denominator. | Close one bounded writer family at a time; do not infer global cutover from Statement exact-six or the bounded budget family. |
| 4 | `FIN-UI-CANON-001` | `PARTIAL` | Historical mounted G4 covers responsive/theme/locale/a11y; Wave 2 closes the exact-six backend flow. | Exact-current mounted browser acceptance for all five Finance workspaces, including Prediction and Valuation owner review, is absent on the Wave 2 SHA. | Include Finance in the 16-module exact-SHA owner round; retain all earlier screenshots as historical evidence only. |
| 5 | `MAT-POL-001` | `PARTIAL / BLOCKED_OWNER` | Fail-closed provenance, quarantine, immutable receipts and real-PG negative controls are present. | Approved provider, DPA/residency/SLA/cost and asset provenance/license authority remain owner/legal decisions. | Present the policy decision packet; make no provider or production-policy selection autonomously. |
| 6 | `AUD-POL-001` | `PARTIAL / BLOCKED_OWNER` | Rights tests prove publish/use refusal and tenant controls on real PostgreSQL. | Methodology/rights owner, internal-pack scope and segregation-of-duties decision; named external standards remain OFF. | Obtain the bounded rights/scope decision, then rerun the exact policy matrix. |
| 7 | `ADM-MVP-BACKUP-001` | `PARTIAL` | Disposable encrypted backup/restore, checksum, tenant isolation and cold readback passed. | The master plan requires an authorized staging restore/recovery rehearsal; disposable local PostgreSQL is not staging proof. | Prepare the staging runbook and target checks; execute only with separate environment authorization. |
| 8 | `SET-MVP-DELETE-001` | `PARTIAL / APPROVED_OUT_BOUNDARY` | Request scheduling is guarded by password and organization context; destructive execution remains OFF and was never invoked. | Owner/legal retention policy plus visible request/cancel/approve/legal-hold/anonymization disposition. | Keep destructive execution disabled; verify owner-facing approved-out messaging during Settings acceptance. |
| 9 | `PRT-MVP-ACCRUAL-001` | `PARTIAL / APPROVED_OUT_BOUNDARY` | Policy absence/draft/malformed cases fail closed; atomicity, idempotency, tenant and independent-approval controls passed. | Six production policy fields remain unapproved, and the owner-facing excluded-economics message is not accepted on the current SHA. | Keep accrual/payout OFF; verify the explicit no-false-success boundary in Partner owner acceptance. |
| 10 | `FLOW-TRANSFORM-MVP-001` | `PARTIAL` | Wave 2 proves an immutable approved Dynamic SWOT through Runtime-v1, Execution, Results and governed Closure on real PostgreSQL (`4 PASS / 1 retired legacy skip`). | The parent task additionally requires the full Organization/Interview/DRD/SWOT → Initiative → Execution → Results Actual → Finance reconciliation → PIR chain, deployed desktop/mobile and rollback. | Reuse the Wave 2 lineage as the SWOT subflow, then implement and prove the missing upstream/downstream segments in Wave 4. |
| 11 | `REL-001-T01` | `PARTIAL / NOT_AUTHORIZED` | Historical staging windows and rollback receipts exist. | All preceding tasks, frozen exact-current SHA, exact-SHA deployment/readback, full current 16-flow replay and explicit Piotr release authorization. | No action in Wave 2; never push, deploy or infer GO from local gates. |

## Honest closeout

- Repository-technical tasks promoted in these waves: `CHAT-NFR-001` and
  `RES-MVP-LEGACY-CUTOVER-001`.
- Wave 2 technical subpackets completed without promoting their broader parent
  tasks: Results writer ambiguity, Finance Statement exact-six, Transform SWOT
  runtime lineage and Teresa explicit MVP denominator.
- The bounded P4 Dynamic SWOT owner-header gate is owner-accepted as-is. Piotr's
  explicit statement that the UX remains unsatisfactory is carried as an open
  Wave 3 quality review and does not reopen the bounded Wave 2 packet.
- Current 82-task count is `73 DONE_CURRENT_SHA / 9 PARTIAL`.
- This is not a failure of the Wave 2 code packet. It is the required separation
  between bounded technical proof and the broader owner/environment/release
  contracts in the 82-task authority.
