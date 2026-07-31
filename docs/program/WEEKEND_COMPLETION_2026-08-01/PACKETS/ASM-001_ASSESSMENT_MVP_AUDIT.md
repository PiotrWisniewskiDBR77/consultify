---
doc_id: ASM-001
truth_type: verified-as-is
status: READY_FOR_DECISION
owner: codex
product_owner: piotr
priority: P0
depends_on: UI-UX-GATE-0
last_reviewed: 2026-08-01
---

# ASM-001 — Assessment MVP audit

## Werdykt

Stan: **FIX**.

Assessment ma jeden realny route owner i dojrzały DRD editor, ale nie realizuje jeszcze
uzgodnionego standardu pięciu powierzchni:

`Library → Processes → Outputs → Reports → Initiatives`.

Zamontowany `AssessmentHub` ma tylko trzy zakładki: `Assessment`, `Reports`,
`Initiatives`. Library istnieje jako komponent i definicje metodologii, Processes jako
lista assessment rows, a Outputs są rozproszone między workbench promotion,
`assessment_reports`, Report Builder i importy raportów. Nie należy scalać tego przez
nowy store. Należy rozdzielić widoki nad istniejącymi owner objects i zamknąć najpierw
jeden DRD golden flow.

## Route authority i domyślna powierzchnia

### Realny owner

- `/assessment/*` jest jedynym aktywnym ownerem modułu w `src/routes/AppRoutes.tsx`.
- `/assessment`, `/assessment/overview`, `/assessment/summary` oraz historyczne
  `/assessment/drd|siri|adma|cmmi|lean` montują `AssessmentHub`.
- `/assessment/:framework/:assessmentId` montuje `AssessmentSessionEditorView`.
- otwarcie assessmentu z Hub zawsze kieruje do realnego session editora; safety net
  usuwa możliwość pozostania na placeholder document card.

### Faktyczny default

- `AssessmentHub` startuje z `initialTab='list'` i zakładką nazwaną `Assessment`.
- To jest lista instancji/procesów, nie Library.
- Wymagany default MVP to **Library**: użytkownik najpierw wybiera metodologię/template,
  a dopiero potem tworzy lub otwiera proces.

Decyzja rekomendowana: zachować `/assessment` jako route owner, ale zmienić semantykę
tabów na pięć powierzchni i ustawić `library` jako default. `?tab=processes` powinien być
stabilnym deep linkiem do obecnej listy. Historyczne query/deep linki do assessment id
muszą nadal otwierać session editor.

## Macierz pięciu powierzchni

| Powierzchnia | Stan | Obecny runtime | Kanoniczny owner | Luka MVP |
| --- | --- | --- | --- | --- |
| Library | `NIEPODŁĄCZONA/CZĘŚCIOWA` | `TemplateLibrary`, framework metadata, V8 definition endpoints, `AssessmentV8CanonPanel` | published assessment definitions / methodology versions | brak zakładki i defaultu; create modal ma własną listę frameworków zamiast jednego katalogu |
| Processes | `CZĘŚCIOWA+` | obecna zakładka `Assessment`; list/create/delete/status; route do editora | `assessments` row jako instance/run envelope | klient ma cache fallback; nazwa miesza moduł z procesem; V8→workflow-v2 fallback bez widocznego provenance |
| Outputs | `CZĘŚCIOWA/BRAK powierzchni` | P28 workbench promotion, score/interpretation outcome, report context, imported reports | completed workbench run + artifact registry promotion trace | nie ma jednej listy wyników runu; score snapshot, interpretation i promoted artifact nie są jednym UI read-backiem |
| Reports | `CZĘŚCIOWA+` | Hub łączy assessment reports, Report Builder reports i report imports | finalny dokument: Report Builder/artifact; `assessment_reports` jako assessment-native source/snapshot | lista miesza trzy typy; nie zawsze jasno pokazuje source assessment/run, finalization i builder id |
| Initiatives | `CZĘŚCIOWA+` | assessment-derived initiatives i generation wizard | canonical `initiatives`, lineage przez `source_type/source_id`, generation runs/batches | filtrowanie source odbywa się także w kliencie; trzeba wymusić completed/reviewed output jako źródło i dedupe/read-back |

## Konkurencyjne edytory

### Aktywny shell

`AssessmentSessionEditorView` jest jedynym aktywnym shellem sesji. Dla DRD montuje trzy
równoległe prezentacje tej samej `answers.drd.areas`:

1. `DRDForm` — default; „Formularz”.
2. `DRDAssessmentEditor` — „Tabela”; bogaty enterprise editor z manage panels.
3. `DRDMatrixSession` — „Macierz”; overview maturity matrix.

Adapter `areasToFormData` / `formDataToAreas` ma utrzymać interoperacyjność. To są trzy
widoki jednego answer store, nie trzy osobne procesy. Ryzyko pozostaje, ponieważ każdy
widok ma własne komponenty, logikę completeness i część nawigacji.

### Pozostałe generacje

- `AssessmentWizard` i framework tool forms są starszymi/generalnymi kreatorami.
- SIRI i ADMA mają osobne enterprise editors.
- CMMI i Lean korzystają z tool forms; editor dla nieobsłużonego frameworku może pokazać
  „Editor not available yet”.
- `AssessmentManagePanel` ma osobne zakładki workflow/team/initiatives/reports/access/logs,
  które częściowo dublują powierzchnie Hub.
- `AssessmentWorkbenchPanel` i `AssessmentV8CanonPanel` są governance lane ukrytym
  domyślnie, nie podstawowym procesem wypełniania DRD.

Rekomendacja: nie usuwać Form/Table/Matrix. Ustanowić DRD Form jako entry, jeden
`answers.drd.areas` contract i wspólny server-derived completeness/score read-back.
Manage pozostaje contextual drawer, a pięć powierzchni należy do Hubu.

## Kanoniczne stores i kontrakty

### Definition / Library

- `AssessmentDefinitionService` oraz V8
  `/api/v8/assessment/definitions/:methodologyId` utrzymują wersje definicji.
- Published definition jest read-only i przypinana do runu przez
  `assessment_definition_id` oraz `assessment_definition_version`.
- `TemplateLibrary` nie jest obecnie route-owned default surface.

### Instance / Session / answers

- Kanoniczny owner instancji to `assessments`, org-scoped.
- `answers_json` przechowuje odpowiedzi; DRD używa `answers.drd.areas`.
- `score_summary`, `completion_percent`, `confidence_avg`, `context_snapshot`,
  `navigation_json` są na assessment row.
- `assessment_sessions` rejestruje otwarcie sesji; per-user navigation i assignments
  mają osobne endpointy/state.
- `AssessmentSessionEditorView` preferuje `V8AssessmentApi`, a dla 400/403/404/405/501
  przechodzi na `/assessment-workflow-v2`. Oba tory czytają/piszą tę samą assessment row,
  lecz fallback może maskować niekompletny V8 contract.

Wniosek: `assessmentId` jest jednocześnie instance id i P28 `assessmentRunId`. Dla MVP
to akceptowalne, ale API/UI powinny używać jawnej nazwy `runId=assessmentId`, aby nie
tworzyć drugiej tabeli runów bez potrzeby.

### Score / interpretation

- Nie ma osobnego kanonicznego score store używanego konsekwentnie przez wszystkie
  powierzchnie.
- surowe/aktualne podsumowanie znajduje się w `assessments.score_summary`;
- P28 proposal, review, overrides, interpretation i audit są serializowane w
  `assessments.p28_workbench_v1`;
- framework editors wyliczają część completeness po stronie klienta;
- `assessment_reports` również przechowuje score/report snapshots właściwe dla raportu.

Rekomendowany owner wyniku runu: reviewed outcome z `p28_workbench_v1`; `score_summary`
jest jego materialized read projection. UI nie powinien publikować score jako Output,
dopóki proposal nie ma review/override.

### Reports

- `assessment_reports` jest assessment-native report/version snapshot store.
- Report Builder jest właścicielem edytowalnego/finalnego dokumentu raportowego.
- Hub pobiera `Api.getAssessmentReports`, osobno report imports i może nawigować do
  `/reports/builder/:id`.
- DRD report generation ma osobny model/generator/template i benchmark tests.

Rekomendowany kontrakt: `assessment_reports` przechowuje source snapshot i lineage;
Report Builder/artifact registry jest ownerem finalnego dokumentu. Lista Reports musi
pokazywać oba identyfikatory i nie udawać, że import, snapshot i finalny report są tym
samym typem.

### Initiatives

- Kanoniczne rekordy są zapisywane do `initiatives` przez
  `assessmentInitiativeService.persistInitiatives`.
- lineage: `source_type` (`assessment`, `assessment_report`, framework variants) oraz
  `source_id`; generation runs/batches zapewniają dodatkowy audit.
- Hub dodatkowo filtruje listę po source w kliencie.

Nie tworzyć assessment-local initiative store. Generation powinien materializować
Candidate/Initiative przez jeden choke point, a potem potwierdzić read-back z canonical
Initiatives API.

## DRD jako pierwszy golden flow

Docelowy pierwszy flow:

`Library: DRD published definition → Create Process → DRD Form → save/reopen →
Matrix read-back → evidence → score proposal → human review → interpretation review →
completed Output → create Report → finalized Report → generate Initiative → canonical
Initiatives read-back`.

### Co jest już realne

- create/list/open assessment i org scope;
- DRD Form/Table/Matrix nad `answers.drd.areas`;
- autosave/update i reopen;
- per-user navigation, assignments, permissions i workflow fragments;
- P28 definition/run, evidence, score proposal/review, interpretation/review i promotion;
- DRD report generator/templates oraz report builder handoff;
- initiative generation/persist with lineage.

### Czego nie udowodniono jako jednego flow

- Library jako route default i create from published definition;
- jeden server-derived score/completeness identyczny w Form/Table/Matrix;
- completed reviewed Output widoczny jako osobny trwały obiekt/list item;
- Output → final Report z jednoznacznym source/run lineage;
- final Report/Output → Initiative z dedupe i canonical read-back;
- pełny browser E2E obejmujący wszystkie pięć powierzchni.

## Minimalny implementowalny slice — ASM-001A

### Cel

Zamknąć pierwsze dwa przejścia i fundament pozostałych:

`Library (DRD definition) → Create Process → DRD save/reopen → Matrix read-back`.

### Zakres

1. Rozszerzyć `AssessmentHub` do pięciu stabilnych tab ids:
   `library`, `processes`, `outputs`, `reports`, `initiatives`.
2. Ustawić `library` jako default `/assessment`; obecną listę przenieść bez rewrite do
   `processes`.
3. Library ma czytać published definitions z V8 definition API. Karty niewspierane w MVP
   mogą być disabled z jawnym statusem; DRD ma aktywne `Start`.
4. `Start DRD` tworzy assessment przez V8 z przypiętym published definition id/version i
   przechodzi do `/assessment/drd/:id`.
5. DRD Form zapisuje do `answers.drd.areas`; po zapisie wykonać GET read-back.
6. Reopen tego samego id oraz przełączenie Matrix musi pokazać ten sam achieved/target
   state i server-derived completion.
7. Dodać jawne provenance w editorze: V8 canonical albo degraded legacy fallback.
8. Outputs/Reports/Initiatives mogą w tym slice zachować obecne dane, ale muszą mieć
   docelowe tab ids i poprawne empty states; nie implementować jeszcze nowych store’ów.

### Poza zakresem

- rewrite DRDAssessmentEditor;
- usunięcie workflow-v2 fallback;
- SIRI/ADMA/CMMI/Lean closure;
- pełny P28 scoring/report/initiative flow;
- migracja danych, nowa tabela outputów albo initiative dual-write.

### Pliki przewidywane

- `src/components/assessment/AssessmentHub.tsx`;
- `src/components/assessment/TemplateLibrary.tsx` lub cienki Library adapter;
- `src/components/assessment/NewAssessmentModal.tsx`;
- `src/views/AssessmentSessionEditorView.tsx`;
- `src/services/api/v8/assessment.ts` tylko jeśli brakuje typed create-from-definition;
- V8 assessment route/service wyłącznie dla brakującej walidacji published definition;
- testy component/route/real DB/browser.

## Acceptance criteria

- `/assessment` otwiera Library, a `?tab=processes` otwiera listę instancji;
- refresh/back/forward zachowują aktywny tab;
- DRD card pochodzi z published definition API i pokazuje version;
- create zapisuje `assessment_definition_id/version` na org-scoped assessment;
- foreign-org definition/assessment nie jest widoczny;
- Form save kończy się GET/read-back; błąd read-back nie daje fałszywego success;
- reopen zachowuje `answers.drd.areas`, completion i definition version;
- Matrix pokazuje te same achieved/target values co Form;
- brak drugiego assessment/session/score store;
- istniejące report i initiative deep linki nadal działają;
- V8 fallback jest oznaczony jako degraded, nie niewidoczny;
- standardowe table/preview/empty/error/loading są używane we wszystkich pięciu tabach.

## Testy wymagane

### Contract/service

- published DRD definition list/version;
- create rejects missing/unpublished/foreign definition;
- create persists definition id/version and assessment session;
- update/read answers round-trip bez utraty nieznanych pól;
- server-derived DRD completion jest deterministyczny.

### Route/security

- 401 bez tokenu;
- 404 dla foreign-org assessment;
- role matrix create/edit/read;
- V8 envelope i stable status normalization;
- legacy fallback tylko dla jawnie dozwolonych statusów błędu.

### Frontend

- Library jest defaultem;
- pięć tabów ma poprawne URL state;
- DRD Start → editor;
- Form save/reopen;
- Form ↔ Matrix parity;
- loading/empty/degraded/hard error;
- Reports i Initiatives zachowują dotychczasowe deep links.

### Real-route DB

`published DRD definition → POST assessment → PUT answers → GET assessment → assert
definition/version + answers + completion + org scope`.

### Browser golden slice

1. Otwórz `/assessment` i potwierdź Library.
2. Uruchom DRD.
3. Wprowadź achieved/target i notatkę dla jednej area.
4. Poczekaj na zapis i przeładuj.
5. Otwórz Matrix i potwierdź te same wartości.
6. Wróć do `Processes` i ponownie otwórz run.

## Następne slice'y

- `ASM-001B`: completed reviewed workbench outcome jako Outputs read model;
- `ASM-001C`: Output → assessment snapshot → Report Builder final document lineage;
- `ASM-001D`: Output/Report → initiative generation → dedupe → canonical read-back;
- `ASM-002`: pełny DRD evidence/scoring/review golden flow;
- `ASM-003`: enforcement evidence quality, reviewer policy i audit.

## Recovery i decyzje

- tabs i Library wdrażać pod flagą `assessmentFiveSurfacesV1`;
- rollback flagą wraca do obecnego trzytabowego Hub bez zmian danych;
- nowe tab ids muszą mieć mapowanie compatibility: `list→processes`;
- create-from-definition jest additive; nie przepisywać istniejących assessments bez
  osobnej decyzji/backfillu;
- assessment bez definition ref pozostaje widoczny jako `legacy/unversioned`, nie jest
  automatycznie przypisywany do najnowszej definicji;
- GO dla ASM-001A; FIX dla pełnego pięciopowierzchniowego MVP; NO-GO dla nowego
  równoległego output/score/initiative store.
