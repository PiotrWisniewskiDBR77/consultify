# Deep Research / Reporting Requirements — Consultify

> **Status:** source research input, captured 2026-04-18. Do not edit in place.
> **Scope:** answers the Deep Search / Reporting deep research prompt (Prompt 3
> of the first research batch). Covers the full research-session lifecycle from
> decision brief → scope contract → retrieval → synthesis → validation →
> reusable artefact.
>
> **ID namespace:** `R-RESEARCH-*` (no collision with prior docs).
>
> Complements the Reasoning, Feedback/Learning, Agentic Chat Runtime, ROI
> Lifecycle, Artifact/Connectors/Onboarding, and Enterprise Integrations
> research documents dated 2026-04-18.
>
> **Next step:** this document will be turned into the canonical Deep Research
> implementation plan (tickets + flags + tests + CI invariants) in a follow-up
> pass.

---

## Executive stance and benchmark readout

Consultify should **not** treat deep research as "better search inside chat". It should treat it as a durable, **claim-governed workflow** that turns an ambiguous executive ask into:

1. a typed **decision brief**
2. a bounded **research plan**
3. a **task graph**
4. an **evidence graph**
5. a **reviewable draft**
6. a reusable **report artefact**

### What the benchmarks actually converge on

The strongest public benchmarks (OpenAI Deep Research, Perplexity Deep Research, Moonshot/Kimi, Elicit, Consensus, Claude Projects, Rovo, Glean, Gamma, Pitch, Notion, Otter) converge on the same core pattern: explicit source selection, pre-run planning, live progress, interruption/refinement, traceable citations, and downloadable outputs.

| Benchmark | What is strongest | What Consultify should copy |
| --- | --- | --- |
| **OpenAI Deep Research** | plan review, user-controlled sources, progress visibility, reuse/export (MD/Word/PDF), activity history | plan-approval gate, sources-used panel, reusable artefacts |
| **Perplexity Deep Research** | explicit step budgets, token budgets, transparent per-run cost accounting, structured outputs, model fallback | cost predictability before run, per-run budget ledger |
| **Moonshot AI / Kimi** | long-horizon search, swarm-style parallelism, up to ~300 tool calls | fan-out/fan-in for competitor matrices and multi-jurisdiction work |
| **Elicit** | systematic decomposition, clarifying questions, iterative sessions, evidence-grounded output | decision-first framing, clarifying-questions loop |
| **Consensus** | constrained, citation-first synthesis over a domain-specific corpus | hard citation binding as a blocking finalisation gate |
| **Anthropic / Claude** | project knowledge + automatic RAG, connectors, shareable artefacts (files) | project-knowledge analogue for Consultify workspaces |
| **Rovo / Glean** | permission inheritance, optional web expansion | enterprise ACL + source-policy UI |
| **Gamma / Pitch / Notion / Otter** | output packaging, collaboration, artefact reuse | exportable board packs, shareable reusable artefacts |

### Architectural gap diagnosis

The gap is not mainly "search quality". It is the **absence of three first-class primitives**:

1. a persisted `research_session`
2. a typed `research_report` artefact
3. a claim-level **provenance model**

The current single-request HTTP runtime, chat-stream output, and optional-rather-than-universal validator wiring are **fundamentally mismatched to CFO-grade or board-grade work**. Durable long-running execution is exactly the class of problem Temporal solves, and the operational ergonomics (re-run, cancel, inspect logs, download artefacts) closely resemble the workflow-run model in GitHub Actions.

### The differentiator for Consultify

Do **not** copy a consumer research product 1:1. The differentiator is **blended enterprise evidence** — client workspace data, uploaded attachments, public web, Consultify org memory — under strict ACL, freshness, and provenance rules. The right mental model is a **consulting operating system with a research engine at the core**, not a chat feature with better retrieval.

This is the only credible route to the stated non-negotiables:

- **quality over speed**
- **citations on every substantive claim**
- **Polish and English parity**
- **cost predictability before run start**
- **reusable artefacts instead of ephemeral messages**

---

## Decomposition pipeline

The decomposition pipeline converts "write me report X" into a typed execution contract **before any expensive retrieval begins**.

### 1. Decision Brief (not a prompt rewrite)

The first object in the pipeline is a **Decision Brief**, not a rephrased prompt. Mandatory fields:

| Field | Purpose |
| --- | --- |
| `decision_to_inform` | What will this report decide? |
| `intended_reader_role` | CFO / CEO / COO / CISO / Board / external client |
| `organisation` | Client tenant |
| `geography` | Region(s) / jurisdiction(s) |
| `time_horizon` | Decision window |
| `in_scope_questions` | Explicit list |
| `out_of_scope_exclusions` | Explicit list |
| `report_archetype` | short brief / memo / deep report / board pack |
| `required_deliverables` | file formats, appendices |
| `language` | pl, en, both |
| `budget_cap` | monetary + budget-unit cap |
| `deadline` | target datetime |
| `confidentiality_mode` | private / workspace / blended-with-web |
| `allowed_source_classes` | WS, ATT, ORG, WEB, GEN |
| `org_memory_external_use_allowed` | boolean |

For the "analyse ROI for entering Germany" example, the Decision Brief should normalise this into a decision object such as: *"Should we enter Germany in the next 12 months, and under what scenario assumptions?"* That shift from **question-first to decision-first** is a P0 requirement because it determines what evidence matters and what can be safely omitted.

### 2. Scope Contract

After the Decision Brief, generate a **Scope Contract** that explicitly states what is in range and what is not. This is where most consulting failures happen — market entry reports expand into full strategy documents; compliance reports drift from architecture evidence into generic regulation summaries; board memos become collections of observations instead of decision papers.

Scope Contract must contain:

- required sections
- forbidden detours
- source constraints
- maximum competitor count
- scenario count
- evidentiary exclusions

Hard rules:
- If the user says "private mode" → the contract **must disable web search completely**.
- If they say "use only our architecture docs plus GDPR text" → the contract **must enforce that**.

Source policy must be **user-visible and configurable**, not buried in a backend default.

### 3. Outline Generation with Evidence Budgets

Every report section is planned with an **evidence target before retrieval**. A section without an evidence budget almost always becomes either fluff or over-researched bloat.

Each section plan must include:

- `section_objective`
- `required_block_types` (narrative / table / chart / bullet / callout / decision_box / risk_register / appendix_table)
- `required_source_classes`
- `min_evidence_count`
- `max_retrieval_budget`
- `failure_condition`

Examples:
- Market-sizing section → 1 primary market/statistical source + 1 corroborating secondary source.
- GDPR clause-rating section → clause text + ≥1 internal architecture artefact for every rated item.
- Scenario table → every numeric driver binds to a sourced value or an explicitly tagged assumption.

### 4. Subquery Decomposition

Each section fans out into concrete research tasks with **success criteria**.

- **Bad task:** "research competitors".
- **Good task:** *"for competitor N, retrieve current positioning, pricing signal, public implementation evidence, geographic presence, and risk notes; stop when at least one authoritative source and one corroborating source are found or mark unresolved."*

Executable task graphs outperform a single monolithic browse-and-write loop for long-form research.

### 5. Evidence Map

Before synthesis, build an **Evidence Map** that specifies what evidence is acceptable per claim type:

| Claim type | Minimum evidence rule |
| --- | --- |
| **Client-internal fact** | Workspace or attachment source of truth; web cannot substitute |
| **External market fact** | Authoritative external source; corroboration required if source is secondary or news |
| **Quantitative estimate** | Deterministic formula + cited inputs + scenario assumptions |
| **Recommendation** | Links to underlying validated factual claims + explicit assumptions |
| **Compliance rating** | Citation to the controlling clause + architecture evidence + rationale |
| **Method / framework usage** | Org-memory or approved methodology source, clearly separated from client fact |

### 6. Gap Detection (first-class)

Missing evidence is **not a retrieval nuisance; it is a report-state signal**. If the planned report requires 10 competitor profiles and the system only validates 7, the gap must appear as an **open question**, not disappear into prose.

Every report must carry an **"Open Questions and Evidence Gaps"** appendix generated from the task graph, not from ad hoc LLM commentary.

### 7. Confirmation Gate

Before any expensive run starts, the user must **explicitly approve**:

- decision to inform
- audience
- scope + exclusions
- source policy
- language
- report depth
- budget cap
- due date
- sensitive/confidential handling
- critical missing inputs

Store an **immutable `plan_version`** so any later review can answer: *what exactly was approved before the session ran?*

---

## Multi-source retrieval strategy

Retrieval must be **policy-first, class-aware, and claim-aware**.

### Source-class policy

| Source class | When allowed | Default trust role | Freshness rule | ACL rule | Dedup / fallback |
| --- | --- | --- | --- | --- | --- |
| **Workspace** | Default on for enterprise; user may narrow to project/workspace | Primary for client facts, ops, finance, architecture | Latest visible version; stale warning if older than expected cadence | Inherit source ACL at retrieval and citation-render time | Dedup by document/version lineage; never silently fall back to web |
| **Attachments** | Always on when uploaded to session | Primary if labelled "source of truth", otherwise supplemental | As uploaded; show upload time + file version | Session participants only | Parser retry → manual extraction fallback |
| **Org memory** | On for internal methodology; optional for client-facing use | Primary for house views/frameworks; never primary for client facts unless approved | Latest approved version only; suppress superseded drafts | Team/client-conflict aware | Dedup by canonical doc ID; widen only if policy allows |
| **Web** | Off in private mode; otherwise full web / allowlist-only / prioritised domains | Primary for market, regulation, competitor, external benchmarks | 30-day default for volatile claims; 12-month for slow-moving context | Domain allow/block + jurisdiction policy | Near-duplicate cluster by canonical URL/domain; fallback to secondary provider or cached fetch with warning |
| **General model knowledge** | Always available for query expansion and drafting support | **Never a final evidence source** | N/A | N/A | No citations allowed; if unsupported, downgrade to hypothesis/opinion |

### Cross-class precedence by claim type

**This is non-negotiable — precedence depends on claim type, not a global trust order.**

| Claim type | Trust order |
| --- | --- |
| **Client state / architecture / KPI** | Workspace → Attachments → Org memory → Web → General |
| **Market / competitor / regulation** | Authoritative web / authenticated external data → Workspace notes → Org memory → General |
| **Consulting method / playbook** | Org memory → Approved external methodology → General |
| **Compliance judgement** | Regulation / standard text + internal evidence → Org memory summary → General |

### Conflict handling

When sources disagree, **never silently average, blend, or prose over the conflict**. Create a `conflict_set` at claim level with:

- competing values
- source timestamps
- source classes
- authority ranking
- resolution status

The report can either choose a winner (with rationale) or present a range. Silent merging is exactly the overreliance/misinformation path that OWASP warns about for high-stakes deployments.

### Four-stage retrieval pipeline

1. **Recall within class** using hybrid lexical + semantic retrieval.
2. **Normalise evidence units** into a common source registry with: source class, timestamp, authoritativeness, geography, licence.
3. **Cross-class rerank** using a **multilingual reranker** (Polish and English queries/documents treated symmetrically — Cohere rerank 100+ languages is a reference).
4. **Claim-level evidence packing** — documents become evidence snippets tied to anticipated claims, not just top-K chunks.

### User-facing source policy UI

At minimum **four modes**, plus optional domain allowlists:

- `private` (workspace + attachments + org memory only — web **disabled**)
- `workspace+attachments`
- `workspace+attachments+org`
- `blended_with_web`

### Cost predictability

Define budget in **budget units first**, then convert to live currency pricing at run start. User sees a plan-stage estimate like:

> *"Deep report: up to 30 web searches, 120 page fetches, 400 retrieved internal chunks, 2 synthesis passes, 1 validation pass; estimated £X–£Y at current rate card."*

### Default budget table (v1)

| Report class | Max search steps | Max fetched pages / URLs | Max validated evidence chunks | Notes |
| --- | --- | --- | --- | --- |
| **Short brief** | 8 | 30 | 120 | One synthesis pass |
| **Memo** | 15 | 60 | 220 | One rewrite pass |
| **Deep report** | 30 | 120 | 400 | Full validation pass |
| **Board pack** | 45 | 180 | 600 | Full validation + export pack |

---

## Synthesis and report generation contract

The report generator should **stop behaving like a fancy markdown formatter** and become a **deterministic renderer over a canonical research-report object**.

### Canonical `research_report` object

| Field | Purpose |
| --- | --- |
| `report_meta` | title, audience, locale, report type, created from session, due date, version |
| `decision_brief` | approved decision statement, scope, exclusions, constraints |
| `source_register` | every source with class, timestamp, authoritativeness, ACL visibility, licence |
| `claim_register` | every substantive claim with type, confidence, citations, status |
| `sections[]` | ordered sections with typed blocks |
| `assumptions[]` | explicit assumptions, owner, rationale, sensitivity |
| `scenarios[]` | base / upside / downside or equivalent |
| `open_questions[]` | unsatisfied evidence requirements and blockers |
| `appendices[]` | source notes, methodology, detailed tables |
| `exports[]` | generated artefacts and hashes |
| `integrity` | canonical hash, export hashes, validation results |

### Typed content blocks per section

Not undifferentiated markdown. Minimum block types:

- `narrative`
- `table`
- `chart`
- `bullet_list`
- `callout`
- `decision_box`
- `risk_register`
- `appendix_table`

**Each block must reference the claim IDs it depends on.** That is how citations bind deterministically and how what-if updates re-render only affected branches.

### Citation binding as blocking gate

> **Every substantive claim must either carry citation binding or be explicitly tagged as `estimate`, `hypothesis`, or `opinion`.**

The final renderer **refuses to publish** a sentence that contains numbers, dates, rankings, comparisons, attributed facts, legal interpretations, or implementation claims unless the block contains bound claim IDs.

`claimCitationValidator` must become a **blocking finalisation gate**, not a best-effort helper. URLs written by the model are treated as hallucinated unless they come from actual tool output.

### Quantitative integrity

Do not allow free-form generation of financial or operational numbers. Every number object carries:

- `value`
- `unit`
- `currency`
- `time_basis`
- `geography`
- `source_evidence_ids`
- `nature` ∈ `observed` / `transformed` / `modelled`

All formulae (ROI, scenario outputs, CAGR, benchmark normalisation, FX conversion, margin bridges) are executed by a **deterministic calculation layer** or code runner. The prose model may explain the result, but **may not invent the math**.

### Typed hedging policy

| Label | When allowed | Surface wording |
| --- | --- | --- |
| `fact` | direct or strongly corroborated evidence | plain declarative statement |
| `estimate` | deterministic model from sourced inputs | "estimate", "modelled", "scenario assumes" |
| `hypothesis` | plausible but not validated | "hypothesis", "requires validation" |
| `opinion` | advisory synthesis or house view | "recommendation", "judgement" |

Main body sections for CFO / CEO / COO / CISO use cases contain `fact` and `estimate` by default; `hypothesis` and `opinion` belong in explicitly marked recommendation blocks.

### Executive summary generated last

Built from the validated body, scenario tables, decision boxes, and open-question register — **never hallucinated ahead of evidence**.

### Language parity (not translation)

Do **not** implement "English research → translate to Polish". Language is a **first-class planning variable** across decomposition, retrieval, reranking, drafting, and formatting. Multilingual reranking, locale-specific templates, locale-specific number/date/currency rendering. Polish and English style packs are peers, not translations with post-edits.

### Formatting and export

**Markdown = authoring/rendering format. Structured report object = system of record.** From that object render:

- Markdown + HTML — in-product reading
- PDF + DOCX — board/counsel sharing
- PPTX — board packs and sales-style executive summaries
- XLSX — underlying scenario and benchmark tables

Artefacts must remain **claim-bound and auditable after export**.

### Page-length targets in the planner

| Output type | Target |
| --- | --- |
| Short brief | 2–3 pages |
| Memo | 5–10 pages |
| Deep report | 20–40 pages |
| Board pack | 40–60 pages |

---

## Research session as a first-class entity

If deep research can run for minutes, be interrupted, be reviewed, be resumed, and produce reusable artefacts, then `research_session` must become a **first-class database entity** — not a chat-thread side effect.

### Core `research_session` schema

| Group | Required fields |
| --- | --- |
| **Identity** | `session_id`, `tenant_id`, `workspace_id`, `created_by_user_id`, `owner_team_id` |
| **Request** | `title`, `decision_statement`, `report_type`, `locale`, `deadline`, `sponsor_role` |
| **Plan** | `plan_version`, `scope_contract`, `outline`, `budget_policy`, `source_policy`, `sensitive_mode` |
| **State** | `status`, `stage`, `progress_pct`, `eta_seconds`, `blocker_code`, `last_heartbeat_at` |
| **Costs** | `estimated_budget_units`, `estimated_cost_low`, `estimated_cost_high`, `actual_cost`, `spend_pct` |
| **Control** | `pause_requested`, `cancel_requested`, `resume_token`, `current_checkpoint_id` |
| **Outputs** | `draft_report_id`, `final_report_id`, `export_ids[]`, `review_state` |
| **Audit** | `created_at`, `started_at`, `paused_at`, `completed_at`, `archived_at`, `acl_snapshot_hash` |

### Required child entities

- `research_task`
- `evidence_item`
- `claim`
- `draft_section`
- `review_comment`
- `budget_event`
- `audit_event`
- `export_file`

Without these, pause/resume and what-if reruns are impossible or dangerously opaque.

### Canonical lifecycle

```
planned → awaiting_confirmation → approved → queued → running → blocked → paused → synthesizing → under_review → completed → archived
```

Plus terminal: `cancelled`, `failed`. User-facing labels can be simpler; the machine lifecycle is explicit.

### Progress reporting — stage-weighted, not token-based

| Stage | Weight |
| --- | --- |
| Decision + planning | 10% |
| Evidence retrieval | 45% |
| Evidence normalisation + claim building | 20% |
| Synthesis | 15% |
| Validation + export | 10% |

ETA = historical latency per task type + remaining budget units. Research dock shows: overall progress, current stage, active tasks, top blocker, spend to-date, whether the current draft is readable.

### Resumability — checkpoint-based and event-sourced

Persist a checkpoint after:

- plan approval
- each retrieval batch
- each completed section synthesis
- every validation pass
- every export stage

On restart, **replay from the last checkpoint** rather than rerun the entire job (Temporal replay model).

### Pause / resume

Paused session stores:
- checkpoint pointer
- in-flight task cancellation status
- reviewer/user note
- any source-policy modifications requested while paused

On resume, **revalidate source access and budget remaining** before continuing.

### Cancel + partial-draft delivery

If the user cancels at 40%, they still receive:
- the approved plan
- retrieved source register
- validated claims so far
- completed sections
- open questions

Better UX and better commercial behaviour than blank failure.

### Collaboration roles

At least three roles:
- `owner`
- `contributor`
- `reviewer`

Reviewers can comment at **section, table, or claim level** while the job is `under_review` or `paused`.

### Parallelism — task-level, not prose-level

Example: Germany market-entry report with 10 competitors → create **10 sibling subreports in parallel**, each with its own evidence pack and validation, then merge only after each competitor section has reached a minimum evidence threshold.

### Reusable artefact emission

A completed session emits a first-class `research_report` artefact into a **library**, with versioning and lineage back to session, plan version, and export set. Important outputs live beyond the conversation.

---

## Trust and auditability

For CFO, CISO, and board-facing use cases, **trust requires more than citations**. It requires:

- **provenance per claim**
- **visible freshness**
- **explicit review points**
- **export integrity**

### Per-claim provenance object

| Field | Purpose |
| --- | --- |
| `claim_id` | stable identifier |
| `section_id` | owning section |
| `claim_type` | fact / estimate / hypothesis / opinion |
| `confidence_score` | 0..1 |
| `source_ids[]` | bound evidence |
| `source_classes[]` | WS / ATT / ORG / WEB |
| `source_timestamps[]` | freshness chain |
| `retrieval_tasks[]` | how this evidence was obtained |
| `validation_status` | pass / fail / downgraded |
| `last_verified_at` | datetime |
| `changed_since_previous_version` | boolean |

Reviewable in UI, exportable in machine-readable form. Source badges `[WS]`, `[ATT]`, `[ORG]`, `[WEB]` appear in UI and optionally in appendices/export metadata.

### Mandatory review gate for high-stakes report types

Financial analysis, legal/compliance analysis, board packs, and external-client deliverables above a configurable risk threshold **cannot publish without review completion**. The draft gate surfaces the highest-risk claims first:

- single-source claims
- stale-source claims
- contradictory claims
- high-impact quantitative assumptions
- compliance judgements

### What-if analysis via dependency graph

Keep a dependency graph: **assumptions + evidence → claims → report blocks.** If the user says "assume Q3 data is stale" or "re-run with 12% instead of 8% discount rate", the system identifies the dependent sections and re-runs only those branches.

This is why the executive summary **must be derived from the body** — otherwise a local assumption change requires a full manual rewrite.

### Source freshness visibility

Every citation carries a date stamp. Every section calculates a **section freshness status** from its underlying citations. If a section relies on public market news from the last 30 days and internal KPI extracts from 90 days ago, that is obvious in the UI.

If a workspace file or attachment is older than the expected reporting cadence, the system **flags it as potentially stale before or during review**.

### Editable output with tracked override (overlay, not mutation)

If a user rewrites a sentence, the system records:
- original text
- edited text
- editor
- timestamp
- rationale
- whether the edit breaks citation binding

An edited PDF sent to a client must still be defensible later.

### Cryptographic export integrity

Generate a canonical **SHA-256 hash** for the report object and hashes for each export file. Store in audit log. Optionally embed a verification manifest into PDF/DOCX/PPTX metadata.

### Compliance disclaimers auto-attached

GDPR example: Article 5 (lawfulness, fairness, transparency, accuracy, integrity, confidentiality, accountability) and Article 32 (security measures appropriate to risk + regular testing). Any report rating GDPR compliance from architecture evidence carries:

- legal-review disclaimer
- source-freshness requirement
- explicit statement of whether the text is informational or reviewed by counsel

---

## Failure handling and recovery

Failure handling must be **explicit in both system behaviour and user experience**. The default bias is **graceful degradation, never silent degradation**. A failing session should usually produce a lower-confidence but still auditable draft, not vanish.

Exceptions: **citation hallucination** and **ACL leakage** → blocking is safer than partial completion.

| Situation | Detection | System handling | User UX | Telemetry |
| --- | --- | --- | --- | --- |
| **Web returns conflicting data** | Same claim key maps to incompatible values | Create `conflict_set`; prefer authoritative primary source if any, otherwise surface range | Yellow warning in section + "conflicting evidence" badge | Conflict count by source class/domain |
| **Workspace data outdated** | Modified timestamp older than expected cadence or contradicted by newer source | Mark stale; continue only if user allows; otherwise block relevant sections | "Potentially stale internal data" warning before final | Stale-source events by workspace/source |
| **Critical source unavailable** | Connector/auth/fetch failure on required source | Retry → fallback provider if allowed → degrade to partial draft with blocker | Blocker card naming missing source and impacted sections | Connector failure rates, degraded runs |
| **Model timeout mid-synthesis** | No heartbeat or worker timeout | Persist partial section drafts; resume from checkpoint | Draft remains readable; user sees "resume available" | Timeout cause, stage, recovery success |
| **User interrupts mid-run** | UI event / API call | Pause or cancel safely; preserve validated evidence and completed sections | Draft + plan + notes remain accessible | Interrupt reasons and resume rate |
| **Budget cap exceeded** | Spend reaches 80% / 100% threshold | Warn at 80%; at 100% stop new retrieval, finish validation and partial draft | "Budget exhausted — partial report produced" | Over-budget rate by report type |
| **Hallucinated citation** | Citation ID not in source registry OR evidence-text mismatch | **Block final release** or downgrade claim to hypothesis/opinion | Red validation error with affected sentence count | Citation-validation failure rate |
| **ACL violation / hidden doc** | Retrieval allowed at search time but access fails at render time | Remove evidence, re-score dependent claims, **block final** if section falls below evidence threshold | "A source became unavailable due to permissions" | ACL mismatch events |
| **Dedup collapse hides nuance** | Fingerprint merges near-duplicates with differing time/geography | Re-open evidence cluster and split by time/geography | Small warning in evidence panel | False dedup rate from reviewer corrections |
| **Cross-section contradiction** | Validator passes but sections still contradict | Open repair pass; if unresolved, mark sections conflicting and block final | "Cross-report inconsistency detected" | Contradiction classes and repair latency |

---

## Requirements register

| ID | Pri | Requirement | Acceptance test | Risk if absent |
| --- | --- | --- | --- | --- |
| **R-RESEARCH-1** | **P0** | Persist a typed `research_session` for every run | Kill server mid-run; session resumes from checkpoint with no duplicated final sections | Lost work, no resumability |
| **R-RESEARCH-2** | **P0** | Convert prompt into stored `decision_brief` before retrieval | 95% of golden prompts produce valid decision, audience, scope, output type | Wrong report for wrong decision |
| **R-RESEARCH-3** | **P0** | Require user confirmation of plan, source policy, scope, and budget before run | No run can start without approved `plan_version` | Unbounded cost, wrong sources |
| **R-RESEARCH-4** | **P0** | Generate outline with evidence budget per section | Each section in golden tests has explicit evidence target and failure condition | Fluff or under-supported sections |
| **R-RESEARCH-5** | **P0** | Decompose each section into executable research tasks | Golden prompts produce task graph with success criteria per task | Monolithic brittle runs |
| **R-RESEARCH-6** | **P0** | Classify evidence by workspace / attachment / org / web / general | 100% of citations render with valid source class (except `general`, which cannot render) | Source confusion, trust erosion |
| **R-RESEARCH-7** | **P0** | Enforce ACL at retrieval and render time | User lacking doc permission can never see doc text or derived claim | Data leak |
| **R-RESEARCH-8** | **P0** | Apply hybrid retrieval + rerank with multilingual support | Polish and English benchmark prompts hit equivalent target recall bands | Weak relevance, EN bias |
| **R-RESEARCH-9** | **P0** | Store every substantive claim as a first-class object | Random sample of 200 report sentences maps to claim objects with status | No claim audit trail |
| **R-RESEARCH-10** | **P0** | Block final output if substantive sentences lack citation or explicit label | Validator catches 100% intentionally uncited factual sentences in test corpus | CFO-grade trust failure |
| **R-RESEARCH-11** | **P0** | Use deterministic calculation layer for all quantitative outputs | 0 material mismatches on benchmark finance tables and scenario models | Numeric hallucinations |
| **R-RESEARCH-12** | **P0** | Run contradiction, citation, and table↔text consistency validation before final | Injected inconsistencies are detected in >95% of test cases | Internal contradictions |
| **R-RESEARCH-13** | **P0** | Surface and preserve unresolved gaps as `open_questions` | Missing-evidence scenarios always produce explicit open-question items | Hidden uncertainty |
| **R-RESEARCH-14** | **P0** | Show estimated cost/time range before run and enforce hard cap | User sees estimate pre-run; capped runs stop gracefully and emit partial draft | Cost surprise |
| **R-RESEARCH-15** | **P0** | Provide user-facing research dock with status, ETA, blockers, history | User can inspect in-progress and completed runs without opening chat thread | Poor UX, no operational control |
| **R-RESEARCH-16** | **P0** | Support pause, resume, cancel, and partial-draft preservation | User pauses mid-run, adds note, resumes successfully | Fragile operations |
| **R-RESEARCH-17** | **P0** | Create versioned `research_report` artefact separate from chat | Completed report appears in library with version + lineage | Output remains ephemeral |
| **R-RESEARCH-18** | **P0** | Generate executive summary last from validated body | Changing a section automatically refreshes summary on re-render | Summary/body drift |
| **R-RESEARCH-19** | **P0** | Expose per-claim provenance with timestamps and confidence | Reviewer can inspect any claim and see exact source chain | No auditability |
| **R-RESEARCH-20** | **P0** | Trigger review gate for high-stakes report types | Financial/legal/compliance reports cannot publish without review completion flag | Unsafe auto-finalisation |
| **R-RESEARCH-21** | **P1** | Support section/claim comments and reviewer roles | Reviewer can annotate any section without mutating artefact text | Weak collaboration |
| **R-RESEARCH-22** | **P1** | Keep dependency graph for what-if reruns | Changing one assumption re-runs only impacted sections | Expensive full reruns |
| **R-RESEARCH-23** | **P1** | Support parallel subreports with deterministic merge | 10-competitor benchmark run completes with independent subreport lineage | Poor scalability |
| **R-RESEARCH-24** | **P1** | Provide native Polish and English report packs | Same prompt in both languages passes human quality review | Language inequality |
| **R-RESEARCH-25** | **P1** | Render Markdown, PDF, DOCX, PPTX, and XLSX from one canonical object | Exports stay consistent with canonical report hash | Export drift |
| **R-RESEARCH-26** | **P1** | Attach source freshness warnings and stale-data banners | Old KPI / old web source test cases surface warnings in final artefact | Decisions from stale data |
| **R-RESEARCH-27** | **P1** | Auto-attach compliance disclaimers for regulated topics | GDPR-mode report includes disclaimer + review status + clause traceability | Legal risk |
| **R-RESEARCH-28** | **P2** | Add archetype templates for CFO/COO/CEO/CISO | New session can start from prebuilt outline archetype | Slow setup, inconsistent structure |
| **R-RESEARCH-29** | **P2** | Learn budget estimates from prior runs | Estimate error bands narrow over time versus actual spend | Weak predictability |
| **R-RESEARCH-30** | **P2** | Generate slide-pack and chart layouts from validated report data | PPTX export preserves source-linked tables/charts | Weak board-pack workflow |

---

## Requirements inventory (flat list)

| ID | Priority | One-liner |
| --- | --- | --- |
| R-RESEARCH-1 | P0 | Typed, persisted `research_session` per run |
| R-RESEARCH-2 | P0 | `decision_brief` stored before retrieval |
| R-RESEARCH-3 | P0 | Plan/scope/source/budget confirmation gate |
| R-RESEARCH-4 | P0 | Outline with per-section evidence budgets |
| R-RESEARCH-5 | P0 | Executable task graph per section |
| R-RESEARCH-6 | P0 | Evidence classified by WS / ATT / ORG / WEB / GEN |
| R-RESEARCH-7 | P0 | ACL enforced at retrieval + render time |
| R-RESEARCH-8 | P0 | Hybrid retrieval + multilingual rerank |
| R-RESEARCH-9 | P0 | Every substantive claim is a first-class object |
| R-RESEARCH-10 | P0 | Citation-binding validator is a blocking finalisation gate |
| R-RESEARCH-11 | P0 | Deterministic calculation layer for all quantitative outputs |
| R-RESEARCH-12 | P0 | Contradiction + citation + table↔text consistency validation |
| R-RESEARCH-13 | P0 | Unresolved gaps preserved as `open_questions` |
| R-RESEARCH-14 | P0 | Pre-run cost/time estimate + hard cap enforcement |
| R-RESEARCH-15 | P0 | Research dock: status / ETA / blockers / history |
| R-RESEARCH-16 | P0 | Pause / resume / cancel with partial-draft preservation |
| R-RESEARCH-17 | P0 | Versioned `research_report` artefact in library |
| R-RESEARCH-18 | P0 | Executive summary generated last from validated body |
| R-RESEARCH-19 | P0 | Per-claim provenance with timestamps + confidence |
| R-RESEARCH-20 | P0 | Review gate for high-stakes report types |
| R-RESEARCH-21 | P1 | Section/claim comments + reviewer roles |
| R-RESEARCH-22 | P1 | Dependency graph for what-if reruns |
| R-RESEARCH-23 | P1 | Parallel subreports with deterministic merge |
| R-RESEARCH-24 | P1 | Native Polish + English report packs (not translations) |
| R-RESEARCH-25 | P1 | Multi-format export (MD/PDF/DOCX/PPTX/XLSX) from canonical object |
| R-RESEARCH-26 | P1 | Source-freshness warnings + stale-data banners |
| R-RESEARCH-27 | P1 | Auto-attach compliance disclaimers for regulated topics |
| R-RESEARCH-28 | P2 | Persona archetype templates (CFO/COO/CEO/CISO) |
| R-RESEARCH-29 | P2 | Self-learning budget estimates |
| R-RESEARCH-30 | P2 | Slide-pack + chart layout generation for PPTX export |

**Totals:** 30 requirements — 20 × P0, 7 × P1, 3 × P2.

---

## 14-day MVP roadmap

**Honest target:** not "everything in this spec", but "credible, source-bound deep report with durable state, review gate, and reusable artefacts". Full board-pack polish, advanced what-if diffing, and rich reviewer workflows follow immediately after.

| Day | Deliverable | Exit criterion |
| --- | --- | --- |
| 1–2 | Introduce `research_session`, `research_task`, `research_report`, `claim`, `evidence_item` entities | Session can be created, queued, resumed, inspected |
| 3–4 | Build Decision Brief + Scope Contract + Confirmation Gate | User approves structured plan before run |
| 5–6 | Source policy layer + retrieval broker (WS / ATT / WEB / ORG / GEN) | Every retrieved source is classified and ACL-checked |
| 7–8 | Outline evidence budgets, task graph decomposition, open-question tracking | Golden prompts produce executable plans with explicit gaps |
| 9–10 | Unify `deepResearchService` + `reportGeneratorService` behind canonical report object | Structured report renders from stored claims/evidence |
| 11 | Make `claimCitationValidator` blocking; add contradiction + table/text checks | Final publish blocked on validation failures |
| 12 | Quantitative engine for calculations, scenarios, FX/unit normalisation | Finance/compliance benchmark prompts pass numeric checks |
| 13 | Research dock: progress, ETA, blockers, pause/resume/cancel, history | User manages long-running sessions in-product |
| 14 | PDF/DOCX/Markdown export, provenance panel, freshness banners, review gate | Deep report is reusable, auditable, exportable |

**Two-week MVP promise:** a 15-minute, evidence-bound deep report with durable sessions, typed claims, plan approval, claim-level citations, partial-draft recovery, validation gates, and exportable artefacts. Sufficient to credibly call it "McKinsey-lite". Not yet full end-state of board-pack-grade presentation polish or advanced scenario reruns — but the right primitives for those later layers.

---

## Cross-document linkage

- **Reasoning (`DEEP_RESEARCH_REASONING_REQUIREMENTS_2026-04-18.md`):**
  - Deep research is the heavy end of the `deep_research` workload class (R-REASON-1) — plan-depth `evidence_heavy` with full trust bundle (R-REASON-15).
  - Scope Contract + source policy (this doc §Decomposition) operationalise R-REASON-7 (scope resolver precedence).
  - `claim` objects (R-RESEARCH-9) are the concrete form of R-REASON-16 (trust bundle evidence + assumptions + counter-evidence + gaps).
  - Citation-binding validator (R-RESEARCH-10) is the finalisation-gate analogue of R-REASON-10 (self-check) for long-form output.
  - Open-questions register (R-RESEARCH-13) implements R-REASON-12 (`insufficient_evidence` path) at report level.

- **Feedback / Learning (`DEEP_RESEARCH_FEEDBACK_SELF_LEARNING_2026-04-18.md`):**
  - Reviewer comments (R-RESEARCH-21) feed the explicit-correction signal type (R-LEARN-2).
  - Per-claim provenance (R-RESEARCH-19) stamps `origin` on measurements that flow into conversation/user/org memory (R-LEARN-5).
  - Self-learning budget estimates (R-RESEARCH-29) is the deep-research instantiation of the platform-wide learning loop (R-LEARN-7..10).
  - Export hashes + canonical report hash must be preserved in SAR export (R-LEARN-6).

- **Agentic Chat / Runtime (`DEEP_RESEARCH_AGENTIC_CHAT_RUNTIME_2026-04-18.md`):**
  - `research_session` = the most important concrete instance of the long-running Run Ledger (R-AGENT-11).
  - Checkpoint-based resumability (this doc §Session) implements the checkpoint store (R-AGENT-12).
  - Pause/resume/cancel (R-RESEARCH-16) maps to user-interrupt handling in the runtime (R-AGENT-16).
  - Parallel subreports (R-RESEARCH-23) is fan-out/fan-in with deterministic merge (R-AGENT-14).
  - Budget cap (R-RESEARCH-14) is the `budget_policy` of the ScheduleDefinition/run parameters (R-AGENT-15).
  - Review gate for high-stakes (R-RESEARCH-20) = Approval-barrier sequence execution mode.

- **Enterprise Integrations (`DEEP_RESEARCH_ENTERPRISE_INTEGRATIONS_DETAILED_2026-04-18.md`):**
  - Source classes `WS` / `ATT` / `ORG` (this doc §Retrieval) resolve to connector trust modes (R-CONNECT-2).
  - ACL at retrieval + render time (R-RESEARCH-7) = the query-time enforcement contract (R-CONNECT-7).
  - Source freshness warnings (R-RESEARCH-26) read from connector freshness SLO surface (R-CONNECT-21).
  - Private mode (this doc §Source policy UI) must disable web sources and respect DLP policy (R-CONNECT-16).
  - Post-connect validation (R-CONNECT-14) is a prerequisite for using a connector as a research source.
  - Custom DMS connector SDK (R-CONNECT-23) extends the available source classes for research retrieval.

- **Artifact (`DEEP_RESEARCH_ARTIFACT_CONNECTORS_ROI_ONBOARDING_2026-04-18.md` §Artifact):**
  - `research_report` (R-RESEARCH-17) is a specialised Artifact type with versioning + lineage (R-ARTIFACT-1).
  - Typed content blocks per section (this doc §Synthesis) map to canonical content schemas (R-ARTIFACT-2).
  - Evidence refs inside artefacts (R-ARTIFACT-3) implement claim-level citation binding (R-RESEARCH-9/10).
  - Multi-format export (R-RESEARCH-25) uses the artefact export pipeline (R-ARTIFACT-6).

- **ROI (`DEEP_RESEARCH_ROI_LIFECYCLE_DETAILED_2026-04-18.md`):**
  - ROI-driven deep reports (board pack with initiative performance) must pull `KpiMeasurement` (R-OUTCOME-5) as primary evidence, never web.
  - Deep reports touching financial numbers (R-RESEARCH-11 quantitative integrity) must use the same formula library and provenance chain as the ROI calculation framework (R-OUTCOME-8/9).
  - Proof generation (R-OUTCOME-20/21) emits a `research_report` artefact with claim-level provenance by construction.
  - Review gate for financial reports (R-RESEARCH-20) uses ROI confidence bands (R-OUTCOME-6) to flag single-source or contested claims.

- **Onboarding (same file §Onboarding):**
  - First-run deep report is a primary aha-moment (R-ONBOARD-4).
  - Cost-predictability before run (R-RESEARCH-14) addresses the "I don't know what this will cost" onboarding fear.
  - Source policy UI (this doc §Retrieval) is the onboarding surface for trust-mode understanding (R-CONNECT-2).

---

## What this document is NOT

- Not a ticket backlog (next pass converts `R-RESEARCH-*` into tickets, flags, tests, CI invariants).
- Not a retrieval-engine implementation spec — retrieval stack choices (vector DB, rerank model vendor) are implementation decisions; contracts stay.
- Not a UX spec — research dock, source policy UI, and provenance panel wireframes live in dedicated UX docs.
- Not a replacement for existing dev plans (`TRUST_*`, `ADMIN_*`, `NAVIGATION_*`) — it is the substrate those plans assume for long-running, high-trust work.

## Next step

Turn this document into the canonical Deep Research implementation plan alongside Reasoning / Feedback / Agent Runtime / Artifact / ROI / Onboarding / Enterprise Integrations:

1. Assign each `R-RESEARCH-*` a ticket ID and block (likely a new `research` block in `ChatV9Block` union or a dedicated `ChatV10Block`).
2. Register feature flags per requirement:
   - `ff.research_session_persisted`
   - `ff.research_decision_brief`
   - `ff.research_confirmation_gate`
   - `ff.research_evidence_budget`
   - `ff.research_task_graph`
   - `ff.research_source_class_policy`
   - `ff.research_acl_enforcement`
   - `ff.research_hybrid_retrieval_multilingual`
   - `ff.research_claim_objects`
   - `ff.research_citation_validator_blocking`
   - `ff.research_quantitative_engine`
   - `ff.research_cross_validation_suite`
   - `ff.research_open_questions_register`
   - `ff.research_budget_preview_cap`
   - `ff.research_dock`
   - `ff.research_pause_resume_cancel`
   - `ff.research_report_artefact_library`
   - `ff.research_summary_last`
   - `ff.research_provenance_panel`
   - `ff.research_review_gate`
   - `ff.research_section_comments`
   - `ff.research_whatif_dependency_graph`
   - `ff.research_parallel_subreports`
   - `ff.research_pl_en_parity`
   - `ff.research_multi_format_export`
   - `ff.research_freshness_banners`
   - `ff.research_compliance_disclaimers`
   - `ff.research_persona_archetypes`
   - `ff.research_learned_budget_estimates`
   - `ff.research_slide_pack_generator`
3. Draft `DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md` with per-ticket acceptance + test strategy; split by sub-surface (Decomposition / Retrieval / Synthesis / Session / Trust / Export).
4. Extend `CHAT_V9_TELEMETRY_CONTRACT` with `research.*` event families:
   - `research.session_created`
   - `research.plan_approved`
   - `research.run_started`
   - `research.checkpoint_persisted`
   - `research.retrieval_batch_completed`
   - `research.evidence_classified`
   - `research.claim_created`
   - `research.claim_validated`
   - `research.conflict_detected`
   - `research.gap_recorded`
   - `research.budget_threshold_80`
   - `research.budget_threshold_100`
   - `research.paused`
   - `research.resumed`
   - `research.cancelled`
   - `research.review_gate_opened`
   - `research.review_gate_closed`
   - `research.report_published`
   - `research.export_generated`
   - `research.export_hash_verified`
   - `research.acl_violation_at_render`
   - `research.citation_validation_failed`
5. Add CI invariants in `chatV9FeatureFlags.test.ts`:
   - every `R-RESEARCH-*` → flag in registry,
   - every `research.*` event → section in telemetry contract,
   - every lifecycle state (`planned`, `awaiting_confirmation`, `approved`, `queued`, `running`, `blocked`, `paused`, `synthesizing`, `under_review`, `completed`, `archived`, `cancelled`, `failed`) is exhaustively handled in state-machine code,
   - every source class (`WS`, `ATT`, `ORG`, `WEB`, `GEN`) used in code matches the documented taxonomy,
   - every claim type (`fact`, `estimate`, `hypothesis`, `opinion`) used in code matches the documented hedging policy,
   - every block type (`narrative`, `table`, `chart`, `bullet_list`, `callout`, `decision_box`, `risk_register`, `appendix_table`) used in the renderer is bijective with the canonical block taxonomy,
   - every report class in the budget table (`short_brief`, `memo`, `deep_report`, `board_pack`) has an explicit budget entry,
   - exec summary is never generated before body finalisation (linter / runtime invariant).
