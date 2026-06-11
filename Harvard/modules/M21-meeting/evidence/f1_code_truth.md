# M21 — Meeting — FAZA 1: Prawda kodu

Branch: feat/deliverables-light. Data: 2026-06-11. Agent: KOD.

## Pliki runtime
- FE hub: `src/components/Meeting/MeetingHub.tsx` (1662 l.)
- FE trasa + gate: `src/routes/AppRoutes.tsx:2010-2024` (ProductionModuleGate, `ROUTES.MEETING='/meeting'`, `routeConfig.ts:114`)
- FE API: `src/services/api.ts:3151-3239` (getMeetings/create/update/delete/status/decisions/follow-ups/follow-up-status/generateMeetingNotes)
- BE trasy: `server/src/routes/meeting.routes.ts` (282 l.)
- BE serwis (persistencja): `server/src/services/meetingService.ts` (399 l.)
- BE AI: `server/src/services/ai/meetingIntelligenceService.ts` (282 l.)
- BE brief: `server/src/services/aiOperatorService.ts:638-707` + trasa `server/src/routes/ai-operator.routes.ts:77-92`
- Mount: `server/src/Gateway.ts:524` → `app.use('/api/meeting', meetingRoutes)`; brief pod `/api/ai-operator/meetings/:meetingId/brief`

## Montaż / flagi (tabela 1f)
- **Montaż ŻYWY**, NIE „coming soon". `MeetingHub` lazy-loaded i wyrenderowany w trasie `/meeting` (`AppRoutes.tsx:2019`).
- ProductionModuleGate: `enabled={!hideNonCoreModulesOnPublicProduction}` (`AppRoutes.tsx:2014-2016`) — moduł chowany WYŁĄCZNIE na publicznym produkcie (non-core gating); na normalnych instancjach w pełni dostępny. Brak osobnej flagi beta dla meeting w `betaAccess.ts`.
- Auth: `verifyToken` + `isAuthenticated` na całym routerze (`meeting.routes.ts:26-27`); `ensureMeetingTables()` w middleware (`:28-31`).

## Werdykty per pozycja INV_E (MEETING)

### 1. Lista spotkań + kalendarz (filtry, preview pane) — REALNE
ModuleHub split-view: lista + open-documents (tabs) + brief pane. `listMeetings` (`meetingService.ts:159-173`) realnie czyta tabelę `meetings` z filtrem `organization_id` (+ opcjonalny `project_id`). FE: `getMeetings` (`api.ts:3151`). Dowód: `meetingService.ts:164-169`.

### 2. CRUD spotkania (tytuł/start/end/lokalizacja/uczestnicy/pre-read/agenda) — REALNE
`createMeeting` INSERT (`meetingService.ts:189-230`), `updateMeeting` dynamiczny UPDATE (`:232-293`), `deleteMeeting` (`:295-311`). Trasy: POST/PUT/DELETE (`meeting.routes.ts:47-124`). attendees/preRead/agenda jako JSON kolumny. UWAGA brak edytora agendy w UI (zgłoszony brak, nie bug) — backend agendy przyjmuje tablicę, FE jej nie edytuje.

### 3. Status spotkania (scheduled/completed) — REALNE
`updateMeetingStatus` UPDATE (`meetingService.ts:313-324`), PATCH `/:id/status` z walidacją (`meeting.routes.ts:126-145`). Persystowane w kolumnie `meetings.status`.

### 4. Decyzje spotkania — REALNE
`addMeetingDecision` (`meetingService.ts:357-375`) — append do `meetings.decisions_json`, guard `getMeeting` przed mutacją. POST `/:id/decisions` (`meeting.routes.ts:147-162`). Persystowane w DB.

### 5. Follow-upy (dodawanie + toggle open/done) — REALNE
Osobna tabela `meeting_follow_ups` (`meetingService.ts:115-126`, FK→meetings ON DELETE CASCADE). `addMeetingFollowUp` INSERT (`:326-355`), `updateMeetingFollowUpStatus` UPDATE (`:377-399`). Trasy POST `/:id/follow-ups` + PATCH `/:meetingId/follow-ups/:followUpId` (`meeting.routes.ts:164-202`). Persystowane w DB.

### 6. Notatki AI z transkryptu — REALNE (z jednym martwym side-effectem, patrz niżej)
- **LLM realny**: `generateWithLLM` (`meetingIntelligenceService.ts:103-178`) — OpenAI `gpt-4o-mini`, `response_format: json_object`, parsuje summary/keyPoints/decisions/actionItems/followUps. Klient leniwie inicjalizowany z `OPENAI_API_KEY` (`:62-86`). NIE placeholder.
- **Fallback heurystyczny realny i sensowny** (`:180-216`): regex PL/EN na zdaniach transkryptu wyciąga action items (`action|task|todo|termin|zadanie|zrobić`) i decyzje (`decided|agreed|decyzja|zdecydowano`), summary = 2 pierwsze zdania, keyPoints = 5 pierwszych. Operuje na RZECZYWISTEJ treści transkryptu — NIE fabrykuje fikcyjnych danych; przy pustym/krótkim transkrypcie zwraca puste tablice (uczciwa degradacja). Wybór ścieżki: LLM tylko gdy klient istnieje i transcript>100 znaków (`:96`).
- **Persystencja ekstrahowanych danych = REALNA tabela DB** (NIE in-memory Map): trasa `generate-notes` (`meeting.routes.ts:212-280`) po wygenerowaniu notatki zapisuje `note.decisions[]`→`addMeetingDecision` i `note.actionItems[]`→`addMeetingFollowUp` (`:253-275`), czyli do realnych tabel `meetings`/`meeting_follow_ups`. FE odświeża spotkanie z odpowiedzi (`MeetingHub.tsx:553-556`).
- **MARTWY side-effect (cicha degradacja)**: `persistNote` (`meetingIntelligenceService.ts:218-237`) robi INSERT do tabeli **`notebook_entries`, która NIE ISTNIEJE w kodzie** (grep: jedyne wystąpienie to ten plik; `notebookService.ts` tworzy `notebook_embeddings`/`notebook_ai_proposals`, nie `notebook_entries`). Błąd połknięty `.catch(...debug 'Persist skipped')` (`:236`). Skutek: markdown notatki NIGDY nie ląduje w Notebooku, ale działa cicho. NIE wpływa na werdykt poz.6 DZIAŁA, bo właściwe dane (decyzje+action items) persystują osobno. → kandydat do FAZY napraw (DEAD-PATH).
- Brak nagrywania/żywej transkrypcji — tylko wklejanie (`MeetingHub.tsx:976-986` „Wklej transkrypcję") — zgodne z inwentarzem (brak, nie bug).

### 7. Operator brief per spotkanie — REALNE
`getMeetingBrief` (`aiOperatorService.ts:638-707`) — czyta realne tabele cross-module (`tasks`, `decisions` po `project_id`), oblicza agendaGaps (pre-read/agenda/attendees), followUpSuggestions z otwartych tasków/pending decyzji, executiveBrief z liczbami. Org-scoped. To realna kompilacja danych, nie statyczny stub (treść zależy od stanu DB). FE ładuje przez `getAIOperatorMeetingBrief` (`MeetingHub.tsx:180`).

### 8. Otwarcie spotkania jako dokument — REALNE, ale LOKALNE (nie handoff do M02/M18)
`openMeetingDocument` (`MeetingHub.tsx:195-205`) używa `useModuleOpenDocuments('meeting')` — otwiera spotkanie jako tab/dokument w SPLIT-VIEW samego ModuleHub (`:110-111`, `:597-604`). To NIE jest handoff/eksport do Canvas (M02) ani Document Studio (M18) — żadnego wywołania artifact/deliverable/canvas API. Czyli „dokument" = wewnętrzny widok-tab spotkania w hubie, realny i działający, ale ograniczony do M21. Połączenie do M02/M18 = BRAK.

## Wiring (tabela 1e) — persistencja DB, nie fasada
| Encja | Persistencja | Dowód |
|---|---|---|
| Spotkania | tabela `meetings` (SQLite, DbPromise) | `meetingService.ts:96-114` |
| Decyzje | kolumna `meetings.decisions_json` | `:357-375` |
| Follow-upy | tabela `meeting_follow_ups` (FK→meetings) | `:115-126,326-399` |
| Notatki AI — dane wynikowe | przez decisions_json + meeting_follow_ups | `meeting.routes.ts:253-275` |
| Notatki AI — markdown→Notebook | **MARTWE** (tabela `notebook_entries` nie istnieje, błąd połknięty) | `meetingIntelligenceService.ts:218-237` |
Tabele tworzone idempotentnie `CREATE TABLE IF NOT EXISTS` w `ensureMeetingTables` (middleware na każdym żądaniu). Przeżywają restart (persystentny SQLite). **ŻADNEJ persistencji-fasady `new Map()`** — przeciwieństwo wzorca M18.

## Połączenia (tabela 1g)
- Kalendarz zewn. (M03/M25 sync): **BRAK** (zgodne z inwentarzem — brak integracji zewn. kalendarza).
- Decyzje → M03: brief CZYTA `decisions`/`tasks` po project_id (read-only join), ale spotkaniowe decyzje NIE są zapisywane do globalnej tabeli `decisions` — żyją tylko w `decisions_json`. Połączenie jednokierunkowe/czytające.
- Otwarcie jako dokument → M02/M18: **BRAK** (lokalny tab w hubie, p. poz.8).
- Action items → M03 tasks: **BRAK** — action items z notatek AI lądują w `meeting_follow_ups`, NIE w globalnej tabeli `tasks`. Brief czyta tasks tylko po project_id (osobne źródło).

## Cross-org IDOR (do SEK) — M21 CZYSTE
Próbka 6 endpointów z :id/:meetingId:
- PUT `/:id`, DELETE `/:id`, PATCH `/:id/status`, POST `/:id/decisions`, POST `/:id/follow-ups`, PATCH `/:meetingId/follow-ups/:followUpId`, POST `/:id/generate-notes`, GET brief.
- Wszystkie odczyty/listy filtrują `WHERE organization_id = ?` (`meetingService.ts:166-169,181`).
- Wszystkie mutacje POPRZEDZONE guardem `getMeeting({organizationId, meetingId})` zwracającym null→404 zanim cokolwiek zmodyfikują (`:244,300,333,363,384`); update/delete/status mają `AND organization_id = ?` bezpośrednio w WHERE (`:289,306,320`).
- Bezpośrednie UPDATE-y po samym `id`/`meeting_id` (`:350,369,391,394`) są bezpieczne, bo zawsze za guardem org-scoped.
- generate-notes: org-scope przez `getMeeting` przed generowaniem (`meeting.routes.ts:225-226`); persist używa tego samego orgId. PII transkryptu NIE wyciekają cross-org.
- Brief: org-scoped przez `getAuth` + `getMeeting(organizationId,...)` (`aiOperatorService.ts:638-640`).
**Werdykt SEC: brak cross-org IDOR. Moduł trzyma się czystego wzorca (jak M02/M25/M17/M18/M19), NIE legacy-dziurawego.**

## Sygnały do dalszych faz
1. DEAD-PATH: `persistNote`→`notebook_entries` (nieistniejąca tabela, cichy catch) — markdown notatki nie trafia do Notebooka. Albo utworzyć tabelę/użyć notebookService, albo usunąć martwy zapis.
2. Niespójność integracji: action items idą do `meeting_follow_ups`, nie do globalnych `tasks` (M03); decyzje do `decisions_json`, nie do globalnych `decisions`. „Połączenia" z inwentarza (decyzje→M03, action items→M03 tasks) faktycznie NIE istnieją jako zapis — tylko brief czyta z M03 jednokierunkowo.
3. poz.8 „jako dokument" to lokalny tab hubu, nie handoff do Studio — jeśli oczekiwany był eksport do M02/M18, to brak.
