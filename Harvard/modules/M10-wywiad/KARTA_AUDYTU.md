# M10 — Wywiad — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `34edbfb973`) · **Audytor:** Claude + agenci (KOD/TESTY/KANON+SEC)
**Wejścia:** _MODULE_MAP_V2 wpis M10 · inwentarz `Harvard/podzial/inventory/INV_C_wywiad_narzedzia_audyty.md` (sekcja WYWIAD, poz.1-15) · poprzednia karta `docs/audit/2026-06-02/MODULE_03` + program to-100% (2026-06-06)
**Evidence:** `Harvard/modules/M10-wywiad/evidence/` (f1_code_truth.md, f2_tests_report.md, f2_tests.log, f56_kanon_sec.md)

## OCENA: 50/100 — Tier: Alpha · status 🟦 NIEPEŁNY (Fazy 3+4 do wykonania)

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 23 | 13/15 REALNE, 0 mock, 0 zepsute; inference i konwersacyjny AI realne; 1 ukryte-celowo + 1 częściowe (redesign steppera). |
| B. Wiring i dane | 15 | 13 | Wszystkie przepływy wpięte FE↔BE↔DB z migracjami; drobne obawy schema-drift (`CREATE TABLE IF NOT EXISTS` w runtime eksportu). |
| C. Testy automatyczne | 15 | 8 | 293 PASS / 9 FAIL; martwy import wyłącza 26 testów S5 FE; S4 (konwersacyjny) bez unitów; zero w PR-gate. |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana. |
| E. Kanony/UI | 10 | 6 | §27 bez braków blokujących, ale korupcja „rose" (21×), brak `persistKey`, i18n inline; CARD_CONTENT_FORMULA = jakość treści (dane VTS), nie kod. |
| F. Bezpieczeństwo/dostęp | 10 | 3 | 2× P0 cross-org IDOR na wnioskach (read z PII transkryptów + hard delete), ale 23/25 endpointów scoped. |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana. |
| **Hard cap zastosowany?** | — | — | **TAK — cross-org leak + hard delete cudzej org → max 50 + P0.** Suma surowa 53 → przycięta do 50. |

**Werdykt jednym akapitem:** Wywiad to najbardziej dojrzały kodowo moduł audytu — 13/15 pozycji realnych, pełny cykl szablony→przydziały→sesje→wnioski→inicjatywy wpięty end-to-end, inference (pipeline LLM z zod-schema i persystencją) oraz wywiad konwersacyjny (parse transkryptu na odpowiedzi) realne, demo-data poprawnie bramkowane jawnym togglem (nie cichy fallback). Tier wyżej blokują dziś: **dwa zlokalizowane cross-org IDOR-y na encji wniosków** (`getInsight`/`deleteInsight` bez org — sąsiednie handlery scoped, więc luka przypadkowa z gotowym wzorcem fixu), rozpad testów FE wniosków (martwy import gasi 26 testów), brak pokrycia konwersacyjnego, oraz odstępstwa kanonu (korupcja „rose", brak persistKey). To moduł blisko Beta — po naprawie 2 zapytań SQL i testów realnie skoczy.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)
**Checklist:** INV_C sekcja WYWIAD, poz.1-15. Narzędzia=M11, Audyty=M12.
**Scenariusze krytyczne (6):**
1. **S1** — Szablon: create (TemplateBuilder) → pytania → publish draft→approved → trwałość.
2. **S2** — Przydział (AssignInterviewModal: szablon+użytkownicy+termin) → inbox assignee + mirror-task.
3. **S3** — Sesja: start → odpowiedzi (single_question/task_list) → submit → trwałość.
4. **S4** — Wywiad konwersacyjny AI: transkrypt → parse → draft answers → review.
5. **S5** — Wnioski: generacja (inference) → InsightViewer (evidence + material quality) → workflow statusów.
6. **S6** — Inicjatywa: `generate_from_evidence` → realna inicjatywa.
**Obowiązujące kanony:** §27 dla tabel **Sesje / Przydzielone / Szablony / Wnioski** · **CARD_CONTENT_FORMULA: TAK** (wnioski + inicjatywy) · wzorzec hubowy: `InterviewHub` · beta-gating: NIE (core, otwarty).

## 1. Prawda kodu (FAZA 1)
> Raport: `evidence/f1_code_truth.md`. Zbiorczo: **REALNE 13 · MOCK/STUB 0 · ZEPSUTE 0 · UKRYTE-celowo 1 · CZĘŚCIOWE 1.**

### 1a. REALNE
- Inbox/Sesje/Przydzielone/Szablony (CRUD+publish+clone+AI evaluate), Wnioski (generacja, regenerate, workflow, komentarze, eksport→Tools/Assessment), InsightViewer (2-panel, evidence, material quality), Inicjatywy (`generate_from_evidence`), InterviewWorkspace, tryby runtime (single/task_list/conversational), **inference** (`interviewInferenceService.executeInference`, LLM+zod+persyst do `interview_insights`), **konwersacyjny AI** (`ConversationalPanel` + `aiParseSessionAnswers` `InterviewController.ts:5982`).

### 1b. MOCK / STUB
- Brak. **Demo-data NIE jest mockiem** — strictly za jawnym togglem (`api.ts:623`, brak backdoora localhost/email); błędy ładowania → jawne banery (poprawny wzorzec).

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE
- Brak funkcjonalnych. (Cross-org IDOR — patrz Faza 6.)

### 1d. UKRYTE / MARTWY KOD
- **[UKRYTE-celowo]** poz.8 tab `pending_review` (`InterviewHub.tsx:2688`) — logika filtra w kodzie, gotowa do przywrócenia → decyzja: udokumentować jako feature-gate lub usunąć.
- **[CZĘŚCIOWE]** poz.14 — flow 4-krokowy jako tab bar gated permissionami (`:2631`); dedykowanego wizualnego steppera 4-krok NIE ma (0 trafień Stepper/StepIndicator) — zgodne z inwentarzem (redesign 2026-06-06 niezbudowany).

### 1e. Wiring FE↔BE↔DB
| Funkcja | Endpoint/handler | Tabela DB | Migracja | Status |
|---|---|---|---|---|
| Szablony CRUD+publish | interview routes/controller | interview_templates | tak | DZIAŁA |
| Przydziały (+mirror-task) | `interviewAssignmentService.create` | interview_assignments, tasks | tak | DZIAŁA |
| Sesje lifecycle/submit | InterviewController | interview_sessions | tak | DZIAŁA |
| Inference (wnioski) | `interviewInferenceService.executeInference` | interview_insights, inference_runs | tak | DZIAŁA |
| Konwersacyjny AI parse | `aiParseSessionAnswers` (`:5982`) | transcripts, sessions | tak | DZIAŁA |
| Generacja inicjatyw | `generate_from_evidence` | initiatives | tak | DZIAŁA |
| getInsight / deleteInsight | `InterviewInsightService.ts:1618/1723` | interview_insights | tak | **bez org-scope (P0)** |

### 1f. Flagi
| Flaga | Default BE | Default FE | Kto włącza | Wpływ |
|---|---|---|---|---|
| (brak dedykowanych flag blokujących core M10) | — | — | — | moduł otwarty (core) |

### 1g. Połączenia międzymodułowe
| Kierunek | Moduł | Mechanizm | Plik:linia | Status |
|---|---|---|---|---|
| WYJŚCIE → | M11 Narzędzia/Assessment | eksport wniosków do Tools/Assessment | poz.5 | DZIAŁA |
| WYJŚCIE → | M13 Inicjatywy | `generate_from_evidence` → inicjatywa | poz.7 | DZIAŁA |
| WYJŚCIE → | M17 Outputs | eksport (assessment_report/deck/report) | poz.13 | DZIAŁA |
| WYJŚCIE → | M03 My Work | mirror-task przy przydziale | `interviewAssignmentService.create` | DZIAŁA |
| WEJŚCIE ← | M12 Audyty | fan-out ankiet przez kanoniczny `interviewAssignmentService.create` | INV_C M12 poz.5 | DZIAŁA |
| WEJŚCIE ← | M23 Organizacja | kontekst org zasila generację | poz.13 | DZIAŁA |

## 2. Testy automatyczne (FAZA 2)
> Raport: `evidence/f2_tests_report.md` · log: `f2_tests.log`.
**Uruchomienie (vitest, 35 plików M10, @ `34edbfb973`):** **293 PASS / 9 FAIL / 0 SKIP** (302 testy). E2E (3 pliki/31) skolekcjonowane, nie uruchomione (wymagają zbudowanej apki + `TEST_SUPPORT_KEY` + seed).
**9 FAIL (drift testów vs refaktor):**
- **[P0] `InsightPackView.p10-alignment.test.tsx`** — martwy import `@/components/Interview/InsightPackView` → cały plik nie ładuje się, **26 testów S5 wyłączonych**.
- FE: `InterviewHub` (`__private__` undefined), `interview-barrel-exports` (`ManageAssignmentModal`), `DiscoveryConsultantView` (stale i18n), `InsightViewer` (badge), `InsightCreatorModal` ×3.
- BE: `PATCH /api/v8/interview/insights/:id` 404 (MOCK_DB) ×2; report-pack nie utrwala `worksheets`.

**Pokrycie scenariuszy:**
| Scenariusz | FE | BE | E2E | CI (PR-gate) | Luka |
|---|---|---|---|---|---|
| S1 szablon publish | częśc. | ✓ | nightly | ✗ | trwałość gł. w E2E |
| S2 przydział→inbox | ✓ | ✓ | nightly | ✗ | OK |
| S3 sesja submit | częśc. | ✓ | weekly | ✗ | full flow w E2E |
| S4 konwersacyjny parse | ✗ | ✗ | — | ✗ | **brak unitów** transcript/inference |
| S5 wnioski/InsightViewer | **RED (26 off)** | ✓ | weekly | ✗ | FE w rozpadzie |
| S6 generate_from_evidence | częśc. | ✓ | nightly | ✗ | gł. E2E |

**Pułapka CI:** `test-suite.yml` triggeruje się tylko na push/PR do **main/develop**; joby „Deferred outside main/develop" → na `feat/deliverables-light` testy interview **nie biegną**. Żaden test M10 nie jest PR-blokujący; E2E interview tylko nightly/weekly.

**Backlog testowy:**
1. [P0] fix martwego importu `InsightPackView.p10-alignment.test.tsx` (26 testów S5).
2. [P0] unit dla S4 — `interviewTranscriptService` + `interviewInferenceService` (parse/inference/material_quality).
3. [P1] napraw 5 stale FE-testów (barrel, Hub `__private__`, i18n, InsightCreatorModal).
4. [P1] diagnoza PATCH-insights 404 (MOCK_DB) + utrwalanie `worksheets` report-packa.
5. [P2] ≥1 E2E interview do PR-gate (tier0).

## 3. Środowiska / Railway (FAZA 3)
**Status: NIEWYKONANE (PENDING).** Smoke: publish szablonu, create przydziału, submit sesji, inference, getInsight, generate_from_evidence; migracje (interview_templates/assignments/sessions/insights/inference_runs); logi 24-48h. Uwaga: defensywny `CREATE TABLE IF NOT EXISTS tool_sessions` w runtime eksportu → zweryfikować schema na prod.
| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit / migracje / flagi / smoke / logi | — | — | PENDING |

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)
**Status: NIEWYKONANE (PENDING).** 6 scenariuszy z reloadem; rola member (assignee) vs admin (manager); konsola/sieć; i18n. **Uwaga DB:** `.env`→Railway zdalna.
| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1–S6 | — | PENDING | evidence/f4_* |

## 5. Kanony i standardy (FAZA 5)
> Raport: `evidence/f56_kanon_sec.md`.
**§27 (Sesje/Przydzielone/Szablony/Wnioski):** A0 spełnione (preview/filtry/sort/resize/sticky). **Odstępstwa:**
- **[P1] korupcja „rose"** — status-chip hardkodowaną paletą `rose/amber` zamiast `EntityStatusChip`/`c.*` (21× `rose-*`, `InterviewHub.tsx:4772-4778`). To realny wzorzec korupcji (w odróżnieniu od M01/M03, gdzie `rose` był legalny).
- **[P1] §27.A brak `persistKey`** (0×) → kolumny/filtry nie persystują.
- **[P1] §27.R i18n inline** `{en,pl}`, ~7 `t()` na 13.6k linii.
- **[P2] RC-5** — 5× surowy `<table>`.
**CARD_CONTENT_FORMULA:** walidator `vts-card-audit-validator.cjs` na żywej prod → 25 kart VTS (10 wniosków + 15 inicjatyw), **0/25 PASS** progu ≥90 (dominują `content_sections`/`content_len` wniosków, `depends_on`/`raid_mix` inicjatyw). **To jakość TREŚCI (pokrywa się z `project_vts_card_audit`), nie defekt kodu M10.** Pozytyw: `material_quality_complete` PASS 10/10 na prod — kontrakt renderera §A6.2 dotrzymany.
**Wzorzec hubowy:** `InterviewHub` zgodny.

## 6. Bezpieczeństwo i dostęp (FAZA 6)
> Raport: `evidence/f56_kanon_sec.md`. **~25 endpointów sprawdzonych, 23 scoped, 2 bez scope.**
| Warstwa | Nawigacja | Route | API | Dziura? |
|---|---|---|---|---|
| Wywiad (core) | sidebar otwarty | zalogowany | per-permission (admin fallback OK) | — |
| Wnioski get/delete | — | — | bez org-scope | **TAK (P0)** |

**Findingi:**
- **[P0] SEC-1 cross-org IDOR read wniosku** — `getInsight` (`InterviewController.ts:7588`→`InterviewInsightService.ts:1618` `SELECT * FROM interview_insights WHERE id=?` bez org). Dowolny zalogowany odczyta wniosek cudzej org wraz z `evidence_map` (cytaty z transkryptów = PII cross-tenant). Zweryfikowane osobiście.
- **[P0] SEC-2 cross-org IDOR hard delete** — `deleteInsight` (`:7776`→`InterviewInsightService.ts:1723` `DELETE … WHERE id=?` bez org). Twardy delete wniosku cudzej org.
- **Dowód przypadkowości:** sąsiednie handlery encji (regenerate/activity/comments/update/export) mają `SELECT organization_id WHERE id=?` + 403 — luka zlokalizowana, wzorzec fixu pod ręką.
- Pozostałe 23 endpointy (szablony `canAccessTemplate`, przydziały approve/send-back/delete, sesje, enterprise) — scoped OK.

## 7. PLAN DOKOŃCZENIA (FAZA 8)
### Fala 1 — Integralność (P0)
1. **Org-scope na `getInsight`/`deleteInsight`** (`InterviewInsightService.ts:1618,1723`) — dodać `AND organization_id = ?` wg wzorca sąsiednich handlerów + 403 — Weryfikacja: test cross-org (org-A nie czyta/nie kasuje wniosku org-B → 403/404).
2. **Fix martwego importu testu S5** (`InsightPackView.p10-alignment.test.tsx`) — przywraca 26 testów — Weryfikacja: suite zielony, 26 testów aktywnych.

### Fala 2 — Domknięcie wartości (P1)
1. **Unit dla S4** — `interviewTranscriptService` + `interviewInferenceService` (parse transkryptu, inference, material_quality) — Weryfikacja: nowe unity zielone.
2. **Napraw 5 stale FE-testów** + diagnoza PATCH-insights 404 (MOCK_DB) + utrwalanie `worksheets` report-packa — Weryfikacja: 9 FAIL → 0.
3. **Decyzja o `pending_review`** (poz.8) — feature-gate udokumentowany lub usunięty — Weryfikacja: brak martwej-kompletnej logiki.

### Fala 3 — Jakość i kanony (P2)
1. **Korupcja „rose"** → `EntityStatusChip`/tokeny `c.*` (`InterviewHub.tsx:4772`) — Weryfikacja: 0× hardkodowany `rose-*` w status-chipach.
2. **`persistKey` na 4 tabelach** + i18n inline→`t()` — Weryfikacja: kolumny/filtry trwałe, klucze i18n.
3. **RC-5** — 5× surowy `<table>` → komponent kanoniczny — Weryfikacja: §27 RC-5 czyste.
4. **Redesign 4-krokowego steppera** (poz.14) — decyzja: zbudować wg 2026-06-06 lub świadomie odłożyć — Weryfikacja: stepper albo wpis backlogu.
5. (Treść kart VTS — należy do `project_vts_card_audit`, nie M10.)

### Definition of Done (odhaczane przy realizacji)
- [ ] 1. Testy auto FE+BE scenariuszy krytycznych zielone w CI
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami
- [ ] 3. Railway: migracje + flagi + smoke 200 + czyste logi
- [ ] 4. Kanony: checklisty Fazy 5 bez odstępstw P0/P1
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE
- [ ] 6. Zero cichych degradacji bez komunikatu

---
**Pozostałe do domknięcia audytu M10:** Faza 3 (Railway) + Faza 4 (żywe 6 scenariuszy, rola assignee vs manager). Ocena ≤50 dopóki P0 cross-org (get/delete wniosku) nienaprawione — po naprawie 2 zapytań + testów moduł realnie wchodzi w Beta.
