# Idea Family Integration Blueprint

## Purpose

This blueprint defines how the four `Idea` formats work together inside `02_moja-praca`:

- `MW_IDEAS_MINDMAP`
- `MW_IDEAS_TABLE`
- `MW_IDEAS_PROCESS_FLOW`
- `MW_IDEAS_WHITEBOARD`

They are not separate modules. They are four working modes for one idea workspace, with one shared context, one lineage model, one approval posture and one handoff contract.

## Integration Form

The integration should use a hub-and-spoke workspace model:

- `MW_IDEAS` is the hub.
- The four formats are interchangeable projections over the same idea context.
- The source of continuity is an `Idea Context Packet`, not the visible format.
- Every format can create structure, but no format can silently mutate another module's canonical objects.

### Idea Context Packet

Every open idea should maintain one normalized packet:

| Field | Meaning |
| --- | --- |
| `ideaId` | Stable idea identity. |
| `title` / `summary` | Human-readable idea framing. |
| `sourceRefs` | Chat, note, file, interview, radar, meeting or manual source links. |
| `evidenceRefs` | Evidence pointers used for claims, recommendations or handoff. |
| `assumptions` | Explicit statements without evidence yet. |
| `activeFormat` | Current projection: `mindmap`, `table`, `process_flow`, `whiteboard`. |
| `formatStates` | Format-specific state for map/table/flow/board. |
| `selection` | Current selected nodes, rows, steps, board elements or outcome candidates. |
| `provenancePosture` | User-authored, AI-suggested, source-backed, derived or owner-approved. |
| `readinessState` | Draft, needs evidence, review ready, blocked, approved for handoff. |
| `approvalState` | Proposal, accepted locally, sent to owner review, owner confirmed. |
| `handoffIntent` | Target intent: transform, initiative candidate, task candidate, artifact input. |
| `blockers` | Missing owner, missing evidence, ACL restriction, invalid structure, stale source. |

## Inputs

### External Inputs

| Input source | Enters as | Required treatment |
| --- | --- | --- |
| `01_czat` conversation | Source-backed note, proposal, extracted insight or working prompt. | Conversation canon stays in `01_czat`; source/citation must remain visible. |
| Manual user input | User-authored idea, node, row, step, sticky or outcome. | Mark as user-authored and preserve edit history where runtime supports it. |
| Notes / notebook | Source pack or captured context. | Keep note link and source freshness posture. |
| Radar / My Work signals | Idea seed, exploration prompt or opportunity. | Keep signal provenance, confidence and freshness. |
| Interview / discovery outputs | Finding, problem, hypothesis, evidence item. | Preserve source and owner module context. |
| Uploaded or organization materials | Source/evidence pack. | Use organization context pipeline; do not expose restricted chunks across ACL. |
| Existing artifacts | Document/table/deck/output reference. | Treat as linked artifact, not copied truth, unless owner lane explicitly exports a derivative. |

### Internal Format Inputs

| From | To | Transform intent |
| --- | --- | --- |
| Whiteboard | Mind Map | Turn workshop clusters/outcomes into relationship graph. |
| Whiteboard | Table | Turn outcomes/actions/risks into structured rows. |
| Whiteboard | Process Flow | Turn agreed outcomes into staged action logic. |
| Mind Map | Table | Turn related nodes into comparable records. |
| Mind Map | Process Flow | Turn dependencies into ordered steps and decisions. |
| Mind Map | Whiteboard | Open relationship map for facilitation and group synthesis. |
| Table | Mind Map | Visualize row relationships, conflicts and evidence gaps. |
| Table | Process Flow | Convert selected rows into steps, lanes, conditions or task chains. |
| Table | Whiteboard | Review structured records in facilitated synthesis mode. |
| Process Flow | Mind Map | Explore dependencies and blockers as a relationship graph. |
| Process Flow | Table | Convert steps/risks/owners into validation or action table. |
| Process Flow | Whiteboard | Facilitate review of process, blockers and decisions. |

## Outputs

### Local Workspace Outputs

| Output | Owner | Notes |
| --- | --- | --- |
| Mind map graph | `MW_IDEAS_MINDMAP` | Nodes, edges, clusters and evidence posture. |
| Idea table | `MW_IDEAS_TABLE` | Rows, fields, views, scoring and validation state. |
| Process flow | `MW_IDEAS_PROCESS_FLOW` | Steps, lanes, conditions, blockers and readiness gates. |
| Whiteboard session | `MW_IDEAS_WHITEBOARD` | Board elements, phases, outcomes, snapshots and activity. |
| Format transform result | `MW_IDEAS` family | Always draft or needs review if transform loses structure. |

### Downstream Outputs

| Target | Output payload | Owner boundary |
| --- | --- | --- |
| `05_inicjatywy` | Initiative candidate with problem, value, evidence, risks, dependencies and source refs. | `05_inicjatywy` owns initiative creation, approval and lifecycle. |
| `06_realizacja` | Task/action/action-chain candidate with acceptance criteria, owner intent, due context and source refs. | `06_realizacja` owns task creation, execution state and delivery governance. |
| `09_outputs` | Output package input or source bundle. | Outputs module owns packaging and distribution. |
| `10_dokumenty` | Document/report/brief input. | Document lane owns document lifecycle and review. |
| `11_tabele` | Formal table artifact input when promoted beyond idea workspace. | Table/form lane owns formal artifact lifecycle. |
| `12_prezentacje` | Deck/storyline/slide-source input. | Presentation lane owns deck artifact lifecycle. |
| `13_meeting` | Workshop agenda, decision pack or follow-up input. | Meeting module owns meeting lifecycle. |

Downstream success can be shown only after owner-module read-back. Before that, the output state is `candidate sent` or `owner review pending`.

## UI/UX Design

### Screen Structure

The Idea workspace should use a three-zone layout:

1. Left context rail:
   - idea list/back navigation,
   - source pack summary,
   - provenance coverage,
   - blockers and freshness state.
2. Center work canvas:
   - active format projection,
   - selection-aware editing surface,
   - honest empty/error/degraded states.
3. Right context panel:
   - selected item details,
   - evidence/provenance,
   - validation/readiness,
   - handoff preview and owner-boundary warnings.

Menu 3 / command row remains above the workspace:

- left side: format switch and local filters/views;
- center or left-middle: breadcrumb/current idea status;
- right side: AI actions, review actions, transform and handoff actions.

### Format Switcher

The switcher should present the four formats as working modes, not destinations:

| Label | User-facing description |
| --- | --- |
| `Mind Map` | Relationships and evidence gaps. |
| `Table` | Compare, score and validate records. |
| `Flow` | Model steps, decisions and readiness. |
| `Whiteboard` | Facilitate, cluster and synthesize. |

When the user switches format, the UI must show one of:

- `native`: this format already has current content;
- `transform available`: content can be generated from selected scope;
- `needs review`: transform exists but lost precision or evidence;
- `blocked`: required source/ACL/context is missing.

### Next-Action Guidance

The UI should never leave the user guessing. Recommended guidance:

| State | Primary next action | Secondary next action |
| --- | --- | --- |
| No idea selected | Create idea or open recent idea. | Import from chat/note/radar. |
| Empty format | Start with starter template. | Transform from another format/source pack. |
| Evidence missing | Add source/evidence or mark assumption. | Continue as draft. |
| AI proposal ready | Review diff and accept/reject. | Ask AI to explain evidence gaps. |
| Handoff blocked | Resolve owner/evidence/ACL blockers. | Save candidate as draft. |
| Handoff ready | Send to owner module review. | Preview payload first. |
| Owner review pending | Open owner module or wait for read-back. | Keep working locally. |

### Provenance Display

Every critical object should show a small provenance indicator:

- `User`: user-authored;
- `AI`: AI-suggested and not approved;
- `Source`: imported/source-backed;
- `Derived`: calculated/transformed;
- `Approved`: owner-approved after read-back;
- `Assumption`: no evidence yet.

The indicator should be visible in all formats, but rendered in format-native ways:

- node badge in Mind Map;
- cell/row chip in Table;
- step/edge marker in Flow;
- sticky/outcome tag in Whiteboard.

## Work Method

### Recommended User Flow

1. Capture:
   - create idea manually or import from chat/note/radar/source pack.
2. Choose starting format:
   - Whiteboard for ambiguity,
   - Mind Map for relationships,
   - Table for comparison,
   - Flow for sequence and execution readiness.
3. Structure:
   - user and AI create draft structure, clearly marked as draft/proposal.
4. Review:
   - inspect source coverage, assumptions, blockers and AI diffs.
5. Switch or transform:
   - move to another format only with explicit transform and review state.
6. Prepare handoff:
   - choose target module, selected scope and payload intent.
7. Owner review:
   - send candidate to `05_inicjatywy`, `06_realizacja` or artifact lane.
8. Read-back:
   - show final success only after owner module confirms the canonical write.

### AI Assistance Model

AI should help with:

- summarizing source packs;
- proposing nodes, rows, steps and clusters;
- detecting duplicates, blockers, missing evidence and missing owners;
- suggesting best next format;
- drafting handoff payloads.

AI must not:

- silently apply changes;
- approve its own suggestions;
- mutate owner modules;
- hide source loss during transform;
- create success states without read-back.

## Acceptance Criteria

- The user can understand when to use each format without reading documentation.
- Every input is either source-backed, user-authored, AI-suggested, derived or explicitly marked as assumption.
- Every format switch preserves lineage or marks loss as `needs_review`.
- Every high-impact handoff shows target module, payload, evidence posture and blockers before execution.
- Menu 3 is the only place for contextual AI actions.
- No downstream success is shown before owner-module read-back.
- Tenant/ACL restrictions are visible and deny-by-default.

## Open P2 Gaps

- Runtime audit is still needed to prove Menu 3-only AI placement across all four formats.
- A full e2e test is still needed for `capture -> format work -> transform -> handoff -> owner read-back`.
- Default starter templates per format should be extracted into a separate template catalog.
