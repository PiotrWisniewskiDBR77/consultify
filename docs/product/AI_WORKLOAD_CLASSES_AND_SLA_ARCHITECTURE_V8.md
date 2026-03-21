# AI Workload Classes And SLA Architecture v8

> Status: Draft v8
> Owner: Product + Engineering
> Cel: zdefiniowac kanoniczny model `workload classes`, `latency budgets`, `reliability promises` i `execution economics` dla AI.

---

## 1. Why this matters for Consultify

Nie kazde zadanie AI powinno byc traktowane tak samo.
Inne oczekiwania ma:

- szybka odpowiedz czatowa,
- planner dla zlozonego tasku,
- background research,
- batch governance check,
- agentowy run wieloetapowy.

Bez klas workload system nie bedzie jednoczesnie szybki i stabilny.

---

## 2. Leader patterns

Imported patterns:

- leaders separate interactive and non-interactive work,
- model and reasoning choices depend on task shape,
- orchestration mode should match latency and budget requirements.

Key lesson:

`one default AI SLA` is not enough for serious business work.

---

## 3. Current V8 coverage

Strong inputs:

- `AI_LLM_MODEL_MANAGEMENT_V8.md`
- `AGENT_MULTI_AGENT_WORK_MANAGEMENT_V8.md`
- `MY_WORK_INBOX_AND_SLA.md`

Current gap:

- brak jednej kanonicznej mapy `workload class -> SLA -> routing profile -> orchestration expectations`.

---

## 4. Canonical target architecture

Canonical workload classes:

- `interactive_qna`
- `interactive_grounded`
- `planner`
- `reviewer`
- `background_research`
- `scheduled_check`
- `batch_processing`
- `high_risk_execution`

Each class should define:

- target latency band,
- reliability expectation,
- approval expectation,
- preferred execution profile,
- degraded mode behavior,
- operator priority.

## 4.1 Leader-grade hardening requirements

This architecture must also define:

- target latency and timeout bands per workload class,
- degraded-mode behavior for cost pressure, source unavailability and model fallback,
- mapping from workload classes to queue priority and execution profile policy,
- shared reporting dimensions so support and operations can inspect failures by class.

---

## 5. Contracts and boundaries

`AI_LLM_MODEL_MANAGEMENT_V8` owns execution profile strategy.

`Multi-Agent v8` owns orchestration mode choice.

This document owns the shared workload vocabulary and how it maps to SLA expectations across consumers.

---

## 6. Risks and failure modes

- expensive planners are used for low-value chat queries,
- slow jobs are exposed as if they were interactive,
- background tasks receive no reliability budget,
- support cannot classify whether a failure violated the right SLA.

---

## 7. Implementation implications

- define one workload taxonomy reused by routing and job control,
- attach SLA metadata to runs and outputs,
- distinguish latency-first, quality-first and cost-first degraded modes,
- align workload classes with queue priority and support dashboards.

---

## 8. Acceptance criteria

- AI interactions can be classified into shared workload classes.
- Each class has explicit latency, cost and reliability expectations.
- Routing and orchestration can reference the same workload vocabulary.
- Support can inspect failures and performance by workload class.

---

## 9. Related canonical docs

- `docs/product/AI_LLM_MODEL_MANAGEMENT_V8.md`
- `docs/product/AGENT_MULTI_AGENT_WORK_MANAGEMENT_V8.md`
- `docs/product/MY_WORK_INBOX_AND_SLA.md`
- `docs/product/AI_LEADER_PARITY_ARCHITECTURE_V8.md`
