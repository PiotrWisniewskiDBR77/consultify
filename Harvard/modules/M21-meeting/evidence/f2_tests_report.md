# M21 — Meeting — FAZA 2: TESTY (raport agenta TESTY)

Data: 2026-06-11 · Branch: feat/deliverables-light · Repo root: `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify`
Log uruchomień: `Harvard/modules/M21-meeting/evidence/f2_tests.log`

## Wynik zbiorczy

| | PASS | FAIL | SKIP | Czas |
|---|---|---|---|---|
| `server/.../meeting.routes.test.ts` | 12 | 0 | 0 | — |
| `server/.../meetingService.test.ts` | 11 | 0 | 0 | — |
| (razem server, 2 pliki) | 23 | 0 | 0 | ~513 ms |
| `src/components/Meeting/__tests__/MeetingHub.smoke.test.tsx` | 0 | **3** | 0 | ~1,76 s |
| **RAZEM** | **23** | **3** | **0** | — |

---

## 1. Inwentarz testów meeting

Dedykowanych plików testowych: **3** (2 backend + 1 frontend). Brak osobnego E2E meeting (`tests/e2e` — 0 plików meeting), brak testów dla `meetingIntelligenceService` i `aiOperatorService.getMeetingBrief`.

### A. `server/src/routes/__tests__/meeting.routes.test.ts` — 12 testów
Czego dotyczy: warstwa HTTP `/api/meeting` (Express + supertest). **Cały meetingService jest zamockowany** (`vi.mock('../../services/meetingService.js')`), auth middleware zamockowany (wstrzykuje `user-1` / `org-1`). Testy weryfikują tylko routing, walidację wejścia i kody statusu — NIE dotykają DB ani logiki serwisu.
- GET `/` lista (scoping org), POST `/` create (+ odrzucenie braku title), PUT `/:id` (update, pusty title → 400, brak → 404), DELETE `/:id` (+ 404), PATCH `/:id/status` (walidacja + update), POST `/:id/decisions`, POST `/:id/follow-ups`.

### B. `server/src/services/__tests__/meetingService.test.ts` — 11 testów
Czego dotyczy: **integracja z prawdziwą bazą sqlite3 `:memory:`** — mockowany jest tylko `DbPromise.js`, SQL serwisu wykonuje się realnie. To najsilniejszy plik: realna persystencja i mapowanie JSON-arrays.
- create+read (mapowanie attendees/agenda, status `scheduled`), scoping org przy read, list, update (zachowanie nietkniętych pól), update zły org → null, update bez pól → istniejący rekord, delete + kaskada follow-ups, delete zły org → false, toggle status, append decisions, add+toggle follow-up status.

### C. `src/components/Meeting/__tests__/MeetingHub.smoke.test.tsx` — 3 testy (FAIL)
Czego dotyczy: smoke React hub. **Mockuje `react-i18next`, `react-router-dom`, `@/services/api`** (`getMeetings`, `getAIOperatorMeetingBrief`). Brak realnego fetch i DB.
- render listy z API, empty state, otwarcie modala „New meeting”.

---

## 2. Root-cause FAIL (3/3 FE)

**Mock-drift i18next (fałszywy czerwony — błąd testu, nie produktu).**

Błąd runtime: `Objects are not valid as a React child (found: object with keys {defaultValue})`.

Mock w teście:
```ts
t: (_k: string, fallback?: string) => fallback ?? _k
```
zakłada, że 2. argument `t` to **string**. Ale współdzielone prymitywy renderowane przez MeetingHub wołają `t` z **obiektem opcji**:
- `src/components/ui/primitives/LoadingState.tsx:36` → `t('common.loading', { defaultValue: 'Loading…' })`
- `src/components/ui/primitives/ErrorState.tsx:34,51` → `t('common.errorTitle', { defaultValue: '…' })` itp.

MeetingHub renderuje `<LoadingState/>` na czas ładowania (`MeetingHub.tsx:633`). Mock zwraca wtedy obiekt `{ defaultValue: 'Loading…' }`, React nie potrafi go wyrenderować → crash następuje, zanim spotkania w ogóle się zaciągną. Realny i18next zwróciłby string `'Loading…'`, więc produkt jest sprawny — to defekt mocka testowego.

**Fix (1 linia w teście):**
```ts
t: (k: string, opt?: any) => (typeof opt === 'string' ? opt : opt?.defaultValue ?? k),
```

---

## 3. Mapa pokrycia S1–S8

| Scenariusz | FE | BE | E2E | PR-gate? |
|---|---|---|---|---|
| S1 lista + kalendarz | smoke lista (FAIL/mock); **kalendarz=0** | listMeetings ✅ | ❌ | ❌ |
| S2 CRUD → trwałość | smoke (FAIL/mock, bez DB) | routes ✅ + service na realnym sqlite ✅ | ❌ | ❌ |
| S3 status scheduled/completed | ❌ | routes (walidacja+update) ✅ + service toggle ✅ | ❌ | ❌ |
| S4 decyzje spotkania | ❌ | routes append ✅ + service append ✅ | ❌ | ❌ |
| S5 follow-upy toggle | render follow-up w smoke (FAIL/mock) | routes add+walidacja ✅ + service add+toggle ✅ | ❌ | ❌ |
| S6 notatki AI z transkryptu (ekstrakcja+persyst.) | ❌ | **❌ ZERO** (route `/:id/generate-notes` + `meetingIntelligenceService.generateMeetingNotes` nietestowane) | ❌ | ❌ |
| S7 operator brief | mock `getAIOperatorMeetingBrief` zwraca null (smoke, nic nie asertuje) | **❌ ZERO** (`aiOperatorService.getMeetingBrief` nietestowany) | ❌ | ❌ |
| S8 otwarcie jako dokument | ❌ (brak asercji; `useModuleOpenDocuments` nietestowany w meeting) | n/d | ❌ | ❌ |

**PR-gate:** żaden z 3 plików nie jest w bramce PR. `test-suite.yml` odpala się tylko na `main`/`develop`; default branch repo = **Londyn**, branch roboczy = `feat/deliverables-light`. Czyli na realnych PR-ach feature te testy NIE są bramką. Dodatkowo brak ścieżki `meeting` w `tests/e2e` → 0 pokrycia E2E/nightly/weekly.

---

## 4. Pułapki (audyt jakości testów)

1. **S6 mock LLM vs realna ekstrakcja** — krytyk: jest ZERO testów dla `generateMeetingNotes`. Nie ma więc nawet testu z mockiem LLM. Route `/:id/generate-notes` persystuje wyekstrahowane decisions/follow-ups z powrotem do meetingu (`meeting.routes.ts:251-256`) — to logika niesprawdzona żadnym testem. Najgrubsza dziura.
2. **Persystencja** — tylko `meetingService.test.ts` dotyka realnego silnika (sqlite `:memory:`). UWAGA: to nie Postgres produkcyjny — możliwy schema-drift PG/sqlite niewykryty (SQL pisany dla obu, ale `ensureMeetingTables` + typy JSON mogą się różnić). `meeting.routes.test.ts` mockuje cały serwis → persystencja w warstwie route NIE jest weryfikowana.
3. **Fałszywa zieleń** — smoke FE używa mocka `@/services/api` (brak realnego fetch/serwera) — gdyby przechodził, byłby tylko testem mocka, nie integracji. Aktualnie i tak FAIL przez mock-drift i18next.
4. **Flaga OFF** — Module 13/Meeting nie ma w tych testach jawnej weryfikacji flagi (np. czy `/meeting` renderuje hub vs „coming-soon”); smoke zakłada hub zamontowany. Brak testu stanu flagi OFF.
5. **Rola iris / RBAC** — auth zamockowany na sztywno (`user-1`/`org-1`); brak testu odmowy dostępu / roli. Scoping org sprawdzony tylko na poziomie serwisu (DB), nie autoryzacji HTTP.

---

## 5. Backlog (typ · plik · scenariusz · priorytet)

| # | Typ | Plik (proponowany) | Scenariusz | Priorytet |
|---|---|---|---|---|
| B1 | FIX-test | `src/components/Meeting/__tests__/MeetingHub.smoke.test.tsx` | Poprawić mock i18next (obsługa `{defaultValue}`) — odblokuje 3 FAIL | **P0** |
| B2 | NOWY BE | `server/src/services/ai/__tests__/meetingIntelligenceService.test.ts` | S6: realna ekstrakcja heurystyczna (fallback bez LLM) — summary/decisions/action items z transkryptu, asercja na deterministycznym wejściu (NIE mock LLM) | **P0** |
| B3 | NOWY BE | `server/src/routes/__tests__/meeting.routes.test.ts` (rozszerzenie) | S6: `/:id/generate-notes` — 400 brak transcript, 404 brak meeting, persystencja decisions/follow-ups (`persist!==false`), 200 happy-path | **P0** |
| B4 | NOWY BE | `server/src/services/__tests__/aiOperatorService.test.ts` | S7: `getMeetingBrief(org, meetingId)` — kształt briefu, scoping org, brak meetingu | P1 |
| B5 | NOWY FE | smoke MeetingHub | S8: „otwórz jako dokument” — asercja wywołania `useModuleOpenDocuments`; S1 widok kalendarza | P1 |
| B6 | NOWY BE | meeting.routes | S3/S5: PATCH `/:meetingId/follow-ups/:followUpId` (walidacja open/done, 404) — obecnie route bez testu | P1 |
| B7 | NOWY E2E | `tests/e2e/...meeting.spec.ts` | S2 end-to-end: utwórz spotkanie → trwałość po reload (realny fetch+DB) — eliminuje fałszywą zieleń | P2 |
| B8 | HARDENING | meetingService.test | Test schema-drift: świadomy komentarz/asercja, że sqlite≠PG; ewentualnie wariant na realnym PG w `test:v8-db` | P2 |
| B9 | GATE | `.github/workflows/test-suite.yml` | Włączyć te testy do bramki PR dla branchy feature (obecnie tylko main/develop; default=Londyn) | P2 |
