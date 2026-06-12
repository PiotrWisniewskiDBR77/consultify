# M01 — Czat — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `2d5769ea20`) · **Audytor:** Claude + agenci (KOD/TESTY/KANON+SEC)
**Wejścia:** _MODULE_MAP_V2 wpis M01 · inwentarz `Harvard/podzial/inventory/INV_A_czat_canvas.md` (sekcja CZAT) · poprzednia karta `docs/audit/2026-06-02/MODULE_01` (62/100) · programy: chat-world-class, deliverables-light
**Evidence:** `Harvard/modules/M01-czat/evidence/` (f1_code_truth.md, f2_tests_report.md, f2_tests.log, f56_kanon_sec.md)

## OCENA: 59/100 — Tier: Alpha górny · status 🟦 NIEPEŁNY (Fazy 3+4 do wykonania)
> **Re-audit 2026-06-11 po Sprintach 1–5:** F: 3→8 (W1 org-scope memory/project naprawiony, commit `b9f2dee9d2`, hard cap zdjęty); C: 7→8 (W15 CI gate Londyn + kontraktowe testy cross-org, commit `7ab1b8aace`). **Fala 2 (pominięte):** A: 22→23 (4 AIChat orphans deleted `dc1dd6154d` — WorkModeMenu/ChatOverlay/ChatToggleButton/ActiveModeStrip; 678 linii); B: 11→12 (`b9f2dee9d2` zamknął też cross-org gap w pamięci projektu — pominięte w B, kreditowane tylko w F). Suma: 59.

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 23 | 49/59 pozycji REALNE, 0 mock w czacie; 4 AIChat orphans deleted (`dc1dd6154d`) — pozostają 2 (CodeInterpreter, OrganizationMemoryPanel). |
| B. Wiring i dane | 15 | 12 | Wiring solidny z migracjami; cross-org gap w pamięci projektu NAPRAWIONE (`b9f2dee9d2`); SQLite-izm `datetime('now')` na PG pozostaje + crash hasła share (naprawiony quick-fixem). |
| C. Testy automatyczne | 15 | 8 | S1 mocno chroniony (z E2E w PR-gate), suite komponentów CZERWONY (UnifiedChatPanel 14 FAIL), integ wymaga DB, E2E głównie cron-only; +1 testy kontraktowe cross-org (W1, commit `7ab1b8aace`) + W15 CI gate. |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana — brak dowodu wizualnego (re-ocena po przejściu w przeglądarce). |
| E. Kanony/UI | 10 | 8 | §27 nie dotyczy (sidebar ≠ tabela), i18n solidne, shell spójny; drobne P2. |
| F. Bezpieczeństwo/dostęp | 10 | 8 | W1 org-scope memory/project naprawiony (commit `b9f2dee9d2`); org-scope 23/25 endp. + W7 beta-lock 3-warstwowy; pozostałe: leak `metadata` public viewer P2, prompt injection chat P2. |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana — brak weryfikacji staging/prod (re-ocena po smoke). |
| **Hard cap zastosowany?** | — | — | **NIE — cross-org P0 naprawiony (W1, commit `b9f2dee9d2`), hard cap zdjęty.** Suma surowa 57 < 70 (Faza 4 niewykonana). |

**Werdykt jednym akapitem:** Czat to najbardziej dojrzały moduł aplikacji — 49/59 funkcji realnych, wszystkie kluczowe przepływy (streaming SSE, CRUD rozmów, handoffy intencji do 7 celów, karty propozycji, deep-research, głos Teresy) wpięte w żywe endpointy z migracjami, org-scope w `conversations.routes.ts` wzorcowy (21/21). Zaufanie łamie **cross-org IDOR w pamięci projektu** (`/api/ai/memory/project/:projectId` — każdy zalogowany czyta i KASUJE pamięć cudzej organizacji po UUID), co uruchamia hard-cap na 50 niezależnie od reszty. Tier wyżej blokują dziś trzy rzeczy: ten P0, czerwony rdzeń testów komponentów (realny bug `CanvasArtifactSwitcher`), oraz niewykonane Fazy 3+4 (środowiska + żywa weryfikacja).

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)
**Checklist pozycji inwentarza:** 59 pozycji CZAT (INV_A, grupy A–H), zweryfikowane 2026-06-11. Sekcja CANVAS z INV_A należy do M02.
**Scenariusze krytyczne (7):**
1. **S1** — nowa rozmowa → wpisz prompt → streaming SSE → reload strony → wiadomości trwałe.
2. **S2** — slash-command / intercept intencji (`/research`, `/table`) → odpala właściwy cel (ResearchProgress / ChatToSchemaPanel).
3. **S3** — załącznik pliku (PDF/CSV) → ingest serwerowy → odpowiedź uwzględnia treść.
4. **S4** — split-view na module (np. `/initiatives`) → kontekst encji (workspaceContext) zasila czat → odpowiedź kontekstowa.
5. **S5** — udostępnienie rozmowy `/share/:token` → otwarcie read-only → revoke → 410/404.
6. **S6** — handoff intencji → Canvas (deck/doc) → chip artefaktu w transkrypcie, reload-safe.
7. **S7** — głos Teresy (Gemini Live, opcjonalny) → transkrypt dopisany do rozmowy.
**Obowiązujące kanony:** §27 TABLE_AND_PREVIEW_CANON: **NIE** (czat ma sidebar historii, nie tabelę encji) · CARD_CONTENT_FORMULA: NIE (czat produkuje propozycje, nie kanon kart treści) · wzorzec hubowy: własny shell `UnifiedChatPanel` (split/full z jednego SSOT), nie ModuleHub · beta-gating: NIE (core, otwarty).

## 1. Prawda kodu (FAZA 1)
> Pełny raport: `evidence/f1_code_truth.md`. Werdykt zbiorczy 59 poz.: **REALNE 49 · MOCK/STUB 0 · ZEPSUTE/ROZJAZD 1 · MARTWE 6 · UKRYTE-celowo/za-flagą reszta.**

### 1a. REALNE (zweryfikowane)
- Wszystkie główne przepływy: CRUD rozmów (`conversations.routes.ts`), streaming SSE (`ai.routes.ts:1423,5341`), share, branch (`:2219`), export (`:2037`), title-generate (`:1186`), save-to-context (`:973`), deep-research orchestrator (`deepThinkingOrchestrator.ts`).
- Handoffy intencji poz. 53–57 (deck/doc/sheet/mindmap/flow/whiteboard/canvas-write) — wpięte i realne.
- Karty propozycji (TeresaProposalCard/ChatTableProposalCard/ExecutionProposalMessage → `POST /chat/confirm`) — realne.

### 1b. MOCK / STUB / fabrykowane klientem
- Brak w obrębie samego CZATU (sourceRefs-STUB należy do M02 Canvas).

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE
- **[ROZJAZD P2]** poz. 48 AI memory — inwentarz mówi „[DZIAŁA]", ale osobny router `/api/ai-memory` jest za `internalToolsGuard` (404 dla nie-dbr77). Dla klienta panel pamięci niedostępny, nie „działa".
- **[P0 — NAPRAWIONE quick-fixem]** `share.routes.ts:592` woła niezdefiniowane `hashPasscode` → `ReferenceError` przy ustawianiu hasła share. Naprawione na `await scryptHash(...)` (zgodne z :304/:417). Wpis w `WDROZENIE_LOG.md`.

### 1d. UKRYTE / MARTWY KOD
- Poz. 58 — `WorkModeMenu`, `ChatToggleButton`+`ChatOverlay` (para), `CodeInterpreter`, `ActiveModeStrip` — 0 zewn. referencji → **wytnij** (Fala 3).
- `OrganizationMemoryPanel.tsx` (orphan z poz. 48) — 0 importów, 0 wywołań API → **wytnij albo wepnij** (zależnie od decyzji o klienckiej pamięci AI).
- Poz. 59 — panele Wave5–9/AIOSHub/ActionCenter, ResearchSessionsDock (poz. 39) — **UKRYTE-celowo** (internal, `/ai/*`, `canUseInternalTools`), zostaw świadomie.

### 1e. Wiring FE↔BE↔DB
| Funkcja | Endpoint | Tabela DB | Migracja | Status |
|---|---|---|---|---|
| Streaming odpowiedzi | `POST /api/ai/chat/stream` | conversations, messages | tak | DZIAŁA |
| CRUD rozmów | `conversations.routes.ts` (GET/POST/PATCH/DELETE) | conversations | tak | DZIAŁA (org-scope 21/21) |
| Załączniki/ingest | `ai.routes.ts:351,540` | attachments | tak | DZIAŁA |
| Share rozmowy | `share.routes.ts` (`/conversations/:id/share`) | conversation_shares | tak | DZIAŁA (po quick-fixie hasła) |
| Branch / export / title | `conversations.routes.ts:2219/2037/1186` | conversations, messages | tak | DZIAŁA |
| Pamięć projektu | `GET/DELETE /api/ai/memory/project/:projectId` | project memory | tak | **ZEPSUTE — bez org-scope (P0)** |

### 1f. Flagi
| Flaga | Default BE (komentarz vs RUNTIME) | Default FE | Kto włącza | Wpływ |
|---|---|---|---|---|
| `ENABLE_DELIVERABLES_LIGHT` | strict `=== 'true'` → OFF | `VITE_…` OFF | env/deploy | handoff deck/doc/sheet → legacy redirect przy OFF |
| `ENABLE_V8_GLOBAL` (poz. 52) | strict `=== 'true'` → OFF (`FeatureFlags.ts:121`) | — | env | wskaźnik kontekstu/run-control off |
| `ENABLE_TERESA_RETRIEVAL` | strict `=== 'true'` → OFF (`:127`) | — | env | retrieval Teresy off |
| rodzina `chatV9*` (FE) | — | **ON** przy braku env (`inputCharCounterFlag.ts:34`, `trustBadgeFlag.ts`) | FE flaga = kill-switch | char counter/trust badge/voice legend/private popover renderują się domyślnie |

> Uwaga: handoffy/V8/retrieval to **strict `=== 'true'`** (nie wzorzec `!== 'false'` z Tabel) — w czystym deployu bez env są OFF.

### 1g. Połączenia międzymodułowe (zasila Krok 6 — INTEGRACJE.md)
| Kierunek | Moduł po drugiej stronie | Mechanizm | Plik:linia | Status |
|---|---|---|---|---|
| WYJŚCIE → | M19 Prezentacje / M02 Canvas | handoff intencji „deck" (in-place light lub `/prezentacje`) | INV_A poz.53 | DZIAŁA / część za flagą |
| WYJŚCIE → | M18 Dokumenty / M02 Canvas | handoff intencji „doc" (light lub `/wordy`) | poz.54 | DZIAŁA / za flagą |
| WYJŚCIE → | M20 Tabele / M02 Canvas | handoff „sheet" + ChatToSchemaPanel (`/excele`) | poz.55 | DZIAŁA |
| WYJŚCIE → | M06/M07/M09 Ideas | interceptory mindmap/process-flow/whiteboard | poz.56 | DZIAŁA |
| WYJŚCIE → | M02 Canvas | pisanie streamem do otwartego canvasa | poz.57 | DZIAŁA |
| WYJŚCIE → | M03/M13/M04 (encje) | karty propozycji → `POST /chat/confirm` (Teresa/Table/Execution) | poz.30 | DZIAŁA |
| WYJŚCIE → | Context OS | zapis wiadomości (bookmark) | `conversations.routes.ts:973` | DZIAŁA |
| WEJŚCIE ← | M13/M10/wszystkie | split-view kontekst encji (pmoContext + workspaceContext) | `MainLayout.tsx:356`, `useOpenChatWithContext.ts` | DZIAŁA |
| WEJŚCIE ← | M23 Organizacja | OrgContext przełącza kontekst czatu i orkiestratora | poz.47 | DZIAŁA |

## 2. Testy automatyczne (FAZA 2)
> Pełny raport: `evidence/f2_tests_report.md` · log: `evidence/f2_tests.log`. Runner: vitest (FE/integ) + playwright (E2E).
**Uruchomienie (CELOWANE, @ `2d5769ea20`):**
- FE unit/store/utils (11 plików): **103 PASS / 1 FAIL** (+1 suite-sierota). FAIL: `voice-server-config-boundary` (brittle source-grep). Sierota: `deepThinkingRuntime.test.ts` (importuje nieistniejące źródło).
- FE komponenty AIChat: **CZERWONE** — `UnifiedChatPanel` 14 FAIL / 15 PASS; `MessageRenderer.context-save`, `AddFilesMenu`, `ConversationItem.rename` FAIL.
- FE voice/nav/composer (10 plików): **116 PASS / 0 FAIL** ✅
- BE service/policy/voice (13 plików): **78 PASS / 0 FAIL** ✅
- Integration chat/ai/conversations: NIE-uruchamialne lokalnie bez DB; odtworzone warunki CI (postgres:15 + `db:migrate --safe`) → **93 PASS / 1 FAIL** + **62 PASS / 2 FAIL**.

**Realne czerwienie (zacommitowane, drzewo czyste):**
1. `CanvasArtifactSwitcher.tsx:84` — `(conversationArtifacts || [])` nie chroni przed nie-iterowalną wartością → 14 FAIL UnifiedChatPanel. **P0.**
2. `chat-projects.list.filters` ×2 — wyciek/duplikat wiersza w `scope=team` (`['org-2','u-2']` vs `['org-2']`). **P0** (zbieżne z org-scope).
3. `MessageRenderer.context-save`, `AddFilesMenu`, `ConversationItem.rename` — FAIL.

**Pokrycie scenariuszy krytycznych:**
| Scenariusz | FE | BE | E2E | CI (PR-gate) | Luka |
|---|---|---|---|---|---|
| S1 nowa rozmowa→SSE→reload | ✓ | ✓ | ✓ | ✓ | — (mocne) |
| S2 slash/intencje | ✓ | częśc. | tylko cron | ✗ | E2E nie w PR-gate |
| S3 załącznik/ingest | suite RED | — | brak | ✗ | brak realnej ochrony |
| S4 split-view/workspaceContext | RED | — | — | ✗ | rdzeń czerwony |
| S5 share rozmowy/revoke | częśc. | częśc. | dla deliverables | ✗ | brak dla samej rozmowy |
| S6 handoff→Canvas chip | RED | — | smoke (nie PR) | ✗ | rdzeń FE czerwony |
| S7 głos Teresy | ✓ | ✓ | — | częśc. | 1 test brittle |

**Pułapka CI potwierdzona:** `e2e-nightly.yml` i `e2e-weekly.yml` = cron/manual-only, NIE na push/PR. Jedyny E2E czatu blokujący PR to `tests/e2e/runtime` (1 test); cały `tests/e2e/smoke/*` (canvas/refresh-persistence) nie liczy się jako ochrona PR.

**Backlog testowy (→ plan dokończenia):**
1. [P0] unit/component — `CanvasArtifactSwitcher` — guard nie-iterowalnej wartości + naprawa mocka UnifiedChatPanel.
2. [P0] integration — `chat-projects` — wyciek wiersza w team-scope filter.
3. [P1] E2E/integ — S3 ingest załącznika (brak pokrycia).
4. [P1] CI — przenieść kluczowe smoke (refresh-persistence, canvas) do triggera PR.
5. [P1] cleanup — usunąć test-sierotę `deepThinkingRuntime`; przepisać voice boundary na asercję zachowania.

## 3. Środowiska / Railway (FAZA 3)
**Status: NIEWYKONANE (PENDING).** Wymaga sesji Railway (smoke endpointów + `information_schema` na staging/prod). Do zrobienia: weryfikacja wdrożonego commitu staging vs prod (prod=2026-05-18), migracje tabel pamięci/share, flagi (`ENABLE_DELIVERABLES_LIGHT`, `GEMINI_LIVE_API_KEY`, `TERESA_VOICE_*`), smoke `POST /api/ai/chat/stream` + `GET /conversations` + `/share/:token`, logi 24–48 h.
| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit | — | — | PENDING |
| Migracje modułu | — | — | PENDING |
| Flagi/env | — | — | PENDING |
| Smoke endpointów | — | — | PENDING |
| Błędy w logach | — | — | PENDING |

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)
**Status: NIEWYKONANE (PENDING).** Preview działa (hook wykrył serwer) — do przejścia 7 scenariuszy z reloadem, polowaniem na przyciski-zawsze-błąd, stany pusty/loading/błąd, i18n PL↔EN, rola MEMBER, konsola/sieć. Bez tego D=0 i status NIEPEŁNY. **Uwaga DB:** `.env` wskazuje na zdalną Railway — przy żywym przejściu używać wyłącznie danych jednorazowych i potwierdzić cel zapisu.
| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1–S7 | — | PENDING | evidence/f4_* |

## 5. Kanony i standardy (FAZA 5)
> Pełny raport: `evidence/f56_kanon_sec.md`. **Brak odstępstw P0/P1.**
**§27 TABLE_AND_PREVIEW_CANON:** NIE dotyczy — `ChatHistorySidebar.tsx` to overlay nawigacyjny + drzewo folderów, nie tabela encji org-scoped (§1.2 reguła rozstrzygająca).
**CARD_CONTENT_FORMULA:** n.d.
**Wzorzec hubowy:** `UnifiedChatPanel` (split/full z jednego SSOT, `MainLayout.tsx:356`) — poprawnie, nie ModuleHub.
**UI-standards / i18n / stany:** i18n PL/EN solidne (94/157 plików `useTranslation`, klucze `aiChat.*` w PL i EN); **korupcja „rose"/„roseuction" NIE występuje** (trafienia `rose` = legalny ton Tailwind). Odstępstwa tylko P2: UI błędu przerwanego strumienia niezweryfikowany wizualnie (→ Faza 4); pełny audyt hardcoded-stringów na 63 plikach (→ Faza 8).

## 6. Bezpieczeństwo i dostęp (FAZA 6)
> Pełny raport: `evidence/f56_kanon_sec.md`.
| Warstwa | Nawigacja | Route | API | Dziura? |
|---|---|---|---|---|
| Czat (core) | sidebar otwarty | `/chat` zalogowany | verifyToken | brak (core) |
| Pamięć projektu | — | — | org-scope NAPRAWIONY (`b9f2dee9d2`) | **NIE** |
| Public viewer | — | `/share/:token`, `/public/artifacts/:token` | token + rate-limit | częśc. (F-3) |

**Org-scope:** `conversations.routes.ts` 21/21 endpointów scoped (SSOT `findAccessibleConversation:92-130`). `ai.routes.ts`: `/memory/project/:projectId` GET/DELETE **org-scoped** (`b9f2dee9d2`).
**Zasoby publiczne:** `/public/artifacts/:token` wzorcowy (strict `^[0-9a-f]{32}$`, rate-limit, revoke→404, expiry→410, payload sanitarny). `/share/:token` revoke/expiry/hasło OK (po quick-fixie).
**WS/realtime:** SSE streaming — autoryzacja tokenem; szczegóły upgrade do potwierdzenia w Fazie 3/4. **Capabilities serwerowo:** DELETE pamięci sprawdza `req.can` ale w kontekście callera, nie własności projektu.
**Findingi:**
- ~~**[P0] F-1/F-2 cross-org IDOR pamięci projektu**~~ **NAPRAWIONY** (`b9f2dee9d2`) — GET i DELETE `/memory/project/:projectId` (`:5748-5755`, `:5826-5833`): SELECT organization_id, compare to JWT orgId → 403 przy niezgodności.
- **[P2] F-3** — public viewer rozmowy zwraca `metadata` verbatim (`share.routes.ts:541`) → ryzyko wycieku pól wewnętrznych.
- **[P3] F-5 + nota infra** — debug-log query web-search; SQLite-izm `datetime('now',…)` w cleanup pamięci pada na PG.

## 7. PLAN DOKOŃCZENIA (FAZA 8)
### Fala 1 — Integralność (P0)
1. ~~**Org-scope na pamięci projektu**~~ **[DONE `b9f2dee9d2`]** — GET/DELETE org-gate via SELECT+compare (`:5749-5755`, `:5827-5833`).
2. **Naprawa `CanvasArtifactSwitcher` guard** — `conversationArtifacts` nie-iterowalne wali 14 testów UnifiedChatPanel — Weryfikacja: suite UnifiedChatPanel zielony.
3. **Wyciek wiersza w team-scope filter** (`chat-projects.list`) — `scope=team` zwraca obce wiersze — Weryfikacja: test filtra zielony, brak `u-2` w wyniku org-2.
4. **(ZROBIONE quick-fix)** crash hasła share `hashPasscode`→`scryptHash` — Weryfikacja: PATCH `/conversations/:id/share` z `password` nie rzuca; test BE.

### Fala 2 — Domknięcie wartości (P1)
1. **Decyzja o klienckiej pamięci AI** — albo udostępnić panel klientom (zdjąć z internalToolsGuard rozjazd poz.48 + wepnąć `OrganizationMemoryPanel`), albo świadomie ukryć i wyciąć orphan — Weryfikacja: panel działa na koncie klienta LUB usunięty z drzewa.
2. **Pokrycie testowe S3/S4/S6** — ingest załącznika, split-view kontekst, handoff→Canvas chip — Weryfikacja: nowe testy integ/E2E zielone.
3. **Przeniesienie kluczowych E2E smoke do PR-gate** — refresh-persistence, canvas chip — Weryfikacja: trigger PR uruchamia je.
4. **F-3 metadata w public viewerze** — whitelist pól zamiast verbatim — Weryfikacja: response nie zawiera pól wewnętrznych.

### Fala 3 — Jakość i kanony (P2)
1. ~~**Wycięcie martwego kodu**~~ — **DONE** (częściowo, `dc1dd6154d`) — WorkModeMenu/ChatOverlay/ChatToggleButton/ActiveModeStrip usunięte (678 l.); pozostają CodeInterpreter + OrganizationMemoryPanel (do decyzji).
2. **SQLite-izm `datetime('now')`** w cleanup pamięci → składnia PG — Weryfikacja: zapytanie cleanup nie pada na Postgresie.
3. **Audyt hardcoded-stringów i18n** (63 pliki) + UI błędu przerwanego strumienia — Weryfikacja: Faza 4 screenshot + brak hardcodów.
4. **Test-sierota `deepThinkingRuntime`** + brittle voice boundary — Weryfikacja: suite bez sieroty, voice test na asercji zachowania.

### Definition of Done (odhaczane przy realizacji)
- [ ] 1. Testy auto FE+BE scenariuszy krytycznych zielone w CI
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami
- [ ] 3. Railway: migracje + flagi + smoke 200 + czyste logi
- [ ] 4. Kanony: checklisty Fazy 5 bez odstępstw P0/P1
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE
- [ ] 6. Zero cichych degradacji bez komunikatu

---
**Pozostałe do domknięcia audytu M01:** Faza 3 (Railway smoke + migracje + flagi) i Faza 4 (żywe przejście 7 scenariuszy ze screenshotami). Po ich wykonaniu re-ocena wymiarów D i G; ocena końcowa pozostanie ≤50 dopóki P0 cross-org nie jest naprawiony.
