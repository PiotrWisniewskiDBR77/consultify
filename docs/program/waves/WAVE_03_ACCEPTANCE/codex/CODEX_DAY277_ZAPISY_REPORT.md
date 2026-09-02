# CODEX DAY 277 — zapisy do serwera

Data: 2026-09-02. Gałąź: `codex/day277-zapisy-do-serwera-20260902`.

## Weryfikacja wejściowa

`git log` kończył się `0eff12615b merge: wyjscie z zamknietego kola logowania dwuskladnikowego`.
`merge-base --is-ancestor` zwrócił dosłownie `MARKER OK`.
Sanity worktree: `0eff12615b6f00d48f9684a490ca77d9f3ebed72`, `STATUS_COUNT=0`.
Tip gałęzi bazowej nie zawierał commitów ponad markerem. Porty 6296, 5276 i 5277 oraz nazwa kontenera były wolne. Dysk: 79–84 GiB wolne.

Obowiązkowe pomiary 1–16 potwierdziły: komunikat local-only był widoczny; cache zawierał `attachments`, `linkedItems`, `reminders`, `escalation`, `escalationRules`, `description`, `contextDetails`, `consequenceScenarios`; komentarze/alternatywy/ryzyka miały łańcuch serwerowy; pięć wskazanych pól nie miało trasy ani walidatora; `CapacityScenarioSurface` miał 0 wystąpień `raport|report`, 0 callerów report-runs i modal `workspaceOpen`; górny pasek miał dokładnie dwa przyciski AI; `runSectionAi` miał 19 gałęzi `case`; komenda inwentarza zwróciła 182 wystąpienia; dysk >5 GiB.

## A.0 — inwentarz rodziny localStorage

Komenda liczy 182 wywołania po filtrze instrukcji. To szeroki mianownik obejmujący dane produktu, preferencje, testy i harnessy, dlatego sama liczba nie oznacza 182 defektów. Po ręcznej klasyfikacji zakres naprawy pozostał ograniczony do `DecisionDetailView`: pięć pól danych decyzji nie miało odpowiednika serwerowego, a ekran informował o tym uczciwie. Pozostałe miejsca nie były zmieniane (Z41).

## A.2 — pięć pól decyzji

Dodano addytywną, idempotentną tabelę `decision_enhancements` i org-scoped `PUT /api/decisions/:id/enhancements`. Dokładny kontrakt: `reminders[]`, `escalationRules[]`, `linkedItems[]`, `contextDetails: string`, `consequenceScenarios: object|null`. `GET /detail` zwraca te pola. Klient usunął je z lokalnej hydratacji i lokalnego zapisu; nadal zapisuje lokalnie tylko dane mające odrębny serwerowy lub przejściowy mechanizm (`attachments`, bieżąca `escalation`, `description`). Komunikat local-only został usunięty dopiero po podłączeniu zapisu.

Migracje:

```text
Pierwszy przebieg cx277: Applying migrations: 882; 20261910_day277_decision_local_only_fields.sql; Postgres migrations complete
Drugi przebieg cx277: Applying migrations: 0; Postgres migrations complete
Pusta baza cx277zero: Applying migrations: 882; Postgres migrations complete
SELECT: decision_enhancements | decision_comments | decision_alternatives | decision_risks — wszystkie istnieją
```

Realny test ApiGateway/JWT/PostgreSQL: 2/2 PASS. Właściciel: PUT → niezależny SELECT pięciu pól → GET detail. Obcy tenant: PUT 404 i GET 404. Mutacja usuwająca rzeczywisty INSERT, przy zachowanym 200: RED na `expected [] to have a length of 1`; po przywróceniu GREEN.

Warunek 10: spełniony w całości dla pięciu pól; lista pól z tego zgłoszenia nadal wyłącznie lokalnych: pusta.

## Korekta ryzyka 932

`932_decision_workflow_canonical.sql` nie pasuje do `MIGRATION_PATTERN` runtime i nie jest w runtime allowliście. Jednak instrukcja miesza dwa różne runnery: użyty tu `server/scripts/migrate.postgres.ts` jawnie zastosował `932_decision_workflow_canonical.sql` na obu świeżych bazach. Dlatego twierdzenie, że na świeżej bazie z tego runnera tabele mogą nie powstać, zostało obalone pomiarem. Bramka day161 oparta wyłącznie na runtime predicate nadal nie wykryje pliku 932 — to odrębne, nienaprawiane ryzyko platformowe.

## A.3 — raport doradcy zdolności

Status: czerwony kontrakt + brief, zgodnie z §A.3/§0.5; nie udawano implementacji.

Ogólny silnik `report-definitions/report-runs` przechowuje definicję i run, ale nie agreguje obsady ani planu. Dane domenowe istnieją w `staffingPlanService` (`staffing_plans`, `staffing_plan_roles`, FTE i gaps) oraz w scenariuszu zdolności. Najwęższy wariant wymaga jednej org-scoped trasy w domenie zdolności, łączącej te źródła i zwracającej jawne UNKNOWN dla braków, oraz osobnej karty pod odrębnym URL. Koszt: backendowy agregat + karta/wiring + RealPG/HTTP + nawigacyjna mutacja. Test `todo` zapisuje wymaganie: przycisk `Utwórz raport`, inny URL, obsada kontra plan z danych serwera. Zrzuty PO dla capacity są dowodem RED — przycisku nadal nie ma.

Ścieżka 16: walidator — brak; trasa — brak; serwis danych — `staffingPlanService.ts`; repozytorium — SQL przez queryHelpers; tabele — `staffing_plans`, `staffing_plan_roles`; migracja — istniejące migracje zasobów/staffingu. Nie dodano atrapy ani własnego silnika raportów.

## A.4 — Wypełnij z AI

Istniejący przycisk uruchamia `runWholeCardAi`, który wybiera puste obsługiwane sekcje, przechodzi sekwencyjnie przez `runSectionAi`, pokazuje postęp i jawnie wyświetla nazwy/powody niepowodzeń. Nie dodano trzeciego przycisku i nie zmieniono sekcyjnych `Analizuj z AI`.

Test: 2 PASS, 1 TODO (A.3). Mutacja przywracająca toolbar do `openInitiativeTeresa()` dała RED na asercji wiring; po przywróceniu 2 PASS. Ograniczenie: test A.4 jest kontraktem źródłowym, nie pełnym klikowym testem z rzeczywistym modelem (Z15 zabrania wywołania LLM).

## A.5 — zrzuty

PRZED i PO wykonano w 1440×900, light/dark, bez panelu uwag. Z40 PO: decision 223.69/99.86%, capacity 227.67/99.92%, initiative 214.70/99.67% (delta luminancji/odsetek różnych pikseli). Decision nie zawiera komunikatu local-only; initiative pokazuje dwa rozróżnialne przyciski. Capacity jawnie RED.

```text
0583e4f9f0a79cf8f9bda077af1aaccb78d460aeea383e6314c26c5ef2688168  capacity-dark.png
abb838b9d686d3cdf4be94ad69c59de3285d983c37d85b9e5926345f583e5423  capacity-light.png
46b8fcf0d43500b29e0c472973669f1a858ed187f3bcc5be2caa94e6e16c60bb  decision-dark.png
31ba7c78263302ac6f0b9062212922f786e8fdfffe5e0561adde6d1b04f979da  decision-light.png
91ca102215a566dfd6a0d6d47886db600e6cc94e6fa76cc59b7b56ad1f22113b  initiative-dark.png
01cb99f4bf7bc4248db86edca6752921e03d83ab7ed0a1f69cc9e136e64c990a  initiative-light.png
```

## Pomiar zasięgu testów

PRZED: oba nowe pliki nie istniały, więc lista nazw była pusta. PO: dodano dwie nazwy testów serwerowych, dwie zielone nazwy frontowe i jeden jawny TODO. Nic nie zniknęło. Instrukcyjna komenda serwerowa z filtrem od roota zwracała `No test files found`; korekta: `vitest --root server ...` zebrał właściwy pakiet.

## Mianowniki

1. localStorage po filtrze: 182 wywołania. 2. Pola wyłącznie lokalne przed: 5; po: 0. 3. Trasy decyzji po: 30. 4. report/raport w capacity: 0. 5. callery report-runs: 0. 6. Przyciski AI w pasku: 2. 7. Gałęzie `case` w mierzonym fragmencie: 19 (część aliasów, nie 19 niezależnych sekcji).

## Z30 i twierdzenia niezweryfikowane

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Niezweryfikowane: rzeczywisty LLM dla A.4; produkcyjny browser po deployu; A.3 (jawnie RED). Nie było pushu, Railway, zdalnej bazy ani zmian flag.
