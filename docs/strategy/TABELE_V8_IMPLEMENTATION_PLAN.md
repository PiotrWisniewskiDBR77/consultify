# Tabele v8 - Implementation Plan

> Status: Draft v8
> Cel: Przelozyc `Tabele v8` na program wdrozeniowy z epikami, priorytetami, zaleznosciami i planem weryfikacji.

---

## 1. Strategic intent

`Tabele v8` ma zamienic obecny stan:

`rich table capability set with controlled metadata-first rollout`

w stan:

`production-grade metadata-first table platform with workspace projections`

Nie chodzi o przepisywanie wszystkiego.
Chodzi o uporzadkowanie, domkniecie i dowiezienie pelnego modelu produktu.

---

## 2. Program structure

Program dzielimy na 6 strumieni:
- `TruthAndPlatformModel`
- `CoreSchemaAndRecords`
- `RelationsFormsInterfaces`
- `AutomationAndDistribution`
- `AIContractAndOperations`
- `MigrationRolloutAndQuality`

---

## 3. Fale wdrozenia

## Fala 0 - Documentation and truth alignment

Cel:
- ustalic jedno zrodlo prawdy dla `v8`.

Zakres:
- benchmark,
- workflow model,
- as-is,
- gap matrix,
- implementation plan,
- AI governance,
- decyzja o granicy `app table` vs `full table platform`.

Wynik:
- zespol pracuje na wspolnych definicjach,
- historyczne dokumenty przestaja sterowac decyzjami.

## Fala 1 - Canonical platform core

Cel:
- domknac model `base -> table -> field -> record -> view` jako kanoniczny.

Zakres:
- multi-table base shell,
- canonical entry points dla metadata-first mode,
- schema management consolidation,
- records/view workflow hardening,
- projection boundary cleanup.

Wynik:
- podstawy platformy sa jednoznaczne dla uzytkownika i zespolu.

## Fala 2 - Operational layers

Cel:
- domknac warstwy, ktore robia z tabel system pracy.

Zakres:
- linked records i dependencies,
- forms,
- record templates,
- interfaces,
- import-first onboarding.

Wynik:
- tabela przestaje byc tylko gridem i staje sie operacyjnym systemem danych.

## Fala 3 - AI-native and automation

Cel:
- zrobic z AI i automation prawdziwe akceleratory, a nie tylko capability demo.

Zakres:
- proposal-driven schema operations,
- AI proposals dla views/forms/interfaces/automations,
- audit-driven execution,
- rollout-safe automations.

Wynik:
- AI i process layer sa przewidywalne, reviewable i pilot-ready.

## Fala 4 - Pilot hardening and rollout

Cel:
- przygotowac platforme do bezpiecznego uzycia w realnych workspace.

Zakres:
- migration validation,
- feature flag policy,
- quality gates,
- support playbook,
- pilot metrics,
- rollback drills.

Wynik:
- metadata-first rollout jest operacyjnie wiarygodny.

---

## 4. Epics v8

## V8-TABLE-01 - Platform truth alignment

Cel:
- ustalic jednoznaczny model produktu i architektury.

Scope:
- domkniecie SSOT,
- spisanie granic `app table` vs `full table platform`,
- aktualizacja interpretacji starszych auditow,
- mapowanie canonical persistence vs projection.

Deliverables:
- final docs package,
- canonical glossary,
- rollout terminology.

Priority:
- `P0`

## V8-TABLE-02 - Multi-table base operating model

Cel:
- wyniesc `base` i `multi-table work` na poziom glownego experience.

Scope:
- base shell,
- table switching,
- ownership/sharing boundary,
- canonical entry flow dla tworzenia base i pierwszej tabeli.

Priority:
- `P0`

## V8-TABLE-03 - Schema governance and field system

Cel:
- sprawic, by schema byla traktowana jak produktowy model danych, a nie tylko config UI.

Scope:
- field management consolidation,
- destructive change UX,
- field capability matrix,
- formula/dependency/linked field governance,
- clearer review flows dla schema mutations.

Priority:
- `P0`

## V8-TABLE-04 - Records and views hardening

Cel:
- uporzadkowac records/views jako kanoniczna warstwe pracy.

Scope:
- record workflows,
- saved views hierarchy,
- query behavior consistency,
- bulk operations UX,
- grid discipline: status bar, footers, operational cues.

Priority:
- `P1`

## V8-TABLE-05 - Relations, forms, templates, interfaces

Cel:
- domknac warstwy, ktore zmieniaja tabele w system workflow.

Scope:
- linked records semantics,
- dependencies productization,
- forms,
- record templates,
- interfaces,
- import-first onboarding.

Priority:
- `P1`

## V8-TABLE-06 - Automation and distribution

Cel:
- zbudowac kontrolowany process layer nad tabela.

Scope:
- automations lifecycle,
- webhook/sync/distribution semantics,
- sharing model,
- notifications and downstream actions.

Priority:
- `P1`

## V8-TABLE-07 - AI contract and operations

Cel:
- zrobic z AI glowny akcelerator platformy bez utraty kontroli.

Scope:
- propose/review/accept/reject UX,
- schema proposals,
- AI extensions dla views/forms/interfaces/automations,
- audit trail,
- evals i safety rules.

Priority:
- `P0`

## V8-TABLE-08 - Migration and rollout readiness

Cel:
- domknac produkcyjne wprowadzenie metadata-first mode.

Scope:
- readiness gates,
- pilot criteria,
- migration validation,
- rollback drills,
- feature-flag policy,
- observability/support.

Priority:
- `P0`

---

## 5. Execution order

1. `V8-TABLE-01`
2. `V8-TABLE-02`
3. `V8-TABLE-03`
4. `V8-TABLE-07`
5. `V8-TABLE-04`
6. `V8-TABLE-05`
7. `V8-TABLE-08`
8. `V8-TABLE-06`

Uzasadnienie:
- najpierw prawda architektoniczna,
- potem canonical core,
- potem AI safety,
- potem workflow expansion,
- a na koncu szeroka process layer.

---

## 6. Dependency map

### High-level dependencies

- `V8-TABLE-02` zalezy od `V8-TABLE-01`
- `V8-TABLE-03` zalezy od `V8-TABLE-01`
- `V8-TABLE-07` zalezy od `V8-TABLE-01` i `V8-TABLE-03`
- `V8-TABLE-04` zalezy od `V8-TABLE-02` i `V8-TABLE-03`
- `V8-TABLE-05` zalezy od `V8-TABLE-03` i `V8-TABLE-04`
- `V8-TABLE-06` zalezy od `V8-TABLE-05` i `V8-TABLE-08`
- `V8-TABLE-08` zalezy od `V8-TABLE-02`, `V8-TABLE-03`, `V8-TABLE-07`

### Architectural dependencies

- feature flags musza pozostac aktywna warstwa kontroli,
- migration service i projection boundary musza pozostac stabilne,
- app shell i frozen layouts nie moga byc naruszone przez broad rewrite.

---

## 7. Acceptance criteria matrix

| Epic | Acceptance criteria |
|---|---|
| `V8-TABLE-01` | Istnieje jedno SSOT, slownik pojec, boundary `app table` vs `platform`, i zespol nie musi opierac decyzji na sprzecznych auditach |
| `V8-TABLE-02` | Uzytkownik rozumie `base` jako glowny kontener pracy, a multi-table switching jest pierwszoplanowe i spojne |
| `V8-TABLE-03` | Schema changes sa przewidywalne, reviewable i governowane; typ pola i skutki zmian sa jasne |
| `V8-TABLE-04` | Records i views tworza jedna glowna sciezke pracy, z przewidywalnym query behavior i saved views model |
| `V8-TABLE-05` | Forms, templates, interfaces i relations sa osadzone w jednym workflow zamiast dzialac jako oddzielne funkcje |
| `V8-TABLE-06` | Automations i distribution maja jawny model uruchamiania, odbiorcow, skutkow i audytu |
| `V8-TABLE-07` | Kazda AI mutation przechodzi przez `propose -> review -> accept/reject`, a audit trail jest kompletny |
| `V8-TABLE-08` | Metadata-first rollout ma pilot gates, metrics, validation i rollback story potwierdzone w praktyce |

---

## 8. Verification plan

Kazdy epic musi miec osobno:
- `frontend scope`
- `backend scope`
- `data/schema scope`
- `AI scope`
- `migration scope`
- `test scope`

### Test matrix

#### Unit

- field logic,
- formula/dependency logic,
- AI proposal normalization,
- automation rule validation,
- import mapping.

#### Integration

- API bases/tables/fields/views/records,
- forms and interfaces persistence,
- migration validation,
- AI proposal execution,
- audit trail persistence.

#### UX verification

- multi-table shell flows,
- schema management flows,
- record work loops,
- AI review screens,
- import-first onboarding,
- forms/interfaces task completion.

#### AI evals

- schema proposal quality,
- field typing accuracy,
- relation inference quality,
- safety against destructive overreach,
- clarity of review diffs.

#### Migration safety

- migrate workspace,
- validate result,
- rollback path,
- no unintended impact on non-pilot users.

#### Pilot readiness

- feature flags enforce isolation,
- pilot org readiness checklist,
- monitoring for errors and latency,
- support runbook availability.

---

## 9. Rollout strategy

### Stage 1 - Internal proof

- validate canonical workflows na controlled workspace,
- potwierdzic metrics i quality gates,
- domknac docs truth model.

### Stage 2 - Pilot orgs

- wlaczyc metadata-first mode dla wybranych organizacji / user groups,
- prowadzic migration validation i monitoring,
- zbierac feedback na workflow i AI trust.

### Stage 3 - Broader adoption

- rozszerzac po potwierdzeniu stability,
- utrzymac rollback-ready policy,
- rozszerzac automations/distribution dopiero po stabilnym core.

---

## 10. Risks and countermeasures

### Risk: scope explosion

Countermeasure:
- trzymac granice `core -> workflow -> process layer`.

### Risk: capability illusion

Countermeasure:
- mierzyc canonical flows, nie sama liczbe komponentow i endpointow.

### Risk: AI overreach

Countermeasure:
- twardy AI governance i audit-first execution.

### Risk: migration instability

Countermeasure:
- feature flags, validation, rollback i pilot gates.

### Risk: shell destabilization

Countermeasure:
- adapter-first migration i poszanowanie `frozen layouts`.

---

## 11. Final program statement

`Tabele v8` to nie jest plan "dopiszmy jeszcze kilka ficzerow do tabeli".

To jest program, ktory ma:
- uporzadkowac prawde architektoniczna,
- domknac kanoniczny operating model,
- wyniesc AI do roli bezpiecznego akceleratora,
- przygotowac metadata-first rollout jako realna, produkcyjna warstwe systemu.
