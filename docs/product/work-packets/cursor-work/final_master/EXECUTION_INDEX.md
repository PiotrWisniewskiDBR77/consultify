# Final V8 — Execution Index (35 positions)

This index is the **operational dashboard** for shipping the program.

Primary sources:

- Master list: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution rules: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Contracts bundle: `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/`

Status legend:

- `draft` → `approved(scope)` → `in progress` → `delivered` → `verified(evidence)`

Interpretation note:

- Row status reflects the **furthest packet state reached** for that module.
- Only `verified(evidence)` means the module is truly closed end-to-end.
- `delivered` means runtime landed, but `P<NN>-C` verification/rollout may still be open.

> Recommended packet baseline for every position: `P<NN>-A` (canon+scope), `P<NN>-B` (core runtime), `P<NN>-C` (evidence+rollout).

## Start rules (to prevent parallel worlds)

Before starting any packet (`in progress`):

- create a single-writer lock: `docs/product/work-packets/cursor-work/final_master/locks/P<NN>-<X>.md`
- follow canon-first rule (extend existing entities; no duplicates)
- define evidence upfront (tests + staging proof) and only then code

References:

- `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- `docs/product/work-packets/cursor-work/final_master/EXECUTION_COORDINATION.md`

## Recommended execution order (dependency-first)

To minimize rework and prevent duplicate truths, ship in this order:

- **Foundation (trust + home + governance)**: 18 → 19 → 27 → 30 → 31 → 32 → 33
  - Why: these define the single product truth for artifacts, provenance, promotion, tenancy, settings, and operator guardrails. Everything else consumes them.
- **Program-wide generation surfaces (consume foundation)**: 24 → 21 → 20 → 17
  - Why: templates + reports + presentations + run grammar must land in Outputs and be governed by provenance; otherwise we create parallel “libraries”.
- **KIMI net-new (blocked by evidence mapping)**: 22 → 23 (only after P22-A/P23-A are approved)
  - Why: strict “no guessing” dependency on evidence mapping; otherwise we ship the wrong UX contract.
- **Execution spine**: 11 → 03 → 04 → 05 → 06 → 02 → 07 → 08
  - Why: initiatives→execution→kpi/finance→radar→calendar→notes→copilot form the operational loop; ordering prevents split-truth and shallow handoffs.
- **Collection + insights**: 09 → 10
  - Why: collection must produce governed evidence before insights can be audited and promoted downstream.
- **Help/KB**: 25 → 26
  - Why: Help establishes contextual entrypoints; KB scales content ops + taxonomy and routing.
- **Partner lane**: 29
  - Why: lifecycle + earnings ledger is its own governed truth; should reuse org/settings/admin foundations.
- **Public assistant**: 16
  - Why: depends on hard boundaries + citations/uncertainty posture; should not precede governance foundations.
- **Chat lane**: 34 → 35
  - Why: wisdom (policy gateway) before history (library/search) to avoid ungoverned retrieval.
- **Remaining modules**: apply the same dependency-first logic using each contract’s section 3 (authority chain) and section 9 (risks/decisions).

| # | Position | Contract (bundle) | Packets (baseline) | Status |
|---:|---|---|---|---|
| 01 | Integracja | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_01_INTEGRACJA_2026-03-29.md` | P01-A / P01-B / P01-C | verified(evidence) — 100/100 tests (72 core + 28 cloud); cloud storage sync: Google Drive (list/download/upload/export), OneDrive/SharePoint (list/download/upload via Graph), Dropbox (list/download/upload via API v2); CONNECTORS catalog extended; cloud sync routes + background import; bidirectional: Jira, Slack, Teams (full), Google Drive/OneDrive/Dropbox (full file sync) |
| 02 | Kalendarz | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_02_KALENDARZ_2026-03-29.md` | P02-A / P02-B / P02-C | approved(scope) |
| 03 | Wdrożenia | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_03_WDROZENIA_2026-03-29.md` | P03-A / P03-B / P03-C | approved(scope) |
| 04 | KPI | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_04_KPI_2026-03-29.md` | P04-A / P04-B / P04-C | approved(scope) |
| 05 | Finanse | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_05_FINANSE_2026-03-29.md` | P05-A / P05-B / P05-C | approved(scope) |
| 06 | Radar | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_06_RADAR_2026-03-29.md` | P06-A / P06-B / P06-C | approved(scope) |
| 07 | Notatnik | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_07_NOTATNIK_2026-03-29.md` | P07-A / P07-B / P07-C | approved(scope) |
| 08 | Teresa | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_08_TERESA_2026-03-29.md` | P08-A / P08-B / P08-C | approved(scope) |
| 09 | Ankiety | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_09_ANKIETY_2026-03-29.md` | P09-A / P09-B / P09-C | approved(scope) |
| 10 | Wnioski w Interview | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_10_WNIOSKI_W_INTERVIEW_2026-03-29.md` | P10-A / P10-B / P10-C | approved(scope) |
| 11 | Inicjatywy | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_11_INICJATYWY_2026-03-29.md` | P11-A / P11-B / P11-C | verified(evidence) — read coherence: portfolio/detail/compact/UI use shared normalized workflow status + drift Callout; gate-readiness + transitions on normalized current status; target status `coerceInitiativeStatusForWrite` in controller; handoff GET + `V8PlanningApi.getInitiativeHandoff`; AI blueprint `apply` → `initiative_history` `ai_blueprint_applied` (proposalId + acceptedDiffSummary); tests 11 canon + 2 handoff route + 3 UI helper = 16; evidence `final_master/evidence/P11_VERIFIED_CLOSEOUT_2026-03-31.md` |
| 12 | Mindmap | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_12_MINDMAP_2026-03-29.md` | P12-A / P12-B / P12-C | approved(scope) |
| 13 | Whiteboard | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_13_WHITEBOARD_2026-03-29.md` | P13-A / P13-B / P13-C | approved(scope) |
| 14 | Proces flow | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_14_PROCES_FLOW_2026-03-29.md` | P14-A / P14-B / P14-C | approved(scope) |
| 15 | Tabele | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_15_TABELE_2026-03-29.md` | P15-A / P15-B / P15-C | verified(evidence) — 33/33 tests; full relational grammar (base→table→field→record→relation→view→form→interface); AI governed pipeline; 26+ migrations, 37+ services |
| 16 | Anna | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_16_ANNA_2026-03-29.md` | P16-A / P16-B / P16-C | verified(evidence) |
| 17 | ArtifactRun z czatu | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_17_ARTIFACTRUN_Z_CZATU_2026-03-29.md` | P17-A / P17-B / P17-C | verified(evidence) |
| 18 | Provenance/Review/Visibility | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_18_PROVENANCE_REVIEW_VISIBILITY_2026-03-29.md` | P18-A / P18-B / P18-C | verified(evidence) |
| 19 | Outputs Library | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_19_OUTPUTS_LIBRARY_2026-03-29.md` | P19-A / P19-B / P19-C | verified(evidence) |
| 20 | Prezentacje | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_20_PREZENTACJE_2026-03-29.md` | P20-A / P20-B / P20-C | verified(evidence) |
| 21 | Raporty | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_21_RAPORTY_2026-03-29.md` | P21-A / P21-B / P21-C | verified(evidence) |
| 22 | Wordy | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_22_WORDY_2026-03-29.md` | P22-A / P22-B / P22-C | verified(evidence) |
| 23 | Excele | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_23_EXCELE_2026-03-29.md` | P23-A / P23-B / P23-C / **P23-D(ext)** | verified(evidence) — P23-D: Intelligent Workbook Builder (5-phase: PLAN→CONFIRM→GENERATE→REVIEW→BUILD, ExcelJS+LLM, quality gates) |
| 24 | Templaty | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_24_TEMPLATY_2026-03-29.md` | P24-A / P24-B / P24-C | verified(evidence) |
| 25 | Help | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_25_HELP_2026-03-29.md` | P25-A / P25-B / P25-C | verified(evidence) |
| 26 | Baza wiedzy | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_26_BAZA_WIEDZY_2026-03-29.md` | P26-A / P26-B / P26-C | verified(evidence) |
| 27 | Tools | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_27_TOOLS_2026-03-29.md` | P27-A / P27-B / P27-C | verified(evidence) |
| 28 | Assessment | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_28_ASSESSMENT_2026-03-29.md` | P28-A / P28-B / P28-C | verified(evidence) — P28-B wdrożenie: `whatNext` + preset **DRD** (`POST .../methodology-preset`); E2E `assessmentWorkbench.p28b-e2e.test.ts`; smoke `server/scripts/smoke-p28-workbench-b.ts`; evidence `final_master/evidence/P28_B_ROLLOUT_2026-03-31.md`; reszta jak wcześniej (workbench API, migracja, testy kontraktu) |
| 29 | Program partnerski | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_29_PROGRAM_PARTNERSKI_2026-03-29.md` | P29-A / P29-B / P29-C | verified(evidence) — P29-B/C: `PartnerProgramLedgerService` append-only ledger + derived balances; `partner_program_runtime` single lifecycle phase; GET `/api/v8/partner/program/status|ledger`; POST partner `earn→payout`; superadmin `/api/superadmin/partner-settlements/program/:partnerOrgId/*`; migration shared with P28 file; contract tests include `deriveBalancesFromEntries` |
| 30 | Organization | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_30_ORGANIZATION_2026-03-29.md` | P30-A / P30-B / P30-C | verified(evidence) — 17/17 tests; 3 downstream bypass fixes (ideaAI, assessment, competitive); trust/conflicts/audit/reuse-contract endpoints; full P30-A 11-point checklist |
| 31 | Settings | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_31_SETTINGS_2026-03-29.md` | P31-A / P31-B / P31-C | verified(evidence) — 69/69 tests; scope model (personal/module/tenant); impact metadata (22 keys); admin routing (403+guidance); module preferences (5 sections); registry API; degraded posture; AI settings merge |
| 32 | Admin | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_32_ADMIN_2026-03-29.md` | P32-A / P32-B / P32-C | verified(evidence) — 69/69 tests; cockpit IA aligned (Members&Roles + Collaboration + SyncHub); audit on member ops; integration 4-status model; ownership boundaries |
| 33 | Superadmin | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_33_SUPERADMIN_2026-03-29.md` | P33-A / P33-B / P33-C | verified(evidence) — 69/69 tests; 11 gated actions (all with requireConfirmation+requireAudit); fail-closed audit (503); 5-branch sidebar IA; tenant lifecycle; emergency controls; type-to-confirm purge |
| 34 | Mądrość czata | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_34_MADROSC_CZATA_2026-03-29.md` | P34-A / P34-B / P34-C | verified(evidence) |
| 35 | Historia czatów | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_35_HISTORIA_CZATOW_2026-03-29.md` | P35-A / P35-B / P35-C | verified(evidence) |

