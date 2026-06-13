# WP M01 — Czat · dokończenie do 100%

**Pula:** core (kliencki) · **Karta:** `Harvard/modules/M01-czat/KARTA_AUDYTU.md` (ocena 61/100) · **Rozmiar:** M (1–3 dni) · **Żywy bloker:** brak otwartych P0
**Faza programu:** FAZA 2 (klienci) — zależny od kręgosłupa (FAZA 0) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Najbardziej dojrzały moduł aplikacji — 49/59 funkcji REALNE, 0 mock w czacie. Wszystkie kluczowe przepływy wpięte w żywe endpointy z migracjami: streaming SSE (`ai.routes.ts:1423,5341`), CRUD rozmów org-scoped (`conversations.routes.ts` 21/21, SSOT `findAccessibleConversation:92-130`), share/branch/export/title, deep-research orchestrator, karty propozycji → `POST /chat/confirm`, handoffy intencji do 7 celów (deck/doc/sheet/mindmap/flow/whiteboard/canvas-write), głos Teresy (Gemini Live). **Naprawione w audycie:** cross-org IDOR pamięci projektu GET/DELETE (`b9f2dee9d2`, hard cap zdjęty); crash hasła share `hashPasscode`→`scryptHash` (quick-fix); 4 AIChat orphans usunięte (`dc1dd6154d`); test mock-drift UnifiedChatPanel 0/14→29/29 (`e0b368b218`); chat-projects integ 31/31 (`ca0e632e4d`). **UWAGA: dziś (2026-06-13) M01 nie zmieniany poza kręgosłupem** (Tryb B + język PL + #15 CTA „Otwórz" — commity Londyn). Brak otwartych P0.

## 2. Luki do DoD

### (a) FRONTEND / UX (FAZA 2/3)
- **[P2] rozjazd pamięci AI poz.48.** Inwentarz mówi „[DZIAŁA]", ale router `/api/ai-memory` jest za `internalToolsGuard` → 404 dla nie-dbr77; panel pamięci niedostępny klientowi. Decyzja: udostępnić klientom (zdjąć z `internalToolsGuard` + wepnąć `OrganizationMemoryPanel`) ALBO świadomie ukryć i wyciąć orphan `OrganizationMemoryPanel.tsx` (0 importów, 0 wywołań API). Nie zostawiać jako „działa".
- **[P2] martwy kod do wycięcia** — `CodeInterpreter`, `OrganizationMemoryPanel` (0 zewn. referencji; pozostałe 4 już usunięte `dc1dd6154d`).
- **[P2] UI błędu przerwanego strumienia** niezweryfikowany wizualnie → dowód w FAZIE 4.

### (b) BACKEND / API (FAZA 3)
- **[P2] F-3 leak `metadata` w public viewerze** — `share.routes.ts:541` zwraca `metadata` verbatim → ryzyko wycieku pól wewnętrznych. Fix: whitelist pól zamiast verbatim.
- **[P3] SQLite-izm `datetime('now', …)`** w cleanup pamięci pada na Postgresie → składnia PG.

### (c) INTEGRACJA / TESTY E2E (FAZA 2 + 4)
- **[P1] brak pokrycia S3** (ingest załącznika PDF/CSV → odpowiedź uwzględnia treść) — suite był RED, brak realnej ochrony. Dodać test integ/E2E.
- **[P1] S4 split-view/workspaceContext** i **S6 handoff→Canvas chip** — rdzeń był RED (naprawiony `e0b368b218`); domknąć testem zachowania (kontekst encji zasila czat; chip artefaktu reload-safe).
- **[P1] CI** — kluczowe smoke (refresh-persistence, canvas chip) poza PR-gate; `e2e-nightly/weekly.yml` = cron/manual-only. Jedyny PR-blokujący E2E czatu = `tests/e2e/runtime` (1 test). Przenieść smoke do triggera PR + dodać `Londyn` (sweep FAZA 4).
- **[P3] cleanup** — test-sierota `deepThinkingRuntime` (importuje nieistniejące źródło); brittle voice boundary `voice-server-config-boundary` (source-grep → asercja zachowania).

### (d) Przekrojowe (FAZA 4)
- i18n: audyt hardcoded-stringów (63 pliki); pokrycie `aiChat.*` solidne. **§27 N/D** (sidebar historii ≠ tabela encji — §1.2). **Korupcja „rose" NIE występuje** (trafienia = legalny ton Tailwind).

## 3. Kroki realizacji
1. **(FAZA 2)** Decyzja o klienckiej pamięci AI — udostępnić panel (zdjąć `internalToolsGuard` + wepnąć `OrganizationMemoryPanel`) ALBO ukryć i wyciąć orphan. Weryfikacja: panel działa na koncie klienta LUB usunięty z drzewa.
2. **(FAZA 2)** Pokrycie testowe S3 (ingest załącznika), S4 (split-view kontekst), S6 (handoff→Canvas chip) — testy integ/E2E.
3. **(FAZA 3)** F-3: whitelist pól w public viewerze zamiast `metadata` verbatim.
4. **(FAZA 3)** SQLite-izm `datetime('now')` → składnia PG w cleanup pamięci.
5. **(FAZA 3)** Wytnij `CodeInterpreter` (+ `OrganizationMemoryPanel` jeśli krok 1 → ukryć).
6. **(FAZA 4)** Przeniesienie smoke (refresh-persistence, canvas chip) do PR-gate + trigger CI `Londyn`; cleanup test-sieroty + voice boundary; audyt hardcoded-stringów i18n.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** zero martwych przycisków; pamięć AI udostępniona klientowi LUB usunięta (koniec rozjazdu „działa"); S1/S2/S4/S6 przepływy E2E na realnych danych.
2. **Bezpieczeństwo:** cross-org pamięci projektu zamknięty (naprawione `b9f2dee9d2`); public viewer bez leaku `metadata`; hasło share działa (naprawione).
3. **i18n:** `t()` pełne; brak hardcodów EN na 63 plikach.
4. **Tokeny:** zgodne z Visual Standard (korupcja „rose" nie występuje).
5. **§27:** N/D (sidebar ≠ tabela) — bez odstępstwa.
6. **E2E w PR-gate:** S1/S3/S6 + refresh-persistence zielone na `Londyn`.

## 5. Weryfikacja
- Cross-org pamięci: `GET/DELETE /api/ai/memory/project/:projectId` na cudzy projekt → 403 (test regresji; już naprawione `b9f2dee9d2`).
- S1: nowa rozmowa → prompt → streaming SSE → reload → wiadomości trwałe (żywe przejście + screenshot, FAZA 4).
- S3: załącz PDF/CSV → odpowiedź uwzględnia treść.
- S6: handoff intencji „deck/doc" → chip artefaktu w transkrypcie po reloadzie.
- Public viewer: response NIE zawiera pól wewnętrznych z `metadata`.
- **Uwaga DB:** dev `.env` → Railway zdalna (PROD); dev backend bije w prod DB — przy żywym przejściu wyłącznie dane jednorazowe.

## 6. Zależności
- **Kręgosłup (FAZA 0)** — handoffy deck/doc/sheet idą przez wspólną warstwę sterującą (Tryb A/B/C, `SPEC_ZADANIE_01`); szlif S6 czeka na konsolidację artefaktów (Tryb C).
- Handoffy → M02 Canvas / M18 / M19 / M20 — koordynować z ich WP (część za flagą `ENABLE_DELIVERABLES_LIGHT`, strict `=== 'true'`).
- Karty propozycji → M03/M13/M04 przez `/chat/confirm` — wspólny kontrakt.
