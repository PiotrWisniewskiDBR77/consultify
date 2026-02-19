# V2 Delivery — progress dashboard

Cel: żebyś zawsze widział **czy idziemy zgodnie z planem** i czy nie narasta bałagan.

## Status “na teraz” (baseline)
- **Specyfikacje T001–T122**: gotowe w `docs/plans/V2_TASK_SPECS.md`
  - commit: `e0281760f` (restore full spec file)
- **Manual QA checklist (T001–T122)**: gotowe w `docs/test-quality/V2_MANUAL_QA_CHECKLIST_122_TASKS.md`
- **Eksport do ChatGPT**: `docs/plans/chatgpt-export/` (md + txt)
- **Plan paczek + workflow**: `docs/plans/v2-delivery/*` (ten katalog)

## Pilot 3 paczek (2026-02-19)

| Pilot | Task | Branch | Status |
|-------|------|--------|--------|
| A | T002 Sidebar Collapse | bundle-pilot-a-sidebar-collapse | done |
| B | T001 Chat Title Fallback | bundle-pilot-b-chat-title | done |
| C | T072 Help Context | bundle-pilot-c-help-context | Codex packet ready |

**Następny krok:** merge pilot A i B do main (po manual QA + verify:quick). Pilot C przekazać Codex.

---

## Najważniejszy wskaźnik “czy jest syf”
**Jeśli `git status` pokazuje zmiany z 4+ paczek naraz → STOP i porządkujemy.**

## Reguły porządku (must)
- WIP = 3 (1 Codex + 2 Cursor).
- Każda paczka ma osobny branch.
- Main nie przyjmuje “pół‑paczki”.
- Jeśli paczka rośnie → tniemy na slice’y.

---

## Tabela paczek (30)
Statusy: `planned | in_progress | in_review | merged | blocked | parked`

| Bundle | Zakres (taski) | Owner (domyślny) | Status | Link do branch/PR | Notatki / ryzyka |
|---:|---|---|---|---|---|
| 01 | T001–T006 | Cursor | planned |  |  |
| 02 | T007–T012 (+T008 guardrails) | Cursor | planned |  |  |
| 03 | T013–T017 | Codex | planned |  |  |
| 04 | T018–T021 | Codex | planned |  |  |
| 05 | T019, T022–T024 | Codex | planned |  |  |
| 06 | T025–T027 | Cursor | planned |  |  |
| 07 | T028, T030, T031 | Cursor | planned |  |  |
| 08 | T032–T033 | Cursor | planned |  |  |
| 09 | T034–T038 | Codex | planned |  |  |
| 10 | T039–T042 | Cursor | planned |  |  |
| 11 | T043–T045 | Codex | planned |  |  |
| 12 | T046–T049 | Cursor | planned |  |  |
| 13 | T050–T051 | Codex | planned |  |  |
| 14 | T052–T053 | Codex | planned |  |  |
| 15 | T054 | Cursor | planned |  | weekend/hard |
| 16 | T055–T057 | Codex | planned |  | merytoryka |
| 17 | T058–T059 | Cursor | planned |  | weekend/hard |
| 18 | T060–T061 | Cursor | planned |  | weekend/hard |
| 19 | T062 | Codex | planned |  |  |
| 20 | T063–T067 | Codex | planned |  |  |
| 21 | T068–T069 | Codex | in_progress | bundle-21-onboarding-news | start: 2026-02-19 |
| 22 | T071–T073 (+T070 content) | Codex | planned |  |  |
| 23 | T086 + T008 | Cursor | planned |  |  |
| 24 | T087, T089, T090 | Codex | planned |  |  |
| 25 | T091–T092 | Cursor | in_progress | bundle-25-trial-upgrade | Started 2026-02-19 |
| 26 | T093 | Cursor | planned |  |  |
| 27 | T094–T095 | Codex | planned |  | content-heavy |
| 28 | T096–T098 | Codex | planned |  |  |
| 29 | T099–T105 + T101–T103 | Cursor | planned |  | weekend/hard |
| 30 | T106–T122 (slices) | Cursor | planned |  | program |

---

## Tygodniowy raport (template)
Wklejaj raz na tydzień (albo co 2–3 dni).

**Okres:** YYYY-MM-DD → YYYY-MM-DD  
**Gate status:** Ship-safe / Can charge / AI trust / World-class surface (krótko)  

- **Done (merged):**
  - bundle-XX … (1–5 punktów)
- **In progress:**
  - bundle-XX … (co blokuje, ETA)
- **Next up:**
  - bundle-XX … (dlaczego teraz)
- **Top risks (max 5):**
  - …
- **Decision log (zmiany w planie):**
  - …
