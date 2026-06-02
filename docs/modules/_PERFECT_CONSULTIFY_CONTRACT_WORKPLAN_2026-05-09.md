---
doc_id: PERFECT_CONSULTIFY_CONTRACT_WORKPLAN_2026_05_09
doc_kind: WORKPLAN
owner: user
status: active
last_updated: 2026-05-09
---

# Perfect Consultify Contract — Workplan

## Goal

Zbudować perfekcyjny, autorski kontrakt aplikacji Consultify: funkcjonalność, UI/UX, dane, bezpieczeństwo, przepływy, role, AI i akceptacja dla całej aplikacji.

Docelowo Consultify ma być dla consultingu tym, czym Harvey jest dla prawa: spójnym systemem pracy eksperckiej, nie zbiorem odłączonych modułów.

## Working Principle

Nie piszemy aplikacji od nowa. Najpierw wykorzystujemy wszystko, co już istnieje:

- źródła prawdy i specy w repo,
- dokumentację produktową,
- dokumentację UI/UX,
- routing/sidebar,
- realny kod,
- istniejące testy i evidence.

Dopiero po uporządkowaniu obecnego stanu przechodzimy do plików RAW jako materiału do docelowego kontraktu 2.0.

## Canonical Workspace

Główne miejsce pracy:

- `DRD/consultify/docs/modules/`

Każdy moduł ma kontrakt:

- `README.md`
- `SSOT.md`
- `CODEMAP.md`
- `STATUS.md`
- `00_META.md`
- `01_PURPOSE.md`
- `02_SCOPE.md`
- `03_BEHAVIOR.md`
- `04_UI_UX.md`
- `05_DATA_AND_INTEGRATIONS.md`
- `06_PERMISSIONS_AND_SECURITY.md`
- `07_ACCEPTANCE_AND_TESTS.md`
- `RAW_INPUT.md`
- `CHANGELOG.md`

Manifest pokrycia:

- `DRD/consultify/docs/modules/_AUTHOR_CONTRACT_COVERAGE_2026-05-09.md`

## Phase 1 — Stabilize Current Truth

Cel: mieć uczciwy opis tego, co już wynika z repo i kodu.

Tasks:

- Zweryfikować każdy `SSOT.md` względem istniejących plików.
- Usunąć odniesienia do nieistniejących dokumentów.
- Uzupełnić `CODEMAP.md` na podstawie realnego routingu, sidebara, komponentów i API.
- Uzupełnić `STATUS.md`: real / partial / planned / soon / stub.
- Utrzymać zasadę: brak zgadywania, wszystko musi mieć źródło albo być oznaczone jako decyzja autora.

Exit criteria:

- 19 modułów ma komplet plików.
- Brak pustych plików.
- Brak placeholderów typu `TBD`.
- Brak złamanych linków do `DRD/.../*.md`.

## Phase 2 — Application Operating Model

Cel: opisać Consultify jako jeden system pracy konsultingowej.

Główna pętla:

`Czat / Teresa -> Moja Praca -> Wywiad / Narzędzia -> Inicjatywy -> Realizacja -> Rezultaty -> Finanse -> Outputs -> Dokumenty / Prezentacje / Tabele -> Meeting / follow-up`

Warstwy wspólne:

- `Organizacja` jako context/knowledge/memory layer.
- `Panel Administratora` jako tenant/admin control.
- `Ustawienia` jako user/workspace preferences.
- `MCP IRIS` i `MCP Marketplace` jako integracje.
- `Portal Partnerski` jako osobna ścieżka biznesowa.

Deliverables:

- `APPLICATION_OPERATING_MODEL.md`
- `OBJECT_GRAPH.md`
- `MODULE_HANDOFFS.md`

## Phase 3 — UI/UX Contract

Cel: każdy moduł ma mieć jasny kontrakt UX, nie tylko opis funkcji.

Każdy `04_UI_UX.md` musi definiować:

- główny ekran,
- Menu 2 / Menu 3,
- akcje AI,
- stany: loading / empty / error / degraded / success,
- source/provenance/evidence UI,
- approval/diff/review UI,
- antywzorce,
- zasady spójności z globalnym UI/UX.

Sources:

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/ui-standards/`
- `DRD/consultify/docs/UI_UX/`

## Phase 4 — RAW To Target State

Cel: dopiero po obecnym kontrakcie przejść do docelowej wizji autora.

RAW sources:

- `DRD/consultify/docs/UI_UX/*_RAW_*.md`
- `DRD/consultify/docs/RAW/`
- `RAW_INPUT.md` w folderach modułów

Workflow:

1. RAW pozostaje verbatim.
2. Wymagania są klasyfikowane: behavior / UI / data / permissions / workflow / evidence.
3. Kontrakt modułu dostaje wersję 2.0, jeśli zmienia zachowanie lub zakres.
4. Każda zmiana ma acceptance criteria.
5. Zmiana trafia do `CHANGELOG.md`.

## Hard Stops

- Nie przepisywać modułów bez sprawdzenia realnych źródeł.
- Nie tworzyć drugiego właściciela dla tego samego obiektu.
- Nie mieszać RAW z kontraktem bez normalizacji.
- Nie ukrywać braków jako gotowych wymagań.
- Nie łamać tenant/ACL/security.
- Nie implementować UI sprzecznego z Menu 3 / global UI/UX governance.

## Definition Of Done

Kontrakt jest gotowy, gdy dla każdego modułu da się odpowiedzieć:

- po co istnieje,
- dla kogo jest,
- co robi,
- czego nie robi,
- jak wygląda,
- jakie dane posiada,
- z czym się integruje,
- jakie ma role i uprawnienia,
- jak AI może w nim działać,
- jakie są przepływy do innych modułów,
- jak testujemy, że działa dobrze,
- jak wspiera cel: Harvey dla consultingu.
