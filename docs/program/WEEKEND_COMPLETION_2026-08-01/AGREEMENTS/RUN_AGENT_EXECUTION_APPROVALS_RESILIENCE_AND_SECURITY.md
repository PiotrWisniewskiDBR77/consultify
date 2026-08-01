---
document_id: RUN-AGENT-EXECUTION-APPROVALS-RESILIENCE-SECURITY
module: My Work / Run Agent
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Run Agent — wykonanie, zgody, odporność i bezpieczeństwo

## 1. Lifecycle definicji

`draft → in_review → published → deprecated → archived`.

- draft jest edytowalny i ma working version;
- in_review zamraża candidate version i zbiera uwagi;
- published tworzy immutable semantic version;
- zmiana published tworzy nowy draft;
- deprecated blokuje nowe runy, chyba że policy pozwala wyjątek;
- archived ukrywa, zachowując run history.

Publish zapisuje autora, approvera, checksum grafu, block versions, prompts,
knowledge bindings, tools, required connections i policy snapshot.

## 2. Lifecycle runu

`created → validating → queued → running` z możliwymi stanami:

- `waiting_input`;
- `waiting_approval`;
- `waiting_event/time`;
- `paused`;
- `retry_scheduled`;
- `completed`;
- `completed_with_warnings`;
- `failed`;
- `cancelled`;
- `compensating/compensated`.

Run status wynika z node states, ale nie miesza technicznego completed z
business acceptance. Oddzielne `outcomeStatus`: pending_review, accepted,
rejected, partially_accepted lub not_applicable.

## 3. Scheduler i workers

Trigger service tworzy idempotentny run. Queue wybiera worker według capability,
regionu i sensitivity. Worker pobiera gotowe nodes z grafu. State/checkpoints są
trwałe w bazie; proces nie polega na pamięci jednego serwera. Heartbeat/lease
zapobiega dwóm wykonawcom. Expired lease pozwala bezpiecznie przejąć node tylko,
jeśli jego idempotency/compensation policy na to pozwala.

Limity: concurrent runs per org/agent, max parallel nodes, max runtime, turns,
tool calls, tokens/cost, loop iterations, payload/artifact size i rate limits.

## 4. Approval jako obiekt domenowy

Approval ma:

- run/node/action ID i version;
- requester/agent/execute-as identity;
- approver role oraz resolved users;
- summary, rationale, sources i confidence;
- exact action payload/diff;
- destination, recipients i permissions impact;
- side-effect/reversibility classification;
- expiry, reminder, delegation i escalation;
- decisions: approve, reject, request changes, provide alternative;
- comment, timestamp i immutable audit.

Zmiana payload po approval unieważnia zgodę. Approval nie może być ponownie
wykorzystany dla innego runu. Approver musi nadal mieć mandat w momencie action.

## 5. Policy gates

Approval jest obowiązkowy minimum dla:

- publikacji/wysyłki do zewnętrznych odbiorców;
- tworzenia lub zmiany Initiative/Decision/KPI/Finance actual;
- zmiany ownera, budżetu, terminu lub stanu krytycznego obiektu;
- destructive/irreversible action;
- zmiany ACL/scope/sensitivity;
- użycia restricted data/model/connector;
- działania o wartości/ryzyku ponad próg;
- low confidence, source conflict lub policy exception.

Routine reversible actions mogą działać w ramach pre-approval policy: określony
agent version, tool, scope, limit, okres i owner. Policy ma revocation i usage log.

## 6. Błędy i retry

Node error taxonomy: validation, permission, auth/reauth, rate limit, timeout,
transient provider, unavailable dependency, bad output schema, quality failure,
human timeout, business rejection, policy denial i unknown.

Policy per node:

- retry count/backoff/jitter i retryable errors;
- stop run;
- skip with warning;
- fallback block/path;
- wait for human;
- compensate completed effects;
- continue independent branches, cancel dependent branches.

Retry reuse idempotency key. External action bez idempotency wymaga reconciliation
przed ponowieniem. `Continue-on-error` nie jest globalnym domyślnym zachowaniem
procesu konsultingowego; musi być świadomie ustawione i widoczne w final report.

## 7. Cancel, rollback i compensation

Cancel zatrzymuje nowe nodes i wysyła cooperative cancellation do running. Nie
udaje cofnięcia już wykonanych writes. Dla compensatable action definition
wskazuje compensation command oraz wymaganie approval. Run report rozróżnia:
not started, cancelled, completed, compensation pending/completed/failed.

Rerun from checkpoint tworzy nowy run attempt/branch history, nie przepisuje
starych rezultatów. Użytkownik widzi, które outputs zostają reused i które
actions zostaną wykonane ponownie.

## 8. Security model

Effective permission = tenant + run initiator + agent service identity + project
role + tool capability + connection binding + data policy. `Execute as` jest
jawne per tool: initiating user, agent service account albo named connection;
delegation nie może zwiększyć praw poza policy.

Definition nie przechowuje secrets. Tool otrzymuje krótkotrwały credential
handle i minimalny scope. Input/output/logi mają classification i redaction.
Prompt injection z dokumentu nie może zmienić tool allowlist, recipients,
approval policy ani system instructions.

## 9. Testy bezpieczeństwa

- podmiana project/org/resource ID w node input;
- model próbuje wywołać tool poza allowlist;
- template skopiowany bez connection binding;
- utrata membership w czasie waiting approval;
- approval payload zmieniony po zgodzie;
- retry tworzący duplikat downstream;
- concurrent worker wykonujący ten sam node;
- malicious content nakazujący exfiltration;
- output z PII trafiający do niższej sensitivity;
- cross-tenant sub-process/KB/connection;
- expired webhook signature i replay;
- cancel podczas external action;
- compromised/deprecated block version.

## 10. Pytania do odbioru

1. Czy default error policy ma być fail-fast, czy continue independent branches?
2. Czy pre-approval policies wchodzą do MVP?
3. Jaki jest domyślny expiry approval i escalation path?
4. Czy agent service accounts powstają per organization czy per project?
5. Czy compensation może uruchomić się automatycznie, czy zawsze wymaga zgody?
