# WP M12 — Audyty (Audit Orchestrator) · dokończenie do 100%

**Pula:** beta · **Karta:** `Harvard/modules/M12-audyty/KARTA_AUDYTU.md` (ocena 55/100) · **Rozmiar:** M (1–3 dni) · **Żywy bloker:** brak (P1 cross-org assignment injection NAPRAWIONY `7df4b22d6d`)
**Faza programu:** FAZA 3 (szlif beta) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Moduł **funkcjonalnie kompletny end-to-end** — kreator 4-krokowy → POST → realna tabela `audit_programs`, fan-out to **realny idempotentny handoff do M10** (`interviewAssignmentService.create`, guard `surveysGenerated`), completion rollup realnym SQL (`COUNT GROUP BY status`), presety iso27001/new-company to uczciwe blueprinty (14 obszarów Annex A + 6 funkcjonalnych). Org-scope **czysty 7/7 handlerów** (`WHERE id=? AND organization_id=?`). **P1 cross-org assignment injection NAPRAWIONY** (`7df4b22d6d` — `auditProgramService.ts:388-401` waliduje `assigneeIds` przez `organization_members`). **17 BE testów PASS** (`audit-programs.test.ts` — CRUD org-scope, fan-out, SEC-3 foreign-assignee filter, idempotency, rollup). Sufit 55/100: Fazy 3+4 niewykonane + 3 drobne długi (martwy FE edycji, kliencki search/filter, brak `ModuleHub`+§27 dla listy).

## 2. Luki do DoD

### (a) FRONTEND / UX (FAZA 3)
- **[P3] edycja programu = martwy FE** — PATCH żyje w serwisie/trasie/`auditApi`, ale żaden ekran go nie woła. Fix: wpiąć FE edycji lub usunąć martwą trasę.
- **[P3] search/filter kliencki** — `AuditsHub.tsx:154` (TODO serwerowy); gubi pozycje spoza załadowanej strony. Fix: filtr serwerowy na pełnym zbiorze.
- **[P3] nieaktualny baner kreatora** — `AuditOrchestratorWizard.tsx:467-473` „generowanie nie jest zautomatyzowane w MVP” — NIEAKTUALNE (fan-out działa). (Karta re-audit: tekst już poprawiony — re-weryfikować runtime.) Fix: usunąć mylący komunikat jeśli wciąż obecny.

### (b) BACKEND / API (FAZA 3)
- Org-scope 7/7 czysty; P1 cross-org assignment injection już NAPRAWIONY (`7df4b22d6d`). Brak otwartych blokerów BE.
- **[P3] SEC-1 beta-lock tylko nawigacyjny** — `MODULE_AUDITS:'closed'` w sidebarze; `/audit-programs` (`AppRoutes.tsx:1198`) bez beta-guarda → direct URL omija (API org-scoped → tylko UX). Fix: beta-guard na route.

### (c) KANONY / UI (FAZA 3/4)
- **[P3] brak `ModuleHub`** — `AuditsHub.tsx:235-283` własny self-contained layout (niespójność z wzorcem). Fix: `ModuleHub`.
- **[P3] lista = karty `<ul>/<li>`** (`:343-462`), NIE §27 — formalnie N/D ale luka. Fix: `FilterableTable` dla listy programów.
- **[P3] i18n inline** `isPolish`+`tr(en,pl)` — pełne PL/EN, dług spójności; wzorzec docelowy M15 (0× `isPolish`). + 1 hardkod `accentColor="#3b82f6"` (`Wizard:285`). Sweep FAZA 4.

### (d) INTEGRACJA / TESTY (FAZA 3 + 4)
- BE solidne (17 testów). **Brak FE/E2E** — S1-S7 bez FE testów. Dodać: T5 wizard 4-krokowy, T6 hub lista+dashboard, T7 E2E S2→S5→S6.
- CI: `test-suite.yml` tylko `[main,develop]`; default `Londyn` → 17 testów BE poza PR-gate. Dodać `Londyn` (sweep FAZA 4).

## 3. Kroki realizacji
1. **(FAZA 3)** Wpiąć FE edycji programu (PATCH istnieje) lub usunąć martwą trasę; search/filter serwerowy; usunąć nieaktualny baner „MVP” (jeśli wciąż obecny).
2. **(FAZA 3)** Beta-guard na route `/audit-programs` (nie tylko sidebar).
3. **(FAZA 3)** `ModuleHub` zamiast własnego layoutu + §27 (`FilterableTable`) dla listy programów.
4. **(FAZA 4 sweep)** i18n `isPolish`→`t()` (wzorzec M15) + token `accentColor` zamiast hardkodu.
5. **(testy)** FE/E2E: wizard 4-krokowy, hub lista+dashboard, E2E S2 (create→trwałość)→S5 (fan-out)→S6 (rollup).
6. **(FAZA 4)** Trigger CI `Londyn` + module-contract test. **(FAZA 3-Railway)** migracja `audit_programs` + smoke (OSTROŻNIE — fan-out tworzy realne przydziały+notyfikacje; dev `.env` może wskazywać PROD).

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** edycja programu działa (lub trasa usunięta); search serwerowy; pełna pętla kreator→DB→fan-out M10→rollup trwała po reload; zero martwych przycisków.
2. **Bezpieczeństwo:** cross-org assignment zamknięty (już naprawione `7df4b22d6d`, z testem); org-scope 7/7 (już); beta-guard na route.
3. **i18n:** `t()` zamiast inline `isPolish`.
4. **Tokeny:** `accentColor` przez token Visual Standard.
5. **§27:** lista programów przez `FilterableTable` + `ModuleHub`.
6. **E2E w PR-gate:** S2→S5→S6 + 17 testów BE zielone na `Londyn`.

## 5. Weryfikacja
- Kreator: 4 kroki → create → reload → trwałe.
- Fan-out (S5): „generuj ankiety” → przydziały realnie lądują w M10 inbox assignee.
- Rollup (S6): liczby `{generated,total,done,percent,byStatus}` zgodne z DB.
- Cross-org assignment: `PATCH config.assigneeIds=[obcy user]` + generate → odrzucone (P1 read-only proof na staging).
- Edycja: FE woła PATCH → zmiana trwała (lub trasa usunięta).
- Uwaga DB: dev `.env` może wskazywać Railway PROD — fan-out tworzy realne notyfikacje.

## 6. Zależności
- **Fan-out M10** — `interviewAssignmentService` współdzielony z M10; org-validacja assignee naprawiona raz dla M10+M12 (`7df4b22d6d`). Koordynacja z WP M10.
- Mirror-task → M03 My Work (org-scoped).
- CI PR-gate dla `Londyn` — systemowe (FAZA 4).
