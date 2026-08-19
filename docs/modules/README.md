# Modules (catalog) — start here

> Nadrzędna mapa rodzajów prawdy: `docs/SOURCE_OF_TRUTH.md`. Funkcjonalna
> kolejność aplikacji: `docs/FUNCTIONAL_DOCUMENTATION.md`. Ten katalog
> przechowuje kontrakty, również zagnieżdżonych podsystemów, ale nie definiuje
> samodzielnie głównego menu.

Cel tego katalogu: trzymać **jeden, spójny punkt odniesienia** dla modułów i
podsystemów (dla ludzi i agentów). Numeracja historyczna tego katalogu nie jest
już interpretowana jako kolejność sidebara; obowiązującą kolejność 1–16
definiuje `docs/FUNCTIONAL_DOCUMENTATION.md`.

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

- Kanonicznym punktem wejścia jest kontrakt wskazany w
  `docs/FUNCTIONAL_DOCUMENTATION.md`.
- Pliki `00-07` pozostają szczegółową warstwą wspierającą, dopóki nie zostaną
  uzgodnione z bieżącym kontraktem pozycji menu.
- Pliki nawigacyjne są indeksami i nie powinny konkurować z bieżącym
  kontraktem.

## Bieżąca struktura menu

Aktualna lista 16 pozycji oraz ich kanoniczne punkty wejścia znajduje się w
`docs/FUNCTIONAL_DOCUMENTATION.md`. Historyczna numeracja 19 katalogów nie jest
już interpretowana jako kolejność sidebara.

- `01_czat`–`08_finanse`, `13_meeting`, `16_organizacja`–`19_portal-partnerski`
  zawierają kontrakty pozycji menu;
- `09_outputs`, `10_dokumenty`, `11_tabele`, `12_prezentacje` są podsystemami
  pozycji `Materials`;
- `14_mcp-iris` i `15_mcp-marketplace` są dokumentacją techniczną/historyczną,
  a nie pozycjami menu;
- Assessment i Audits mają kontrakty konsolidujące w `docs/functional/`.
- Case Workspace / `Zlecenia` jest podsystemem `My Work`; jego kanonicznym
  kontraktem docelowym jest `docs/product/case-workspace/12_CASE_WORKSPACE_MODULE_SSOT.md`,
  a nie osobna pozycja sidebara.

## SSOT (global) dla modułów

- Routing i granice odpowiedzialności modułów: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`
- Rejestr kanonicznych dokumentów: `DRD/consultify/docs/product/DOCUMENTATION_REGISTRY.md`
- Standard UI/UX dla modułów (Menu 2/3, huby): `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`
- Zlecenia / Case Workspace w My Work: `DRD/consultify/docs/product/case-workspace/12_CASE_WORKSPACE_MODULE_SSOT.md`

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
- `_RAW_TARGET_STATE_2_0_PLAYBOOK_2026-05-10.md` — operacyjny playbook konwersji RAW -> Contract 2.0 dla każdego modułu.
- `_RAW_TARGET_STATE_2_0_SEQUENCE_TRACKER_2026-05-10.md` — sekwencja i status realizacji RAW 2.0 (start od `01_czat`).
- `_RAW_TARGET_STATE_2_0_MODULE_PACKET_TEMPLATE.md` — szablon pakietu modułowego do pracy RAW 2.0.
- `_FUNCTION_AGENT_DISPATCH_PROTOCOL_2026-05-10.md` — protokół uruchamiania agentów funkcji z immutable `scope_anchor` i ochroną `BLOCKED_SCOPE_DRIFT`.
- `_FUNCTION_EXECUTION_CARD_TEMPLATE.md` — szablon karty funkcji do zarządzania decyzją, UI/UX, backlogiem P0/P1/P2, evidence i impact.
- `_DOCS_SOT_TASKBOARD_AUDIT_2026-05-10.md` — audyt spójności dokumentacji, source-of-truth i taskboardów wraz z listą uchybień i napraw.
- `UI_UX_CONTRACT_INDEX.md` — indeks i globalne wymagania dla kontraktów UX modułów.
- `_KNOWN_TRUTH_PHASE_2_PREP_2026-05-09.md` — przygotowanie fazy As-Is / Known Truth bez używania RAW jako wizji docelowej.
- `_KNOWN_TRUTH_MODULE_AUDIT_MATRIX_2026-05-09.md` — robocza macierz audytu 19 modułów: SSOT, registry, routing, kod, status i rozjazdy.
- `_AS_IS_FULL_MODULE_DOCUMENTATION_2026-05-09.md` — pełny opis As-Is dla 19 modułów: funkcjonalność, workflow, UI/UX, źródła i gotowość kodu.
- `_QUALITY_GATE_DOCUMENTATION_2026-05-10.md` — 3-warstwowy Quality Gate dokumentacji + wynik pokrycia funkcji Menu 2.
- `HIERARCHY_OF_TRUTH.md` — zamrożona hierarchia prawdy (globalna + per moduł) i reguły rozstrzygania konfliktów.
- `CONTRACT_OWNERSHIP_REGISTRY.md` — właściciele biznes/tech dla modułów i funkcji (model akceptacji kontraktów).
- `_P2_ZERO_CLOSURE_PLAN_2026-05-10.md` — plan domknięcia P2 do zera (owner + data + evidence + exit criteria).
- `_PROGRAM_BOARD_FULL_ROLLOUT_2026-05-11.md` — globalny board wdrożeniowy runtime (fale, zależności, ownership).
- `_PROGRAM_GATE_BOARD_G1_G7_2026-05-11.md` — board bramek integracyjnych `G1..G7` z cadence i regułami verdict.
- `_PROGRAM_STATUS_GLOSSARY_2026-05-11.md` — kanoniczny słownik statusów (program/moduły/testy/gates).
- `_GLOBAL_P0_DECISIONS_REGISTER_2026-05-11.md` — rejestr zamknięć decyzji `GB-P0-001..007`.
- `_FINAL_SYSTEM_INTEGRATION_CERTIFICATE_2026-05-11.md` — certyfikat integracji systemowej i decyzja wejścia do rollout runtime.
- `_WAVE1_DELIVERY_RUNTIME_EXECUTION_REPORT_2026-05-11.md` — raport wdrożenia runtime dla fali `09/10/11/12` z dowodami Teresa-executed work.
- `_G1_G7_INTEGRATION_CADENCE_2026-05-11.md` — operacyjny rytm przeglądów integracyjnych i bramek release readiness.
- `_AGENT_DISPATCH_AND_MEMORY_PLAYBOOK_2026-05-12.md` — zasady uruchamiania agentów, WIP=2, assignment cards i zarządzanie pamięcią.
- `_MODEL_ROUTING_MATRIX_2026-05-12.md` — mapowanie trudności zadań do modeli (`codex 5.3`, `gpt 5.5`, `opus 4.7`) i reguły eskalacji.
- `_GATE_TEST_BLUEPRINT_2026-05-12.md` — obowiązkowy blueprint testów per gate (flow + Playwright + Anygravity + evidence).
- `_UI_COMPONENT_FREEZE_REGISTRY_2026-05-12.md` — strict freeze komponentów UI/UX (`APPROVED/CONDITIONAL/FORBIDDEN`).
- `DRD/testy_antygravity/_ANYGRAVITY_COMMUNICATION_PROTOCOL_2026-05-12.md` — precyzyjny protokół komunikacji z testerem Anygravity (prompt -> raport -> fix/retest loop).
