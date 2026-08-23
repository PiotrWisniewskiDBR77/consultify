# Wave 3 — owner fixture and runtime inventory

> Revalidation warning — 2026-08-23: the database endpoint recorded below no
> longer contains the 16 named fixture databases. The manifests and historical
> evidence remain, but storage readiness is currently
> `DATABASE_ABSENT_AT_REVALIDATION`; see
> [DATABASE_RECOVERY_INVENTORY_2026-08-23.md](DATABASE_RECOVERY_INVENTORY_2026-08-23.md).
> The tables below are retained as historical evidence and must not be read as
> current catalog state.
>
> Reconstruction update — 2026-08-23: Initiatives and Execution have been
> rebuilt and cold-read back on the current 831-migration chain as
> `consultify_w3_initiatives_owner_recovered_20260823` and
> `consultify_w3_execution_owner_recovered_20260823`. Current reconstructed
> storage readiness is `2/16`; see the recovery inventory for exact evidence.

Inventory date: `2026-08-22`

This is a read-only operational inventory. It does not replace the module
acceptance records and does not grant owner acceptance, policy approval or
release authority.

## Qualification method

Each retained candidate was checked independently against local PostgreSQL on
`127.0.0.1:34940`:

1. the exact database exists in `pg_database`;
2. the selected fixture manifest exists, is mode `0600`, declares
   `ownershipState: FINAL`, and names the exact database and fixture ID;
3. `public.wave3_owner_fixture_markers` contains exactly the same fixture ID,
   ownership nonce and current database name;
4. `public.schema_migrations` contains exactly `817` rows;
5. the last browser claim is taken from the current module record, retained
   runtime manifest and the cross-module technical browser report.

Statuses are fail-closed:

- `READY_RETAINED_BROWSER_PROVEN` — all four storage checks pass and a
  fixture-backed technical browser replay exists;
- `READY_RETAINED_REPLAY_REQUIRED` — storage checks pass, but the current
  candidate still needs the specified authenticated browser replay;
- `READY_RETAINED_BROWSER_PENDING` — all four storage checks pass, but the
  retained fixture has not yet completed its exact-runtime browser journey.

## Authoritative module inventory

| # | Module | Status | Exact retained database | FINAL fixture manifest | Exact marker tuple | Migration ledger | Last technical browser proof | Next action |
|---:|---|---|---|---|---|---:|---|---|
| 1 | Organization | `READY_RETAINED_BROWSER_PROVEN` | `consultify_w3_organization_owner_return_20260821` | `/private/tmp/consultify-w3-organization-owner-return.json` | `W3-ORGANIZATION-OWNER-v1` / `d7bb374e83eaef3b857b435c4049bb92cd0583ebf9bfa01f0da2be2839c2bcd6` / `consultify_w3_organization_owner_return_20260821` | `817` | Exact `3d61730fd8ad` runtime on `4080/4081`: real OWNER login, Professional Services profile, `27` claims, truthful readiness `UNKNOWN`, new-tab cold readback and anonymous redirect passed. | Piotr guided owner review; keep `ORG-PF-005`, readiness/IA questions, responsive/theme/a11y and mobile gates open. |
| 2 | Interview | `READY_RETAINED_BROWSER_PROVEN` | `consultify_w3_interview_owner_browser_20260822` | `/private/tmp/consultify-w3-interview-owner-browser-20260822.json` | `W3-INTERVIEW-OWNER-v1` / `f9ba968e8f6e5fa0c2cac42f1e910882cb5db2469d9bb5361e8b0186e3414f1d` / `consultify_w3_interview_owner_browser_20260822` | `817` | Exact `3d61730fd8ad` runtime on `3984/3985`: authenticated manager, public respondent and revoked link cold-opened; provider failed honestly with retryable `503`. | Piotr owner review; keep provider scoring, responsive/theme/a11y and mobile gates open. |
| 3 | Tools | `READY_RETAINED_BROWSER_PROVEN` | `consultify_w3_tools_owner_browser_20260822` | `/private/tmp/consultify-w3-tools-owner-browser-20260822.json` | `W3-TOOLS-OWNER-v1` / `6e7aa3910bc90060986273544fcbcee2434378225c14aec1e547a273b10caf73` / `consultify_w3_tools_owner_browser_20260822` | `817` | Exact `3d61730fd8ad` runtime on `3980/3981`: guided and approved Dynamic SWOT deep links cold-opened from canonical sessions. | Piotr quality/CX review; retain `W3-TLS-CX-001`, provider and mobile gates. |
| 4 | Assessment | `READY_RETAINED_BROWSER_PROVEN` | `consultify_w3_assessment_owner_browser_20260822` | `/private/tmp/consultify-w3-assessment-owner-browser-20260822.json` | `W3-ASSESSMENT-OWNER-v1` / `1094c96fd5fcfa9b88120d927f9f72587d90eef5a251b991c9aaa9218cc6939b` / `consultify_w3_assessment_owner_browser_20260822` | `817` | Exact `3d61730fd8ad` runtime on `3976/3977`: active and frozen DRD sessions, immutable Output and governed Initiative Draft cold-opened. | Piotr owner review; report/reopen, architecture residuals, responsive/a11y and mobile remain open. |
| 5 | Initiatives | `READY_RETAINED_BROWSER_PROVEN` | `consultify_w3_initiatives_owner_night_20260822` | `/private/tmp/consultify-wave3-initiatives-fixture-20260822.json` | `W3-INITIATIVES-OWNER-v1` / `1cc0945caf4043c01652db579d01086d59ba6149b3a9590bc5bde770b8cd377f` / `consultify_w3_initiatives_owner_night_20260822` | `817` | Exact `3d61730fd8ad` replay cold-opened register, pending candidate, canonical Initiative Card and stable `open/mode=doc` link. | Piotr owner review; scenario data, amend/cancel CX, provider, production and mobile remain open. |
| 6 | Execution | `READY_RETAINED_BROWSER_PROVEN` | `consultify_w3_execution_owner_final_ui_20260822` | `/private/tmp/w3-execution-owner-final-ui-20260822-v3.json` | `W3-EXECUTION-OWNER-v1` / `5d643a4dc2ea4ff063c51205c63d3a6f0969b49d539567deb6031f619914291e` / `consultify_w3_execution_owner_final_ui_20260822` | `817` | Exact `3d61730fd8ad` runtime on `3982/3983`: all five tabs mounted and `/execution/w3-exe-case-v1` cold-opened with API/SQL parity. | Piotr owner review; retain truthful empty alternate states and responsive/theme/a11y/mobile gates. |
| 7 | My Work / Agent | `READY_RETAINED_BROWSER_PROVEN` | `consultify_w3_my_work_owner_browser_20260822` | `/private/tmp/consultify-wave3-my-work-owner-browser-20260822.json` | `W3-MY-WORK-OWNER-v1` / `d0621e34fe077c176b1abe87c821b8374f2614861ef8a7d84ac7ef706b1ea2af` / `consultify_w3_my_work_owner_browser_20260822` | `817` | Exact `3d61730fd8ad` runtime on `4060/4061`: decision, task, requester plan, one receipt and completed-task cold readback passed. | Piotr owner review; retain provider/autonomous-materialization and mobile gates. |
| 8 | Meetings | `READY_RETAINED_BROWSER_PROVEN` | `consultify_w3_meetings_owner_night_20260822` | `/private/tmp/consultify-wave3-meetings-fixture-20260822.json` | `W3-MEETINGS-OWNER-v1` / `21eae1788aec51609f8465af79be9ec26dfc9de31cb23dc93596e074ba59f14b` / `consultify_w3_meetings_owner_night_20260822` | `817` | Exact `3d61730fd8ad` runtime on `3970/3971`: pending, rejected and materialized notes cold-opened with receipt counts `0/0/1`. | Piotr owner review; participant-name UX and capture/transcription/media/provider/mobile gates remain open. |
| 9 | Results | `READY_RETAINED_BROWSER_PROVEN` | `consultify_w3_results_owner_final_20260821_c` | `/private/tmp/consultify-w3-results-owner-final-c.json` | `W3-RESULTS-OWNER-v1` / `58a11b580d0371b0b6e86bd3244007f6f36cf0f4fddff27e6f28451711541251` / `consultify_w3_results_owner_final_20260821_c` | `817` | Exact `fd4a7bcbc609` runtime on `3968/3969`: KPI, ROI and OKR canonical screens cold-opened; corrected ROI rendered `62.5%`. | Piotr owner review; provider/policy, responsive/a11y, clean-console and mobile gates remain open. |
| 10 | Finance | `READY_RETAINED_BROWSER_PROVEN` | `consultify_w3_finance_owner_final_ui_20260821` | `/private/tmp/consultify-w3-finance-owner-final-ui-20260821.json` | `W3-FINANCE-OWNER-v1` / `8eeadddd452ff14fdb5eea6a48a8b6c0de78313a4bca3b6e30ffac00e77c0017` / `consultify_w3_finance_owner_final_ui_20260821` | `817` | Exact `fd4a7bcbc609` runtime on `3970/3971`: authenticated exact-six Statement, Analysis, Baseline, Prediction and Valuation chain plus `1024×768` list replay passed. | Piotr owner review; alternate-state, provider, release and mobile gates remain open. |
| 11 | Materials | `READY_RETAINED_BROWSER_PROVEN` | `consultify_w3_materials_owner_browser_20260822` | `/private/tmp/consultify-w3-materials-owner-browser-20260822.json` | `W3-MATERIALS-OWNER-v1` / `8ff8c63b1f07182de5fcca6b04ca2c351a08a5f276e1f5ba10289019d745238d` / `consultify_w3_materials_owner_browser_20260822` | `817` | Exact `3d61730fd8ad` runtime on `3974/3975`: populated DOC, four-slide PPT and XLSX workbook cold-opened. | Piotr owner and restricted-scope decision; export/share/provider and rights gates remain open. |
| 12 | Audits | `READY_RETAINED_BROWSER_PROVEN` | `consultify_w3_audits_owner_final_ui_20260822` | `/private/tmp/w3-audits-owner-final-ui-20260822-v3.json` | `W3-AUDITS-OWNER-v1` / `36151aba792d7edb661a8b296fd9d679f00d23e5e4f01c236ffc8a9eabd945c1` / `consultify_w3_audits_owner_final_ui_20260822` | `817` | Exact `3d61730fd8ad` runtime on `3980/3981`: internal pack, program, evidence/finding/remediation, report and proposal cold-opened; repaired program deep link passed. | Piotr policy/owner review; named standards/providers, responsive/a11y and mobile remain open. |
| 13 | Chat | `READY_RETAINED_BROWSER_PROVEN` | `consultify_w3_chat_owner_final_20260821_b` | `/private/tmp/consultify-w3-chat-owner-final-b.json` | `W3-CHAT-OWNER-v1` / `2db3eadf7873845d520bf6bed60411a40734fe71a0a4fc4ffbbec7e7aa8cfae4` / `consultify_w3_chat_owner_final_20260821_b` | `817` | Exact `3d61730fd8ad` runtime on `4070/4071`: real OWNER approved and materialized the sourced proposal; new-tab cold reopen and single successful receipt DB readback passed. | Piotr owner review; live provider, MEMBER decision policy, responsive/a11y and mobile remain open. |
| 14 | Admin | `READY_RETAINED_BROWSER_PROVEN` | `consultify_w3_admin_owner_final_20260822` | `/private/tmp/consultify-w3-admin-owner-final-20260822.json` | `W3-ADMIN-OWNER-v1` / `ac27d5557055904d5086d90b7cc95eea7120e8aaa837ac21815452dbf21c2471` / `consultify_w3_admin_owner_final_20260822` | `817` | Exact `3d61730fd8ad` retained replay on `4082/4083`: real OWNER login, Audit UI `3`, stats `3/3/3`, CSV/list `3/3`, roster and pending failed-delivery invitation cold-open passed. Runtime stopped with DB preserved. | Piotr owner review; replay invite/role/revoke after the active rebuild stabilizes, and keep role-policy, backup, responsive/a11y and mobile gates open. |
| 15 | Settings | `READY_RETAINED_BROWSER_PROVEN` | `consultify_w3_settings_owner_final_20260822` | `/private/tmp/consultify-w3-settings-owner-final-v3-20260822.json` | `W3-SETTINGS-OWNER-v1` / `afd91ce5a92665731beae6afb1a3c2994368d47f233abfbec42b2fc94be6868d` / `consultify_w3_settings_owner_final_20260822` | `817` | Exact `3d61730fd8ad` runtime on `4102/4103`: real OWNER cold-reopened weekly digest, complete regional state, pending export and latest cancelled deletion from the canonical retained v3 fixture. | Preserve Piotr's UI-direction acceptance; complete the owner matrix and keep OAuth/MFA/destructive deletion, responsive/a11y and mobile gates open. |
| 16 | Partner | `READY_RETAINED_BROWSER_PROVEN` | `consultify_w3_partner_owner_browser_20260822` | `/private/tmp/consultify-wave3-partner-owner-browser-20260822.json` | `W3-PARTNER-OWNER-v1` / `f5cffb2fe89b9080efda039a208ecaec677f194b7a86aa78c110757351c0b8c2` / `consultify_w3_partner_owner_browser_20260822` | `817` | Exact `3d61730fd8ad` runtime on `4050/4051`: profile, certification `1/10`, referral `W3PARTNER`, participant ledger and economics-OFF boundary cold-opened; tenant negatives passed. | Piotr owner review and `/partner` journey/IA decision; economics, responsive/a11y and mobile gates remain open. |

## Inventory result

| Classification | Count | Modules |
|---|---:|---|
| `READY_RETAINED_BROWSER_PROVEN` | 16 | Organization, Interview, Tools, Assessment, Initiatives, Execution, My Work / Agent, Meetings, Results, Finance, Materials, Audits, Chat, Admin, Settings, Partner |
| `READY_RETAINED_REPLAY_REQUIRED` | 0 | — |
| `READY_RETAINED_BROWSER_PENDING` | 0 | — |

Storage readiness is therefore `16/16`: every module has one selected exact
database, one `0600` FINAL manifest, one matching public marker tuple and
exactly `817` successful schema migrations. Browser/owner readiness remains a
separate gate.

Catalog inspection found `18` matching databases. Two are deliberately not
selected as authoritative module fixtures:

- `consultify_w3_finance_owner_final_20260821_a` and
  `consultify_w3_finance_owner_final_20260821_b` are earlier retained Finance
  candidates; the `final_ui` database above is the current owner-review source.

No database, manifest, marker, migration row, product file, runtime or owner
status was mutated while producing this inventory.
