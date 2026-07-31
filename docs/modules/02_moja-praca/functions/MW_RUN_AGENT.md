---
module_id: MODULE_MY_WORK
function_id: MW_RUN_AGENT
function_name: Run Agent
doc_kind: FUNCTION_CONTRACT
status: active
owner: product
last_updated: 2026-07-31
---

# Function Contract — Run Agent

> Kompletny pakiet zaczyna się w [`MY_WORK_RUN_AGENT_REVIEW.md`](../../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/MY_WORK_RUN_AGENT_REVIEW.md). Remanent i bramka MVP: [`RUN_AGENT_AS_IS_MVP_GAPS_GOLDEN_FLOWS_AND_AUDIT.md`](../../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/RUN_AGENT_AS_IS_MVP_GAPS_GOLDEN_FLOWS_AND_AUDIT.md).

## Cel i własność

Run Agent projektuje i wykonuje wersjonowane procesy łączące moduły, wiedzę,
ludzi oraz systemy zewnętrzne. Orkiestruje, lecz owner modules zachowują prawdę
obiektów. Definition, Run i Output są osobnymi obiektami.

## Runtime AS-IS

`AgentPlanWorkspace/Panel/Canvas`, `agentWorkshopCatalog`, `PlanBuilder`,
`ProcessLibrary`, `agentPlannerService`, scheduler i `toolChainExecutor` tworzą
istniejący fundament. Aktywny executor jest liniowy; DAG executor istnieje, ale
nie jest główną ścieżką. Funkcja jest `partial`, nie pełny agent platform.

## Invariants

- run używa immutable version;
- tool/data access wynika z server-side policy;
- side effect jest idempotentny i objęty właściwą zgodą;
- approval wiąże exact payload;
- wait/restart/retry nie gubią stanu;
- final success wymaga owner read-back i business acceptance;
- każdy output AI zachowuje źródła i quality state;
- proces ma ownera, scope, limits, kill switch i audit.

## Bramka

Staging wymaga publish/test/version, project ACL, dokładnych approvals,
idempotent writes, per-step errors, trwałego resume i jednego pełnego procesu
Vault → analiza → Initiative/Decision/Task → Material → accepted outcome.
