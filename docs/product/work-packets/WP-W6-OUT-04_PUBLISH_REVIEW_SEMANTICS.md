# WP-W6-OUT-04 — Shared Publish and Review Semantics Analysis

> Packet: WP-W6-OUT-04
> Wave: 6 — Outputs, finance and realization
> Track: E — Outputs, finance and realization
> Status: completed
> Owner: Product + Engineering
> Scope: shared publish and review semantics across reports, presentations, finance outputs, and results — covering how outputs move from draft to published state with review, approval, and distribution governance
> Depends on: WP-W1-AI-03 (execution proposal and approval spine), WP-W4-COLLAB-03 (concurrent editing and notification spine)

---

## 1. Publish lifecycle

### 1.1 Governing principle

From `AI_COLLABORATION_AND_PUBLISHING_ARCHITECTURE_V8.md` §4:

`private work -> reviewable share -> team-visible artifact or conversation -> published output -> governed archive`

From `REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md` §9, the shared delivery vocabulary is:

`draft -> generated -> editing -> in_review -> ready -> shared -> archived`

These two models are compatible but operate at different abstraction levels. The collaboration architecture defines the visibility lifecycle; the output operating model defines the delivery lifecycle within that visibility progression. This analysis normalizes them into one canonical publish lifecycle.

### 1.2 Normalized publish lifecycle

The canonical publish lifecycle for all output types (reports, presentations, finance outputs, results artifacts) is:

```
draft → generated → editing → in_review → approved → published → archived
                       ↑                      │
                       └──────────────────────┘
                         (rejected → re-editing)
```

| State | Semantics | Visibility | Who triggers |
|---|---|---|---|
| `draft` | Output created, structure defined, content not yet generated or only partially populated. | Private to creator or assigned collaborators. | User (on output creation). |
| `generated` | AI or system has produced initial content. Not yet reviewed by a human. | Private to creator or assigned collaborators. | System (on AI generation completion). |
| `editing` | Human is actively refining content — through direct editing or chat-driven editing. | Visible to assigned collaborators within the project/workspace scope. | User (on first edit) or automatic (after generation). |
| `in_review` | Content is submitted for review. Reviewers are assigned or invited. | Visible to reviewers and collaborators. Review comments and annotations are active. | User (explicit review request). |
| `approved` | Review is complete. Content meets quality and governance gates. Ready for distribution. | Visible to collaborators and approvers. Not yet distributed externally. | Reviewer (explicit approval) or policy engine (for policy-approvable outputs). |
| `published` | Output is distributed to its intended audience. Becomes the governed record. | Visible per distribution rules — may include external stakeholders, board members, or broader organization. | User with publish permission (explicit publish action). |
| `archived` | Output is no longer active but preserved for reference, audit, and compliance. | Visible to users with archive access. Not in active views by default. | User or system (time-based or manual archive). |

### 1.3 Transition rules

1. **Forward-only for the happy path.** `draft → generated → editing → in_review → approved → published → archived`.
2. **Rejection loops back to editing.** From `in_review`, a reviewer may reject, returning the output to `editing` with review comments attached.
3. **Re-review is allowed.** From `editing` (after rejection), the output may re-enter `in_review`.
4. **Published outputs may be revised.** A published output may spawn a new version that starts at `editing`, while the published version remains the governed record until superseded.
5. **Archival is available from `published` only.** Outputs cannot be archived before they have been published (draft/editing artifacts are simply deleted or abandoned, not archived).
6. **Skipping states is governed.** Low-formality outputs (e.g. internal working notes) may skip `in_review` and move directly from `editing` to `published` if org policy allows. The skip must be auditable.

### 1.4 Relationship to the output operating model vocabulary

The output operating model (`REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md` §9) uses `ready` and `shared` instead of `approved` and `published`. This analysis normalizes as follows:

| Output operating model term | Normalized term | Rationale |
|---|---|---|
| `ready` | `approved` | "Ready" implies review completion and quality gate passage. `approved` is more precise and aligns with the approval spine (WP-W1-AI-03). |
| `shared` | `published` | "Shared" implies distribution. `published` is the canonical term from the collaboration architecture and carries stronger governance connotation. |

This normalization does not contradict the source docs — it refines vocabulary for cross-output consistency.

---

## 2. Review semantics

### 2.1 What review means

Review is the governed process by which an output transitions from `editing` to `approved`. It is not a casual share — it is a formal quality and governance gate.

From `REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md` §6 (shared taxonomy), `reviewState` is a shared property across both reports and presentations. This analysis extends that requirement to all output types.

### 2.2 Review roles

| Role | Responsibility | Who can hold it |
|---|---|---|
| **Author** | Creates and edits the output. Submits for review. | Any user with edit permission on the output. |
| **Reviewer** | Evaluates content quality, accuracy, and fitness for audience. Provides comments and annotations. May approve or reject. | Assigned by author or by project/workspace policy. |
| **Approver** | Makes the final approval decision. May be the same as reviewer or a separate governance role. | Determined by org policy, project role model, or output confidentiality level. |
| **Publisher** | Executes the publish action — distributing the approved output to its audience. | User with publish permission. May require approver status. |

### 2.3 Review actions

| Action | Semantics | State transition |
|---|---|---|
| `request_review` | Author submits output for review, optionally assigning specific reviewers. | `editing → in_review` |
| `comment` | Reviewer adds inline or section-level comments. Does not change state. | No state change. |
| `request_changes` | Reviewer returns output to author with specific change requests. | `in_review → editing` |
| `approve` | Reviewer/approver confirms the output meets quality and governance standards. | `in_review → approved` |
| `reject` | Reviewer/approver rejects the output with documented reasons. | `in_review → editing` (with rejection record preserved for audit). |

### 2.4 Review gates

Review gates define what must be checked before approval. These are shared across output types:

| Gate | Description | Applies to |
|---|---|---|
| **Source traceability** | All claims and data points are traceable to source artifacts or context packs. | Reports, presentations, finance outputs, results. |
| **AI governance** | AI-generated content has been reviewed; no silent edits, no fabricated evidence. | All outputs with AI-generated content. |
| **Audience fit** | Content density, register, and confidentiality match the intended audience. | Reports, presentations. |
| **Brand compliance** | Visual and textual standards are met. | Reports, presentations. |
| **Numeric consistency** | Financial figures, KPIs, and metrics are internally consistent and match source data. | Finance outputs, results, reports with numeric claims. |
| **Delivery readiness** | Output is complete and formatted for its delivery mode (reading, presenting, dashboard). | All output types. |

### 2.5 Review object

The review process should be tracked through a shared review object:

| Field | Type | Description |
|---|---|---|
| `review_id` | uuid | Unique review identifier. |
| `output_ref` | `ArtifactRef` | The output being reviewed. |
| `output_version` | version ref | The specific version under review. |
| `requested_by` | user ref | Who requested the review. |
| `requested_at` | timestamp | When review was requested. |
| `reviewers` | user ref[] | Assigned reviewers. |
| `review_status` | enum | `pending` · `in_progress` · `changes_requested` · `approved` · `rejected`. |
| `review_comments` | comment ref[] | Linked review comments. |
| `gates_checked` | gate result[] | Which quality gates were evaluated and their outcomes. |
| `resolved_at` | timestamp | When the review was completed. |
| `resolved_by` | user ref | Who made the final review decision. |

### 2.6 Relationship to the approval spine

The review semantics defined here operate at the **output governance** level, not at the execution proposal level. The approval spine (WP-W1-AI-03) governs AI-proposed mutations during editing. The review model governs the human-to-human quality gate before publication.

These are complementary, not competing:

- **Approval spine**: governs individual AI-proposed changes during the `editing` phase.
- **Review model**: governs the holistic output quality gate at the `editing → in_review → approved` transition.

Both must be auditable. Both must distinguish human decisions from policy decisions.

---

## 3. Cross-output consistency

### 3.1 Shared publish model requirement

From `V8_IMPLEMENTATION_MASTER_PROGRAM.md` §8.7, Wave 6 must deliver "shared publish and review semantics." This means the publish lifecycle and review model defined above must apply uniformly across:

| Output family | Primary artifacts | Specific considerations |
|---|---|---|
| **Reports** | Management reports, governance documents, review packs, diagnostic reports. | Evidence density gate. Section-level review anchors. |
| **Presentations** | Board decks, steering decks, workshop decks, briefing decks. | Visual rhythm gate. Slide-level review anchors. |
| **Finance outputs** | Analysis narratives, budget versions, forecast cycles, valuation cases, CFO review packs. | Numeric consistency gate. Review and lock states (per `FINANCE_V8_SSOT.md` §4.4). |
| **Results artifacts** | Scorecards, KPI review packs, ROI evidence packs, executive review summaries. | Metric accuracy gate. Deviation and corrective action completeness. |

### 3.2 Shared properties across all output types

From `REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md` §6, the following taxonomy is shared between reports and presentations. This analysis extends it to all output types:

| Property | Description | Required for |
|---|---|---|
| `audience` | Intended audience for the output. | All. |
| `goal` | Purpose of the output. | All. |
| `communicationRegister` | Formality and tone. | Reports, presentations. |
| `language` | Output language. | All. |
| `confidentiality` | Access classification. | All. |
| `deliveryMode` | How the output will be consumed (reading, presenting, dashboard, review pack). | All. |
| `sourceRefs` | References to source artifacts. | All. |
| `contextPackSnapshot` | Snapshot of the context pack used during generation. | All. |
| `reviewState` | Current position in the review lifecycle. | All. |
| `qualityState` | Current quality gate status. | All. |
| `publishState` | Current position in the publish lifecycle. | All (new — extends the shared taxonomy). |

### 3.3 Output-specific extensions

Each output family may extend the shared model with domain-specific properties, but the core publish lifecycle, review semantics, and shared properties must remain consistent. Output-specific extensions must not contradict or replace the shared model.

### 3.4 Finance-specific publish considerations

Finance outputs have an additional `lock` concept (`FINANCE_V8_SSOT.md` §4.4: "review and lock states"). Lock in finance context means:

- A budget version or forecast cycle is frozen for review — no further edits allowed.
- Lock precedes review; it is a prerequisite, not a replacement.
- The publish lifecycle accommodates this: `editing → locked → in_review → approved → published`.

The `locked` state is a finance-specific extension that sits between `editing` and `in_review`. It does not replace the shared lifecycle — it adds a domain-specific gate.

### 3.5 Results-specific publish considerations

Results artifacts (scorecards, KPI review packs) have a temporal dimension:

- A scorecard review pack is published for a specific review period.
- Publishing a new period does not archive the previous one — both remain accessible.
- The publish lifecycle applies per review period, not per artifact.

---

## 4. Report-to-presentation promotion

### 4.1 Promotion within the publish lifecycle

From `REPORT_TO_PRESENTATION_PROMOTION_AND_CONVERSION_RUNTIME_V8.md` §3, promotion creates a new output artifact from an existing one, keeping the original intact.

Promotion interacts with the publish lifecycle as follows:

| Source state | Promotion allowed | Target initial state | Rationale |
|---|---|---|---|
| `draft` | No | — | Incomplete outputs should not be promoted. |
| `generated` | No | — | Unreviewed AI output should not spawn new artifacts. |
| `editing` | Yes (with warning) | `editing` | User may promote a work-in-progress, but the system warns that source is not yet reviewed. |
| `in_review` | Yes (with warning) | `editing` | Promotion from an output under review creates a target that may diverge from the final reviewed version. |
| `approved` | Yes (recommended) | `editing` | The cleanest promotion path — source is quality-gated. |
| `published` | Yes | `editing` | Published outputs may be promoted into new delivery forms. |
| `archived` | No | — | Archived outputs should not spawn new active artifacts. |

### 4.2 Lineage preservation

From `REPORT_TO_PRESENTATION_PROMOTION_AND_CONVERSION_RUNTIME_V8.md` §8, promotion must create an `OutputPromotionLink`:

| Field | Description |
|---|---|
| `sourceArtifactType` | `report` or `presentation`. |
| `sourceArtifactId` | Reference to the source output. |
| `sourcePublishState` | The publish state of the source at promotion time. |
| `targetArtifactType` | `report` or `presentation`. |
| `targetArtifactId` | Reference to the created target output. |
| `promotionMode` | `report_to_presentation`, `presentation_to_report`, `shared_source_to_paired`. |
| `createdAt` | When promotion occurred. |
| `stalenessState` | `current`, `stale_vs_source`, `partially_stale`, `manually_detached`. |

### 4.3 Staleness and the publish lifecycle

From `REPORT_TO_PRESENTATION_PROMOTION_AND_CONVERSION_RUNTIME_V8.md` §9:

- If the source output is re-published (new version), the promoted target's `stalenessState` transitions to `stale_vs_source`.
- The target output's review state is independent of the source — staleness is informational, not blocking.
- The user must decide whether to refresh the target from the updated source or detach.

### 4.4 Promotion and review independence

A promoted output enters its own publish lifecycle. The target output:

- Has its own `reviewState` and `publishState`.
- Goes through its own review process with its own reviewers.
- Is not automatically approved because its source was approved.
- Carries lineage metadata that reviewers can inspect.

---

## 5. Chat-driven editing integration

### 5.1 Chat-driven editing within the publish lifecycle

From `REPORTS_AND_PRESENTATIONS_CHAT_DRIVEN_EDITING_RUNTIME_V8.md` §2:

`conversation may be the user interface, but every consequential mutation still follows intent classify -> scope classify -> risk classify -> proposal -> review -> accept/reject -> apply`

Chat-driven editing operates within the `editing` state of the publish lifecycle. It does not bypass the publish lifecycle — it is a method of editing, not a method of publishing.

### 5.2 State constraints on chat-driven editing

| Publish state | Chat-driven editing allowed | Constraints |
|---|---|---|
| `draft` | Yes | Structural and content edits. |
| `generated` | Yes | Refinement of AI-generated content. |
| `editing` | Yes | Full editing capability. |
| `in_review` | Limited | Only reviewer-initiated annotation and comment responses. Author cannot make substantive edits while in review without withdrawing from review first. |
| `approved` | No | Approved outputs are frozen. Edits require creating a new version. |
| `published` | No | Published outputs are frozen. Edits require creating a new version. |
| `archived` | No | Archived outputs are read-only. |

### 5.3 Chat-driven editing and the approval spine

From `REPORTS_AND_PRESENTATIONS_CHAT_DRIVEN_EDITING_RUNTIME_V8.md` §6, chat edits are risk-classified:

- **Low-risk** edits (shorten a bullet, rewrite a paragraph): may be applied directly within the `editing` state.
- **Medium-risk** edits (rewrite a section, regenerate speaker notes): require proposal review within the chat surface.
- **High-risk** edits (alter KPI claims, change recommendation logic): must always return a reviewable proposal and may never mutate truth inline.

This risk classification aligns with the approval spine's `risk_class` taxonomy (WP-W1-AI-03 §2.3). High-risk chat edits on outputs are equivalent to `sensitive_update` or `governance_transition` proposals.

### 5.4 Chat-driven editing and the `prepare_for_delivery` intent

From `REPORTS_AND_PRESENTATIONS_CHAT_DRIVEN_EDITING_RUNTIME_V8.md` §4, `prepare_for_delivery` is a supported edit intent. This intent bridges editing and the publish lifecycle:

- The user asks the AI to prepare the output for delivery.
- The AI runs quality checks, identifies gaps, and proposes final refinements.
- Once applied, the output is ready for the `editing → in_review` transition.
- The `prepare_for_delivery` action does not itself transition the publish state — the user must explicitly request review.

---

## 6. AI collaboration in publishing

### 6.1 AI role in the publish lifecycle

From `AI_COLLABORATION_AND_PUBLISHING_ARCHITECTURE_V8.md` §4 and `REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md` §7:

AI participates in the publish lifecycle through governed proposals, not through direct state mutations. The canonical AI governance pattern is:

`AI propose -> user review -> accept/reject/refine -> execution`

### 6.2 AI actions per publish state

| Publish state | AI actions allowed | Governance |
|---|---|---|
| `draft` | Structure proposal, outline generation, section planning. | Standard proposal flow. |
| `generated` | Content is AI-generated. No further AI action needed until human review. | Output is already an AI proposal awaiting human review. |
| `editing` | All chat-driven editing intents (rewrite, shorten, deepen, refresh, restyle, etc.). | Risk-classified proposal flow per §5.3. |
| `in_review` | Quality check, completeness check, compliance check (read-only analysis). Summarize review comments. | Read-only AI actions. No mutations. |
| `approved` | No AI actions on the approved version. AI may assist in preparing the publish action (distribution list suggestion, delivery mode recommendation). | Advisory only. |
| `published` | No AI actions on the published version. AI may assist in creating a new version or promoting to another output type. | New version starts its own lifecycle. |

### 6.3 AI proposal visibility under collaboration

From `DECISION_LOG_WAVE_4.md` Decision W4-7:

`personal AI draft → explicit shared AI proposal → team review`

This decision directly governs how AI proposals interact with the publish lifecycle:

1. AI-generated content starts as a **personal draft** visible only to the requesting user.
2. The user reviews and may promote the draft to a **shared proposal** visible to collaborators.
3. Collaborators review the shared proposal through the standard review mechanism.
4. Accepted proposals become part of the output's content and advance through the publish lifecycle normally.

### 6.4 AI and the review process

AI may assist reviewers by:

- Summarizing changes since the last review.
- Highlighting sections with weak source grounding.
- Identifying numeric inconsistencies.
- Suggesting review focus areas based on risk classification.

AI must not:

- Approve or reject on behalf of a human reviewer (unless org policy explicitly enables policy-based approval for specific output types and risk levels).
- Silently modify content during review.
- Override reviewer comments or decisions.

---

## 7. Distribution governance

### 7.1 Distribution as a governed action

Publishing is not just a state transition — it is a distribution action. From `AI_COLLABORATION_AND_PUBLISHING_ARCHITECTURE_V8.md` §5, this document owns "publishing semantics and audit expectations."

Distribution governance defines:

- **Who** can publish (role-based permission).
- **To whom** the output is distributed (audience control).
- **How** the output is delivered (delivery mode).
- **What** audit trail is created (distribution record).

### 7.2 Distribution permission model

| Permission | Description | Typical holders |
|---|---|---|
| `can_edit` | Can modify the output during `editing` state. | Authors, assigned collaborators. |
| `can_review` | Can participate in the review process. | Assigned reviewers. |
| `can_approve` | Can approve the output after review. | Approvers (role-based or policy-based). |
| `can_publish` | Can execute the publish action and distribute the output. | Publishers — typically project leads, initiative owners, or designated publishers. |
| `can_view_published` | Can access the published output. | Determined by distribution rules at publish time. |

### 7.3 Distribution rules

| Rule | Description |
|---|---|
| **Confidentiality inheritance** | Published outputs inherit confidentiality classification from the output metadata. Distribution cannot widen access beyond the confidentiality level. |
| **Audience-bound distribution** | The output's `audience` property constrains who receives the published output. The publisher may narrow but not widen beyond the declared audience. |
| **Project-scoped default** | By default, published outputs are visible within the project scope. Cross-project or organization-wide distribution requires explicit publisher action. |
| **External distribution gate** | Outputs marked for external distribution (board packs, client deliverables) require additional approval or a designated external-share permission. |
| **Distribution record** | Every publish action creates a durable distribution record: who published, when, to whom, through which channel, and which output version. |

### 7.4 Delivery actions

From `REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md` §9:

| Action | Description |
|---|---|
| **Internal review share** | Share within the project/workspace for review purposes. Pre-publish. |
| **Export projection** | Render the output into an external format (PDF, PPTX) for offline distribution. |
| **External controlled share** | Share with external stakeholders through a governed link or delivery channel. |
| **Distribution audit** | Record and inspect the full distribution history of a published output. |

### 7.5 Post-publish governance

Published outputs are governed records. Post-publish rules:

- **Immutability**: the published version is frozen. Corrections require a new version.
- **Versioned supersession**: a new published version supersedes the previous one. The previous version remains accessible for audit.
- **Recall**: in exceptional cases, a published output may be recalled (unpublished). Recall requires elevated permission and creates an audit record.
- **Retention**: published outputs follow org-level retention policy. Archival is governed, not automatic.

---

## 8. Downstream dependency map

| Dependent wave/packet | Dependency on this analysis | Consequence if missing |
|---|---|---|
| **WP-W6-OUT-01 — Reports and presentations operating model** | The shared publish lifecycle and review semantics defined here are the governance layer that reports and presentations must implement. | Reports and presentations build local publish/review models that diverge from each other and from finance/results. |
| **WP-W6-OUT-02 — Results and ROI continuity** | Results artifacts must follow the same publish lifecycle for scorecards, KPI review packs, and ROI evidence packs. | Results builds a separate publish model disconnected from the output family. |
| **WP-W6-OUT-03 — Finance integration and promotion** | Finance outputs must follow the shared publish lifecycle with the finance-specific `locked` extension. | Finance builds a separate review/lock model that cannot interoperate with the shared output governance. |
| **WP-W1-AI-03 — Execution proposal and approval spine** | The review model (§2) is complementary to the approval spine. Both must coexist: approval spine for AI-proposed mutations, review model for output-level quality gates. | Confusion between AI proposal approval and output review approval. |
| **WP-W4-COLLAB-03 — Concurrent editing and notification spine** | The notification spine must support `review.requested`, `review.completed`, and `publish.ready` events (already defined in WP-W4-COLLAB-03 §4.2). The publish lifecycle adds `publish.completed` and `publish.recalled` as additional notification triggers. | Notification spine does not cover publish-specific events. |
| **Report-to-presentation promotion runtime** | Promotion interacts with the publish lifecycle as defined in §4. The `OutputPromotionLink` must carry `sourcePublishState`. | Promotion ignores publish state, creating governance gaps. |
| **Chat-driven editing runtime** | Chat-driven editing is constrained by publish state as defined in §5.2. | Chat editing bypasses publish governance. |

---

## 9. Open questions and conflicts

### 9.1 No conflicts detected between canonical docs

The following pairs were checked for consistency:

- `AI_COLLABORATION_AND_PUBLISHING_ARCHITECTURE_V8.md` §4 (visibility lifecycle) ↔ `REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md` §9 (delivery vocabulary): **Compatible.** The visibility lifecycle is a superset; the delivery vocabulary maps cleanly onto it (§1.4).
- `REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md` §7 (AI governance pattern) ↔ `REPORTS_AND_PRESENTATIONS_CHAT_DRIVEN_EDITING_RUNTIME_V8.md` §2 (governed proposal system): **Consistent.** Both enforce `AI propose → user review → accept/reject → apply`.
- `REPORT_TO_PRESENTATION_PROMOTION_AND_CONVERSION_RUNTIME_V8.md` §7 (AI role in promotion) ↔ Decision W4-7 (AI proposal visibility): **Consistent.** Both require AI proposals to start as personal drafts before becoming team-visible.
- `REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md` §9 (`ready`/`shared`) ↔ `AI_COLLABORATION_AND_PUBLISHING_ARCHITECTURE_V8.md` §4 (`published output`/`governed archive`): **No contradiction.** Vocabulary difference resolved through normalization in §1.4.

### 9.2 Vocabulary normalization note

The output operating model uses `ready` and `shared` while the collaboration architecture uses `published output` and `governed archive`. This analysis normalizes to `approved` and `published` (§1.4). This is a vocabulary refinement, not a doctrinal override. If the canonical docs are updated, they should converge on the normalized vocabulary.

### 9.3 Open questions requiring attention

| # | Question | Context |
|---|---|---|
| 1 | **Finance `locked` state formalization**: The finance SSOT mentions "review and lock states" but does not define the lock-to-review transition formally. Should `locked` be a shared lifecycle state available to all output types, or a finance-specific extension? This analysis treats it as finance-specific (§3.4), but product confirmation is needed. | `FINANCE_V8_SSOT.md` §4.4 |
| 2 | **Policy-based approval for output review**: The approval spine (WP-W1-AI-03) supports `policy-approved` for AI proposals. Should the output review model also support policy-based approval (e.g. auto-approve internal working documents below a certain confidentiality level)? This analysis notes the possibility but does not mandate it. | WP-W1-AI-03 §3.3 |
| 3 | **Cross-output publish coordination**: When a paired output (report + presentation) is published, should the system enforce that both are published together, or allow independent publication? The promotion runtime (`REPORT_TO_PRESENTATION_PROMOTION_AND_CONVERSION_RUNTIME_V8.md`) treats them as independent artifacts with lineage links, but paired-output scenarios may benefit from coordinated publish. | `REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md` §4.3, §12 |
| 4 | **External distribution channel specifics**: The output operating model mentions "external controlled share where allowed" but does not define the channel mechanics (governed link, email delivery, portal access). This is likely an implementation concern, but product should confirm the supported external distribution channels. | `REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md` §9 |
| 5 | **Recall permission model**: This analysis introduces `recall` as an exceptional post-publish action (§7.5). The canonical docs do not explicitly define recall semantics. Product should confirm whether recall is a required capability and what permission level it requires. | Derived from §7.5 |

---

## 10. Packet output

- **Status**: completed
- **Completed**:
  - Normalized publish lifecycle with 7 states, transition rules, and vocabulary normalization across collaboration architecture and output operating model (§1)
  - Review semantics with role model (4 roles), action taxonomy (5 actions), quality gates (6 gates), and shared review object schema (§2)
  - Cross-output consistency model covering reports, presentations, finance outputs, and results with shared properties and domain-specific extensions (§3)
  - Report-to-presentation promotion integration with publish lifecycle constraints, lineage preservation including `sourcePublishState`, and staleness model (§4)
  - Chat-driven editing integration with publish-state constraints, risk classification alignment, and `prepare_for_delivery` bridge (§5)
  - AI collaboration model per publish state with Decision W4-7 compliance (personal draft → shared proposal → team review) (§6)
  - Distribution governance with permission model, distribution rules, delivery actions, and post-publish governance including immutability, versioned supersession, and recall (§7)
  - Downstream dependency map covering 7 dependent packets/capabilities (§8)
- **Remaining**: none within packet scope
- **Blockers or risks**:
  - Finance `locked` state needs formal definition and product decision on whether it is finance-specific or shared (question #1)
  - Cross-output publish coordination for paired outputs needs product decision (question #3)
  - Recall semantics are introduced but not yet canonically defined — needs product confirmation (question #5)
- **Questions requiring escalation**:
  1. Should the finance `locked` state be a shared lifecycle extension or remain finance-specific? (§9.3 #1)
  2. Should paired outputs (report + presentation) support coordinated publish, or remain independently publishable? (§9.3 #3)
  3. Is output recall a required capability, and what permission model should govern it? (§9.3 #5)
