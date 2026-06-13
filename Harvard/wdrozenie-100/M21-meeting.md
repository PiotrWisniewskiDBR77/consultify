# TECZKA M21 — Meeting (hub spotkań)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje kartę audytu + INV_E + kod i dokłada brakujące ogniwa (Rejestr Wejść z uwagami żywymi · Rejestr Decyzji · DoD z liczbami · korekta staleności R3). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md), referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M21 Meeting (hub spotkań) · **Pula:** beta · **handoff WSPÓLNY z M04 Notatnik**
- **Ocena audytu:** 55/100 · **Tier:** Alpha górny · **Status:** FAZA 3 → FAZA 4 · **Rozmiar:** M (1–2 dni)
- **Żywy bloker:** brak P0/P1 (org-scope czysty — kohorta czystych)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M21-meeting/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md` · **INV_E:** `…/INV_E_outputs_studia_meeting.md` (MEETING poz.1-8)
- **Kod:** `src/components/Meeting/` (MeetingHub) · `server/src/routes/meeting.routes.ts` · `server/src/services/meetingService.ts` · `server/src/services/ai/meetingIntelligenceService.ts` · tabele `meetings`, `meeting_follow_ups`, `notebook_pages` (mig.`20260306_notebook_pages.sql`)

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta §0 + INV_E MEETING | job-to-be-done + zakres |
| B UX docelowe | 🟢 | karta §5 (**§27 zgodny** + ModuleHub) | link + archive (D-02) |
| C Dane+API+reguły | 🟢 | karta §1e/§1f + `meetingService.ts` | model org-guard (niżej) |
| D AI/Teresa | 🟢 | karta §1a (notatki AI LLM + regex-fallback) | persistNote (niżej, R3) |
| E Integracje | 🟢 | karta §1g | handoff M04 (D-01) |
| F Epiki | 🟢 | karta §7 (3 fale) | epiki (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2/§7 | **liczby grep 2026-06-13** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji + korekta R3** |

---

## A · INTENCJA *(link + uzupełnienie)*
- **Job-to-be-done:** prowadzić spotkania doradcze — lista/kalendarz, CRUD, statusy, decyzje i follow-upy, oraz generować notatki AI z transkryptu (summary/keyPoints/decisions/actionItems) i operator brief.
- **Persony/role:** członek org (CRUD spotkań w org), konsultant (notatki AI, brief). Auth na sztywno org-scope, **brak rozróżnienia ról** (L-04) i beta-gate na API (L-03).
- **Zakres v1:** lista+kalendarz/filtry/preview · CRUD spotkania (JSON attendees/preRead/agenda) · status scheduled/completed · decyzje (`decisions_json`) · follow-upy (`meeting_follow_ups` FK CASCADE) · notatki AI (LLM gpt-4o-mini `json_object` + uczciwy regex-fallback) · operator brief (czyta tasks/decisions read-only) · „otwórz jako dokument" (lokalny split-view). **POZA v1:** edytor agendy, kalendarz zewnętrzny, audio, realny handoff notatki→M04 (D-01).
- **Metryka:** spotkania/follow-upy trwałe po reload; notatki AI oznaczone `source:'ai'|'heuristic'`; 0 cross-org PII.

## B · UX DOCELOWE *(§27 zgodny — linkuj)*
- **§27 ZGODNY:** lista spotkań = `TableWithPreviewLayout`+`FilterableTable`+preview pane, `selectedRowId`, click→preview/dblclick→open, filtry statusu, kanon Menu 3 §9.2, `EntityStatusChip` (scheduled→info/completed→success). **Archive świadomie zaślepiony** (brak backendu) — D-02.
- **Wzorzec:** `ModuleHub` zgodny.
- **Stany:** loading/error/empty OK; **degradacja LLM transparentna — NAPRAWIONE** (`72d57e64a4`, `source:'ai'|'heuristic'` + amber Callout).

## C · DANE + API + REGUŁY *(link + org-guard)*
- **Wiring FE↔BE↔DB:** karta §1e. **Flagi:** karta §1f (`ProductionModuleGate` ukrywa na public-prod; **brak beta-gate na API** — L-03).
- **Model danych:** realne tabele `meetings`, `meeting_follow_ups` (FK CASCADE) — **bez fasady `new Map()` z M18**, przeżywają restart. Decyzje → `meetings.decisions_json`; action-items → `meeting_follow_ups` (NIE globalne `tasks`/`decisions`).
- **Reguła org-scope (kanon, czysty):** gatekeeper `getMeeting({organizationId, meetingId})`→404 PRZED każdą mutacją (`meetingService.ts:181`, `WHERE id=? AND organization_id=?`); PII transkryptów/notatek niedostępne cross-org.

## D · AI / TERESA *(link + persistNote R3)*
- **Co generuje:** notatki AI z transkryptu — OpenAI gpt-4o-mini `json_object` parsujący summary/keyPoints/decisions/actionItems (`meetingIntelligenceService.ts:103-178`), z **uczciwym regex-fallbackiem** (operuje na realnej treści, NIE fabrykuje, puste wejście→puste tablice). Decyzje/action-items persystują do realnych tabel.
- **Transparentność:** `source:'ai'|'heuristic'` + amber banner (NAPRAWIONE `72d57e64a4`).
- **L-02 transkrypt bez guarda + prompt-injection:** brak limitu rozmiaru `rawTranscript`; surowy transkrypt w delimiterach LLM `"""..."""` (`:114-117`) → wyłamanie sterujące wyodrębnianymi decyzjami, które persystują jako realne rekordy. Fix: limit + sanityzacja (transkrypt jako dane, nie instrukcje) + ew. review przed persystencją.

## E · INTEGRACJE
Karta §1g. **WEJŚCIE ←** M03 My Work (operator brief czyta tasks/decisions read-only, jednokierunkowo). **WYJŚCIE → (lokalny)** „otwórz jako dokument" = split-view tab w hubie (NIE handoff Canvas/Doc Studio — D-01). `persistNote` → `notebook_pages` (handoff do M04, patrz R3). *(Inwentarz przeszacował: action-items → `meeting_follow_ups`, decyzje → `decisions_json` — połączenia LOKALNE, nie globalne.)*

## F · EPIKI *(z karty §7, forma epików)*
- **EPIK 1 — Integralność (wspólne z M04):** `persistNote` → runtime-zweryfikować INSERT do `notebook_pages` (L-01, R3); jeśli przechodzi → realny handoff M04 lub świadomy lokalny; jeśli nie → naprawić/usunąć (D-01). [Fala 1]
- **EPIK 2 — Bezpieczeństwo:** guard transkryptu + injection mitygacja (L-02); beta/role-gate na `/api/meeting` (L-03). [Fala 1/2]
- **EPIK 3 — Test prawdy:** fix mock i18next (3 FAIL); testy S6 (AI notes) + S7 (brief); test PG (nie tylko sqlite) (L-05). [Fala 1]
- **EPIK 4 — Kanony:** i18n `t()` redukcja 78× `isPolish` (L-06); archive backend lub świadome zaślepienie (D-02); CI `Londyn`. [Fala 3]

## G · JAKOŚĆ / DoD *(skwantyfikowane — grep 2026-06-13)*
| # | Kryterium | Miara M21 |
|---|-----------|-----------|
| 1 | Front↔back | `persistNote` zapisuje realnie do `notebook_pages` (**tabela istnieje — runtime proof potrzebny**) lub kod znika z komunikatem; „otwórz jako dokument" spójne; 0 martwych ścieżek |
| 2 | Bezpieczeństwo | beta/role-gate na `/api/meeting` (403); transkrypt z guardem + injection mitygowany; org-scope (już czysty) |
| 3 | i18n | **79 z 79** `isPolish` w `src/components/Meeting` (grep 2026-06-13 = **79**; karta podawała 78× + 109× `t()`) → `t()` (wzorzec M15=0×) |
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
| W-04 | Feedback prod (kohorta beta) | — | brak własnej uwagi żywej M21 z 2026-06-13; #1 nie dotyka M21 bezpośrednio | — (dziedziczy z karty) |

*(M21 NIE figuruje w `UWAGI_TESTY_2026-06-13.md` — żadnej uwagi żywej. Uwagi #6/#7/#8 dotyczą M04 Notatnik, z którym M21 dzieli tylko handoff `persistNote`→`notebook_pages`.)*

### 02 · Stan obecny (prawda kodu) — **KOREKTA R3**
Moduł żywy (stan „coming soon"/„unmounted" z 06-02 NIEAKTUALNY). 8/8 REALNE na realnych tabelach. **KOREKTA R3 (zweryfikowane 2026-06-13):** karta lokalizuje INSERT w `meeting.routes.ts:218-237` do tabeli `notebook_entries` — **nieścisłe na dwa sposoby:** (1) kod jest w `meetingIntelligenceService.ts:222-228`, nie w routes; (2) INSERT idzie do **`notebook_pages`** (NIE `notebook_entries`), a tabela `notebook_pages` ISTNIEJE (mig.`20260306_notebook_pages.sql`, kolumny `id/owner_user_id/organization_id/title/content_text/visibility/content_json`). Czyli to **NIE jest INSERT do nieistniejącej tabeli.** Realny problem zostaje: błąd połknięty `.catch(logger.debug)` (`:228`) → jeśli schemat się rozjedzie, markdown cicho znika. **Status: [do cold-start proof]** — runtime-zweryfikować, czy INSERT faktycznie przechodzi, zanim opiszemy „dead-path". Właściwe dane (decyzje/action-items) idą osobną ścieżką → poz.6 działa niezależnie.

### 03 · Rejestr luk
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | **Status** | Zweryf. |
|----|------|---------|--------------------|-------|------|-----------|---------|
| L-01 | `persistNote` cichy catch (INSERT do `notebook_pages`) | W-01,W-02,W-03 | `meetingIntelligenceService.ts:222-228` | P2 | 3 | **[do cold-start proof]** (NIE dead-path: tabela istnieje; karta nieścisła — był `notebook_entries`) | 2026-06-13 |
| L-02 | transkrypt bez guarda + prompt-injection (persystuje rekordy) | W-01 | `meetingIntelligenceService.ts:114-117` | P2 | 3 | otwarta |  |
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
| D-01 | „otwórz jako dokument" + `persistNote` → M04 | realny handoff do Canvas/Doc Studio / świadomy lokalny split-view | Piotr (wspólnie z WP M04) | TBD | otwarta |
| D-02 | archive spotkań | wpiąć backend archive / zostawić świadomie zaślepione | Piotr | TBD | otwarta |

### 05 · Flagi / rollout — `ProductionModuleGate` (ukrycie na public-prod); poza public-prod w pełni dostępny; **brak beta/role-gate na `/api/meeting`** (L-03). Migracje `meetings`/`meeting_follow_ups`/`notebook_pages` — testowane TYLKO sqlite, sprawdzić schemat PG (ryzyko drift).
### 06 · Ryzyka — persystencja testowana tylko sqlite → schema-drift PG niewykryty (L-05/B8); `persistNote` cichy catch maskuje ew. rozjazd schematu `notebook_pages` na PG; transkrypt injection persystuje realne rekordy (L-02); handoff M04 wymaga decyzji wspólnej (D-01); dev `.env` → Railway PROD.
### 07 · Log — 2026-06-11: Fala 2 — `72d57e64a4` (LLM transparency), `7cf315b4b9` (tokeny crimson), 55/100. 2026-06-13 (teczka): R3 — persistNote → `notebook_pages` (tabela istnieje, NIE `notebook_entries`); karta nieścisła skorygowana; status [do cold-start proof]. Re-ocena C po testach S6/S7+PG.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia (karta+INV_E+MASTER handoff; brak uwagi żywej M21 — odnotowane) · R2 zero sierot · R3 statusy z dowodem (**L-01 [do cold-start proof]: `notebook_pages` istnieje, karta mylnie podawała `notebook_entries`**; L-08/L-09 z commitami) · R4 DoD z liczbami (grep i18n=79, hex=0, `<table>`=0) · R5 decyzje z właścicielem (D-01 wspólnie z M04) · A–E docelowy zlinkowany · F epiki↔luki · G DoD+S+sec · R6 sesja żywa = Faza 4 (handoff wspólny z M04). **Teczka kompletna do egzekucji.**
