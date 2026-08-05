# Consultify Complete MVP checkpoint

Updated after controlled demo deployment: 2026-08-06 00:25 Europe/Warsaw
Contract baseline: current product contract and Complete MVP rules supplied by Piotr
Release repair branch: `codex/postdeploy-m09-m13-fix-20260805`
Previous deployed SHA: `9446a69724b7f8b058be1b12abc15f2982d4be2b`
Current `origin/demo` and live Railway runtime SHA: `dcf1678bb1508d8c61ecdf2de891003007e420dc`

## Program verdict

**DEPLOYED AND VERIFIED on demo.** Railway deployment `92d08799-bcfd-49dc-9f83-15f34afe8960` completed with `SUCCESS` for the exact SHA above. `/ping` and `/api/health` return 200; the health payload confirms PostgreSQL and Redis connected. Startup reports schema initialization successful, 402/402 platform migrations already applied and the governed runner 410/410 up to date. The post-deploy repair packet removes the reproduced M09 false-saving/canonical-count defect, the M13 authenticated 304/cache failure and the 390 px zero-width canvas defect without demo DDL/DML or demo-data mutation. M04 Tools and M11 Audits remain honestly `MVP_DEMO_FIX_REQUIRED`; current UI evidence is not a substitute for missing create/save/reopen/tenant golden flows.

No manual demo DDL/DML, cleanup or demo-data mutation was performed. The release was a fast-forward of `demo`, one Railway deployment and one bounded authenticated retest.

## Module status register

Only the approved Complete MVP statuses are used.

| Module | Name | Status | Acceptance summary | Primary remaining gap |
|---|---|---|---|---|
| M01 | Chat | MVP_DEMO_READY_WITH_BACKLOG | Tenant-safe chat history, branching, feedback, attachments, citations, voice and proposal handoff integrated; targeted and realDB suites passed in the module packet. | Required runtime migrations are proven on a current demo schema clone; remaining polish is Round 2. |
| M02 | My Work / Ideas | MVP_DEMO_READY_WITH_BACKLOG | Tasks, inbox, decisions, manager snapshot, notebook compatibility and Ideas collaboration fixes integrated with extensive realDB evidence. Exact historical checksum compatibility preserves fail-closed and all pending migrations pass atomically on the demo schema clone. | Legacy NULL checksums/orphan history and broader test debt remain Round 2 hygiene. |
| M03 | Interview | MVP_DEMO_READY_WITH_BACKLOG | Interview capture, answer source of truth, insight quality, quote handling and downstream handoff integrated; 126 targeted plus 10 realDB tests passed. | Remaining visual/i18n and rare template edge cases are Round 2. |
| M04 | Tools | MVP_DEMO_FIX_REQUIRED | Live demo proves the canonical Library table (36 tools), category/status states and Sessions table (25 sessions) render on the deployed SHA. No stale agent branch was cherry-picked. | No current-cycle create/edit/save/fresh-reopen, full tool workspace/wizard, error and tenant-negative evidence package. |
| M05 | Initiatives | MVP_DEMO_READY_WITH_BACKLOG | Candidate acceptance, durable receipt reconciliation and positive/negative realPG flows integrated; 11 component plus 14 realPG checks passed. | Broader Round 2 visual polish. |
| M06 | Execution | MVP_DEMO_READY_WITH_BACKLOG | Execution hub, rollout, intelligence and what-if visual acceptance fixes integrated; 22 focused UI checks passed. | Rare edges, ideal mobile and deeper performance remain Round 2. |
| M07 | Results | MVP_DEMO_READY_WITH_BACKLOG | Results navigation and golden persistence flows integrated; 8 UI plus 6 realDB checks passed. | Two historical tests remain classified as Round 2 debt. |
| M08 | Finance | MVP_DEMO_READY_WITH_BACKLOG | Finance reads fail closed, missing-table silent empty/fake success removed, locale repair integrated; 65 targeted plus 3 realDB checks passed. | Full production hardening and non-MVP edge cases remain Round 2. |
| M09 | Materials | MVP_DEMO_READY_WITH_BACKLOG | Post-deploy Chrome/realDB readback proves the affected deck is `Saved` after fresh open, renders 10 canonical slides in builder/list/preview, has no metadata word-count fiction and issues no autosave PUT on reload. The repair suite passed 42/42 with CAS negative controls. | Document Studio breadth and workbook/Excel scope still require a dedicated product decision and Round 2 acceptance packet. |
| M10 | Assessment | MVP_DEMO_READY_WITH_BACKLOG | Accepted assessment freeze and schema self-heal integrated; 62 targeted plus 2 realDB checks passed. | Broader historical and visual debt remains Round 2. |
| M11 | Audits | MVP_DEMO_FIX_REQUIRED | Live demo proves the Audit programs surface, ISO 27001/status filters, explicit empty state and New audit program entry render without a runtime error. No unproven branch was integrated and no demo record was created. | Create/save/fresh-reopen, populated preview/card, error and tenant-negative evidence remain missing. |
| M12 | Meetings | MVP_DEMO_READY_WITH_BACKLOG | Error truth, filtering and golden meeting persistence integrated; 48 realDB plus 40 targeted checks passed. | Round 2 visual and rare-edge hardening. |
| M13 | Organization | MVP_DEMO_READY_WITH_BACKLOG | Authenticated Chrome retest loads Organization Profile and the realDB context returns three tenant-valid organizations. Two successive current-context reads are served without any 304/fake failure; anonymous negative control remains 401. | Deeper role matrix and query-count/performance polish remain Round 2. |
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
| M01 | Release of required schema | IMPLEMENTED | Exact checksum compatibility plus demo-schema-clone atomic migration proof. |
| M02 | Tasks and canonical inbox lifecycle | IMPLEMENTED | Idempotency and tenant-negative realDB checks. |
| M02 | Decisions and manager snapshot | IMPLEMENTED | Route, contract and realDB suites integrated. |
| M02 | Ideas canvas collaboration and persistence | IMPLEMENTED | Collaboration schema, CAS and materialization tests integrated. |
| M02 | Notebook surfaces inside My Work | IMPLEMENTED | Notebook remains an M02/My Work surface; it is not the owner of M04 Tools. |
| M02 | Runtime migration readiness | IMPLEMENTED | Demo read-only preflight: zero unexplained drift; 13/13 pending apply on schema clone; post-preflight pending zero. |
| M03 | Interview create, answer, edit, save and reopen | IMPLEMENTED | Controller/service and realDB evidence. |
| M03 | Insight generation, quote fidelity and quality gate | IMPLEMENTED | 126 targeted plus realDB packet. |
| M03 | Candidate and initiative handoff | IMPLEMENTED | Canon and fail-closed handoff tests. |
| M03 | Long-tail template publication and visual polish | PARTIAL | Deferred to Round 2. |
| M04 | Tools Library and Sessions list | IMPLEMENTED | Live deployed SHA renders 36 classified tools and 25 persisted sessions with canonical tables and explicit active/in-development states. |
| M04 | Tool preview/full workspace/wizard and create/edit/save/fresh reopen | PARTIAL | Existing routes and records are visible, but the bounded baseline intentionally performed no demo mutation. |
| M04 | Error and permission/tenant negative matrix | MISSING | Dedicated Complete MVP packet required. |
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
| M09 | Presentation list, canonical deck readback and persistence truth | IMPLEMENTED | 42/42 repair tests plus deployed Chrome/realDB evidence: fresh open `Saved`, 10/10 slides, no reload write, CAS conflict negative control. |
| M09 | Document Studio full end-to-end artifact lifecycle | PARTIAL | Important MVP surface but not fully evidenced in this cycle. |
| M09 | Workbook/Excel complete editor lifecycle | PARTIAL | Not claimed as accepted; may be descoped by product decision. |
| M09 | Legacy duplicate material routes | DUPLICATE_OR_LEGACY | Round 2 convergence. |
| M10 | Assessment list, session editor and accepted freeze | IMPLEMENTED | 62 targeted plus realDB freeze checks. |
| M10 | Schema recovery and negative write controls | IMPLEMENTED | Accepted-list schema self-heal evidence. |
| M10 | Rare methodology edges | OUT_OF_SCOPE | Round 2. |
| M11 | Audit dashboard/list and explicit empty state | PARTIAL | Live deployed surface, filters and empty state verified visually; no populated record existed and none was created. |
| M11 | Audit create/save/reopen and tenant controls | MISSING | Complete MVP evidence missing. |
| M11 | Full audit trail visual states | MISSING | Dedicated packet required. |
| M12 | Meeting list, create/edit/save and reopen | IMPLEMENTED | 48 realDB plus 40 targeted. |
| M12 | Main action, error and tenant-negative flows | IMPLEMENTED | Golden-flow packet. |
| M12 | Rare calendar/provider edges | OUT_OF_SCOPE | Round 2. |
| M13 | Organization profile and authenticated tenant-context load | IMPLEMENTED | Existing 4 realPG plus 39 targeted evidence; deployed read returns three organizations without conditional-cache failure. |
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
| Consolidated post-deploy repair suite | PASS 42/42 across M09 persistence/count, M13 fail-closed context, metadata preview and mobile rails |
| Railway deployment | PASS `92d08799-bcfd-49dc-9f83-15f34afe8960`, exact SHA `dcf1678bb1508d8c61ecdf2de891003007e420dc` |
| Live health | PASS `/ping` 200; `/api/health` 200, PostgreSQL connected, Redis connected |
| Live migration startup | PASS schema initialization; 402/402 applied and governed 410/410 up to date |
| M09 deployed delta | PASS `Saved` after fresh open, 10 canonical slides in builder/list/preview, no false word count, no reload autosave PUT |
| M13 deployed delta and negative control | PASS authenticated realDB context (3 organizations), no post-deploy 304; anonymous request 401 |
| 390 px Deck Builder smoke | PASS rails/AI entry hidden, canvas 390 px, document scroll width 390 px |
| M04 baseline evidence only | PARTIAL: Library/Sessions present; full mutation/tenant packet still missing, status remains `MVP_DEMO_FIX_REQUIRED` |
| M11 baseline evidence only | PARTIAL: list/filter/empty state present; create/reopen/tenant packet still missing, status remains `MVP_DEMO_FIX_REQUIRED` |
| M16 lifecycle routing | PASS 18/18 |
| M16 isolated PostgreSQL truth and tenant controls | PASS 13/13 |
| Broader M16 package | 140/146 PASS; six failures reproduced identically on clean `origin/demo` and classified as historical debt |
| Strict fresh PostgreSQL migration | PASS 534/534 versioned migrations |
| Demo manual-runner inventory | READ-ONLY: 377 entries under legacy `schema_migrations` discovery; classified as non-runtime ledger debt, not replayed |
| Demo runtime-runner preflight | READ-ONLY PASS: 70 exact approved historical variants, zero unexplained drift; 13 pending proven atomically on schema clone; 170 unverifiable legacy checksums and 21 orphan rows retained as Round 2 hygiene |
| Current demo schema clone runtime apply | PASS: 13 applied atomically, 397 skipped, zero failures; post-preflight drift zero/pending zero |
| Targeted migration realDB suites | PASS: checksum/preflight 11/11, runner 15/15, startup readiness 10/10, including negative controls |
| Destructive migration scan | PASS: no `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` or `DELETE FROM` in the 13-file pending set |
| Previous live demo baseline | PASS; SHA `9446a69724b7f8b058be1b12abc15f2982d4be2b` before the bounded repair deployment |

## Evidence and honesty rules

- No module is marked ready because of a toast, a mocked empty list or an unverified screenshot.
- Missing evidence is an explicit gap, most visibly M04 and M11.
- Current-cycle visual evidence from module packets is retained as evidence; the integration operator did not fabricate a new all-module screenshot pack after discovering the platform P0.
- The central backlog uses the required 15-column schema and is the source of truth for Round 2.
- The user authorized a controlled demo deployment, but authorization does not override the fail-closed safety gate.

## Controlled demo release result and next stage

1. Completed: exact green repair SHA committed, branch pushed and `demo` fast-forwarded.
2. Completed: one Railway deployment observed through `SUCCESS`; health, runtime SHA and migration startup confirmed.
3. Completed: authenticated M09/M13 delta, 390 px smoke and anonymous tenant-negative control passed without demo mutation.
4. Next: keep M04/M11 Complete MVP evidence gaps explicit and execute the integrated business transition test; do not treat the deployed baseline screenshots as full acceptance.
