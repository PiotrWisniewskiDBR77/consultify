# Consultify Complete MVP checkpoint

Generated: 2026-08-05 22:30 Europe/Warsaw
Contract baseline: current product contract and Complete MVP rules supplied by Piotr
Integration branch: `codex/consultify-mvp-integration-v2-20260805`
Integration SHA before checkpoint commit: `24ed0d81e7`
`origin/demo` and live demo runtime SHA at the gate: `3f58e5ce7e809d5d5044d2b69d8f941aceec5bc7`

## Program verdict

**Do not deploy this integration SHA yet.** Product packages compile and their targeted acceptance suites are predominantly green, but the normal production startup would fail closed before serving traffic: the read-only demo preflight found 70 checksum drifts in `tp_migration_history` and 12 runtime migrations pending. `DB_MANAGED_SCHEMA`, `DISABLE_TP_MIGRATIONS`, and `DB_READONLY` are unset on demo. The integrated readiness gate therefore makes this a real deployment blocker rather than a reporting-only issue.

No push to `demo`, no Railway deployment, and no demo DDL/DML was performed.

## Module status register

Only the approved Complete MVP statuses are used.

| Module | Name | Status | Acceptance summary | Primary remaining gap |
|---|---|---|---|---|
| M01 | Chat | MVP_DEMO_READY_WITH_BACKLOG | Tenant-safe chat history, branching, feedback, attachments, citations, voice and proposal handoff integrated; targeted and realDB suites passed in the module packet. | Required runtime migrations cannot be released while the platform ledger is blocked. |
| M02 | My Work / Ideas | MVP_DEMO_BLOCKED | Tasks, inbox, decisions, manager snapshot, notebook compatibility and Ideas collaboration fixes integrated with extensive realDB evidence. | This packet introduces the fail-closed migration gate; demo currently has 70 checksum drifts and 12 pending runtime migrations. |
| M03 | Interview | MVP_DEMO_READY_WITH_BACKLOG | Interview capture, answer source of truth, insight quality, quote handling and downstream handoff integrated; 126 targeted plus 10 realDB tests passed. | Remaining visual/i18n and rare template edge cases are Round 2. |
| M04 | Notebook | MVP_DEMO_FIX_REQUIRED | Existing notebook code remains in the integration tree and M02 compatibility tests cover selected persistence conflicts. | No current-cycle full Complete MVP matrix, visual pack and dedicated realDB golden-flow evidence. |
| M05 | Initiatives | MVP_DEMO_READY_WITH_BACKLOG | Candidate acceptance, durable receipt reconciliation and positive/negative realPG flows integrated; 11 component plus 14 realPG checks passed. | Platform migration release and broader Round 2 visual polish. |
| M06 | Execution | MVP_DEMO_READY_WITH_BACKLOG | Execution hub, rollout, intelligence and what-if visual acceptance fixes integrated; 22 focused UI checks passed. | Rare edges, ideal mobile and deeper performance remain Round 2. |
| M07 | Results | MVP_DEMO_READY_WITH_BACKLOG | Results navigation and golden persistence flows integrated; 8 UI plus 6 realDB checks passed. | Two historical tests remain classified as Round 2 debt. |
| M08 | Finance | MVP_DEMO_READY_WITH_BACKLOG | Finance reads fail closed, missing-table silent empty/fake success removed, locale repair integrated; 65 targeted plus 3 realDB checks passed. | Full production hardening and non-MVP edge cases remain Round 2. |
| M09 | Materials | MVP_DEMO_READY_WITH_BACKLOG | Presentation-template writes now prove persistence and route coverage is integrated; 7 realDB plus 12 routing checks passed. | Document Studio and workbook breadth need a dedicated Round 2 hardening pass; workbook is not claimed as fully accepted. |
| M10 | Assessment | MVP_DEMO_READY_WITH_BACKLOG | Accepted assessment freeze and schema self-heal integrated; 62 targeted plus 2 realDB checks passed. | Broader historical and visual debt remains Round 2. |
| M11 | Audits | MVP_DEMO_FIX_REQUIRED | Existing Audits implementation remains unchanged. | No current-cycle full Complete MVP evidence manifest or dedicated product delta was integrated. |
| M12 | Meetings | MVP_DEMO_READY_WITH_BACKLOG | Error truth, filtering and golden meeting persistence integrated; 48 realDB plus 40 targeted checks passed. | Round 2 visual and rare-edge hardening. |
| M13 | Organization | MVP_DEMO_READY_WITH_BACKLOG | Canonical admin handoff and organization persistence integrated without the stale-branch locale regression; 4 realPG plus 39 targeted checks passed. | Deeper role matrix and polish remain Round 2. |
| M14 | Settings | MVP_DEMO_READY_WITH_BACKLOG | Settings remain available; MFA is explicitly and honestly flagged off across canonical and legacy surfaces; failed persistence cannot return a secret/QR. Ten targeted controls passed. | Full versioned `user_mfa` schema and 2FA recovery are Round 2 P1. |
| M15 | Admin | MVP_DEMO_READY_WITH_BACKLOG | Billing thresholds and People load failures now fail closed without fake defaults or fake audit; 17 focused plus 38 broader Admin checks passed. | One module-specific realPG control is still missing. |
| M16 | Partner Portal | MVP_DEMO_READY_WITH_BACKLOG | Start is driven by persisted lifecycle state; resources, clients and paid totals no longer lie; 18 UI plus 13 isolated realPG controls passed. | Demo schema/data and visual canon gaps remain; see central backlog. |

## Contract function matrix

Classification vocabulary: `IMPLEMENTED`, `PARTIAL`, `MISSING`, `FLAGGED_OFF`, `NOT_CONNECTED`, `DUPLICATE_OR_LEGACY`, `OUT_OF_SCOPE`, `BLOCKED`.

| Module | Contract surface | Classification | Evidence / note |
|---|---|---|---|
| M01 | Conversation open, history, search, branch and fresh reopen | IMPLEMENTED | Conversation route and store targeted plus realDB suites. |
| M01 | Attachments, knowledge scope and ingestion status | IMPLEMENTED | Attachment status and tenant-scope migrations plus positive/negative tests. |
| M01 | Feedback, citations, trust and voice review | IMPLEMENTED | New component, service and realDB checks integrated. |
| M01 | Release of required schema | BLOCKED | Platform migration ledger P0. |
| M02 | Tasks and canonical inbox lifecycle | IMPLEMENTED | Idempotency and tenant-negative realDB checks. |
| M02 | Decisions and manager snapshot | IMPLEMENTED | Route, contract and realDB suites integrated. |
| M02 | Ideas canvas collaboration and persistence | IMPLEMENTED | Collaboration schema, CAS and materialization tests integrated. |
| M02 | Notebook legacy compatibility | DUPLICATE_OR_LEGACY | Compatibility is bounded but M04 remains the notebook owner. |
| M02 | Runtime migration readiness | BLOCKED | Demo preflight: 70 checksum drifts and 12 pending. |
| M03 | Interview create, answer, edit, save and reopen | IMPLEMENTED | Controller/service and realDB evidence. |
| M03 | Insight generation, quote fidelity and quality gate | IMPLEMENTED | 126 targeted plus realDB packet. |
| M03 | Candidate and initiative handoff | IMPLEMENTED | Canon and fail-closed handoff tests. |
| M03 | Long-tail template publication and visual polish | PARTIAL | Deferred to Round 2. |
| M04 | Notebook dashboard/list and page editor | PARTIAL | Existing implementation present; no complete current-cycle evidence. |
| M04 | Save, version, attachment and fresh reopen | PARTIAL | Selected compatibility coverage only. |
| M04 | Full permission/tenant negative matrix | MISSING | Dedicated packet required. |
| M05 | Initiative list/card and candidate acceptance | IMPLEMENTED | Component and realPG golden flows. |
| M05 | Durable acceptance receipt and replay safety | IMPLEMENTED | Reconciliation migration and realPG negative controls. |
| M05 | Advanced portfolio hardening | OUT_OF_SCOPE | Round 2. |
| M06 | Execution hub, rollout and main actions | IMPLEMENTED | Focused UI acceptance. |
| M06 | Intelligence and what-if workspace | IMPLEMENTED | Integrated visual behavior fixes. |
| M06 | Perfect mobile and load/performance | OUT_OF_SCOPE | Round 2. |
| M07 | Results dashboard and table navigation | IMPLEMENTED | UI and realDB golden flow evidence. |
| M07 | KPI/ROI/OKR persistence and reopen | IMPLEMENTED | RealDB acceptance packet. |
| M07 | Historical stale tests | DUPLICATE_OR_LEGACY | Recorded as Round 2 test debt. |
| M08 | Finance dashboard and statement reads | IMPLEMENTED | Missing-table behavior fails closed. |
| M08 | Create/upload/edit/save and readback | IMPLEMENTED | Targeted and isolated realDB checks. |
| M08 | Advanced forensic/load hardening | OUT_OF_SCOPE | Round 2. |
| M09 | Presentation list, template write and readback | IMPLEMENTED | 7 realDB and 12 routing checks. |
| M09 | Document Studio full end-to-end artifact lifecycle | PARTIAL | Important MVP surface but not fully evidenced in this cycle. |
| M09 | Workbook/Excel complete editor lifecycle | PARTIAL | Not claimed as accepted; may be descoped by product decision. |
| M09 | Legacy duplicate material routes | DUPLICATE_OR_LEGACY | Round 2 convergence. |
| M10 | Assessment list, session editor and accepted freeze | IMPLEMENTED | 62 targeted plus realDB freeze checks. |
| M10 | Schema recovery and negative write controls | IMPLEMENTED | Accepted-list schema self-heal evidence. |
| M10 | Rare methodology edges | OUT_OF_SCOPE | Round 2. |
| M11 | Audit dashboard/list | PARTIAL | Existing surface present without current acceptance packet. |
| M11 | Audit create/save/reopen and tenant controls | MISSING | Complete MVP evidence missing. |
| M11 | Full audit trail visual states | MISSING | Dedicated packet required. |
| M12 | Meeting list, create/edit/save and reopen | IMPLEMENTED | 48 realDB plus 40 targeted. |
| M12 | Main action, error and tenant-negative flows | IMPLEMENTED | Golden-flow packet. |
| M12 | Rare calendar/provider edges | OUT_OF_SCOPE | Round 2. |
| M13 | Organization profile load/edit/save/reopen | IMPLEMENTED | 4 realPG plus 39 targeted. |
| M13 | Canonical role-gated Admin handoff | IMPLEMENTED | Organization route and handoff tests. |
| M13 | Deep role matrix | PARTIAL | Round 2. |
| M14 | General settings, notifications and profile | IMPLEMENTED | Current targeted settings suite. |
| M14 | MFA setup, backup codes and recovery | FLAGGED_OFF | Explicit MVP decision; honest UI and server failure behavior. |
| M14 | Legacy security module | DUPLICATE_OR_LEGACY | MFA entry hidden while canonical settings remains owner. |
| M15 | Billing alert read/write/readback | IMPLEMENTED | Fail-closed route and UI tests. |
| M15 | People list loading and error state | IMPLEMENTED | Error cannot silently become empty. |
| M15 | Module-specific realPG negative control | MISSING | Central backlog M15-R2-001. |
| M16 | Lifecycle-driven Start and fresh reopen | IMPLEMENTED | 18 UI routing checks. |
| M16 | Resource capability and honest degraded state | IMPLEMENTED | 13 realPG checks; full demo schema remains degraded. |
| M16 | Client naming and cross-tenant isolation | IMPLEMENTED | No UUID/fabricated name; negative tenant control passes. |
| M16 | Earnings paid total and ledger divergence | IMPLEMENTED | Completed payout truth plus explicit divergence. |
| M16 | Canonical preview/kebab and route-family convergence | MISSING | Round 2 backlog. |
| M16 | Users subsection | NOT_CONNECTED | Endpoint absent; Round 2 backlog. |

## Integrated verification manifest

| Gate | Result |
|---|---|
| Root TypeScript `npm run type-check` | PASS |
| Backend production build `npm run build:backend` | PASS |
| Frontend production build `npm run build` | PASS |
| M16 lifecycle routing | PASS 18/18 |
| M16 isolated PostgreSQL truth and tenant controls | PASS 13/13 |
| Broader M16 package | 140/146 PASS; six failures reproduced identically on clean `origin/demo` and classified as historical debt |
| Strict fresh PostgreSQL migration | FAIL after 533 attempted files at `20260624_initiative_status_normalize.sql`; historical ordering debt |
| Demo manual-runner dry-run | READ-ONLY: 377 pending under `schema_migrations` discovery |
| Demo runtime-runner preflight | READ-ONLY: 70 checksum drifts, 12 pending, 170 unverifiable legacy checksums, 21 orphan rows |
| Live demo health before release | PASS; SHA `3f58e5ce7e809d5d5044d2b69d8f941aceec5bc7`, database and Redis connected |

## Evidence and honesty rules

- No module is marked ready because of a toast, a mocked empty list or an unverified screenshot.
- Missing evidence is an explicit gap, most visibly M04 and M11.
- Current-cycle visual evidence from module packets is retained as evidence; the integration operator did not fabricate a new all-module screenshot pack after discovering the platform P0.
- The central backlog uses the required 15-column schema and is the source of truth for Round 2.
- The user authorized a controlled demo deployment, but authorization does not override the fail-closed safety gate.

## Required sequence to unblock demo

1. Audit and reconcile the 70 exact checksum drifts without editing applied migration files or blindly rewriting history.
2. Make `schema_migrations` and `tp_migration_history` ownership converge, then rerun both read-only preflights.
3. Prove the 12 pending runtime migrations on an isolated clone or governed staging database.
4. Repair the strict fresh-schema ordering failure and rerun to completion.
5. Complete M04 and M11 acceptance evidence.
6. Re-run typecheck, both production builds, targeted realDB controls, then push the exact green SHA to `demo`.
7. Observe Railway readiness, health, runtime SHA and execute the integrated business transition test on demo.
