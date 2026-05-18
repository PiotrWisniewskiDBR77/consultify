# Onboarding + First-5-Minutes Activation Requirements — Consultify (detailed)

> **Status:** source research input, captured 2026-04-18. Do not edit in place.
> **Scope:** answers the Onboarding / First-5-Minutes Activation deep research
> prompt (Prompt B of the second research batch) with the **full, detailed**
> specification. Supersedes the shorter Onboarding section (R-ONBOARD-1…8)
> inside `DEEP_RESEARCH_ARTIFACT_CONNECTORS_ROI_ONBOARDING_2026-04-18.md`.
>
> **ID reconciliation required at plan-action time:**
> - `R-ONBOARD-1…8` from the earlier Artifact/Connectors/ROI/Onboarding research
>   doc is **subsumed** by this document's `R-ONBOARD-1…25`. IDs collide.
> - At plan-action time, this document is authoritative for all `R-ONBOARD-*`
>   IDs. The earlier rows close as historical placeholders.
>
> Completes the research corpus. Complements the Reasoning, Feedback/Learning,
> Agentic Chat Runtime (full), ROI Lifecycle, Enterprise Integrations, Deep
> Research/Reporting, and Artifact Runtime research documents dated 2026-04-18.
>
> **Next step:** consolidate all nine research documents into the canonical
> `CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md` (tickets + flags + per-block dev
> plans + telemetry extensions + CI invariants).

---

## Executive stance and benchmark readout

The benchmark set spans OpenAI, Anthropic, Glean, Atlassian, Microsoft, Notion, Gamma, Cursor, GitHub, Harvey, Hebbia, Perplexity, and Linear. Across their official onboarding, admin, security, and help materials, the same macro-pattern appears repeatedly:

> **Enterprise AI gets adopted when it is attached to real organisational context, rolled out with governance, and measured against actual work outcomes — not when it begins as generic experimentation.**

### Why generic "chat with some sample prompts" onboarding fails for enterprise buyers

It does not cross the **ROI boundary**. McKinsey's 2025 global AI survey found that while AI use is widespread, most organisations have not embedded AI deeply enough into workflows to realise material enterprise-level benefits. Only 39% reported EBIT impact at enterprise level. High performers were more likely to redesign workflows, define human validation rules, and track AI KPIs.

OpenAI's 2025 enterprise report shows the same pattern from usage data: **deeper use of repeatable workflow constructs** (Projects, GPTs, reasoning, data analysis) correlates with higher reported time savings, while many enterprise users still never touch the most capable features.

**Exploration is common; governed workflow adoption is what creates visible value.**

### Benchmark scan — what each gets right vs what it misses for consulting

| Benchmark | What it gets right | What it still misses for consulting |
| --- | --- | --- |
| **ChatGPT Enterprise onboarding** | Strong admin analytics, memory controls, spend controls, compliance logs, company knowledge, app / connector governance | No explicit first-run persona split for Partner vs CFO vs CISO; no built-in requirement that first value be a governed consulting deliverable |
| **Claude Projects** | Strong project-scoped knowledge, sharing model, organisational visibility controls, retention / audit primitives | Projects are powerful work containers, but the first-run loop is project-centric rather than buyer-persona-centric |
| **Glean first-install** | Strong connector validation, ACL fidelity, minimal scopes, test-group rollout, search trust via citations | First-install value is slowed by crawl and indexing; cannot be the sole five-minute activation path |
| **Rovo onboarding** | Strong admin / end-user split, connector emphasis, knowledge scoping, permission inheritance | Starts from search/chat/agents, not from a governed consulting artifact with approval and export integrity |
| **Microsoft 365 Copilot rollout** | Strong phased rollout strategy, champions, role-based agents, AI council, dashboarding, governance | Excellent programme-level guidance, but not a five-minute executive conversion loop |
| **Notion AI setup** | Strong fast context capture, templates, connected-app search, meeting-note citations + consent flows | Good at turning context into notes and search answers; weaker at first-session approval-gated executive deliverables |
| **Gamma first-deck flow** | Excellent speed to first visually polished output from prompt, paste, or import | Optimises for deck generation, not evidence-bound executive work with approval and provenance |
| **Cursor first session** | Excellent "first useful change" model anchored in a real codebase, privacy / governance options | Demonstrates fast contextual value, but on a developer workflow |
| **GitHub Copilot enterprise rollout** | Strong policy controls, audit logs, metrics, rollout-at-scale playbooks, review surfaces | Strong governance and adoption measurement, but tuned to software engineering |
| **Harvey onboarding** | Strong role-based learning, auditability, usage analytics, data-region controls, approvals, professional-services trust posture | Closer than most to consulting needs, but domain language and default artefacts are legal-first |
| **Hebbia onboarding** | Strong source-linked outputs, transparency, human-in-the-loop posture, high-stakes document synthesis | Very close on evidence and workflow depth, but not framed as multi-persona enterprise consulting first-run flow |
| **Perplexity Enterprise** | Strong internal knowledge search, connector permissions, admin controls, no-training posture for enterprise data | Retrieval is strong; first-run governed mutation and export-integrity surfacing are weaker |
| **Linear onboarding** | Strong role-based guides, fast workspace setup, work-in-real-context posture | Helpful example of role-based routing, but not an AI trust-and-approval onboarding model |

### The three architectural primitives Consultify needs

1. **Persona-aware first-run flow.** Partner, CFO, CEO, COO, CISO, Transformation Officer must each hit a different first-run choreography, artifact type, connector priority, trust language, and reviewer path.
2. **Real deliverable aha-moment within five minutes.** Activation means the buyer **co-produces a real artifact from their own data** and can approve it, save it, and act on it within five minutes.
3. **Trust-first disclosure before engagement.** Residency, ACL inheritance, trust mode, retention, cost caps, and learning consent must appear **before** the buyer takes the first trust-sensitive action — not behind later settings.

---

## The five-minute clock

**Definition of activation (narrow and operational):** a real-data artifact is generated, provenance is visible, an approval gate is crossed, and the artifact is saved into a reusable library state **before 05:00**.

Anything less is **not activation** — only onboarding progress.

### Canonical second-by-second spine

| Time | System obligation |
| --- | --- |
| **00:00–00:15** | Trust banner before any prompt box or connector CTA: residency, retention default, no demo-data substitution, learning default, cost-cap status, export-integrity policy |
| **00:15–00:30** | Sign-in or SSO return complete; infer likely persona from invite, title, or group |
| **00:30–00:45** | Ask for persona confirmation with one-click override |
| **00:45–01:00** | Create persona workspace shell, artifact template, approval route, library folder **in background** |
| **01:00–01:20** | Offer **one** primary connector or secure-upload path only, with explicit trust mode and scopes |
| **01:20–01:45** | Finish OAuth or upload fallback |
| **01:45–02:00** | Validate connector or upload and **show what was actually found** — never a bare success toast |
| **02:00–02:20** | Pre-seed an artifact objective from persona + source type |
| **02:20–02:45** | Generate first draft against real data with evidence anchors |
| **02:45–03:00** | Reveal provenance panel and evidence-completeness state |
| **03:00–03:20** | Show proposal envelope or change diff |
| **03:20–03:45** | Require approve / edit / reject decision and log approval event |
| **03:45–04:00** | Surface audit trail, reviewer identity, manifest metadata |
| **04:00–04:30** | Save artifact to library with reusable template fingerprint |
| **04:30–05:00** | Offer next-best-action: export, invite teammate, deeper research, attach second connector |

### Persona-specific minute-by-minute targets

| Persona | Minute 0–1 | Minute 1–2 | Minute 2–3 | Minute 3–4 | Minute 4–5 |
| --- | --- | --- | --- | --- | --- |
| **Partner** | SSO, persona confirm, "engagement context" prompt. Skip admin screens | Bootstrap engagement workspace; default connector = Salesforce if tenant-authorised, else Gmail, else SharePoint | Generate first steering note or slide outline from actual client material | Review gate with provenance + "client-share safe?" indicator | Save to Engagement Library; next-best-action = "turn into deck" or "invite manager" |
| **CFO** | SSO, confirm finance role, show finance-trust banner | Bootstrap finance workspace; default path = upload or SharePoint finance folder | Generate variance memo + supporting spreadsheet from actuals | Approval gate with cell lineage + audit trail | Save to Finance Library; next-best-action = signed PDF export or attach board pack |
| **CEO** | SSO, confirm executive role, ask for board/transformation context | Bootstrap executive workspace; default connector = board pack / strategy folder | Generate one-page decision brief from actual board + transformation material | Provenance + unresolved-assumption panel | Save to Executive Library; next-best-action = board note export or invite chief of staff |
| **COO** | SSO, confirm ops role, ask for cadence / issue context | Bootstrap ops workspace; default connector = SharePoint operations pack | Generate operating review memo + RACI or action register | Approval gate with owner/date/dependency diffs | Save to Operating System Library; next-best-action = publish action tracker |
| **CISO** | SSO, confirm security role, **force admin-first route** | Bootstrap restricted workspace; default connector = security document repository in admin-reviewed trust mode | Generate control-gap memo or evidence register **only after admin scopes acknowledged** | Approval gate with audit event, reviewer role, export restrictions | Save to Security Library; next-best-action = review admin policy or attach second trusted source |
| **Transformation Officer** | SSO, confirm transformation role, ask for PMO context | Bootstrap transformation workspace; default connector = SharePoint PMO site → Gmail → Salesforce if account-led | Generate programme decision pack or evidence-backed status brief | Provenance + assumption list + approval gate | Save to Transformation Library; next-best-action = spawn RAID log or invite workstream lead |

---

## Persona-specific aha-moments

Consultify inherits the trust vocabulary from the high-stakes benchmarks (Hebbia, Harvey, Notion, OpenAI, Anthropic) but binds it to **consulting artifacts** rather than generic chat outcomes.

| Persona | "Click that converts" moment | Artifact type | Evidence sources required for credibility | Trust signal that must surface | Numeric KPI target |
| --- | --- | --- | --- | --- | --- |
| **Partner** | "Turn this client thread and workstream status into a steering update I can send." | `slide_deck` or `decision_doc` | Client email thread, SOW excerpt, latest RAID log, workstream notes, latest steering pack | Provenance panel, reviewer gate, source freshness | Median time-to-aha ≤ 210s; activation ≥ 45%; connector-attach ≥ 50%; approved-rate ≥ 40% |
| **CFO** | "Use last quarter's actuals to draft a variance memo I can approve and export." | `memo` + `spreadsheet` | Actuals workbook, GL extract, board pack, prior-quarter comparator, note on one-off adjustments | **Cell-level lineage, manifest hash, SHA-256 on export, review gate** | Median ≤ 180s; activation ≥ 55%; connector-attach ≥ 60%; approved-rate ≥ 45% |
| **CEO** | "Summarise what matters, what changed, and what decision I need to make." | `decision_doc` | Board pack, transformation dashboard, sponsor memo, prior decision log | Provenance panel, freshness badge, unresolved-assumptions list | Median ≤ 240s; activation ≥ 35%; connector-attach ≥ 40%; approved-rate ≥ 30% |
| **COO** | "Show me the issues, owners, dates, and operating implications in one pack." | `RACI` + `memo` | Ops review deck, KPI file, ticket backlog summary, meeting notes, action log | Change preview on owners/dates, approval gate, audit trail entry | Median ≤ 240s; activation ≥ 42%; connector-attach ≥ 55%; approved-rate ≥ 38% |
| **CISO** | "Show me the control gaps and supporting evidence without breaking policy." | `research_report` or `memo` + spreadsheet evidence register | Policies, prior audits, exception logs, control library, IAM/SIEM extracts, data-classification policy | Restricted-workspace badge, ACL inheritance banner, review gate, immutable audit event | Median ≤ 300s; activation ≥ 30%; connector-attach ≥ 30%; approved-rate ≥ 35% |
| **Transformation Officer** | "Convert scattered PMO material into the decision pack for the next steering forum." | `research_report` or `decision_doc` | Charter, RAID, workstream statuses, dependency map, prior steering actions, sponsor email | Manifest hash, source-policy banner, evidence coverage score | Median ≤ 240s; activation ≥ 45%; connector-attach ≥ 50%; approved-rate ≥ 40% |

---

## Trust-first disclosure matrix

| Trust-sensitive action | Must be shown before the action | Hard gate | Related dependency |
| --- | --- | --- | --- |
| **Connecting first data source** | Trust mode (read-only indexed / read-through on demand / restricted test group / admin-reviewed), exact scopes, ACL inheritance, retention, disconnect-purge contract, region of processing, whether indexing is immediate or delayed | User must acknowledge scopes + retention; CISO path requires admin confirmation | `R-CONNECT-*` |
| **First AI-originated mutation** | Proposal envelope with intended artifact, source set, mutation type, preview diff, approval requirement | No silent mutation; user must choose approve / edit / reject | `R-ARTIFACT-10` |
| **First export** | Export manifest preview, artifact version lineage, SHA-256 hash plan, watermark / signature status, destination, confidentiality tags | Export disabled until manifest preview is opened once | `R-ARTIFACT-24` |
| **First research run** | Cost cap, source policy, web/private split, citation requirement policy, estimated runtime band, confirmation checkbox | Research cannot start without cap + source-policy confirmation | `R-RESEARCH-3`, `R-RESEARCH-14` |
| **First learning signal** | Explicit opt-in for memory layers (session only / reusable template memory / org memory); explain what is stored, where, and how to revoke | **Default is off**; persistent learning requires explicit user action | `R-LEARN-4`, `R-LEARN-5` |

---

## Workspace bootstrap protocol

### Objects created on first-run tenant init

| Object | First-run default |
| --- | --- |
| **Persona workspace shell** | One isolated workspace lane per user + persona tag |
| **Policy manifest** | Versioned policy object created at session start |
| **Artifact library** | `Drafts`, `Approved`, `Exported`, `Templates` |
| **Approval route** | At least one reviewer slot; reviewer type varies by persona |
| **Trust banner state** | Persisted acknowledgement state with timestamp |
| **Research policy** | Default source policy = private sources preferred; web off unless enabled |
| **Connector shortlist** | Ranked by persona and tenant signals |
| **Org memory seed** | Empty by default except org name, primary domain, approved region, approved source policy |
| **Template pack** | Six persona templates exist but only one primary template is surfaced |
| **Telemetry session record** | Session UUID + persona + trust mode + source type |

### Default DataClassification, retention, approval policy, org memory seed, templates

| Policy dimension | First-run default |
| --- | --- |
| **DataClassification** | `Internal` by default; elevate to `Confidential` or `Restricted` when finance, security, legal, or customer-identifiable data is detected |
| **Retention** | Draft traces 30 days; approved artifacts and manifests 365 days unless tenant policy overrides; disconnected-source purge follows source-specific contract |
| **Approval policy** | Mandatory human approval for first external share, first export, first write-back, and any artifact classified `Confidential` or `Restricted` |
| **Org memory seed** | Organisation name, approved region, source policy only; no behavioural memory by default |
| **Persona templates** | Partner steering update, CFO variance memo, CEO board brief, COO operating cadence pack, CISO control-gap memo, Transformation decision pack |

### First-connector nudge sequence

| Persona | Primary path | Secondary path | Suppressed on first run |
| --- | --- | --- | --- |
| **Partner** | Salesforce if already tenant-authorised | Gmail → SharePoint | Broad SharePoint crawl before artifact |
| **CFO** | Secure file upload OR SharePoint finance folder | Gmail | Salesforce |
| **CEO** | SharePoint board / strategy folder | Gmail | Salesforce unless explicitly account-led |
| **COO** | SharePoint operating pack | Gmail | Salesforce |
| **CISO** | SharePoint / security repository in admin-reviewed mode | **None until admin review** | Gmail + Salesforce |
| **Transformation Officer** | SharePoint PMO site | Gmail → Salesforce if account-led | None |

### Onboarding telemetry for funnel analysis

Required events (minimum):
`onboard_started`, `persona_inferred`, `persona_confirmed`, `admin_console_seen`, `trust_banner_viewed`, `connector_offer_rendered`, `connector_oauth_started`, `connector_oauth_succeeded`, `connector_oauth_failed`, `fallback_upload_used`, `artifact_seeded`, `artifact_first_draft_rendered`, `provenance_panel_opened`, `approval_gate_opened`, `artifact_approved`, `artifact_saved`, `export_manifest_viewed`, `export_completed`, `memory_opt_in`, `team_invite_sent`, `resume_reentered`, `onboard_abandoned`.

Required properties on every event:
`persona`, `source_type`, `data_classification`, `trust_mode`, `residency_region`, `seconds_since_start`, `artifact_type`, `citation_count`, `validation_status`, `approval_required`, `aha_reached`.

**Minimum schema required to answer which minute loses which persona, which connector path underperforms, whether activation came from upload fallback or live integration.**

---

## Failure modes and graceful degradation

### First connector fails to OAuth in time

If OAuth has not succeeded by **20 seconds** from initiation, replace waiting with an explicit fallback:
- secure file upload
- forward-email ingestion
- "continue with existing approved document"

Preserve intended connector + scopes for later retry without re-entering context. Artifact path continues using fallback data. UI states clearly that live sync is not yet active. **No demo data may be inserted as a substitute.**

### First AI generation produces a blocked citation-validation failure

If the first draft cannot satisfy evidence policy, the user must see an **honest blocked state** instead of a polished but weak output. The blocked state must show:
- missing evidence categories
- source coverage percentage
- exact cells / clauses / paragraphs that failed validation
- one-click options: narrow scope, add source, continue with scaffold only, hand off to review

**The safe fallback is a scaffolded artifact with evidence placeholders, not a fabricated conclusion.**

### User abandons mid-onboarding

Autosave on every state transition and at least every **15 seconds** during long waits. Saved state includes:
- persona
- connector target
- trust acknowledgements
- artifact seed
- latest draft snapshot

On return, user lands on the precise interrupted step with a short delta banner: *"You stopped after connector validation; ready to generate draft."*

### Persona detection is wrong

Persona inference must **never be destructive**. A visible "switch my path" control remains available through the first five minutes. Switching persona preserves source attachment, evidence cache, current draft whenever possible, then re-skins the artifact objective, review language, and next-best-action.

### Resume strategy

Each onboarding session issues a `resume_token` valid for 7 days or tenant policy, whichever is shorter. Resume preserves:
- trust acknowledgements
- selected connector mode
- uploaded files
- current draft
- approval history
- unresolved validation blockers

If the source changed since the last session, resume shows a **delta** before regeneration.

---

## Anti-patterns

Consultify must explicitly avoid these first-run anti-patterns:

1. Fake demo data in place of buyer data
2. Empty states before an outcome path is offered
3. Non-skippable tours
4. Generic prompt galleries as the primary flow
5. OAuth success toasts without a validation handshake
6. Ghost capabilities that the current tenant cannot actually use
7. First actions with invisible cost
8. Exports without manifest preview
9. Persistent learning turned on by default
10. Approvals shown only after mutation has already happened
11. Consumer-style chat intro for CISO
12. Admin-heavy setup gauntlet for Partner
13. Dependence on multi-day indexing before any first-session value
14. Claims of provenance or export integrity that are not actually implemented

---

## Requirements register

| ID | Priority | Requirement | Testable acceptance criteria | Risk if missed |
| --- | --- | --- | --- | --- |
| **R-ONBOARD-1** | **P0** | Persona must be captured explicitly or inferred for every first-run session | In ≥95% of first sessions, a persona is recorded within 45s of session start | Generic onboarding and poor relevance |
| **R-ONBOARD-2** | **P0** | Persona inference must expose confidence and allow one-click override | Override remains visible until 05:00 and preserves progress in 100% of tested flows | Wrong path and abandonment |
| **R-ONBOARD-3** | **P0** | Admin-first vs user-first split must be enforced | CISO sees admin/policy console before first generation in 100% of CISO paths; Partner reaches artifact seed without admin setup in ≤60s | Immediate mistrust or friction |
| **R-ONBOARD-4** | **P0** | Each persona must receive a first-run journey with a distinct primary artifact and connector order | In route tests, all six personas surface different primary CTA combinations | Lowest-common-denominator value |
| **R-ONBOARD-5** | **P0** | Trust-first disclosure must render before any prompt input or connector CTA | Trust banner appears before first interactive generation surface in 100% of first sessions | Security objections before value |
| **R-ONBOARD-6** | **P0** | Consultify must meet a five-minute activation SLA | Median time to approved-and-saved first artifact ≤240s overall; P90 ≤300s | "Interesting, evaluate later" outcome |
| **R-ONBOARD-7** | **P0** | The first artifact must use buyer data, not demo data | Zero onboarding sessions may substitute demo data silently when buyer data is absent | False proof and trust collapse |
| **R-ONBOARD-8** | **P0** | Connector ranking must be persona-aware and tenant-aware | Primary connector CTA differs by persona and respects tenant-authorised systems in 100% of route tests | Slower aha and lower attach rate |
| **R-ONBOARD-9** | **P0** | Connector success must require validation of scopes, permissions, and visible content | "Connected" state shown only after at least one validated-source preview is rendered | OAuth appears successful but yields no value |
| **R-ONBOARD-10** | **P0** | No-ghost-capabilities rule | In pre-release test suite, 0 unavailable capabilities are rendered as available across all persona paths | Credibility damage |
| **R-ONBOARD-11** | **P0** | First AI-originated mutation must be wrapped in a proposal envelope with preview or diff | 100% of first mutations show intent, source set, preview before user approval | Silent mutation and loss of control |
| **R-ONBOARD-12** | **P0** | Provenance panel must be accessible before approval of the first artifact | In 100% of first artifact flows, provenance opens before approval and lists supporting sources | Weak evidence trust |
| **R-ONBOARD-13** | **P0** | First artifact must cross a human approval gate with an audit event in-session | Activation counted only when approval event is logged and artifact is saved | Inflated activation and weak governance |
| **R-ONBOARD-14** | **P0** | First artifact must be saved to a reusable library location before 05:00 | ≥90% of successful internal sessions save first artifact to Drafts, Approved, or Templates before session end | One-off value with no retention |
| **R-ONBOARD-15** | **P0** | First export must require export manifest, version lineage, and SHA-256 surfacing | 100% of first exports require manifest preview and store SHA-256 hash | Export without integrity proof |
| **R-ONBOARD-16** | **P0** | First research run must expose cost cap and source policy before execution | 100% of first research runs require explicit cap and source-policy confirmation | Budget shock and policy mismatch |
| **R-ONBOARD-17** | **P0** | First persistent learning signal must be opt-in by memory layer | Default persistent memory state is off for 100% of new tenants; opt-in requires explicit user action | Unauthorised retention concerns |
| **R-ONBOARD-18** | **P0** | First-run tenant init must bootstrap workspace shell, policy manifest, approval route, library, template pack | Bootstrap objects exist and are queryable within 10s of session start in ≥99% of successful sessions | Fragmented first-run experience |
| **R-ONBOARD-19** | **P0** | Workspace defaults must inherit conservative classification, retention, approval rules until tenant overrides are known | New tenants default to Internal, 30d draft retention, approval on export/write-back, memory off | Unsafe defaults and compliance blockers |
| **R-ONBOARD-20** | **P0** | Honest OAuth fallback must exist for first connector failure | If OAuth exceeds 20s or fails, fallback path is shown automatically in 100% of tests and preserves intended connector context | Dead-end onboarding |
| **R-ONBOARD-21** | **P0** | Honest citation-validation fallback must exist for first artifact failure | If evidence coverage <80% or required source type missing, system blocks finalisation and shows scaffold fallback | Hallucinated confidence |
| **R-ONBOARD-22** | **P0** | Resume on abandonment must preserve partial progress | Returning user resumes the exact prior step with preserved files, acknowledgements, draft within 2 clicks in ≥95% of resume tests | Lost work and attrition |
| **R-ONBOARD-23** | **P0** | Onboarding-specific telemetry must support persona, minute, connector, artifact funnel analysis | All required onboarding events and properties are present in ≥99% of first-run sessions | Inability to optimise funnel |
| **R-ONBOARD-24** | **P0** | Activation KPI must be numeric overall and by persona | Dashboard reports overall activation ≥40% target, plus per-persona targets for time-to-aha, connector attach, approval | No measurable operating system |
| **R-ONBOARD-25** | **P1** | Team-invite flow must activate only after personal aha, not before it | Team invite CTA appears only after artifact save or approval in 100% of first-run flows | Premature collaboration ask and lower self-activation |

**Totals:** 25 requirements — 24 × P0, 1 × P1, 0 × P2.

---

## Required KPI thresholds for R-ONBOARD-24

| Persona | Activation rate target | Median time-to-first-artifact target | Connector-attach rate at aha target | First-artifact-approved rate target |
| --- | --- | --- | --- | --- |
| **Overall** | ≥40% | ≤240s | ≥50% | ≥35% |
| **Partner** | ≥45% | ≤210s | ≥50% | ≥40% |
| **CFO** | ≥55% | ≤180s | ≥60% | ≥45% |
| **CEO** | ≥35% | ≤240s | ≥40% | ≥30% |
| **COO** | ≥42% | ≤240s | ≥55% | ≥38% |
| **CISO** | ≥30% | ≤300s | ≥30% | ≥35% |
| **Transformation Officer** | ≥45% | ≤240s | ≥50% | ≥40% |

---

## Requirements inventory (flat list)

| ID | Priority | One-liner |
| --- | --- | --- |
| R-ONBOARD-1 | P0 | Persona captured explicitly or inferred every first-run session |
| R-ONBOARD-2 | P0 | Persona inference with confidence + one-click override |
| R-ONBOARD-3 | P0 | Admin-first vs user-first split enforced (CISO admin-first; Partner skip admin) |
| R-ONBOARD-4 | P0 | Distinct first-run journey per persona (artifact + connector order) |
| R-ONBOARD-5 | P0 | Trust-first disclosure before any prompt/connector CTA |
| R-ONBOARD-6 | P0 | 5-minute activation SLA (median ≤240s / P90 ≤300s) |
| R-ONBOARD-7 | P0 | First artifact uses buyer data, not demo data |
| R-ONBOARD-8 | P0 | Connector ranking persona-aware + tenant-aware |
| R-ONBOARD-9 | P0 | Connector success requires scope + content validation |
| R-ONBOARD-10 | P0 | No-ghost-capabilities rule |
| R-ONBOARD-11 | P0 | First AI mutation wrapped in proposal envelope + diff |
| R-ONBOARD-12 | P0 | Provenance panel accessible before first approval |
| R-ONBOARD-13 | P0 | First artifact crosses human approval gate + audit event |
| R-ONBOARD-14 | P0 | First artifact saved to reusable library ≤05:00 |
| R-ONBOARD-15 | P0 | First export requires manifest + lineage + SHA-256 |
| R-ONBOARD-16 | P0 | First research run exposes cost cap + source policy |
| R-ONBOARD-17 | P0 | First persistent learning is opt-in per memory layer |
| R-ONBOARD-18 | P0 | First-run tenant init bootstraps shell + manifest + route + library + templates |
| R-ONBOARD-19 | P0 | Conservative defaults (Internal / 30d / approval-on-export / memory off) |
| R-ONBOARD-20 | P0 | Honest OAuth fallback on first connector failure (20s) |
| R-ONBOARD-21 | P0 | Honest citation-validation fallback (scaffold, not fabrication) |
| R-ONBOARD-22 | P0 | Resume preserves partial progress |
| R-ONBOARD-23 | P0 | Onboarding-specific telemetry complete |
| R-ONBOARD-24 | P0 | Numeric activation KPI overall + per persona |
| R-ONBOARD-25 | P1 | Team-invite CTA only after personal aha |

---

## Benchmark matrix

| Vendor | Time-to-first-value | Real-vs-demo data | Persona differentiation | Trust disclosure | Approval gate surfaced | Connector at onboarding | Export integrity shown | Learning opt-in consent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **ChatGPT Enterprise** | Partial | Partial | Weak | Strong | Weak | Partial | Weak | Strong |
| **Claude Projects** | Partial | Strong | Weak | Strong | Weak | Partial | Weak | Partial |
| **Glean** | Weak | Strong | Weak | Strong | Weak | Strong | Weak | Weak |
| **Rovo** | Partial | Strong | Weak | Partial | Weak | Strong | Weak | Weak |
| **Microsoft 365 Copilot** | Partial | Strong | Partial | Strong | Weak | Partial | Weak | Weak |
| **Notion AI** | Strong | Strong | Partial | Partial | Weak | Partial | Weak | Weak |
| **Gamma** | Strong | Partial | Weak | Weak | Weak | Weak | Partial | Weak |
| **Cursor** | Strong | Strong | Weak | Partial | Partial | Weak | Weak | Partial |
| **GitHub Copilot** | Partial | Strong | Weak | Strong | Partial | Partial | Weak | Partial |
| **Harvey** | Partial | Strong | Strong | Strong | Strong | Partial | Partial | Weak |
| **Hebbia** | Partial | Strong | Partial | Strong | Strong | Partial | Weak | Weak |
| **Perplexity Enterprise** | Partial | Strong | Weak | Strong | Weak | Strong | Weak | Weak |
| **Linear** | Partial | Partial | Partial | Weak | Weak | Partial | Weak | Weak |

---

## 14-day MVP roadmap

**CFO path first** — clearest, fastest, highest-signal activation loop: a real file, a real analysis, a real approval, a real export. Partner and CISO paths begin once CFO has crossed the full trust-and-deliverable boundary.

| Day range | Scope | Deliverable |
| --- | --- | --- |
| **Days 1–2** | Route and trust foundations | SSO return, persona picker, trust banner, policy manifest, conservative defaults, telemetry skeleton, CFO workspace shell |
| **Days 3–4** | CFO source ingestion | Secure upload + SharePoint path, source validation handshake, file preview, classification escalation, live connector fallback |
| **Days 5–6** | CFO artifact generation | Variance memo template, supporting spreadsheet, cell-level lineage, provenance panel, evidence completeness scoring |
| **Days 7–8** | CFO approval and export loop | Proposal envelope, approval gate, audit events, library save, export manifest, SHA-256, signed PDF export |
| **Days 9–10** | Failure and resume hardening | OAuth failure fallback, citation-validation blocked state, autosave, resume token, abandonment recovery |
| **Days 11–12** | Partner extension | Salesforce / Gmail path, steering-note to slide-deck flow, client-share-safe review state, engagement library |
| **Days 13–14** | CISO extension and release hardening | Admin-first console route, restricted trust mode, export restrictions, ACL inheritance banner, role-based review, KPI dashboards |

### MVP exit criteria

The 14-day MVP is ready only if **all** of the following are true:

1. CFO median time-to-first-artifact is **≤180 seconds** in internal dogfooding
2. CFO end-to-end activation rate is **≥55%** across at least 20 guided first sessions
3. **100%** of CFO exports include manifest preview, version lineage, and SHA-256
4. **0** silent write-backs occur anywhere in onboarding
5. Resume recovers partial progress in **≥95%** of abandonment tests
6. Partner path reaches first artifact in **≤240 seconds**
7. CISO path always shows admin / trust console before generation in **100%** of route tests

---

## ID reconciliation with the earlier research doc

The earlier `DEEP_RESEARCH_ARTIFACT_CONNECTORS_ROI_ONBOARDING_2026-04-18.md` contained 8 high-level R-ONBOARD items. They are **subsumed** by this detailed document and become historical placeholders only.

### Clean migration policy

- Old persona-awareness themes → **R-ONBOARD-1..4**
- Old "fast first value" themes → **R-ONBOARD-6..14**
- Old trust / governance themes → **R-ONBOARD-5, 15..21**
- Old telemetry / ROI themes → **R-ONBOARD-22..25**

**If any old requirement wording conflicts with this document, this document wins.**

At plan-action time:
- **Close** the 8 `R-ONBOARD-*` rows from the earlier doc.
- Use `R-ONBOARD-1..25` from this doc as canonical ticket seeds.
- Do not re-ticket old rows.

---

## Cross-document linkage

| Dependency area | What this onboarding document depends on | Why the dependency matters |
| --- | --- | --- |
| **Reasoning** (`DEEP_RESEARCH_REASONING_REQUIREMENTS_2026-04-18.md`) | Evidence coverage scoring (R-REASON-10/16), citation-validation (R-REASON-10), model/tool routing (R-REASON-1), assumption management (R-REASON-16) | First five minutes depend on reasoning producing a **defensible** first artifact, not merely a plausible draft |
| **Feedback / Learning** (`DEEP_RESEARCH_FEEDBACK_SELF_LEARNING_2026-04-18.md`) | Layered memory model (R-LEARN-5), explicit consent system (R-LEARN-4), post-approval feedback capture (R-LEARN-2) | Onboarding cannot safely use persistent learning unless memory layers and consent are defined elsewhere |
| **Artifact Runtime** (`DEEP_RESEARCH_ARTIFACT_RUNTIME_DETAILED_2026-04-18.md`) | Proposal envelope (R-ARTIFACT-7/11), approval gate (R-ARTIFACT-10/21), audit events (R-ARTIFACT-23), manifests (R-ARTIFACT-24), version lineage (R-ARTIFACT-5), export hashing (R-ARTIFACT-24), library storage (R-ARTIFACT-18) | Aha-moment is artifact-centred; onboarding is downstream of runtime integrity and approval mechanics |
| **Enterprise Integrations** (`DEEP_RESEARCH_ENTERPRISE_INTEGRATIONS_DETAILED_2026-04-18.md`) | Connector trust modes (R-CONNECT-2), OAuth validation (R-CONNECT-14), ACL inheritance (R-CONNECT-7), disconnect-purge contract (R-CONNECT-9/10), region enforcement (R-CONNECT-17) | First-run experience requires integrations to be trustworthy **before** they are valuable |
| **ROI** (`DEEP_RESEARCH_ROI_LIFECYCLE_DETAILED_2026-04-18.md`) | Activation KPI definitions (R-ONBOARD-24 feeds R-OUTCOME-*), funnel schema, per-persona targets, **approved-artifact as ROI leading indicator** | Onboarding only matters if activation is measurable and linked to downstream economic value |
| **Deep Research** (`DEEP_RESEARCH_DEEP_RESEARCH_REPORTING_2026-04-18.md`) | Cost caps (R-RESEARCH-14), source policy (R-RESEARCH-6), research confirmation gate (R-RESEARCH-3), report formatting, provenance objects (R-RESEARCH-19) | Deep research must be a **controlled escalation** after first artifact value, not an unbounded first click |
| **Agent Runtime** (`DEEP_RESEARCH_AGENTIC_CHAT_RUNTIME_FULL_2026-04-18.md`) | Persona-aware orchestration (R-AGENT-1 tool scope), next-best-action generation (R-AGENT-6 navigation), fallback routing (R-AGENT-10 error codes), resume orchestration (R-AGENT-11/13 ledger + checkpoints) | Five-minute flow is an orchestrated path, not a single screen |

---

## What this document is NOT

- Not a ticket backlog (next pass converts `R-ONBOARD-*` into tickets, flags, tests, CI invariants).
- Not a UX wireframe spec — screen-by-screen designs live in dedicated UX docs per persona.
- Not a growth / GTM plan — activation KPIs are product primitives, not marketing outcomes.
- Not a replacement for existing dev plans — it is the **binding layer** that ties Reasoning + Artifact + Connectors + ROI + Research + Agent Runtime + Learning into the first five minutes of real-user contact.

## Next step

Turn this document into the canonical Onboarding implementation plan alongside all other research areas:

1. **Close** the 8 `R-ONBOARD-*` rows from the earlier doc (see migration policy above). Do not re-ticket.
2. Assign each `R-ONBOARD-*` from this doc a ticket ID and block (likely a dedicated `onboarding` block in `ChatV9Block` union or a `ChatV10Block`).
3. Register feature flags per requirement:
   - `ff.onboard_persona_capture`, `ff.onboard_persona_inference_override`, `ff.onboard_admin_first_split`, `ff.onboard_persona_journey`, `ff.onboard_trust_first_banner`
   - `ff.onboard_five_minute_sla`, `ff.onboard_buyer_data_only`, `ff.onboard_connector_ranking`, `ff.onboard_connector_validation`, `ff.onboard_no_ghost_caps`
   - `ff.onboard_first_mutation_proposal`, `ff.onboard_provenance_before_approval`, `ff.onboard_approval_gate`, `ff.onboard_library_save`
   - `ff.onboard_export_manifest`, `ff.onboard_research_cost_cap`, `ff.onboard_learning_opt_in`
   - `ff.onboard_bootstrap_init`, `ff.onboard_conservative_defaults`
   - `ff.onboard_oauth_fallback`, `ff.onboard_citation_fallback`, `ff.onboard_resume_preserve`
   - `ff.onboard_telemetry_full`, `ff.onboard_activation_kpi_dashboard`, `ff.onboard_invite_after_aha`
4. Draft `ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md` with per-ticket acceptance + test strategy; split by persona path (CFO / Partner / CISO / CEO / COO / Transformation Officer) + cross-cutting (Bootstrap / Trust / Fallback / Telemetry).
5. Extend `CHAT_V9_TELEMETRY_CONTRACT` with `onboard.*` event families (22 events listed in §Telemetry):
   - `onboard.started`, `onboard.persona_inferred`, `onboard.persona_confirmed`, `onboard.admin_console_seen`, `onboard.trust_banner_viewed`
   - `onboard.connector_offer_rendered`, `onboard.connector_oauth_started`, `onboard.connector_oauth_succeeded`, `onboard.connector_oauth_failed`, `onboard.fallback_upload_used`
   - `onboard.artifact_seeded`, `onboard.artifact_first_draft_rendered`, `onboard.provenance_panel_opened`
   - `onboard.approval_gate_opened`, `onboard.artifact_approved`, `onboard.artifact_saved`
   - `onboard.export_manifest_viewed`, `onboard.export_completed`
   - `onboard.memory_opt_in`, `onboard.team_invite_sent`
   - `onboard.resume_reentered`, `onboard.abandoned`
6. Add CI invariants in `chatV9FeatureFlags.test.ts`:
   - every `R-ONBOARD-*` → flag in registry
   - every `onboard.*` event → section in telemetry contract
   - every event carries the 11 required properties (`persona`, `source_type`, `data_classification`, `trust_mode`, `residency_region`, `seconds_since_start`, `artifact_type`, `citation_count`, `validation_status`, `approval_required`, `aha_reached`) — enforced by test fixture
   - every persona value (`Partner`, `CFO`, `CEO`, `COO`, `CISO`, `TransformationOfficer`) has a dedicated route + primary connector + primary artifact type defined in code
   - every KPI target in R-ONBOARD-24 has a corresponding threshold entry in the dashboard config
   - "buyer data only" rule (R-ONBOARD-7) enforced by linter — no demo-data imports in onboarding module
   - "default memory off" rule (R-ONBOARD-17/19) enforced by DB constraint — new tenant must have `memory_enabled = false`
