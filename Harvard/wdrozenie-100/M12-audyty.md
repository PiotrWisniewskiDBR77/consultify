# TECZKA M12 — Audyty (Audit Orchestrator) — pełna teczka reuse-first (pogłębiona do poziomu M13)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (karta audytu §1–§7 + kod) i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami grepem · weryfikacja staleności P1 assignment injection + baner MVP). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md). **M12 → BRAK uwag żywych** (`UWAGI_TESTY_2026-06-13.md` bez wpisu M12) → dziedziczy z karty; sesja żywa = warunek domknięcia R6.

## 00 · Nagłówek
- **Moduł:** M12 Audyty (Audit Orchestrator: program → obszary → fan-out ankiet do M10 → rollup) · **Pula:** beta · **Faza:** FAZA 3 (szlif beta)
- **Ocena audytu:** 55/100 · **Tier:** Alpha górny · **Rozmiar:** M (1–3 dni)
- **Żywy bloker:** brak — **P1 cross-org assignment injection NAPRAWIONY** (`7df4b22d6d`, zweryf. w git)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13 (pogłębiona)
- **Karta:** `Harvard/modules/M12-audyty/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md`
- **Kod:** `src/components/Audit/AuditsHub.tsx` · `…/AuditOrchestratorWizard.tsx` · `…/auditPresets.ts` · `…/auditApi.ts` · `server/src/routes/audit-programs.routes.ts` (7 handlerów) · `server/src/services/auditProgramService.ts` · `InterviewAssignmentService.ts` (współdzielony z M10) · tabela `audit_programs`

## MAPA POKRYCIA (co już jest vs co dokłada teczka)
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + §0 | job-to-be-done + zakres (niżej) |
| B UX docelowe | 🟢 | karta §5 (`ModuleHub`+§27 = luka) | stany + docelowy hub + §27 (niżej) |
| C Dane+API+reguły | 🟢 | karta §1e/§1f + `auditProgramService.ts` | **endpointy + serwis + fan-out idempotentny + org-walidacja** (niżej) |
| D AI/Teresa | 🟢 | karta §1a (presety = blueprinty, nie LLM) | granica AI (niżej) |
| E Integracje | 🟢 | karta §1g | fan-out M10 (współdzielony serwis) + mirror M03 (niżej) |
| F Epiki | 🟢 | karta §7 | epiki→stories Gherkin→L-xx (niżej) |
| G DoD/jakość | 🟢 (dołożone) | karta §0/§2 (17 testów BE) | **liczby grepem 2026-06-13** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji + R3 (`7df4b22d6d`)** (niżej) |

---

## A · INTENCJA *(z karty + kodu)*
- **Job-to-be-done:** zorganizować audyt (np. ISO 27001) jako **program** — od kreatora obszarów, przez **fan-out ankiet** do respondentów (M10), po **completion rollup** z DB.
- **Persony/role:** **konsultant/admin** (twórca programu, uruchamia fan-out), respondent (przez przydział w M10). Org-scope 7/7 czysty.
- **Zakres v1:** kreator 4-krokowy → `audit_programs` · presety **iso27001** (14 obszarów Annex A) / **new-company** (6 funkcjonalnych) · **fan-out idempotentny** do M10 (guard `surveysGenerated`) · completion rollup realnym SQL (`COUNT GROUP BY status`). **POZA v1:** automatyczne scoringi compliance, eksport raportów audytowych, edycja programu przez UI (PATCH istnieje, martwy FE — D-01).
- **Metryka wartości:** % programów z domkniętym fan-out→rollup; zgodność liczników rollup z DB (`{generated,total,done,percent,byStatus}`).

## B · UI/UX — STAN DOCELOWY *(karta §5 + delty)*
- **Layout obecny:** self-contained layout (`AuditsHub.tsx:235-283`) — lista programów jako karty `<ul>/<li>` (`:343-462`) + boczny dashboard; kreator 4-krokowy z walidacją per-krok (`canProceed`/`maxReachableIndex`). **Docelowo:** `ModuleHub` + `FilterableTable` (§27, L-05/L-06).
- **Stany ekranu:** empty/loading/error rozróżnione (poprawny wzorzec); pełny; **brak-uprawnień** — beta-lock nawigacyjny (route bez guarda omija, L-04).
- **Delty docelowe:**
  - Lista karty `<ul>/<li>` → `ModuleHub`+`FilterableTable` (§27). Search/filter **kliencki** (`AuditsHub.tsx:154`, TODO serwerowy) → serwerowy na pełnym zbiorze (L-02).
  - **Nieaktualny baner kreatora** „generowanie nie jest zautomatyzowane w MVP" (`AuditOrchestratorWizard.tsx:467-473`) — **fan-out DZIAŁA** → usunąć (L-03, **R3: re-audit twierdzi tekst poprawiony; zweryfikować runtime przed zamknięciem**).
- **Zgodność z systemem:** `EntityStatusChip` z SSOT (dobry wzorzec, `:42,368`); 1 hardkod `accentColor="#3b82f6"` (`Wizard:285`) → token (L-08).

## C · DANE + API + REGUŁY *(link + endpointy + fan-out)*

### C0 · Endpointy (`audit-programs.routes.ts`, 7 handlerów, mount `/api/...`; `AuthRequest` + org-scope)
- `GET /programs` (`:61`) — lista (paginacja serwerowa `LIMIT/OFFSET`+`COUNT`, `auditProgramService.listPrograms:218`).
- `POST /programs` (`:78`) — create (`createProgram:255`).
- `GET /programs/:id` (`:106`) — szczegóły (`getProgram:245`).
- `PATCH /programs/:id` (`:122`) — edycja (`updateProgram:292`) — **żaden ekran FE go nie woła** (L-01 martwy FE).
- `POST /programs/:id/generate-surveys` (`:155`) — fan-out (`generateSurveys:376`).
- `GET /programs/:id/completion` (`:172`) — rollup (`computeCompletion:505`).
- `DELETE /programs/:id` (`:188`) — usuwanie (`deleteProgram:337`).

### C1 · Model danych + serwis (`auditProgramService.ts`)
- Tabela `audit_programs` **realna** (bez fasady); `ensureSchema()` (`:124`). Wszystkie funkcje serwisu przyjmują `organizationId` jako 1. arg (`listPrograms`/`getProgram`/`createProgram`/`updateProgram`/`deleteProgram`) → **org-scope czysty 7/7 handlerów** (`WHERE id=? AND organization_id=?`).
- Pułapki PG: bigint=string, jsonb=object (`config` z `assigneeIds`/obszary) — `pgFlags.ts`.

### C2 · Reguły biznesowe (fan-out + rollup + org-walidacja)
- **Fan-out idempotentny:** `generateSurveys` (`:376`) → `interviewAssignmentService.create` (**współdzielony z M10**); guard `surveysGenerated` zapobiega podwójnemu fan-out; błąd pary logowany (`:440`).
- **Completion rollup:** `computeCompletion` (`:505`) — realny SQL `COUNT GROUP BY status` → `{generated,total,done,percent,byStatus}`.
- **Org-walidacja assignee (P1, NAPRAWIONA):** `generateSurveys` bierze `assigneeIds` z `config` (PATCH bez walidacji w przeszłości) → `interviewAssignmentService.create` waliduje przez `organization_members` (`auditProgramService.ts:388-401`, `7df4b22d6d`) → assignee spoza org **odrzucony**. Fix współdzielony — chroni M10+M12 raz.

## D · AI / TERESA *(granica)*
- **Granica:** presety iso27001/new-company to **uczciwe blueprinty** (statyczne, 14 obszarów Annex A / 6 funkcjonalnych) — **NIE LLM-generacja**. Fan-out tworzy realne przydziały ankiet, nie treść AI. **Generacja treści ankiet/wniosków należy do M10** (inference). Teresa nie ma roli w M12 (świadomie — orkiestrator, nie generator).

## E · INTEGRACJE — mapa połączeń *(karta §1g)*
- **Wyjścia →** **M10 Wywiad** (fan-out przydziałów przez `interviewAssignmentService.create` — **współdzielony serwis; org-walidacja assignee naprawiona raz dla M10+M12, `7df4b22d6d`**), M03 My Work (mirror-task z przydziału, org-scoped).
- **Wspólna warstwa:** `interviewAssignmentService` = kręgosłup fan-out wspólny z M10 → **koordynacja napraw obowiązkowa** (zmiana w serwisie dotyka obu modułów).
- **Zależności blokujące:** brak — moduł funkcjonalnie kompletny end-to-end.

## F · EPIKI → STORIES → ZADANIA *(z karty §7, forma epików)*

- **EPIK 1 — Front↔back domknięcie:**
  - *Story 1.1:* jako konsultant chcę edytować program (lub nie widzieć martwej akcji).
    - *Gherkin:* dane program istnieje · gdy konsultant klika Edytuj · wtedy edycja działa (PATCH) ALBO akcja nie istnieje (D-01).
    - *Zadania:* [Z-01 → L-01] wpiąć FE edycji (PATCH istnieje) lub usunąć martwą trasę; [Z-02 → L-02] search/filter serwerowy; [Z-03 → L-03] usunąć baner MVP (po weryfikacji runtime).
- **EPIK 2 — Bezpieczeństwo:**
  - *Story 2.1:* jako system blokuję direct-URL do beta-modułu.
    - *Gherkin:* dane `MODULE_AUDITS:'closed'` · gdy non-admin wchodzi `/audit-programs` przez URL · wtedy beta-guard blokuje (dziś tylko sidebar).
    - *Zadania:* [Z-04 → L-04] beta-guard na route `AppRoutes.tsx:1198`.
- **EPIK 3 — Kanony:**
  - *Zadania:* [Z-05 → L-05] `ModuleHub` zamiast self-contained; [Z-06 → L-06] §27 `FilterableTable` dla listy.
- **EPIK 4 — Szlif:**
  - *Zadania:* [Z-07 → L-07] i18n `isPolish`/`tr(en,pl)`→`t()` (wzorzec M15); [Z-08 → L-08] token zamiast `accentColor="#3b82f6"`.
- **EPIK 5 — Testy FE/E2E:**
  - *Story 5.1:* jako CI chronię pętlę kreator→fan-out→rollup.
    - *Gherkin:* dane program z assignee · gdy fan-out · wtedy przydziały w M10 inbox + rollup zgodny z DB.
    - *Zadania:* [Z-09 → L-09] T5 wizard 4-krok, T6 hub lista+dashboard, T7 E2E S2→S5→S6 na `Londyn` (BE 17 testów PASS już są).

## G · JAKOŚĆ / DoD *(skwantyfikowane — grep 2026-06-13, R4)*
| # | Kryterium | Miara M12 |
|---|-----------|-----------|
| 1 | Front↔back | edycja programu działa lub trasa usunięta; search serwerowy; pętla kreator→DB→fan-out M10→rollup trwała po reload; 0 martwych CTA |
| 2 | Bezpieczeństwo | cross-org assignment zamknięty (`7df4b22d6d`, z testem SEC-3); org-scope 7/7 (już); beta-guard na route |
| 3 | i18n | **~96** `isPolish`/`tr(en,pl)` (grep 2026-06-13: `AuditOrchestratorWizard.tsx` 45 + `AuditsHub.tsx` 48 + `auditPresets.ts` 3) → `t()` (wzorzec M15=0×). **Korekta R4: karta zaniżała „19" — `tr(en,pl)` to wzorzec inline-bilingual, pełne PL+EN bez braków (dług spójności, nie błąd, DP-10/wzorzec M15)** |
| 4 | Tokeny | **1** hex (`accentColor="#3b82f6"`, `Wizard:285`, grep) → token Visual Standard |
| 5 | §27 | **0** surowych `<table>` (lista = karty `<ul>/<li>`, `:343-462`, grep) → `FilterableTable` + `ModuleHub` |
| 6 | E2E w PR-gate | S2→S5→S6 + **17 testów BE PASS** zielone na `Londyn` |

**Telemetria sukcesu:** % programów z fan-out→rollup; zgodność liczników rollup z DB; cross-org assignment-rate (→0 po `7df4b22d6d`).
Scenariusze S1–S7: karta §0. Bezpieczeństwo: karta §6. **17 BE testów PASS** (`audit-programs.test.ts` — CRUD org-scope, fan-out, SEC-3 foreign-assignee filter, idempotency, rollup).

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | 8/8 realne; pętla E2E kompletna; długi: martwy FE edycji, search kliencki, baner MVP, brak ModuleHub/§27/i18n | L-01..L-09 |
| W-02 | **Uwagi żywe 2026-06-13** | 2026-06-13 | **BRAK wpisu M12 — dziedziczy z karty (R6 do domknięcia sesją żywą)** | — |
| W-03 | Commit `7df4b22d6d` (SEC-3) | 2026-06-12 | cross-org assignment injection + Bramka D tests | L-10 (naprawiona) |
| W-04 | 17 testów BE (`audit-programs.test.ts`) | 2026-06-12 | CRUD/fan-out/SEC-3/idempotency/rollup PASS | G/6 |
| W-05 | Kod (`audit-programs.routes.ts`, `auditProgramService.ts`) | 2026-06-13 | enumeracja 7 endpointów + metod serwisu + org-scope | weryfikacja |

### 02 · Stan obecny (prawda kodu) — karta §1. **Funkcjonalnie kompletny end-to-end** (kreator→DB→fan-out M10→rollup zweryfikowane). Org-scope 7/7. Fan-out realny idempotentny. Drobne długi: martwy FE edycji, search kliencki, brak `ModuleHub`+§27, i18n inline-bilingual.

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status | Zweryf. |
|----|------|---------|--------------------|-------|------|--------|---------|
| L-01 | edycja programu = martwy FE (PATCH bez ekranu) | W-01,W-05 | `audit-programs.routes.ts:122` (`updateProgram`) bez wołającego FE | P3 | 3 | otwarta (D-01) | 2026-06-13 |
| L-02 | search/filter kliencki (gubi spoza strony) | W-01 | `AuditsHub.tsx:154` (TODO serwerowy) | P3 | 3 | otwarta | — |
| L-03 | nieaktualny baner kreatora „MVP" | W-01 | `AuditOrchestratorWizard.tsx:467-473` | P3 | 3 | **NAPRAWIONA — grep 2026-06-17: zero „MVP"/„generowanie nie jest zautomatyzowane" w `AuditOrchestratorWizard.tsx`; komentarz :23 potwierdza realna architektura (nie nieukończone MVP)** | 2026-06-17 |
| L-04 | beta-lock tylko nawigacyjny (direct URL omija) | W-01 | `AppRoutes.tsx:1198` bez beta-guarda | P3 | 3 | **NAPRAWIONA — `<BetaGate moduleId="MODULE_AUDITS">` owija `/audit-programs` route (`AppRoutes.tsx:1191-1201`); zweryfikowane grepem** | 2026-06-17 |
| L-05 | brak `ModuleHub` (self-contained layout) | W-01 | `AuditsHub.tsx:235-283` | P3 | 3/4 | otwarta | 2026-06-13 |
| L-06 | lista = karty `<ul>/<li>`, nie §27 | W-01 | `AuditsHub.tsx:343-462` (0 `<table>`) | P3 | 3/4 | otwarta | 2026-06-13 |
| L-07 | i18n inline `isPolish`+`tr(en,pl)` | W-01,W-05 | Wizard 45 + Hub 48 + presets 3 = **~96** (grep) | P3 | 4 | otwarta (DP-10/M15) | 2026-06-13 |
| L-08 | hardkod `accentColor="#3b82f6"` | W-01 | `AuditOrchestratorWizard.tsx:285` (1× grep) | P3 | 4 | otwarta | 2026-06-13 |
| L-09 | brak FE/E2E (S1-S7) | W-01 | brak testów FE (17 BE PASS) | P2-test | — | **NAPRAWIONA — T5 `AuditOrchestratorWizard.4step.test.tsx` (8 testów: guard nazwy, 4-krok nawigacja, create/error/close/back) + T6 `AuditsHub.list-dashboard.test.tsx` (12 testów: loading/empty/lista/obiektyw/counts/error/wizard-CTA/ISO-CTA/close/delete/select/generate-badge) = 20/20 PASS** | 2026-06-17 |
| L-10 | cross-org assignment injection | W-01,W-03 | `auditProgramService.ts:388-401` | P1 | — | **NAPRAWIONA `7df4b22d6d` (R3: commit zweryf. w git; test SEC-3 w Bramce D)** | 2026-06-13 |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | Edycja programu: wpiąć FE czy usunąć martwą trasę? | wpiąć FE / usuń trasę | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTE → DP-5: ukryj stub za flagą + label** (martwy FE edycji — nie półbuduj) |
| D-02 | §27/`ModuleHub` dla listy: teraz czy sweep FAZA 4? | teraz / FAZA 4 | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTE → DP-9: §27 do sweepu Faza 4** (nie per-moduł) |

### 05 · Flagi / rollout / beta-gating
`MODULE_AUDITS:'closed'` w sidebarze (beta-lock nawigacyjny; route bez guarda = L-04). API org-scoped (direct URL = tylko UX, dane chronione).

### 06 · Ryzyka i założenia
- Fan-out tworzy **REALNE przydziały + mirror-taski + notyfikacje** → ostrożność z migracją/smoke na PROD (dev `.env` może wskazywać PROD, `feedback_prod_caution`).
- **`interviewAssignmentService` współdzielony z M10 — koordynacja napraw** (zmiana w serwisie dotyka obu).
- Baner MVP (L-03) — R3: zweryfikować runtime, bo re-audit twierdzi poprawiony, a karta wciąż go listuje (`finding_gap_reports_overstate`).

### 07 · Log wdrożenia + re-ocena
- 2026-06-13: pogłębienie teczki; **R3: `7df4b22d6d` zweryfikowany w git log** (cross-org assignment injection naprawiony, Bramka D tests); enumeracja 7 endpointów + serwisu; DoD przeliczone grepem (**i18n ~96 — korekta zaniżenia karty „19"**; hex 1; table 0). 17 BE testów PASS.
- Audyt 2026-06-11: 55/100. Re-ocena po Fazie 3/4 + sesji żywej (R6).

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + 17 testów + commit + kod; brak uwag żywych = jawnie odnotowane) · R2 zero sierot (wejście→luka→DoD) · R3 statusy z dowodem (**L-10 `7df4b22d6d` zweryfikowany w git; L-03 baner do re-weryfikacji runtime**) · R4 DoD z liczbami (**isPolish ~96 — korekta zaniżenia karty**; hex 1; table 0) · R5 decyzje z właścicielem (**D-01 ROZSTRZYGNIĘTE → DP-5; D-02 → DP-9**) · A–E docelowy zlinkowany (+ endpointy/fan-out/org-walidacja) · F epiki↔stories Gherkin↔luki · G DoD+S+sec+17 testów · R6 sesja żywa = E2E S2→S5→S6 + smoke żywy (Faza 4). **Teczka kompletna do egzekucji.**
