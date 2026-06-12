# M21 — Meeting (hub spotkań) — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `d593a78fb9`) · **Audytor:** Claude + agenci (KOD/TESTY/KANON+SEC)
**Wejścia:** _MODULE_MAP_V2 wpis M21 · inwentarz `Harvard/podzial/inventory/INV_E_outputs_studia_meeting.md` (sekcja MEETING, poz.1-8) · poprzednia karta `docs/audit/2026-06-02/MODULE_13_meeting.md` (38/100 — stan „unmounted" NIEAKTUALNY)
**Evidence:** `Harvard/modules/M21-meeting/evidence/` (f1_code_truth.md, f2_tests_report.md, f2_tests.log, f56_kanon_sec.md)

## OCENA: 55/100 — Tier: Alpha górny · status 🟦 NIEPEŁNY (Fazy 3+4 do wykonania)
> **Fala 2 (pominięte w re-audycie 2026-06-11):** B: 12→13 (LLM transparency: `source:'ai'|'heuristic'` pole + amber banner w `MeetingHub` gdy heurystyka, commit `72d57e64a4`); E: 6→8 (degradacja LLM transparentna +1; 3× hardkod `#A51C30/#8a1828` → tokeny `bg-primary-600/hover:bg-primary-700` commit `7cf315b4b9` +1). Suma: 55.

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 21 | 8/8 REALNE (notatki AI realny LLM + uczciwy regex-fallback, persystowane), „coming soon" nieaktualne; poz.8 „otwórz jako dokument" lokalny (nie handoff). |
| B. Wiring i dane | 15 | 13 | Realne tabele (`meetings`, `meeting_follow_ups`), bez fasady; `source:'ai'|'heuristic'` NAPRAWIONE (`72d57e64a4`); minus: `persistNote` INSERT do nieistniejącej `notebook_entries` (dead-path, cichy catch). |
| C. Testy automatyczne | 15 | 6 | 23 PASS/3 FAIL (FE mock-drift, nie bugi), ale **S6 notatki AI i S7 brief = ZERO testów**, persystencja tylko sqlite (nie PG); nic w PR-gate. |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana. |
| E. Kanony/UI | 10 | 8 | §27 zgodny (`TableWithPreviewLayout`+`EntityStatusChip`+kanon Menu 3), ModuleHub; degradacja LLM NAPRAWIONA (`72d57e64a4`); tokeny kolorów NAPRAWIONE (`7cf315b4b9`); pozostaje i18n hybryda 78× `isPolish`. |
| F. Bezpieczeństwo/dostęp | 10 | 7 | **Org-scope CZYSTY** (PII transkryptów chronione, brak IDOR — kohorta czystych); P2: beta-gating tylko FE, transkrypt bez guarda + prompt-injection. |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana. |
| **Hard cap zastosowany?** | — | — | **Faza 4 niewykonana → max 70 + „NIEPEŁNY".** BRAK cap cross-org (org-scope czysty, zweryfikowane). Suma 52 < 70. |

**Werdykt jednym akapitem:** Moduł **żywy i czysty** — stan „coming soon"/„unmounted" z karty 2026-06-02 jest NIEAKTUALNY: `MeetingHub` zamontowany (`AppRoutes.tsx:2019`), backend `/api/meeting` (`Gateway.ts:524`), 8/8 pozycji REALNE na realnych tabelach (`meetings`, `meeting_follow_ups` z FK CASCADE — **bez fasady `new Map()` z M18**, przeżywają restart). Notatki AI z transkryptu to realny pipeline: OpenAI gpt-4o-mini z `json_object` parsujący summary/keyPoints/decisions/actionItems (`meetingIntelligenceService.ts:103-178`), z **uczciwym regex-fallbackiem** (operuje na rzeczywistej treści transkryptu, NIE fabrykuje fikcji, przy pustym wejściu zwraca puste tablice), a wyekstrahowane decyzje/action-items persystują do realnych tabel. **Bezpieczeństwo czyste — M21 dołącza do kohorty czystej** (M02/M25/M17/M18/M19): wszystkie endpointy z `:meetingId`/`:followUpId` filtrują `organization_id` (gatekeeper `getMeeting({organizationId,meetingId})`→404 przed każdą mutacją, `meetingService.ts:181` — zweryfikowane osobiście), PII transkryptów/notatek niedostępne cross-org. Długi (wszystkie P2/P3, brak P0/P1): **beta-gating tylko po stronie FE** (`/api/meeting` ma tylko `verifyToken+isAuthenticated`, mimo `MODULE_MEETING:'closed'` — każdy zalogowany user dowolnej org może wołać API, choć dane org-scoped); **transkrypt bez limitu rozmiaru + prompt-injection** (surowy `rawTranscript` w delimiterach LLM `:114-117` → wyłamanie i sterowanie wyodrębnianymi decyzjami, które persystują jako realne rekordy); **degradacja LLM nietransparentna** (gdy brak `OPENAI_API_KEY`/transkrypt ≤100 zn., cicho regex, ale FE zawsze „Notatki AI / Teresa" — user nie wie, że to heurystyka); `persistNote` INSERT do **nieistniejącej tabeli `notebook_entries`** (dead-path połknięty `.catch`); i18n hybryda (78× `isPolish` + 109× `t()` — gorszy dług niż M19). Sufit oceny: niewykonane Fazy 3+4 + cienkie testy najbardziej złożonej funkcji (AI notes).

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)
**Checklist:** INV_E sekcja MEETING, poz.1-8.
**Scenariusze krytyczne (8):**
1. **S1** — Lista + kalendarz/filtry/preview.
2. **S2** — CRUD spotkania → trwałość.
3. **S3** — Status scheduled/completed.
4. **S4** — Decyzje spotkania.
5. **S5** — Follow-upy + toggle open/done.
6. **S6** — Notatki AI z transkryptu (ekstrakcja + persystencja).
7. **S7** — Operator brief.
8. **S8** — Otwarcie spotkania jako dokument.
**Obowiązujące kanony:** §27 — **TAK** (lista spotkań) · CARD_CONTENT_FORMULA: **N/D** · wzorzec: **ModuleHub** · gating: `ProductionModuleGate` (ukrycie na public-prod; brak flagi beta).

## 1. Prawda kodu (FAZA 1)
> Raport: `evidence/f1_code_truth.md`. Werdykty: **REALNE 8 · 1 dead-path side-effect (persistNote).**

### 1a. REALNE (zweryfikowane)
- Lista+kalendarz (`listMeetings`, org-scoped), CRUD (INSERT/UPDATE/DELETE, JSON kolumny attendees/preRead/agenda), status, decyzje (`decisions_json`), follow-upy (tabela `meeting_follow_ups` FK CASCADE), notatki AI (LLM `:103-178` + regex-fallback `:180-216`, persystowane `:253-275`), operator brief (czyta tasks/decisions cross-module read-only), otwarcie jako dokument (lokalny split-view).

### 1b. MOCK / STUB
- Brak fabrykacji; regex-fallback uczciwy (puste przy pustym wejściu).

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE
- **[P2] `persistNote` dead-path** — INSERT markdown do **nieistniejącej tabeli `notebook_entries`** (`meeting.routes.ts:218-237`), błąd połknięty `.catch(debug)` → markdown notatki nigdy nie trafia do Notebooka. Właściwe dane (decyzje/action) idą osobno, więc poz.6 działa.
- **[P2] degradacja LLM nietransparentna** — cichy regex bez `source` w odpowiedzi; FE zawsze „Notatki AI / Teresa".

### 1d. UKRYTE / MARTWY KOD
- Brak istotnego; braki funkcjonalne (edytor agendy, kalendarz zewn., audio) — zadeklarowane, nie bugi.

### 1e. Wiring FE↔BE↔DB
| Funkcja | Endpoint/serwis | Tabela DB | Status |
|---|---|---|---|
| CRUD/lista/status | `/api/meeting` (`meetingService`) | meetings | DZIAŁA (org-scoped) |
| Follow-upy | `addMeetingFollowUp`/toggle | meeting_follow_ups | DZIAŁA (FK CASCADE) |
| Decyzje | `addMeetingDecision` | meetings.decisions_json | DZIAŁA |
| Notatki AI | `meetingIntelligenceService` + `/generate-notes` | persyst. do decisions/follow-ups | DZIAŁA (LLM+fallback) |
| persistNote markdown | `persistNote:218` | **notebook_entries (NIE ISTNIEJE)** | **dead-path** |

### 1f. Flagi
| Flaga | Default | Wpływ |
|---|---|---|
| `ProductionModuleGate` | ukrywa na public-prod | poza public-prod w pełni dostępny; **brak beta-gate na API** |

### 1g. Połączenia międzymodułowe
| Kierunek | Moduł | Mechanizm | Status |
|---|---|---|---|
| WEJŚCIE ← | M03 My Work | brief czyta tasks/decisions (read-only) | DZIAŁA (jednokierunkowo) |
| (inwentarz przeszacował) | M03 | action items → meeting_follow_ups (NIE globalne `tasks`); decyzje → `decisions_json` (NIE globalna `decisions`) | LOKALNE |
| WYJŚCIE → | (lokalny) | „otwórz jako dokument" = split-view tab w hubie (NIE handoff Canvas/Doc Studio) | DZIAŁA lokalnie |

## 2. Testy automatyczne (FAZA 2)
> Raport: `evidence/f2_tests_report.md` · log: `f2_tests.log`.
**Uruchomienie (lokalnie @ `d593a78fb9`):** **23 PASS / 3 FAIL / 0 SKIP.**
| Plik | PASS | FAIL |
|---|---|---|
| `meeting.routes.test.ts` | 12 | 0 |
| `meetingService.test.ts` (realny sqlite `:memory:`) | 11 | 0 |
| `MeetingHub.smoke.test.tsx` | 0 | 3 |
**Root-cause 3 FAIL (FE, fałszywy czerwony):** mock-drift i18next — mock `t:(_k,fallback)=>fallback` zakłada string, ale `LoadingState.tsx:36` woła `t('common.loading',{defaultValue})` → obiekt → „Objects are not valid as a React child". Fix 1-liniowy.
**Pokrycie scenariuszy:**
| Scenariusz | FE | BE | E2E | PR-gate | Luka |
|---|---|---|---|---|---|
| S1 lista+kalendarz | smoke FAIL/mock | `listMeetings` ✓ | ✗ | ✗ | kalendarz 0 |
| S2 CRUD→trwałość | smoke FAIL | routes ✓ + service sqlite ✓ | ✗ | ✗ | — |
| S3 status / S4 decyzje / S5 follow-up | — | routes+service ✓ | ✗ | ✗ | FE brak |
| S6 notatki AI | ✗ | **ZERO** | ✗ | ✗ | **najgrubsza dziura** |
| S7 operator brief | mock null | **ZERO** | ✗ | ✗ | brak |
| S8 otwórz jako dokument | ✗ | n/d | ✗ | ✗ | brak asercji |

**Pułapki:** S6 (generateMeetingNotes) ZERO testów — nawet z mockiem LLM; persystencja tylko sqlite (nie PG → ryzyko schema-drift niewykryte); FE smoke mockuje `@/services/api` → fałszywa zieleń. **CI:** `test-suite.yml` tylko `[main,develop]`; default `Londyn` → PR-gate ≈ 0; zero E2E meeting.
**Backlog testowy:** [P0] B1 fix mock i18next (3 FAIL), B2 test `meetingIntelligenceService` realna ekstrakcja (S6), B3 route `/generate-notes` (walidacja+persyst.); [P1] B4 brief (S7), B5 open-as-document+kalendarz; [P2] B7 E2E trwałość, B8 PG vs sqlite, B9 PR-gate.

## 3. Środowiska / Railway (FAZA 3)
**Status: NIEWYKONANE (PENDING).** Smoke: CRUD spotkania, generate-notes (LLM+fallback), brief. Migracje `meetings`/`meeting_follow_ups` (uwaga: tylko sqlite testowane — **sprawdzić schemat na PG, ryzyko drift**); brak tabeli `notebook_entries` (persistNote dead-path). **Uwaga DB:** dev `.env` może wskazywać Railway PROD.
| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit / migracje / flagi / smoke / logi | — | — | PENDING |

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)
**Status: NIEWYKONANE (PENDING).** 8 scenariuszy; szczególnie: S6 wklej transkrypt → notatki (czy LLM realny, czy oznaczone gdy fallback), S2 CRUD→reload trwałość, prompt-injection w transkrypcie (czy steruje persystowanymi decyzjami), beta-gating (czy non-beta omija przez API).
| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1–S8 | — | PENDING | evidence/f4_* |

## 5. Kanony i standardy (FAZA 5)
> Raport: `evidence/f56_kanon_sec.md`.
**§27 (lista spotkań):** ZGODNE — `TableWithPreviewLayout`+`FilterableTable`+preview pane, `selectedRowId`, click→preview/dblclick→open, filtry statusu, kanon Menu 3 z komentarzami §9.2 (archive świadomie zaślepiony — brak backendu). Decyzje/follow-upy żyją w preview → §27 dla nich n.d.
**Wzorzec hubowy:** `ModuleHub` zgodny; `EntityStatusChip` kanoniczny (scheduled→info/completed→success).
**i18n:** **[P2] hybryda** — 78× `isPolish` + 109× `t()` (treść dwujęzyczna, ale dług spójności gorszy niż M19 25×; wzorzec docelowy M15 = 0×).
**Stany:** loading/error/empty OK; **[P2] degradacja LLM nietransparentna** (user nie wie, że „notatki AI" to regex).
**UI:** **[P3]** 3× hardkod `#A51C30` (HBS crimson) w przyciskach Teresa.
**CARD_CONTENT_FORMULA:** N/D.

## 6. Bezpieczeństwo i dostęp (FAZA 6)
> Raport: `evidence/f56_kanon_sec.md`. **CZYSTE — brak P0/P1, brak IDOR.**
| Warstwa | Stan | Dowód |
|---|---|---|
| Org-scope (wszystkie by-id) | CZYSTY | `meetingService.ts:181` (`WHERE id=? AND organization_id=?`), gatekeeper `getMeeting` przed mutacjami |
| PII transkryptów/notatek | chronione | `generate-notes` → `getMeeting({org,meetingId})` przed (`routes:225`); cudzy meetingId → 404 |
| API gating | tylko auth | `/api/meeting` `verifyToken+isAuthenticated`, brak beta/role-gate |

**Findingi (0× P0/P1):**
- **[P2] SEC-1 beta-gating tylko FE** — `/api/meeting` (`routes:26-27`) brak gate'u modułu/roli mimo `MODULE_MEETING:'closed'`; każdy zalogowany user (dowolna org) woła API (dane org-scoped → brak wycieku, ale obejście beta-locka).
- **[P2] SEC-3 transkrypt bez guarda + prompt-injection** — brak limitu rozmiaru (`routes:220-223`; cały `rawTranscript` do `notebook_entries`); transkrypt wstrzykiwany surowo w delimitery `"""..."""` (`meetingIntelligenceService.ts:114-117`) → injection sterujący wyodrębnianymi decyzjami/action-items, które **persystują jako realne rekordy**.
- **[P3]** brak weryfikacji roli (auth na sztywno org-scope, ale brak rozróżnienia uprawnień).

**OK/czyste:** org-scope wszystkich endpointów (kohorta czystych); PII transkryptów niedostępne cross-org; cross-module write (notebook/decisions/follow-ups) org-scoped; sekrety/PII w logach — transkrypt NIGDZIE nie logowany (0 trafień).

## 7. PLAN DOKOŃCZENIA (FAZA 8)
### Fala 1 — Integralność (P2 — brak P0/P1)
1. **`[INTEGRACJA — INTEGRACJE.md §C poz.2 / Sprint 4 / W6]`** Naprawa `persistNote` dead-path — `meeting.routes.ts:218-237` wykonuje INSERT do nieistniejącej tabeli `notebook_entries`. Albo utworzyć realny handoff do M04 (Notatnik), albo usunąć martwy INSERT i poinformować użytkownika — Weryfikacja: markdown notatki trafia do trwałego miejsca lub kod znika.
2. **Guard transkryptu** — limit rozmiaru + sanityzacja/oddzielenie injection (transkrypt jako dane, nie instrukcje); rozważyć review przed persystencją wyodrębnionych decyzji — Weryfikacja: duży/wrogi transkrypt nie steruje persystowanymi rekordami.
3. **Fix mock i18next** (3 FAIL) + testy S6/S7 (AI notes, brief) — Weryfikacja: zielone, pokrywają ekstrakcję.

### Fala 2 — Domknięcie wartości (P2)
1. **Beta/role-gate na `/api/meeting`** (nie tylko FE) — Weryfikacja: non-beta/non-uprawniony → 403.
2. ~~**Transparentność degradacji LLM**~~ — **DONE** (`72d57e64a4`) — `source:'ai'|'heuristic'` w `MeetingNote`, amber Callout w `MeetingHub` gdy heurystyka.
3. **Decyzja o „otwórz jako dokument"** — realny handoff do Canvas/Doc Studio lub zostawić lokalny split-view świadomie — Weryfikacja: spójność z deklaracją.

### Fala 3 — Jakość i kanony (P2/P3)
1. **i18n** — zredukować 78× `isPolish` → `t()` (wzorzec M15) — Weryfikacja: spójny i18n.
2. ~~**Tokeny kolorów** (3× crimson hardkod)~~ — **DONE** (`7cf315b4b9`) — `bg-primary-600/hover:bg-primary-700`.
3. **CI** — `Londyn` w PR-gate + test PG (nie tylko sqlite) — Weryfikacja: biegnie na PR, wykrywa schema-drift.

### Definition of Done (odhaczane przy realizacji)
- [ ] 1. Testy auto FE+BE scenariuszy krytycznych (zwł. S6 AI notes, S2 trwałość) zielone w CI
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami
- [ ] 3. Railway: migracje (PG, nie tylko sqlite) + smoke 200 + czyste logi
- [ ] 4. Kanony: i18n, transparentność degradacji LLM
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE (persistNote dead-path)
- [ ] 6. Transkrypt guard + injection mitygacja

---
**Pozostałe do domknięcia audytu M21:** Faza 3 (Railway — zwł. schemat PG, bo testowany tylko sqlite) + Faza 4 (żywe 8 scenariuszy). **Brak blockera bezpieczeństwa** (org-scope czysty, PII chronione — kohorta czysta). Główne długi: cienkie testy AI-notes, transkrypt input guard + prompt-injection, i18n hybryda. Karta 2026-06-02 „unmounted" NIEAKTUALNA — moduł żywy. Po Fazach 3/4 + naprawie P2 realnie Beta.
