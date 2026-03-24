# AI Agent Security And Tool Governance v8

> Status: Draft v8
> Owner: Product + Engineering
> Cel: zdefiniowac jeden kanoniczny model `tool permissions`, `least privilege`, `approval gating` i `safe delegation` dla wszystkich agentowych consumerow.

---

## 1. Why this matters for Consultify

W enterprise AI nie wystarczy miec dobre odpowiedzi.
Trzeba miec pewnosc, ze AI:

- widzi tylko to, co powinno,
- moze uruchomic tylko to, co jest dozwolone,
- nie omija governance,
- i zostawia pelny slad operacyjny.

Bez tego multi-agent i execution zamieniaja sie w ryzyko systemowe.

---

## 2. Leader patterns

Imported patterns:

- `OpenAI` and agent systems: subagents should be scoped and specialized,
- `LangChain`: subagents work best with clear handoff contracts,
- `CrewAI`: task ownership and guardrails belong to the task,
- strong market products distinguish conversation intelligence from mutation privileges.

Key lesson:

`tool access` must be explicit, typed and risk-aware.

---

## 3. Current V8 coverage

Current strong inputs:

- `CHAT_V8_AI_GOVERNANCE.md`
- `CHAT_V8_ACTIONS_AND_APPROVALS.md`
- `AGENT_EXECUTION_V8_SSOT.md`
- `AGENT_MULTI_AGENT_WORK_MANAGEMENT_V8.md`
- `KNOWLEDGE_RAG_V8_SSOT.md`

Current gap:

- brak jednego normatywnego modelu `allowed_tools`, `risk classes`, `consumer classes`, `delegation restrictions` i `apply rights`.

---

## 4. Canonical target architecture

Canonical permission chain:

`identity -> effective role -> AI consumer class -> allowed scopes -> allowed tools -> approval gates -> execution audit`

Required control objects:

- `AIToolCapability`
- `ConsumerToolPolicy`
- `RiskClassPolicy`
- `DelegationGuard`
- `ApprovalRequirement`
- `ExecutionAuditEntry`

Canonical rule:

`no agent or worker may gain broader rights than the initiating user, active policy and consumer class jointly allow`

## 4.1 Leader-grade hardening requirements

To reach mature agent-safety standards, this architecture must also define:

- a canonical tool risk taxonomy separating `read`, `bounded write`, `workflow mutation`, `external side effect` and `sensitive data access`,
- tool output handling rules so sensitive tool results do not automatically become reusable prompt context,
- egress policy and sandbox expectations for networked or file-capable tools,
- prompt-injection and tool-injection defenses at tool invocation boundaries,
- explicit delegation policy for whether subagents inherit user tokens, scoped temporary grants or no direct credentials,
- denial and escalation traces that support can inspect.

Minimum tool policy fields should include:

- `tool_id`
- `consumer_class`
- `risk_class`
- `allowed_scope_types[]`
- `requires_human_approval`
- `requires_policy_gate`
- `supports_subagent_use`
- `egress_policy`
- `result_sensitivity_class`
- `audit_trace_level`

---

## 5. Contracts and boundaries

`ROLES_MODEL.md` and governance docs own:

- human role vocabulary and platform role resolution.

This document owns:

- AI-specific tool permission semantics,
- delegation limits,
- mutation risk classes,
- tool governance shared across chat, execution and subagents.

`Chat`, `Execution`, `Multi-Agent` must inherit this model rather than redefine it locally.

---

## 6. Risks and failure modes

Main risks:

- read-only agent ends up with write capabilities,
- subagent can directly mutate production artifacts,
- sensitive tools are callable without higher approval,
- tool permissions vary by module instead of by policy,
- support cannot explain why a tool call was allowed.

---

## 7. Implementation implications

The platform should add:

- one canonical tool catalog with risk classes,
- one allowlist model per AI consumer class,
- one delegation contract for subagents and workers,
- one policy path for when approval is required before tool execution,
- one support-visible permission trace for denied and allowed tool actions.

---

## 8. Acceptance criteria

- Every tool exposed to AI has a declared risk class and consumer policy.
- Effective rights never exceed user role, scope policy and consumer policy.
- Subagents cannot directly perform artifact mutations unless explicitly allowed by the shared policy model.
- Support can reconstruct why a tool call was allowed, blocked or escalated.
- Chat, execution and multi-agent flows share the same tool governance vocabulary.

---

## 9. Related canonical docs

- `docs/product/CHAT_V8_AI_GOVERNANCE.md`
- `docs/product/CHAT_V8_ACTIONS_AND_APPROVALS.md`
- `docs/product/AGENT_EXECUTION_V8_SSOT.md`
- `docs/product/AGENT_MULTI_AGENT_WORK_MANAGEMENT_V8.md`
- `docs/product/KNOWLEDGE_RAG_V8_SSOT.md`
- `docs/product/AI_LEADER_PARITY_ARCHITECTURE_V8.md`
