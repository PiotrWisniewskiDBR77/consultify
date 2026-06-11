# M12 — Audyty (Audit Orchestrator) — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `d85054eca6`) · **Audytor:** Claude + agenci (KOD/TESTY/KANON+SEC)
**Wejścia:** _MODULE_MAP_V2 wpis M12 (NOWY moduł, brak karty 06-02) · inwentarz `Harvard/podzial/inventory/INV_C_*.md` (sekcja AUDYTY, poz.1-8)
**Evidence:** `Harvard/modules/M12-audyty/evidence/` (f1_code_truth.md, f2_tests_report.md, f2_tests.log, f56_kanon_sec.md)

## OCENA: 47/100 — Tier: Alpha · status 🟦 NIEPEŁNY (Fazy 3+4 do wykonania)

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 21 | 8/8 REALNE — pełna pętla E2E (kreator→DB→fan-out do M10→rollup z DB) potwierdzona; minus: nieaktualny baner „MVP", martwy FE edycji, kliencki filtr. |
| B. Wiring i dane | 15 | 12 | Realna tabela `audit_programs`, realny fan-out przez kanoniczny `interviewAssignmentService`, rollup realnym SQL; bez fasady; minus: search/filter kliencki (gubi pozycje spoza strony). |
| C. Testy automatyczne | 15 | 2 | **ZERO testów** (FE/BE/E2E) — moduł nowy (06-06/07), powstał po sprincie i nie dostał ani jednego testu; nic w PR-gate. |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana. |
| E. Kanony/UI | 10 | 6 | `EntityStatusChip` z SSOT (dobry wzorzec), stany+walidacja kreatora OK; ale brak `ModuleHub` (własny layout), lista to karty `<ul>` nie §27, i18n inline `isPolish`. |
| F. Bezpieczeństwo/dostęp | 10 | 6 | Org-scope CZYSTY (7/7 handlerów), public showcase czysty; ale **P1 cross-org assignment injection** przez fan-out (brak walidacji org-membership assignee). |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana. |
| **Hard cap zastosowany?** | — | — | **Faza 4 niewykonana → max 70 + „NIEPEŁNY"; zero testów scenariuszy → max 70.** BRAK cap cross-org (org-scope czysty; P1 to injection przydziału do obcego usera, nie overwrite/read cudzych danych — poniżej progu hard-capu). Suma 47 < 70. |

**Werdykt jednym akapitem:** Moduł **funkcjonalnie kompletny end-to-end** — wbrew typowemu przeszacowaniu, inwentarzowe „(*) kodowo kompletne E2E" jest w większości PRAWDĄ: kreator 4-krokowy → POST → realna tabela `audit_programs` (config jako JSON-blob, restart-safe, **bez fasady `new Map()`**), fan-out „generuj ankiety" to **realny, idempotentny handoff do M10** (pętla kartezjańska template×assignee woła kanoniczny `interviewAssignmentService.create` `:416` → INSERT do `interview_assignments` + mirror-task MyWork + notyfikacje; guard `surveysGenerated` `:393`; `processRef:'audit_program:<id>'` linkuje wstecz), a completion rollup to **realne liczby z DB** (`SELECT status, COUNT(*) GROUP BY status`, uczciwy mianownik). Presety iso27001/new-company to deterministyczne, uczciwie opisane blueprinty (nie udające AI). **Org-scope czysty na wszystkich 7 handlerach** (org z `authContext`, każdy `:id` parowany `AND organization_id=?`), public showcase `/audits` to czysta statyka marketingowa bez API — M12 dołącza do kohorty czystej. **Dwa realne długi:** (1) **ZERO testów** — moduł produkujący cross-modułowe przydziały (fan-out do M10) nie ma ani jednego testu FE/BE/E2E, więc cała pętla jest niechroniona; (2) **P1 cross-org assignment injection** — `generateSurveys` (`auditProgramService.ts:409-425`) bierze `assigneeIds` z wolnego JSON-a `config` (zapisywanego PATCH-em bez walidacji), a `interviewAssignmentService.create` (`InterviewAssignmentService.ts:402-455`) INSERT-uje przydział + mirror-task + notyfikację dla DOWOLNEGO `userId` bez sprawdzenia przynależności do org (zweryfikowane osobiście) → `PATCH config.assigneeIds=[<user org B>]` + `generate-surveys` wstrzykuje przydział/zadanie/notyfikację obcemu userowi. UI tego nie wywoła (assignees z org-scoped `/users`), ale API nie wymusza; rekord powstaje pod org atakującego, więc to injection/annoyance/phishing, NIE odczyt/overwrite cudzych danych (stąd P1, nie hard-cap; fix w współdzielonym `interviewAssignmentService` — dotyczy też M10). Drobne: nieaktualny baner kreatora „nie zautomatyzowane w MVP" (fan-out DZIAŁA), martwy FE edycji programu (PATCH istnieje, żaden ekran nie woła), kliencki search/filter, brak `ModuleHub`. Sufit oceny: zero testów + niewykonane Fazy 3+4.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)
**Checklist:** INV_C sekcja AUDYTY, poz.1-8.
**Scenariusze krytyczne (7):**
1. **S1** — Lista programów + paginacja + filtr statusu.
2. **S2** — Kreator 4 kroki → create → trwałość.
3. **S3** — Presety iso27001/new-company + quick-launcher.
4. **S4** — Dashboard programu (liczniki, completion).
5. **S5** — Fan-out „generuj ankiety" (przydziały przez `interviewAssignmentService`).
6. **S6** — Completion rollup ({generated,total,done,percent,byStatus}).
7. **S7** — Edycja/usuwanie programu.
**Obowiązujące kanony:** §27 — częściowo (lista programów) · CARD_CONTENT_FORMULA: **N/D** · wzorzec: własny layout (NIE ModuleHub) · gating: **beta closed** (sidebar; URL omija).

## 1. Prawda kodu (FAZA 1)
> Raport: `evidence/f1_code_truth.md`. Werdykty: **REALNE 8 · drobne długi (baner MVP, martwy FE edycji, kliencki filtr).** Brak MOCK-STUB/fabrykacji.

### 1a. REALNE (zweryfikowane)
- Lista (paginacja serwerowa `LIMIT/OFFSET`+`COUNT` `auditProgramService.ts:218`), kreator 4 kroki (realny POST), presety (statyczne blueprinty 14 obszarów Annex A + 6 funkcjonalnych), dashboard (rollup z DB), **fan-out (realny handoff M10 `:416`, idempotentny)**, completion rollup (`COUNT GROUP BY status`), usuwanie, public showcase (statyka).

### 1b. MOCK / STUB
- Brak. Żaden element nie jest fabrykowany.

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE
- **[P3] Nieaktualny baner kreatora** — `AuditOrchestratorWizard.tsx:467-473` twierdzi „generowanie nie jest zautomatyzowane w MVP" — NIEAKTUALNE (fan-out działa).
- **[P3] Edycja programu = martwy FE** — PATCH żyje w serwisie/trasie/auditApi, ale żaden ekran go nie woła.
- **[P3] Search/filter kliencki** — `AuditsHub.tsx:154` (TODO serwerowy); gubi pozycje spoza załadowanej strony.

### 1d. UKRYTE / MARTWY KOD
- Brak istotnego (poza martwym FE edycji ↑).

### 1e. Wiring FE↔BE↔DB
| Funkcja | Endpoint/serwis | Tabela DB | Status |
|---|---|---|---|
| Lista/CRUD programów | `audit-programs.routes.ts` (7 handlerów) | audit_programs | DZIAŁA (org-scoped) |
| Fan-out ankiet | `generateSurveys`→`interviewAssignmentService.create` | interview_assignments | DZIAŁA (real handoff M10; **brak walidacji org assignee — P1**) |
| Completion rollup | `SELECT status, COUNT(*) GROUP BY` | interview_assignments | DZIAŁA (real) |

### 1f. Flagi
| Flaga | Default | Wpływ |
|---|---|---|
| `MODULE_AUDITS` | `closed` | sidebar lock (tylko nawigacja); URL omija |

### 1g. Połączenia międzymodułowe
| Kierunek | Moduł | Mechanizm | Status |
|---|---|---|---|
| WYJŚCIE → | M10 Wywiad | fan-out przydziałów (`interviewAssignmentService.create`) + szablony | DZIAŁA (real, idempotentny; **assignee bez walidacji org — P1**) |
| WYJŚCIE → | M03 My Work | mirror-task z przydziału | DZIAŁA (org atakującego — patrz P1) |

## 2. Testy automatyczne (FAZA 2)
> Raport: `evidence/f2_tests_report.md` · log: `f2_tests.log`.
**Uruchomienie (lokalnie @ `d85054eca6`):** **ZERO testów** (PASS 0 / FAIL 0 / SKIP 0). Nie fałszywa zieleń — **pustka**: 0 plików testowych w ścieżkach `include` vitesta (potwierdzone 2 grepami + `vitest run`→„No test files found"). Moduł nowy (06-06/07), nie dostał testów.
**Pokrycie scenariuszy:** S1-S7 wszystkie ❌ (FE/BE/E2E/PR-gate). Zero E2E.
**Pułapki (do uwzględnienia przy pisaniu testów):** S5 fan-out = REALNY serwis (testować integracyjnie, nie mockować granicy do `interviewAssignmentService`); S6 rollup = REALNY SQL (seeded test-db, nie mock).
**Backlog testowy:** [P0] T1 fan-out integracyjny (realny `interviewAssignmentService` + **test cross-org assignment**), T2 rollup integracyjny (realny SQL), T3 testy 7 endpointów + org-scoping/IDOR; [P1] T4 `auditPresets` unit, T5 wizard 4-krokowy, T6 hub lista+dashboard; [P2] T7 E2E S2→S5→S6, T8 CI-gate `Londyn`.

## 3. Środowiska / Railway (FAZA 3)
**Status: NIEWYKONANE (PENDING).** Smoke: create program, generate-surveys (fan-out → sprawdzić przydziały w M10), rollup. Migracja `audit_programs` zastosowana?. **Test bezpieczeństwa na żywo:** `PATCH config.assigneeIds=[obcy user]` → generate → czy przydział/task/notyfikacja celuje w obcego (P1). **Uwaga DB:** dev `.env` może wskazywać Railway PROD — ostrożność (fan-out tworzy realne przydziały+notyfikacje!).
| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit / migracje / flagi / smoke / logi | — | — | PENDING |

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)
**Status: NIEWYKONANE (PENDING).** 7 scenariuszy; szczególnie: S2 kreator→create→reload trwałość, S5 fan-out (czy przydziały realnie lądują w M10 inbox assignee), S6 rollup (czy liczby zgodne), **P1 cross-org assignment (read-only proof)**, baner MVP (czy myli usera).
| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1–S7 | — | PENDING | evidence/f4_* |

## 5. Kanony i standardy (FAZA 5)
> Raport: `evidence/f56_kanon_sec.md`.
**§27:** AuditsHub = lista kart (`<ul>/<li>`, `:343-462`) + boczny dashboard, NIE kanoniczna tabela §27 — formalnie N/D, ale **luka** (powinno być §27). Paginacja „Load more" działa, ale search/filter kliencki (P3 UX).
**Wzorzec hubowy:** **[P3]** brak wspólnego `ModuleHub` — własny self-contained layout (`:235-283`), niespójność.
**UI-standards:** `EntityStatusChip` z SSOT (dobry wzorzec, `:42,368`); 1 hardkod `accentColor="#3b82f6"` (Wizard:285, P3).
**i18n:** inline-bilingual `isPolish`+`tr(en,pl)` (jak M19/M21) — pełne PL+EN, bez braków/EN-only; dług spójności (nie błąd), wzorzec docelowy M15 = 0×.
**Stany:** empty/loading/error rozróżnione; kreator 4-krokowy z walidacją per-krok (`canProceed`/`maxReachableIndex`). OK.
**CARD_CONTENT_FORMULA:** N/D.

## 6. Bezpieczeństwo i dostęp (FAZA 6)
> Raport: `evidence/f56_kanon_sec.md`.
| Warstwa | Stan | Dowód |
|---|---|---|
| Org-scope 7/7 handlerów | CZYSTY | org z `authContext`; `WHERE id=? AND organization_id=?` per handler |
| Fan-out assignee | **DZIURAWE (brak walidacji org)** | `InterviewAssignmentService.ts:402-455` |
| Public showcase `/audits` | czyste | `@/data/auditShowcaseData` statyka, 0 fetch |

**Findingi:**
- **[P1] SEC-3 cross-org assignment injection** — `generateSurveys` (`auditProgramService.ts:409-425`) bierze `assigneeIds` z wolnego `config` (PATCH bez walidacji), `interviewAssignmentService.create` (`InterviewAssignmentService.ts:402-455`) INSERT-uje przydział (org atakującego) + mirror-task + notyfikację dla dowolnego `userId` **bez sprawdzenia org-membership**. `PATCH config.assigneeIds=[<user org B>]`+`generate-surveys` → injection przydziału/zadania/notyfikacji obcemu. **Zweryfikowane osobiście.** Injection/phishing, nie odczyt/overwrite cudzych danych → P1. Fix w współdzielonym serwisie (dotyczy też M10).
- **[P3] SEC-1 beta-lock tylko nawigacyjny** — `MODULE_AUDITS:'closed'` w sidebarze; `/audit-programs` (`AppRoutes.tsx:1198`) bez beta-guarda → direct URL omija (API org-scoped → tylko UX).

**OK/czyste:** org-scope 7/7 handlerów; public showcase bez wycieku; sekrety/PII w logach czyste (UUID-y + błędy).

## 7. PLAN DOKOŃCZENIA (FAZA 8)
### Fala 1 — Integralność (P1)
1. **`[INTEGRACJA — INTEGRACJE.md §C poz.7 / Sprint 1 / W1 security]`** Walidacja org-membership assignee w `interviewAssignmentService.create` (+ filtr `config.assigneeIds` w `generateSurveys`, `auditProgramService.ts:409`). Fix jest współdzielony z M10 — naprawić RAZ w serwisie bazowym — Weryfikacja: `assigneeIds=[obcy user]` → odrzucone; test cross-org assignment.
2. **Testy fundamentu** — fan-out integracyjny (realny serwis), rollup integracyjny (realny SQL), 7 endpointów + org-scoping (moduł ma 0 testów) — Weryfikacja: zielone, pokrywają pętlę E2E.

### Fala 2 — Domknięcie wartości (P2/P3)
1. **Wpiąć FE edycji programu** (PATCH istnieje, brak ekranu) lub usunąć martwą trasę — Weryfikacja: edycja działa albo znika.
2. **Search/filter serwerowy** (obecnie kliencki, gubi off-page) — Weryfikacja: filtr działa na pełnym zbiorze.
3. **Usunąć nieaktualny baner „MVP"** w kreatorze — Weryfikacja: brak mylącego komunikatu.

### Fala 3 — Jakość i kanony (P3)
1. **`ModuleHub`** zamiast własnego layoutu + §27 dla listy programów — Weryfikacja: spójność z wzorcem.
2. **i18n** — `t()` zamiast inline `isPolish` (wzorzec M15) + token koloru — Weryfikacja: spójny i18n.
3. **CI** — `Londyn` w PR-gate + module-contract test — Weryfikacja: biegnie na PR.

### Definition of Done (odhaczane przy realizacji)
- [ ] 1. Testy auto FE+BE scenariuszy krytycznych (zwł. fan-out + org-scoping + cross-org assignment) zielone w CI
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami
- [ ] 3. Railway: migracja `audit_programs` + smoke 200 + czyste logi
- [ ] 4. Kanony: ModuleHub, §27 listy, i18n
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE (baner MVP, martwy FE edycji)
- [ ] 6. Cross-org assignment zamknięty (walidacja org assignee)

---
**Pozostałe do domknięcia audytu M12:** Faza 3 (Railway) + Faza 4 (żywe 7 scenariuszy). Moduł funkcjonalnie kompletny (E2E potwierdzony), org-scope czysty. Dwa długi: **zero testów** (cała pętla niechroniona) + **P1 cross-org assignment injection** (współdzielony `interviewAssignmentService` — naprawić raz dla M10+M12). Po testach + naprawie P1 + Fazach 3/4 realnie Beta.
