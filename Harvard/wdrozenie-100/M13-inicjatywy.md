# WP M13 — Inicjatywy · dokończenie do 100%

**Pula:** core (kliencki: VTS/Apator/Elkomtech) · **Karta:** `Harvard/modules/M13-inicjatywy/KARTA_AUDYTU.md` (ocena 54/100) · **Rozmiar:** M (1–3 dni) · **Żywy bloker:** brak P0 (P1 funkcjonalne)
**Faza programu:** FAZA 2 (klienci) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Rdzeń mocny: portfolio (4 widoki), dokument inicjatywy (~30 sekcji, `sections/registry.ts`), zakładka Analysis (graf zależności + feasibility/completeness + auto-fix), generator propozycji z insightów wywiadu, archive/status z preflightem `initiativeWriteTruth`, ROI realny. **Naprawione w audycie:** cross-org governance IDOR (`b9f2dee9d2`), CRUD 0 testów → 5/5 (`ea77dc678c`), AI Wizard CTA (`3aec45a21d`). **Naprawione 2026-06-13 (ten program):** CTA „Otwórz" z board-preview ujawnione (`InitiativesHub` footer → `handleOpenInitiativeDocument`). Brak otwartych P0.

## 2. Luki do DoD

### (a) FRONTEND / UX (FAZA 2)
- **[P1] Tworzenie z huba częściowo martwe.** 3 CTA disabled na sztywno: „Nowa inicjatywa" (`InitiativesHub.tsx:1985-1997`), AI Wizard (`:1943-1952` — brak `setShowInitiativeWizard(true)`), Charter (`:1953-1962` — brak `setShowCharter(true)`). Komponenty gotowe; żywe tylko deep-link `?new=1` (`:843-863`→modal `:2167-2249`) i ścieżka z M10 (`InterviewHub.tsx:12955`). Fix: odblokować New/Charter/Wizard (wpiąć istniejące settery) albo świadomie usunąć.
- **[P3] bulk Tag/Due/Delete** — przyciski zawsze-disabled (brak BE). Wpiąć BE lub ukryć.
- **[UWAGA #14, P1-design] kompletny system inicjatyw** — preview statusów + next-gate, menu jako pipeline (wizualizacja przepływu), zarządzanie statusami wewnątrz inicjatywy z egzekucją uprawnień. SSOT: 7 dokumentów `INITIATIVE_*.md` — pogodzić z `stageGateService.ts` i UI.
- **[UWAGA #16, P1-design] formuła AI-fill wg standardu McKinsey** — `initiativeGenerationService.ts`/`InitiativeDocumentView.tsx` vs `INITIATIVE_FORMULA.md`/`CARD_CONTENT_FORMULA.md`; doprowadzić uzupełnianie każdej sekcji do standardu.

### (b) BACKEND / API (FAZA 2)
- **[P1] cicha degradacja V8 bez komunikatu** — chip V8 Planning OFF → cichy fallback bez banera (inaczej niż Finance/Results, które mają baner). Fix: baner/log jak w Finance/Results.
- **[P1] gating pilota VTS tylko klient** — `isPilotParticipantRole` w hubie; serwer `createInitiative`/bulk/generator bez gatingu → obejście bezpośrednim API. Fix: gating serwerowy (pilot → 403).

### (c) INTEGRACJA / TESTY (FAZA 2 + 4)
- **[UWAGA #10, P1-design] in-context open** — otwarcie inicjatywy z MyWork wciąż `navigate(getArtifactPath('initiative',...))` (`MyWorkHub.tsx:1249, 3193`) zamiast karty w bieżącym widoku. **Wymaga decyzji UX** (drawer/karta/zakładka + renderer initiative w MyWork) — checkpoint projektowy, NIE zgadywać.
- E2E: S2 (deep-link create), S3 (edycja sekcji), S5 (Charter z insightu) — do PR-gate; S6 Kanban DnD smoke→PR-gate.

### (d) Przekrojowe (FAZA 4)
- RC-4 sticky thead na Portfolio; resize kolumn; i18n inline (`i18n.language === 'pl'` w `renderInitiativePreview*`) → `t()`; tokeny.

## 3. Kroki realizacji
1. **(FAZA 2)** Włączyć New/Charter/AI Wizard z huba (wpiąć settery) lub usunąć CTA. Weryfikacja: CTA tworzy inicjatywę albo znika.
2. **(FAZA 2)** Gating pilota serwerowo (`createInitiative`/bulk/generator → 403 dla pilota). Test API.
3. **(FAZA 2)** Baner degradacji V8 (wzorzec Finance/Results).
4. **(FAZA 2, #14/#16)** System statusów/bramek: preview + next-gate + menu-pipeline + AI-fill wg formuły. Pogodzić SSOT `INITIATIVE_*.md` ↔ `stageGateService.ts` ↔ UI.
5. **(checkpoint projektowy)** #10 in-context open — po decyzji UX.
6. **(FAZA 4)** bulk BE lub ukrycie; RC-4; i18n; tokeny; E2E S2/S3/S5 do PR-gate.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** tworzenie z huba żywe (lub usunięte); bulk żywe (lub ukryte); zero martwych CTA; statusy/bramki sterowalne z egzekucją uprawnień.
2. **Bezpieczeństwo:** gating pilota serwerowy (403); governance org-scope (już naprawione).
3. **i18n:** `t()` pełne (koniec `i18n.language==='pl'` inline).
4. **Tokeny:** Visual Standard.
5. **§27:** Portfolio + listy przez FilterableTable; RC-4 naprawione.
6. **E2E w PR-gate:** S2/S3/S5 zielone na `Londyn`.

## 5. Weryfikacja
- Tworzenie: hub CTA → nowa inicjatywa trwała po reload; pilot → 403 z API.
- V8 OFF: użytkownik widzi baner, nie pustkę.
- AI-fill: wygenerowana sekcja zgodna z `CARD_CONTENT_FORMULA.md` (spot-check).
- „Otwórz" z board-preview → pełny dokument (już zrobione 2026-06-13 — re-smoke).
- Uwaga DB: dev `.env` → Railway zdalna.

## 6. Zależności
- #14/#16 (system inicjatyw + AI-fill) korzysta z kręgosłupa (Faza 0) dla generacji z czatu.
- M10→M13 Charter (`InterviewHub.tsx:12955`) — koordynować z WP M10 (Faza 2).
- #10 in-context — wspólny z klasterem nawigacyjnym Fazy 0.4 (checkpoint projektowy).
