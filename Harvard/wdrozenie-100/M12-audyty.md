# TECZKA M12 — Audyty (Audit Orchestrator)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (karta audytu + kod) i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami · weryfikacja staleności P1 assignment injection). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · format: [`M13-inicjatywy.md`](M13-inicjatywy.md). **M12 → brak uwag żywych** (dziedziczy z karty).

## 00 · Nagłówek
- **Moduł:** M12 Audyty (Audit Orchestrator) · **Pula:** beta · **Faza:** FAZA 3 (szlif beta)
- **Ocena audytu:** 55/100 · **Tier:** Alpha górny · **Rozmiar:** M (1–3 dni)
- **Żywy bloker:** brak — **P1 cross-org assignment injection NAPRAWIONY** (`7df4b22d6d`)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-XX · teczka 2026-06-13
- **Karta:** `Harvard/modules/M12-audyty/KARTA_AUDYTU.md`
- **Kod:** `src/components/Audit/AuditsHub.tsx` · `…/AuditOrchestratorWizard.tsx` · `…/auditPresets.ts` · `server/src/services/auditProgramService.ts` · `interviewAssignmentService` · tabela `audit_programs`

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt | job-to-be-done + zakres |
| B UX docelowe | 🟢 | karta §5 (`ModuleHub`+§27 = luka) | docelowy hub + §27 |
| C Dane+API+reguły | 🟢 | karta §1e/§1f + `auditProgramService.ts` | skrót kontraktu + fan-out |
| D AI/Teresa | 🟢 | karta §1 (presety = blueprinty, nie LLM) | granica AI |
| E Integracje | 🟢 | karta §1g | fan-out M10 + mirror M03 |
| F Epiki | 🟢 | poprzedni WP §3 | przeformułowane |
| G DoD/jakość | 🟢 | karta §0/§2 (17 testów BE) | **liczby grep** |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji + R3 (`7df4b22d6d`)** |

---

## A · INTENCJA
- **Job-to-be-done:** zorganizować audyt (np. ISO 27001) jako program — od kreatora obszarów, przez fan-out ankiet do respondentów (M10), po rollup ukończenia.
- **Persony/role:** konsultant/admin (twórca programu), respondent (przez przydział w M10). Org-scope 7/7 czysty.
- **Zakres v1:** kreator 4-krokowy → `audit_programs` · presety iso27001 (14 obszarów Annex A) / new-company (6 funkcjonalnych) · fan-out idempotentny do M10 · completion rollup realnym SQL. **POZA v1:** automatyczne scoringi compliance, eksport raportów audytowych.
- **Metryka:** % programów z domkniętym fan-out→rollup; zgodność liczników rollup z DB.

## B · UX DOCELOWE
Stan obecny + odstępstwa: karta §5. Funkcjonalnie kompletny end-to-end.
- **Delta docelowa:** lista programów to obecnie karty `<ul>/<li>` (`AuditsHub.tsx:343-462`) w self-contained layoucie — docelowo `ModuleHub` + `FilterableTable` (§27, L-06/L-07). Search/filter kliencki (`AuditsHub.tsx:154`, TODO serwerowy) → serwerowy na pełnym zbiorze (L-02).
- **Stany:** pusty · ładowanie · błąd · pełny. Nieaktualny baner kreatora „generowanie nie jest zautomatyzowane w MVP" (`AuditOrchestratorWizard.tsx:467-473`) — fan-out DZIAŁA, usunąć jeśli wciąż obecny (L-03, R3).

## C · DANE + API + REGUŁY
- **Wiring/flagi:** karta §1e/§1f. Tabela `audit_programs` realna (bez fasady).
- **Org-scope czysty 7/7 handlerów** (`WHERE id=? AND organization_id=?`). **P1 cross-org assignment injection NAPRAWIONY** (`7df4b22d6d` — `auditProgramService.ts:388-401` waliduje `assigneeIds` przez `organization_members`).
- **Reguły:** fan-out idempotentny (`interviewAssignmentService.create`, guard `surveysGenerated`); rollup `COUNT GROUP BY status` → `{generated,total,done,percent,byStatus}`. PATCH edycji żyje w serwisie/trasie/`auditApi`, ale **żaden ekran go nie woła** (L-01 martwy FE).

## D · AI / TERESA
- **Granica:** presety iso27001/new-company to **uczciwe blueprinty** (nie LLM-generacja) — fan-out tworzy realne przydziały ankiet, nie treść AI. Generacja treści ankiet należy do M10.

## E · INTEGRACJE
Pełna tabela: karta §1g. **→** M10 Wywiad (fan-out przydziałów przez `interviewAssignmentService` — współdzielony; org-walidacja assignee naprawiona raz dla M10+M12 `7df4b22d6d`), M03 My Work (mirror-task, org-scoped).

## F · EPIKI *(z poprzedniego WP §3)*
- **EPIK 1 — Front↔back domknięcie:** wpiąć FE edycji programu (PATCH istnieje) lub usunąć martwą trasę (L-01); search/filter serwerowy (L-02); usunąć nieaktualny baner MVP (L-03).
- **EPIK 2 — Bezpieczeństwo:** beta-guard na route `/audit-programs` (nie tylko sidebar) (L-04).
- **EPIK 3 — Kanony:** `ModuleHub` zamiast self-contained layout (L-05) + §27 `FilterableTable` dla listy (L-06).
- **EPIK 4 — Szlif:** i18n `isPolish`→`t()` (L-07) + token zamiast `accentColor="#3b82f6"` (L-08).
- **EPIK 5 — Testy:** FE/E2E (T5 wizard 4-krok, T6 hub lista+dashboard, T7 E2E S2→S5→S6) (L-09).

## G · JAKOŚĆ / DoD *(skwantyfikowane — grep 2026-06-13)*
| # | Kryterium | Miara M12 |
|---|-----------|-----------|
| 1 | Front↔back | edycja programu działa lub trasa usunięta; search serwerowy; pętla kreator→DB→fan-out M10→rollup trwała po reload; 0 martwych CTA |
| 2 | Bezpieczeństwo | cross-org assignment zamknięty (`7df4b22d6d`, z testem); org-scope 7/7 (już); beta-guard na route |
| 3 | i18n | **19** `isPolish`/`tr(en,pl)` (`AuditOrchestratorWizard.tsx` 10 + `AuditsHub.tsx` 6 + `auditPresets.ts` 3) → `t()` (wzorzec M15 = 0×) |
| 4 | Tokeny | **1** hex (`accentColor="#3b82f6"`, `Wizard:285`) → token Visual Standard |
| 5 | §27 | **0** surowych `<table>` (lista = karty `<ul>/<li>`, `:343-462`) → `FilterableTable` + `ModuleHub` |
| 6 | E2E w PR-gate | S2→S5→S6 + 17 testów BE zielone na `Londyn` |

Scenariusze S1–S7: karta §0. Bezpieczeństwo: karta §6. **17 BE testów PASS** (`audit-programs.test.ts` — CRUD org-scope, fan-out, SEC-3 foreign-assignee filter, idempotency, rollup).

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | karta | wiring/sec/plan | L-01..L-09 |
| W-02 | **Uwagi żywe** | 2026-06-13 | **brak uwag żywych dla M12** (dziedziczy z karty) | — |
| W-03 | Commit `7df4b22d6d` (SEC-3) | — | cross-org assignment injection + Bramka D tests | L-10 (naprawiona) |
| W-04 | 17 testów BE (`audit-programs.test.ts`) | — | CRUD/fan-out/SEC-3/idempotency/rollup PASS | G/6 |

### 02 · Stan obecny (prawda kodu) — karta §1. Funkcjonalnie kompletny end-to-end. Org-scope 7/7. Fan-out realny idempotentny. Drobne długi: martwy FE edycji, search kliencki, brak `ModuleHub`+§27.

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status | Zweryf. |
|----|------|---------|--------------------|-------|------|--------|---------|
| L-01 | edycja programu = martwy FE (PATCH bez ekranu) | W-01 | serwis/trasa/`auditApi` bez wołającego | P3 | 3 | otwarta | — |
| L-02 | search/filter kliencki (gubi spoza strony) | W-01 | `AuditsHub.tsx:154` (TODO serwerowy) | P3 | 3 | otwarta | — |
| L-03 | nieaktualny baner kreatora „MVP" | W-01 | `AuditOrchestratorWizard.tsx:467-473` | P3 | 3 | **otwarta — R3: re-audit twierdzi tekst poprawiony; zweryfikować runtime** | — |
| L-04 | beta-lock tylko nawigacyjny (direct URL omija) | W-01 | `AppRoutes.tsx:1198` bez beta-guarda | P3 | 3 | otwarta | — |
| L-05 | brak `ModuleHub` (self-contained layout) | W-01 | `AuditsHub.tsx:235-283` | P3 | 3/4 | otwarta | — |
| L-06 | lista = karty `<ul>/<li>`, nie §27 | W-01 | `AuditsHub.tsx:343-462` | P3 | 3/4 | otwarta | 2026-06-13 |
| L-07 | i18n inline `isPolish`+`tr(en,pl)` | W-01 | Wizard 10 + Hub 6 + presets 3 = 19 | P3 | 4 | otwarta | 2026-06-13 |
| L-08 | hardkod `accentColor="#3b82f6"` | W-01 | `AuditOrchestratorWizard.tsx:285` | P3 | 4 | otwarta | 2026-06-13 |
| L-09 | brak FE/E2E (S1-S7) | W-01 | brak testów FE | P2-test | — | otwarta | — |
| L-10 | cross-org assignment injection | W-01,W-03 | `auditProgramService.ts:388-401` | P1 | — | **NAPRAWIONA `7df4b22d6d` (R3: commit zweryfikowany w historii git; test w Bramce D)** | 2026-06-13 |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | Edycja programu: wpiąć FE czy usunąć martwą trasę? | wpiąć FE / usuń trasę | Piotr | TBD | otwarta |
| D-02 | §27/`ModuleHub` dla listy programów teraz czy odłożyć do sweep FAZA 4? | teraz / FAZA 4 | Piotr | TBD | otwarta |

### 05 · Flagi/rollout — `MODULE_AUDITS:'closed'` w sidebarze (beta-lock nawigacyjny; route bez guarda = L-04). API org-scoped.
### 06 · Ryzyka — fan-out tworzy REALNE przydziały+notyfikacje → ostrożność z migracją/smoke na PROD (dev `.env` może wskazywać PROD). `interviewAssignmentService` współdzielony z M10 — koordynacja napraw.
### 07 · Log — 2026-06-13: teczka; **R3: `7df4b22d6d` zweryfikowany w git log** (cross-org assignment injection naprawiony, Bramka D tests). 17 BE testów PASS. Re-ocena po Fazie 3/4.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta+17 testów+commit; brak uwag żywych = jawnie odnotowane) · R2 zero sierot · R3 statusy z dowodem (**L-10 `7df4b22d6d` zweryfikowany w historii git; L-03 baner do re-weryfikacji runtime**) · R4 DoD z liczbami (isPolish 19, hex 1, table 0) · R5 decyzje z właścicielem · A–E docelowy zlinkowany · F epiki↔luki · G DoD+S+sec+17 testów · R6 sesja żywa = E2E S2→S5→S6 (Faza 4). **Teczka kompletna do egzekucji.**
