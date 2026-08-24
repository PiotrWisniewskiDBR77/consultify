# Canonical 16-module route/component audit — 2026-08-24

Status: `SOURCE AUDIT / NO OWNER ACCEPTANCE / NO RUNTIME PROOF`

Candidate: `codex/final-mvp-integration-20260823`

Purpose: bind the freeze-review architecture to the current source tree before
any further visual or data integration. This audit answers only which route and
component the candidate source selects. It does not prove authentication,
backend availability, persistence, browser rendering or owner acceptance.

## Status vocabulary

- `CANONICAL_REACHABLE` — the selected canonical route mounts the intended hub.
- `CANONICAL_WITH_GAP` — the intended hub is mounted, but route identity, feature
  gating or an alternate entry can still produce a non-canonical owner journey.
- `LEGACY_REDIRECT_ONLY` — the old route does not mount a competing product.
- `OWNER_FREEZE_REQUIRED` — source selection must not be changed before the
  owner accepts or corrects the corresponding freeze card.

## Binding audit

| # | Module | Canonical entry | Selected component/surface | Source status | Gap before freeze |
|---:|---|---|---|---|---|
| 01 | Organization | `/organization/*` | `OrganizationView` | `CANONICAL_REACHABLE` | Owner must confirm Menu 2 and governed context scope. |
| 02 | Interview | `/interview` | `InterviewHub` | `CANONICAL_WITH_GAP` | Sidebar `AppView.DISCOVERY_CONSULTANT` still resolves to `/discovery`. That route mounts the same hub, but violates canonical URL identity; `/project-intelligence` also mounts rather than redirects to `/interview`. |
| 03 | Tools | `/discovery-tools` | `DiscoveryToolsHub` | `CANONICAL_REACHABLE` | Category deep links also mount the hub; owner must freeze library/process/insight/report/initiative grammar. |
| 04 | Assessment | `/assessment/*` | `AssessmentHub`; session route mounts `AssessmentSessionEditorView` | `CANONICAL_WITH_GAP` | Backward-compatible framework paths remain. Freeze must name the one accepted DRD session implementation before removing any competing screen. |
| 05 | Initiatives | `/initiatives` | `InitiativesHub` | `CANONICAL_REACHABLE` | `/roadmap` and `/portfolio` are query-preserving redirects only. Deep-link identity still needs owner freeze and browser proof. |
| 06 | Execution | `/execution`; `/execution/:executionCaseId` | `ExecutionHub` | `CANONICAL_WITH_GAP` | Both canonical routes are wrapped by `V8UnavailableBanner`; source mounts the hub, but runtime capability failure can still dominate the journey. `/implementation` and `/rollout` are redirect-only aliases. |
| 07 | My Work / Agent | `/my-work/*` | `MyWorkView` | `CANONICAL_REACHABLE` | `/vault`, `/agent-plan` and `/decisions` are redirects into My Work. Owner must freeze the final Menu-2 tab set. |
| 08 | Meetings | `/meeting` | `MeetingHub` | `CANONICAL_WITH_GAP` | No stable object deep-link is established in the audited route block; freeze must decide it before card integration. |
| 09 | Results | `/results` → KPI; `/results/kpi`; `/results/okr`; `/results/roi` | `ResultsOwnerReviewEntry`, three registry pages and KPI/OKR/ROI full-tool pages | `CANONICAL_REACHABLE` | Old `ResultsHub` source still exists but is not selected by canonical routes. Feature flags and authenticated browser/data readback remain separate gates. |
| 10 | Finance | `/finance` and finance detail routes | `EconomicsView` | `CANONICAL_WITH_GAP` | A single component owns root and detail routes, but final Statement/Analysis/Baseline/Prediction/Valuation screen selection and canonical API binding still require freeze/readback. `/economics` is redirect-only. |
| 11 | Materials | `/presentations`; `/document-studio`; `/excele` or `/tabele` | `ReportsAndPresentationsHub`, `DocumentStudioView`, `ExceleView` or `TabeleView` | `CANONICAL_WITH_GAP` | Sheet entry changes with `isExceleEngineEnabled()`. This is a genuine final-version ambiguity and must be resolved in the freeze; presentation generator and deck builder also remain separate deep tools. |
| 12 | Audits | `/audit-programs` | `AuditsMethodHub`; criterion deep link mounts `CriterionWorkspace` | `CANONICAL_REACHABLE` | `/audit-programs/method` paths are redirect-only. Rights and method-pack availability remain data/entitlement gates. |
| 13 | Chat | `/chat`; `/chat/:conversationId` | `UnifiedChatPanel` plus `ConversationRouteSync` | `CANONICAL_REACHABLE` | Provider and persisted conversation readback remain runtime gates. Deprecated dashboard routes redirect to Chat. |
| 14 | Admin | `/admin/*` | `AdminView` | `CANONICAL_REACHABLE` | Role gate is explicit; owner must freeze tenant-admin functions separately from `/superadmin/*`. |
| 15 | Settings | `/settings/*` | `SettingsView` | `CANONICAL_REACHABLE` | Many historical `AppView` values converge on grouped settings routes; freeze must confirm visible Menu 2, not every legacy enum. |
| 16 | Partner | `/partner/*` | `PartnerPortalViewNew` | `CANONICAL_WITH_GAP` | Authenticated unconnected users intentionally see a connect surface. Owner must select the direct operational landing and distinguish valid connect-state from regression. |

## Legacy-source rule

Old components may remain in the repository during freeze, but they receive one
of two explicit dispositions:

1. `UNREACHABLE_REFERENCE_ONLY` — retained temporarily for comparison/history;
2. `DELETE_AFTER_EQUIVALENCE_PROOF` — removed only after the canonical route,
   data contract and browser journey have passed their 21-point gate.

File existence alone is not a regression. A regression exists when a canonical
route, sidebar entry, deep link or runtime fallback selects the wrong surface.

Known examples that must not be re-promoted merely because their source exists:

- `src/components/Results/ResultsHub.tsx`;
- the old Results three-pairs cockpit;
- legacy Interview/discovery entry identities;
- legacy portfolio/roadmap/execution wrappers;
- simplified Finance shells.

## Decisions exposed by the audit

The quick 16-module owner pass must resolve these four architecture questions
before implementation resumes:

1. Is `/interview` the only canonical Interview URL, with `/discovery` and
   `/project-intelligence` becoming redirects?
2. Which Sheet engine is canonical inside Materials: `ExceleView` or
   `TabeleView`, and what happens to the other route?
3. What is the stable Meeting object deep link?
4. Is Partner's connect surface a valid first-run state only, and which route is
   the direct operational landing for an already connected partner?

## Next gate after owner freeze

For each accepted module create one immutable selection record:

`module → canonical route → component → Menu 2 → full-card route → API/read model
→ deterministic fixture → reference screenshots → rejected legacy surfaces`.

Only then perform data attachment and the 21-point browser replay. No module is
`OWNER_ACCEPTED` merely because this source audit says `CANONICAL_REACHABLE`.
