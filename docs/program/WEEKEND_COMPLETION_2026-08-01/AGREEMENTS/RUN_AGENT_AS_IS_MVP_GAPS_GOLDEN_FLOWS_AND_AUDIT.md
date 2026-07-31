---
document_id: RUN-AGENT-AS-IS-MVP-GAPS-AUDIT
module: My Work / Run Agent
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Run Agent — remanent kodu, luki MVP, golden flows i audyt kompletności

## 1. AS-IS potwierdzony w repozytorium

| Obszar | Dowód | Stan |
| --- | --- | --- |
| My Work tab i legacy route | `MyWorkHub`, `AgentPlanView` | real |
| Lista i workspace | `AgentPlanPanel/Workspace/Canvas` | real/partial |
| 3-kolumnowy builder | control, linear canvas, palette | real |
| Katalog bloków | `agentWorkshopCatalog` | 20 tools + soon entries, ręczne odbicie |
| Plan builder | curated manifest playbooks + fallback | real, deterministyczny |
| Process library | classic-5 i DRD-4 | real, liniowa |
| Active executor | `agentPlannerService.executePlan` | płaska sekwencja |
| Status/run persistence | plans + steps, results/errors/durations | real |
| Approvals | side-effect tools + override + resume | real/partial |
| Schedule/wait | scheduler cron, `wait_until` resume | real/partial |
| Retry/interpolation | retry i `$step.N.field` | real/partial |
| Continue on error | final `completed_with_errors` | real, ryzykowny default semantyczny |
| DAG executor | `toolChainExecutor` dependsOn/maxParallel | istnieje, nie jest głównym runtime |
| Vault context | safe/folder selection, server search | real/partial |
| External connectors | enterprise search tools/control-plane docs | partial |
| Definition version/publish/test | brak pełnego modelu | gap |
| Branch/merge/loop/subprocess | brak w aktywnym executorze/UI | gap |
| Durable event waits | wait time istnieje; ogólny event wait brak | gap |
| Compensation/outcome acceptance | brak | gap |

## 2. Krytyczne rozjazdy

1. UI nazywa zapisany plan agentem/procesem, lecz data model miesza definition i run.
2. Canvas sugeruje schemat procesu, ale aktywny silnik wykonuje liniową tablicę.
3. Ręczny frontend catalog może rozjechać się z backend `AI_TOOLS`.
4. `etap-modul` często jest pojedynczym read tool, a nie pełną funkcją modułu.
5. Część ważnych modułów jest `soon`: Interview, Execution, Results, Materials.
6. Process library deklaruje klasyczny consulting, ale nie realizuje realnych
   human sessions, decyzji, handoffów i feedback loops.
7. Globalne continue-on-error może stworzyć raport mimo braku krytycznego etapu.
8. Approval zatrzymuje krok, ale brakuje pełnego exact-diff, role/SLA/expiry model.
9. Foldery agentów porządkują listę, lecz nie są pełnym scope/access modelem.
10. Brak published immutable version oznacza, że nie ma reprodukowalności runu.

## 3. P0 — stabilny staging z realnym golden flow

1. Rozdzielić `AgentDefinition/Version` od `AgentRun/NodeRun` lub stworzyć
   kompatybilną warstwę, która zamraża linear definition przed runem.
2. Wprowadzić draft → validate → test → publish; run tylko opublikowanej wersji
   lub jawny one-off draft test.
3. Dodać scope/project/owner/roles i tenant-safe list/detail/run/approval.
4. Zablokować catalog/runtime drift automatycznym registry endpoint/testem.
5. Opisać typed input/output schemas dla bloków MVP i walidować mapping.
6. Domknąć exact approval payload, approver resolution, expiry i immutable audit.
7. Idempotency dla wszystkich side-effect tools; retry nie tworzy duplikatu.
8. Per-step error policy; krytyczny failure nie przechodzi jako sukces.
9. Wykonać pełny proces: Vault → Assessment/analysis → Initiative proposal →
   approval → Task/Material draft → run report/read-back.
10. Zapewnić pause/cancel/resume po restarcie i czytelny run monitoring.
11. Dodać cost/time/action limits oraz kill switch.
12. Zamknąć project ID caller-trust także dla Agent/Vault tool inputs.

## 4. P1 — docelowo mocne MVP

- conversational graph builder z structural diff;
- condition branching i reusable sub-process;
- parallel independent branches przez jeden durable executor;
- event waits dla Decision/Task/Interview/Vault;
- test mode z mocks/assertions i version comparison;
- Templates z bindings i publish governance;
- pełne Interview/Execution/Results/Materials capabilities;
- connector capability registry i minimum-scope binding;
- artifact blocks DOCX/PPTX/XLSX/Canvas;
- run outcome review, final report i improvement proposal;
- mobile approvals/monitoring oraz accessibility outline canvas.

## 5. P2

- foreach/controlled loops i dynamic fan-out;
- sub-agents z bounded tools i multi-agent orchestration;
- compensation workflows;
- organization pre-approval policies;
- marketplace, signed templates i external developer SDK;
- advanced optimization/cost routing i process mining;
- cross-run continuous improvement z pełnym governance.

## 6. Golden flows

### GF-AGT-01 — Teresa projektuje proces

Opis celu → assumptions → draft grafu → manual/conversational edit → validation
→ test → diff → publish. Sprawdzić, że brak connection/schema/approval blokuje
publish i że published version nie zmienia się po dalszej rozmowie.

### GF-AGT-02 — proces konsultingowy end-to-end

Projekt + Vault sources → diagnoza → findings z citations → initiative proposals
→ financial/capacity analysis → decision approval → tasks → material draft →
owner review → accepted run outcome. Każdy downstream obiekt ma read-back.

### GF-AGT-03 — approval i zmiana danych

Agent przygotowuje write → approval pokazuje exact diff → payload zmienia się
przed akceptacją → stara zgoda unieważniona → nowa zgoda → idempotent write.

### GF-AGT-04 — błąd i odzyskanie

Transient connector error → retry/backoff → reauth required → human action →
resume po restarcie → brak duplikatów. Permanent quality failure idzie fallback
lub zatrzymuje zgodnie z policy; raport nie ukrywa problemu.

### GF-AGT-05 — schedule/event/wait

Scheduled start w timezone → wait na Interview/Decision event → expiry/escalation
→ event dedupe → resume → completion. DST i missed schedule są jawne.

### GF-AGT-06 — security

User/model próbuje zmienić project/Vault/connector scope → server deny; template
bez bindingu nie uruchamia się; utrata membership zatrzymuje następny krok;
logs/outputs nie ujawniają secrets ani cross-tenant danych.

### GF-AGT-07 — wersja i rerun

Run v1 → draft v2 → publish → history zachowuje v1 → rerun checkpoint pokazuje
reused outputs i side effects → nowy attempt ma oddzielny audit.

## 7. Audyt kompletności dokumentacji

| Obszar | Dokument | Pokrycie |
| --- | --- | --- |
| misja, granice, autonomia | review | pełne |
| Harvey + konkurencja | benchmark | pełne, źródła oficjalne |
| menu/listy/builder/run UX | IA/UX | pełne target |
| graf, dane, bloki | process model | pełne target |
| Teresa i metodyka | Teresa standard | pełne target |
| approval/error/security | execution contract | pełne target |
| moduły/connectors | cross-module contract | pełne target |
| dane/API/events/metrics | blueprint | pełne target |
| kod i braki | ten dokument | evidence-based |
| szczegółowe API per każdy moduł | przyszłe capability specs | otwarte do implementacji |
| finalne owner decisions | pytania dokumentów | celowo odłożone |

Werdykt: `PASS_DOC_ARCHITECTURE / PARTIAL_RUNTIME / MVP_P0_OPEN`.

## 8. Definition of Ready i Done

Backlog item wskazuje funkcję/block/capability, AS-IS evidence, schema, roles,
side effect, approval, errors, events, telemetry, test i rollback. Done oznacza
fresh DB, PL/EN, owner/member/denied, real tool/fixture, restart/retry, audit,
visual desktop/mobile evidence i przejście właściwego golden flow.

## 9. Pytania do odbioru

1. Czy w dwa dni MVP robimy rozdzielenie definition/run, czy warstwę kompatybilną nad istniejącym planem?
2. Który pojedynczy flagowy proces ma być podstawą odbioru GF-AGT-02?
3. Czy DAG/condition wchodzi do MVP, czy publikujemy najpierw uczciwy linear engine?
4. Czy `completed_with_errors` może przejść do business review, czy zawsze wymaga manual resolution?
5. Które trzy brakujące capabilities są absolutnym P0: Interview, Execution, Results czy Materials?
