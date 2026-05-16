# Consultify Deep Research — Artifact Runtime, Enterprise Connectors, ROI Lifecycle, Activation (SUPERSEDED)

> **Status: SUPERSEDED.** This document contained the first-pass, high-level
> research for Artifact runtime, Enterprise connectors, ROI lifecycle, and
> Onboarding/Activation. All four sections have since been expanded into
> dedicated, authoritative deep-research documents dated 2026-04-18:
>
> - Artifact runtime → `DEEP_RESEARCH_ARTIFACT_RUNTIME_DETAILED_2026-04-18.md` (R-ARTIFACT-1..31)
> - Enterprise connectors → `DEEP_RESEARCH_ENTERPRISE_INTEGRATIONS_DETAILED_2026-04-18.md` (R-CONNECT-1..24)
> - ROI lifecycle → `DEEP_RESEARCH_ROI_LIFECYCLE_DETAILED_2026-04-18.md` (R-OUTCOME-1..24)
> - Onboarding / Activation → `DEEP_RESEARCH_ONBOARDING_ACTIVATION_DETAILED_2026-04-18.md` (R-ONBOARD-1..25)
>
> Every `R-ARTIFACT-*`, `R-CONNECT-*`, `R-OUTCOME-*`, and `R-ONBOARD-*` ID in
> this file is **historical** and must not be re-ticketed. Use the detailed
> documents above as canonical sources at plan-action time. Wording conflicts
> are resolved in favour of the detailed documents.
>
> The executive judgement / sequencing narrative near the top remains useful as
> context, but all numbered requirements are retired.

---

## Executive judgement

The user's prioritisation is directionally right, and the order also holds under external market evidence: the two capabilities that most clearly separate a serious enterprise AI system from an impressive demo are durable artifact runtime and trustworthy enterprise data access. Systems from Anthropic, Notion, Figma, and GitHub all converge on the same pattern: chat is not the product by itself; chat is the control surface for creating, reviewing, and iterating on persistent work objects with visible changes, versions, and reviewable history. In parallel, enterprise AI leaders such as Atlassian, Glean, and Microsoft now compete heavily on connectors, permissions, and freshness rather than on "one more model" alone.

That means Consultify should treat the next phase as three stacked contracts, not four unrelated feature tracks. The base layer is artifact runtime, because without it the assistant cannot become an editor. The second layer is connector trust, because without source-of-record access and ACL fidelity the runtime cannot create defensible work. The third layer is outcome instrumentation, because that is where Consultify becomes CFO-relevant rather than simply helpful. Activation is the packaging and telemetry layer that makes the first three visible within five minutes to a senior buyer. Real-time multiplayer should stay V2, because the engineering and reliability cost is materially higher than the value of adding one more collaborative surface before the artifact contract is stable.

My sequencing recommendation is therefore: first ship one artifact type end to end with review, audit, and export integrity; second ship honest connector control-plane and 3–5 high-yield connectors; third add the Initiative and KPI lifecycle on top of those evidence streams; fourth make CFO-grade activation the weekly product north star. This is the shortest path to a product that feels categorically different from general-purpose chat.

---

## Artifact runtime and chat-driven editing

The strongest benchmark signal is that the winning pattern is conversation plus durable artifact, not conversation alone. Claude Artifacts places substantial output in a dedicated pane; Notion's content model is block-based and typed; Figma combines version history, branching, review, merge, and conflict handling; Google Docs exposes suggestions, preview, accept/reject, and tracked import/export; Microsoft Copilot in Word and Excel is selection-aware and context-aware; GitHub's review model supports line comments, split/unified diff views, batching of accepted suggestions, and re-review. Kimi shows document comments plus side-by-side comparison, and Gamma proves that AI-generated decks/documents only become useful when they remain editable, collaborative, exportable, and measurable after generation.

For Consultify, the key architectural move is to stop treating notes, reports, decks, sheets, RACI tables, and decision docs as separate modules with chat attached, and instead treat them as typed views over a single Artifact runtime. In practice that means three domain objects, not one: Artifact as the persistent business object; ArtifactVersion as immutable content snapshots; and MutationProposal as the AI/user-reviewed change transaction. That model should carry business metadata that generic canvases usually omit: tenantId, dataClassification, retentionPolicy, approvalState, ownerId, permissionPolicyId, lineageRootId, parentArtifactId, derivedFromVersionId, exportRecords[], and evidenceRefs[]. Storing only rich text or HTML is the wrong abstraction; each artifact type should have a typed canonical schema or AST plus derived render formats, because slides, spreadsheets, and structured docs need stable node identities for diffs, validation, partial acceptance, lineage, and cross-artifact transformation.

The mutation contract should not be "replace whole file" and it should not be pure Markdown patching. The best analogue is a typed operation list against stable node IDs, with human-readable diff rendering layered on top. The reason is simple: Git-style diff is excellent for review, but artifact execution needs stronger semantics than text replacement. A slide move, a chart caption update, a table row insertion, a formula rewrite, or a RACI owner change should be represented as typed operations such as insertNode, moveNode, replaceTextRange, setCellFormula, changeProperty, or deleteNode, each carrying before, after, reason, citations, sourceRefs, and reversibleTxnId. This is the only approach that makes partial acceptance, formula validation, cross-module publishing, and one-click undo reliable.

Consultify should make "no silent writes" a hard runtime invariant. Every AI-originated change should create a visible proposal, every approved proposal should become exactly one undo transaction, and every exported deliverable should be tied to a specific approved version. Because Figma's branch/review/checkpoint model and Google Docs' suggestion flow both centre visible review before merge, Consultify should add enterprise governance on top of the same core idea: draft, ready_for_review, approved, published, archived, with role-specific gates for CFO, CEO, Legal, and CISO. Once approved, the historical version must become immutable; any change after approval creates a new version or branch, not an in-place rewrite. Exports intended for clients should carry a visible watermark, a version identifier, and a cryptographic hash stored in the audit log so the organisation can prove exactly what was sent.

For V2 collaboration, choose a CRDT-style replicated document model, not classical OT, as the formal requirement. Figma's own description of its multiplayer system is CRDT-inspired because the problem is not just simultaneous typing; it is independent concurrent replicas, eventual convergence, rich structure, branches, comments, and asynchronous merge across a large shared surface. Google's differential-sync style work is valuable as evidence that simpler sync patterns exist, but Consultify's end state is closer to distributed artifact editing with lineage and review than to a narrow synchronous text editor. The artifact contract should therefore assume replicated structured state, local or delayed edits, and explicit merge semantics from the start, even if V1 runs centrally and synchronously.

### Requirements — Artifact runtime

- **R-ARTIFACT-1 (P0)** — Every editable object must resolve to a first-class Artifact with stable identity, owner, permissions, classification, retention, lineage root, and approval state. **Acceptance:** a memo, deck, or RACI created in any module appears in one artifact library and remains searchable and versionable everywhere. **Risk if skipped:** split runtimes and copy-paste lineage loss.
- **R-ARTIFACT-2 (P0)** — Each artifact type must store canonical typed content, not only rendered text. **Acceptance:** slide reorder, table owner change, and formula mutation are represented as typed ops over stable node IDs. **Risk:** broken diffs, impossible partial accept, weak transform fidelity.
- **R-ARTIFACT-3 (P0)** — Every AI edit must be a MutationProposal with reason bundle, evidence refs, citations, reversible transaction ID, and before/after preview. **Acceptance:** the user can accept one op, a range of ops, or all ops. **Risk:** silent errors and low executive trust.
- **R-ARTIFACT-4 (P0)** — Review and governance must be native: comments, annotations, approvals, audit trail, immutable approved history, external share, and export integrity. **Acceptance:** every client-bound export maps to one approved version with verifiable provenance. **Risk:** weak auditability and compliance exposure.
- **R-ARTIFACT-5 (P1)** — Cross-artifact transformation and lineage must be typed. **Acceptance:** a memo can generate a 10-slide board deck and a numbers appendix while preserving parent-child lineage and source refs. **Risk:** manual copy-paste destroys reuse and traceability.
- **R-ARTIFACT-6 (P1)** — Editing must be focus-aware, selection-aware, and transaction-scoped. **Acceptance:** "change this selection", "move bullet two under bullet five", and "standardise all slide headers" produce deterministic previews and one-step undo. **Risk:** chat commands remain vague and brittle.
- **R-ARTIFACT-7 (P2)** — Real-time multi-user editing should adopt CRDT-style convergence semantics with presence, selections, and AI as a participant. **Acceptance:** two users plus AI can edit one artifact without state corruption; conflicts surface as merge choices where needed. **Risk:** V2 rebuild of the editing core.

### Two-week MVP — Artifact runtime

A practical two-week MVP is to ship one slide_deck artifact end to end: typed slide tree, split-view chat, stable slide IDs, mutation proposals, before/after diff, partial acceptance, version history, approval flow, export hash/watermark, and one lineage path from memo → deck. That would already demonstrate "Consultify edits real deliverables" rather than "Consultify suggests copy."

---

## Enterprise integrations and honest connectors

The connector benchmark is now unambiguous. Atlassian Rovo, Glean, and Microsoft 365 Copilot all treat connectors as a core product surface, not a side utility, and all three emphasise permission fidelity as a trust requirement. Microsoft's connector architecture is especially instructive because it now distinguishes synced connectors, which index content, from federated connectors, which fetch data in real time without indexing it into the tenant-wide index. That distinction matters directly for Consultify because it provides a clean product answer to the user's "zero silent storage" and "per-region residency" non-negotiables: some sources should be indexed only with explicit admin opt-in, and some should support live retrieval only.

The minimum 30-connector catalogue for enterprise consulting is sound, but the shipping priority should be grouped by business workflow, not by vanity breadth. P0 should cover: Gmail, Google Drive, Google Calendar, Outlook, OneDrive, SharePoint, Slack, Salesforce, Jira, Confluence, Notion, HubSpot, and Microsoft Teams. Those sources collectively cover executive communication, doc stores, collaboration channels, CRM pipeline, and delivery execution. P1 should be: Asana, monday.com, Linear, ClickUp, GitHub, GitLab, Box, Dropbox, Zendesk, Intercom, Figma, Miro, and Zoom. P2 should be: Lattice, BambooHR, Workday, Azure DevOps, Google Chat, and other long-tail systems specific to the customer base. That mix also matches what the leading connector ecosystems expose most visibly today.

Auth and freshness patterns are highly repeatable across the priority set. Google Workspace sources use OAuth plus watch/push mechanics for Gmail, Drive, and Calendar. Microsoft Graph sources use delegated or application permissions, change notifications, and delta queries, with newer selected scopes that allow access to specific sites, lists, items, folders, or files rather than blanket tenant-wide access. Slack uses scope-based OAuth, near-real-time Events API delivery, and SCIM for higher enterprise plans. HubSpot, Notion, Asana, monday.com, Linear, ClickUp, Dropbox, Box, GitLab, GitHub, Figma, Zoom, and BambooHR all expose some mix of OAuth and webhook/event-driven freshness, while Zendesk mixes webhooks with incremental export for practical sync. Workday remains a high-effort integration because much of its detailed public API documentation is customer- or partner-gated.

The control-plane requirement is more important than the raw connector count. Consultify should enforce a connector state taxonomy visible to the user at all times: supported_in_chat, supported_in_settings_only, roadmap, and unsupported. The chat attachment picker must show only supported_in_chat; settings can show broader options; roadmap items can collect demand; and every successful connection should end with a validation screen that proves the system can actually enumerate accessible sample items. This is the practical cure for "ghost capability" UI. It also aligns with how Slack asks users to evaluate requested permissions before install and how enterprise connector products expose admin connection management and permissions.

Identity lifecycle must be enterprise-grade from day one. OAuth 2.1 should be the baseline for user-level auth, with PKCE mandatory, no implicit grant, HTTPS everywhere, confidential handling of refresh tokens, and rotation or sender-constrained replay protection for public flows. Enterprise tier should require SAML or OIDC SSO plus SCIM for user and group lifecycle. Google Workspace already supports both SAML-based and OIDC-based SSO; SCIM is the standard protocol for identity automation; Microsoft Entra and Slack both support SCIM-based provisioning for eligible plans. Consultify should therefore implement a unified identity contract covering SSO, SCIM, token encryption at rest, rotation, revocation, dead-man suspension, and disconnect-triggered purge of all derived caches and embeddings.

ACL propagation is non-negotiable, and the benchmark players all say so explicitly. Microsoft Graph connectors attach ACLs to external items and use permission-based filtering. Rovo says it respects existing permissions and synchronises with connector permission settings. Glean states that it fetches data and permissions from enterprise sources and, for Google Drive specifically, enforces permissions with narrow documented exceptions. For Consultify, the only safe design is: import source ACLs, preserve them at index time, re-check them at query time, detect ACL drift, and keep deny semantics stronger than allow semantics. Critically, SharePoint and OneDrive now have "Selected" scopes that make least-privilege connection design possible; Consultify should use those where the customer accepts a narrower install rather than defaulting to *.Read.All.

### Requirements — Enterprise integrations

- **R-CONNECT-1 (P0)** — Build two connector modes into the contract: indexed and federated. **Acceptance:** every connector setup page states whether content is indexed, cached, or queried live. **Risk if skipped:** silent storage and avoidable CISO objections.
- **R-CONNECT-2 (P0)** — Use OAuth 2.1 + PKCE for user installs, least-privilege scopes, admin install only where needed, and no implicit grant. **Acceptance:** scope request screens differ by connector capability and never request admin scopes when delegated read is sufficient. **Risk:** security friction and lower install conversion.
- **R-CONNECT-3 (P0)** — Enterprise identity must include SSO and SCIM. **Acceptance:** a tenant can turn on SAML or OIDC SSO and automatically provision/deprovision users and groups. **Risk:** enterprise onboarding blockers.
- **R-CONNECT-4 (P0)** — Freshness must be explicit per source. **Acceptance:** Gmail shows watch renewal and <5 minute target; Outlook/Graph subscriptions renew before expiry; Drive/Calendar/Notion/Slack changes appear on documented schedules. **Risk:** stale answers masquerading as current truth.
- **R-CONNECT-5 (P0)** — Zero ACL leak. **Acceptance:** a user query never returns content they cannot access in the source, and ACL changes in the source are reflected after drift-check or change event processing. **Risk:** existential trust loss.
- **R-CONNECT-6 (P0)** — Disconnect equals purge. **Acceptance:** after disconnect, access stops immediately and derived embeddings/cache are deleted on the policy clock with audit evidence. **Risk:** non-compliance with data-minimisation and retention commitments.
- **R-CONNECT-7 (P1)** — Honest UX is part of the runtime contract. **Acceptance:** chat only advertises connectors that truly work in chat, and a successful connection ends with a validated sample inventory. **Risk:** "toastware" perception.
- **R-CONNECT-8 (P1)** — Admin governance must show connector inventory, granted scopes, sync lag, error rate, residency target, DLP policies, and ingestion cost. **Acceptance:** org admins can see who connected what and kill it tenant-wide. **Risk:** admins will not approve broad rollout.

### Build vs buy — Enterprise integrations

On build-versus-buy, the right answer is build the control plane, be pragmatic on the long tail. Consultify should own token vaulting, scope policy, connector state taxonomy, ACL graph, purge workflow, residency enforcement, and the user-visible governance surface. Those are where trust is won or lost. For non-differentiating long-tail adapters, selectively buying or partnering can be rational, but only if the external adapter can conform to Consultify's ACL, purge, audit, and residency contracts.

### Two-week MVP — Enterprise integrations

The two-week MVP should not chase all 30 connectors. It should ship a cohort bundle that covers the majority of actual senior-buyer workflows: email, shared docs, chat, CRM, and work graph. For Microsoft-heavy pilots that means Outlook + SharePoint + OneDrive + Slack/Teams + Salesforce; for Google-heavy pilots it means Gmail + Google Drive + Google Calendar + Slack + Salesforce, with Jira/Confluence next if delivery-execution visibility is the sales wedge.

---

## ROI lifecycle and outcome instrumentation

The right first-class entity is Initiative, with Outcome as the measured result and evidence bundle attached to it. Treating "outcome" alone as the primary object would lose the lifecycle logic that matters most to a consulting system: proposal, funding, execution, measurement, sustain, expand, or kill. That recommendation is consistent with transformation measurement practice from McKinsey & Company, which emphasises baseline-linked steering KPIs and P&L relevance, and with more recent work from Boston Consulting Group and Bain & Company showing that AI ROI is not created by adoption alone but by focused value selection, sequencing, and measurement maturity.

The minimal viable schema should therefore include: id, name, tenantId, ownerId, sponsorId, measurerId, status, baselineSnapshotId, targetKpiIds[], secondaryKpiIds[], budget, actualCost, assumptionSetId, discountRatePolicyId, riskState, startDate, targetDate, persistenceWindow, pricingEligibility, linkedDecisionIds[], linkedTaskIds[], linkedArtifactIds[], linkedResearchSessionIds[], and lineageParentId. Lifecycle states should be: scoped, proposed, approved, funded, in_execution, delivered, measured, sustained, expanded, paused, killed, and expired. This gives Consultify a true system-of-record for value delivery rather than a loose pile of notes and dashboards.

The most important design choice is that baseline is sticky. Once a baseline is signed off, it cannot be silently edited; it can only be superseded via formal change order with cause, approver, timestamp, and redlined impact on forecast. That is not overkill. If the platform is going to answer questions like "which initiative underperformed versus baseline?" or "show me proof for the board that Q1 commitments delivered", the platform needs controls that are compatible with internal-control thinking. The SEC's SOX Section 404 rules and the PCAOB's AS 2201 model both centre authorised, reviewable, reliable controls over records tied to financial reporting or management assessment. Consultify does not need to become an ERP, but if its ROI views are CFO-facing, the provenance and control expectations are materially closer to ICFR than to casual product analytics.

KPI measurement therefore needs full provenance. Each measurement record should carry who, when, from where, method, confidence, sourceType, and validationState. Manual self-reported entries should be allowed, but they must be stamped as self_reported and blocked from case-study eligibility unless later corroborated. Consultify's AI can propose KPIs, formulas, and forecasts, but it should never sign off a baseline, submit a formal measurement, or approve a forecasting revision. The system should also support primary versus secondary KPIs, drift detection, and persistence windows of at least six months after delivery, because persistence is the difference between "temporary spike" and "transformation result".

The ROI engine should be flexible rather than dogmatic. At minimum it should support: simple ROI, payback period, NPV, IRR, and benefit-cost ratio; cost buckets for consultant spend, internal FTE, AI/LLM consumption, external technology, and opportunity cost; value buckets for revenue uplift, cost savings, productivity hours, risk avoidance, and explicitly labelled soft value; plus variance analysis between forecast and actual. The reason is practical: McKinsey argues for KPI architectures linked to ROIC and P&L drivers, BCG's work on measurement stresses methodological completeness when attribution is hard, and Bain's measurement work shows that stronger measurement maturity correlates with better business outcomes. A one-formula dashboard would be too weak and too easy to game.

The AI layer should become a trust-bearing portfolio copilot, not just a chat bot with an initiative noun added to the prompt. That means every initiative answer should include a trust bundle: latest measurement dates, data sources, baseline version, confidence score, missing data flags, and whether any metrics are self-reported. The monthly "outcome brief" for CFO and the "top five at risk" portfolio summary for a transformation officer are high-value surfaces because they compress many modules into one financially legible story. Case-study generation should be a real pipeline, not marketing garnish: candidate detection, anonymisation, approval, publishability score, and downstream conversion tracking.

### Requirements — ROI lifecycle

- **R-OUTCOME-1 (P0)** — Add Initiative as a first-class entity with lifecycle state, budget, owner, sponsor, measurer, relationships, and lineage. **Acceptance:** every decision, task, artifact, and report can link to an initiative. **Risk:** no system-level accountability.
- **R-OUTCOME-2 (P0)** — Baseline must be a signed snapshot, not a mutable field. **Acceptance:** changing a baseline requires a formal change order with approver and impact trace. **Risk:** every ROI claim becomes contestable.
- **R-OUTCOME-3 (P0)** — Every KPI measurement must carry provenance and confidence. **Acceptance:** the system can distinguish integrated, calculated, manually entered, and self-reported metrics in every dashboard and export. **Risk:** "CFO-defensible" becomes impossible.
- **R-OUTCOME-4 (P0)** — ROI calculation must support multiple finance methods and variance analysis. **Acceptance:** a tenant can set discount-rate policy and compare forecast versus actual at initiative and portfolio level. **Risk:** finance leaders will distrust simplistic ROI math.
- **R-OUTCOME-5 (P1)** — AI may draft initiatives, KPIs, and forecasts, but human actors must sign baseline, measurement, and approval checkpoints. **Acceptance:** AI outputs are marked proposed until a named user signs them. **Risk:** control failure and unclear accountability.
- **R-OUTCOME-6 (P1)** — Executive surfaces must include portfolio, timeline, financial, risk, persistence, and expansion views. **Acceptance:** one board-pack export can answer "what did we spend, what did we get, what is holding?" **Risk:** outcome data remains trapped in ops views.
- **R-OUTCOME-7 (P1)** — Case-study generation should be productised with anonymisation and approval. **Acceptance:** an initiative can move from sustained success to redactable case-study draft in one governed flow. **Risk:** moat evidence stays anecdotal.
- **R-OUTCOME-8 (P2)** — Outcome-based pricing should be supported as a contract option, but not as the default monetisation model. **Acceptance:** success-fee contracts are possible only where baseline, attribution, and persistence thresholds are met. **Risk:** premature adoption creates procurement friction and margin volatility.

### Pricing recommendation

On the explicit pricing question, my recommendation is **no** to pure default outcome-based pricing for Consultify in the near term, **yes** to a hybrid model later. Outcome-based pricing is attractive because it aligns the product with client results, but the same sources that celebrate it also highlight attribution, procurement, and governance complexity. A better path is a base platform fee plus optional capped success fees on tightly attributable initiatives once 2–3 customer cohorts prove that Consultify's measurement discipline is robust enough to survive audit-level scrutiny.

### Two-week MVP — ROI lifecycle

The two-week MVP should focus on the first ten initiatives through a complete, if mostly manual, lifecycle: signed baseline capture, three KPI types, budget versus actual, one financial formula set, monthly outcome brief, portfolio dashboard, and persistence scheduling. That is enough to prove the contract and create the first credible case studies.

---

## Onboarding and first-five-minute activation

An empty chat with "What can I help with?" is the wrong first-run experience for Consultify's buyer profile. Senior buyers do not want openness first; they want guided proof of differentiated value first. Product evidence from Stripe, Notion's template system, and activation practice documented by Amplitude all point in the same direction: polished onboarding minimises early friction, time-to-activate matters, and activation should be measured by concrete cohort-based behaviours rather than by generic signups or page views. Guided enterprise onboarding examples from HubSpot and Salesforce also show that role-based tracks and structured learning surfaces still matter when the product is powerful and multi-step.

Consultify's activation design should therefore be persona-specific from the first screen. The "aha moment" should be explicit, evented, and tied to a single weekly north-star metric per persona. For a CEO, the aha moment is: within five minutes, generated and reviewed a sourced strategic memo or board outline built on a realistic company scenario. For a CFO: saw a baseline-to-ROI view, edited an assumption, and watched the variance change with provenance clearly attached. For a COO: viewed a live execution heatmap with top blockers and next actions. For a transformation officer: opened a portfolio of initiatives with risk, owner, timeline, and persistence status. For a CISO: saw exactly what data is connected, which scopes are granted, where it is stored, and how permissions are enforced. Each of those moments is product-specific and defensible.

The pre-populated demo workspace is not optional; it is the bridge between complex product capability and first-session comprehension. Notion's template ecosystem proves how much structure reduces first-run anxiety. Figma's organisational setup guidance shows that shared libraries, teams, and permissions shape comprehension from the beginning. Portfolio and goal tools from Asana, monday.com, and Adobe Workfront demonstrate that executives understand value faster when they land in a coherent portfolio view rather than individual objects. For Consultify, that means each persona needs a curated demo workspace with realistic, anonymised consulting data, and the path from demo data to customer data must be no more than three clicks.

Progressive disclosure should be built into the information architecture, not solved with modal spam. New users should see only the first three actions that matter to their role; once they achieve first proof, the product can reveal deeper surfaces such as advanced connectors, artifact governance, and portfolio analytics. This mirrors the logic behind template-first onboarding, workspace-level defaults, and guided setup flows in modern work products. At the same time, there should be a "show me everything" escape hatch for high-agency demo situations. Senior buyers often want the curated path first, but sales engineers and power users want a fast route to the full map.

Trust-building must appear in the first session, not be buried in a later security page. GDPR's data-minimisation and storage-limitation principles, plus the operational expectations encoded in SOC 2, mean the product should surface data classification, residency, indexing mode, scope requests, and "how we use AI" in plain language early. The most persuasive trust mechanism is not a badge alone; it is an explainable control surface that shows sources, permissions, and handling mode per feature. That is especially important for the CISO persona but also materially helps the CFO and CEO, because it reframes the system from "clever assistant" to "governed execution environment."

The telemetry layer should be comprehensive and operational. Amplitude's guidance on time-to-activate and cohort analysis is the right mental model: every onboarding step, success ritual, and drop-off path must be evented and queryable daily. For Consultify, the critical events are not generic product events but role-specific proof events such as roi_demo_viewed, baseline_signed, first_verified_answer, mutation_proposal_approved, connector_validated, portfolio_risk_view_opened, and executive_pack_exported. Weekly digest and re-engagement flows should then be keyed off actual missing proof steps rather than off simple inactivity counts.

### Requirements — Onboarding / Activation

- **R-ONBOARD-1 (P0)** — Signup must branch into role-specific entry, not generic welcome. **Acceptance:** CEO, CFO, COO, transformation officer, and CISO each land on a different first screen with different first actions. **Risk:** the product feels like another generic chat surface.
- **R-ONBOARD-2 (P0)** — Every first-run path must start from a pre-populated demo workspace. **Acceptance:** each persona sees realistic artefacts, KPIs, and workflows before connecting any live data. **Risk:** no aha moment before patience runs out.
- **R-ONBOARD-3 (P0)** — Demo-to-real transition must be under three clicks. **Acceptance:** the user can replace demo data with connector or upload flow without losing the narrative of what the product is doing. **Risk:** demo remains a dead-end tour.
- **R-ONBOARD-4 (P0)** — Activation must be measured by one north-star behavioural metric per persona and reviewed weekly. **Acceptance:** CS and product can inspect activation funnels by role and cohort every day. **Risk:** onboarding debates stay opinion-based.
- **R-ONBOARD-5 (P1)** — Progressive disclosure must be inline and behavioural, not modal-heavy. **Acceptance:** advanced features unlock after proof events, while a power-user mode exposes the full map immediately. **Risk:** either overwhelm or under-sell.
- **R-ONBOARD-6 (P1)** — Trust must be part of onboarding: scopes, residency, indexing mode, and source citations shown in plain language. **Acceptance:** the CISO path can validate control posture in-session. **Risk:** late-stage security objections.
- **R-ONBOARD-7 (P1)** — First success rituals must celebrate real outcomes only. **Acceptance:** "First verified answer", "First execution approved", and "First outcome tracked" appear only after actual product proof. **Risk:** enterprise users detect fake gamification instantly.
- **R-ONBOARD-8 (P2)** — Re-engagement should be role-specific and triggered by missing proof states, not just inactivity. **Acceptance:** CFO win-back pushes ROI proof, CISO win-back pushes permissions/governance proof. **Risk:** low-quality lifecycle messaging.

### Two-week MVP — Activation

The fastest activation wedge is the CFO path, because it connects most directly to Consultify's moat. A good two-week activation MVP is: role selection → CFO demo workspace → one-click ROI dashboard with baseline and target KPIs → one editable initiative assumption → one generated and cited "outcome brief" → one externally shareable board-pack export. If that entire path takes under five minutes and every step is evented, the product team will finally have a crisp, decision-grade activation metric.

---

## Integrated delivery sequence

The right way to operationalise these findings is to run one integrated two-week programme, not four disconnected discovery tracks.

- **Days 1–3** — Lock the domain contracts: Artifact, ArtifactVersion, MutationProposal, Initiative, connector state taxonomy, scope policy, and KPI measurement provenance.
- **Days 4–7** — Build the first complete artifact lane on slide_deck (diff/approval/export integrity), while the platform team ships the connector control plane with honest UI and one live document/email pair.
- **Days 8–10** — Add the minimal Initiative baseline/KPI/ROI model and the first CFO outcome brief.
- **Days 11–14** — Wire the persona-specific onboarding, demo workspace, telemetry funnel, and post-connect validation.

That sequence makes the system progressively more truthful: first it can edit, then it can read real data safely, then it can prove value, then it can show all of that fast enough to matter in a pilot.

## Strategic implication

Consultify should not try to "win AI" in the abstract. It should win controlled artifact execution with enterprise-source truth and CFO-visible outcomes. If those three contracts are strong, activation becomes easier, case studies become credible, and pricing power increases. If those three contracts are weak, no amount of surface polish, multimodality, or additional prompting will stop the product from being categorised as an expensive general-purpose assistant.

---

## Requirements inventory (flat list)

Use this as the ticket seed when we turn this document into a plan.

| ID | Priority | One-liner |
| --- | --- | --- |
| R-ARTIFACT-1 | P0 | First-class Artifact entity with identity, permissions, classification, retention, lineage, approval |
| R-ARTIFACT-2 | P0 | Typed canonical content per artifact type (stable node IDs), not rendered text only |
| R-ARTIFACT-3 | P0 | MutationProposal contract — reason, evidence, citations, reversible txn, partial accept |
| R-ARTIFACT-4 | P0 | Native review/governance — approvals, audit, immutable history, export integrity (hash + watermark) |
| R-ARTIFACT-5 | P1 | Typed cross-artifact transformation + lineage (memo → deck → numbers) |
| R-ARTIFACT-6 | P1 | Focus-aware, selection-aware, transaction-scoped editing |
| R-ARTIFACT-7 | P2 | CRDT-style real-time multi-user with AI as participant |
| R-CONNECT-1 | P0 | Indexed vs federated connector modes, explicit per source |
| R-CONNECT-2 | P0 | OAuth 2.1 + PKCE, least-privilege scopes, no implicit grant |
| R-CONNECT-3 | P0 | SSO (SAML/OIDC) + SCIM for enterprise identity |
| R-CONNECT-4 | P0 | Explicit per-source freshness SLA + webhooks/delta |
| R-CONNECT-5 | P0 | ACL import, query-time enforcement, drift detection, deny > allow |
| R-CONNECT-6 | P0 | Disconnect = purge (cache + embeddings + audit evidence) |
| R-CONNECT-7 | P1 | Honest UX — connector state taxonomy + post-connect validation |
| R-CONNECT-8 | P1 | Admin governance surface (inventory, scopes, lag, errors, residency, DLP, cost) |
| R-OUTCOME-1 | P0 | Initiative as first-class entity + full lifecycle states |
| R-OUTCOME-2 | P0 | Sticky baseline (signed snapshot, change-order protocol) |
| R-OUTCOME-3 | P0 | KPI measurement provenance + confidence per record |
| R-OUTCOME-4 | P0 | ROI engine — multiple methods, variance analysis, policy-configurable discount rate |
| R-OUTCOME-5 | P1 | AI proposes, humans sign — baseline/measurement/approval signatures are user-actor |
| R-OUTCOME-6 | P1 | Executive surfaces — portfolio / timeline / financial / risk / persistence / expansion |
| R-OUTCOME-7 | P1 | Case-study pipeline (candidate → anonymisation → approval → publish) |
| R-OUTCOME-8 | P2 | Outcome-based pricing as contract option, not default |
| R-ONBOARD-1 | P0 | Role-specific entry (CEO/CFO/COO/TO/CISO), distinct first actions |
| R-ONBOARD-2 | P0 | Pre-populated demo workspace per persona |
| R-ONBOARD-3 | P0 | Demo-to-real transition ≤ 3 clicks |
| R-ONBOARD-4 | P0 | Activation = one north-star behavioural metric per persona, weekly |
| R-ONBOARD-5 | P1 | Progressive disclosure inline + power-user escape hatch |
| R-ONBOARD-6 | P1 | Trust-in-onboarding (scopes, residency, indexing mode, citations) |
| R-ONBOARD-7 | P1 | First success rituals tied to real proof events only |
| R-ONBOARD-8 | P2 | Re-engagement by missing proof states, role-specific message |

**Totals:** 31 requirements — 16 × P0, 12 × P1, 3 × P2.

---

## What this document is NOT

- Not a ticket backlog (that's the next pass — we convert R-* into V9+/V10 tickets, flags, tests, CI invariants).
- Not a final schema (data model proposals here are directional; domain team validates before code).
- Not a vendor/tool decision (no "use Liveblocks", "use Nango" — those are separate build-vs-buy docs).
- Not a roadmap commitment (MVPs named above are capacity-free; sequencing resolved in plan pass).

## Next step

Turn this document into the V10 (or V9 Wave D) implementation plan:
1. Assign each `R-*` a ticket ID and block.
2. Register feature flags per requirement (same contract as current V9 flags).
3. Draft dev plans per surface (`ARTIFACT_RUNTIME_*`, `ENTERPRISE_CONNECTORS_*`, `ROI_LIFECYCLE_*`, `ACTIVATION_ONBOARDING_*`).
4. Extend `chatV9FeatureFlags.test.ts` CI invariants to cover the new surfaces.
5. Update telemetry contract with new events (proof events, connector events, outcome events).
