# AI Workspace Project Runtime Architecture v8

> Status: Draft v8
> Owner: Product + Engineering
> Cel: zdefiniowac jeden kanoniczny runtime dla `workspace`, `project`, `conversation`, `execution run` i `artifact context`.

---

## 1. Why this matters for Consultify

Liderzy wygrywaja nie tylko jakooscia modelu, ale tym, ze user czuje jeden spojny kontekst pracy.

W `consultify` to jest krytyczne, bo system ma laczyc:

- rozmowe,
- prace na artefaktach,
- governance projektu,
- organizacyjny kontekst biznesowy,
- agentowe wykonanie pracy.

Bez jednego runtime context user bedzie poruszal sie miedzy powierzchniami, ktore "wiedza co innego".

---

## 2. Leader patterns

Imported patterns from leaders:

- `Claude`: project and file-heavy work needs stable project semantics,
- `ChatGPT`: fast entry must still feel simple,
- `OpenAI/LangChain/CrewAI`: workflow runtime must have explicit run objects, not hidden session logic.

Key lesson:

`chat context`, `project context` i `execution context` nie moga byc trzema osobnymi wszechswiatami.

---

## 3. Current V8 coverage

Strong inputs already exist in:

- `CHAT_V8_SSOT.md`
- `CHAT_V8_MODES_AND_SCOPE_MODEL.md`
- `CHAT_V8_RUNTIME_TRUTH_MAP.md`
- `AGENT_EXECUTION_V8_SSOT.md`
- `AGENT_AND_KNOWLEDGE_V8_MASTER_PLAN.md`

Current strength:

- chat zna `workspace context`,
- execution run jest rozumiany jako osobny runtime,
- RAG zna scope i ownership.

Current gap:

- brak jednego dokumentu, ktory normatywnie spina `Workspace`, `Project`, `Conversation`, `ExecutionAgentRun` i `Artifact`.

---

## 4. Canonical target architecture

Canonical runtime chain:

`workspace shell -> project context -> conversation context -> execution run context -> artifact working context`

Required runtime objects:

- `WorkspaceContext`
- `ProjectContext`
- `ConversationContext`
- `ExecutionRunContext`
- `ArtifactWorkingContext`
- `ScopeResolutionSnapshot`

Rules:

1. `WorkspaceContext` defines where the user currently works.
2. `ProjectContext` adds business, governance and visibility boundaries.
3. `ConversationContext` is the user-visible interactive thread, but not the source of durable execution state.
4. `ExecutionRunContext` is the canonical state for planning, progress and audit.
5. `ArtifactWorkingContext` holds target objects, active previews and working references.

## 4.1 Leader-grade hardening requirements

To reach leader-grade quality, this architecture must additionally define:

- one versioned `ContextSnapshot` object reused by chat, execution, retrieval and support tooling,
- explicit rules for multi-tab and multi-surface drift when workspace state changes during a run,
- explicit behavior when conversation context and project context disagree,
- explicit artifact-target resolution when one run touches more than one artifact family,
- support-visible trace fields showing `workspace`, `project`, `conversation`, `run` and `artifact` identities together.

Minimum snapshot fields should include:

- `workspace_id`
- `project_id?`
- `conversation_id?`
- `execution_run_id?`
- `artifact_refs[]`
- `effective_scope_ref`
- `resolved_role_ref`
- `snapshot_version`
- `captured_at`

---

## 5. Contracts and boundaries

`Chat v8` owns:

- entry UX,
- conversational continuity,
- message-level context controls.

`Execution Agent v8` owns:

- run creation,
- plan state,
- action proposals,
- execution progress.

`Knowledge RAG v8` owns:

- scope filtering,
- source access boundaries,
- retrieval inputs into the active context.

This document owns:

- the runtime handshake between all of them.

---

## 6. Risks and failure modes

Main failure modes:

- chat shows one project but execution mutates another context,
- retrieved knowledge is scoped differently than visible workspace state,
- artifact previews are detached from the run that produced them,
- support cannot reconstruct which context was active when a proposal was generated.

---

## 7. Implementation implications

The platform should converge on:

- one runtime identity chain per AI interaction,
- one `context snapshot` attached to conversations and runs,
- one `active project/workspace resolver` reused by chat, execution and retrieval,
- one support-visible context trace.

---

## 8. Acceptance criteria

- Every AI run can be traced to one workspace and one effective project scope.
- Conversation, run and artifact references can be reconciled without guesswork.
- Retrieval scope and execution scope use the same resolved context snapshot.
- Support can inspect which workspace/project/artifact state was active for a run.

---

## 9. Related canonical docs

- `docs/product/CHAT_V8_SSOT.md`
- `docs/product/CHAT_V8_MODES_AND_SCOPE_MODEL.md`
- `docs/product/CHAT_V8_RUNTIME_TRUTH_MAP.md`
- `docs/product/AGENT_EXECUTION_V8_SSOT.md`
- `docs/product/AGENT_AND_KNOWLEDGE_V8_MASTER_PLAN.md`
- `docs/product/AI_LEADER_PARITY_ARCHITECTURE_V8.md`
