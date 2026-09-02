# CODEX DAY 274 — jedna tabela inicjatyw

Stan: **PARTIAL / GOTOWE DO ODBIORU UI, A.4 POZOSTAJE CZERWONYM KONTRAKTEM**. Marker `0eff12615b`; gałąź `codex/day274-inicjatywy-jedna-tabela-20260902`; bez pushu.

## §A.0 — KROK ZERO: inwentarz rodziny przed naprawą

Literalna komenda z instrukcji zakończyła się `rc=0`, ale zwróciła również komentarze, testy oraz tabele innych bytów, w których jedynie występuje słowo „initiative”. Po klasyfikacji realnego renderu list inicjatyw mianownik rodziny wynosi **4**: trzy renderery żywe i jeden martwy.

| Renderer (`plik:linia`)                                                | `StandardTable` | Źródło kolumn                                                                 | Źródło kebaba                                   | Magazyn danych                                                                                    | Żywy/martwy i dowód                                                                                                                 |
| ---------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/Initiatives/CanonicalInitiativeRegister.tsx:384`       | TAK             | lokalny `createCanonicalInitiativeRegisterColumns()` (`:98`, użycie `:269`)   | lokalny inline `rowMenu` (`:403`)               | `ie_aggregate_state`, przez `InitiativesHub.tsx:507` → `listRegisteredInitiatives()` → runtime-v1 | ŻYWY: osadzenie w `InitiativesHub`; domyślny widok tabeli zostanie wykazany w A.1                                                   |
| `src/components/assessment/AssessmentHub.tsx:2412`                     | TAK             | gałąź `activeTab === 'initiatives'` lokalnego `tableColumns` (`:842`, `:942`) | lokalny inline `rowMenu` (`:2428`)              | `initiatives`, przez `Api.get('/initiatives?source=assessment')` (`:648`)                         | ŻYWY: gałąź aktywnej zakładki `initiatives` (`:2402`)                                                                               |
| `src/components/assessment/manage/InitiativesManagementPanel.tsx:1353` | TAK             | lokalny `columns` (`:808`)                                                    | lokalny `buildRowMenu` (`:944`, użycie `:1365`) | `initiatives`, przez `/api/assessment-workflow-v2/:assessmentId/generated-initiatives` (`:564`)   | ŻYWY: panel sesji Oceny; render bez warunku deweloperskiego                                                                         |
| `src/components/assessment/InitiativesTable.tsx:651`                   | TAK             | lokalny `columns` (`:324`)                                                    | lokalny `buildRowMenu` (`:491`)                 | `initiatives` (klasyczny endpoint komponentu)                                                     | MARTWY w produkcie: **0 importów w `src/`**; jedyny host/import jest w `dev-render/screens/assessment-initiatives-table.tsx:18,126` |

Korekta metodologiczna: `grep -rn "StandardTable" src/ | grep -in "initiativ"` nie jest samodzielnym licznikiem rendererów. Między innymi trafia w `CapacityScenarioSurface`, `PlanScenarioSurface`, `AuditInitiativesTab` i komentarze/testy; te powierzchnie nie są rendererami tej samej listy rekordów inicjatyw z dwóch magazynów objętych dyżurem.

## Weryfikacja wejściowa

### Marker i sanity — wynik dosłowny

```text
0eff12615b merge: wyjscie z zamknietego kola logowania dwuskladnikowego
MARKER OK
0eff12615b6f00d48f9684a490ca77d9f3ebed72
```

`git status --short | head -3` nie zwrócił żadnego wiersza; `git status --short | wc -l` zwrócił `0`. Tip gałęzi bazowej był równy markerowi, więc `git log --oneline 0eff12615b..github-backup/kandydat/staging-20260902d` był pusty.

### 12 pomiarów

1. `CanonicalInitiativeRegister.tsx`: import `StandardTable` linia 7, render linia 384 — teza potwierdzona.
2. Kontrakt przed zmianą: 10 ID (`name`, `status`, `gateName`, `gateReadiness`, `owner`, `nextAction`, `expectedImpact`, `plannedWindow`, `healthState`, `updatedAt`); builder linia 98, użycie 269 — potwierdzone.
3. Kebab kanoniczny był inline przy linii 403; `StandardTable.rowMenuToSections` dokładał strefy universal/destructive — potwierdzone.
4. `AssessmentHub.tsx:942` i `InitiativesManagementPanel.tsx:808` miały osobne zestawy kolumn — potwierdzone.
5. Ramka wejściowa znaleziona: `rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 overflow-hidden` — potwierdzone.
6. `InitiativesTable.tsx` miał 0 importów w `src/`; jedyny import: `dev-render/screens/assessment-initiatives-table.tsx:18` — martwy produkcyjnie.
7. Odczyty: `postgresInitiativeReader.ts` → `ie_aggregate_state`; `InitiativeController.ts` → `FROM initiatives`; endpoint listy przy `initiativesExecutionRuntime.routes.ts:1976` — dwie tabele potwierdzone.
8. `initiativeBridgeFlag.ts:1,15` → `ff.initiative_bridge`, domyślnie false; ręczny caller `InitiativesHub.tsx:1361,1385,2355` — potwierdzone.
9. `initiative-record` i `karta-initiative` montują `InitiativeDocumentView` — potwierdzone.
10. `planning.ts:354` i `planningPortfolioReadService.ts:326` → klasyczne `initiatives` — potwierdzone.
11. Literalny grep zakończył się `rc=0`, ale ma trafienia poboczne; klasyfikowany mianownik rodziny = 4 (A.0).
12. `df -h /`: `90Gi` wolne przy pomiarze wejściowym (>5 GiB).

## §A.1 — zrzut PRZED

PASS. Cztery pliki zapisane poza repo w `/private/tmp/cx-day274-inicjatywy-jedna-tabela-artefakty/zrzuty-przed/`.

- moduł: `mean_luma_delta=218.16`, `different_pixels=99.51%`;
- Ocena: `mean_luma_delta=230.12`, `different_pixels=99.97%`;
- `uwagi=0`; mechanicznie 0 linków `/odbior.html`, 0 przycisków Panelu Uwag, 0 pasków dev.

## §A.2 — jeden kontrakt kolumn i kebaba

PASS dla trzech żywych powierzchni. `initiativeRegisterColumns.shared.ts` jest jedynym żywym źródłem 10 kolumn oraz kebaba; wołają go:

- `CanonicalInitiativeRegister.tsx`;
- `AssessmentHub.tsx`;
- `InitiativesManagementPanel.tsx`.

Test końcowy: 4/4. Mutacja jednej lokalnej kolumny wyłącznie w `AssessmentHub.tsx`: 3/4, `exit 1`; po cofnięciu ponownie 4/4. Logi: `day274-front.json`, `day274-front-mutation.json` w katalogu artefaktów.

Ograniczenie dowodu: test łączy porównanie wykonywanych builderów z kontrolą źródeł callerów; nie montuje całych trzech ciężkich drzew React. Realny render dwóch ekranów odbiorowych i równość DOM `<th>`/menu dowodzi A.5.

## §A.3 — pełna szerokość

PASS. Usunięto wyłącznie klasowaną ramkę-kartę opakowującą panel. Test kontraktowy oraz skrypt PO sprawdzają brak przodka tabeli z kompletem klas `rounded-xl border ... bg-white ... overflow-hidden`. Nie zmieniano tokenów, marginesów ani typografii.

## §A.4 — inicjatywa z Oceny dociera do listy modułu

**CZERWONY KONTRAKT / NIE NAPRAWIONO MAGAZYNU.** Realny test przez `ApiGateway`, podpisany JWT i Postgres wykonał `POST /api/assessment-workflow-v2/:assessmentId/initiatives`, a następnie `GET /api/initiatives/runtime-v1/initiatives`. Po zdjęciu `it.fails` wynik był czerwony:

```text
AssertionError: expected [] to deeply equal ArrayContaining{…}
at server/src/routes/__tests__/day274-ocena-dociera-do-listy.pg.test.ts:123:37
```

Kontrakt pozostaje jawnie jako `it.fails`; wraz z A.6 pakiet końcowy ma 2/2. Nie dopisałem bezpośredniego `INSERT` do `ie_aggregate_state`: byłby nieatomowym dual-write omijającym `executeMaterialCommand`, receipt, event, audit i outbox, czyli nieuczciwym rozstrzygnięciem Z41.

## §A.5 — zrzut PO

PASS. Skrypt wygenerował 8 obrazów (bazowe i z otwartym kebabem, light/dark). Asercje DOM:

```text
headers=["Inicjatywa","Cykl życia","Następna bramka","Gotowość","Właściciel","Następne działanie","Oczekiwany efekt","Planowane okno","Kondycja","Aktualizacja",""]
menu=["Otwórz","Otwórz podgląd","ArchiwizujZmiany lifecycle i archiwizacja są wykonywane w kontrolowanym procesie."]
```

Wartości są identyczne w module i Ocenie, light i dark. Brak przyrządu oraz ramki-karty został sprawdzony mechanicznie. Kontrola wzrokowa czterech obrazów light potwierdziła czysty kadr, pełną tabelę i otwarte kebaby.

## §A.6 — obcy nie widzi / właściciel widzi

PASS. Właściciel organizacji otrzymuje `200` dla listy runtime-v1. Obcy owner pytający jawnie o `organizationId` właściciela otrzymuje `404`; odpowiedź nie zawiera tytułu rekordu. Test na realnym PG, `ENABLE_TEST_AUTH_BYPASS=false`, `--retry=0`.

## DO DECYZJI WŁAŚCICIELA

Dyżur nie rozstrzyga `ie_aggregate_state` kontra `initiatives` (Z41).

| Wariant                                                                                                             | Zaleta                                                         | Koszt/ryzyko                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| A. `ie_aggregate_state` jako writer/read model kanoniczny, a klasyczne `initiatives` jako projekcja kompatybilności | Jeden event spine, receipts/audit/outbox i spójna lista modułu | Migracja wszystkich klasycznych writerów i kontrolowana projekcja wstecz; większy program, nie poprawka w jednym serwisie |
| B. `initiatives` jako kanon, a runtime-v1 jako projekcja z trwałym outboxem                                         | Najmniej zmian dla Oceny i istniejących kart                   | Trzeba zdefiniować transakcyjny outbox, idempotentny projektor, replay/backfill i zachowanie CAS runtime-v1               |

Rekomendacja bez podejmowania decyzji: wybrać jeden writer SSOT, a drugi magazyn utrzymywać wyłącznie jako odbudowywalną projekcję z transakcyjnym outboxem. Nie akceptować synchronicznego „drugiego INSERT-u” w `createInitiativeService` bez receipt/event/audit/replay.

## Mianowniki B.3

| #                                   | Autor |                     Pomiar Day 274 | Wynik                                                   |
| ----------------------------------- | ----: | ---------------------------------: | ------------------------------------------------------- |
| Renderery rodziny                   |     4 |                                  4 | zgodne po klasyfikacji, nie po liczbie trafień grep     |
| Ręczne kontrakty PRZED              |     3 |         3 żywe + 1 martwy odłożony | liczba 3 dotyczy żywych powierzchni                     |
| Ręczne kontrakty PO                 |     1 | 1 żywy wspólny + 1 martwy odłożony | zgodne dla zakresu żywego; total źródłowy = 2 przez Z41 |
| Kolumny kanoniczne                  |    10 |                                 10 | zgodne                                                  |
| Importy martwego renderera w `src/` |     0 |                                  0 | zgodne                                                  |
| Tabele DB                           |     2 |                                  2 | zgodne                                                  |
| Automatyczne mostki                 |     0 |                                  0 | zgodne; A.4 potwierdza pustą listę                      |

## Korekty wobec instrukcji

- Literalny grep z §0.1(11) daje szerszy zbiór trafień niż rodzina czterech rendererów; klasyfikacja powyżej zachowuje mianownik 4, ale nie utożsamia liczby linii grep z liczbą rendererów.
- Repo wymaga skilla `consultify-triada` w `CLAUDE.md`, lecz skill nie jest dostępny w tej sesji. Kontynuuję według kompletnej instrukcji dyżuru i nie rozszerzam zmian wizualnych poza A.2/A.3.
- Komenda §0.2c(B) uruchomiona z roota i `--config server/vitest.config.ts` zwraca `No test files found`, ponieważ include w configu jest względne do cwd. Wiążący przebieg wykonano z cwd `server/` i ścieżką `src/routes/...`.
- A.2 mówi o trzech żywych powierzchniach, a B.3 oczekuje jednego kontraktu PO, podczas gdy Z41 zabrania zmiany martwego `InitiativesTable.tsx`. Wynik: jeden kontrakt żywy plus jeden martwy, jawnie odłożony.
- `initiative-record` jest kartą pojedynczego rekordu (`InitiativeDocumentView`), nie rendererem listy. Nie ma własnej listy/kolumn/kebaba tabeli, więc plik pozostał tylko do odczytu; interpretacja warunku 15 jest jawna i podlega obaleniu przez nadzorcę.

## STOP-y

Brak STOP-u całego dyżuru: marker poprawny, 90 GiB wolne, porty `6290`, `5270`, `5271` wolne. Merytoryczny brak A.4 jest czerwonym kontraktem zgodnie z §0.5, nie proceduralnym STOP-em.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie ma dowodu, że właściciel zaakceptował obrazy.
- Nie ma decyzji, który magazyn jest SSOT.
- Nie ma automatycznego dotarcia rekordu Oceny do runtime-v1; A.4 pozostaje oczekiwaną czerwienią.
- Nie wykonano pełnego builda ani pełnego korpusu testów (zakaz/zakres dyżuru).
- Nie ma zgodnego pomiaru PRZED nazw testów, ponieważ oba dedykowane pliki testowe powstały w tym dyżurze; nie przedstawiam późniejszej listy jako baseline.

## Pomiar zasięgu §0.4a

Pomiar PO po pełnych nazwach:

```text
utrzymuje dziesięć identyfikatorów kolumn w ustalonej kolejności
utrzymuje te same pozycje kebaba na trzech powierzchniach
każda żywa powierzchnia woła wspólny builder i nie deklaruje lokalnego kontraktu
panel Oceny nie opakowuje tabeli w ramkę-kartę raportu w raporcie
POST z Oceny jest widoczny przez GET runtime-v1 [it.fails: oczekiwana czerwień]
obcy tenant nie widzi inicjatyw właściciela
```

`diff przed-nazwy.txt po-nazwy.txt`: **EVIDENCE_MISSING** — testy nie istniały przed ich dodaniem, a nie wykonano pomiaru nazw przed pierwszą zmianą. To narusza §0.4a/Z24 i blokuje status pełnego `FIXED`; liczby PO nie są przepisywane z instrukcji.

## Manifest zrzutów i Z40

```text
1590cd8dabb588fb4eaaed4d829340af8493483a60368ec1b27f799801967e87  po-modul-dark.png
6d2d8d6f54f86a8c2607f7b84ac30388b1a912275917b00db8ed38c07c708d12  po-modul-kebab-dark.png
ca0890ba5a829b30198f69bd9f2ff53726a769db69a6d48df806ab31db49859c  po-modul-kebab-light.png
c1deca2a1958666ef014dd6b2e6b2a06e3e3b8643071b87c9287c7832d4e1f6f  po-modul-light.png
87963a961004c6683c006341a747aea068776675894c5005e30c87ec831a343d  po-ocena-dark.png
102994ebd8d0475f8ee137b448ff9e407d1ad612bc988e1a5ec551b37090bfec  po-ocena-kebab-dark.png
45e4d202d28a5a442eac6e77a8e8dfd21833aa702132401a1d75bc84bc5b7769  po-ocena-kebab-light.png
7bbcd7302f012d34110a1973c625c321ed0bf2516377d0f8ebde5461a39418f0  po-ocena-light.png
```

Z40 PO: moduł `mean_luma_delta=218.16`, `different_pixels=99.51%`; Ocena `mean_luma_delta=229.80`, `different_pixels=99.96%`. Wszystkie wartości przekraczają progi 40 i 60%.

## Z30 — brak wysyłki

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Dowód: env → `BRAK ZMIENNYCH POCZTY`; `SELECT ... FROM settings WHERE key LIKE 'smtp%'` → `(0 rows)`.

## Z33 — strażniki testowe

- `ENABLE_V8_GLOBAL=true` podano inline; `Gateway.ts:1486` montuje `/api/v8` za `v8FeatureGate`.
- `resultsInternalBetaVisibility` nie leży na zmierzonej ścieżce (`rc=1`).
- `DB_TYPE=postgres` jest pierwszą asercją testu; pełny RealPG env podano inline.
- `ENABLE_TEST_AUTH_BYPASS=false`; test używa podpisanych JWT.
- Nie zmieniono `executionSpineLegacyReadOnly.middleware.ts`; POST Oceny osiągnął handler i utworzył wiersz klasyczny, a brak nastąpił dopiero w GET runtime-v1.
