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

## Wave 3 (2026-02-20) — IN PROGRESS

| Bundle / slice | Taski | Branch | Owner | Status | Uwagi |
|---|---|---|---|---|---|
| 02.1 (slice) | T007, T009 | bundle-02-my-work-slice-02-1 | Cursor A | in_progress | My Work: tasks + ideas |
| 06.1 (slice) | T025 | bundle-06-licensed-tools-rename | Cursor B | in_progress | Assessment → Licensed Tools rename |
| 28 | T096–T098 | bundle-28-partners-program | Codex | in_progress | Partners program toolkit + cert + outreach |

**Start:** main wypchnięty na origin. Prompty: `docs/plans/v2-delivery/PROMPTS_WAVE_3.md`

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
| 02 | T007-T012 (+T008 guardrails) | Cursor | planned | | |
| 03 | T013-T017 | Codex | parked | bundle-03-interview-survey | czeka na dowiezienie przez Codex |
| 04 | T018-T021 | Codex | planned | | |
| 05 | T019, T022-T024 | Codex | planned | | |
| 06 | T025-T027 | Cursor | planned | | |
| 07 | T028, T030, T031 | Cursor | planned | | |
| 08 | T032-T033 | Cursor | planned | | |
| 09 | T034-T038 | Codex | planned | | |
| 10 | T039-T042 | Cursor | planned | | |
| 11 | T043-T045 | Codex | planned | | |
| 12 | T046-T049 | Cursor | planned | | |
| 13 | T050-T051 | Codex | planned | | |
| 14 | T052-T053 | Codex | planned | | |
| 15 | T054 | Cursor | planned | | weekend/hard |
| 16 | T055-T057 | Codex | planned | | merytoryka |
| 17 | T058-T059 | Cursor | planned | | weekend/hard |
| 18 | T060-T061 | Cursor | planned | | weekend/hard |
| 19 | T062 | Codex | planned | | |
| 20 | T063-T067 | Codex | planned | | |
| 21 | T068-T069 | Codex | **merged** | bundle-21-onboarding-news | Wave 1 |
| 22 | T071-T073 (+T070 content) | Codex | planned | | T072 done in pilot |
| 23 | T086 + T008 | Cursor | planned | | |
| 24 | T087, T089, T090 | Codex | planned | | |
| 25 | T091-T092 | Cursor | **merged** | bundle-25-trial-upgrade | Wave 1 |
| 26 | T093 | Cursor | **merged** | bundle-26-legal-acceptance | Wave 1 |
| 27 | T094-T095 | Codex | planned | | content-heavy |
| 28 | T096-T098 | Codex | planned | | |
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
