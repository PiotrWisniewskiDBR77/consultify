# Claude A — method and evidence kernel closure plan (15 tasks)

Branch: `codex/closure-claude-a-method-evidence`

Worktree: `/Users/piotrwisniewski/Developer/consultify-closure-claude-a`

Product/code baseline: `0f5652690b59f5ebe3f465131bd591a2c4340d2e`

Scope packet commit: `aca1b7a126`

Execution-readiness packet commit: `59d572fb83`

Execution baseline: `refs/tags/closure-execution-baseline-20260816`

Mandatory context:

- `../POST_CLEANUP_COMPLETION_PLAN.md`
- `FOUR_BRANCH_EXECUTION_CONTRACT_20260816.md`
- `../CLEANUP_CURRENT_STATE_20260816.md`
- `../CLEANUP_RECOVERY_LEDGER_20260816.md`
- `EXECUTION_GATE_CATALOG_20260816.md`
- `OWNER_DECISIONS_AND_MEASURABLE_GATES_20260816.md`

## Mission

Pracuj do skutku nad all 15 tasks below. Close the shared method/evidence
philosophy across Assessment, Audits and Tools, plus the two Interview tasks
that create and deliver governed evidence. Do not take ownership of Initiative,
Execution, Results, Finance or shared route/flag infrastructure. Produce
exact-SHA realDB/browser evidence and bounded commits for every reproduced gap.

## Owned tasks — exact denominator 15

### Assessment — DRD only (3)

1. `ASM-BVP-001` — Library → DRD session → answers/evidence → review/freeze →
   immutable report → exactly-one initiative candidate/batch → cold reopen.
   Close the known Library→Session gap if reproduced.
2. `ASM-METHOD-CATALOG-001` — reconcile `assessment_definitions`,
   `method_packs`, client flags and source registry into one governed owner.
   DRD active; SIRI/ADMA/other methods fail-closed pending rights decision.
3. `ASM-UI-CANON-001` — five surfaces plus create/edit/freeze/readback,
   all states/viewports/themes/languages and a11y evidence.

### Audits — internal transformation pack (7)

4. `AUD-POL-001` — prepare methodology/rights/SoD decision packet; keep named
   external standards fail-closed and continue executable internal-pack work.
5. `AUD-BVP-001` — program create/save/reopen and mounted contract; tenant,
   role, stale/replay, badge/routes and flags OFF/ON.
6. `AUD-MVP-OWNER-001` — one API/data writer; `/audit-programs` canonical,
   legacy routes redirect/read-only/retired only after proof.
7. `AUD-MVP-RIGHTS-001` — provenance/rights enforcement; unapproved names,
   content and scoring remain unavailable.
8. `AUD-MVP-LIFECYCLE-001` — criterion→evidence→finding→action→candidate→
   closure→effectiveness, immutable audit and no self-approval.
9. `AUD-MVP-AI-HANDOFF-001` — AI proposal-only, human approval and exactly one
   downstream receipt.
10. `AUD-MVP-DATA-001` — governed synthetic fixture: at least 150 criteria,
    400 evidence, 60 findings, 40 actions and 12 candidates plus tenant/role,
    performance and cold-reopen proof.

### Tools — Dynamic SWOT only (3)

11. `TLS-BVP-001` — mission/cards/evidence → review → immutable output →
    report/presentation/candidate proposal → reopen. Prove CAS 409/428, tenant,
    race/replay and nonempty frozen lineage on fresh PG/browser.
12. `TLS-CATALOG-001` — one truthful catalog. Dynamic SWOT is the only active
    MVP tool; hide or mark unapproved tools unavailable. Do not add content
    without provenance/rights.
13. `TLS-UI-CANON-001` — all SWOT surfaces/states and full responsive,
    themes/languages, keyboard/axe and visual sign-off pack.

### Interview evidence/delivery boundary (2)

14. `INT-BVP-001` — evidence-focused portion of publish → invite → respondent
   resume → submit → approve
   insight → one candidate → cold reopen. Prove expiry/revoke, anonymous wall,
   org owner/admin/direct/team assignee access, tenant, stale and concurrency.
15. `INT-DELIVERY-OPS-001` — verify integer `ingest_to_knowledge` write/readback
   on fresh PG, forced AI review >12 s bounded fallback, nullable structured
   output and missing notification-preferences table fallback.

## Atomic execution matrix

`G0…G6` refer to `EXECUTION_GATE_CATALOG_20260816.md`. Owner records must be
verified through the migration ledger and information_schema before editing;
an unexpected second writer is a defect, not permission to add a third.

| Task | Required predecessors | Canonical owner records | Required gates | External disposition |
| --- | --- | --- | --- | --- |
| `ASM-BVP-001` | catalog contract drafted | `method_sessions`, `method_evidence`, `method_outputs`, `assessment_reports`, `assessment_initiative_batches` | G0–G6; exactly-one batch; cold reopen | none |
| `ASM-METHOD-CATALOG-001` | rights packet | `assessment_definitions`, `method_packs`, flag registry via integrator request | G0–G3, G5–G6; one active DRD version | `BLOCKED_OWNER` for non-DRD |
| `ASM-UI-CANON-001` | ASM BVP stable | Assessment mounted routes/tabs; no new writer | G0–G2, G4, G6 | manual UX/VoiceOver |
| `AUD-POL-001` | none | decision/evidence only | G0, G6 | methodology/legal owner |
| `AUD-BVP-001` | owner contract | `audit_programs`, criteria/members/findings/evidence | G0–G6; flag OFF/ON; CRUD+cold reopen | none |
| `AUD-MVP-OWNER-001` | none | `/audit-programs` writer and `audit_programs`; legacy routes no mutable owner | G0–G3, G5–G6; writer inventory=1 | integrator request for shared routes |
| `AUD-MVP-RIGHTS-001` | AUD policy | `audit_packs`, `audit_pack_criteria`, provenance receipts | G0, G2–G3, G5–G6 | methodology/legal owner |
| `AUD-MVP-LIFECYCLE-001` | owner+rights | `audit_evidence`, `audit_findings`, `audit_corrective_actions`, proposals, closure/effectiveness audit | G0–G6; SoD; full lifecycle | none after policy |
| `AUD-MVP-AI-HANDOFF-001` | lifecycle owner | `audit_ai_proposals`, `audit_initiative_proposals`, receipt/outbox | G0–G6; proposal-only; exactly-one receipt | none |
| `AUD-MVP-DATA-001` | schema+rights | lane-A governed fixture only | G0, G2–G6; exact 150/400/60/40/12 minima | none |
| `TLS-BVP-001` | truthful catalog | `tool_sessions`, `tool_outputs`, approvals/reports/proposals/links | G0–G6; CAS; immutable nonempty output | none |
| `TLS-CATALOG-001` | rights inventory | `method_packs`, known-tools/catalog registry via integrator request | G0–G3, G5–G6; one active SWOT packet | `BLOCKED_OWNER` for other tools |
| `TLS-UI-CANON-001` | TLS BVP stable | mounted Tool surfaces only | G0–G2, G4, G6 | manual UX/VoiceOver |
| `INT-BVP-001` | access contract | `interview_sessions`, assignments/members/answers/evidence/insights/handoffs | G0–G6; exact-one candidate; access matrix | none |
| `INT-DELIVERY-OPS-001` | INT BVP | `interview_evidence`, answer history, notifications, AI audit | G0–G3, G5–G6; integer readback; forced >12s | none |

## Domain allowlist

Exact tracked allowlist:
`generated/CLAUDE_LANE_A_PATH_LEASE.json`, SHA-256
`df36e4171a8d3bbd8f772a0badd952b31e003d5ee789c7b2323b7c8da01b818b`.
It contains Assessment/method-core assessment, Audits/audit programs,
Tools/DiscoveryTools/method-core tool surfaces and Interview evidence/delivery
code/tests. No tracked path outside the manifest may be edited.

Shared files listed in the four-branch contract remain integrator-only.
Initiative creation is proposal/handoff only: lane A must never become the
Initiative lifecycle writer.

## Required order and checkpoints

1. Inventory the shared method/evidence kernel and create task→paths→tests map.
2. Assessment, Tools and Audits owner/catalog/rights reconciliation; emit integrator requests
   for shared flags/routes rather than editing them.
3. Internal Audit lifecycle/large fixture and AI handoff.
4. Interview evidence/delivery surgical behaviors and fresh-PG proof.
5. UI canon packets only after runtime contracts settle.
6. Full lane regression, fresh+upgrade PG, signed-in browser and clean handoff.

## Lane acceptance

- all 15 task IDs have a literal verdict and evidence pointer;
- no unapproved method/provider content and no downstream owner takeover;
- domain focused suites, root/server typecheck/build impact gates pass;
- fresh+upgrade migrations are ordered/idempotent if any were added;
- signed-in desktop/mobile journeys use real APIs and persistent data;
- zero unexpected fail/unhandled, no weakened assertions, clean worktree;
- commits are ordered and independently cherry-pickable.
