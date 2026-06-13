# TECZKA M01 — Czat (Teresa) · pełna teczka reuse-first

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (karta audytu §1–§7 + evidence) i dokłada brakujące ogniwa (Rejestr Wejść z uwagami żywymi #2/#3/#4 · Rejestr Decyzji · DoD z liczbami). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M01 Czat (Teresa) · **Pula:** core (kliencki) — najbardziej dojrzały moduł aplikacji
- **Ocena audytu:** 61/100 · **Status:** FAZA 2 (zależny od kręgosłupa FAZA 0) · **Rozmiar:** M (rdzeń) + **L** (i18n ~305 inline)
- **Żywy bloker:** brak otwartych P0 · **3 uwagi żywe:** #2 ramka-w-ramce (P3) · #3 show reasoning (P2) · #4 język PL→EN (P1, NAPRAWIONE 2026-06-13)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M01-czat/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md`
- **Kod:** `src/components/AIChat/` (UnifiedChatPanel, EnhancedChatInput, WorkCanvasDocumentPanel, MessageRenderer) · `server/src/routes/ai.routes.ts` · `server/src/routes/conversations.routes.ts` · `server/src/services/ai/AIPipeline.ts` · `src/utils/detectMessageLanguage.ts`

## MAPA POKRYCIA (co już jest vs co dokłada teczka)
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + §0 (7 scenariuszy) | job-to-be-done + zakres (niżej) |
| B UX docelowe | 🟢 | karta §5 (kanony) + §1c stany | delta composer #2 + reasoning #3 + język #4 |
| C Dane+API+reguły | 🟢 | karta §1e (wiring) + §1f (flagi) | link + reguła języka (niżej) |
| D AI/Teresa | 🟢 | `persona.ts` SSOT + `AIPipeline.ts` + karta §1a | delta reasoning #3 + język #4 |
| E Integracje | 🟢 | karta §1g (tabela połączeń) | — |
| F Epiki | 🟢 | karta §7 (3 fale) | przeformułowane na epiki (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2/§7 | **liczby** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść (3 uwagi żywe) + Decyzji** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
- **Job-to-be-done:** prowadzić konsultanta/klienta przez pracę z Teresą — rozmowa, deep-research, oraz handoff intencji „zrób deck/doc/sheet/mindmap/flow/whiteboard/canvas" do właściwego modułu i panelu roboczego.
- **Persony/role:** konsultant, klient (member), admin; superadmin (panele internal `/ai/*` ukryte celowo). Core, otwarty — brak beta-gatingu.
- **Zakres v1:** CRUD rozmów org-scoped (21/21) · streaming SSE · share/branch/export/title · deep-research orchestrator · karty propozycji→`/chat/confirm` · 7 handoffów intencji · głos Teresy (Gemini Live). **POZA v1:** agentic „interpretacja poleceń wpisanych wewnątrz dokumentu" (decyzja produktowa); kliencka pamięć AI (do rozstrzygnięcia, D-01).
- **Metryka:** % rozmów kończących się realnym artefaktem/akcją; 0 halucynowanych „dodałem do canvasa" bez tool-calla (uwaga #1, kręgosłup).

## B · UX DOCELOWE *(link + delty żywe)*
Stany ekranu (pusty/ładowanie/błąd/pełny) + kanony: karta §5 (§27 **N/D** — sidebar historii ≠ tabela encji; korupcja „rose" **nie występuje**, trafienia = legalny ton Tailwind).
**Delty do zbudowania (uwagi żywe):**
- **#2 composer „ramka-w-ramce" (P3, LOKALNE):** zostać ma TYLKO zewnętrzny focus-border `border-c-focus-solid` (`EnhancedChatInput.tsx:1076-1084`); wewnętrzna ramka pochodzi z zagnieżdżonego wrappera (textarea `:1171-1175` / action-bar `:1186-1192` same bez bordera). Fix 2 min po DOM-inspect żywego composera.
- **#3 „show reasoning" nie renderuje toku (P2, SYSTEMOWE):** docelowo realny tok myślenia widoczny gdy toggle ON, nie statyczny „Thinking…".
- **#4 język odpowiedzi = język ostatniej wiadomości usera (P1, SYSTEMOWE):** PL pytanie → PL odpowiedź; po udanej detekcji język utrwalany per-rozmowa. **NAPRAWIONE 2026-06-13** (status do potwierdzenia — patrz R3 niżej).

## C · DANE + API + REGUŁY *(link + reguła języka)*
- **Wiring FE↔BE↔DB:** karta §1e (streaming SSE, CRUD rozmów org-scope 21/21 SSOT `findAccessibleConversation:92-130`, załączniki/ingest, share, branch/export/title, pamięć projektu). **Flagi:** karta §1f (`ENABLE_DELIVERABLES_LIGHT`/`V8`/`TERESA_RETRIEVAL` strict `=== 'true'`; rodzina `chatV9*` FE ON-by-default).
- **Reguła języka (kanon docelowy, #4):** `effectiveChatLanguage = detectMessageLanguage(content) || chatLanguage` (`UnifiedChatPanel.tsx:2000-2001`); detektor `detectMessageLanguage.ts:152-186`; fallback `uiLang` defaultuje EN (`:844`); backend twardo EN przy niepewności (`ai.routes.ts:1256-1258`, `persona.ts:544`). Docelowo: silny sygnał diakrytyków PL → PL + `setConversationChatLanguage()` utrwala język rozmowy.
- **Reguła kontraktu artefaktów (#1 kręgosłup):** generacja → `deliverables:draft-ready` → auto-mount świeżego draftu w `WorkCanvasDocumentPanel` (dziś listener wychodzi przy `readyDraftId === documentState.draftId`).

## D · AI / TERESA *(SSOT istnieje — linkuj)*
- **Persona/sterowanie:** SSOT = `server/src/services/ai/persona.ts` (Teresa chat); granice persony „nie udawaj wykonania" (`persona.ts:303-319`) — łamane w trybie A uwagi #1.
- **Reasoning (#3):** `showReasoning` (store `chatSlice.ts:101`) → `AIPipeline.ts:2052-2067` dokleja MIĘKKĄ instrukcję `<thinking>`, ale **NIE ustawia parametru modelu** (`extended_thinking`/`reasoning`) → model bez trybu thinking ignoruje → `ReasoningTrace` pusty. Delta: ustawić realny parametr reasoning + wymusić model wspierający.
- **Język (#4):** persona buduje twardą instrukcję „respond in English" przy braku/niepewności → źródło EN-defaultu.

## E · INTEGRACJE
Pełna tabela: karta §1g. Skrót: **→** M19/M02 (deck), M18/M02 (doc), M20/M02 (sheet+ChatToSchema), M06/M07/M09 (mindmap/flow/whiteboard), M02 (canvas-write), M03/M13/M04 (karty propozycji `/chat/confirm`), Context OS (bookmark). **←** M13/M10/wszystkie (split-view kontekst encji `workspaceContext`), M23 (OrgContext). **Kręgosłup:** wszystkie handoffy idą przez wspólną warstwę (`UnifiedChatPanel`+detektory+`WorkCanvasDocumentPanel`) — pęknięcie = uwaga #1 (SPEC_ZADANIE_01).

## F · EPIKI *(z karty §7, forma epików)*
- **EPIK 1 — Integralność rdzenia (P0):** ~~CanvasArtifactSwitcher guard~~ DONE (`e0b368b218`); ~~chat-projects team-scope filter~~ DONE (`ca0e632e4d`); ~~hasło share~~ DONE (quick-fix). [karta §7 Fala 1]
- **EPIK 2 — Domknięcie wartości (P1):** decyzja kliencka pamięć AI (D-01); pokrycie testowe S3/S4/S6; smoke→PR-gate; F-3 metadata whitelist. [Fala 2]
- **EPIK 3 — Język rozmowy (#4, P1):** detekcja PL + utrwalanie języka per-rozmowa. [uwaga żywa]
- **EPIK 4 — Reasoning realny (#3, P2):** parametr modelu zamiast miękkiej instrukcji. [uwaga żywa, warstwa AI → staging]
- **EPIK 5 — Szlif kanonu (P2/P3):** composer ramka-w-ramce (#2); SQLite-izm `datetime('now')`→PG; wycięcie `CodeInterpreter`/`OrganizationMemoryPanel`; i18n inline (305); cleanup test-sieroty. [Fala 3]

## G · JAKOŚĆ / DoD *(skwantyfikowane)*
| # | Kryterium | Miara M01 |
|---|-----------|-----------|
| 1 | Front↔back | 0 martwych CTA; pamięć AI udostępniona klientowi LUB usunięta (koniec rozjazdu „działa", D-01); composer #2 bez podwójnej ramki |
| 2 | Bezpieczeństwo | cross-org pamięci projektu ✅ `b9f2dee9d2` (potwierdzić testem); public viewer bez leaku `metadata` (F-3 whitelist); 23/25 endp. scoped |
| 3 | i18n | 0 z **305** inline (`i18n.language==='pl'`/`isPolish`) w `src/components/AIChat/` |
| 4 | Tokeny | **52** hex w `src/components/AIChat/` (zweryfikować ile = legalne ikony/SVG vs hardkod); korupcja „rose" 0 |
| 5 | §27 | **N/D** — sidebar historii ≠ tabela encji (§1.2); 13 surowych `<table>` = render markdown/artefaktów, nie listy encji org-scoped (potwierdzić przy szlifie) |
| 6 | E2E w PR-gate | S1 (SSE→reload), S3 (ingest załącznika), S6 (handoff→Canvas chip) zielone na `Londyn` |

Scenariusze S1–S7 + pokrycie + pułapka CI (`e2e-nightly/weekly` = cron-only): karta §0/§2. Bezpieczeństwo: karta §6.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | 49/59 realne, 0 mock; cross-org pamięci + testy naprawione | L-01,02,03,04,05 |
| W-02 | **Uwaga żywa #2** | 2026-06-13 | composer „ramka w ramce" (P3 LOKALNE) | L-06 |
| W-03 | **Uwaga żywa #3** | 2026-06-13 | „show reasoning" nie renderuje toku (P2 SYSTEMOWE) | L-07 |
| W-04 | **Uwaga żywa #4** | 2026-06-13 | PL pytanie → EN odpowiedź (P1 SYSTEMOWE) | L-08 (NAPRAWIONE) |
| W-05 | **Uwaga żywa #1** (kręgosłup) | 2026-06-13 | chat-as-controller — handoffy przez `UnifiedChatPanel`/`WorkCanvasDocumentPanel` | L-09 (SPEC_01, FAZA 0) |
| W-06 | `SPEC_ZADANIE_01_chat_controller.md` | 2026-06-13 | pełny WP kręgosłupa (Tryb A/B/C) | L-09 |
| W-07 | persona.ts + AIPipeline.ts (SSOT AI) | — | sterowanie Teresą, reguła reasoning/język | L-07,L-08 |
| W-08 | Feedback prod (`finding_assistant_prompt_sot`) | — | dev backend bije w Railway PROD DB | ryzyko (niżej) |

### 02 · Stan obecny (prawda kodu) — karta §1 (REALNE 49 · MOCK 0 · ROZJAZD 1 · MARTWE 6). Naprawione: `b9f2dee9d2` (cross-org pamięć projektu), `e0b368b218` (UnifiedChatPanel 29/29), `ca0e632e4d` (chat-projects 31/31), `dc1dd6154d` (4 orphans), quick-fix hasła share. **M01 dziś (2026-06-13) nie zmieniany poza kręgosłupem** (Tryb B + #4 język + #15 CTA = commity Londyn na innych modułach).

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status |
|----|------|---------|--------------------|-------|------|--------|
| L-01 | rozjazd kliencka pamięć AI (`/api/ai-memory` za `internalToolsGuard`, 404) | W-01 | `OrganizationMemoryPanel.tsx` (0 importów) | P2 | 2 | otwarta (D-01) |
| L-02 | F-3 leak `metadata` public viewer | W-01 | `share.routes.ts:541` | P2 | 3 | otwarta |
| L-03 | brak pokrycia S3/S4/S6 + smoke poza PR-gate | W-01 | `e2e-nightly.yml`/`weekly.yml` cron-only | P1-test | 2/4 | otwarta |
| L-04 | SQLite-izm `datetime('now')` na PG (cleanup pamięci) | W-01 | cleanup pamięci | P3 | 3 | otwarta |
| L-05 | martwy kod `CodeInterpreter`(+`OrganizationMemoryPanel` jeśli ukryć) | W-01 | 0 zewn. referencji | P2 | 3 | otwarta |
| L-06 | composer ramka-w-ramce | W-02 | `EnhancedChatInput.tsx:1076-1084` + wrapper | P3 | 4 | otwarta (do DOM-inspect) |
| L-07 | „show reasoning" bez parametru modelu | W-03,W-07 | `AIPipeline.ts:2052-2067` | P2 | 2 | otwarta (warstwa AI→staging) |
| L-08 | PL pytanie → EN odpowiedź (próg detekcji + brak utrwalania języka) | W-04,W-07 | `detectMessageLanguage.ts:152-186,183-184` + `UnifiedChatPanel.tsx:2000-2001,844` | P1 | 2 | **NAPRAWIONE 2026-06-13 (R3: do weryfikacji — brak commita w karcie)** |
| L-09 | chat-as-controller (handoff→panel zerwany) | W-05,W-06 | `WorkCanvasDocumentPanel.tsx:1039-1043` | P0-program | 0 | otwarta (SPEC_01, kręgosłup) |
| L-10 | i18n inline | W-01 | `src/components/AIChat/` (305×) | P1 | 4 | otwarta |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | kliencka pamięć AI: udostępnić czy wyciąć? | zdjąć `internalToolsGuard`+wepnąć panel / ukryć+wyciąć orphan | Piotr | TBD | otwarta |
| D-02 | reasoning #3: który tier/provider wymusić? | per-provider param / wymuszony model thinking | Piotr | TBD | otwarta (warstwa AI) |
| D-03 | §27 dla 13 `<table>` — render markdown czy lista encji? | potwierdzić N/D / część do FilterableTable | Piotr | TBD | otwarta |

### 05 · Flagi/rollout — core otwarty (brak beta-gatingu); handoffy/V8/retrieval strict `=== 'true'` (OFF w czystym deployu); `chatV9*` FE ON-by-default (kill-switch).
### 06 · Ryzyka — uwaga #4 (L-08) oznaczona NAPRAWIONE bez commita w karcie → **R3: do weryfikacji w kodzie** przed zamknięciem. Reasoning (#3) i język (#4) to warstwa AI → testować na staging, prod za zgodą. Dev `.env` → Railway PROD DB (`finding_assistant_prompt_sot`) — przy żywym smoke wyłącznie dane jednorazowe.
### 07 · Log — 2026-06-13: #4 język PL zaadresowany (status do weryfikacji). Audyt 2026-06-11: ocena 61/100; cross-org `b9f2dee9d2`, testy `e0b368b218`/`ca0e632e4d`. Re-ocena D/G po Fazie 3/4.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + 3 uwagi żywe #2/#3/#4 + kręgosłup #1/SPEC_01 + SSOT persona/pipeline + feedback prod) · R2 zero sierot (wejście→luka→DoD) · R3 status #4 oznaczony „NAPRAWIONE — do weryfikacji" bo brak commita w karcie · R4 DoD z liczbami (305 i18n · 13 table · 52 hex) · R5 decyzje z właścicielem (terminy TBD z Piotrem) · A–E docelowy zlinkowany · F epiki↔luki · G DoD+S+sec · R6 sesja żywa = Faza 4 (zaplanowana). **Teczka kompletna do egzekucji.**
