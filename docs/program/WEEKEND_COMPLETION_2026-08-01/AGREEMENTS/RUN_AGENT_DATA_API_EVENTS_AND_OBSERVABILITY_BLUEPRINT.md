---
document_id: RUN-AGENT-DATA-API-EVENTS-OBSERVABILITY
module: My Work / Run Agent
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Run Agent — blueprint danych, API, zdarzeń i obserwowalności

## 1. Encje źródła prawdy

| Encja | Odpowiedzialność |
| --- | --- |
| `AgentDefinition` | identity, owner, scope, lifecycle i current draft/published |
| `AgentVersion` | immutable graph/config/policy checksum |
| `AgentNodeVersion` | typ bloku i snapshot konfiguracji |
| `AgentEdge` | source/target/condition/mapping |
| `AgentBinding` | module/tool/knowledge/connection/role reference |
| `AgentTrigger` | manual/event/schedule/webhook contract |
| `AgentTestCase/Result` | fixture, mocks, assertions i evidence |
| `AgentRun` | wykonanie konkretnej version i input manifest |
| `NodeRun/Attempt` | state, input/output refs, error, timing, cost |
| `RunArtifact` | plik/dataset/output z provenance |
| `ApprovalRequest/Decision` | exact action, approver i immutable resolution |
| `RunCheckpoint` | durable recovery point |
| `EventSubscription` | wait correlation i expiry |
| `AgentPolicy` | autonomy, limits, approvals, models i data |
| `AgentAuditEvent` | append-only actor/action/resource/result |

Definition nie zawiera wykonawczego statusu. Run nie przechowuje mutable copy
grafu; wskazuje immutable `agentVersionId` i snapshots resolved bindings/policy.

## 2. Graf i schemas

Graph document zawiera nodes, edges, entrypoints i terminals. Node config używa
versioned schema. Migrator block version działa jawnie i tworzy draft diff.
Unknown/deprecated version blokuje publish/run zgodnie z policy, nie jest cicho
normalizowana.

Input/output payloady większe lub wrażliwe są przechowywane jako encrypted
artifact references. W bazie runu zapisujemy schema, checksum, classification,
storage locator i redacted preview. Secrets to wyłącznie credential handles.

## 3. API groups

### Definitions

`createDefinition`, `get/list`, `updateDraft` z optimistic concurrency,
`validate`, `diff`, `submitReview`, `publish`, `deprecate`, `cloneFromTemplate`,
`export/import`, `resolveBindings`.

### Teresa builder

`proposeProcess`, `proposeChange`, `explainGraph`, `reviewQuality` zwracają
structured proposal i graph patch. Żaden endpoint nie stosuje zmiany bez
expected draft version i human accept.

### Tests

`createTestCase`, `runNode/branch/processTest`, `getTrace`, `compareResults`,
`approveEvidence`. External writes są mock/dry-run, chyba że jawny sandbox.

### Runs

`createRun`, `schedule`, `pause`, `resume`, `cancel`, `provideInput`, `retry`,
`rerunFromCheckpoint`, `get/list`, `streamEvents`, `getRunReport`.

### Approvals

`listForUser/project`, `get`, `approve`, `reject`, `requestChanges`, `delegate`.
Resolution przyjmuje expected payload hash i idempotency key.

Każda mutation zwraca authoritative read-back i correlation ID. Long action
zwraca job/run ID. Bulk list/admin endpoints mają pagination i tenant filter.

## 4. Zdarzenia domenowe

- `agent.definition.created|changed|submitted|published|deprecated`;
- `agent.run.created|queued|started|paused|resumed|completed|failed|cancelled`;
- `agent.node.ready|started|completed|failed|retry_scheduled|skipped`;
- `agent.input.requested|provided|expired`;
- `agent.approval.requested|approved|rejected|expired|delegated`;
- `agent.output.proposed|handed_off|accepted|rejected`;
- `agent.binding.unhealthy|reauth_required|permission_lost`;
- `agent.policy.denied|budget_warning|budget_exhausted`;
- `agent.compensation.started|completed|failed`.

Event ma organization/project, agent/version/run/node/attempt, actor, timestamp,
correlation/causation, redacted summary i schema version. Event bus nie przenosi
pełnych dokumentów ani sekretów.

## 5. Observability

### Techniczne

Queue lag, worker utilization, node duration/error/retry, scheduler drift,
stuck leases, wait age, event delivery, connector latency/rate limit, model
latency/tokens/cost, artifact storage i stream disconnects.

### Produktowe

Time to first published agent, draft-to-publish conversion, template reuse,
run completion, approval wait, human interventions, reruns, corrected outputs,
accepted deliverables, process lead time i user-reported quality.

### Konsultingowe/business

Czy agent doprowadził do przyjętego outputu, Initiative/Task/Decision acceptance,
Execution progress i KPI/benefit result. Mierzymy closed-loop impact, nie liczbę
wywołań modelu.

## 6. Run trace i raport

Trace per node: sanitized input refs, resolved tool/binding, policy decision,
start/end/attempt, output refs, citations, token/cost, errors i approval. UI
pokazuje business timeline; technical trace jest rozwijany lub eksportowany.

Final report:

- intended outcome i run version;
- inputs/source manifest;
- completed/skipped/failed/compensated paths;
- approvals/decisions;
- outputs i downstream read-backs;
- warnings, unresolved gaps i assumptions;
- time/cost/human effort;
- outcome acceptance;
- suggested process improvements.

## 7. Retencja

Definition/versions i audit zgodnie z organizacją. Run inputs/outputs mogą mieć
krótszą retencję per project/sensitivity. Usunięcie definition nie usuwa run
evidence. Purge przechodzi dependency/legal hold. Telemetry jest zagregowana i
redacted; nie staje się cross-client training data.

## 8. Migracja obecnego modelu

1. Zinwentaryzować `ai_agent_plans/steps`, templates i folders.
2. Rozdzielić definition od run bez niszczenia historycznych planów.
3. Zamrozić istniejący linear plan jako AgentVersion v1.
4. Nadać nodes stabilne IDs, schemas i bindings.
5. Podłączyć istniejący `toolChainExecutor` przez wspólny durable scheduler albo
   przenieść jego DAG semantics do nowego executora; nie utrzymywać dwóch silników.
6. Dodać branching/parallel najpierw w test mode, następnie feature-gated runtime.
7. Przepiąć approvals i waits na first-class encje.
8. Backfill raportuje unknown tools/missing project scope; nie zgaduje.

## 9. Pytania do odbioru

1. Czy przechowujemy każdy node input/output, czy tylko references i redacted previews?
2. Czy import/export definition ma być zgodny z zewnętrznym formatem, czy własny?
3. Jak długo przechowujemy run trace i koszt per klient?
4. Czy outcome acceptance jest obowiązkowe dla każdego procesu konsultingowego?
5. Czy telemetry procesu może służyć do rekomendacji między organizacjami w formie anonimowej?
