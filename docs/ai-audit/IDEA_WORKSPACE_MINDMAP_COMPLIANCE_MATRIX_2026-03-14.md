# Idea Workspace / Mindmap Compliance Matrix

**Date:** 2026-03-14  
**Scale:** `real | partial | scaffold | missing`

## 1. Product and Shell Contract

| Area | Canonical expectation | As-built reality | Status |
| --- | --- | --- | --- |
| One idea = one workspace | Single workspace per idea | Implemented through `IdeaMapWorkspace` and one persisted map per idea/user | `real` |
| Four local work systems only | `Mind Map`, `Whiteboard`, `Process Flow`, `Table` only | Implemented in shell and tool switching | `real` |
| Right strip only | `Tools | Context | AI Suggestions` as only right strip | Implemented through `WorkspacePanelStrip` and workspace panels | `real` |
| Frozen workspace layout | no extra right-side mini-rails | right strip respected, but left-side operational toolbar is stronger than a light discovery layer | `partial` |
| One shared SuperCanvas | systems coexist inside one shared canvas model | runtime still mounts one active tool at a time with shared persistence envelope | `scaffold` |

## 2. Mindmap Contract

| Area | Canonical expectation | As-built reality | Status |
| --- | --- | --- | --- |
| Manual-first growth | node-adjacent branch growth is first-class | child/sibling affordances exist directly on selected idea nodes | `real` |
| Fast creation gesture | no popover/mode requirement for common add-child action | fastest path exists, but hidden behind selection and surrounded by alternate creation routes | `partial` |
| Connect is separate from tree growth | cross-links should not corrupt tree semantics | one edge model serves both tree structure and arbitrary cross-links | `partial` |
| Predictable interaction states | `Select`, `Pan`, optional `Connect`, visibly changing behavior | mode model exists and affects React Flow props, but affordances remain hidden or low-discoverability | `partial` |
| Stable persistence | user should trust save/reload | mindmap still uses plain `PUT /map` without conflict protection | `partial` |
| Semantic node depth | node properties should persist beyond label | some fields preserved through normalization, but persistence and UI parity are incomplete | `partial` |

## 3. AI Governance Contract

| Area | Canonical expectation | As-built reality | Status |
| --- | --- | --- | --- |
| AI never writes silently | material changes require review | proposal review overlay exists in workspace shell | `partial` |
| Propose -> preview -> accept/reject | consistent governance for material AI changes | some paths use governed proposals, others still allow direct insert into workspace | `partial` |
| AI replay/auditability | accepted changes should leave replay trail | accepted proposals append replay entries in governance extensions | `real` |
| Context-aware AI | current object/selection should drive assistance | partial support exists, but sidekick behavior is still inconsistent across entry points | `partial` |

## 4. Artifact Linking Contract

| Area | Canonical expectation | As-built reality | Status |
| --- | --- | --- | --- |
| Object-level attachments | link artifacts to workspace objects with stable identity | live API still resolves attachments by `objectId` inside `nodes_json` | `partial` |
| LinkGraph as truth | map UI should not be the only source of relation truth | some flows create `LinkGraph` edges, some local mindmap flows do not | `partial` |
| Context / Links parity | backlinks and linked artifacts should reflect real graph truth | backlinks are idea-level; selected-object parity is incomplete | `partial` |
| Preview/open behavior | consistent preview/open affordance | open behavior is event-based and inconsistent; preview is not fully implemented | `partial` |

## 5. Cross-Canvas Contract

| Area | Canonical expectation | As-built reality | Status |
| --- | --- | --- | --- |
| Shared graph model | all tools work over one common runtime object model | one persisted envelope exists, but tool runtimes author incompatible local semantics | `scaffold` |
| Selection parity | right strip can trust node/edge/lane/row selection | `node` and `row` are real; edge/lane parity is weak | `partial` |
| Insert parity | insert/transform actions work across all target tools | mindmap, whiteboard, process flow consume insert events; table parity is missing | `partial` |
| Refresh parity | shell-level graph updates refresh all tools consistently | process flow listens explicitly; parity across all tools is incomplete | `partial` |
| Conversion traceability | outputs retain source context | entry points exist, but granular object-level traceability is incomplete | `partial` |

## 6. Persistence and Backend Contract

| Area | Canonical expectation | As-built reality | Status |
| --- | --- | --- | --- |
| Canonical validation | graph is normalized on save/load | validators and schema upgrade path exist | `real` |
| Conflict-safe editing | concurrent edits should be detectable | `/map/sync` supports this, but mindmap does not use it | `partial` |
| Extension durability | tool-specific metadata should survive partial saves | shallow merge and partial shell saves can clobber nested extension state | `partial` |
| Snapshot/history support | durable history should exist for trust/audit | API exists, but normal runtime save path does not guarantee usable historical trace | `partial` |

## 7. Final Classification

| Layer | Overall status |
| --- | --- |
| Workspace shell | `partial` |
| Mindmap runtime | `partial` |
| AI governance | `partial` |
| Artifact linking | `partial` |
| Cross-canvas model | `scaffold` |
| Backend persistence foundation | `partial` |

## 8. Interpretation

The module is not `missing`.  
It is also not `real` as a completed integrated workspace.

The most accurate classification today is:

- shell and local tools: `partial`
- shared `Canvas OS`: `scaffold`
- production Mindmap trust: `partial`, with several `P0` blockers
