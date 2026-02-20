# V2 Delivery — progress dashboard

Cel: zebys zawsze widzial **czy idziemy zgodnie z planem** i czy nie narasta balagan.

## Status "na teraz" (baseline)
- **Specyfikacje T001-T122 (SSOT)**: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (+ `.txt`)
- **Manual QA checklist (T001-T122)**: gotowe w `docs/test-quality/V2_MANUAL_QA_CHECKLIST_122_TASKS.md`
- **Eksport do ChatGPT**: `docs/plans/chatgpt-export/` (md + txt)
- **Plan paczek + workflow**: `docs/plans/v2-delivery/*` (ten katalog)
- **Szablon promptow V2**: `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md`

## Pilot 3 paczek (2026-02-19)

| Pilot | Task | Branch | Status |
|-------|------|--------|--------|
| A | T002 Sidebar Collapse | bundle-pilot-a-sidebar-collapse | merged |
| B | T001 Chat Title Fallback | bundle-pilot-b-chat-title | merged |
| C | T072 Help Context | bundle-pilot-c-help-context | merged (Codex packet) |

## Wave 1 (2026-02-19/20) — CLOSED

| Bundle | Taski | Branch | Owner | Status | Uwagi |
|--------|-------|--------|-------|--------|-------|
| 21 | T068, T069 | bundle-21-onboarding-news | Codex | merged | migracje 551, 552 |
| 25 | T091, T092 | bundle-25-trial-upgrade | Cursor A | merged | trial arch + conversion path |
| 26 | T093 | bundle-26-legal-acceptance | Cursor B | merged | migracja 550, poprawiona na PG |

### Wave 1 — lekcje wyciagniete
- Agent B napisal migracje SQLite zamiast PostgreSQL -> poprawione, dodane do PROMPT_TEMPLATE_V2
- Agenty edytowaly progress.md -> konflikty -> zasada: agenty NIE edytuja progress.md
- Pre-existing test failures mylily agentow -> dodana instrukcja "ignoruj"
- Konflikty w translation.json -> instrukcja: klucze na koncu, prefix modulem
- Hardcoded plans w Bundle 25 -> zasada: dane z DB/config

## Wave 2 (2026-02-20) — CLOSED (Cursor scope)

| Bundle / slice | Taski | Branch | Owner | Status | Uwagi |
|---|---|---|---|---|---|
| 01 | T003–T006 (+ T001–T002 already) | bundle-01-chat-research | Cursor A | merged | migracja 553_cloud_data_sources |
| 30.5 (slice) | T110–T112 | bundle-30-5-oauth | Cursor B | merged | migracja 554_oauth_v2_enhancements; i18n + connected accounts |
| 03 | T013–T017 | bundle-03-interview-survey | Codex | parked | brak nowych commitów na branchu; wracamy gdy Codex dowiezie gotową paczkę |

### Wave 2 — domknięcie techniczne (deploy blockers)
- `npm run test:l4`: PASS
- `npm run test:l5`: PASS (quality-check 0 placeholder + audit-gate allowlist + security + performance)
- Decyzja audit gate (C / hybryda): allowlista zaktualizowana w `scripts/security/npm-audit-allowlist.json`

## Wave 3 (2026-02-20) — CLOSED

| Bundle / slice | Taski | Branch | Owner | Status | Uwagi |
|---|---|---|---|---|---|
| 02.1 (slice) | T007, T009 | bundle-02-my-work-slice-02-1-clean | Cursor A | **merged** | T007 personal tasks + T009 my ideas (migracja 20260220) |
| 06.1 (slice) | T025 | bundle-06-licensed-tools-t025 | Cursor | **merged** | Assessment → Licensed Tools (UI + i18n + /licensed-tools alias) |
| 28 | T096–T098 | codex/bundle-28-partners-program | Codex | **merged** | Migracje 555–557, Partner Portal, cleanup konflikt-markerów |

**Start:** main wypchnięty na origin. Prompty: `docs/plans/v2-delivery/PROMPTS_WAVE_3.md`

### Wave 3 — merge wykonane (2026-02-20)
- **Bundle 28** (Codex): merged do main. Migracje 555–557, Partner Portal.
- **Bundle 02** (Cursor A): merged z `bundle-02-my-work-slice-02-1-clean` (czysta gałąź, bez konflikt-markerów).
- **Bundle 06** (Cursor): merged z `bundle-06-licensed-tools-t025` — T025 rename (szef procesu dopiął).

## Wave 4 (2026-02-20) — CLOSED

| Bundle / slice | Taski | Branch | Owner | Status | Uwagi |
|---|---|---|---|---|---|
| 08 | T032–T033 | bundle-22-help-t071-t073 (incl.) | Cursor A | **merged** | Initiatives AI authoring + stage-gate (migracja 560) |
| 22 (slice) | T071, T073 | bundle-22-help-t071-t073 | Cursor B | **merged** | Help docs→AI context + micro-video (migracja 558) |
| 04 | T018–T021 | codex/bundle-04-tools-hub-v3 (stash) | Codex | **merged** | Tools hub + library + KB (migracja 559) |

**Prompty:** `docs/plans/v2-delivery/PROMPTS_WAVE_4.md`

### Wave 4 — merge wykonane (2026-02-20)
- **Bundle 22** (Cursor B): merged T071+T073 — helpDocsContext, micro-video modal, useModuleVideoHelp.
- **Bundle 08** (Cursor A): merged via bundle-22 — T032 AI authoring (AICardDraftModal, AIFieldEnhancer), T033 gate readiness (GateReadinessSection, AI readiness).
- **Bundle 04** (Codex): applied stashed WIP — KnownToolsService, Library tab, KnownToolDetailView, Help→Knowledge override.

## Wave 5 (2026-02-20) — CLOSED

| Bundle / slice | Taski | Branch | Owner | Status | Uwagi |
|---|---|---|---|---|---|
| 06.2 (slice) | T026–T027 | bundle-06-licensed-tools-t026-t027 | Cursor A | **merged** | SIRI/ADMA finalize + Report/deck templates |
| 10 (slice) | T039–T040 | bundle-10-execution-t039-t040 | Cursor B | **merged** | Timeline + Risk signaling (migracja 561) |
| 05 | T019, T022–T024 | bundle-05 (stash) | Codex | **merged** | Toolsets + Speed Tool (migracja 562) |

**Prompty:** `docs/plans/v2-delivery/PROMPTS_WAVE_5.md`

### Wave 5 — merge wykonane (2026-02-20)
- **Bundle 06** (Cursor A): merged T026 SIRI/ADMA finalize (evidence, level meanings, workflow parity) + T027 Report & Deck templates (PPTX export).
- **Bundle 10** (Cursor B): merged T039 Timeline (filters, warnings, drag-to-move, audit log) + T040 Risk signaling (RiskSignalsPanel, MitigationPanel, riskDetectionService).
- **Bundle 05** (Codex): applied stashed WIP — flow steps (Impact/Results/Reasoning/Prepare/Report/Initiatives), Speed Tool wizard, migracja 562.

## Wave 6 (2026-02-20) — CLOSED

| Bundle / slice | Taski | Branch | Owner | Status | Uwagi |
|---|---|---|---|---|---|
| 07 | T028, T030, T031 | bundle-07-licensed-tools-advanced | Cursor A | **merged** | Lean 4.0, PDF import, paid assessments (migracja 563) |
| 10.2 (slice) | T041–T042 | bundle-10-execution-t041-t042 | Cursor B | **merged** | Delay detection + Budget control (migracja 564) |
| 11 | T043–T045 | codex/bundle-11-execution-people-change-comms | Codex | in_progress | Branch zmergowany (tylko docs); kod T043–T045 — gdy Codex pushuje |

**Prompty:** `docs/plans/v2-delivery/PROMPTS_WAVE_6.md`

### Wave 6 — merge wykonane (2026-02-20)
- **Bundle 07** (Cursor A): merged T028 Lean 4.0, T030 PDF import, T031 Paid Assessments Integration.
- **Bundle 10** (Cursor B): merged T041 Delay Detection + T042 Budget Planning (migracja 564).

## Wave 6.5 (2026-02-20) — CLOSED

| Bundle / slice | Taski | Branch | Owner | Status | Uwagi |
|---|---|---|---|---|---|
| 12 | T046–T049 | bundle-12-benefits-kpi-finance | Cursor A | **merged** | Benefits/KPI/Finance mapping (migracja 565) |
| 23 | T086 + T008 | bundle-23-admin-sync-hub | Cursor B | **merged** | Admin Sync Hub + guardrails (migracja 566) |

**Prompty:** `docs/plans/v2-delivery/PROMPTS_WAVE_6_5.md`

### Wave 6.5 — merge wykonane (2026-02-20)
- **Bundle 12** (Cursor A): merged T046–T049 ROI, KPI mapping, attribution, financial mapping.
- **Bundle 23** (Cursor B): merged T086 Sync Hub + T008 guardrails (UnifiedSyncHub, syncGuardrailsService).

## Wave 7 (2026-02-20) — IN PROGRESS

| Bundle / slice | Taski | Branch | Owner | Status | Uwagi |
|---|---|---|---|---|---|
| 17 | T058–T059 | bundle-17-presentations-generator | Cursor A | in_progress | Presentations generator + templates |
| 18 | T060–T061 | bundle-18-reports-generator | Cursor B | in_progress | Reports generator + templates |
| 09 | T034–T038 | bundle-09-portfolio-optimization | Codex | in_progress | Portfolio optimization engines |

**Prompty:** `docs/plans/v2-delivery/PROMPTS_WAVE_7.md`

---

## Najwazniejszy wskaznik "czy jest syf"
**Jesli `git status` pokazuje zmiany z 4+ paczek naraz -> STOP i porzadkujemy.**

## Reguly porzadku (must)
- WIP = 3 (1 Codex + 2 Cursor).
- Kazda paczka ma osobny branch.
- Main nie przyjmuje "pol-paczki".
- Jesli paczka rosnie -> tniemy na slice'y.
- **progress.md edytuje TYLKO owner** (nie agenty) — lekcja z Wave 1.

---

## Tabela paczek (30)
Statusy: `planned | in_progress | in_review | merged | blocked | parked`

| Bundle | Zakres (taski) | Owner (domyslny) | Status | Branch | Uwagi |
|---:|---|---|---|---|---|
| 01 | T001-T006 | Cursor | **merged** | bundle-01-chat-research | T001,T002 done in pilot + T003-T006 merged (Wave 2) |
| 02 | T007-T012 (+T008 guardrails) | Cursor | **merged** | bundle-02-my-work-slice-02-1-clean | Wave 3: T007+T009 (slice 02.1) |
| 03 | T013-T017 | Codex | parked | bundle-03-interview-survey | czeka na dowiezienie przez Codex |
| 04 | T018-T021 | Codex | **merged** | codex/bundle-04-tools-hub-v3 | Wave 4: Tools hub + library (migracja 559) |
| 05 | T019, T022-T024 | Codex | **merged** | main | Wave 5: toolsets + Speed Tool (migracja 562) |
| 06 | T025-T027 | Cursor | **merged** | bundle-06-licensed-tools-t026-t027 | Wave 3: T025; Wave 5: T026-T027 merged |
| 07 | T028, T030, T031 | Cursor | **merged** | bundle-07-licensed-tools-advanced | Wave 6 (migracja 563) |
| 08 | T032-T033 | Cursor | **merged** | bundle-22-help-t071-t073 | Wave 4: AI authoring + gate readiness |
| 09 | T034-T038 | Codex | in_progress | bundle-09-portfolio-optimization | Wave 7 |
| 10 | T039-T042 | Cursor | **merged** | bundle-10-execution-t041-t042 | Wave 5: T039-T040; Wave 6: T041-T042 (migracja 564) |
| 11 | T043-T045 | Codex | in_progress | bundle-11-execution-people-change-comms | Wave 6 |
| 12 | T046-T049 | Cursor | **merged** | bundle-12-benefits-kpi-finance | Wave 6.5 (migracja 565) |
| 13 | T050-T051 | Codex | planned | | |
| 14 | T052-T053 | Codex | planned | | |
| 15 | T054 | Cursor | planned | | weekend/hard |
| 16 | T055-T057 | Codex | planned | | merytoryka |
| 17 | T058-T059 | Cursor | in_progress | bundle-17-presentations-generator | Wave 7 |
| 18 | T060-T061 | Cursor | in_progress | bundle-18-reports-generator | Wave 7 |
| 19 | T062 | Codex | planned | | |
| 20 | T063-T067 | Codex | planned | | |
| 21 | T068-T069 | Codex | **merged** | bundle-21-onboarding-news | Wave 1 |
| 22 | T071-T073 (+T070 content) | Cursor | **merged** | bundle-22-help-t071-t073 | Wave 4: T071+T073 (T072 done in pilot) |
| 23 | T086 + T008 | Cursor | **merged** | bundle-23-admin-sync-hub | Wave 6.5 (migracja 566) |
| 24 | T087, T089, T090 | Codex | planned | | |
| 25 | T091-T092 | Cursor | **merged** | bundle-25-trial-upgrade | Wave 1 |
| 26 | T093 | Cursor | **merged** | bundle-26-legal-acceptance | Wave 1 |
| 27 | T094-T095 | Codex | planned | | content-heavy |
| 28 | T096-T098 | Codex | **merged** | codex/bundle-28-partners-program | Wave 3 |
| 29 | T099-T105 + T101-T103 | Cursor | planned | | weekend/hard |
| 30 | T106-T122 (slices) | Cursor | planned | | 30.5 (OAuth) merged as slice |

---

## Tygodniowy raport #1 (2026-02-19 -> 2026-02-20)

- **Done (merged):**
  - Pilot A (T002), Pilot B (T001), Pilot C (T072 packet)
  - Bundle 21 (T068-T069) — onboarding + feature news
  - Bundle 25 (T091-T092) — trial architecture + conversion path
  - Bundle 26 (T093) — legal acceptance
- **In progress:** none
- **Next up:** Wave 3 (Cursor) + Bundle 28 (Codex)
- **Top risks:**
  - Bundle 25 hardcoded plans (free/pro/business/enterprise) — needs sync with DB
  - Pre-existing test baseline noise
- **Decision log:**
  - Dodano PROMPT_TEMPLATE_V2.md z lekcjami z Wave 1
  - Zasada: agenty NIE edytuja progress.md
  - Zasada: migracje w natywnym PostgreSQL
  - Audit gate: decyzja C (hybryda) + allowlista jako tymczasowa akceptacja ryzyka
