# Tabele v8 - Workflow Model

> Status: Draft v8
> Cel: Zdefiniowac docelowy model pracy uzytkownika na platformie tabel `consultify`.

---

## 1. North star workflow

Kanoniczny workflow `Tabele v8`:

`start -> define base -> shape schema -> populate data -> create working views -> retrieve and analyze -> collect and connect -> present and automate -> govern and scale`

To oznacza:
- tabela nie konczy sie na gridzie,
- schema, records, views, forms, interfaces i automations musza skladac sie w jeden operacyjny system,
- AI ma przyspieszac budowe i zmiany, ale nie omijac governance.

---

## 2. Glowne tryby startu

### 2.1 Blank start

Uzytkownik:
- zaklada nowa `base`,
- tworzy pierwsza tabele recznie,
- definiuje primary field i podstawowe pola.

Cel:
- szybki start dla znanego modelu danych.

### 2.2 Import-first

Uzytkownik:
- wnosi CSV/XLSX/Google Sheet/API payload,
- system proponuje schema,
- uzytkownik akceptuje mapowanie i tworzy baze/tabele.

Cel:
- skrocenie czasu do pierwszych wartosci dla danych juz istniejacych.

### 2.3 AI-first

Uzytkownik:
- opisuje problem lub workflow w jezyku naturalnym,
- system proponuje `base plan`, tabele, pola, relacje, widoki i starter data,
- uzytkownik recenzuje i zatwierdza proposal.

Cel:
- obnizyc prog wejscia do zlozonego systemu tabel.

### 2.4 Template-first

Uzytkownik:
- wybiera szablon tabeli lub bazy,
- dostaje gotowy schema starter,
- dostosowuje go do swojego use case.

Cel:
- przyspieszyc uruchamianie powtarzalnych procesow.

---

## 3. Lifecycle bazy i tabel

### 3.1 Base lifecycle

`create -> structure -> operationalize -> govern -> scale`

#### Create
- powstaje `base` jako kontener pracy na danych.

#### Structure
- powstaja tabele, relacje, pola, views i podstawowe zasady.

#### Operationalize
- baza zaczyna byc uzywana przez forms, imports, workflows i teams.

#### Govern
- wlaczane sa sharing rules, audit, quality controls, approvals i AI safety.

#### Scale
- baza obsluguje wiele use case, interfaces, automations i dystrybucje.

### 3.2 Table lifecycle

`draft schema -> active work surface -> specialized views -> connected system surface`

Tabela najpierw jest szkicem danych, a docelowo staje sie:
- miejscem pracy operacyjnej,
- elementem systemu relacji,
- zrodlem interfejsow i automatyzacji.

### 3.3 Record lifecycle

`captured -> enriched -> linked -> used -> reviewed / archived`

Record ma przejsc od surowego wpisu do elementu systemu danych z:
- walidacja,
- relacjami,
- aktywnym uzyciem w workflow,
- historia zmian i kontekstem.

---

## 4. Warstwy pracy uzytkownika

## 4.1 Schema design

Uzytkownik wykonuje:
- tworzenie tabel,
- dobieranie field types,
- ustalanie primary field,
- tworzenie linked records,
- konfigurowanie lookup/rollup/formula,
- ustawianie date dependencies i governance rules.

Rola AI:
- proponuje schema plan,
- ostrzega o brakach i konfliktach,
- sugeruje typy pol, views i dependencies,
- nigdy nie wykonuje mutacji bez akceptacji.

### 4.2 Record operations

Uzytkownik wykonuje:
- create/update/delete rekordow,
- bulk edits,
- inline edits,
- expand record,
- komentarze, watchers, attachments,
- template-driven row creation.

Rola AI:
- proponuje czyszczenie danych,
- podpowiada enrichment,
- generuje demo data lub sample records,
- sugeruje wykryte patterns i anomalies.

### 4.3 Views and work surfaces

Uzytkownik wykonuje:
- konfiguracje grid/kanban/calendar/timeline/gallery/gantt/chart/form,
- saved views,
- filtry, sortowania, grupowanie,
- footers i status signals,
- personal i shared view semantics.

Rola AI:
- proponuje views pod role i use case,
- generuje sensowne default views dla nowej bazy,
- sugeruje field visibility i grouping.

### 4.4 Search and retrieval

Uzytkownik wykonuje:
- szybkie wyszukiwanie rekordow i tabel,
- query po polach, filtrach i formule,
- odzyskiwanie zapisanych views dla konkretnego zadania,
- przechodzenie od pytania biznesowego do zestawu rekordow, widoku lub interface.

Rola AI:
- proponuje query i filtry pod pytanie uzytkownika,
- buduje retrieval context dla dalszej analizy,
- wskazuje najlepszy view lub surface dla znalezionych danych,
- nie ukrywa, z jakich rekordow i warunkow wynika odpowiedz.

### 4.5 Input layer

Uzytkownik wykonuje:
- budowe forms,
- import danych,
- public lub controlled intake,
- row templates dla szybkiego capture.

Rola AI:
- proponuje formularz z existing schema,
- podpowiada required fields,
- wykrywa slabe punkty intake.

### 4.6 Interfaces and presentation

Uzytkownik wykonuje:
- komponowanie curated surfaces,
- prezentowanie wybranych views i KPI,
- dostosowanie powierzchni do roli odbiorcy.

Rola AI:
- proponuje interface layout plan,
- sugeruje, jakie bloki i views najlepiej sluza danemu use case.

### 4.7 Automation and distribution

Uzytkownik wykonuje:
- uruchamianie trigger-based actions,
- sync,
- webhooks,
- publikacje i dystrybucje outputs.

Rola AI:
- proponuje automations,
- opisuje konsekwencje i ryzyka,
- generuje draft rule set, ktory wymaga review.

---

## 5. Docelowe scenariusze end-to-end

### 5.1 Delivery / project tracking

1. Uzytkownik opisuje projekt.
2. AI proponuje baze z tabelami `Projects`, `Milestones`, `Tasks`, `Risks`.
3. Uzytkownik akceptuje schema.
4. System tworzy grid, kanban, timeline i gantt.
5. Forms sluzy do intake zadan.
6. Interfaces sluzy PM-owi i leadershipowi.
7. Automations obsluguja status alerts i przypomnienia.

### 5.2 Data collection / research ops

1. Powstaje base z tabela glowna i slownikami.
2. Forms zbieraja dane od respondentow lub zespolu.
3. Records sa walidowane i wzbogacane.
4. Views dziela prace operacyjna od analitycznej.
5. Search/retrieval pomaga szybko wracac do trafnych rekordow i widokow.
6. AI pomaga w czyszczeniu danych i wykrywaniu luk.

### 5.3 CRM / account operating system

1. Uzytkownik importuje dane klientow.
2. System mapuje pola i proponuje schema.
3. Relacje lacza `Accounts`, `Contacts`, `Deals`, `Activities`.
4. Interfaces sluzy do roli account managera i leadershipu.
5. Automations obsluguja follow-up i governance.

---

## 6. AI-native workflow contract

AI uczestniczy w workflow na czterech poziomach:

### 6.1 Planning
- interpretuje intencje,
- proponuje schema, views, forms i automations.

### 6.2 Review
- pokazuje diff,
- tlumaczy skutki zmian,
- wskazuje ryzyka migracyjne i zaleznosci.

### 6.3 Execution
- wykonuje tylko zatwierdzone operacje,
- zapisuje audit trail.

### 6.4 Iteration
- umozliwia refine, undo/redo, compare proposals,
- wspiera ewolucje bazy bez utraty kontroli.

---

## 7. What changes in v8

### Dzisiaj

System ma duzo elementow platformy, ale workflow jest rozproszony:
- backend i wiele komponentow sa gotowe,
- glowna sciezka produktu nadal nie pokazuje w pelni `metadata-first base operating model`,
- czesc funkcji jest bardziej "available" niz "canonical".

### Docelowo

Workflow ma byc spojny:
- jedna kanoniczna sciezka od utworzenia bazy do operacyjnego uzycia,
- jedno rozumienie relacji `base -> table -> field -> view -> record`,
- jedna governance path dla AI i schema mutation,
- jeden rollout model z adapter-first migration.

---

## 8. Design constraints dla workflow

Workflow `v8` musi respektowac:
- istniejacy shell aplikacji,
- `frozen layouts`,
- `app table standard` tam, gdzie tabela jest po prostu modulowym widokiem aplikacji,
- rozroznienie pomiedzy `app table` a `full table platform workspace`.

Nie robimy:
- broad rewrite `MyWorkHub`,
- osobnego produktu poza obecna architektura,
- UI copy z Airtable lub Coda.

---

## 9. Definition of done dla workflow modelu

Workflow model jest domkniety, gdy:
- kazdy tryb startu ma jasna sciezke systemowa,
- `base` i `multi-table work` sa pierwszoplanowe,
- schema, records, views, forms, interfaces i automations skladaja sie w jeden model,
- AI ma jawny `propose -> review -> accept/reject`,
- migration i pilot rollout sa wpisane w workflow, a nie dopisane po fakcie.
