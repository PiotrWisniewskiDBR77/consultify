# Canonical 16-module owner walkthrough — 2026-08-24

Status: `READY_FOR_FAST_OWNER_DECISIONS / DEVELOPMENT_FROZEN`

This is the controlled walkthrough for choosing the final product surface of
all sixteen modules. It does not replace any owner register, screenshot index,
specification or acceptance file. Its only output is one architecture decision
per module: `ACCEPT`, `CHANGE: ...`, or `BLOCKED: ...`.

## Safety and identity

- integration checkout: `/Users/piotrwisniewski/Developer/Consultify-final-mvp-integration-20260823`
- branch: `codex/final-mvp-integration-20260823`
- reviewed input baseline: `78ed68d8b26ce7c0226b8599ea684bc7d2179fcd`
- protected visible runtime `:3987`: do not stop, reseed, or reuse
- Railway/production: no writes, deploys, or release claims
- owner data: no destructive operation; existing owner fixtures remain isolated
- decision rule: no implementation or legacy deletion before all 16 cards are
  frozen and conflicting evidence is reconciled

## Why the walkthrough is document-first

The guarded runtime already recognizes sixteen separate owner-fixture families.
They contain useful module-specific evidence, but they are not yet one integrated
database. Mounting them one after another as if they were a single application
would hide cross-module breaks and could make a historical surface look final.

The controlled sequence is therefore:

1. confirm the expected architecture below;
2. choose the final screen/code lineage for every module;
3. freeze the 16 route/component decisions in
   `canonical-16-module-bindings.json`;
4. build one new deterministic integration fixture from the selected contracts;
5. mount one fresh local server/client pair against that fixture;
6. capture current screenshots and run the 21 acceptance gates per module;
7. disconnect historical routes only after equivalence and readback proof.

The machine-readable build contract is
`canonical-16-module-integration-fixture.v1.json`. It fixes the shared roots,
owned seed-builder inputs, canonical object identities and explicit handoff
edges. It is deliberately non-executable until all sixteen owner verdicts are
captured; this prevents a provisional screen choice from becoming a new de
facto architecture.

## Application-wide contract to review once

- Menu 1 selects the global module.
- Menu 2 selects stable functions/registers of that module.
- Menu 3 contains status filters and contextual actions for the current
  function; it never repeats Menu 2.
- Every registry opens a standard full-height preview; `Open` enters a stable
  full-card route.
- Full cards have identity, save/readback, version/status, permissions and a
  clear Exit/Back action.
- AI proposes a reasoned change; a human accepts or rejects it.
- Cross-module transitions preserve source identity, lineage and a receipt.
- Empty data, missing entitlement or missing provider never masquerades as
  successful content.

## Fast pass — 16 decisions

Prepare the exact ordered review packet without starting, stopping or reseeding
any runtime:

```bash
node scripts/dev/prepare-canonical-owner-review.mjs \
  > /tmp/consultify-canonical-16-owner-review.json
```

The packet verifies all sixteen FINAL `0600` fixture receipts and labels each
database `ISOLATED_MODULE_EVIDENCE_ONLY`. Its URLs are navigation targets for
the future single integration runtime, not proof that sixteen isolated
databases have already been merged. The protected runtime on `:3987` is never a
target of this command.

| # | Module | Canonical entry | Expected Menu 2 / primary surface | Existing guarded data family | Owner verdict |
|---:|---|---|---|---|---|
| 01 | Organization | `/organization` | Profile; Goals; Challenges; Strategy; Context governance | `W3-ORGANIZATION-OWNER-v1` | `PENDING` |
| 02 | Interview | `/interview` | Inbox; Assigned/Managed; Templates; Results/Insights | `W3-INTERVIEW-OWNER-v1` | `PENDING` |
| 03 | Tools | `/discovery-tools` | Library; Processes/Sessions; Insights; Reports; Initiatives | `W3-TOOLS-OWNER-v1` | `PENDING` |
| 04 | Assessment | `/assessment/overview?tab=library` | Library; Processes; Insights; Reports; Initiatives; full card: Interview/Matrix/Report + Settings | `W3-ASSESSMENT-OWNER-v1` | `PENDING` |
| 05 | Initiatives | `/initiatives` | Initiatives; Plan; Capacity | `W3-INITIATIVES-OWNER-v1` | `PENDING` |
| 06 | Execution | `/execution` | Realizations; Work; Resources; Steering; Reports | `W3-EXECUTION-OWNER-v1` | `PENDING` |
| 07 | My Work | `/my-work` | Inbox/Triage; Tasks; Decisions; Ideas; Notebook; Agent activity | `W3-MY-WORK-OWNER-v1` | `PENDING` |
| 08 | Meetings | `/meeting` | Meetings; Agenda/Templates; Minutes; Decisions/Actions | `W3-MEETINGS-OWNER-v1` | `PENDING` |
| 09 | Results | `/results/kpi` | KPI; OKR; ROI; registry row opens its dedicated full tool | `W3-RESULTS-OWNER-v1` | `PENDING` |
| 10 | Finance | `/finance?tab=statements` | Statements; Analysis; Baseline; Prediction; Valuation | `W3-FINANCE-OWNER-v1` | `PENDING` |
| 11 | Materials | `/presentations?tab=all` | All; Documents; Presentations; Sheets; Template Library | `W3-MATERIALS-OWNER-v1` | `PENDING` |
| 12 | Audits | `/audit-programs` | Library; Programs/Processes; Evidence; Findings; Reports; Initiatives | `W3-AUDITS-OWNER-v1` | `PENDING` |
| 13 | Chat | `/chat` | Conversations; Sourced context/Snapshots; Proposals; Decisions | `W3-CHAT-OWNER-v1` | `PENDING` |
| 14 | Admin | `/admin` | Overview; Users; Organizations; Access; AI/Models; Operations/Audit | `W3-ADMIN-OWNER-v1` | `PENDING` |
| 15 | Settings | `/settings` | Profile; Workspace; Notifications; Integrations; Security/Privacy | `W3-SETTINGS-OWNER-v1` | `PENDING` |
| 16 | Partner | `/partner` | Overview; Opportunities; Connections; Collaboration; Materials; Settings | `W3-PARTNER-OWNER-v1` | `PENDING` |

## Required cross-module integration chain

```text
Organization context
  -> Interview / Tools / Assessment / Audits / Meetings / Chat
  -> governed insight, finding, decision or proposal + receipt
  -> Initiatives (one canonical initiative identity)
  -> Execution (same identity; realization, work, resources, steering)
  -> Results (KPI, OKR, ROI actuals)
  -> Finance (analysis, prediction, valuation)
  -> Materials (versioned document, deck or workbook)
```

My Work aggregates references and actions across the chain. Admin, Settings and
Partner govern access and collaboration; they do not create shadow business
objects.

## Decision capture format

During the walkthrough Piotr can answer in one line per module, for example:

```text
04 Assessment — CHANGE: keep the lighter typography, remove Split, full card is Interview / Matrix / Report + Settings.
09 Results — ACCEPT.
10 Finance — BLOCKED: first show the five-level version visible two days ago.
```

Every statement is copied atomically into the relevant owner register and then
into the binding manifest. A summary never replaces the original wording or
screenshot.

## Freeze completion gate

The architecture is frozen only when:

- all `16/16` modules have an explicit verdict;
- every `CHANGE` has an unambiguous target or `OWNER_DECISION_REQUIRED` marker;
- every selected route names one component lineage and one canonical API family;
- the integration fixture build list has no unexplained sample-only object;
- historical surfaces are listed as `KEEP_UNTIL_EQUIVALENCE_PROVEN`, not deleted.

Until then the truthful global state remains
`OWNER_FREEZE_PENDING / NO RELEASE CLAIM`.
