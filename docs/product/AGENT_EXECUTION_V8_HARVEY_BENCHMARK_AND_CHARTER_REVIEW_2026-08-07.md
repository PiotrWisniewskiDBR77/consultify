# Agent Execution v8 — Harvey Benchmark and Charter Review

> Status: `PRODUCT REVIEW INPUT`
> Date: 2026-08-07
> Compared product: Harvey, current public product as of 2026-08-07
> Reviewed charter: `AGENT_EXECUTION_V8_PRODUCT_CHARTER_DOD_AND_EPICS.md`
> Source policy: official Harvey product pages and Help Center; marketing claims are not treated as runtime proof

## 1. Executive verdict

The Consultify Agent charter has the correct strategic direction and is broader than Harvey in one important respect: it defines a governed executor that can mutate and coordinate native business artifacts across the full consulting operating system, while Harvey's publicly documented agent experience is still primarily centered on research, review, drafting, structured extraction and delivery of professional work product.

However, Harvey exposes several product capabilities more concretely than the current Consultify charter. The charter should be strengthened in eight areas:

1. guided intake as a first-class runtime, not only clarification in chat;
2. reusable agents as governed organizational products with draft, test, approval, publication and version lifecycle;
3. embedded golden examples, templates, playbooks and default context;
4. item-level review, assignment, comments, flags, verification and activity history;
5. preservation of verified or manually edited results during reruns;
6. explicit dependency invalidation when upstream results change;
7. client/partner shared workspaces with two-sided approval and resource-level permissions;
8. expert-quality evaluations defined per task family, not only generic platform evaluation.

Conclusion: we described the Agent's mission well, but not yet the complete professional work-management experience required to reach Harvey-level usability and governance.

## 2. What “agent” means in Harvey

Harvey explicitly separates the agent from the workflow outcome:

- an agent performs reasoning or work;
- a workflow combines one or more agents and human interactions to produce a specific professional work product;
- the workflow, not the invisible agent, is the user-facing unit of repeatable value.

This is a useful correction for Consultify. Our canonical user-facing unit should be the governed **process/run delivering a consulting outcome**, while specialist agents remain implementation roles inside it.

Official basis: [Introducing Agents in Harvey](https://www.harvey.ai/blog/introducing-harvey-agents).

## 3. Confirmed Harvey capability map

### H-01 — Guided, proactive task intake

Workflow Agents gather required files, text and choices, guide the user through predefined processes and show incremental progress. Users do not need to invent a complete prompt.

Implication for Consultify:

- `clarify` must be a typed intake stage;
- each process template needs an input contract;
- required, optional and default inputs must be visible;
- missing inputs must block or branch the run predictably.

Source: [Workflow Agents Overview](https://help.harvey.ai/articles/assistant-workflows).

### H-02 — Goal-directed analysis with iterative search

Harvey Assistant supports multi-step deep analysis and iteratively refines searches over selected sources until it has sufficient context. It combines uploads, Vault, DMS, premium sources, curated public sources and web search, with citations.

Implication for Consultify:

- retrieval cannot be a single static query;
- the run must record search iterations, sufficiency decisions and source scope;
- the Agent should know when evidence is insufficient and ask or stop.

Source: [Harvey Assistant](https://www.harvey.ai/platform/assistant).

### H-03 — Large-scale structured document review

Vault supports high-volume document organization, extraction into review tables, cross-document analysis and synthesis. Review tables can contain conditional columns that build on earlier extracted results.

Implication for Consultify:

- Agent needs a batch-work primitive, not only artifact-by-artifact tools;
- extraction, classification and synthesis should be addressable as structured steps;
- dependency lineage between derived fields must be explicit.

Sources: [Harvey Vault](https://www.harvey.ai/platform/vault), [Using Review Tables](https://help.harvey.ai/articles/using-review-tables), [Conditional Columns](https://help.harvey.ai/articles/conditional-columns).

### H-04 — Professional work-product creation and editing

Harvey can create documents, presentations and spreadsheets, export them in approved formats and edit draft documents inside the product. Workflow outputs can be revised and followed up.

Implication for Consultify:

- output generation must end in editable native artifacts;
- template and format compliance is part of DoD;
- follow-up must preserve lineage to the original run and artifact version.

Sources: [Harvey Assistant](https://www.harvey.ai/platform/assistant), [Workflow Agents Overview](https://help.harvey.ai/articles/assistant-workflows).

### H-05 — Natural-language Agent Builder

Harvey's Agent Builder supports:

- user-input steps;
- AI-action steps;
- conditional logic;
- response/output steps;
- prompt chaining with references to earlier outputs;
- optional inputs with embedded default context;
- step reordering, duplication and deletion;
- conversational workflow creation and refinement.

Implication for Consultify:

- our process workshop cannot remain only a reorderable list of tool blocks;
- the block model needs typed inputs, outputs, branching, references, validation and default context;
- a process should be buildable and refinable through Teresa as well as manually.

Source: [Getting Started with Agent Builder](https://help.harvey.ai/articles/workflow-builder).

### H-06 — Reusable organizational expertise

Harvey supports a library of ready-to-use agents and custom agents grounded in templates, golden examples, knowledge sources and firm-specific instructions. Agents can be shared across teams and matters.

Implication for Consultify:

- a template is more than a list of steps;
- it must package method, examples, input contract, output contract, knowledge policy, quality rules and permitted tools;
- recommendation and discovery should surface the right process for the active context.

Sources: [Harvey Workflow Agents](https://www.harvey.ai/platform/workflow-agents), [Agent Builder announcement](https://www.harvey.ai/blog/introducing-agent-builder), [Library](https://help.harvey.ai/articles/library).

### H-07 — Governed agent lifecycle

Harvey distinguishes Builder, Builder Admin and User. Agents move through draft, collaboration, submission, review, approval, publication, access assignment and execution. Editing a published agent requires re-approval and republishing.

Implication for Consultify:

- `EPIC-A12` must define a complete agent-definition lifecycle;
- published definitions must be immutable by version;
- every run must bind the exact published version;
- changing steps, prompts, tools or embedded context must invalidate publication approval.

Source: [Manage Permissions and Sharing in Agent Builder](https://help.harvey.ai/articles/manage-workflow-permissions-and-sharing).

### H-08 — Fine-grained human review operations

Harvey Review Tables support:

- inline editing;
- rerunning an individual result;
- verifying individual cells or rows;
- assigning rows to reviewers;
- flags;
- comments;
- filters for review state;
- activity history showing actor and action.

Implication for Consultify:

- approval cannot be the only human-in-the-loop mechanism;
- the product needs a separate verification/review layer below formal approval;
- large Agent outputs need item-level ownership and review state.

Source: [Edit, Verify and Track Review Table Cells](https://help.harvey.ai/articles/how-to-edit-verify-and-track-changes-in-vault-cells).

### H-09 — Preserve verified work and expose stale dependencies

Harvey can preserve verified cells during reruns. It also warns that dependent conditional columns may become outdated when an upstream column changes, though its documentation acknowledges limitations for cell-level refreshes.

Implication for Consultify:

- rerun semantics must not overwrite verified or manually edited output by default;
- every derived item needs dependency/version metadata;
- stale downstream results must be automatically marked and blocked from final acceptance;
- Consultify should exceed Harvey by handling item-level invalidation consistently.

Sources: [Preserve Verified Cells on Re-Runs](https://help.harvey.ai/release-notes/preserve-verified-cells-on-re-run), [Conditional Columns](https://help.harvey.ai/articles/conditional-columns).

### H-10 — Transparent progress, steps, reasoning and citations

Users can inspect completed workflow steps, follow progress, review citations and—in Review Tables—inspect reasoning and sentence-level citations.

Implication for Consultify:

- progress must expose meaningful business stages, not raw tool names;
- every result should show sources at the smallest useful level;
- internal chain-of-thought is not required, but method, evidence and decision rationale must be inspectable.

Sources: [Workflow Agents Overview](https://help.harvey.ai/articles/assistant-workflows), [Review Table Cell Improvements](https://help.harvey.ai/release-notes/review-cells-improvements).

### H-11 — Shared client/partner workspaces

Shared Spaces allow internal and external teams to work on shared Vaults, artifacts and workflows. Sharing uses resource-level permissions, guest accounts, two-sided organizational approval, ethical-wall enforcement and audit trails.

Implication for Consultify:

- project membership alone is not enough for external Agent collaboration;
- runs, templates, knowledge and outputs require independent sharing policies;
- external collaboration needs preview-as-collaborator, mutual approval, revocation and workspace-sovereignty rules.

Sources: [Harvey Shared Spaces](https://www.harvey.ai/platform/shared-spaces), [Shared Spaces Overview](https://help.harvey.ai/articles/shared-spaces).

### H-12 — Embedded work environment

Harvey provides Word and Outlook add-ins and connects to DMS and knowledge sources, letting users draft, edit and run playbooks where work already happens.

Implication for Consultify:

- Agent context entry should not depend solely on opening the Agent module;
- module and integration surfaces should hand off the current artifact and selection into one canonical run;
- external add-ins/connectors remain channels, not competing run truths.

Source: [Harvey Ecosystem](https://www.harvey.ai/platform/ecosystem).

### H-13 — Task-specific expert evaluation

Harvey describes custom evaluations comparing workflow outcomes with human lawyers for structured drafting, unstructured analysis and structured extraction.

Implication for Consultify:

- generic correctness metrics are insufficient;
- every production process family needs an expert reference set and task-specific rubric;
- evaluation should compare the work product, not require one exact reasoning path.

Source: [Introducing Agents in Harvey](https://www.harvey.ai/blog/introducing-harvey-agents).

### H-14 — Background and longer-horizon direction

Harvey publicly describes scheduling, background execution, parallelization, human checkpoints and longer-horizon agents as an evolving capability. Because some elements are described as future-facing, they must not be treated as fully proven current runtime behavior.

Implication for Consultify:

- our background and multi-agent epics remain strategically correct;
- acceptance must rely on Consultify runtime proof, not parity claims.

Source: [Introducing Agent Builder](https://www.harvey.ai/blog/introducing-agent-builder).

## 4. Coverage matrix against the Consultify charter

| Harvey capability | Consultify charter coverage | Verdict | Required action |
|---|---|---|---|
| Guided required-input intake | Mentioned under clarify/planning | Partial | Add typed intake contract and intake DoD |
| Iterative agentic search | Knowledge/evidence broadly covered | Partial | Add sufficiency loop and search ledger |
| Batch structured review | Not explicit as platform primitive | Gap | Add batch review epic/capability |
| Native document/deck/sheet output | Covered by artifact-native and U02 | Strong | Add template/format fidelity AC |
| No-code/natural-language builder | Workshop and templates covered | Partial | Expand A03/A12 block semantics |
| Embedded defaults and golden examples | Examples only implicit | Gap | Add template package contract |
| Agent definition publication lifecycle | A12 broad | Partial | Specify draft-test-approve-publish-version-deprecate |
| Item-level edit/rerun/verify/assign/comment | Not explicit | Gap | Add professional review workbench |
| Preserve verified work on rerun | Not explicit | Gap | Add rerun preservation invariant |
| Dependency staleness propagation | Dependencies exist at step level | Partial | Add item/artifact invalidation semantics |
| Transparent progress and citations | Covered | Strong | Require business-stage and item-level provenance |
| Shared external workspaces | Collaboration actor present, runtime absent | Gap | Add shared-space epic or expand A01/A09 |
| Office/DMS embedded surfaces | Context entry broadly covered | Partial | Add channel continuity acceptance |
| Task-specific expert evals | Generic eval DoD exists | Partial | Define eval pack per task epic |
| Background and long-horizon execution | Explicit A07/U06 | Strong | Keep evidence-first acceptance |
| Multi-agent synthesis | Explicit A08 | Stronger than currently documented Harvey UX | Preserve bounded centralized model |
| Cross-module canonical mutations | Central Consultify promise | Differentiator | Keep as primary advantage over Harvey |

## 5. Required charter amendments

### Amendment C-01 — Add an Intake Contract

Each process definition must declare:

- required and optional user inputs;
- accepted artifact/file/entity types;
- default embedded context;
- validation and maximum limits;
- confidentiality and sharing scope;
- questions Agent may infer versus must ask;
- readiness rule for planning/execution.

### Amendment C-02 — Add Agent Definition lifecycle to DoD

Required states:

`draft -> testing -> pending_approval -> published -> superseded or deprecated`

Every definition version must bind:

- owner;
- method and description;
- input/output contracts;
- steps and conditional logic;
- prompts/instructions;
- tools and permissions;
- knowledge scopes;
- embedded files, templates and golden examples;
- evaluation pack;
- approval and publication record.

### Amendment C-03 — Add Professional Review Workbench

Large or structured outputs must support item-level:

- edit;
- regenerate;
- verify/unverify;
- assign reviewer;
- flag;
- comment;
- filter;
- activity history;
- source and reasoning-method inspection.

Verification is not approval. Approval is not execution.

### Amendment C-04 — Add Verified Work Preservation

Reruns must:

- preserve verified and manually edited items by default;
- show which items will be regenerated;
- require explicit override to replace protected work;
- retain prior versions and reviewer attribution;
- mark affected downstream outputs stale.

### Amendment C-05 — Add Dependency Invalidation

When an input, source, upstream extraction, plan or approved payload changes:

- dependent results must be marked stale;
- affected approvals must be revalidated or invalidated;
- final outputs cannot claim verified status while dependencies are stale;
- the user must see the smallest safe rerun scope.

### Amendment C-06 — Add Shared Consulting Spaces

Define a governed collaboration container for consultant, client and external partner work with:

- organization-owned and mutually shared resources;
- space- and resource-level permissions;
- guest access;
- two-sided approval for cross-organization sharing;
- view-as-collaborator preview;
- ethical/conflict walls;
- immediate revocation;
- complete access, query, run, share and approval audit.

### Amendment C-07 — Add Task-family Evaluation Packs

Each `EPIC-Uxx` must have:

- representative expert-authored cases;
- required and forbidden outcome criteria;
- correctness, completeness, evidence and usefulness rubric;
- deterministic validators where applicable;
- adversarial cases;
- human baseline and acceptance threshold;
- regression policy for model/prompt/template changes.

### Amendment C-08 — Add Batch Work as a first-class primitive

Agent must support:

- one operation across many source artifacts;
- structured rows/fields as reviewable outputs;
- conditional derived fields;
- assignment and progress partitioning;
- incremental reruns;
- synthesis of verified structured results into downstream artifacts.

## 6. Recommended changes to epic map

Do not replace the existing 12 platform epics. Extend them as follows:

- expand `A03` with typed Intake Contract and richer builder semantics;
- expand `A04` with iterative search/sufficiency ledger;
- expand `A10` with item-level verification and task-family eval packs;
- expand `A12` with definition lifecycle, embedded context and publication governance;
- add `A13 — Professional Review and Batch Workbench`;
- add `A14 — Shared Consulting Spaces and External Collaboration`.

Recommended new task epic:

### EPIC-U07 — High-volume evidence review to verified advisory output

**Outcome:** A team reviews hundreds or thousands of source artifacts, extracts structured findings, assigns and verifies exceptions, then generates a source-backed report, decision pack or action plan without losing item-level lineage.

This task epic is necessary because none of U01-U06 fully proves high-volume structured review, distributed human verification and protected reruns.

## 7. Where Consultify should deliberately differ from Harvey

Consultify should not copy Harvey's legal information architecture literally. Its differentiators should be:

1. native execution across tasks, decisions, initiatives, risks, KPIs and consulting artifacts;
2. explicit workflow-gate semantics tied to organizational accountability;
3. measurable follow-through from recommendation to execution and result;
4. one cross-module run ledger rather than primarily file/thread-oriented work;
5. automatic stale-dependency propagation beyond the documented Harvey cell-level limitation;
6. business-outcome evaluation, not only quality of generated work product.

## 8. Final assessment

### What we described correctly

- Agent as a governed outcome executor, not a persona;
- plan/propose/approve/apply/audit lifecycle;
- artifact-native output;
- cross-module execution;
- durable background and resumable work;
- bounded multi-agent orchestration;
- human ownership of material decisions;
- trust, source lineage and real-runtime evidence.

### What was under-described

- the guided user journey before execution;
- the lifecycle of an agent/process definition itself;
- the operational review work between generation and formal approval;
- batch review and distributed verification;
- protection of verified human work during regeneration;
- dependency freshness;
- external client collaboration;
- expert evaluation at the level of a specific professional task.

### Product decision

The existing charter should remain the foundation, but it should not be marked `ACCEPTED` until amendments C-01 through C-08 and epics A13, A14 and U07 are reviewed and incorporated.

## 9. Official sources

- [Harvey Assistant](https://www.harvey.ai/platform/assistant)
- [Harvey Vault](https://www.harvey.ai/platform/vault)
- [Harvey Workflow Agents](https://www.harvey.ai/platform/workflow-agents)
- [Introducing Agents in Harvey](https://www.harvey.ai/blog/introducing-harvey-agents)
- [Introducing Agent Builder](https://www.harvey.ai/blog/introducing-agent-builder)
- [Workflow Agents Overview](https://help.harvey.ai/articles/assistant-workflows)
- [Getting Started with Agent Builder](https://help.harvey.ai/articles/workflow-builder)
- [Manage Permissions and Sharing in Agent Builder](https://help.harvey.ai/articles/manage-workflow-permissions-and-sharing)
- [Using Review Tables](https://help.harvey.ai/articles/using-review-tables)
- [Edit, Verify and Track Review Table Cells](https://help.harvey.ai/articles/how-to-edit-verify-and-track-changes-in-vault-cells)
- [Conditional Columns](https://help.harvey.ai/articles/conditional-columns)
- [Harvey Shared Spaces](https://www.harvey.ai/platform/shared-spaces)
- [Harvey Ecosystem](https://www.harvey.ai/platform/ecosystem)
