# Tabele v8 - Benchmark funkcjonalny

> Status: Draft v8
> Cel: Ekstrakcja wzorcow funkcjonalnych z materialow `Softs/tabele` dla rozwoju platformy tabel `Consultify`.
> Zasada: Inspirujemy sie funkcjonalnoscia i modelem pracy, nie kopiujemy UI/UX ani layoutow.

---

## 1. Scope benchmarku

Zrodla:
- `Softs/tabele/AirTable/Screen/*`
- `Softs/tabele/AirTable/_analysis_extract/*`
- `Softs/tabele/Coda.zip`

Benchmark obejmuje:
- model bazy i wielu tabel,
- model pol i semantyki danych,
- prace na rekordach i widokach,
- relacje i zaleznosci,
- warstwe wejscia danych,
- warstwe interfaces / prezentacji na tych samych rekordach,
- automatyzacje i dystrybucje,
- AI-native flow tworzenia tabel.

Benchmark nie obejmuje:
- kopiowania ukladow ekranu,
- kopiowania komponentow interfejsu,
- budowy klona Airtable lub Coda,
- przejmowania obcych modeli produktu bez adaptacji do `consultify`.

---

## 2. Jak czytac ten benchmark

Dla kazdego wzorca stosujemy jeden schemat:
- `ProblemUsera`
- `MechanikaProduktu`
- `DlaczegoToDziala`
- `CzyPasujeDoConsultify`
- `AdaptacjaV8`
- `RyzykoPrzeinzynierowania`

To pozwala podejmowac decyzje produktowe bez efektu "zrobmy po prostu Airtable u nas".

---

## 3. Co wnosi Airtable, a co wnosi Coda

### 3.1 Airtable - glowny wklad

Na podstawie screenshotow i materialow Airtable widac najmocniej:
- `field types`
- `manage fields`
- `data dependencies`
- `interfaces`
- `forms`
- `templates`
- multi-table work i zarzadzanie tabela jako baza operacyjna

Wniosek:
- Airtable jest glownym benchmarkiem dla `table operating system`.
- Najwiecej wartosci daje w warstwie: schema, records, views, forms, interfaces, dependencies.

### 3.2 Coda - glowny wklad

Na podstawie archiwum `Coda.zip` widac najmocniej:
- `product` i `compare`
- `packs`
- `publishing`
- `solutions/scenario/meetings`
- `guides/how-to-build-a-team-hub`

Wniosek:
- Coda jest benchmarkiem pomocniczym dla `docs + tables + workflow composition`.
- Najwiecej wartosci daje w warstwie: dokument jako aplikacja, workflow, integracje i surfaces ponad danymi.

### 3.3 Strategia dla Consultify

`Consultify Tables v8` powinny:
- z Airtable przejac jakosc modelu danych i warstw pracy na rekordach,
- z Coda przejac jakosc komponowania workflow i prezentacji danych w kontekscie pracy,
- dodac warstwe, ktorej oba produkty nie maja w tej samej formie: silne osadzenie w workspace graph, governed models i AI proposal-driven schema mutation.

---

## 4. Macierz Airtable vs Coda vs Consultify as-is

| Obszar | Airtable | Coda | Consultify as-is | Wniosek v8 |
|---|---|---|---|---|
| Base / multi-table model | Bardzo mocny model `base` i wielu tabel | Mocniejsze komponowanie w dokumencie niz wyrazny `base shell` | Backend ma `base`, ale UX nie traktuje go jeszcze jako glownego modelu | Trzeba wyniesc `base` i multi-table work do kanonicznego experience |
| Schema / field system | Najmocniejszy benchmark typow pol i field governance | Mniej nacisku na klasyczny field system, wiecej na workflow composition | Szeroki model typow juz istnieje | Domknac governance i canonical schema workflow |
| Records / views | Bardzo mocne widoki i saved view discipline | Silne surfaces kontekstowe ponad danymi | Widoki i query sa bogate, ale produktowo nie w pelni skonsolidowane | Utrzymac view richness, ale uproscic operating model |
| Relations / dependencies | Linked records, lookup, rollup, date dependencies | Relacje bardziej osadzone w workflow dokumentowym | Relacje i dependencies istnieja technicznie | Doprecyzowac semantyke backendowa i product contract |
| Input layer | Forms i templates sa mocne i praktyczne | Workflow intake osadzony w dokumencie | Forms, templates i importy juz istnieja | Zrobic z inputu first-class workflow, nie tylko funkcje poboczne |
| Interfaces / presentation | Curated interfaces nad tymi samymi danymi | Bardzo mocne composite surfaces | Interfaces sa obecne, ale nie sa jeszcze pierwszoplanowym story | Zdefiniowac role interfaces vs views |
| Automation / distribution | Silne automations i sync mindset | Packs, publishing i workflow composition | Automations, webhooks i sharing istnieja | Etapowac rollout: core first, process layer second |
| AI-native | Omni: `describe -> plan -> build` | AI bardziej wspiera workflow i dokument | Schema proposal flow istnieje architektonicznie | Uczynic AI proposal-driven governance glowna przewaga produktu |
| Search / retrieval | Search jest bardziej data-surface oriented | Retrieval mocniej osadzone w dokumencie i workflow | Search/retrieval nie jest jeszcze osobno nazwanym filarem planu | Dodac jawny filar discovery/retrieval w v8 |

Ta tabela nie zastępuje benchmarku opisowego.
Jej celem jest szybkie zestawienie trzech perspektyw w jednym miejscu.

---

## 5. Benchmark po obszarach

### 5.1 Base and multi-table model

#### Wzorzec A - Base jako kontener wielu tabel

ProblemUsera:
- Jeden problem biznesowy rzadko miesci sie w jednej tabeli.

MechanikaProduktu:
- Airtable traktuje `base` jako kontener dla wielu powiazanych tabel.
- Coda czesciej sklada dane i workflow w jednym dokumencie z wieloma tabelami i sekcjami.

DlaczegoToDziala:
- Uzytkownik pracuje na systemie danych, nie na jednej siatce.
- Relacje miedzy tabelami staja sie naturalne.

CzyPasujeDoConsultify:
- Tak, bardzo mocno.
- To jest juz zgodne z backendowym modelem `base -> tables`, ale nie jest jeszcze glowna warstwa UX.

AdaptacjaV8:
- `base` jako kanoniczny kontener,
- wiele tabel w jednej bazie,
- przejrzysty shell przelaczania miedzy tabelami,
- jedno miejsce dla sharing/governance na poziomie bazy.

RyzykoPrzeinzynierowania:
- Probowac migrowac wszystkie legacy workspace od razu.
- Rozszerzac shell zbyt szeroko przed stabilizacja adapterow.

### 5.2 Schema and fields

#### Wzorzec B - Zarzadzanie polami jako zarzadzanie modelem danych

ProblemUsera:
- Prawdziwa tabela operacyjna nie jest zbiorem kolumn tekstowych, tylko modelem danych.

MechanikaProduktu:
- Airtable pokazuje `manage fields` i rozbudowany zestaw `field types`.
- Pole ma typ, opcje, role i zaleznosci od innych pol.

DlaczegoToDziala:
- Wszystko inne zalezy od typu pola: filtr, walidacja, formularz, automatyzacja, interface, AI.

CzyPasujeDoConsultify:
- Tak.
- Wasz model `FieldType` jest juz szeroki i obejmuje m.in. `linkedRecord`, `lookup`, `rollup`, `formula`, `attachment`.

AdaptacjaV8:
- `field manager` traktowac jako kanoniczne centrum zarzadzania schema,
- pole = definicja danych, nie tylko kolumna do wyswietlenia,
- AI schema proposals maja pracowac na typach i opcjach pol.

RyzykoPrzeinzynierowania:
- Dodanie wielu typow bez domknietego UX dla ich konfiguracji.
- Traktowanie pola jak czysto frontendowej konfiguracji.

### 5.3 Records and views

#### Wzorzec C - Widoki to warstwa pracy, nie dekoracja

ProblemUsera:
- Te same rekordy musza byc ogladane inaczej przez rozne role i use case.

MechanikaProduktu:
- Airtable daje grid, kanban, timeline, calendar, interfaces i zapisane views.
- Coda laczy tabele z curated doc surfaces.

DlaczegoToDziala:
- Uzytkownik pracuje na tej samej prawdzie danych w roznych perspektywach.

CzyPasujeDoConsultify:
- Tak.
- Wasz system ma juz wiele view types, ale trzeba odroznic `view richness` od `platform coherence`.

AdaptacjaV8:
- utrzymac kanoniczny model `view`,
- server-side query jako standard,
- saved views jako first-class object,
- footers/status bar i inne sygnaly operacyjne jako czesc grid discipline.

RyzykoPrzeinzynierowania:
- Mnozenie view types bez stabilnego kontraktu query i danych.

### 5.4 Relations and dependencies

#### Wzorzec D - Relacje i date dependencies sa semantyka platformy

ProblemUsera:
- Tabela ma wspierac proces, plan i zaleznosci, a nie tylko przechowywac rekordy.

MechanikaProduktu:
- Airtable pokazuje `linked records`, `lookup`, `rollup` i `date dependencies`.
- Coda bardziej wspiera relacje w kontekscie workflow dokumentowego.

DlaczegoToDziala:
- Dane staja sie systemem, nie lista.
- Proces PM i operacyjny da sie oprzec na modelu danych.

CzyPasujeDoConsultify:
- Tak, bardzo mocno.
- To jest naturalne dla consulting ops, roadmap, execution i finansow.

AdaptacjaV8:
- linked records i reverse semantics jako fundament,
- date dependencies jako warstwa procesowa nad rekordami,
- dependency visualization tylko wtedy, gdy semantyka jest backendowo trwala.

RyzykoPrzeinzynierowania:
- Dodac zaleznosci tylko jako UI arrows bez trwalej semantyki w backendzie.

### 5.5 Input layer

#### Wzorzec E - Forms i record templates

ProblemUsera:
- Dane powinny byc doprowadzane do systemu w sposob kontrolowany i powtarzalny.

MechanikaProduktu:
- Airtable daje forms i record templates.
- Coda wzmacnia wejscie przez workflow wokol dokumentu.

DlaczegoToDziala:
- Uzytkownik nie musi rozumiec calej bazy, zeby wprowadzic poprawne dane.
- Wprowadzanie staje sie szybsze i bezpieczniejsze.

CzyPasujeDoConsultify:
- Tak.
- Forms i template records maja wysoka wartosc dla intake, PM, data collection i operations.

AdaptacjaV8:
- forms jako osobna warstwa inputu,
- record templates dla tabel procesowych,
- import CSV/XLSX/API jako wejsciowa warstwa hurtowa.

RyzykoPrzeinzynierowania:
- Traktowac forms jako osobny produkt bez pelnego spiecia z records/schema.

### 5.6 Interfaces and presentation

#### Wzorzec F - Interfaces jako curated surfaces

ProblemUsera:
- Nie kazdy odbiorca powinien pracowac bezposrednio na gridzie.

MechanikaProduktu:
- Airtable `interfaces` buduja dashboardy i task-specific screens na tych samych danych.
- Coda robi to szerzej przez dokument, sekcje i komponowane surfaces.

DlaczegoToDziala:
- Ta sama baza obsluguje rozne role i scenariusze.
- Produkt staje sie bardziej przyjazny dla finalnych odbiorcow.

CzyPasujeDoConsultify:
- Tak.
- To moze byc bardzo mocna warstwa dla curated consulting tools i decision surfaces.

AdaptacjaV8:
- interfaces jako first-class warstwa ponad records/views,
- bez dublowania danych,
- z jawnym kontraktem relacji do base/table/view.

RyzykoPrzeinzynierowania:
- Budowanie page buildera bez jasnego modelu runtime i zapisow.

### 5.7 Automation and distribution

#### Wzorzec G - Tabela jako centrum procesow

ProblemUsera:
- Dane bez automatyzacji i dystrybucji szybko zamieniaja sie w pasywne repozytorium.

MechanikaProduktu:
- Airtable pokazuje automations i sync mindset.
- Coda wnosi packs, publishing i workflow composition.

DlaczegoToDziala:
- Dane zaczynaja wykonywac prace.

CzyPasujeDoConsultify:
- Tak, ale po etapowym domknieciu core.

AdaptacjaV8:
- automations, connectors, webhooks, sync i distribution traktowac jako osobna warstwe,
- nie obiecywac pelnego maturity, dopoki core records/schema/views nie sa pilot-ready.

RyzykoPrzeinzynierowania:
- Rozbudowa automations przed domknieciem podstaw platformy.

### 5.8 AI-native table building

#### Wzorzec H - NL to schema plan to approval

ProblemUsera:
- Uzytkownik chce opisac potrzebe, a nie recznie budowac wszystkie pola, widoki i dane od zera.

MechanikaProduktu:
- Airtable Omni idzie w `describe -> plan -> build`.
- Coda wspiera skladanie workflow i bardziej dokumentowy AI assistance.

DlaczegoToDziala:
- Obniza bariere wejscia do zlozonej platformy danych.
- Przyspiesza time-to-value.

CzyPasujeDoConsultify:
- Tak, to ma byc jedna z glownych przewag `v8`.

AdaptacjaV8:
- `NL -> schema proposal -> approval -> execution`,
- auto-demo data i automation suggestions tylko jako proposal-driven layer,
- AI nie mutuje schema bez jawnej akceptacji.

RyzykoPrzeinzynierowania:
- "magic build" bez zaufania, walidacji i rollback semantics.

---

## 6. Co adoptujemy, a czego nie kopiujemy

### 5.1 Adoptujemy

- `base` jako wielotabelowy kontener,
- pole jako kanoniczna definicja danych,
- saved views i query discipline,
- forms i record templates,
- interfaces jako curated surfaces,
- dependencies i relacje jako semantyka backendowa,
- AI proposal-driven table building.

### 5.2 Nie kopiujemy

- calego wizualnego modelu Airtable,
- wszystkich toolbar patterns 1:1,
- wszystkiego z Coda docs-as-product,
- funkcji premium tylko dlatego, ze istnieja u lidera,
- broad rewrite shell aplikacji.

---

## 7. Benchmark conclusion

Docelowy model `Tabele v8` powinien laczyc trzy rzeczy:
- `Airtable quality of table operating model`
- `Coda quality of workflow composition`
- `Consultify quality of governed, AI-assisted, workspace-embedded data work`

To oznacza:
- tabela nie moze pozostac tylko narzedziem w workspace,
- ale tez nie powinna stac sie oderwanym produktem obok aplikacji,
- musi byc kanoniczna platforma danych osadzona w istniejacej architekturze.

---

## 8. Priorytety wynikajace z benchmarku

### P0

- multi-table base shell,
- field system and field governance,
- canonical records/views/query model,
- linked records and relation semantics,
- AI proposal-driven schema mutation,
- migration-safe metadata-first core.

### P1

- forms and record templates,
- interfaces as curated surfaces,
- status bar / footers / stronger grid operational cues,
- date dependencies for PM-like workflows.

### P2

- richer publishing and packs-like integrations,
- advanced automation and sync,
- deeper doc+table fusion beyond primary platform scope.

---

## 9. Evidence map

Ta sekcja nie jest pelnym indeksem archiwow.
Jej celem jest pokazanie, z jakich klas materialow wynikaly glownie wnioski benchmarkowe.

### 8.1 Airtable evidence clusters

- `Screen/11 Field type *.png`
  Potwierdza rozbudowany system typow pol jako fundament platformy.
- `Screen/9 tools - manage fields *.png`
  Potwierdza, ze zarzadzanie polami jest odrebna, pierwszoplanowa powierzchnia.
- `Screen/13 Data dependecies *.png`
  Potwierdza date dependencies jako funkcje procesowa, nie tylko wizualna.
- `Screen/14 Interfaces *.png`
  Potwierdza interfaces jako osobna warstwe pracy na tych samych rekordach.
- `Screen/15 Forms *.png`
  Potwierdza forms jako osobna warstwe inputu.
- `Screen/8 zadanie tabela *.png`
  Potwierdza multi-table work i shell przechodzenia miedzy tabelami.

### 8.2 Coda evidence clusters

- `Coda/coda.io/product.html`
  Potwierdza product-level model docs + tables + workflow.
- `Coda/coda.io/signup...product/packs.html`
  Potwierdza znaczenie integracji i packs.
- `Coda/coda.io/signup...product/publishing.html`
  Potwierdza publishing/presentation surfaces ponad danymi.
- `Coda/coda.io/signup...solutions/scenario/meetings.html`
  Potwierdza workflow-centric compositions.
- `Coda/coda.io/signup...resources/guides/how-to-build-a-team-hub.html`
  Potwierdza team hub i composite operating model.

### 8.3 Jak korzystac z evidence map

Zasada dla kolejnych serii `v8`:
- benchmark powinien miec nie tylko wniosek,
- powinien miec tez minimalny `evidence trail`,
- tak aby bylo jasne, z czego wynikala adaptacja funkcjonalna.
