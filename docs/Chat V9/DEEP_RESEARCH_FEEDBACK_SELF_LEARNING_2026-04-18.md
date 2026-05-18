# Feedback and Self-Learning System Requirements — Consultify

> **Status:** source research input, captured 2026-04-18. Do not edit in place.
> **Scope:** answers the Feedback / Self-Learning / Memory deep research prompt
> (Prompt 4 of the first research batch). Complements the Reasoning (router +
> trust bundle) and Artifact/Connectors/ROI/Onboarding research documents dated
> 2026-04-18.
> **Next step:** this document will be turned into a numbered implementation plan
> (tickets + flags + tests + CI invariants) in a follow-up pass.

---

## Executive framing

Consultify should treat "self-learning" as a governed product subsystem, not as autonomous prompt drift. The design pattern that emerges across today's leading systems is consistent: scoped memory, explicit user controls, prompt/version management, evaluation before rollout, and legible provenance when prior context affects behaviour. OpenAI exposes deletable memory, Temporary Chat, project-scoped memory, custom instructions, and evaluation flywheels; Anthropic separates project instructions from cross-chat memory and gives enterprise owners control over capabilities and retention; Google shows when saved info was used; Notion cites sources and honours existing permissions; GitHub turns accept/reject and thumbs feedback into product signals; and Moonshot AI exposes memory as an explicit tool rather than a hidden black box.

For Consultify, the correct target state is a **two-loop architecture**. The first loop is **per-tenant learning**: user, organisation, and learned memory objects with provenance, expiry, edit/delete controls, and clear disclosure. The second loop is **platform-wide learning**: anonymised pattern mining, eval-gated prompt and routing improvements, staged rollout, and rollback. Your current runtime already has many building blocks; what is missing is the contract that governs what can be learned, who can see it, when it is applied, and how it is reversed. That contract must enforce your non-negotiables: zero cross-tenant leakage, user deletion rights, no silent behaviour change, sticky guardrails, and content visibility only on a least-privilege, incident-scoped basis.

---

## Feedback signal taxonomy

The right feedback system is not a single thumbs control. It is a ranked evidence model. Explicit negative feedback with a reason is the most actionable signal for product correction. User edits and overrides are even stronger because they provide target behaviour. Pairwise comparisons are typically more reliable than scalar ratings for open-ended outputs, which is why tools like LangSmith support pairwise annotation queues. Implicit signals such as accept, reject, regenerate, or abandonment are useful, but only as weak evidence unless corroborated by explicit feedback or outcome data. Model-graded evals help at scale, but OpenAI's own eval guidance is explicit that model grading has an error rate and should be validated with human review before being used as a governing signal.

| Signal | UI pathway and API pathway | Canonical storage | Denoising strategy | Anti-gaming controls | Healthy frequency target |
| --- | --- | --- | --- | --- | --- |
| **Thumbs up/down per response** | Existing message controls; `POST /ai/feedback` upgraded to require `reason_code` on downvote | `feedback_events` with `signal_type=thumb`, `signal_value`, `reason_code`, `comment`, `message_id`, `response_id`, `trace_id`, `prompt_version_id`, `tenant_id`, `user_id`, `created_at` | Weight by user reliability, recency, and agreement with other signals; suppress one-off outliers | Per-user rate limits; duplicate suppression; abuse score; ignore bursts from same session/IP/device | 1 explicit signal per 8–15 AI responses |
| **Star rating** | 1–5 stars after high-value responses or completed workflows | Same table with `signal_type=rating`, scalar value | Convert to z-score per user to handle "harsh" vs "easy" raters | Require optional reason on 1–2 stars; cooldown before repeated ratings | 1 rating per completed complex task, not every message |
| **Explicit correction** | "Edit answer / teach the system" action with before/after diff | `feedback_corrections`, storing structured diff, corrected artifact, scope (user/org), provenance, sensitivity tier | Prefer corrections that are re-used or approved; ignore raw verbatim patches without classification | Virus/PII/secret scanning; admin approval for org-wide application | 1 correction per material miss, not target-driven |
| **Explicit override** | "Reject proposal" with mandatory reason and optional alternative | `feedback_overrides` with `proposal_type`, `reason_code`, `manual_resolution`, `impact_class` | Distinguish disagreement in strategy from answer quality | Mandatory reason; low-trust overrides cannot auto-learn | 1 per decision-heavy workflow where AI makes a recommendation |
| **Comparative choice** | "Compare A/B" or operator eval queue | `pairwise_judgments` with candidate IDs, winner, rubric, judge role | Bradley–Terry or Elo-style aggregation; higher weight for expert annotators | Blind labels; randomised order; inter-rater agreement checks | 1 pairwise judgment per 20–30 complex tasks or per prompt release |
| **Implicit engagement** | Copy, save, export, regenerate, abandon, reopen, share | `implicit_events` with `event_type`, `latency_to_action`, `session_outcome` | Never treat as ground truth alone; combine with explicit/outcome signals | Bot detection; minimum dwell time; exclude accidental clicks | Passive on every session |
| **Implicit correctness** | Task executed, accepted, not reopened; downstream KPI moved as expected | `outcome_feedback` linked to workflow object and time window | Only score when ground truth window closes; segment by task class | Signed server-side events only; no client-only writes | For every executable workflow |
| **Longitudinal outcome** | "Was this decision good after 30 days?" | `longitudinal_reviews` with delayed score, business outcome, counterfactual fields | Separate from immediate satisfaction; use only where measurable | Review windows fixed by workflow type; who can submit is restricted | Weekly or monthly on selected high-stakes workflows |

### Unified feedback event schema

Every signal should land on a unified feedback event schema so that operator dashboards, eval pipelines, and memory extraction all consume the same backbone. Minimum fields:

- `tenant_id`, `org_id`, `user_id`, `session_id`
- `message_id`, `response_id`, `trace_id`, `prompt_version_id`, `model_id`, `tool_trace_ids[]`
- `signal_type`, `signal_value`, `reason_code`, `free_text`
- `actor_role`, `confidence_weight`, `abuse_score`, `applied_state`

The storage contract should make it impossible for the learning layer to mutate prompts or memory directly from a raw event. It must first pass through scoring, review, and policy checks. This separation matches how evaluation platforms distinguish raw logs, annotations, scores, and deployments.

---

## Per-client memory layer

The per-client memory system should have four layers: **conversation**, **user**, **organisation**, and **learned**. The critical rule is that the learned layer is neither free text nor an invisible notepad; it is a typed, reviewable object store generated from evidence.

| Layer | What belongs in it | Persistence | Who edits | Who sees | Default retention | Delete/export rule |
| --- | --- | --- | --- | --- | --- | --- |
| **Conversation** | Turn-by-turn facts, temporary hypotheses, local entity resolution, workflow state | Session-bound | System | Participants with chat access | Per chat policy | Deleted with chat; included in export |
| **User** | Personal response preferences, favourite output formats, role context, preferred KPIs vocabulary | Persistent | User; limited admin assist | User; org admin only if policy permits | Until deletion or inactivity expiry | User can edit/delete individually; included in SAR export |
| **Organisation** | Canonical playbooks, terminology, supplier/vendor dictionaries, approved policies, house style, defined KPI formulas | Persistent | Org admin / designated knowledge owner | Tenant users under ACL | Until replaced or policy expiry | Org admin can edit/version; exportable to audit package |
| **Learned** | Auto-extracted patterns from evidence across conversations within the tenant | Persistent but always expiring | System proposes; org admin reviews high-impact items | Org admin viewer; users can see user-scoped items affecting them | TTL-based with decay | Item-level delete, disable, rectify, and export |

### Allowed learned object types

The learned layer should only admit a narrow set of object types:

- `terminology_map`
- `format_preference`
- `kpi_definition`
- `entity_alias_map`
- `vendor_partner_reference`
- `compliance_reference`
- `decision_precedent`
- `risk_tolerance_pattern`
- `approval_rule`
- `tool_preference`
- `citation_style`
- `escalation_preference`

### Learned object schema

Each learned object should carry:

- `scope`, `owner`, `provenance[]`, `evidence_count`, `confidence`
- `first_seen_at`, `last_seen_at`, `expires_at`, `status`
- `supersedes_id`, `sensitivity_tier`, `last_applied_at`

The system should explicitly exclude secrets, raw credentials, one-off facts with no future utility, long verbatim passages, unapproved legal interpretations, and anything that would make a superadmin's aggregated controls secretly reconstruct tenant content.

### Disclosure model

The disclosure model should be first-class. Users and tenant admins need a visible **"What Consultify knows"** page that lists learned facts by scope, shows why the system believes them, when they were last used, when they expire, and where they came from. This is increasingly consistent with mainstream products: ChatGPT lets users manage memories and shows when past chats were used as a source; Gemini exposes saved info controls and labels responses when "Your saved info" was used. Consultify should do the same, but with stronger enterprise-grade provenance.

### Conflict resolution

Conflict resolution must be deterministic. When Jan says supplier A is primary and Feb says supplier B is primary, the resolution policy should be:

1. Explicit admin-set org fact beats inferred pattern.
2. Newer approved fact beats older approved fact.
3. Repeated corroboration beats one-off mention.
4. High-sensitivity classes require human approval before replacement.
5. Contradictions never overwrite silently; they create a `disputed` state.

This is not only good product design; it directly aligns with the accuracy principle, which requires reasonable steps to keep personal data accurate and up to date, and to erase or rectify inaccuracies without delay.

### GDPR / SAR contract

For GDPR/SAR, the export package must include:

- All user-scoped and tenant-scoped memory objects that relate to the requester
- Their provenance references
- Prompt addenda derived from them
- Feedback submitted by or about their interactions insofar as it is their personal data
- Retention timers and deletion status

The right of access is not satisfied by exporting only chat transcripts; it must include the supplementary information that explains what is processed and why. The delete path must likewise clear both the memory object and any future application of it, with a tombstone log only where legally required.

---

## Platform-wide learning loop

The platform-wide loop should learn generalised operational patterns, **not tenant content**. Its purpose is to improve prompts, routing, structure, tool use, retrieval strategies, and workload-specific model choice across the application. The modern pattern here is clear: benchmark candidates on datasets, score them with deterministic, model-based, and human evaluators, and only then roll them out.

### Five-stage pipeline

| Stage | Required mechanism | Release condition |
| --- | --- | --- |
| **Pattern mining** | Mine traces, feedback, cost, latency, and outcome data across tenants after anonymization gate | Candidate hypothesis only |
| **Candidate synthesis** | Produce prompt/routing/retrieval hypotheses with explicit expected gain, scope, and rollback plan | Human review on high-impact classes |
| **Offline evaluation** | Run on gold datasets by intent class, sector, and workflow | Must beat baseline and not regress safety |
| **Shadow and canary** | Shadow on live traffic without effect, then 1% → 10% cohort rollout | Quality and incident thresholds remain healthy |
| **Broad rollout** | Promote to production label for all eligible tenants | Kill switch and rollback buffer stay active |

### Anonymization gate

The anonymization gate is load-bearing. The platform cannot treat pseudonymised tenant traces as "safe enough" for general learning. The European Data Protection Board is explicit that pseudonymised data is still personal data if it can be attributed back to a person through additional information, and that only properly anonymised data falls outside GDPR scope.

The global mining pipeline must require more than token replacement. It should enforce, at minimum:

- PII stripping
- Rare-entity suppression
- No carry-over of customer-specific strings above a short token threshold
- k-anonymity or similar minimum frequency checks for generalised patterns
- Rejection of any candidate rule that contains tenant-unique vocabulary

### Prompt-ops stack

For deployment, copy the modern prompt-ops stack rather than inventing ad hoc flags. You need **environment labels, prompt versions, dataset-backed experiments, score dashboards, and explicit rollback**. Langfuse supports versioned prompts, labels, experiments, and metric comparison; PromptLayer supports release labels for partial rollouts; Helicone supports experiments, prompt management, sessions, and instant rollback. The result for Consultify should be a **prompt registry + rollout controller** that is productised, audited, and decoupled from code deploys.

### Regression policy for model and prompt changes

- No new prompt or model ships without offline evals on intent-class datasets.
- Any new candidate must beat or match baseline on quality while staying inside cost and latency budgets.
- Safety, compliance, and citation-faithfulness checks are hard gates, not weighted trade-offs.
- Canary cohorts must be reversible immediately.
- Drift alerts fire on adverse movement in quality score, negative feedback rate, citation hallucination rate, tool failure rate, or cost per successful task.

---

## Control surfaces

Consultify needs two distinct but symmetrical control planes: one for **superadmin/operators** and one for **tenant admins**. The former governs platform behaviour and incidents; the latter governs tenant context and policy. The mistake to avoid is collapsing them into one workspace with uneven visibility.

### Superadmin surface

| Capability | Required behaviour |
| --- | --- |
| **Prompt registry** | Versioned prompts per intent, agent, and co-thinker persona; diff, rollback, labels, staging, test-before-deploy |
| **Learning dashboard** | Top extracted platform patterns; confidence distributions; positive/negative/neutral feedback mix; cost per tenant/workload; anomaly alerts; prompt-version win rates |
| **Policy editor** | Per-tenant overrides for model, tool access, budget caps, sector guardrails, residency mode, logging mode |
| **Query UI** | Search traces, eval failures, feedback reasons, hallucination incidents, tool failures, and high-cost sessions with redacted context |
| **Eval trigger** | Run eval suites on demand; compare runs side by side; attach candidate to release approval |
| **Incident console** | Flip tenant or workload from model X to model Y, disable tools, pin prompt version, freeze learning, widen redaction, require human review |
| **Cross-tenant analytics** | Anonymous, aggregated intent distribution, failure classes, cost trends, rollout outcomes |

### Tenant admin surface

| Capability | Required behaviour |
| --- | --- |
| **Memory viewer** | "What the system knows about us" with scope, provenance, confidence, expiry, edit/delete |
| **Org instruction editor** | Org-wide custom instructions, independent from per-user instructions |
| **Playbook injector** | Intent-scoped rules such as "for compliance queries, always cite policy X" |
| **Persona catalogue** | Tenant-specific co-thinker personas with voice, reference set, style, and role assumptions |
| **Quality roll-up** | Team usage, bottlenecks, low-satisfaction intents, repeat clarifications, saved time and cost |
| **Residency and ACL** | Control who can see org memory objects and which regions/processors can be used |
| **Audit export** | Full tenant dump of memory objects, policies, prompt overrides, and approved playbooks |

### Break-glass access model

The superadmin visibility model must obey your constraint that operators do not see raw message content by default. The right compromise is **break-glass, purpose-bound access** only for incident investigation and only when tied to an explicit negative feedback item, a policy breach, or a severe system anomaly. Even then, the UI should reveal the minimal contextual excerpt required for triage, keep a durable access log, and redact unrelated turns.

---

## Guardrails and privacy

**Guardrails must outrank learning.** This is the most important architectural rule in the whole design. OpenAI's Model Spec frames model behaviour as a formal chain of command, and Anthropic's Constitutional AI and DeepMind's Sparrow both demonstrate the operational advantage of explicit behavioural rules and targeted evaluation over opaque adaptation.

### Precedence graph (hard)

```
safety/compliance law and sector rules
  → platform policy
    → tenant policy
      → org playbook
        → user instructions
          → learned preferences
            → session intent
```

Nothing below the guardrail line is ever allowed to "unlearn" or weaken anything above it.

### Required controls on the self-improving loop

- **Human-in-the-loop approval** for global prompt changes, sector-specific changes, and any learned pattern that would materially change factual interpretation, compliance posture, or actionability.
- **Shadow learning by default:** patterns can be proposed and scored without becoming active behaviour.
- **Canary deployment** with cohort labels and automatic rollback.
- **Rollback buffer** of at least 72 hours after deploy.
- **Contamination prevention:** business data is excluded from model training by default; for especially sensitive workflows use zero-data-retention or `store: false` modes where applicable; retrieved connector data and tenant memory never become global training examples.
- **Drift alarms** on score regressions, anomaly spikes, safety label changes, or cost explosions.
- **Approval-aware connectors:** any tool with write capability must be separately disableable at workspace level, and research modes should avoid uncontrolled write actions.

### Privacy principles (contract, not policy doc)

- Collect only what is necessary.
- Define retention and justify it.
- Periodically review and erase or anonymise stale data.
- Support subject access, rectification, and erasure workflows.
- Distinguish anonymisation from pseudonymisation correctly.
- Keep audit logs of who changed what and why.

### Three operating modes for enterprise buyers

1. **Ephemeral mode** — no memory writes, no chat-history reference, no implicit learning beyond security logging.
2. **Tenant-only mode** — per-tenant learning on, platform mining off.
3. **Full governed mode** — tenant learning on, platform mining on only after anonymization gate and eval governance.

This gives a credible answer for finance, public sector, and high-regulation accounts.

---

## User-facing feedback UX

The user should never have to guess whether feedback mattered. Consultify should disclose not only what source was used, but **what changed because of the user's or organisation's feedback**.

| Event | Required user-facing behaviour |
| --- | --- |
| User downvotes an answer | "Thanks — I logged that this answer missed the mark. I will not change behaviour silently. You can review what is stored and what changed." |
| User submits a correction | "Updated. I will prefer this structure for future responses in this scope." |
| Org admin approves a learned pattern | Team members affected by it see: "Updated based on approved guidance from your organisation." |
| System uses saved preference or org memory | Soft disclosure chip: "Using your preferred board format" or "Using your organisation's KPI definition for EBITDA bridge." |
| Platform-wide prompt rollout changes behaviour | Change notice in release notes / query footer: "This answer uses a newly approved reasoning template for this task type." |
| User opts out | "This conversation will not update memory and will not use past personalised context." |

**Do not expose raw inner monologue.** For enterprise trust, the right artefact is a trace summary: memories used, policies applied, tools invoked, sources cited, confidence band, and last relevant approval or rollout. That is legible enough for audit without creating a second sensitive object that is harder to govern than the answer itself.

---

## Numbered requirements

| ID | Priority | Requirement | Test | Risk if omitted |
| --- | --- | --- | --- | --- |
| **R-LEARN-1** | **P0** | All feedback types must land on one canonical event schema linked to trace, prompt version, model, and tenant | Insert any feedback event and reconstruct full execution provenance | No reliable learning, no debuggability |
| **R-LEARN-2** | **P0** | Negative explicit feedback must require a reason code; free text is optional but structured reasons are mandatory | 95%+ of negative events captured with reason enum | Weak denoising and poor triage |
| **R-LEARN-3** | **P0** | Corrections must be captured as structured deltas, not raw comment text only | Correction event can generate typed candidate memory object | No actionable self-learning |
| **R-LEARN-4** | **P0** | Learned memory objects must be typed, scoped, provenance-backed, confidence-scored, and expiring | Every active learned item has scope, provenance, owner, TTL, status | Hidden and unsafe memory accretion |
| **R-LEARN-5** | **P0** | Users and tenant admins must be able to view, edit, disable, and delete memory items affecting them | UI supports item-level edit/delete and updates runtime immediately | GDPR and trust failure |
| **R-LEARN-6** | **P0** | Full SAR export must include chats, memory objects, provenance, policies, and prompt addenda affecting the user | Export package can be generated and verified end to end | Partial compliance only |
| **R-LEARN-7** | **P0** | Cross-tenant platform learning must pass an anonymization gate; pseudonymisation alone is insufficient | Candidate rejected if tenant-unique strings or rare entities survive | Catastrophic leakage risk |
| **R-LEARN-8** | **P0** | Global prompt/model/routing changes must be eval-gated before rollout | Candidate cannot promote without passing eval suite | Regressions reach production |
| **R-LEARN-9** | **P0** | All releases must support staged rollout and instant rollback | Canary can be reverted within minutes | Incident blast radius too large |
| **R-LEARN-10** | **P0** | Safety/compliance policies are sticky and outrank learned preferences | Adversarial feedback cannot relax sector guardrails | Safety and legal failure |
| **R-LEARN-11** | **P0** | Superadmin access to raw content must be break-glass only and audit-logged | Attempted access requires incident reason and is logged | Internal trust collapse |
| **R-LEARN-12** | **P0** | There must be an explicit "no memory / no learning" mode | Session started in private mode writes no memory and ignores prior memory | No credible privacy posture |
| **R-LEARN-13** | **P1** | Prompt registry must support diff, versioning, environments, testing, and rollback | Non-engineer can update and stage a prompt safely | Prompt chaos and code-coupled releases |
| **R-LEARN-14** | **P1** | Platform dashboard must show pattern mining outputs, feedback breakdown, cost, and anomalies | Operator can inspect last 7/30/90 day changes | Blind operations |
| **R-LEARN-15** | **P1** | Tenant admin must have org instructions, playbook injection, and persona catalogue | Admin creates rule and sees it affect eligible tasks | Weak tenant adaptation |
| **R-LEARN-16** | **P1** | Drift alarms must fire on quality, hallucination, cost, and tool-failure regressions | Synthetic degradation triggers alert | Late incident detection |
| **R-LEARN-17** | **P1** | Comparative evaluation must support pairwise judgments by experts | Pairwise queue produces ranked winner between prompt variants | Poor choice quality for open-ended outputs |
| **R-LEARN-18** | **P2** | Longitudinal outcome feedback should score decisions after their business window closes | One workflow supports 30-day "decision quality" review | System optimises only for immediate satisfaction |

---

## Benchmark matrix

| System | Copy | Avoid | Why it matters for Consultify |
| --- | --- | --- | --- |
| **OpenAI** | Deletable memory, Temporary Chat, project-only memory, custom instructions, eval flywheel, ZDR / `store:false` for sensitive workloads | Letting memory become an untyped blob or changing behaviour without provenance | Best benchmark for scoped personalisation plus governed rollout |
| **Anthropic** | Separation of project instructions and memory, controller/processor clarity, capability toggles, connector governance | Storing full feedback conversations for very long periods without a stricter enterprise policy | Strong pattern for enterprise controls and scoped project context |
| **Kimi** | Memory as an explicit tool, long-context + multi-step tool workflow support | Assuming memory tooling alone provides governance | Useful for tool-first architecture and high-fidelity workflow context |
| **Mem.ai** | Version history, restore, edit timeline, auditability of changes | Knowledge sprawl without typed ownership | Excellent benchmark for rollbackable memory and historical traceability |
| **LangSmith** | Pairwise queues, reusable rubrics, RBAC, workload isolation | Mixing unrelated teams in one workspace boundary | Strong benchmark for human review ops and isolation strategy |
| **Helicone** | Sessions, score centralisation, experiments, prompt rollback | Treating observability as equivalent to evaluation | Useful as an operator console pattern, not as the eval brain itself |
| **Humanloop** | Mixed evaluators, drift monitoring, UI for non-technical reviewers, CI/CD-aligned evals | Manual spreadsheet review culture | Good pattern for hybrid human + automated governance |
| **Notion AI** | Permission-respecting context, source citations, enterprise zero-retention posture with providers | Over-broad source scopes by default | Excellent pattern for "show me why you know this" |
| **GitHub Copilot** | Accept/reject, thumbs, rejection reasons, permission rejection feedback | Overfitting to single-click telemetry | Useful benchmark for low-friction explicit and implicit signals |
| **Gemini** | Saved info controls and "used your saved info" disclosure | Consumer-style default retention assumptions in enterprise contexts | Good benchmark for transparent personal context disclosure |

---

## First-sprint roadmap (14 days)

The first 14 days should focus on shipping the control contract, not on chasing sophisticated ML.

| Day range | Deliverable | Notes |
| --- | --- | --- |
| **Days 1–2** | Unified feedback schema and event bus | Extend `POST /ai/feedback`; add reason codes, trace links, and signal taxonomy |
| **Days 3–4** | Learned memory object model and extraction rules | Upgrade `learningSystem.extractAllPatterns` to emit typed candidates with provenance, confidence, TTL |
| **Days 5–6** | Tenant memory viewer and delete/edit flows | Ship "What the system knows" for user/org/learned scopes; add disclosure chips in UI |
| **Days 7–8** | Prompt registry and staged release labels | Wrap current prompt logic in versioned registry with diff, test, rollback |
| **Days 9–10** | Eval gating and canary rollout | Connect `evalHarnessService` to release approvals; canary by tenant cohort with kill switch |
| **Days 11–12** | Superadmin incident console and drift alerts | Model flip, prompt revert, tool disable, freeze-learning switch, anomaly alerts |
| **Days 13–14** | GDPR package and anonymization gate | SAR export, deletion workflow, retention policy engine, rare-entity suppression for platform mining |

If you sequence the work this way, by the end of sprint one Consultify will already have the contract that matters most in enterprise AI: feedback is captured, learning is reviewable, rollout is gated, and behaviour changes are visible. That is the shortest credible path from your current runtime to a defensible self-learning platform.

---

## Requirements inventory (flat list)

| ID | Priority | One-liner |
| --- | --- | --- |
| R-LEARN-1 | P0 | Canonical feedback event schema linked to trace/prompt/model/tenant |
| R-LEARN-2 | P0 | Negative feedback requires reason_code (enum) |
| R-LEARN-3 | P0 | Corrections stored as structured diffs, not raw text |
| R-LEARN-4 | P0 | Learned memory objects typed/scoped/provenance/confidence/TTL |
| R-LEARN-5 | P0 | User + tenant admin can view/edit/disable/delete memory items |
| R-LEARN-6 | P0 | SAR export includes chats + memory + provenance + policy + prompt addenda |
| R-LEARN-7 | P0 | Anonymization gate for platform learning (no pseudonymisation-only) |
| R-LEARN-8 | P0 | Eval-gated rollout of prompt/model/routing changes |
| R-LEARN-9 | P0 | Staged rollout + instant rollback across releases |
| R-LEARN-10 | P0 | Guardrails outrank learned preferences (hard precedence graph) |
| R-LEARN-11 | P0 | Break-glass superadmin content access with audit log |
| R-LEARN-12 | P0 | Ephemeral / no-memory session mode |
| R-LEARN-13 | P1 | Prompt registry with diff/version/env/test/rollback |
| R-LEARN-14 | P1 | Operator dashboard with pattern mining + feedback + cost + anomalies |
| R-LEARN-15 | P1 | Tenant admin: org instructions + playbook injection + persona catalogue |
| R-LEARN-16 | P1 | Drift alarms on quality/hallucination/cost/tool-failure |
| R-LEARN-17 | P1 | Pairwise expert evaluation queue |
| R-LEARN-18 | P2 | Longitudinal 30-day decision-quality review |

**Totals:** 18 requirements — 12 × P0, 5 × P1, 1 × P2.

---

## Cross-document linkage

The Feedback/Self-Learning layer is not standalone — it depends on and reinforces the other research contracts:

- **Reasoning (`DEEP_RESEARCH_REASONING_REQUIREMENTS_2026-04-18.md`):**
  - Every feedback event `signal` must link to `trace_id`, `prompt_version_id`, `model_id` from the Reasoning trust bundle (R-REASON-16, R-REASON-18, R-REASON-19).
  - Reason codes on downvote become an input to R-REASON-14 (self-check gate) calibration.
  - Learned `format_preference` and `citation_style` flow into the `response_class` rendering contract (R-REASON-10, R-REASON-11).
  - Platform learning loop respects the prompt-precedence graph from R-REASON-25.

- **Artifact (`DEEP_RESEARCH_ARTIFACT_CONNECTORS_ROI_ONBOARDING_2026-04-18.md` §Artifact):**
  - `feedback_corrections` on artifact content feed MutationProposal evidence bundle (R-ARTIFACT-3).
  - "What Consultify knows" page must disclose learned patterns used in artifact generation (R-ARTIFACT-4 governance).

- **Connectors (same file §Enterprise integrations):**
  - Learned `vendor_partner_reference` and `entity_alias_map` must honour ACL from R-CONNECT-5.
  - Disconnect purge (R-CONNECT-6) cascades into learned objects derived from that source.

- **ROI lifecycle (same file §ROI):**
  - Longitudinal outcome feedback (R-LEARN-18) is the telemetry feed for persistence checks on Initiatives (R-OUTCOME-6).
  - `kpi_definition` in learned memory must not override signed baselines (R-OUTCOME-2).

- **Onboarding (same file §Onboarding):**
  - First-run disclosure that ephemeral / tenant-only / full governed modes exist (R-ONBOARD-6).
  - "First verified answer" ritual (R-ONBOARD-7) requires a valid trust bundle + feedback hook.

---

## What this document is NOT

- Not a ticket backlog (the next pass converts `R-LEARN-*` into tickets, flags, tests, CI invariants).
- Not a model-training plan (no fine-tuning of foundation models — tenant content is excluded from training by default).
- Not a replacement for existing Admin/Trust dev plans — it is the governance spine for learning *on top of* them.
- Not an RLHF pipeline — feedback feeds prompt/routing/memory updates, not weight updates.

## Next step

Turn this document into the Feedback / Learning implementation plan alongside Reasoning / Artifact / Connectors / ROI / Onboarding:
1. Assign each `R-LEARN-*` a ticket ID and block (likely new block `learning` in `ChatV9Block` union, or a dedicated `ChatV10Block`).
2. Register feature flags per requirement (`ff.learning_feedback_schema`, `ff.learning_memory_viewer`, `ff.learning_prompt_registry`, `ff.learning_anonymization_gate`, `ff.learning_ephemeral_mode`, etc.).
3. Draft `FEEDBACK_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md` with per-ticket acceptance + test strategy.
4. Extend `CHAT_V9_TELEMETRY_CONTRACT` with `feedback.*` + `learning.*` event families and the unified feedback event schema.
5. Add CI invariants in `chatV9FeatureFlags.test.ts`:
   - every `R-LEARN-*` → flag in registry,
   - every `feedback.*` / `learning.*` event → section in telemetry contract,
   - every learned object type enum value used in code matches the documented taxonomy,
   - every `reason_code` enum is bijective with the `feedback.reason_code` section in the contract.
