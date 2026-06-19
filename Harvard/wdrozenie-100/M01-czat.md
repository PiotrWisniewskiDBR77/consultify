# TECZKA M01 — Czat (Teresa) · pełna teczka reuse-first (pogłębiona do M13-level)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (karta audytu §1–§7 + evidence) i dokłada brakujące ogniwa (Rejestr Wejść z uwagami żywymi #1/#2/#3/#4 · Rejestr Decyzji · DoD z liczbami). Wzór głębi: [`M13-inicjatywy.md`](M13-inicjatywy.md) · struktura: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · decyzje przekrojowe: [`_DECYZJE.md`](_DECYZJE.md) (DP-2 trzeci panel, DP-12 reasoning).

## 00 · Nagłówek
- **Moduł:** M01 Czat (Teresa) · **Pula:** core (kliencki) — najbardziej dojrzały moduł aplikacji
- **Ocena audytu:** 61/100 · **Status:** FAZA 2 (zależny od kręgosłupa FAZA 0) · **Rozmiar:** M (rdzeń) + **L** (i18n 305 inline)
- **Żywy bloker:** brak otwartych P0 · **3 uwagi żywe modułowe:** #2 ramka-w-ramce (P3, otwarta) · #3 show reasoning (P2, ZAMKNIĘTA 2026-06-17) · #4 język PL→EN (P1, ZAMKNIĘTA 2026-06-17 — R3 PASS) · **+ kręgosłup #1** (P0-program, P0 ZNEUTRALIZOWANY 2026-06-17 — Tryb B zamknięty, A częściowy)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 (`2d5769ea20`) · teczka 2026-06-13
- **Karta:** `Harvard/modules/M01-czat/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md`
- **Kod:** `src/components/AIChat/` (UnifiedChatPanel, EnhancedChatInput, MessageRenderer, ChatHistorySidebar, ConversationList, ReasoningTrace) · `server/src/routes/ai.routes.ts` · `server/src/routes/conversations.routes.ts` · `server/src/routes/share.routes.ts` · `server/src/services/ai/AIPipeline.ts` · `server/src/services/ai/persona.ts` · `src/utils/detectMessageLanguage.ts` · `src/store/slices/chatSlice.ts`

## MAPA POKRYCIA (co już jest vs co dokłada teczka)
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + §0 (7 scenariuszy) | job-to-be-done + persony + zakres v1/poza (niżej) |
| B UX docelowe | 🟢 | karta §5 (kanony) + §1c stany | **layout split/full + WSZYSTKIE stany + delty #2/#3/#4** (niżej) |
| C Dane+API+reguły | 🟢 | karta §1e/§1f (wiring/flagi) | **enumeracja endpointów (~40 ai.routes + 21 conversations) + reguła języka/reasoning** (niżej) |
| D AI/Teresa | 🟢 | `persona.ts` SSOT + `AIPipeline.ts` + karta §1a | delta reasoning #3 (DP-12) + język #4 + granica persony (niżej) |
| E Integracje | 🟢 | karta §1g (tabela połączeń) | 7 handoffów + kręgosłup #1 |
| F Epiki | 🟢 | karta §7 (3 fale) | **epiki→stories→Gherkin→L-xx** (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2/§7 | **liczby grep zweryfikowane 2026-06-13** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść (4 uwagi żywe + SPEC_01) + Decyzji** (niżej) |

---

## A · INTENCJA / PRODUKT
- **Job-to-be-done:** prowadzić konsultanta/klienta przez pracę z Teresą — rozmowa, deep-research, oraz **handoff intencji** „zrób deck/doc/sheet/mindmap/flow/whiteboard/canvas" do właściwego modułu i panelu roboczego. Czat ma być **sterownikiem aplikacji** (teza produktu — patrz #1/SPEC_01), nie tylko czat-botem.
- **Persony/role:**
  - **Konsultant** (DBR77 / org-member) — twórca rozmów, używa deep-research, handoffów, kart propozycji; właściciel kontekstu org.
  - **Klient (member)** — rozmowa + odbiór artefaktów; pamięć AI klienta = rozjazd (D-01, dziś za `internalToolsGuard`).
  - **Admin** (org) — org-scope, share/revoke.
  - **Superadmin (DBR77)** — panele internal (`/ai/*`, `AIOSHub`, `ActionCenter`, Wave5–9) **ukryte celowo** za `canUseInternalTools` — nie powierzchnia klienta.
- **Zakres v1:** CRUD rozmów org-scoped (21/21 `conversations.routes.ts`) · streaming SSE · share/branch/export/title · deep-research orchestrator · karty propozycji→`POST /chat/confirm` · 7 handoffów intencji · głos Teresy (Gemini Live, opcjonalny) · pamięć projektu (org-scoped `b9f2dee9d2`).
- **POZA v1:** agentic „interpretacja poleceń wpisanych wewnątrz dokumentu" (decyzja produktowa, NIE budujemy); kliencka pamięć AI jako panel (do rozstrzygnięcia, D-01); function-calling Teresy (Tryb A #1 — docelowy, Fala 2 SPEC_01).
- **Metryka wartości:** % rozmów kończących się **realnym artefaktem/akcją** (nie halucynacją); **0 halucynowanych „dodałem do canvasa"** bez tool-calla (uwaga #1); język odpowiedzi = język usera (#4); trwałość po reload (S1).

## B · UI/UX — STAN DOCELOWY
**Layout główny (`UnifiedChatPanel`, jeden SSOT split/full, `MainLayout.tsx:356`):**
- **Tryb split-view** (na module, np. `/initiatives`): lewa kolumna = czat Teresy, prawa = `WorkCanvasDocumentPanel` (artefakt) lub kontekst encji. Kontekst encji (`workspaceContext`) zasila prompt → odpowiedź kontekstowa (S4).
- **Tryb full** (`/chat`): `ChatHistorySidebar` (overlay nawigacyjny + drzewo folderów; §27 N/D — to nie tabela encji) + transkrypt + composer `EnhancedChatInput`.
- **Composer (`EnhancedChatInput.tsx`):** textarea + action-bar (załączniki `AddFilesMenu`, model `NextModelChip`, reasoning-toggle, głos, char-counter `InputCharCounter`). Focus-border `border-c-focus-solid` na zewnętrznym kontenerze (`:1076-1084`).

**Stany ekranu (docelowo każdy z komunikatem — koniec cichych pustek):**
- **Pusty:** brak rozmów → CTA „Nowa rozmowa"; pusta rozmowa → prompt powitalny Teresy.
- **Ładowanie:** streaming SSE → bąbel z „Thinking…" placeholderem; lista rozmów → skeleton.
- **Błąd:** przerwany strumień → komunikat + retry (UI niezweryfikowany wizualnie, karta §5 P2 → Faza 4); załącznik za duży/zły typ → toast.
- **Pełny:** transkrypt z `MessageRenderer` (markdown, code-block, cytaty `CitationList`, chip artefaktu `ArtifactChip`, karty propozycji).
- **Brak-uprawnień:** rozmowa cudzej org → 404 (`findAccessibleConversation:92-130`); panele internal → ukryte (nie 403 w UI klienta).

**Interakcje / mikro-flow:** branch rozmowy, export, share (token read-only + revoke), save-to-context (bookmark), slash/intercept intencji (`/research`, `/table`), karty propozycji → `POST /chat/confirm` (TeresaProposalCard/ChatTableProposalCard/ExecutionProposalMessage). Reasoning-toggle (`showReasoning`) → docelowo realny `<ReasoningTrace>`.

**Delty do zbudowania (uwagi żywe):**
- **#2 composer „ramka-w-ramce" (P3, LOKALNE):** zostać ma TYLKO zewnętrzny focus-border (`EnhancedChatInput.tsx:1076-1084`); wewnętrzna ramka pochodzi z zagnieżdżonego wrappera (textarea `:1171-1175` / action-bar `:1186-1192` same bez bordera). Fix 2 min po DOM-inspect żywego composera (`preview_inspect`).
- **#3 „show reasoning" nie renderuje toku (P2, SYSTEMOWE):** docelowo realny tok myślenia widoczny gdy toggle ON. Dziś tylko statyczny „Thinking…" placeholder streamu → `<ReasoningTrace>` (`MessageRenderer.tsx:513-520`) renderuje się TYLKO gdy `message.metadata.reasoning` istnieje, a nigdy nie powstaje (patrz D + DP-12).
- **#4 język odpowiedzi = język ostatniej wiadomości usera (P1, SYSTEMOWE):** PL pytanie → PL odpowiedź; po udanej detekcji język utrwalany per-rozmowa (`setConversationChatLanguage`). **NAPRAWIONE 2026-06-13** (R3: brak commita w karcie → do weryfikacji).

**Zgodność z systemem:** Visual Standard · §27 **N/D** (sidebar historii ≠ tabela encji, §1.2); korupcja „rose" **nie występuje** (trafienia = legalny ton Tailwind). a11y/dark/responsywność → Faza 4.

## C · DANE + API + REGUŁY (kontrakt)
- **Wiring FE↔BE↔DB:** karta §1e (streaming SSE, CRUD rozmów org-scope 21/21, załączniki/ingest, share, branch/export/title, pamięć projektu). **Flagi:** karta §1f.
- **Model danych:** `conversations`, `messages`, `conversation_shares`, `attachments`, pamięć projektu (org-scoped). Pułapka: SQLite-izm `datetime('now')` w cleanup pamięci pada na PG (L-04).
- **API — enumeracja (kanon docelowy, RBAC `verifyToken` + org-scope):**
  - **`conversations.routes.ts` (21 endp., SSOT `findAccessibleConversation:92-130`):** `GET /` (list, L231), `POST /` (L402), `GET /:id` (L487), `PATCH /:id` (L569), `DELETE /:id` (L688), `POST /:id/messages` (L793), `POST /:id/save-to-context` (bookmark, L973), `POST /:id/title-generate` (L1186), `POST /:id/branch` (L2161/2219), `GET /:id/export` (L2037), share family.
  - **`ai.routes.ts` (~40 endp.):** `POST /chat/stream` (SSE, L1423/5341), ingest załącznika (`:351`, `:540`), `POST /chat/confirm` (karty propozycji), title (`:1186`), deep-research orchestrator (`deepThinkingOrchestrator.ts`), `GET/DELETE /memory/project/:projectId` (org-scoped `b9f2dee9d2`, `:5743/:5834`), web-search, voice (Gemini Live). Internal `/ai/*` (Wave5–9/AIOSHub) za `canUseInternalTools`.
  - **`share.routes.ts`:** `/conversations/:id/share` (PATCH hasło `scryptHash` po quick-fixie), `GET /share/:token` (read-only; **F-3 leak `metadata` verbatim `:541` → whitelist**), revoke→404/expiry→410.
- **Reguły biznesowe:**
  - **Reguła języka (#4):** `effectiveChatLanguage = detectMessageLanguage(content) || chatLanguage` (`UnifiedChatPanel.tsx:2031`) *(skoryg. 2026-06-19: było `:2000-2001`)*; detektor `detectMessageLanguage.ts:182-219` zwraca `null` przy niepewności (`topScore>=2` + ścisła przewaga, `:211`) *(skoryg. 2026-06-19: było `:152-186`)*; backend twardo EN przy niepewności (`ai.routes.ts` languageInstruction, `persona.ts` detectLanguage). **Docelowo:** silny sygnał diakrytyków PL (ąćęłńóśźż) → PL + `setConversationChatLanguage()` utrwala.
  - **Reguła reasoning (#3):** `showReasoning` (store `chatSlice.ts:101`) → `aiModes.showReasoning` (`UnifiedChatPanel.tsx:3620`) → `ai.routes.ts:1204/1451` → `AIPipeline.ts:2052-2067` (miękka instrukcja `<thinking>`). **NIE ustawia parametru modelu** → bramka.
  - **Reguła kontraktu artefaktów (#1 kręgosłup):** generacja → `deliverables:draft-ready` → auto-mount świeżego draftu w `WorkCanvasDocumentPanel` (dziś listener wychodzi przy `readyDraftId === documentState.draftId` → zerwana więź; SPEC_01 Tryb B).

## D · AI / TERESA
- **Persona/sterowanie (SSOT):** `server/src/services/ai/persona.ts` (Teresa chat) + `AIPipeline.ts`. Granica „**PROPONUJ, nie udawaj wykonania**… Nigdy nie twierdź, że coś zrobiłeś, jeśli nie możesz potwierdzić" (`persona.ts:303-319`) — **łamana w trybie A uwagi #1** (Teresa fabrykuje „dodałem do Canvasa" gdy regex chybia, bo nie ma function-callingu).
- **Co generuje:** odpowiedzi rozmowy, propozycje (karty → `/chat/confirm`), tytuły, deep-research. **Wejścia kontekstu:** `workspaceContext` (encja split-view), `pmoContext`, OrgContext (`MainLayout.tsx:356`, `useOpenChatWithContext.ts`), retrieval Teresy (za flagą `ENABLE_TERESA_RETRIEVAL`).
- **Reasoning (#3, DP-12):** `showReasoning=true` dokleja MIĘKKĄ instrukcję, ale pipeline **NIE ustawia parametru modelu** (`extended_thinking`/`reasoning`) → model bez trybu thinking ignoruje → `metadata.reasoning` puste → `ReasoningTrace` pusty. **Delta (DP-12):** wymusić model thinking-capable per provider (param extended-thinking gdzie wspierany), fallback: ukryć przełącznik gdy provider bez reasoning.
- **Język (#4):** persona buduje twardą „You MUST always respond in English" przy niepewności → źródło EN-defaultu. Delta: reguła „odpowiadaj w języku ostatniej wiadomości".

## E · INTEGRACJE — mapa połączeń
Pełna tabela: karta §1g. **WYJŚCIA →** (7 handoffów intencji, INV_A poz.53–57):
- M19 Prezentacje / M02 Canvas (deck) · M18 Dokumenty / M02 Canvas (doc) · M20 Tabele / M02 Canvas (sheet + ChatToSchemaPanel) · M06/M07/M09 Ideas (mindmap/flow/whiteboard) · M02 Canvas (canvas-write streamem) · M03/M13/M04 (karty propozycji → `/chat/confirm` → task/decision/inicjatywa/notatka) · Context OS (bookmark `:973`).
**WEJŚCIA ←** M13/M10/wszystkie (split-view kontekst encji `workspaceContext`), M23 (OrgContext).
**Kręgosłup (wspólna warstwa):** wszystkie handoffy idą przez `UnifiedChatPanel` + detektory (`documentIntentDetector`/`canvasStreamIntentDetector`) + persona + pipeline `deliverables:draft-ready` → `WorkCanvasDocumentPanel`. Pęknięcie = uwaga #1 (SPEC_01), promieniuje na M02/M18/M19/M20 → re-ocena D w `_TRACKER.md`. **Zależność blokująca:** Fala 1 SPEC_01 (Tryb B) przed domknięciem D modułu.

## F · EPIKI → STORIES → ZADANIA
**EPIK 1 — Integralność rdzenia (P0, DONE):**
- Story 1.1: jako klient chcę, by pamięć projektu była org-scoped. *Dane:* org A i B z projektami. *Gdy:* org A woła `GET/DELETE /memory/project/:idB`. *Wtedy:* 403. → ✅ `b9f2dee9d2`.
- Story 1.2: jako użytkownik chcę stabilny panel czatu. *Dane:* mock `useArtifactsStore`. *Gdy:* render `UnifiedChatPanel`. *Wtedy:* 29/29 zielone. → ✅ `e0b368b218` (CanvasArtifactSwitcher guard), `ca0e632e4d` (chat-projects team-scope 31/31).

**EPIK 2 — Język rozmowy (#4, P1) [L-08]:**
- Story 2.1: jako Polak chcę odpowiedzi po polsku. *Dane:* rozmowa, UI-lang EN. *Gdy:* wpisuję „Z pierwszej informacji na temat DBR77." *Wtedy:* Teresa odpowiada PL i utrwala język rozmowy. → Z: obniżyć próg + diakrytyki PL (`detectMessageLanguage.ts:183-184`); wołać `setConversationChatLanguage()`.

**EPIK 3 — Reasoning realny (#3, P2, warstwa AI→staging) [L-07]:**
- Story 3.1: jako power-user chcę widzieć tok myślenia. *Dane:* toggle ON, provider thinking-capable. *Gdy:* wysyłam prompt. *Wtedy:* `<ReasoningTrace>` pokazuje realny `<thinking>`. → Z: ustawić param reasoning w `AIPipeline.ts:~2052` + wymusić model (DP-12); fallback ukryć toggle.

**EPIK 4 — Kręgosłup czat→canvas (#1, P0-program) [L-09]:**
- Story 4.1: jako user chcę, by „dodałem do Canvasa" było prawdą. *Dane:* fraza spoza regexu. *Gdy:* proszę o dokument. *Wtedy:* realny montaż LUB jawna propozycja, ZERO fałszywego „dodałem". → SPEC_01 Fala 1 (Tryb B) + Fala 2 (Tryb A).

**EPIK 5 — Domknięcie wartości + szlif (P1/P2/P3):**
- Story 5.1: decyzja kliencka pamięć AI (D-01) [L-01]. Story 5.2: pokrycie S3/S4/S6 + smoke→PR-gate [L-03]. Story 5.3: F-3 metadata whitelist [L-02]. Story 5.4: composer #2 [L-06]; SQLite-izm [L-04]; wycięcie `CodeInterpreter`/`OrganizationMemoryPanel` [L-05]; i18n 305 [L-10].

## G · JAKOŚĆ / WERYFIKACJA
| # | Kryterium | Miara M01 (zweryfikowana grep 2026-06-13) |
|---|-----------|-----------|
| 1 | Front↔back | 0 martwych CTA; pamięć AI udostępniona klientowi LUB usunięta (D-01); composer #2 bez podwójnej ramki; kręgosłup #1 montuje deterministycznie |
| 2 | Bezpieczeństwo | cross-org pamięci projektu ✅ `b9f2dee9d2` (potwierdzić testem); public viewer bez leaku `metadata` (F-3 whitelist `share.routes.ts:541`); 23/25 endp. scoped |
| 3 | i18n | 0 z **305** inline (`i18n.language==='pl'`/`isPolish`) w `src/components/AIChat/` *(grep potwierdzony)* |
| 4 | Tokeny | z **52** hex w `src/components/AIChat/` (zweryfikować ile = legalne ikony/SVG vs hardkod); korupcja „rose" 0 |
| 5 | §27 | **N/D** — sidebar historii ≠ tabela encji; 13 surowych `<table>` = render markdown/artefaktów, nie listy encji (potwierdzić przy szlifie) |
| 6 | E2E w PR-gate | S1 (SSE→reload), S3 (ingest), S6 (handoff→Canvas chip) zielone na `Londyn` |

**Scenariusze S1–S7** (karta §0): S1 nowa rozmowa→SSE→reload (mocny); S2 slash/intencje (E2E nie w PR); S3 ingest (suite RED→fix); S4 split-view kontekst (RED); S5 share/revoke; S6 handoff→Canvas (RED, rdzeń FE); S7 głos Teresy.
**Pułapka CI:** `e2e-nightly.yml`/`weekly.yml` = cron-only, NIE na push/PR. Bezpieczeństwo/wydajność: karta §6 (SSE token-auth; prompt-injection P2; debug-log web-search P3).

## H · GOVERNANCE / STEROWANIE

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | 49/59 realne, 0 mock; cross-org pamięci + testy naprawione | L-01..L-05,L-10 |
| W-02 | **Uwaga żywa #2** | 2026-06-13 | composer „ramka w ramce" (P3 LOKALNE) | L-06 |
| W-03 | **Uwaga żywa #3** | 2026-06-13 | „show reasoning" nie renderuje toku (P2 SYSTEMOWE) | L-07 |
| W-04 | **Uwaga żywa #4** | 2026-06-13 | PL pytanie → EN odpowiedź (P1 SYSTEMOWE) | L-08 (NAPRAWIONE) |
| W-05 | **Uwaga żywa #1** (kręgosłup) | 2026-06-13 | chat-as-controller — handoffy przez `UnifiedChatPanel`/`WorkCanvasDocumentPanel` | L-09 |
| W-06 | **SPEC `SPEC_ZADANIE_01_chat_controller.md`** | 2026-06-13 | pełny WP kręgosłupa (Tryb A/B/C, fazy, DoD) | L-09 |
| W-07 | `persona.ts` + `AIPipeline.ts` (SSOT AI) | — | sterowanie Teresą, reguła reasoning/język | L-07,L-08 |
| W-08 | `_DECYZJE.md` DP-12 (reasoning) + DP-2 (trzeci panel) | 2026-06-13 | rozstrzygnięcia przekrojowe | L-07,L-09 |
| W-09 | Feedback prod (`finding_assistant_prompt_sot`) | — | dev backend bije w Railway PROD DB | ryzyko |

### 02 · Stan obecny (prawda kodu) — karta §1 (REALNE 49 · MOCK 0 · ROZJAZD 1 · MARTWE 6). Naprawione: `b9f2dee9d2` (cross-org pamięć), `e0b368b218` (UnifiedChatPanel 29/29), `ca0e632e4d` (chat-projects 31/31), `dc1dd6154d` (4 orphans, 678 l.), quick-fix hasła share. **M01 dziś nie zmieniany poza kręgosłupem.**

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status |
|----|------|---------|--------------------|-------|------|--------|
| L-01 | rozjazd kliencka pamięć AI (`/api/ai-memory` za `internalToolsGuard`, 404) | W-01 | `Gateway.ts:386-388` + `UnifiedChatPanel.tsx:5393` | P2 | 2 | **ZAMKNIĘTA 2026-06-17** (DP-5 zrealizowane: `/api/ai-memory` za `internalToolsGuard`+`highRiskSurfaceGuard(['ai_memory'])` z flagą `TRIAL_AI_MEMORY_DISABLED`; FE panel usunięty z renderu → 0 client-CTA→404; test `tests/unit/backend/aiMemoryGating.test.ts` 4/4. Uwaga produktowa: feature wewn.-only → świadomie BEZ client-facing labelki „wkrótce" — Piotr może dodać teaser jeśli zechce wystawić go klientom) |
| L-02 | F-3 leak `metadata` public viewer | W-01 | `share.routes.ts:451-565` | P2 | 3 | **ZAMKNIĘTA 2026-06-17** (R3 — już naprawione: cały `share.routes.ts` ma 0 tokenów `metadata` i 0 surowych spreadów; `GET /share/:token` whitelistuje pola jawnie; test guard `tests/unit/backend/shareMetadataWhitelist.test.ts` 3/3) |
| L-03 | brak pokrycia S3/S4/S6 + smoke poza PR-gate | W-01 | `tests/integration/ai/ai-attachments-ingest-typegate.test.ts` | P1-test | 2/4 | **CZĘŚCIOWO ZAMKNIĘTA 2026-06-17** (test-residual ZAMKNIĘTY): S1 (`chat-refresh-persistence`), S4 (`work-canvas-split`), S6 (`work-canvas-core-flow`) w E2E; **S3 ingest type-gate dopisany** — `fileFilter` accept/reject (`ai.routes.ts:281-292`), fails-closed bez persystencji, 6/6; `test-suite.yml` PR-gated łapie nowe unit-locki. **Zostaje tylko CI-infra:** wpięcie smoke do PR-gate (`e2e-nightly.yml`/`weekly.yml` cron-only) — współdzielony `.github`, nie ruszam unilateralnie |
| L-04 | SQLite-izm `datetime('now')` na PG (cleanup pamięci) | W-01 | adapter `PostgresDatabase.ts:383` | P3 | 3 | **FALSE POSITIVE 2026-06-17** (adapter `getDatabase()` przepisuje `datetime('now')`→`NOW()` w `PostgresDatabase.ts:383`; pozostałe wystąpienia np. `actionProposalEngine.ts` przechodzą przez ten sam adapter → nie pada na PG; lock: `v8-db-compatibility.test.ts:275`) |
| L-05 | martwy `CodeInterpreter`(+`OrganizationMemoryPanel` jeśli ukryć) | W-01 | 0 zewn. referencji | P2 | 3 | **ZAMKNIĘTA 2026-06-17** (martwy `CodeInterpreter.tsx` usunięty z gita — 0 importów potwierdzone grepem) · **(skoryg. 2026-06-19:** katalog `src/components/AIChat/CodeInterpreter/` NADAL istnieje na dysku — pozostał `CodeExecutionBlock.tsx`, untracked w gicie, **0 importerów** zweryfikowane grepem → bezpieczny do skasowania, nie blokuje buildu). `OrganizationMemoryPanel` → osobno L-01/DP-5. **Dodatkowe orphany (skoryg. 2026-06-19, git-tracked, NIE untracked):** root `src/components/AIChat/AIActionCard.tsx` (eksport `AIActionList:405`) = duplikat żywego `Actions/AIActionCard.tsx`, **0 importerów** (jedyne importy `AIActionCard` celują w `Actions/`); `ActiveModeStrip.tsx` = **0 refów w kodzie** ALE udokumentowany jako produkcyjny w `docs/modules/01_czat/CODEMAP.md` → możliwy „udokumentowany-ale-niezamontowany", NIE czysty martwy kod — triaż przed kasacją (patrz log R3 SA4) |
| L-06 | composer ramka-w-ramce | W-02 | `EnhancedChatInput.tsx:1076-1084` | P3 | 4 | **FALSE POSITIVE 2026-06-17** (sub-agent audit) — composer ma DOKŁADNIE JEDNĄ ramkę: „Main Input Container" `EnhancedChatInput.tsx:1076-1084` (`rounded-xl border` + `border-c-focus-solid`/`border-slate-200`); root `:1006` + textarea `:1174-1178` bezramkowe. OBA miejsca montażu `<EnhancedChatInput>` w `UnifiedChatPanel` (`:5505` welcome, `:5856` normal) mają wrappery BEZ `border`/`ring`: `:5482` (`mt-8 …`), `:5819` (`mx-auto …`), `:5815` (`bg-slate-50`, tylko padding/tło). `OutputToolSelector` = sibling, border tylko na pillach. Brak zmiany w kodzie; guard `tests/components/AIChat/Composer.singleBorder.guard.test.ts` 5/5 |
| L-07 | „show reasoning" bez parametru modelu | W-03,W-07,W-08 | `AIPipeline.ts:331-416` + `llmService.ts:1008-1042` + `ai.routes.ts:4326-4333` + `useAIStream.ts:832-841` + `ReasoningTrace.tsx` | P2 | 2 | **ZAMKNIĘTA 2026-06-17** (R3 PASS — okablowane E2E 6/6 linków; DP-12 gałąź główna: wymuszony `deepseek-reasoner` gdy toggle ON; commit `5278114d71`; testy `aiPipeline-thinking` 9/9) |
| L-08 | PL pytanie → EN odpowiedź | W-04,W-07 | `detectMessageLanguage.ts:182-219` + `UnifiedChatPanel.tsx:2031` (effectiveChatLanguage), `:3140` (setConversationChatLanguage persist), `:3622/3635` (startStream) *(skoryg. 2026-06-19: było `:2007-2008,3114-3122,3615`)* | P1 | 2 | **ZAMKNIĘTA 2026-06-17** (R3 PASS — łańcuch runtime zweryfikowany E2E; commity `b2457a7c69`+`53e3f86e09`; test `tests/unit/detectMessageLanguage.test.ts` 10/10) |
| L-09 | chat-as-controller (handoff→panel zerwany) | W-05,W-06,W-08 | `WorkCanvasDocumentPanel.tsx:704-747,711-720` | P0-program | 0 | **P0 ZNEUTRALIZOWANY 2026-06-17** — Tryb B **ZAMKNIĘTY + zalockowany regresją handoff event→panel** (listener `deliverables:draft-ready` `:711-720` → keyed mount `switched-doc-<id>` `:761-768`; producent `UnifiedChatPanel.tsx:525`; montaż deterministyczny `:722-747`, commity `8a0e64b866`+N-5 `5278114d71`; testy `WorkCanvasDocumentPanel` 33/33 **+ `WorkCanvasDocumentPanel.handoffMount.test.tsx` 2/2** event-driven mount + bezpiecznik N-5); Tryb A **CZĘŚCIOWY** (persona honesty `persona.ts:306/315`+steering `:598-611` live-verified, intent N-4/N-12 `documentIntentDetector.ts`, testy `documentIntentDetector`+`canvasMutationRisk`); **Tryb A function-calling ZBUDOWANY 2026-06-17 (Fala 3)** — `generate_deliverable` (READ) w `mcpServer`+`tools/generateDeliverable.ts`; wpięty w `llmService.callStream` (tools+maxSteps, OFF gdy showReasoning) i `AIPipeline.process`; route `/chat/stream` przekazuje `onDeliverable`→SSE `{type:'deliverable'}`; front `useAIStream`+`UnifiedChatPanel` montuje canvas tą samą sekwencją co intercept; commity `a6aea8d2d5`+`e7bd755b04`, testy kontraktowe 6/6. **NAPRAWIONA** — żywe S-A E2E (auth+LLM staging) pending; **odroczone:** Tryb C konsolidacja silników = Fala 3 BETA |
| L-10 | i18n inline 305× | W-01 | `src/components/AIChat/` | P1 | 4 | **ZAMKNIĘTA 2026-06-18** — agent locale-owner (zniesiony zakaz `public/locales/*`). Display-stringi czatu w `UnifiedChatPanel.tsx` (tytuły idea/note, "z czatu" deliverable titles, working-on mind-map/process-flow/whiteboard) + `ChatToggleButton.tsx` (title/tooltip "AI Assistant") wyekstrahowane inline→`t('chat.*', EN-fallback)`; klucze realnie PL+EN w `public/locales/{pl,en}/translation.json` (namespace `chat.toggle/titles/working/deliverable` + 12 zaległych `chat.suggestions.*`/`chat.confirmSelection`/`chat.context.alreadySaved` które miały bare-`t()` bez klucza w locales). **NIE-luki (poprawnie zostawione):** `deckGenerationChecklist` (pure fn, locale-keyed `CHECKLIST_COPY` table — streamed markdown progress, design pattern nie i18n-gap); `language: …==='pl'?'pl':'en'` (payload do API, nie display); `KimiWorkspace/ArtifactModuleHome.tsx isPolish` = domena M22 Artifacts (poza zakresem). Bramki: gate-skrypt 92/92 kluczy `chat.*`/`canvas.*` rozwiązuje się w PL I EN (0 braków); i18next render-test 92/92; `check-bare-missing` 0; tsc 0; testy `UnifiedChatPanel` 29/29, `ChatToggleButton` 8/8 (asserty PL-tytuł→i18n-driven). Preview PL live: landing renderuje się w pełni po polsku, 0 gołych kluczy (panele czatu za auth-wallem — render dowiedziony render-testem). SHA `2f85ad09f5` |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | kliencka pamięć AI: udostępnić czy wyciąć? | zdjąć `internalToolsGuard`+wepnąć panel / ukryć+wyciąć orphan | Piotr | TBD | **ROZSTRZYGNIĘTE → DP-5: ukryj za flagą + label „wkrótce"** · **ZREALIZOWANE 2026-06-17** (flaga `TRIAL_AI_MEMORY_DISABLED`, panel usunięty; client-facing labelka „wkrótce" pominięta — feature wewn.-only, do wystawienia tylko na decyzję Piotra) |
| D-02 | reasoning #3: który tier/provider wymusić? | per-provider param / wymuszony model thinking | Piotr | TBD | **ROZSTRZYGNIĘTE → DP-12: wymuś model thinking-capable per provider (fallback: ukryj przełącznik)** |
| D-03 | §27 dla 13 `<table>` — render markdown czy lista encji? | potwierdzić N/D / część do FilterableTable | Piotr | TBD | otwarta |

### 05 · Flagi / rollout / beta — core otwarty (brak beta-gatingu); handoffy/V8/retrieval **strict `=== 'true'`** (OFF w czystym deployu); `chatV9*` FE ON-by-default (kill-switch).
### 06 · Ryzyka i założenia — ~~uwaga #4 (L-08) oznaczona NAPRAWIONE bez commita w karcie → R3: do weryfikacji~~ **R3 ROZSTRZYGNIĘTE 2026-06-17:** karta myliła się — fix BYŁ scommitowany (`b2457a7c69` feat + `53e3f86e09` recall). Zweryfikowany cały łańcuch runtime FE→BE→persona *(linie skoryg. 2026-06-19)*: `detectMessageLanguage()` → `effectiveChatLanguage` (`UnifiedChatPanel.tsx:2031`) → persist `setConversationChatLanguage` (`:3140`) → `startStream(…, effectiveChatLanguage)` (`:3622/3635`) → `useAIStream` body.language (`useAIStream.ts:591`) → `ai.routes.ts` languageInstruction (`:1260`/`:1737`) → `persona.detectLanguage()` (`server/src/ai/persona.ts:478`). Test 10/10 (`tests/unit/detectMessageLanguage.test.ts`). **L-08 ZAMKNIĘTA.** Reasoning (#3) i język (#4) = warstwa AI → testować na staging, prod za zgodą. Dev `.env` → Railway PROD DB (`finding_assistant_prompt_sot`).
### 07 · Log wdrożenia + re-ocena — 2026-06-17 (Harvard 1): **R3 rekonsyliacja AI-layer** — teczka była nieaktualna, wiele luk już naprawione w `5278114d71` (feat M01/M02: reasoning + steering + N-1..N-7). Zweryfikowane w runtime + testy zielone: **L-08** (#4 język) ZAMKNIĘTA — łańcuch E2E, test 10/10. **L-07** (reasoning) ZAMKNIĘTA — 6/6 linków okablowane, `deepseek-reasoner` wymuszany, testy 9/9. **L-09** (kręgosłup) — P0 ZNEUTRALIZOWANY: Tryb B zamknięty (testy 33/33), Tryb A częściowy, Tryb A-full+C odroczone (Fala 2/BETA). **L-02** (F-3 metadata) ZAMKNIĘTA — już naprawione, test guard 3/3. **L-04** (datetime SQLite-izm) FALSE POSITIVE — adapter `PostgresDatabase.ts:383`. **L-05** (martwy CodeInterpreter) ZAMKNIĘTA — orphan usunięty. **L-01** (DP-5 pamięć AI) ZAMKNIĘTA — flaga `TRIAL_AI_MEMORY_DISABLED`, test 4/4. **L-03** (testy) CZĘŚCIOWO — pokrycie istnieje + PR-gate `test-suite.yml`; residual CI-infra odroczony. **L-06** (composer P3) otwarta — Faza 4 live DOM-inspect. **L-10** (i18n 305) ZABLOKOWANA — locale keys zakazane dla H1.
> **RUNDA 3 (2026-06-17, fan-out 5 sub-agentów):** L-09 handoff event→panel zalockowany regresją (`WorkCanvasDocumentPanel.handoffMount.test.tsx` 2/2, `93f8c1405a`). i18n re-grep: **318** inline w AIChat/ (L-10). **Residual audyt (SA4) — NIE wykonano (verify-before-delete):** (a) root `src/components/AIChat/AIActionCard.tsx` (eksport `AIActionList` `:405`) = orphan-duplikat żywego `Actions/AIActionCard.tsx` — wymaga ostrożnego osobnego cleanup (spawn_task); (b) `ActiveModeStrip.tsx` 0 refów w kodzie ALE udokumentowany jako produkcyjny w kanonie (`docs/modules/01_czat/CODEMAP.md` etc.) → możliwy bug „udokumentowany-ale-niezamontowany", NIE martwy kod; (c) 401→403 dla braku org-scope (`ai.routes.ts:358/546/1162`) = semantyczny niuans edge-case, odroczony. **Teczki R3-zweryfikowane spójne (SA5).**
>
> **PODSUMOWANIE M01 (2026-06-17, Harvard 1):** 7/10 zamknięte/FP (L-01,02,04,05,07,08,09-B); L-03 częściowo (PR-gate ✓); L-06 P3 odroczona (Faza 4 DOM); L-10 zablokowana (locale ownership). Wszystkie P0/P1/P2 zaadresowane. Nowe testy: 4 pliki (detectMessageLanguage 10/10, shareMetadataWhitelist 3/3, aiMemoryGating 4/4, + istniejące WorkCanvasDocumentPanel 33/33, aiPipeline-thinking 9/9). Komentarz: teczka była mocno nieaktualna — `5278114d71` domknął reasoning+steering+Tryb B przed tą falą; R3 zweryfikował i udokumentował realny stan. 2026-06-13: #4 język zaadresowany (status do weryfikacji); teczka pogłębiona do M13-level. Audyt 2026-06-11: 61/100. Re-ocena D/G po Fazie 3/4 + po naprawie kręgosłupa #1.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + 4 uwagi żywe #1/#2/#3/#4 + SPEC_01 + SSOT persona/pipeline + DP-12/DP-2 + feedback prod) · R2 zero sierot (W→L→DoD) · R3 status #4 „NAPRAWIONE — do weryfikacji" (brak commita w karcie) · R4 DoD z liczbami grep (305 i18n · 13 table · 52 hex) · R5 decyzje rozstrzygnięte (D-01=DP-5, D-02=DP-12; D-03 §27 modułowa); R6 sesja żywa pozostaje · A–E docelowy z layoutem+stanami+endpointami · F epiki↔stories↔Gherkin↔luki · G DoD+S+sec · R6 sesja żywa = Faza 4. **Teczka kompletna do egzekucji.**

## EKRANY (inwentarz) — 2026-06-19
> Inwentarz ekranów/widoków/modali widzianych przez użytkownika M01 Czat. Ugruntowane w plikach `src/components/AIChat/`.

| # | Ekran | Cel | Plik komponentu |
|---|-------|-----|-----------------|
| 1 | Czat full-view (`/chat`) | Główny widok rozmowy: transkrypt + composer + sidebar historii | `src/components/AIChat/UnifiedChatPanel.tsx` |
| 2 | Czat split-view (na module) | Lewa kolumna czat, prawa = canvas/kontekst encji | `src/components/AIChat/UnifiedChatPanel.tsx` (tryb split) |
| 3 | Sidebar historii rozmów (overlay nawigacyjny + drzewo folderów) | Lista rozmów, foldery, nowa rozmowa | `src/components/AIChat/ChatHistorySidebar.tsx` |
| 4 | Lista konwersacji | Pozycje rozmów (rename/delete/move) | `src/components/AIChat/ConversationList.tsx` + `ConversationItem.tsx` |
| 5 | Wyszukiwanie rozmów | Search po historii | `src/components/AIChat/ConversationSearch.tsx` |
| 6 | Composer (action-bar) | Textarea + załączniki + model + reasoning-toggle + głos + char-counter | `src/components/AIChat/EnhancedChatInput.tsx` |
| 7 | Renderowanie wiadomości (markdown/code/cytaty/chip artefaktu) | Pełny transkrypt | `src/components/AIChat/MessageRenderer.tsx` |
| 8 | Stan pusty (brak rozmów / pusta rozmowa) | CTA „Nowa rozmowa" / prompt powitalny Teresy | `UnifiedChatPanel.tsx` (welcome `:5505`) |
| 9 | Karta propozycji Teresy (execution/table) | Propozycja → `POST /chat/confirm` | `TeresaProposalCard` / `ChatTableProposalCard.tsx` / `ExecutionProposalMessage.tsx` |
| 10 | Trace rozumowania (show reasoning) | Tok myślenia gdy toggle ON | `ReasoningTrace.tsx` (render w `MessageRenderer.tsx`) |
| 11 | Modal eksportu rozmowy | Export transkryptu | `src/components/AIChat/ChatExportModal.tsx` |
| 12 | Selektor gałęzi (branch) | Branch rozmowy | `src/components/AIChat/BranchSelector.tsx` |
| 13 | Menu rozmowy (share/revoke/rename) | Akcje na rozmowie | `src/components/AIChat/ChatMenu.tsx` + `ConversationActions.tsx` |
| 14 | Modal „Przenieś do projektu" | Move-to-project | `src/components/AIChat/MoveToProjectModal.tsx` |
| 15 | Modal członków projektu | Zarządzanie członkami projektu czatu | `src/components/AIChat/ProjectMembersModal.tsx` |
| 16 | Menu załączników (Add files) | Dodanie plików / cloud picker | `src/components/AIChat/AddFilesMenu.tsx` + `CloudFilePicker.tsx` |
| 17 | Dock deep-research / postęp + klaryfikacja | Sesje research, progress, doprecyzowanie | `ResearchSessionsDock.tsx` / `ResearchProgress.tsx` / `ResearchClarification.tsx` |
| 18 | Overlay rozmowy głosowej (Teresa voice) | Gemini Live głos | `src/components/AIChat/VoiceConversationOverlay.tsx` |
| 19 | Lista cytowań | Cytaty źródeł deep-research | `src/components/AIChat/CitationList.tsx` |
| 20 | Panele internal SuperAdmin (ukryte za `canUseInternalTools`) | AIOS Hub / ActionCenter / Wave5–9 | `AIOSHub.tsx`, `ActionCenter.tsx`, `Wave5..9*Panel.tsx` |
