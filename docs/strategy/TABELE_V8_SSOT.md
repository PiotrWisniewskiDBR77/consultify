# Tabele v8 - SSOT

> Status: Single Source of Truth for `Tabele v8`
> Cel: Zdefiniowac kanoniczny model produktu, granice, AI contract i completeness criteria dla rozwoju platformy tabel w `consultify`.

---

## 1. Purpose

`Tabele v8` to seria prac, ktora ma domknac `consultify` jako:

`metadata-first table platform with workspace projections`

Nie budujemy nowego produktu obok aplikacji.
Rozwijamy istniejacy system:
- `IdeaTableTool`
- `useTablePlatformBridge`
- `useTablePlatformIntegration`
- `table-platform` backend

Docelowo tabela ma byc:
- kanonicznym systemem pracy na danych,
- warstwa workflow i operacji,
- powierzchnia AI-assisted schema building,
- elementem osadzonym w shellu i workspace graph aplikacji.

---

## 2. Product principles

### 2.1 Metadata-first

Kanoniczna prawda o bazie, tabeli, polach, widokach i rekordach zyje w `table-platform`.

### 2.2 Workspace-embedded

Platforma tabel pozostaje osadzona w istniejacej architekturze workspace i `My Work`.

### 2.3 Adapter-first migration

Przejscie z legacy `graph-first` do `metadata-first` dzieje sie przez adaptery, feature flags i pilot rollout, a nie broad rewrite.

### 2.4 One data truth, many work surfaces

Te same rekordy moga zasilac:
- grid,
- views,
- forms,
- interfaces,
- automations,
- distribution,
- AI analysis.

### 2.5 AI is proposal-driven

AI przyspiesza budowe i ewolucje bazy, ale nie ma prawa do cichych mutacji.

### 2.6 Completeness over MVP

`v8` nie jest planem okrojonego minimum.
To plan dojrzalej platformy, ale wdrazanej falami i z kontrola ryzyka.

---

## 3. Scope

`Tabele v8` obejmuja osiem warstw:
- `BaseAndTableModel`
- `SchemaAndFields`
- `RecordsAndViews`
- `RelationsAndDependencies`
- `InputLayer`
- `InterfacesAndPresentation`
- `AutomationAndDistribution`
- `AI-native`

Poza zakresem:
- kopiowanie Airtable lub Coda 1:1,
- przebudowa calego shella aplikacji,
- mieszanie standardu `app table` z pelna platforma tabel bez jasnych granic,
- silent AI mutations,
- broad rewrite `MyWorkHub` i pobocznych modulow.

---

## 4. Kanoniczny model domenowy

### 4.1 Base

`base` to najwyzszy kontener domenowy platformy tabel.

Base:
- grupuje wiele tabel,
- przechowuje ownership i metadata,
- stanowi granice dla sharing, governance i integrations,
- jest podstawowa jednostka rollout/migration w modelu platformy.

### 4.2 Table

`table` to kanoniczna jednostka pracy na rekordach w ramach `base`.

Table:
- ma schema,
- ma primary field,
- ma zestaw views,
- moze byc zrodlem forms, interfaces, automations i connectors.

### 4.3 Field

`field` to definicja danych, nie tylko kolumna wizualna.

Field:
- ma typ,
- ma opcje,
- moze byc computed,
- moze definiowac relacje lub zaleznosci,
- steruje walidacja, filtrowaniem, importem, AI i presentation logic.

### 4.4 Record

`record` to pojedyncza instancja danych tabelarycznych.

Record:
- zyje w ramach `table`,
- moze miec attachments, comments, watches i audit trail,
- moze byc linkowany z innymi rekordami,
- jest jednostka workflow, nie tylko wierszem w gridzie.

### 4.5 View

`view` to zapisana perspektywa pracy na tych samych rekordach.

View:
- nie duplikuje danych,
- definiuje filters, sorts, grouping, visibility i presentation semantics,
- moze byc osobista, shared lub rolozalezna,
- jest first-class obiektem platformy.

### 4.6 Record template

`record template` to zdefiniowany startowy ksztalt rekordu dla wybranego scenariusza pracy.

### 4.7 Form

`form` to kontrolowana warstwa wejscia danych do tabeli.

### 4.8 Interface

`interface` to curated surface zbudowana nad records/views tej samej bazy.

### 4.9 Automation

`automation` to jawnie zdefiniowana regula dzialajaca na eventach, czasie lub zmianach danych.

### 4.10 Projection

`projection` to zgodna z adapterami reprezentacja danych platformy tabel w workspace graph i innych powierzchniach produktu.

Projection:
- nie jest kanoniczna warstwa storage,
- sluzy kompatybilnosci i integracji,
- nie moze przejmowac roli prawdy o schema.

---

## 5. Canonical architecture statement

Warstwy `Tabele v8`:

### 5.1 Canonical persistence plane

`table-platform` backend:
- bases,
- tables,
- fields,
- views,
- records,
- relations,
- attachments,
- forms,
- interfaces,
- automations,
- schema proposals,
- audit.

### 5.2 Projection plane

Adaptery i migracje:
- `useTablePlatformBridge`
- `useTablePlatformIntegration`
- projection services

### 5.3 Interaction plane

Frontendowe surfaces pracy:
- `IdeaTableTool`
- forms
- interfaces
- workflow/dashboard panels

### 5.4 AI plane

Services i UX dla:
- schema proposals,
- data generation proposals,
- view/interface/automation proposals,
- controlled execution i audit.

---

## 6. App table vs full table platform

To rozroznienie jest kanoniczne.

### 6.1 App table

`app table`:
- jest standardem prezentacji listy danych w module aplikacyjnym,
- podlega `app-table-standard`,
- nie musi udawac wielotabelowej platformy danych.

### 6.2 Full table platform

`full table platform`:
- operuje na `base`,
- ma schema i views jako first-class objects,
- wspiera forms, interfaces, automations, migrations i AI schema building,
- moze miec wiele tabel i relacji,
- wymaga osobnych zasad completeness i governance.

### 6.3 Regula graniczna

Jesli powierzchnia potrzebuje:
- wielu tabel,
- relacji,
- forms,
- interfaces,
- schema evolution,
- AI proposals,
- migration-safe persistence,

to nie jest juz zwykla `app table`, tylko powierzchnia pelnej platformy tabel.

---

## 7. AI contract

Kanoniczna zasada `v8`:

`propose -> review -> accept/reject -> execute -> audit`

### 7.1 AI moze

- zaproponowac baze, tabele, pola, widoki i relacje,
- zaproponowac imports mapping,
- zaproponowac demo data,
- zaproponowac forms, interfaces i automations,
- wyjasnic skutki zmian,
- wspierac refine / undo / redo.

### 7.2 AI nie moze

- mutowac schema bez zgody uzytkownika,
- po cichu tworzyc relacji lub automations,
- zmieniac danych produkcyjnych bez jawnego review scope,
- wykonywac broad changes bez diff i audit trail.

### 7.3 Minimalny audit trail

Kazda operacja AI powinna miec:
- autora i zrodlo,
- timestamp,
- proposal payload,
- diff planowanych zmian,
- decyzje `accepted/rejected`,
- wynik wykonania,
- mozliwosc analizy cofniecia lub iteracji.

---

## 8. Completeness criteria

`Tabele v8` sa kompletne dopiero wtedy, gdy kazda warstwa ma zamkniety kontrakt produktu.

### 8.1 BaseAndTableModel

Wymagania:
- base jest first-class container,
- multi-table shell jest jasny,
- ownership/sharing boundary jest zdefiniowany,
- migracja legacy ma jawna mape.

### 8.2 SchemaAndFields

Wymagania:
- field system jest kanoniczny i spojny,
- field config ma twardy model,
- computed/linked/lookup/rollup/formula sa traktowane jako core,
- governance dla zmian schema jest jasno opisana.

### 8.3 RecordsAndViews

Wymagania:
- records/query API jest kanoniczne,
- saved views sa first-class,
- grid i alternatywne views pracuja na tym samym modelu danych,
- search/retrieval entry points prowadza do tych samych canonical records i views,
- bulk actions, footers i status signals sa spojne.

### 8.4 RelationsAndDependencies

Wymagania:
- linked records maja jawna semantyke,
- reverse relation semantics sa stabilne,
- dependencies nie sa tylko wizualnym dodatkiem,
- system chroni przed niespojnoscia i cyklami.

### 8.5 InputLayer

Wymagania:
- importy sa kontrolowane i pilot-ready,
- forms sa pierwszoklasowa warstwa inputu,
- record templates skracaja capture flows,
- intake nie omija governance.

### 8.6 InterfacesAndPresentation

Wymagania:
- interfaces sa oparte na tych samych danych,
- istnieje jasna granica miedzy views a interfaces,
- presentation surfaces nie duplikuja storage logic.

### 8.7 AutomationAndDistribution

Wymagania:
- trigger/rule/execution model jest jawny,
- webhooks i sync maja auditowalny kontrakt,
- rollout nie destabilizuje core tabel.

### 8.8 AI-native

Wymagania:
- AI ma proposal-driven contract,
- schema safety i rollback semantics sa jawne,
- evals/testy obejmuja jakosc propozycji i safety.

---

## 9. Success metrics

`v8` powinno poprawic:
- czas od intencji do dzialajacej bazy,
- jakosc pierwszego schema,
- bezpieczenstwo ewolucji schema,
- czas od pytania do trafnego rekordu, widoku lub odpowiedzi,
- procent flows obslugiwanych bez manual workaround,
- pilot success rate dla metadata-first mode,
- zaufanie do AI poprzez reviewability i audit.

---

## 10. Non-goals

`Tabele v8` nie oznacza:
- budowy klona Airtable,
- budowy Coda-like docs suite w calosci,
- przeniesienia calej aplikacji na table metaphor,
- porzucenia workspace graph bez okresu przejsciowego,
- usuniecia feature flags zanim pilot i migracja beda sprawdzone.

---

## 11. Final north star

Po wdrozeniu `Tabele v8` uzytkownik powinien moc:
- opisac problem,
- dostac proposal bazy i tabel,
- bezpiecznie zbudowac schema,
- pracowac na records w wielu views,
- zbierac dane przez forms,
- publikowac curated surfaces przez interfaces,
- uruchamiac automations,
- utrzymac calosc w modelu governance i audit,
- a wszystko to bez wyjscia poza istniejacy shell i architekture `consultify`.
