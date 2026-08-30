# CODEX DAY 183 — KALENDARZ ON — RAPORT KOŃCOWY

Data: 2026-08-30  
Gałąź: `codex/day183-kalendarz-on-20260830`  
Baza: marker `18661cc6a0`  
Werdykt pierwszego przebiegu: **STOP CAŁEGO DYŻURU — mniej niż 5 GiB wolnego miejsca po pełnych migracjach**.  
Werdykt po wznowieniu przez nadzorcę: **PARTIAL / DO POPRAWY — default ON działa i widok tygodniowy jest potwierdzony, ale `includeOwnEvents` nie podnosi realnie zapisanego wydarzenia; pełny R2 nie jest spełniony**.

## Korekty wobec instrukcji

1. Decyzją nadzorcy po zasadnym STOP-ie portu `5037` zasoby runtime zmieniono z `5036/5037` na `5046/5047`. Portu `5037` zajętego przez Android Debug Bridge nie zatrzymano.
2. Instrukcja odwołuje się do `§0.4a` i `BLOKU 0`, ale wydany plik nie zawiera nagłówka ani treści `§0.4a`. Zgodnie z regułą bezpieczniejszej interpretacji wykonano jawnie dostępne T1–T6; brakującej sekcji nie rekonstruowano z domysłu.

## Wejście i marker — wyniki dosłowne

```text
MARKER OK
```

```text
18661cc6a007769dd419060ff3089860f1163afc
```

`git status --short | head -3` nie wypisał żadnej linii.

Tip `github-backup/codex/m03-admin-20260824` był przed markerem o nowsze commity; zgodnie z DEC-2026-08-26-95 worktree powstał dokładnie z markera. Zakres rozejścia został zmierzony komendami wymaganymi w §0.1; scalenie pozostaje po stronie nadzorcy.

## HISTORIA FLAGI — R1

- Dodanie default OFF: `ae8bb727d494deed07af7d03e4e644d36700e56b`, `2026-08-25 10:55:41 +0200`.
- Flip default ON: `b5cd84d6635f941efe045733b4bdd958aced8b44`, `2026-08-25 15:57:46 +0200`.
- Revert: `97a55adff1b228cb3e600aaf42634910c287daaa`, `2026-08-25 17:33:07 +0200`.
- Merge rewertu `3e2a3f1c62ae018db1b5d4f71c6d18f8aff0550e` ma komunikat: `revert: My Work flag defaults back to OFF (runbook cofania — P0 parity regressions found by skeptic)` i obejmuje sześć plików związanych z dwiema flagami.
- Diff `97a55adff1` dla kalendarza cofa wyłącznie komentarz `CalendarV2`, komentarz decyzji i wartość domyślną `true -> false`; nie zmienia logiki `CalendarView` ani `CalendarV2`.
- `ea3174c7fc8d02d1273dd00669796a8ebf5fd39a` dokumentuje konkretny `TypeError` po włączeniu `ff_ideaInspectorRightRail`: brak mocka `Api.getMyIdeaConversions` w `IdeaMapWorkspace.preferredTool-regression.test.tsx`.
- Przegląd historii i ścieżek kalendarza nie znalazł analogicznego P0 przypisanego `CalendarV2`/`CalendarView`.
- DEC-68: inspektor `OWNER_CHANGE`; DEC-69: szyna Notatnika `OWNER_CHANGE`; DEC-70: `Sejf CHANGE, Kalendarz ACCEPT`; DEC-71 utrzymuje ACCEPT m.in. dla `Kalendarza V2`.
- `CalendarView.tsx` ma osobne toasty dla `409`, `403`, `404` i fallbacku; `MyWorkHub.tsx` zawsze renderuje `CalendarV2` albo `CalendarView`.

**Werdykt R1:** udokumentowana przyczyna techniczna rewertu dotyczy `ff_ideaInspectorRightRail`, nie kalendarza. R1 dał zielone światło do R2. Po zwolnieniu miejsca nadzorca przyjął R1 i jawnie wznowił R2.

## Migracje i Z30

- Wyłączny lokalny kontener: `cx-day183-pg`, `127.0.0.1:6092`, baza `consultify_w3_my_work_owner_cx183`, obraz `pgvector/pgvector:pg16`.
- Pierwszy przebieg migracji: `Applying migrations: 870`, następnie `Postgres migrations complete`.
- Drugi przebieg: `Applying migrations: 0`, następnie `Postgres migrations complete`.
- Tabela `settings`: zapytanie `WHERE key LIKE 'smtp%'` zwróciło `(0 rows)`.
- `server/src/Gateway.ts` nie zawiera trafień dla drenów wymienionych w §0.2b.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Artefakty poza repo:

- `/private/tmp/cx-day183-kalendarz-on-artefakty/migrate-first.log` — SHA-256 `2df66f01900579df451846cdf6c663982f8a0f4791a8c87dc3f48f8491ef34f3`
- `/private/tmp/cx-day183-kalendarz-on-artefakty/migrate-second.log` — SHA-256 `e851ceba0c2ab6c31d6b7b010cff3a5a668e8218359febc361d4488583de408e`

## STOP — cały dyżur po migracjach

Rodzaj: **MERYTORYCZNY / bezwzględny warunek środowiskowy z §0.5**  
Powód: po pełnych migracjach `df -h /` wykazał `3.9Gi` wolnego miejsca, poniżej wymaganego minimum 5 GiB.  
Licencja, którą sprawdziłem: §0.1 krok (0) i §0.5 pkt 4: mniej niż 5 GB wolnego dysku zatrzymuje cały dyżur.  
Dowód: `df -h /` po migracjach: `/dev/disk3s1s1 1.8Ti 12Gi 3.9Gi 76%`.  
Co dostarczyłem ZAMIAST zmiany: kompletny R1, dwa przebiegi migracji z idempotencją, dowód Z30 i ten raport; żadnego flipu ani testu nie uruchomiono.  
Co zrobiłbym, gdyby zwolniono bezpiecznie miejsce: ponownie sprawdziłbym próg 5 GiB i porty, odtworzył lokalną bazę, wykonał R2 dokładnie wzorem `b5cd84d663`, pełny retest i zrzuty na `5046/5047`.  
Rekomendacja dla nadzorcy: zwolnić miejsce poza chronionymi checkoutami/worktree i wznowić dyżur dopiero po potwierdzeniu co najmniej 5 GiB.  
Stan: raport zacommitowano na gałęzi dyżuru; zmiany produktowej brak.  
Czy kontynuowałem pozostałe pozycje: **NIE**, ponieważ §0.5 nakazuje zatrzymać cały dyżur.

## Zasięg zmian pierwszego przebiegu

Jedyny plik repozytorium dotknięty przez dyżur to ten raport. Nie zmieniono flagi, testów, `CalendarV2`, `CalendarView`, Radaru ani `ff_ideaInspectorRightRail`.

## TWIERDZENIA NIEZWERYFIKOWANE — stan w chwili pierwszego STOP-u

- R1 statycznie i historycznie wskazuje, że P0 dotyczył wyłącznie `ff_ideaInspectorRightRail`; nie wykonano funkcjonalnego retestu kalendarza po flipie, ponieważ nastąpił STOP dyskowy.
- Nie zweryfikowano na żywym runtime, czy `includeOwnEvents` realnie zmienia wyświetlaną treść.
- Nie zweryfikowano na żywym Postgresie toastów reschedule dla `409/403/404/500`; potwierdzono jedynie obecność rozgałęzień w kodzie.
- Nie wykonano tworzenia wydarzenia, reschedule ani readbacku przez realny `ApiGateway`/JWT.
- Nie wykonano zrzutów jasnych/ciemnych ani stanów pusty/pełny.
- Nie wykonano pakietów Vitest ani porównania `fullName`, więc nie istnieje wynik PASS/FAIL do raportowania.

---

## WZNOWIENIE NADZORCY — R2

Wznowienie rozpoczęto na czystym tipie `8e3fdf0f553f7cc4c653d50b51fdeaec7a5fb7d3`, przy `20Gi` wolnego miejsca i wolnych portach `6092`, `5046`, `5047`. Nie przepisano historii ani wcześniejszego raportu; wykonano commity do przodu.

### Flip i testy wzorem `b5cd84d663`

Commit produktu: `1b345e17bef6e198ee6a2413f727014a9e6d8a46` (`feat(mywork): enable Calendar V2 by default for D-6`), wypchnięty na `github-backup`.

Zmiany ograniczono do licencji:

- `src/utils/myWorkCalendarV2Flag.ts`: fallback `false -> true`, komentarz D-6; query/localStorage/env nadal pozwalają na opt-out;
- `src/components/MyWork/CalendarV2/CalendarV2.tsx`: wyłącznie komentarz `Default-on`;
- `src/utils/__tests__/myWorkCalendarV2Flag.test.ts`: default ON i jawny opt-out, kształt `b5cd84d663`;
- `tests/components/MyWork/CalendarCreateEventModal.test.tsx`: wymagany pin pre-V2.

`Radar`, `ff_ideaInspectorRightRail`, `CalendarView.tsx`, bramki i infrastruktura testowa pozostały nietknięte.

### Migracje, fixture i runtime

- wznowienie migracji: `870`, potem `0`; dysk po migracjach: `20Gi` wolne;
- fixture `W3-MY-WORK-OWNER-v1`, marker FINAL, baza `consultify_w3_my_work_owner_cx183`;
- kanoniczny runtime: server `5046`, client `5047`, exact SHA `1b345e17bef6...`, health/ready/frontend `200`, migracje `ok`, auth bypass `false`, E2E mode `false`, dotenv server/client disabled;
- runtime zatrzymano kanonicznym skryptem; oba porty runtime są wolne, baza i marker zostały zachowane.

Deklaracja §0.2b dla zrzutów: **Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.**

### Pakiety i pełne nazwy

1. Pakiet wymagany przez R2(2): `12` suit, `16` testów, `15 PASS`, `1 FAIL`, `--retry=0`.
   - PASS: `My Work Calendar V2 default-on flag (D-6) defaults ON with no query or local override` oraz jawny opt-out i routing OFF/ON.
   - FAIL: `CalendarCreateEventModal creates a task-backed calendar event and notifies the host callbacks` — po wymaganym pinie legacy test nadal szuka `combobox`, którego legacy UI już nie renderuje (`Repeating: planned`). Asercji nie osłabiono; plik miał licencję wyłącznie na przywrócenie mocka.
   - Pułapki (a)-(d): nie dotyczą ścieżki serwerowej, bo pakiet jest jednostkowy i mockuje API; uruchomiono `RUN_DB_TESTS=0 MOCK_DB=true`. Pułapka (e) dotyczy bezpośrednio flagi i została wyłączona przez osobne R1 oraz jawny pin legacy.
2. Pakiet real-PG `my-work.day47finish.calendar-b2-contract-b3-cycle.realdb.test.ts`: `15/15 PASS`, pełne nazwy w JSON, `--retry=0`.
   - Realny `ApiGateway.getInstance().initializeRoutes(app)`, podpisany JWT, Postgres, POST/PUT/DELETE i niezależny readback; obejmuje m.in. sukces PUT, `403`, `404`, odrzucenie złego zakresu i readback bez zmiany.
   - Pułapka (a): `ENABLE_V8_GLOBAL=true`; (b): strażnik Results nie leży na tej ścieżce, a `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` mimo to ustawiono; (c): `MOCK_DB=false DB_TYPE=postgres` i strażnik real-PG bez argumentów; (d): `ENABLE_TEST_AUTH_BYPASS=false` plus podpisany JWT; (e): nie dotyczy tej serwerowej suity, a rozdzielenie flag rozliczono w R1.
3. Pakiet UI reschedule/grid/error: `13/13 PASS`, `--retry=0`.
   - Potwierdza brak przedwczesnego sukcesu, `false` po odrzuceniu, cofnięcie drag po błędzie, wersję do 409 oraz refresh po sukcesie i odrzuceniu.
   - Pułapki (a)-(d): nie dotyczą, bo pakiet mockuje klienta API i nie montuje middleware ani DB; (e): nie dotyczy, bo nie czyta obu flag.

Artefakty JSON:

- `day183-vitest-unit.json` — SHA-256 `c7a7bcfe0a6b7120c7e1d9a562d2b3d5bd2ae15dc3e5043f3f6a2d7d4758f625`
- `day183-realdb-calendar-cycle.json` — SHA-256 `c04297722337722e6983a5547378ab2c2d5d36641e2679b8071d0cb1edde4d0d`
- `day183-calendar-ui-behavior.json` — SHA-256 `ef0bcfc8b36bfb4ff81f77eb0f10fd679b2a711ad10756b7a86aed2ef2dd6b5f`

### Retest przeglądarkowy

- default bez override: zakładka Calendar renderuje `CalendarV2`, aktywny widok `Week`, zakres `24–30.08.2026`;
- jawny query opt-out `ff_myWorkCalendarV2=off`: ta sama zakładka renderuje legacy `Month`, siatkę `27.07–06.09.2026`, bez źródła `Own events`;
- formularz V2 pozwolił utworzyć `Day 183 Calendar V2 proof`; realny wiersz istnieje po reloadzie: owner `w3-myw-owner-user-v2`, `2026-08-30T07:00:00.000Z–08:00:00.000Z`, status `confirmed`;
- po pełnym reloadzie domyślny tydzień nadal pokazuje `Own events (0)` i nie renderuje zapisanego wydarzenia.

Zrzuty po QA:

- `/private/tmp/cx-day183-kalendarz-on-artefakty/calendar-empty-week-light.png` — nazwa historyczna; faktycznie pierwszy zrzut był w motywie systemowym dark; SHA-256 `8ff97feb8d45c082a0ab9c59251f1f8144b25e7216ff04e4d385a6e81f915b9f`;
- `/private/tmp/cx-day183-kalendarz-on-artefakty/calendar-after-create-missing-light.png` — jasny, po trwałym zapisie, nadal brak wydarzenia; SHA-256 `fe671f532d8a42397e9100051cd76938dd791b2ac6dc506838b7220876c0dcde`;
- `/private/tmp/cx-day183-kalendarz-on-artefakty/calendar-after-create-missing-dark.png` — ciemny, po trwałym zapisie, nadal brak wydarzenia; SHA-256 `30d372182e260eb6285496e0cc2f6a02a1e0122d8374101da6fe20feefc475a7`.

### STOP — R2(ii) `includeOwnEvents`

Rodzaj: **MERYTORYCZNY**  
Powód: realnie zapisane własne wydarzenie nie jest zwracane/renderowane w domyślnym CalendarV2; nie można oddać wymaganego stanu pełnego ani twierdzić, że `includeOwnEvents` zmienia treść.  
Licencja, którą sprawdziłem: tabela licencji nie daje zapisu do `src/components/MyWork/Calendar/useCalendarData.ts` ani `src/services/api.ts`; oba pliki są tylko do odczytu zgodnie z Z17.  
Dowód: Postgres ma 1 wiersz `Day 183 Calendar V2 proof`; UI po pełnym reloadzie pokazuje `Own events (0)`; server log pokazuje GET `/api/v8/my-work/calendar/unified?...` zamiast legacy trasy z `sources=event`. Kod: `useCalendarData.ts` tworzy `sources: [...ALL_SOURCES, ...additionalSources]`, choć `ALL_SOURCES` już zawiera `event`; długość 8 powoduje przekazanie `undefined`, a `Api.getMyWorkCalendarUnified` wybiera wtedy V8.  
Co dostarczyłem ZAMIAST zmiany: czerwony kontrakt, realny zapis/readback, dwa zrzuty po zapisie oraz dokładny brief naprawy.  
Co zrobiłbym, gdyby zapadła decyzja X: deduplikowałbym źródła przed stanem filtra albo zmienił warunek przekazywania `sources`, dodał regresję „CalendarV2 own event survives full reload”, a następnie ponowił runtime i cztery zrzuty.  
Rekomendacja dla nadzorcy: osobny FIX z licencją na `useCalendarData.ts` i test; promień rażenia obejmuje routing V8/legacy wszystkich odczytów My Work Calendar.  
Stan: flip zacommitowany w `1b345e17be`; defekt nie został naprawiony poza licencją.  
Czy kontynuowałem pozostałe pozycje: **TAK** — wykonano pozostałe testy, porównanie week/month, zapis/readback, zrzuty i cleanup; pełny stan pozostaje niemożliwy.

### R3

R3 nie został uruchomiony: zaakceptowane R1 rozstrzygnęło, że przyczyna rewertu z 25.08 nie dotyczyła kalendarza. Późniejszy defekt `includeOwnEvents` jest nowym, zmierzonym wynikiem R2 i nie cofa tego ustalenia historycznego.

## Zasięg końcowy zmian repo

```text
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY183_KALENDARZ_ON_REPORT.md
src/components/MyWork/CalendarV2/CalendarV2.tsx
src/utils/__tests__/myWorkCalendarV2Flag.test.ts
src/utils/myWorkCalendarV2Flag.ts
tests/components/MyWork/CalendarCreateEventModal.test.tsx
```

## TWIERDZENIA NIEZWERYFIKOWANE — stan końcowy

- `includeOwnEvents` został zweryfikowany negatywnie: nie zmienia widocznej treści z powodu opisanego routingu; nie jest to już `UNKNOWN`, tylko `FAIL`.
- Toasty `409/403/404/fallback` istnieją w kodzie, a UI testy potwierdzają uczciwe odrzucenie i cofnięcie drag; brak licencjonowanej suity, która asertuje osobny tekst każdego z czterech toastów, więc pełne pokrycie tekstów pozostaje **PARTIAL / NOT_PROVEN**.
- Utworzenie wydarzenia i trwały readback są potwierdzone; przeciągnięcie realnego wydarzenia w runtime nie było możliwe, bo wydarzenie nie zostało wyrenderowane. Realny PUT/readback przeszedł w pakiecie ApiGateway, ale nie jest dowodem gestu przeglądarkowego.
- Stan pełny i wymagane cztery zrzuty (jasny/ciemny × pusty/pełny) są **BLOCKED** przez defekt odczytu własnych wydarzeń. Dostarczono jasny i ciemny dowód pustego gridu po realnym zapisie.
