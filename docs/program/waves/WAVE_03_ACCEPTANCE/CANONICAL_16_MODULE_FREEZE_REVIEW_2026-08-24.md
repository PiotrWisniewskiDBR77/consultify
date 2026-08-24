# Canonical 16-module freeze review — 2026-08-24

Status: `OWNER REVIEW PACKET / NO IMPLEMENTATION UNTIL FREEZE`

Visual review manifest:
`canonical-16-module-visual-candidates.json`. Every referenced image is pinned by
SHA-256 and classified as a target candidate, useful fragment, historical
orientation or rejected regression evidence. None of these images alone proves
the current integrated runtime; that proof is generated only after the owner
freeze and one-runtime build.

Purpose: perform one fast owner pass over the whole application and select the
canonical product architecture before any further screen wiring. This packet is
navigation; atomic owner registers, screenshots and specifications remain the
source evidence.

## Review protocol

For every module the owner returns only:

- `ACCEPT` — architecture can be frozen;
- `CHANGE: ...` — one or more corrections;
- `BLOCKED: ...` — a missing decision prevents freeze.

No visual detail, code change, seed, test, deployment or acceptance promotion
is performed during this pass. After all 16 decisions, the signed table becomes
the route/component/data integration contract.

## Shared application grammar

1. **Menu 1:** global module navigation only.
2. **Menu 2:** stable functions/registers inside the selected module.
3. **Menu 3:** statuses, filters and contextual actions for the selected Menu-2
   function. It changes with the function and never duplicates Menu 2.
4. **Registry:** standard table first. Selecting a row opens the standard
   full-height preview. `Open` enters the full card/workspace.
5. **Full card:** separate route with stable object identity, save/version
   semantics and a clear Exit/Back action.
6. **Row actions:** the same permission- and state-aware registry drives kebab
   and context menu. No long list of unavailable historical actions.
7. **Data:** canonical API only. Sample data is explicitly labelled and never
   substitutes for persistence evidence.
8. **AI:** analysis proposes changes with reasons; a human accepts or rejects.
   AI never silently commits business state.
9. **Handoffs:** downstream modules receive explicit proposals/receipts and
   preserved lineage, not hidden copies.
10. **No blank success:** missing provider, entitlement or data is an honest
    state with a recovery path, not an empty or substituted screen.

## Sixteen freeze cards

### 01 — Organization

- **Purpose:** governed company context used by every downstream tool.
- **Menu 2:** Profile; Goals; Challenges; Strategy; Context governance.
- **Core flow:** complete company facts → define intent/KPIs/scope/no-go → map
  challenges and blockers → synthesize strategy → approve/version context.
- **Primary objects:** organization profile, goals, challenges, strategy and
  governed context version.
- **Inputs/outputs:** owner/admin facts in; approved context version out to all
  modules. No downstream module overwrites it silently.
- **Reject:** disconnected readiness widgets, manufacturing-only mock advice,
  login fallback presented as the module.
- **Owner decision:** `PENDING`.

### 02 — Interview

- **Purpose:** create, assign, conduct and govern structured interviews.
- **Menu 2:** Inbox; Assigned/Managed; Templates; Results/Insights.
- **Core flow:** select published template → assign exact version → respondent
  answers through isolated token journey → manager reviews/sends back/approves
  → governed insight or initiative proposal.
- **Primary objects:** template/version, assignment, session, answers, evidence,
  evaluation snapshot and recommendation.
- **Inputs/outputs:** organization context and people in; approved interview
  insight/proposal out. Manager and anonymous respondent authorization remain
  separate.
- **Reject:** empty template picker, duplicate legacy creator, fake evaluation
  when provider is unavailable.
- **Owner decision:** `PENDING`.

### 03 — Tools

- **Purpose:** library and execution environment for consulting tools.
- **Menu 2:** Library; Processes/Sessions; Insights; Reports; Initiatives.
- **Core flow:** read tool detail → start/resume session → complete guided tool
  workspace → review/approve → generate Insight → optional Report → explicit
  Initiative proposal.
- **Primary objects:** tool definition/version, session, tool output, insight,
  report and proposal receipt.
- **Inputs/outputs:** organization/interview context in; governed downstream
  artifacts out. Dynamic SWOT is the canonical working MVP; unavailable tools
  remain `COMING_SOON`.
- **Reject:** duplicate tool shells, Outputs label where owner selected Insights,
  automatic initiative registration.
- **Owner decision:** `PENDING`.

### 04 — Assessment

- **Purpose:** licensed assessment library and governed assessment process.
- **Menu 2:** Library; Processes; Insights; Reports; Initiatives.
- **Full-card Menu 2:** Interview; Matrix; Report; separate Settings.
- **Core flow:** inspect methodology → start assessment → Interview captures
  current state/evidence → Matrix sets current and target → AI/human review →
  axis-based Report → export/propose initiatives.
- **Primary objects:** method/version, process/session, answer/evidence, current
  and target levels, matrix, report and initiative proposal.
- **Inputs/outputs:** knowledge method pack and organization context in;
  assessment insights/reports/proposals out.
- **Reject:** canonical-session debug table in Library, permanent Teresa rail,
  Split/Workspace duplicate, immutable-output debug screen as product card.
- **Owner decision:** `PENDING`.

### 05 — Initiatives

- **Purpose:** single registry and lifecycle for all transformation initiatives.
- **Menu 2:** Initiatives; Plan; Capacity.
- **Core flow:** create manually with AI-assisted wizard or accept a sourced
  proposal → review/approve lifecycle → manage in table/kanban → generate and
  version What-if Plan → analyze Capacity against a chosen plan.
- **Primary objects:** initiative/card, lifecycle decision, plan scenario,
  timeline placement, dependency and capacity analysis.
- **Inputs/outputs:** governed proposals from tools/assessment/interview/audits
  in; approved initiative identity out unchanged to Execution.
- **Reject:** Candidates and Portfolio as separate products, old one-screen
  creator, ad-hoc plan JSON form, statusless registry.
- **Owner decision:** `PENDING`.

### 06 — Execution

- **Purpose:** execute approved initiatives and control work to verified closure.
- **Menu 2:** Realizations; Work; Resources; Steering; Reports.
- **Core flow:** approved initiative creates/links one realization → Work manages
  tasks/decisions/milestones → Resources shows allocation/conflicts → Steering
  manages interventions → Reports produce current and forecast packs → closure
  emits immutable actuals/results.
- **Primary objects:** execution case, task, decision, milestone, assignment,
  steering signal/intervention and report snapshot.
- **Inputs/outputs:** initiative identity and plan in; actuals, evidence and
  closure receipt out to Results.
- **Reject:** `Execution unavailable` placeholder, second cockpit, editor blocks
  expanded below a registry instead of a standard full card/tab.
- **Owner decision:** `PENDING`.

### 07 — My Work / Agent

- **Purpose:** one personal governed inbox for work requiring the user.
- **Menu 2:** Inbox/Triage; Tasks; Decisions; Ideas; Notebook; Agent activity.
- **Core flow:** aggregate assigned items → filter/triage → open source object →
  act or delegate → capture idea/note → explicitly materialize an approved Agent
  proposal.
- **Primary objects:** work item reference, task, decision request, idea, note,
  agent proposal and receipt.
- **Inputs/outputs:** references from all modules in; governed actions back to
  their source modules.
- **Reject:** autonomous agent commits, duplicate shadow tasks, local notes
  presented as approved business records.
- **Owner decision:** `PENDING`.

### 08 — Meetings

- **Purpose:** plan meetings and convert discussion into governed outcomes.
- **Menu 2:** Meetings; Agenda/Templates; Minutes; Decisions/Actions.
- **Core flow:** create meeting → prepare agenda/context → conduct/capture → draft
  minutes → review/approve → explicitly publish decisions/tasks with receipts.
- **Primary objects:** meeting, agenda, participant, transcript/source,
  minutes/version, decision and action proposal.
- **Inputs/outputs:** organization/project context in; approved actions and
  decisions out to source modules/My Work.
- **Reject:** fabricated recording/transcription success, automatic task creation,
  provider-dependent feature shown as active when disabled.
- **Owner decision:** `PENDING`.

### 09 — Results

- **Purpose:** define and track performance, objectives and investment return.
- **Menu 2:** KPI; OKR; ROI.
- **Core flow KPI:** define metric/contract/owner/cadence → add measurements →
  inspect deviations → create corrective action when off target.
- **Core flow OKR:** define program/cycle/set → objectives and measurable key
  results → check-ins/confidence → review/close.
- **Core flow ROI:** open initiative investment case → baseline/model forecasts
  → approval → actual benefit tracking → post-investment review/closure.
- **Primary objects:** KPI, measurement, deviation/action; OKR set/objective/KR;
  ROI case, forecast, actual benefit and PIR.
- **Inputs/outputs:** Execution actuals and Finance references in; governed result
  facts out to Finance/Organization/reporting.
- **Reject:** old centered dark `Rezultaty` three-pairs cockpit, `My/Org/Scorecards`
  as Menu 2, empty cards, unrelated action menus.
- **Owner decision:** `PENDING`.

### 10 — Finance

- **Purpose:** convert source financial statements into governed analysis,
  planning, prediction and valuation.
- **Menu 2:** Statements; Analysis; Baseline; Prediction; Valuation.
- **Core flow:** import/map/reconcile statement pack → approve exact version →
  compute historical analysis → construct baseline assumptions → build prediction
  scenarios → value business/project → review/version/export.
- **Primary objects:** finance artifact, business version, statement sibling,
  source receipt, analysis, baseline, prediction scenario and valuation case.
- **Inputs/outputs:** source documents and Results actuals in; approved financial
  artifacts/reports out. One artifact identity and lineage across all levels.
- **Reject:** simplified historic shells, isolated forms without registry/card,
  UI-only aggregates presented as canonical data.
- **Owner decision:** `PENDING`.

### 11 — Materials

- **Purpose:** common library and native creation/editing of business materials.
- **Menu 2:** All; Documents; Presentations; Sheets; Template Library.
- **Core flow:** choose/create artifact → open native Document/Deck/Workbook card
  → edit/version/review → export/share with provenance and rights controls.
- **Primary objects:** material, native content/version/revision, template,
  source lineage, export and share receipt.
- **Inputs/outputs:** source artifacts from every module in; versioned document,
  presentation or workbook out.
- **Reject:** presentation-only showcase as the common library, missing Document
  or Sheet registry rows, copied output without source/version identity.
- **Owner decision:** `PENDING`.

### 12 — Audits

- **Purpose:** execute governed internal audits from criteria to remediation.
- **Menu 2:** Library; Programs/Processes; Evidence; Findings; Reports;
  Initiatives.
- **Core flow:** select/publish internal method pack → create program/session →
  test criteria and collect evidence → independent review → finding/corrective
  action → report → explicit initiative proposal.
- **Primary objects:** pack/version, program, criterion, evidence, finding,
  corrective action, report and proposal receipt.
- **Inputs/outputs:** organization/process evidence in; findings, report and
  proposals out.
- **Reject:** external named standards enabled without rights, legacy writes,
  AI committing findings without human approval.
- **Owner decision:** `PENDING`.

### 13 — Chat

- **Purpose:** sourced conversation workspace connected to governed work.
- **Menu 2:** Conversations; Sourced context/Snapshots; Proposals; Decisions.
- **Core flow:** open conversation → exchange messages with citations → capture
  snapshot → AI/human drafts proposal → owner decides → receipt materializes
  permitted downstream object.
- **Primary objects:** conversation/message, citation/source, snapshot, proposal,
  decision and delivery receipt.
- **Inputs/outputs:** context from all modules in; governed proposals/decisions
  out.
- **Reject:** blank composer from invalid identity, fake provider success,
  decision without receipt/readback.
- **Owner decision:** `PENDING`.

### 14 — Admin

- **Purpose:** tenant administration, separate from platform superadministration.
- **Menu 2:** People & access; Invitations; Roles/permissions; Organization
  policy; Integrations; Audit/events; Data/operations. `/superadmin/system` is a
  separate control plane.
- **Core flow:** inspect tenant state → perform guarded IAM/policy command →
  confirm impact → audit receipt/readback.
- **Primary objects:** member, invite, role/policy, integration state, command
  and audit event.
- **Inputs/outputs:** tenant identity/policy in; permissioned commands and audit
  trail out.
- **Reject:** seven unrelated visual shells, tenant/superadmin identity collapse,
  destructive operation without explicit safeguards.
- **Owner decision:** `PENDING`.

### 15 — Settings

- **Purpose:** personal account, preferences, security, privacy and export.
- **Menu 2:** Profile; Preferences/Regional; Notifications; Security; Privacy &
  Data; Connected accounts.
- **Core flow:** edit preference → save → receipt/readback; security/privacy
  operations require explicit state and confirmation.
- **Primary objects:** user profile, regional and notification preferences,
  security state, export request, deletion request and legal hold.
- **Inputs/outputs:** authenticated user in; governed personal settings out.
- **Reject:** destructive deletion execution, OAuth or MFA activation unless
  separately authorized; hidden unavailable state.
- **Owner decision:** `PENDING`.

### 16 — Partner

- **Purpose:** operational workspace for an active partner relationship.
- **Menu 2:** Overview; Opportunities/Referrals; Customers/Deals; Activities;
  Materials; Settlements/Performance (only where contractually enabled).
- **Core flow:** enter operational landing → manage referral/opportunity → follow
  activity and evidence → use approved materials → inspect eligible economics.
- **Primary objects:** partner profile/status, referral, opportunity, activity,
  approved material and settlement/performance record.
- **Inputs/outputs:** approved partner identity/program in; governed commercial
  activity and performance out.
- **Reject:** long marketing landing as owner workspace, fabricated economics,
  demo campaign/click data presented as operational truth.
- **Owner decision:** `PENDING`.

## Freeze result

The architecture is frozen only when all 16 owner decisions are recorded and
every `CHANGE` has been incorporated. Freeze does not mean implementation,
technical pass, owner acceptance or release. It authorizes the bounded
route/component/API/fixture integration described in
`FINAL_MVP_WIRING_ARCHITECTURE_2026-08-24.md`.
