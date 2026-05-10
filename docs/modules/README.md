# Modules (catalog) — start here

Cel tego katalogu: trzymać **jeden, spójny punkt odniesienia** dla wszystkich modułów (dla ludzi i agentów), w kolejności jak w sidebarze aplikacji.

Ten katalog jest **kuratorską nakładką** na istniejące SSOT w `DRD/consultify/docs/` (np. routing w `docs/modules/`). Nie przenosimy teraz istniejących dokumentów — zamiast tego linkujemy do nich z poziomu folderu danego modułu.

## Zasady

- Numeracja = **kolejność w sidebarze**.
- Folder modułu = `NN_<slug>/` (NN = 2 cyfry).
- Praca na wymaganiach autora odbywa się wg: `INSTRUKCJA_KONTRAKTU.md`.
- Każdy folder modułu ma **dwie warstwy dokumentacji**:
  - **Warstwa nawigacyjna (entrypoint, szybkie linki):**
    - `README.md` (wejście + skrót)
    - `SSOT.md` (źródła prawdy i ich priorytet)
    - `CODEMAP.md` (route, komponenty, backend)
    - `STATUS.md` (shipped/wkrótce + ryzyka)
  - **Warstwa kontraktowa (kanoniczna, wiążąca):**
    - `00_META.md` … `07_ACCEPTANCE_AND_TESTS.md` + `CHANGELOG.md`
    - `RAW_INPUT.md` jako surowe wejście autora (nie jest kanoniczne; jest materiałem źródłowym do przepisania)

### Która warstwa jest kanoniczna?

- **Jedynym kanonicznym źródłem prawdy o zachowaniu modułu jest warstwa kontraktowa** (`00-07`).
- Pliki nawigacyjne są indeksami i nie powinny duplikować treści kontraktu (tylko streszczenie + linki).

## Lista modułów (sidebar order)

> Uwaga: **`Tabele Studio` jest obecnie duplikatem** `Tabele` w nawigacji — w katalogu modułów **pomijamy** `Tabele Studio` i traktujemy to jako ten sam moduł.
>
> `Wyloguj się` nie jest modułem (akcja systemowa) — nie tworzymy dla niego folderu.

1. `01_czat` — Czat
2. `02_moja-praca` — Moja Praca
3. `03_wywiad` — Wywiad
4. `04_narzedzia` — Narzędzia
5. `05_inicjatywy` — Inicjatywy
6. `06_realizacja` — Realizacja
7. `07_rezultaty` — Rezultaty
8. `08_finanse` — Finanse
9. `09_outputs` — Outputs
10. `10_dokumenty` — Dokumenty (wkrótce)
11. `11_tabele` — Tabele (wkrótce)
12. `12_prezentacje` — Prezentacje (wkrótce)
13. `13_meeting` — Meeting (wkrótce)
14. `14_mcp-iris` — MCP IRIS (wkrótce)
15. `15_mcp-marketplace` — MCP Marketplace (wkrótce)
16. `16_organizacja` — Organizacja
17. `17_panel-administratora` — Panel Administratora
18. `18_ustawienia` — Ustawienia
19. `19_portal-partnerski` — Portal Partnerski

## SSOT (global) dla modułów

- Routing i granice odpowiedzialności modułów: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`
- Rejestr kanonicznych dokumentów: `DRD/consultify/docs/product/DOCUMENTATION_REGISTRY.md`
- Standard UI/UX dla modułów (Menu 2/3, huby): `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`

## Coverage Manifest

- `_AUTHOR_CONTRACT_COVERAGE_2026-05-09.md` — aktualny manifest pokrycia źródeł przez kontrakty modułów.

## Program “Harvey dla consultingu”

- `_PERFECT_CONSULTIFY_CONTRACT_WORKPLAN_2026-05-09.md` — programowy workplan dla perfekcyjnego kontraktu aplikacji.
- `_EXECUTION_PLAN_HARVEY_FOR_CONSULTING_2026-05-09.md` — wykonawczy plan sprintów, bramek i hard-stopów.
- `APPLICATION_OPERATING_MODEL.md` — model działania Consultify jako jednego systemu pracy konsultingowej.
- `APPLICATION_LOGICAL_MODEL.md` — logiczny model całej aplikacji: input/output/handoff/must-not-own dla 19 modułów.
- `OBJECT_GRAPH.md` — główne obiekty systemu i ich właściciele.
- `MODULE_HANDOFFS.md` — przepływy pracy i odpowiedzialności między modułami.
- `MODULE_INTERACTION_GRAPH.md` — siatka powiązań moduł-moduł i moduł-superadmin (typy interakcji + reguły ownership).
- `CONTROL_PLANE_CONTRACT.md` — kontrakt granic między warstwą domenową, admin i superadmin.
- `END_TO_END_WORKFLOWS.md` — kanoniczne przepływy E2E przez wiele modułów.
- `CROSS_MODULE_PERMISSION_MATRIX.md` — macierz ról i uprawnień cross-module dla całej aplikacji.
- `APPROVED_COMPONENT_COMPOSITION.md` — mapa zatwierdzonych shelli i komponentów dla rozwoju wszystkich modułów.
- `ARTIFACT_LINEAGE_MATRIX.md` — pełna matryca pochodzenia artefaktów (owner, approval, evidence, dystrybucja).
- `UI_UX_COMPONENTS_AND_ARTIFACTS_UNIFIED_STANDARD.md` — jeden kontrakt wykonawczy spinający zatwierdzone komponenty i lifecycle artefaktów.
- `SYSTEM_TRACEABILITY_MATRIX.md` — macierz `requirement -> module -> function -> object/artifact -> route -> component -> API -> test -> owner`.
- `EVIDENCE_REGISTRY.md` — rejestr typów dowodów i statusów evidence dla runtime claims.
- `DECISION_LOG.md` — dziennik decyzji produktowych, architektonicznych i governance.
- `CHANGE_TYPE_DOR_DOD.md` — Definition of Ready/Done per typ zmiany, w tym RAW-to-contract.
- `RELEASE_READINESS_CONTRACT.md` — warunki GO/GO_WITH_P2/NO_GO dla release całej aplikacji.
- `UI_UX_CONTRACT_INDEX.md` — indeks i globalne wymagania dla kontraktów UX modułów.
- `_KNOWN_TRUTH_PHASE_2_PREP_2026-05-09.md` — przygotowanie fazy As-Is / Known Truth bez używania RAW jako wizji docelowej.
- `_KNOWN_TRUTH_MODULE_AUDIT_MATRIX_2026-05-09.md` — robocza macierz audytu 19 modułów: SSOT, registry, routing, kod, status i rozjazdy.
- `_AS_IS_FULL_MODULE_DOCUMENTATION_2026-05-09.md` — pełny opis As-Is dla 19 modułów: funkcjonalność, workflow, UI/UX, źródła i gotowość kodu.
- `_QUALITY_GATE_DOCUMENTATION_2026-05-10.md` — 3-warstwowy Quality Gate dokumentacji + wynik pokrycia funkcji Menu 2.
- `HIERARCHY_OF_TRUTH.md` — zamrożona hierarchia prawdy (globalna + per moduł) i reguły rozstrzygania konfliktów.
- `CONTRACT_OWNERSHIP_REGISTRY.md` — właściciele biznes/tech dla modułów i funkcji (model akceptacji kontraktów).
- `_P2_ZERO_CLOSURE_PLAN_2026-05-10.md` — plan domknięcia P2 do zera (owner + data + evidence + exit criteria).
