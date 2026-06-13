# WP M21 — Meeting (hub spotkań) · dokończenie do 100%

**Pula:** beta · **Karta:** `Harvard/modules/M21-meeting/KARTA_AUDYTU.md` (ocena 55/100 — górny Alpha) · **Rozmiar:** M (1–2 dni) · **Żywy bloker:** brak P0/P1
**Faza programu:** FAZA 3 (szlif; handoff WSPÓLNY z M04) → FAZA 4 (sweepy) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Moduł żywy i czysty — stan „coming soon"/„unmounted" z karty 06-02 NIEAKTUALNY: `MeetingHub` zamontowany (`AppRoutes.tsx:2019`), backend `/api/meeting` (`Gateway.ts:524`), 8/8 pozycji REALNE na realnych tabelach (`meetings`, `meeting_follow_ups` FK CASCADE — bez fasady `new Map()`, przeżywają restart). Notatki AI to realny pipeline: OpenAI gpt-4o-mini `json_object` parsujący summary/keyPoints/decisions/actionItems (`meetingIntelligenceService.ts:103-178`), z uczciwym regex-fallbackiem (operuje na realnej treści, NIE fabrykuje, puste wejście → puste tablice), decyzje/action-items persystują do realnych tabel; transparentność degradacji LLM NAPRAWIONA (`72d57e64a4` — `source:'ai'|'heuristic'` + amber banner). Bezpieczeństwo CZYSTE — kohorta czysta (M02/M25/M17/M18/M19): wszystkie endpointy `:meetingId`/`:followUpId` filtrują `organization_id` (gatekeeper `getMeeting`→404 przed mutacją, `meetingService.ts:181`), PII transkryptów niedostępne cross-org. **Sufit = niewykonane Fazy 3/4 + cienkie testy AI-notes.**

> **UWAGA — dead-path persistNote: karta nieścisła (weryfikacja 2026-06-13).** Karta lokalizuje INSERT w `meeting.routes.ts:218-237` do tabeli `notebook_entries`. Realnie: kod jest w `server/src/services/ai/meetingIntelligenceService.ts:222-228`, a INSERT idzie do `notebook_pages` (NIE `notebook_entries`). Tabela `notebook_pages` ISTNIEJE (migracja `20260306_notebook_pages.sql`). Czyli to NIE jest INSERT do nieistniejącej tabeli. Realny problem: błąd połknięty `.catch(logger.debug)` (`:228`) → jeśli schemat/kolumny się nie zgadzają, markdown cicho znika; trzeba **runtime-zweryfikować, czy INSERT faktycznie przechodzi** zanim opiszemy go jako „dead-path". Właściwe dane (decyzje/action-items) idą osobną ścieżką, więc poz.6 (notatki AI) działa niezależnie.

## 2. Luki do DoD

### (a) BACKEND / API — integralność + bezpieczeństwo (FAZA 3)
- **[P2] `persistNote` cichy catch — re-weryfikacja runtime.** `meetingIntelligenceService.ts:222-228` INSERT do `notebook_pages` z `.catch(debug)`. Akcja: sprawdzić na realnej DB, czy INSERT przechodzi (kolumny `id/owner_user_id/organization_id/title/content_text/visibility/content_json`). Jeśli przechodzi → to realny zapis, nie dead-path (skorygować kartę+INV_E). Jeśli nie → albo realny handoff do M04 (Notatnik), albo usunąć INSERT i poinformować użytkownika. **Decyzja wspólna z M04 (handoff).**
- **[P2] transkrypt bez guarda + prompt-injection** — brak limitu rozmiaru `rawTranscript`; surowy transkrypt w delimiterach LLM `"""..."""` (`meetingIntelligenceService.ts:114-117`) → wyłamanie i sterowanie wyodrębnianymi decyzjami/action-items, które **persystują jako realne rekordy**. Fix: limit rozmiaru + sanityzacja/oddzielenie (transkrypt jako dane, nie instrukcje); rozważyć review przed persystencją wyodrębnionych decyzji.
- **[P2] beta-gating tylko FE** — `/api/meeting` (`routes:26-27`) ma tylko `verifyToken+isAuthenticated`, mimo `MODULE_MEETING:'closed'`; każdy zalogowany user dowolnej org woła API (dane org-scoped → brak wycieku, ale obejście beta-locka). Fix: beta/role-gate serwerowo (non-beta → 403).
- **[P3]** brak rozróżnienia uprawnień (auth na sztywno org-scope, bez ról).

### (b) FRONTEND / UX — kanony (FAZA 3/4)
- **[P2] i18n hybryda** — 78× `isPolish` + 109× `t()` (treść dwujęzyczna, ale dług spójności gorszy niż M19 25×; wzorzec docelowy M15 = 0×). Fix: `t()` (sweep FAZA 4).
- **[§27]** lista spotkań ZGODNA (`TableWithPreviewLayout`+`FilterableTable`+preview, `EntityStatusChip`, kanon Menu 3 §9.2; archive świadomie zaślepiony — brak backendu). Bez akcji poza archive (decyzja: wpiąć backend archive lub zostawić świadomie).
- **[degradacja LLM — DONE]** `72d57e64a4`; **[tokeny crimson — DONE]** `7cf315b4b9` — bez akcji.

### (c) INTEGRACJA / TESTY E2E (FAZA 1/4)
- **[P0 testowy] S6 notatki AI = ZERO testów** (najgrubsza dziura) — `generateMeetingNotes` bez testu nawet z mockiem LLM. Dodać B2 (realna ekstrakcja `meetingIntelligenceService`) + B3 (route `/generate-notes` walidacja+persyst.).
- **[P0 testowy] mock-drift i18next** (3 FAIL `MeetingHub.smoke.test.tsx`) — `t('common.loading',{defaultValue})` → obiekt → „Objects are not valid as a React child" (`LoadingState.tsx:36`). Fix 1-liniowy.
- **[P1 testowy] S7 operator brief = ZERO testów** (B4); open-as-document+kalendarz (B5).
- **[P2 testowy]** persystencja testowana TYLKO sqlite, nie PG → ryzyko schema-drift niewykryte (B8). CI: `test-suite.yml` tylko `[main,develop]`; default `Londyn` → PR-gate ≈ 0, zero E2E meeting. Dodać `pull_request:[Londyn]` (sweep FAZA 4).

## 3. Kroki realizacji
1. **(FAZA 3, wspólne z M04)** `persistNote`: runtime-zweryfikować INSERT do `notebook_pages`. Jeśli przechodzi → skorygować kartę/INV_E (nie dead-path). Jeśli nie → realny handoff do M04 LUB usunąć INSERT + komunikat. **Decyzja handoff wspólna z WP M04** (ta sama ścieżka „otwórz jako dokument"/handoff).
2. **(FAZA 3)** Guard transkryptu — limit rozmiaru + sanityzacja injection; review przed persystencją wyodrębnionych decyzji.
3. **(FAZA 3)** Beta/role-gate na `/api/meeting` (non-beta → 403).
4. **(FAZA 1/4)** Fix mock i18next (3 FAIL) + testy S6/S7 (AI notes, brief); test PG (nie tylko sqlite).
5. **(FAZA 3)** Decyzja o „otwórz jako dokument" — realny handoff do Canvas/Doc Studio lub świadomy lokalny split-view (wspólne z M04).
6. **(FAZA 4)** i18n `t()` (redukcja 78× `isPolish`, wzorzec M15); archive backend lub świadome zaślepienie; CI `Londyn`.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** `persistNote` zapisuje realnie lub kod znika z komunikatem; „otwórz jako dokument" spójne z deklaracją; zero martwych ścieżek.
2. **Bezpieczeństwo:** beta/role-gate na `/api/meeting` (403); transkrypt z guardem + injection mitygowany; org-scope (czysty).
3. **i18n:** `t()` pełne (redukcja 78× `isPolish`).
4. **Tokeny:** Visual Standard (crimson już DONE `7cf315b4b9`).
5. **§27:** lista zgodna (utrzymać); archive rozstrzygnięty.
6. **E2E w PR-gate:** S6 (AI notes), S2 (CRUD trwałość) zielone na `Londyn`; test PG (nie tylko sqlite).

## 5. Weryfikacja
- `persistNote`: wklej transkrypt → wygeneruj notatki → sprawdź na realnej DB, czy wiersz w `notebook_pages` powstał (rozstrzyga dead-path vs realny zapis).
- prompt-injection: wrogi/duży transkrypt NIE steruje persystowanymi decyzjami (po guardzie).
- beta-gating: non-beta user wołający `/api/meeting` bezpośrednio → 403.
- S6: wklej transkrypt → notatki LLM (oznaczone `source:'ai'`); brak klucza/transkrypt ≤100 zn. → regex z amber banner `source:'heuristic'`.
- S2: CRUD spotkania → reload → trwałe (real DB).
- Migracje `meetings`/`meeting_follow_ups` na PG (uwaga: testowane tylko sqlite — sprawdzić schemat PG, ryzyko drift).
- Uwaga DB: dev `.env` może wskazywać Railway PROD.

## 6. Zależności
- **Handoff WSPÓLNY z M04 (Notatnik):** `persistNote` → Notebook i „otwórz jako dokument" to ta sama półmartwa ścieżka handoff co M04 (MASTER §5: „M04 handoff z M21 — naprawiać razem"). Decyzję projektową i implementację handoff prowadzić jednym frontem z WP M04.
- WEJŚCIE ← M03 My Work (operator brief czyta tasks/decisions read-only, jednokierunkowo).
- Inwentarz przeszacował: action-items → `meeting_follow_ups` (NIE globalne `tasks`), decyzje → `decisions_json` (NIE globalna `decisions`) — połączenia LOKALNE, nie globalne.
