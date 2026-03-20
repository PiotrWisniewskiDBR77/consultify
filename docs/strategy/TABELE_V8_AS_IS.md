# Tabele v8 - As Is

> Status: Draft v8
> Cel: Opisac realny stan obecnego systemu tabel w kodzie i dokumentacji, bez mieszania roadmapy z rzeczywistym stanem produktu.

---

## 1. Executive summary

Stan obecny nie jest ani "prosta tabela", ani jeszcze w pelni domknieta `metadata-first table platform`.

Najtrafniejszy opis `as-is`:
- frontend ma rozbudowany `IdeaTableTool` z wieloma warstwami platformy,
- backend ma szeroki `table-platform` z bazami, tabelami, polami, widokami, rekordami, forms, interfaces, automations i AI schema proposals,
- ale glowna sciezka produktu nadal nie traktuje `metadata-first base` jako jednoznacznie kanonicznego modelu operacyjnego,
- przejscie legacy `graph-first` -> `metadata-first` jest gotowe architektonicznie, lecz nadal izolowane feature flags i adapterami,
- czesc dawnych auditow jest juz nieaktualna, ale ich ostrzezenia o spojnosci UX i rollout safety nadal pozostaja trafne.

---

## 2. Gdzie naprawde jest system dzisiaj

### 2.1 Co jest silne

- `IdeaTableTool` ma bogaty canvas pracy na danych.
- `table-platform.routes.ts` obsluguje szerokie API platformy.
- Typy domenowe wspieraja szeroki model pol i view semantics.
- Istnieja forms, interfaces, automations, attachments, audit trail, migration i schema proposals.
- Istnieje `migrationRunner` dla `tp_*`, wiec backend nie jest juz jedynie papierowym planem.

### 2.2 Co jest jeszcze niespojnie domkniete

- `metadata-first` jest nadal traktowane jako controlled/pilot path, nie jako bezdyskusyjny default flow.
- UX nadal jest miejscami bardziej `toolbox of capabilities` niz `jedna platformowa sciezka`.
- Relacja miedzy workspace graph a canonical metadata-first layer nie jest jeszcze wystarczajaco jednoznaczna dla calego produktu.
- Istnieje napiecie miedzy `app table standard` a pelna platforma tabel w workspace.

### 2.3 Co z dawnych auditow jest nieaktualne

Nieaktualne lub czesciowo nieaktualne sa tezy, ze:
- nie ma runnera migracji,
- forms/interfaces/automations sa tylko idea,
- platforma jest glownie dokumentacyjna.

Aktualne pozostaja tezy, ze:
- rollout wymaga izolacji i feature flags,
- broad rewrite shella bylby bledem,
- trzeba jasno odroznic `rich code surface` od `production-grade canonical operating model`.

---

## 3. Mapa as-is po warstwach

## 3.1 BaseAndTableModel

### Co jest

- Backend ma kanoniczne byty `base` i `table`.
- `tablePlatform.api.ts` obsluguje `createBase`, `listBases`, `createTable`, `getTable`.
- Typy frontendowe definiuja `TablePlatformBase` i `TablePlatformTable`.
- W UI istnieje `TableTabStrip`, ale glowny experience nadal jest silniej osadzony w pojedynczym canvasie tabelowym niz w modelu `multi-table base shell`.

### Co to znaczy

Warstwa modelu istnieje w architekturze i API.
Nie jest jeszcze w pelni domknieta jako glowny mental model produktu.

### Ocena

`As-is`: mocne backendowe podstawy, srednio domkniety glowny UX.

## 3.2 SchemaAndFields

### Co jest

- Szeroki zestaw typow pol: tekst, liczby, selecty, attachment, linked record, lookup, rollup, formula, rating, duration, barcode.
- `FieldManager`, `AddColumnDialog`, `FormulaEditor`, `DateDependencyConfig`.
- API dla field CRUD i formula validation.
- Backend formula engine z dependency detection i walidacja cykli.

### Co to znaczy

Schema nie jest juz prostym zestawem kolumn.
To realny model danych o duzej glebi.

### Ocena

`As-is`: bardzo mocna warstwa modelu danych, ale wymaga bardziej kanonicznej sciezki zarzadzania schema i lepszej spojnosci UX.

## 3.3 RecordsAndViews

### Co jest

- CRUD rekordow, batch, bulk operations, query API.
- Widoki: grid, kanban, calendar, gallery, timeline, gantt, form, chart.
- `ViewRouter`, `ViewConfigPanel`, `StatusBar`.
- Filtrowanie, sortowanie, grupowanie, server-side query.
- Record expand, comments, watchers, attachments, audit.

### Co to znaczy

System records/views jest szeroki i technicznie dojrzaly.
Brakuje mniej technologii niz jasnego produktu i priorytetyzacji tego, co ma byc kanoniczne.

### Ocena

`As-is`: bogactwo funkcji jest duze; spojnosc platformowego operating modelu jest jeszcze do domkniecia.

## 3.4 RelationsAndDependencies

### Co jest

- `linkedRecord`, `lookup`, `rollup`, `count`.
- Relation API i services.
- Date dependency config oraz dependency-aware views.
- Formula dependency detection i ochrona przed cyklami.

### Co to znaczy

Relacje i zaleznosci sa juz czyms wiecej niz roadmapa.
Sa obecne zarowno na poziomie modelu, jak i UI.

### Ocena

`As-is`: bardzo dobry fundament dla PM-like i operational workflows, ale wymaga wyraznej definicji, co jest tylko view affordance, a co kanoniczna semantyka backendowa.

## 3.5 InputLayer

### Co jest

- import CSV, XLSX, Google Sheet,
- forms API i `FormBuilder`,
- `RowTemplatePicker`,
- `TemplateGallery`.

### Co to znaczy

Input layer istnieje i jest szerszy niz tylko reczne wpisywanie rekordow.
To mocny sygnal, ze platforma jest juz gotowa na intake workflows.

### Ocena

`As-is`: warstwa istnieje, ale wymaga lepszego osadzenia w glownym workflow produktu i w modelu completeness.

## 3.6 InterfacesAndPresentation

### Co jest

- `InterfaceDesigner`,
- dedykowane indexy dla interfaces i forms,
- chart view,
- status bar, sharing surfaces i workflow dashboard,
- rozne surfaces ponad tym samym systemem danych.

### Co to znaczy

System nie jest tylko gridem.
Ma juz ambicje curated experiences.

### Ocena

`As-is`: warstwa realna, ale nie jest jeszcze oczywistym i spojnym elementem glownego story platformy.

## 3.7 AutomationAndDistribution

### Co jest

- `AutomationService`, `ScheduledAutomationExecutor`, webhooks,
- `AutomationsManager`, `SharingManager`,
- connectors/imports/export,
- route coverage dla forms, automations, distribution-adjacent capabilities.

### Co to znaczy

Tabele sa budowane jako system operacyjny danych, a nie tylko magazyn rekordow.

### Ocena

`As-is`: duzy zakres techniczny, ale rollout i produktowe priorytety musza pilnowac kolejnosci: najpierw canonical core, potem szerokie process automation.

## 3.8 AI-native

### Co jest

- `/schema/propose`, `/execute`, `/reject`, `/refine`, `/undo`, `/redo`,
- `ChatToSchemaService`,
- glowna idea `describe -> proposal -> review -> execute`,
- komponenty AI po stronie frontendu oraz wzmianki o chat integration.

### Co to znaczy

AI w tabelach jest juz osadzone w architekturze jako warstwa zmian modelu, nie tylko chat helper.

### Ocena

`As-is`: to bardzo mocny fundament `v8`, ale governance musi byc dopisana jako twardy kontrakt produktu, nie tylko capabilities set.

---

## 4. Najwazniejsze napiecia architektoniczne as-is

### 4.1 Graph-first vs metadata-first

Najwazniejsze napiecie:
- stary model nadal istnieje w workspace graph,
- nowy model ma byc kanoniczny,
- pomiedzy nimi dziala warstwa adapterow i migracji.

To jest dobre podejscie wdrozeniowe, ale wymaga:
- jasnego SSOT,
- jasnej definicji projection layer,
- pilot-first rollout.

### 4.2 Rich surface vs canonical product flow

Kod sugeruje bardzo duze bogactwo.
Produktowo nadal trzeba odpowiedziec:
- jaka jest glowna sciezka dla uzytkownika,
- ktore capability sa `core`,
- ktore sa `advanced`,
- co jest objete production-grade support, a co jeszcze nie.

### 4.3 App tables vs full table platform

To nie jest to samo:
- `app table standard` opisuje tabele jako modulowy standard widokow aplikacyjnych,
- `table platform` opisuje wielowarstwowy system danych z baza, schema, views, forms, interfaces i AI.

As-is nie ma jeszcze wystarczajaco twardej granicy miedzy tymi dwoma kategoriami.

---

## 5. Dokumentacja as-is kontra realny kod

### 5.1 Dokumenty nadal trafne

- `CONSULTIFY_TABLE_PLATFORM_ARCHITECTURE.md`
- `CONSULTIFY_TABLE_PLATFORM_MIGRATION_AND_ISOLATION.md`
- `app-table-standard.md`

Te dokumenty dobrze opisuja kierunek, adapter-first migration i potrzebe izolacji rolloutu.

### 5.2 Dokumenty wymagajace korekty interpretacji

- `TABLE_PLATFORM_HONEST_AUDIT_AND_PLAN_2026-03-16.md`
- starsze rollout/status documents

Powod:
- czesc wnioskow jest juz historyczna wobec aktualnego kodu,
- ale ostrzezenia o ryzykach wdrozeniowych nadal sa cenne.

### 5.3 Co dokumentacja dotad robila slabo

- mieszala `code exists` z `product is canonical`,
- za malo jasno odrozniala `pilot-ready` od `fully adopted`,
- za malo jasno odrozniala `workspace table tool` od `full metadata-first platform`.

---

## 6. As-is maturity statement

Najuczciwsze podsumowanie:

`Consultify` ma juz silnik i duza czesc powierzchni `table platform`, ale nie ma jeszcze pelnego, domknietego i jednoznacznie kanonicznego operating modelu produktu wokol tej platformy.

Innymi slowy:
- backend i duza czesc UI sa dalej niz sugeruje konserwatywny audit,
- ale zaufany rollout-grade model produktu jest jeszcze do domkniecia.

---

## 7. Wnioski dla v8

Seria `Tabele v8` nie powinna:
- zaczynac od zera,
- projektowac nowego produktu obok obecnego,
- udawac, ze nic nie ma.

Seria `Tabele v8` powinna:
- uznac obecny system za bardzo mocny fundament,
- uporzadkowac definicje i granice,
- domknac kanoniczny workflow,
- wyznaczyc epiki, ktore zmieniaja `rich capability set` w `production-grade metadata-first table platform`.
