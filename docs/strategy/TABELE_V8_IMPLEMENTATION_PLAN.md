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

Program dzielimy na 7 strumieni:
- `TruthAndPlatformModel`
- `CoreSchemaAndRecords`
- `DiscoveryAndRetrieval`
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
- search/retrieval entry points,
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

## V8-TABLE-04 - Records, views, discovery and retrieval

Cel:
- uporzadkowac records/views/retrieval jako kanoniczna warstwe pracy.

Scope:
- record workflows,
- saved views hierarchy,
- query behavior consistency,
- search entry points i retrieval flows,
- saved-view-to-query alignment,
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
| `V8-TABLE-04` | Records, views i retrieval tworza jedna glowna sciezke pracy, z przewidywalnym query behavior, saved views modelem i jasnym discovery flow |
| `V8-TABLE-05` | Forms, templates, interfaces i relations sa osadzone w jednym workflow zamiast dzialac jako oddzielne funkcje |
| `V8-TABLE-06` | Automations i distribution maja jawny model uruchamiania, odbiorcow, skutkow i audytu |
| `V8-TABLE-07` | Kazda AI mutation przechodzi przez `propose -> review -> accept/reject`, a audit trail jest kompletny |
| `V8-TABLE-08` | Metadata-first rollout ma pilot gates, metrics, validation i rollback story potwierdzone w praktyce |

---

## 8. Per-epic scope matrix

### `V8-TABLE-01`

- `frontend scope`: nazewnictwo, entry points i language contract dla platformy tabel.
- `backend scope`: brak nowych bytow; doprecyzowanie canonical responsibilities services.
- `data/schema scope`: definicje canonical entities i projection boundary.
- `search/retrieval scope`: definicja, gdzie retrieval nalezy do core platformy, a gdzie do surfaces.
- `AI scope`: twarde osadzenie AI contract w modelu produktu.
- `migration scope`: definicja projection/migration terminology.
- `test scope`: review dokumentacji, architecture sign-off, traceability do kodu.

### `V8-TABLE-02`

- `frontend scope`: base shell, table switching, entry flow create-base/create-first-table.
- `backend scope`: stabilizacja endpoints dla base/table navigation i metadata fetch.
- `data/schema scope`: ownership, naming, base boundary, table identity.
- `search/retrieval scope`: retrieval entry z poziomu base i table context.
- `AI scope`: AI-assisted create-base/create-table flows.
- `migration scope`: jak legacy workspace mapuje sie do base/table shell.
- `test scope`: UX flows, integration dla base/table loading, pilot smoke tests.

### `V8-TABLE-03`

- `frontend scope`: field management UX, destructive-change review, capability matrix surfaces.
- `backend scope`: field validation, formula/dependency guardrails, schema mutation contract.
- `data/schema scope`: field types, config, computed semantics, schema governance rules.
- `search/retrieval scope`: zapewnienie, ze typy pol i schema wspieraja queryability i filtering.
- `AI scope`: schema proposal review/refinement rules.
- `migration scope`: bezpieczne mapowanie typow i schema evolution.
- `test scope`: unit dla field logic, integration dla schema CRUD, AI review safety tests.

### `V8-TABLE-04`

- `frontend scope`: records workflows, saved views UX, status bar/footers, discovery entry points.
- `backend scope`: query engine consistency, record query/list/search semantics.
- `data/schema scope`: saved views, filters, sorts, grouping, retrieval-ready metadata.
- `search/retrieval scope`: quick search, query recall, saved-view retrieval, search-to-view flow.
- `AI scope`: AI-generated queries, retrieval context, explanation of why results match.
- `migration scope`: zgodnosc retrieval/query behavior miedzy legacy a metadata-first mode.
- `test scope`: query integration tests, UX retrieval tests, relevance/safety checks dla AI-assisted retrieval.

### `V8-TABLE-05`

- `frontend scope`: forms, templates, interfaces, dependency surfaces.
- `backend scope`: form persistence, interface persistence, relation/dependency semantics.
- `data/schema scope`: linked records, dependency config, template defaults, intake model.
- `search/retrieval scope`: retrieval z forms/templates/interfaces do canonical records/views.
- `AI scope`: AI proposals dla forms, templates, interfaces i dependency setups.
- `migration scope`: bezpieczne wlaczanie tych warstw nad metadata-first core.
- `test scope`: form submission, interface rendering, dependency correctness, template flows.

### `V8-TABLE-06`

- `frontend scope`: automation builders, sharing/distribution controls, notifications surfaces.
- `backend scope`: automation execution, webhooks, sync semantics, sharing lifecycle.
- `data/schema scope`: trigger/action/audit model i downstream data contracts.
- `search/retrieval scope`: retrieval of automation history, execution outcomes i shared outputs.
- `AI scope`: AI-generated automation drafts i risk explanation.
- `migration scope`: rollout-safe activation i isolation rules.
- `test scope`: automation integration, webhook delivery, audit observability, rollback checks.

### `V8-TABLE-07`

- `frontend scope`: propose/review/accept/reject UX, diff surfaces, refine loop.
- `backend scope`: proposal orchestration, execution guards, audit persistence, undo/redo semantics.
- `data/schema scope`: proposal payloads, impacted entities, diffable schema/data changes.
- `search/retrieval scope`: retrieval context for AI prompts and explainable answer provenance.
- `AI scope`: schema, views, forms, interfaces, automations, demo data proposals.
- `migration scope`: AI cannot bypass pilot gating ani canonical mutation rules.
- `test scope`: AI evals, prompt/response normalization, destructive proposal safety, audit completeness.

### `V8-TABLE-08`

- `frontend scope`: pilot visibility, admin diagnostics, rollout flags awareness where needed.
- `backend scope`: feature flags, migration validation, rollback, observability/support hooks.
- `data/schema scope`: migration correctness, canonical/projection consistency, pilot metrics.
- `search/retrieval scope`: verify retrieval behavior remains stable across migrated and non-migrated flows.
- `AI scope`: pilot quality gates for AI-assisted creation and mutation.
- `migration scope`: full pilot path, validation, rollback drills, org gating.
- `test scope`: migration safety, smoke tests, monitoring checks, pilot readiness checklist.

---

## 9. Verification plan

Kazdy epic musi miec osobno:
- `frontend scope`
- `backend scope`
- `data/schema scope`
- `search/retrieval scope`
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
- search/query/retrieval consistency,
- forms and interfaces persistence,
- migration validation,
- AI proposal execution,
- audit trail persistence.

#### UX verification

- multi-table shell flows,
- schema management flows,
- record work loops,
- search and retrieval work loops,
- AI review screens,
- import-first onboarding,
- forms/interfaces task completion.

#### AI evals

- schema proposal quality,
- field typing accuracy,
- retrieval context quality,
- answer provenance clarity,
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

## 10. Rollout strategy

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

## 11. Risks and countermeasures

### Risk: scope explosion

Countermeasure:
- trzymac granice `core -> workflow -> process layer`.

### Risk: capability illusion

Countermeasure:
- mierzyc canonical flows, nie sama liczbe komponentow i endpointow.

### Risk: search/retrieval remains implicit

Countermeasure:
- nazwac retrieval jako osobny filar operating modelu i testowac go jak core workflow.

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

## 12. Final program statement

`Tabele v8` to nie jest plan "dopiszmy jeszcze kilka ficzerow do tabeli".

To jest program, ktory ma:
- uporzadkowac prawde architektoniczna,
- domknac kanoniczny operating model,
- wyniesc AI do roli bezpiecznego akceleratora,
- przygotowac metadata-first rollout jako realna, produkcyjna warstwe systemu.
