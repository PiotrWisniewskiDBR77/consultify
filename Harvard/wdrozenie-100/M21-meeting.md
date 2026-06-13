# TECZKA M21 — Meeting (hub spotkań)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje kartę audytu + INV_E + kod i dokłada brakujące ogniwa (Rejestr Wejść z uwagami żywymi · Rejestr Decyzji · DoD z liczbami · korekta staleności R3). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md), referencja (PODŁOGA): [`M13-inicjatywy.md`](M13-inicjatywy.md). Decyzje przekrojowe: [`_DECYZJE.md`](_DECYZJE.md).

## 00 · Nagłówek
- **Moduł:** M21 Meeting (hub spotkań) · **Pula:** beta · **handoff WSPÓLNY z M04 Notatnik** (DP-2 globalny dok IDE-tabs)
- **Ocena audytu:** 55/100 · **Tier:** Alpha górny · **Status:** FAZA 3 → FAZA 4 · **Rozmiar:** M (1–2 dni)
- **Żywy bloker:** brak P0/P1 (org-scope czysty — kohorta czystych)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13 (pogłębiona do M13-level)
- **Karta:** `Harvard/modules/M21-meeting/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md` · **INV_E:** `…/INV_E_outputs_studia_meeting.md` (MEETING poz.1-8)
- **Kod:** `src/components/Meeting/` (MeetingHub) · `server/src/routes/meeting.routes.ts` (282 l., **9 endpointów**) · `server/src/services/meetingService.ts` (399 l.) · `server/src/services/ai/meetingIntelligenceService.ts` (274 l.) · tabele `meetings`, `meeting_follow_ups`, `notebook_pages` (mig.`20260306_notebook_pages.sql`)

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta §0 + INV_E MEETING | job-to-be-done + zakres + role |
| B UX docelowe | 🟢 | karta §5 (**§27 zgodny** + ModuleHub) | stany ekranu + archive (D-02) |
| C Dane+API+reguły | 🟢 | karta §1e/§1f + `meetingService.ts` | **9 EP enum** + model org-guard (niżej) |
| D AI/Teresa | 🟢 | karta §1a (notatki AI LLM + regex-fallback) | **AI notes pipeline + transkrypt guard R3 + persistNote R3** (niżej) |
| E Integracje | 🟢 | karta §1g | **handoff M04 = DP-2** (niżej) |
| F Epiki | 🟢 | karta §7 (3 fale) | epiki→stories Gherkin→L-xx (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2/§7 | **liczby grep 2026-06-13 + korekta R3** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji + korekta R3** |

---

## A · INTENCJA *(link + uzupełnienie)*
- **Job-to-be-done:** prowadzić spotkania doradcze — lista/kalendarz, CRUD, statusy, decyzje i follow-upy, oraz generować notatki AI z transkryptu (summary/keyPoints/decisions/actionItems) i operator brief.
- **Persony/role:** członek org (CRUD spotkań w org), konsultant (notatki AI, brief). Auth na sztywno org-scope, **brak rozróżnienia ról** (L-04) i beta-gate na API (L-03).
- **Zakres v1:** lista+kalendarz/filtry/preview · CRUD spotkania (JSON attendees/preRead/agenda) · status scheduled/completed · decyzje (`decisions_json`) · follow-upy (`meeting_follow_ups` FK CASCADE) · notatki AI (LLM gpt-4o-mini `json_object` + uczciwy regex-fallback) · operator brief (czyta tasks/decisions read-only) · „otwórz jako dokument" (lokalny split-view). **POZA v1:** edytor agendy, kalendarz zewnętrzny, audio, realny handoff notatki→M04 (**D-01 = DP-2 globalny dok**).
- **Metryka:** spotkania/follow-upy trwałe po reload; notatki AI oznaczone `source:'ai'|'heuristic'`; 0 cross-org PII.

## B · UX DOCELOWE *(§27 zgodny — linkuj)*
- **§27 ZGODNY:** lista spotkań = `TableWithPreviewLayout`+`FilterableTable`+preview pane, `selectedRowId`, click→preview/dblclick→open, filtry statusu, kanon Menu 3 §9.2, `EntityStatusChip` (scheduled→info/completed→success). **Archive świadomie zaślepiony** (brak backendu) — D-02.
- **Wzorzec:** `ModuleHub` zgodny.
- **Stany ekranu (docelowo):** loading/error/empty OK; brak-uprawnień = 404 (org-scope). **Degradacja LLM transparentna — NAPRAWIONE** (`72d57e64a4`, `source:'ai'|'heuristic'` + amber Callout gdy heurystyka). Dark-mode/a11y: utrzymać tokeny (crimson naprawione `7cf315b4b9`).

## C · DANE + API + REGUŁY *(link + 9 EP enum + org-guard)*

### C.1 · Endpointy (9, `meeting.routes.ts`)
| # | Metoda + ścieżka | Funkcja | Org-guard |
|---|---|---|---|
| 1 | `GET /` (`:34`) | lista spotkań (org-scoped) | `listMeetings({orgId})` |
| 2 | `POST /` (`:48`) | create spotkanie | org z token |
| 3 | `PUT /:id` (`:84`) | update | `getMeeting({org,id})`→404 przed |
| 4 | `DELETE /:id` (`:113`) | delete | gatekeeper |
| 5 | `PATCH /:id/status` (`:127`) | scheduled/completed | gatekeeper |
| 6 | `POST /:id/decisions` (`:148`) | add decyzja → `decisions_json` | gatekeeper |
| 7 | `POST /:id/follow-ups` (`:165`) | add follow-up → `meeting_follow_ups` | gatekeeper |
| 8 | `PATCH /:meetingId/follow-ups/:followUpId` (`:183`) | toggle open/done | gatekeeper |
| 9 | `POST /:id/generate-notes` (`:213`) | notatki AI z transkryptu | `getMeeting({org,id})` przed |

### C.2 · Model + reguła org-scope
- **Wiring FE↔BE↔DB:** karta §1e. **Flagi:** karta §1f (`ProductionModuleGate` ukrywa na public-prod; **brak beta-gate na API** — L-03).
- **Model danych:** realne tabele `meetings`, `meeting_follow_ups` (FK CASCADE) — **bez fasady `new Map()` z M18**, przeżywają restart. Decyzje → `meetings.decisions_json`; action-items → `meeting_follow_ups` (NIE globalne `tasks`/`decisions`). Pułapki PG: testowane TYLKO sqlite → schema-drift PG niewykryty (L-05).
- **Reguła org-scope (kanon, czysty):** gatekeeper `getMeeting({organizationId, meetingId})`→404 PRZED każdą mutacją (`meetingService.ts:181`, `WHERE id=? AND organization_id=?`); PII transkryptów/notatek niedostępne cross-org.

## D · AI / TERESA *(pipeline + transkrypt guard R3 + persistNote R3)*

### D.1 · Pipeline notatek AI (`meetingIntelligenceService.ts`)
- **Wejście:** `generateMeetingNotes(input)` (`:90`) → `resolveLLMClient()` (`:64`, lazy-init OpenAI gdy `OPENAI_API_KEY`; bez klucza → `debug` + heurystyka).
- **LLM path:** `generateWithLLM` (`:105`) — gpt-4o-mini, `json_object`, parsuje summary/keyPoints/**decisions** (`:156` map decidedBy/rationale)/**actionItems** (`:161`); persyst → `persistNote` (`:172`).
- **Fallback:** `generateHeuristic` (`:183`) — regex na realnych zdaniach (`actionPatterns`), **NIE fabrykuje** (puste wejście→puste tablice).
- **Transparentność:** `source:'ai'|'heuristic'` + amber banner (NAPRAWIONE `72d57e64a4`).

### D.2 · KOREKTA R3 — transkrypt guard (L-02) jest CZĘŚCIOWO ZAMKNIĘTY
Karta/poprzednia teczka: „transkrypt bez limitu rozmiaru + surowy w delimiterach LLM → prompt-injection". Weryfikacja 2026-06-13 (`meetingIntelligenceService.ts:118`): prompt robi **`transcript.slice(0, 5000).replace(/<\/?transcript>/gi, '')`** — czyli **(a)** twardy limit 5000 znaków ORAZ **(b)** strip tagów `<transcript>`/`</transcript>` zapobiegający domknięciu delimitera i wyłamaniu się z bloku danych. To realna mitygacja injection. **Pozostaje:** transkrypt nadal wchodzi w blok promptu (nie jako osobny `role:'user'`/structured field), więc subtelniejsza injection sterująca treścią decisions/actionItems (które persystują) wciąż możliwa → L-02 zdegradować do **P3** (twardy delimiter-strip+limit jest, brak pełnej separacji dane↔instrukcje + review przed persystencją).

### D.3 · KOREKTA R3 — persistNote → `notebook_pages` (NIE `notebook_entries`)
Karta lokalizuje INSERT do `notebook_entries` (nieistniejąca) w `meeting.routes.ts:218`. Weryfikacja 2026-06-13: kod jest w **`meetingIntelligenceService.ts:222-228`** i INSERT idzie do **`notebook_pages`** (`id/owner_user_id/organization_id/title/content_text/visibility/content_json`) — tabela **ISTNIEJE** (mig.`20260306_notebook_pages.sql`). To **NIE dead-path do nieistniejącej tabeli.** Realny problem: błąd połknięty `.catch(logger.debug)` (`:228`) → przy rozjeździe schematu PG markdown cicho znika. **Status: [do cold-start proof]** — runtime-zweryfikować INSERT na PG (nie tylko sqlite) zanim opiszemy „dead-path". Decyzje/action-items idą osobną ścieżką (poz.6 działa niezależnie).

## E · INTEGRACJE
Karta §1g. **WEJŚCIE ←** M03 My Work (operator brief czyta tasks/decisions read-only, jednokierunkowo). **WYJŚCIE → (lokalny)** „otwórz jako dokument" = split-view tab w hubie (NIE handoff Canvas/Doc Studio — **D-01 = DP-2**). `persistNote` → `notebook_pages` (handoff do M04, patrz D.3/R3). *(Inwentarz przeszacował: action-items → `meeting_follow_ups`, decyzje → `decisions_json` — połączenia LOKALNE, nie globalne.)* **Wspólna warstwa (kręgosłup):** handoff `persistNote`/„otwórz jako dokument" = ten sam wzorzec „trzeciego panelu/IDE-tabs" co M04 (Uwagi #6/#7) i M13-D01 → **DP-2 globalny workspace-rail** rozstrzyga oba.

## F · EPIKI → STORIES → ZADANIA

**EPIK 1 — Integralność handoff (wspólne z M04, DP-2) [Fala 1]**
- Story 1.1: jako konsultant, gdy generuję notatki AI, markdown trafia do trwałego miejsca (lub kod znika z komunikatem).
  - Gherkin: dane spotkanie z transkryptem na **PG** (nie sqlite); gdy `POST /:id/generate-notes`; wtedy wiersz w `notebook_pages` istnieje po reload, ALBO jawny komunikat „zapis pominięty".
  - Zadania: [Z-01 → **L-01** cold-start proof INSERT `notebook_pages` na PG; jeśli OK → DP-2 realny handoff M04 lub świadomy lokalny; jeśli FAIL → naprawić/usunąć cichy catch]

**EPIK 2 — Bezpieczeństwo [Fala 1/2]**
- Story 2.1: transkrypt nie steruje persystowanymi rekordami. Gherkin: dane wrogi transkrypt z instrukcjami; gdy generate-notes; wtedy decisions/actionItems = treść spotkania, nie wstrzyknięte polecenia. Zadania: [Z-02 → **L-02 (R3: limit 5000+delimiter-strip JUŻ jest)** → dołożyć separację dane↔instrukcje + ew. review przed persystencją]
- Story 2.2: beta/role-gate na `/api/meeting`. Gherkin: dane user non-beta; gdy woła API; wtedy 403. Zadania: [Z-03 → L-03; Z-04 → L-04 role]

**EPIK 3 — Test prawdy [Fala 1]**
- Story 3.1: AI notes + brief pokryte. Gherkin: dane mock LLM; gdy S6/S7; wtedy ekstrakcja+persyst weryfikowana na PG. Zadania: [Z-05 → L-05 (S6 AI notes, S7 brief, test PG), Z-06 → L-07 fix mock i18next 3 FAIL]

**EPIK 4 — Kanony [Fala 3, DP]**
- Story 4.1: i18n `t()`. Zadania: [Z-07 → L-06 redukcja **79× `isPolish`**→`t()` (wzorzec M15=0×)]
- Story 4.2: archive rozstrzygnięty. Zadania: [Z-08 → **D-02**]; CI `Londyn`.

## G · JAKOŚĆ / DoD *(skwantyfikowane — grep 2026-06-13)*
| # | Kryterium | Miara M21 |
|---|-----------|-----------|
| 1 | Front↔back | `persistNote` zapisuje realnie do `notebook_pages` na **PG** (**runtime proof potrzebny**, tabela istnieje) lub kod znika z komunikatem; „otwórz jako dokument" spójne (DP-2); 0 martwych ścieżek |
| 2 | Bezpieczeństwo | beta/role-gate na `/api/meeting` (403); transkrypt: **limit 5000+delimiter-strip JUŻ jest** (R3) → dołożyć separację dane↔instrukcje; org-scope (już czysty) |
| 3 | i18n | **79 z 79** `isPolish` w `src/components/Meeting` (grep 2026-06-13 = **79**; karta podawała 78) → `t()` |
| 4 | Tokeny | **0 hex `#RRGGBB`** w `Meeting` (grep 2026-06-13 = 0); crimson NAPRAWIONE (`7cf315b4b9`) — bez akcji |
| 5 | §27 | **0** surowych `<table>` (grep = 0); lista zgodna (`TableWithPreviewLayout`) — utrzymać; archive rozstrzygnięty (D-02) |
| 6 | E2E w PR-gate | S6 (AI notes), S2 (CRUD trwałość) zielone na `Londyn`; test PG (nie tylko sqlite) |

Scenariusze S1–S8: karta §0/§2 (23 PASS/3 FAIL = FE mock-drift; **S6 notatki AI + S7 brief = ZERO testów**). Bezpieczeństwo: karta §6.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | 55/100; org-scope czysty; persistNote dead-path (wg karty `notebook_entries`); transkrypt injection; i18n hybryda | L-01..L-06 |
| W-02 | INV_E MEETING poz.1-8 | 2026-06-11 | 8/8 REALNE; karta lokalizuje INSERT mylnie | L-01 |
| W-03 | **MASTER §5** (handoff M04↔M21 razem) | 2026-06-13 | „otwórz jako dokument"/persistNote = ta sama półmartwa ścieżka co M04 | L-01 (D-01) |
| W-04 | **DP-2** (`_DECYZJE.md`) | 2026-06-13 | globalny dok IDE-tabs (in-context open) — zamyka M13-D01/M04/M21 handoff | L-01 → D-01 kierunek |
| W-05 | Feedback prod (kohorta beta) | — | brak własnej uwagi żywej M21 z 2026-06-13; #1 nie dotyka M21 bezpośrednio | — (dziedziczy z karty) |

*(M21 NIE figuruje w `UWAGI_TESTY_2026-06-13.md` — żadnej uwagi żywej. Uwagi #6/#7/#8 dotyczą M04 Notatnik, z którym M21 dzieli tylko handoff `persistNote`→`notebook_pages`.)*

### 02 · Stan obecny (prawda kodu) — **KOREKTA R3**
Moduł żywy (stan „coming soon"/„unmounted" z 06-02 NIEAKTUALNY). 8/8 REALNE na realnych tabelach, 9 endpointów. **KOREKTY R3 (zweryfikowane 2026-06-13):**
1. **persistNote (L-01)** → `notebook_pages` (tabela ISTNIEJE), NIE `notebook_entries`; kod w `meetingIntelligenceService.ts:222-228`, nie routes. NIE dead-path do nieistniejącej tabeli; realny problem = cichy `.catch` na PG → [do cold-start proof].
2. **transkrypt guard (L-02)** — `slice(0,5000)`+`replace(/<\/?transcript>/gi,'')` (`:118`) JUŻ obecne → injection częściowo mitygowane; zdegradować P2→P3.
Otwarte: beta/role-gate (L-03/04), testy S6/S7+PG (L-05), i18n 79× (L-06).

### 03 · Rejestr luk
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | **Status** | Zweryf. |
|----|------|---------|--------------------|-------|------|-----------|---------|
| L-01 | `persistNote` cichy catch (INSERT do `notebook_pages`) | W-01,W-02,W-03,W-04 | `meetingIntelligenceService.ts:222-228` | P2 | 3 | **[do cold-start proof na PG]** (NIE dead-path: tabela istnieje; karta nieścisła — był `notebook_entries`) | 2026-06-13 |
| L-02 | transkrypt prompt-injection (subtelna; limit+delimiter-strip JUŻ jest) | W-01 | `meetingIntelligenceService.ts:118` | **P3** (był P2) | 3 | **częściowo ZAMKNIĘTA R3** — dołożyć separację dane↔instrukcje | 2026-06-13 |
| L-03 | beta-gating tylko FE (`/api/meeting` auth-only) | W-01 | `meeting.routes.ts:26-27` | P2 | 3 | otwarta |  |
| L-04 | brak rozróżnienia uprawnień (auth org-scope, bez ról) | W-01 | `meeting.routes.ts` | P3 | 3 | otwarta |  |
| L-05 | S6 (AI notes) + S7 (brief) = ZERO testów; persyst. tylko sqlite | W-01 | `evidence/f2_tests_report.md` | P0-test | 1 | otwarta |  |
| L-06 | i18n hybryda 79× `isPolish` (grep) + 109× `t()` | W-01 | `Meeting/*` (grep 2026-06-13=79) | P2 | 4 | otwarta |  |
| L-07 | mock-drift i18next (3 FAIL `MeetingHub.smoke`) | W-01 | `LoadingState.tsx:36` `t(...,{defaultValue})` | P0-test | 1 | otwarta (fix 1-liniowy) |  |
| L-08 | degradacja LLM nietransparentna | W-01 | `MeetingNote.source` | P2 | — | **NAPRAWIONA `72d57e64a4`** | 2026-06-11 |
| L-09 | 3× crimson hardkod w przyciskach Teresa | W-01 | `MeetingHub` | P3 | — | **NAPRAWIONA `7cf315b4b9`** | 2026-06-11 |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | „otwórz jako dokument" + `persistNote` → M04 | realny handoff do Canvas/Doc Studio / świadomy lokalny split-view | Piotr (wspólnie z WP M04) | 2026-06-13 | **ROZSTRZYGNIĘTE → DP-2: globalny dok** (IDE-tabs, in-context notatka/dokument; egzekucja wspólna z M04) |
| D-02 | archive spotkań | wpiąć backend archive / zostawić świadomie zaślepione | Piotr | TBD | otwarta (modułowa) |

### 05 · Flagi / rollout — `ProductionModuleGate` (ukrycie na public-prod); poza public-prod w pełni dostępny; **brak beta/role-gate na `/api/meeting`** (L-03). Migracje `meetings`/`meeting_follow_ups`/`notebook_pages` — testowane TYLKO sqlite, sprawdzić schemat PG (ryzyko drift).
### 06 · Ryzyka — persystencja testowana tylko sqlite → schema-drift PG niewykryty (L-05); `persistNote` cichy catch maskuje ew. rozjazd schematu `notebook_pages` na PG; transkrypt injection subtelna persystuje realne rekordy (L-02, częściowo mitygowane); handoff M04 = DP-2 (egzekucja wspólna); dev `.env` → Railway PROD.
### 07 · Log — 2026-06-11: Fala 2 — `72d57e64a4` (LLM transparency), `7cf315b4b9` (tokeny crimson), 55/100. 2026-06-13 (teczka pogłębiona): 9 EP enum; R3 — persistNote → `notebook_pages` (tabela istnieje, NIE `notebook_entries`); **transkrypt guard L-02 częściowo ZAMKNIĘTY** (limit 5000+delimiter-strip w kodzie); D-01=DP-2. Re-ocena C po testach S6/S7+PG.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia (karta+INV_E+MASTER handoff+DP-2; brak uwagi żywej M21 — odnotowane) · R2 zero sierot · R3 statusy z dowodem (**L-01 [do cold-start proof]: `notebook_pages` istnieje, karta mylnie podawała `notebook_entries`; L-02 transkrypt guard częściowo ZAMKNIĘTY — korekta vs karta**; L-08/L-09 z commitami) · R4 DoD z liczbami (grep i18n=79, hex=0, `<table>`=0, 9 EP) · R5 **D-01 rozstrzygnięte (→DP-2, wspólnie z M04); D-02 modułowa** · A–E docelowy zlinkowany (D = pipeline AI notes + transkrypt guard + persistNote) · F epiki→stories Gherkin→L-xx · G DoD+S+sec · R6 sesja żywa = Faza 4 (handoff wspólny z M04, pozostaje). **9/9; teczka kompletna do egzekucji.**
