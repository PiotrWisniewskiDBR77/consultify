# FIX-181 — Spotkania: bramka pilota, sprostowanie karty, diagnoza spinnera

Data: 2026-08-30
Gałąź: `codex/day181-spotkania-otwarcie-20260830`
Kontekst wejściowy: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY181_SPOTKANIA_OTWARCIE_REPORT.md`
(dyżur 181 — "R3 frontend MEMBER" STOP i finding `MTG-PF-006`).

## 1. Bramka pilota — ZROBIONE

`src/utils/pilotAccess.ts`: dodano `'/meetings'` do `PILOT_ALLOWED_ROUTE_PREFIXES`. To
druga, niezależna od `BETA_MENU_STATUS.MODULE_MEETING` allowlista — konsumuje ją
`RouterSync.tsx:182,316` (`isPilotAllowedPath`) do przekierowania ról pilot-restricted
(bare USER / TEAM_MEMBER / GUEST). Otwarcie samej bety (`betaMenuStatus.ts`, dyżur 181)
nie wystarczało — MEMBER nadal lądował na `/interview` (finding `MTG-PF-006`).

Sprawdzone konsekwencje:
- `PILOT_ALLOWED_ROUTE_PREFIXES` jest używana WYŁĄCZNIE do bramkowania trasy w
  `RouterSync.tsx`. Sidebar korzysta z osobnego zbioru `PILOT_VISIBLE_MENU_IDS`
  (`Sidebar.tsx:132`), którego celowo nie dotknięto — `MODULE_MEETING` tam nie jest,
  więc pilot nie zobaczy pozycji menu, ale bezpośredni/deep-link URL do `/meetings`
  teraz renderuje się zamiast przekierowywać. To zgodne z zakresem zadania (dodać do
  `PILOT_ALLOWED_ROUTE_PREFIXES`, nie do listy menu).
- `/meeting` (liczba pojedyncza, alias legacy na `MeetingLegacyRedirect`) NIE został
  dodany do allowlisty — zostaje poza zasięgiem pilota celowo (kanoniczna trasa to
  `/meetings`, DEC-2026-08-24-07).

Test end-to-end (R3 rozszerzony): `src/components/__tests__/RouterSync.pilotMeetings.test.tsx`.
Montuje realny `RouterSync` w `MemoryRouter` na `/meetings` z rolą `TEAM_MEMBER`
(pilot-restricted) i asercją że komponent RENDERUJE listę (nie przekierowuje). Ponieważ
`tests/setup.ts` globalnie mockuje `useNavigate` na no-op oraz `useAppStore` na sztywny
stan (żeby inne testy nie wywalały się poza Routerem), plik testowy nadpisuje oba mocki
lokalnie (`vi.hoisted`) żeby móc realnie sprawdzić wywołania `navigate()` i kontrolować
`currentUser.role`.

Dowód mutacyjny (ręczny, nie uruchamiany przez CI): tymczasowe usunięcie `'/meetings'`
z `PILOT_ALLOWED_ROUTE_PREFIXES` → test czerwony (`navigate('/interview', {replace:true})`
faktycznie wywołany, asercja `not.toHaveBeenCalledWith` pęka); przywrócenie → test zielony.
Wykonane i potwierdzone w tej sesji.

Weryfikacja: `npx esbuild src/utils/pilotAccess.ts` i
`npx esbuild src/components/RouterSync.tsx` bez błędów; test przechodzi
(`npx vitest run src/components/__tests__/RouterSync.pilotMeetings.test.tsx`).

## 2. Sprostowanie karty MTG-PF-003/004/005 — ZROBIONE

`docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md`:
oryginalne wpisy `MTG-PF-003`/`MTG-PF-004`/`MTG-PF-005` zostały zachowane (żaden wiersz
nie skasowany), z przekreśleniem błędnych cytatów dowodowych plus nowa sekcja
"Errata (FIX-181, 2026-08-30)".

Zweryfikowano OSOBIŚCIE (otworzono każdy plik) wszystkie 21 PNG z
`/private/tmp/cx-day181-spotkania-otwarcie-artefakty/`:

- **12/21 to zamrożone spinnery bez treści**: `admin-meetings-approved-{dark,light}.png`,
  `admin-meetings-decisions-{dark,light}.png`, `admin-meetings-minutes-{dark,light}.png`,
  `admin-meetings-note-{dark,light}.png`, `admin-meetings-pending-{dark,light}.png`,
  `admin-meetings-rejected-{dark,light}.png`.
- **9/21 to realna, dowodowa treść**: obie wersje `calendar-full`, obie `list-full`,
  `preview-light`, `row-actions-light`, `member-meetings-redirect-interview-dark`, obie
  `owner-empty-meetings-list`.

`MTG-PF-003` i `MTG-PF-004` cytowały `approved-{light,dark}.png` /
`decisions-{light,dark}.png` jako dowód na treść, którą rzekomo pokazują — te cztery
pliki są spinnerami, nie pokazują nic. Poprawiona karta wskazuje który plik faktycznie
dowodzi czego (`preview-light.png` dla surowych ID uczestników; `Organizer null null`
zostaje oznaczone jako niezweryfikowany carryover ze starszego zestawu Day101, nie z
dnia 181). `MTG-PF-005` było już poprawne (opisywało dokładnie to, co widać —
"Loading") — bez korekty treści, tylko odnotowane jako potwierdzone.

`MTG-PF-006` przestawione na `FIXED_VERIFIED` z odnośnikiem do commitu i testu z punktu 1.

## 3. Diagnoza spinnera obiektu spotkania — PRZYCZYNA NIE POTWIERDZONA JAKO `requireActiveMeetingMembership`; GŁĘBSZA NIŻ TIMEBOX, OPISANA PONIŻEJ

### Co obalono (dowód mutacyjny na żywej bazie)

Uruchomiono kontener `cx-fix181-pg` (`pgvector/pgvector:pg16`, `127.0.0.1:6105`),
świeży łańcuch migracji (`server/scripts/migrate.postgres.ts`, komplet) na bazie
`consultify_w3_meetings_owner_fix181`, i zasiano fixture `W3-MEETINGS-OWNER-v1`
(`scripts/dev/seed-wave3-meetings-owner-review.mjs seed`) — te same trzy spotkania
(pending/rejected/approved) co w dowodowych zrzutach dyżuru 181.

Zapytano bazę bezpośrednio (`pg.Client`, z pominięciem aplikacyjnej warstwy DB — patrz
niżej dlaczego) dokładnie o to, co sprawdza `requireActiveMeetingMembership`
(`server/src/routes/meeting.routes.ts:165-198`) dla ADMIN z seedu:

```
membership: { status: 'ACTIVE' }
user role: 'ADMIN'
w3-mtg-approved-meeting-v1 => istnieje, organization_id pasuje
w3-mtg-pending-meeting-v1  => istnieje, organization_id pasuje
w3-mtg-rejected-meeting-v1 => istnieje, organization_id pasuje
```

`requireActiveMeetingMembership` sprawdza WYŁĄCZNIE `organization_members.status`
dla `(user_id, organization_id)` requestora — nie "członkostwo w spotkaniu" mimo nazwy.
Dla ADMIN/OWNER/MEMBER z fixture `W3-MEETINGS-OWNER-v1` ten status jest `ACTIVE` (seed,
`scripts/dev/seed-wave3-meetings-owner-review.mjs:111`), więc middleware wywołuje
`next()` — **nie zwraca 403** dla tych trzech person na tym fixture. Dalej,
`GET /:id` (`meeting.routes.ts:343-351`) robi `getMeeting()` + `canAccessMeeting()`;
ADMIN przechodzi przez `isMeetingAdmin(req)` (`meeting.routes.ts:138-140`) niezależnie
od listy `attendees`. Więc **dla ADMIN z tego seedu, `GET /api/meeting/:id` zwraca 200
ze wszystkimi trzema spotkaniami** — tezę z dyżuru 181 ("403 blokuje zanim zadziała
bramka bety") **obalono dla tych konkretnych person**. Ta 403-ka jest realna, ale
dotyczy innego, osobnego pakietu (golden-flow `GF-06`, losowe testowe persony bez
wiersza `organization_members` — patrz `CODEX_DAY181_SPOTKANIA_OTWARCIE_REPORT.md`
sekcja "STOP — R1(4) Golden Flow GF-06") — nie tego fixture ani tych zrzutów.

### Dlaczego to NIE jest pełny dowód end-to-end (przyznanie wprost)

Nie udało się w oknie ~40 minut postawić PEŁNEGO żywego serwera + realnej odpowiedzi
HTTP na `GET /meeting/:id` dla zalogowanego ADMIN (a więc też nie odtworzono przeglądarki
ze spinnerem na żywo w tej sesji). Dwie niezależne przeszkody napotkane po drodze,
obie warte zapisania jako pułapki środowiska:

1. **Gate gotowości serwera (`/api/ready`) wisiał** przy starcie z tym samym
   `DATABASE_URL`/portem — `establishDatabaseReadiness()` → `evaluateSqlChain` nie
   kończył się w rozsądnym czasie (0% CPU, brak aktywnych zapytań w
   `pg_stat_activity` po >3 min), mimo że `/api/health` (płytszy `SELECT 1`) raportował
   `"database":"connected"`. Nie zdiagnozowano do końca czy to realny hang, czy tylko
   wolny 870-migracyjny łańcuch przy `cwd=server` (możliwy zły `migrationsDir` —
   `path.resolve(process.cwd(), 'server/migrations')` z `cwd=.../server` daje
   `.../server/server/migrations`, nieistniejący; drugi kandydat `migrations`
   względem tego samego złego `cwd` też się nie zgadza z układem repo).
2. **Aplikacyjna warstwa DB (`server/src/utils/DbPromise.ts` → `PostgresDatabase.ts`)
   zwracała `null` bez logowanego błędu** dla banalnego `SELECT current_database()`
   uruchomionego przez osobny, minimalny skrypt `tsx` (import samego modułu, bez
   pełnego `index.ts`) — mimo poprawnego `DATABASE_URL`/`NODE_ENV=test` w `process.env`
   sprawdzonego tuż przed importem. `get()` ma `fallback: true` domyślnie
   (`DbPromise.ts:358`), więc każdy błąd/timeout cichnie do `null` zamiast rzucić —
   nie ustalono, czy to realny błąd połączenia w tym trybie uruchomienia (samodzielny
   skrypt, nie pełny `index.ts`) czy coś specyficznego dla wywołania poza Express.
   Dlatego finalny dowód DB poszedł przez surowe `pg.Client` (pkt wyżej), z pominięciem
   tej warstwy — wiarygodny dla stanu danych, ale nie odtwarza dokładnie tego, co robi
   żywy serwer.

### Co NIE zostało naprawione i dlaczego

Zgodnie z instrukcją ("jeśli przyczyna głęboka: NIE naprawiaj — opisz precyzyjnie") —
nie wprowadzono żadnej zmiany kodu dla punktu 3. Obalono jedną konkretną, płytką
hipotezę (403 z `requireActiveMeetingMembership` dla ADMIN/OWNER/MEMBER tego fixture),
ale NIE ustalono ostatecznej przyczyny 12 zamrożonych spinnerów w zrzutach dyżuru 181.
Dwie najbardziej prawdopodobne, niewykluczone hipotezy pozostałe do zbadania na żywo
(przeglądarka + `waitFor`, nie statyczna analiza):

- **Artefakt czasu przechwytywania zrzutu**: skrypt zrzutów dyżuru 181 mógł nie czekać
  (`waitFor`/`networkidle`) na zniknięcie spinnera przed `screenshot()`, systematycznie
  łapiąc stan pośredni na wolniejszych stronach obiektu (kilka równoległych wywołań:
  `getMeeting` + `listMeetingNotes` + `getAIOperatorMeetingBrief` +
  `listMeetingDecisionRecords` + `listMeetingFollowUpRecords` + `getUsers`,
  `MeetingObjectPage.tsx:527-547`) vs. szybszą listę (jedno wywołanie). Zgodne z tym,
  że 2 z 12 spinnerów (`approved-light`, `minutes-light`) mają PEŁNĄ powłokę aplikacji
  (sidebar, "Loading" z komponentu `LoadingState` — `MeetingObjectPage.tsx:582-588`),
  a pozostałe 10 są zupełnie puste bez żadnej powłoki — co wskazywałoby na DWIE różne
  warstwy złapane w locie (bootstrap/Suspense wcześniej vs. własny stan `loading`
  komponentu później), nie jeden trwały defekt.
- **Sam frontend jest broniony poprawnie**: `loadMeeting()` (`MeetingObjectPage.tsx:293-314`)
  ma `try/catch/finally` z `setLoading(false)` w `finally` bezwarunkowo, rozróżnia 404
  (`notFound`) od innych błędów (`loadError` + `ErrorState` z przyciskiem retry) —
  żadna gałąź kodu nie zostawia `loading=true` na stałe, JEŻELI `Api.getMeeting()`
  w ogóle się rozstrzygnie (resolve lub reject). Nie znaleziono żadnej ścieżki w
  `handleResponse` (`src/services/api.ts:975-1122`) dla kodu `ORG_MEMBERSHIP_REVOKED`
  (403 z `requireActiveMeetingMembership`), która by "połykała" błąd bez ustawienia
  `loadError` — trafiłby w gałąź ogólną (`throw err` z `.status=403`), front by go
  obsłużył (`ErrorState`, nie wieczny spinner).

### Wsad do dyżuru 181-bis (konkretny, do podjęcia od razu)

1. Uruchomić realną przeglądarkę (nie statyczną analizę) na `/meetings/w3-mtg-approved-meeting-v1`
   itd. z `waitFor(() => !screen.queryByText('Loading'))` przed zrzutem, i sprawdzić
   `read_network_requests`/`read_console_messages` na żywo — to jedyny sposób
   rozstrzygnięcia między "capture timing" a realnym hangiem sieciowym.
2. Zdiagnozować hang `evaluateSqlChain`/`/api/ready` (server/src/startup/databaseReadiness.ts)
   przy starcie z `cwd=server` — możliwy zły `migrationsDir` (patrz wyżej) wart
   sprawdzenia jako osobna, płytka poprawka niezależna od Meetings.
3. Ustalić dlaczego `DbPromise.get()` przez samodzielny `tsx`-owy import cicho zwraca
   `null` bez logu błędu dla banalnego zapytania — potencjalny cichy defekt
   (fallback:true maskujący realne błędy) wart własnego dyżuru bezpieczeństwa,
   niezależnie od Meetings (dotyczy KAŻDEGO wywołania `dbGet`/`get` bez jawnego
   `{fallback:false}` w całej aplikacji).

## Sprzątanie środowiska

`docker rm -f -v cx-fix181-pg` wykonane; porty `6105`/`5033` wolne po zakończeniu;
zero rekordów testowych pozostawionych (kontener i wolumen usunięte razem).
