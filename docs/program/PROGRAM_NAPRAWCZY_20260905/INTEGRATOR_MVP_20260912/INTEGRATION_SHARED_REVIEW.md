# Niezależny przegląd wspólnych plików integracji — 2026-09-12

## Werdykt

**ACCEPT ograniczony do scalenia źródeł w zbadanych punktach. Brak znalezionego nowego konfliktu semantycznego. Runtime scalonego produktu pozostaje NOT_PROVEN przez ten przegląd.** Nie uruchamiałem testów, bazy ani builda; nie zmieniałem źródeł ani indeksu integratora. Raport nie zamienia odziedziczonego E3 PARTIAL w odbiór wydajności lub UI.

Badany snapshot: `907ccb4be1d07afccdc3dfbd7acd914098865d7c`; nowsza baza: `7c7dd88091f2a28ad73b55a6fc63d85261991b17`. Pod koniec odczytu HEAD przesunął się do `251a15c9f3b8d3366d86214c44b00e0bbad29dc1`: różnice obejmują E4/CI i dokumentację, nie poniższe źródła C2b/C4 E1–E3/C8 E0. E4 ma osobny niezależny odbiór, nie jest ponownie kwalifikowane tym raportem.

Dostawy porównawcze: C2b `1629b4e9f3bea9b628a73f3dc1c4c9cfb11675e3` (kod końcowy `2f70a7387939c1b0c6ababc4f4332a52a9e05b93`), C4 E1 `5544f2f3fe36434a6c7fc6ca9a29b5272feea0c2`, E2 `934e08de86f23d8f48438a69e9dde1522136c04c`, E3 `375660f7d1b8bd171bf52a9f271eefdd2b986c1e`, C8 E0 `382d769ed6fe2df3c89457eeaba657dab9919f2c`.

## Dowody scalenia

| Punkt wspólny | Wynik odczytu i granica dowodu |
|---|---|
| `src/routes/AppRoutes.tsx` | Względem C8 różni się wyłącznie C4: cztery importy MainLayout, AuthView, ProductEntryPage, StudioUnavailableView zmienione na lazyWithRetry. Względem C4 różni się wyłącznie C8: Finance BetaGate wewnątrz MainLayout i fallbacki `/finance/*`, `/economics/*`. Wspólny Suspense pozostaje. Nie ma odwrócenia bramki poprzez zamontowanie EconomicsView przed BetaGate. |
| `src/layouts/MainLayout.tsx` | Identyczny z C4 E3. Help montowany po pierwszym otwarciu, potem zachowany; listener deep linków nadal zamontowany. Nowszy lazy UnifiedChatPanel zachowany. |
| `src/components/ProtectedRoute.tsx` | Identyczny z C8. Coming-soon dotyczy tylko MODULE_ECONOMICS. BetaGate odmawia nieautoryzowanemu montowania dzieci/announcement; obecny mechanizm logowania RouterSync nie jest zmieniony przez integrację. Nie twierdzę, że sam MainLayout jest guardem auth. Istniejące sprawdzenia requiredRole, inicjalizacji auth i wyłączenie dziedziczenia tenant ADMIN przez SUPERADMIN zachowane. |
| C8 sidebar i helpery | betaAccess, betaMenuStatus, pilotAccess, publicProduction, NavItem, menuConfig i serwerowy sharedRuntime betaMenuStatus są identyczne z dostawą C8. Finance API pozostaje closed, dotychczasowe admin exemption pozostaje; frontend announcement nie jest pozwoleniem API. Brak rozszerzenia coming-soon na inne moduły. |
| `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` | Względem C2b jedyna różnica to zbiorczy reader z nowszej bazy: limit100 oraz `/execution-cases/bulk` przed `/:executionCaseId`. Względem nowszej bazy dochodzą importy/delegacje C2b, reader niezmieniony. Actor/org scope, canViewAggregate, brak actor401, brakids400, nadmiar400, missingIds i tenantowy odczyt pracy/alokacji pozostają. Nie utracono dodanej później trasy przez skopiowanie starszej dostawy. |
| C2b kontrolery/UoW | InitiativeController, StaffingPlanController oraz postgresMaterialCommandUnitOfWork identyczne z końcową dostawą C2b: poprawki scope przed receipt i OFF foreign assignee nie zostały cofnięte w tych wspólnych plikach. Nie rozszerzam tego stwierdzenia do runtime scalenia. |
| C4 E1/E2 backend | taskAssignmentService oraz my-work.routes identyczne z dostawą E1; actionCards.routes i actionCardService identyczne z E2. Nie zastąpiono task project-required polityką projectless initiative DEC469; zachowane atomic close/reopen oraz ręcznie resolved/dismissed. |
| Locale | Względem nowszej bazy po9 dodanych linii EN/PL, zero usuniętych. Nie widać zastąpienia całych katalogów tłumaczeń starszą dostawą. |

## Istniejące testy i ograniczenia

Przeczytane testy Finance sprawdzają announcement, role, nieautoryzowanego użytkownika, dziewięć ścieżek i granicę `/finance-secrets`. Zachowany test `server/src/routes/pmo/__tests__/executionCasesBulk.pg.test.ts` broni kolejności routera, limitów, braku tokena i fail-closed/foreign. **Jego pozytywna odpowiedź200 nie dowodzi rzeczywiście niepustego odczytu legalnej realizacji:** fixture bez widocznego rodowodu kończy się cases=[]; należy dodać do odbioru integratora prawidłowy lineage i dane. To luka zakresu dowodu istniejącego testu, nie znaleziony błąd scalenia.

## Ostrzeżenia CSS po buildzie integratora

Root zgłosił build exit0 przy8GiB; odczytałem `INTEGRATION_BUILD_8GB.log`, sam nie budowałem. Warning `--tw-shadow-color: ${zmienna}` ma konkretny odpowiednik `shadow-[${zmienna}]` w komentarzu `src/components/shared/ModuleHub/FilterableTable.tsx:1407`. Tailwind skanuje src tekstowo. Plik oraz tailwind.config.js są niezmienione względem7c7dd88091: źródło tego ostrzeżenia jest zastane, nie dodane integracją.

Pozostałe ostrzeżenia `Unexpected tr` dotyczą wygenerowanych wariantów opacity-60 (`aria-disabled` i dark) przy selektorach tekstu tabel. Odpowiadające reguły `tr.opacity-60` są w `src/index.css:469–480`; index.css również bez zmian wobec bazy. **Silna wskazówka zastanego problemu generacji wariantów, lecz bez bazowego builda nie dowodzę identyczności całego zestawu ostrzeżeń ani jego wpływu na render.** Build exit0 nie jest visual PASS. Do sprawdzenia ukończony wiersz tabeli light/dark, kontrast oraz disabled state. Brak naprawy w tym zakresie.

## Pozostały rzeczywisty odbiór scalonego kandydata

1. Zbudowany frontend: zimne wejście login oraz auth deep link do Finance (również query, nieznany i legacy), OWNER/MEMBER, light/dark. Announcement ze shellem, brak Finance API i montowania silnika; kontrola sąsiednich otwartych/zamkniętych modułów, admin exemption i SUPERADMIN→tenant-admin odmowy.
2. Real ApiGateway/JWT/PG na oddzielnie uzgodnionych zasobach: bulk z widocznym rodowodem i niepustymi tasks/decisions/allocations; mieszane legal/foreign/missing IDs; pojedyncza trasa nadal działa. Następnie canonical writer ON/OFF → bulk readback bez zmieszania tenantów.
3. C2b na scaleniu: aktualizacje A→B→A, jawny retry i keyless fallback, recreate po delete, foreign assignee OFF/ON oraz role/capacity replay po usunięciu parenta. Odróżnić historię agregatu od aktualnego UI readera. Move nadal poza odebraną piątką writerów.
4. E1/E2 scalone API/UI: cztery rodzaje inbox otrzymują poprawne daty; projectless task assign/reassign422 i legal project-backed success; close/reopen reload, peer same-org/foreign, manual resolved/dismissed, rollback i serializacja.
5. E3 z nowego dist: idle bez Help/voice SDK, Help first open/search/close/reopen/deep link, voice pending start→stop/unmount i legal start/error. Powtórzyć boot/common oraz full first-screen decoded/transfer z cache caveat. Historyczne1.911MB common i5.788MB first-screen nie są pomiarem tego scalenia. Known dwa delayed PUT403 CLOSEDinitiative zachować przy oknie obserwacji≥2000ms.
6. Wizualnie nowe Finance oraz tabele completed/disabled light/dark i świeży manifest/hash dist. Autorowe38PNG sprzed C8 nie zastępują tego odbioru.

Nie znalazłem podstaw do cofnięcia integracji w zbadanych seamach. Odbiór operacyjny/release pozostaje bramką osobną od tego ograniczonego ACCEPT.
