# Artifact Runtime Requirements — Consultify (detailed)

> **Status:** source research input, captured 2026-04-18. Do not edit in place.
> **Scope:** answers the Artifact runtime deep research prompt (Prompt 1 of the
> second research batch) with the **full, detailed** specification. Supersedes
> the shorter Artifact runtime section (R-ARTIFACT-1…7) inside
> `DEEP_RESEARCH_ARTIFACT_CONNECTORS_ROI_ONBOARDING_2026-04-18.md`.
>
> **ID reconciliation required at plan-action time:**
> - `R-ARTIFACT-1…7` from the earlier Artifact/Connectors/ROI/Onboarding research
>   doc is **subsumed** by this document's `R-ARTIFACT-1…31`. IDs collide.
> - At plan-action time, this document is authoritative for all `R-ARTIFACT-*`
>   IDs. The earlier R-ARTIFACT-1…7 rows should be **closed / merged** into the
>   corresponding detailed IDs here, not re-ticketed. The mapping is spelled out
>   in the "ID reconciliation" table below.
>
> Complements the Reasoning, Feedback/Learning, Agentic Chat Runtime, ROI
> Lifecycle, Enterprise Integrations, and Deep Research/Reporting research
> documents dated 2026-04-18.
>
> **Next step:** this document will be turned into the canonical Artifact
> Runtime implementation plan (tickets + flags + tests + CI invariants) in a
> follow-up pass.

---

## Executive stance and benchmark readout

Consultify should **not** add "AI editing" as a thin layer on top of today's module-specific editors. It should introduce a **single artifact runtime** with three hard contracts:

1. a **typed Artifact model**
2. a **reviewable Mutation Proposal envelope**
3. a **versioned Audit / Export Integrity chain**

### Benchmark signal convergence

| Benchmark | Strongest contribution |
| --- | --- |
| **Notion** | Block-native content model + enhanced-markdown create/read/update APIs designed for agentic systems |
| **Figma / Figma Make** | Object-tree content, version history, branching, comments, multiplayer, context packages |
| **Vercel v0** | Diff view, versions, targeted selection-based edits, sharing controls, file locks |
| **Anthropic Claude Artifacts** | Dedicated, side-by-side workspace for seeing, iterating on, and building content with AI |
| **Gamma** | AI can edit whole decks, search web, update multiple cards at once, permissions, password-protected sharing, viewer analytics |
| **Kimi (Docs / Sheets / Slides)** | Breadth across formats, real file outputs, side-by-side comparison, native formulas and pivots |
| **GitHub** | Review contract: comment on specific changes, mark progress per-file, approve / request changes, required approvals before merge |
| **Microsoft Word + Excel Copilot** | Tracked changes, contextual comments, previews before apply, formula generation with user review |
| **Cursor** | Inline edit / review-change flow for precision edits |

### The consulting-specific gap

The benchmark patterns still **stop short** of the full requirement. Consulting deliverables must be:

- **editable in chat**
- **reviewable like change requests**
- **exportable as client-grade evidence**

**No reviewed system combines** typed artefact runtimes + zero-silent-write approval + role-aware enterprise review + cross-artifact consulting transformations + verifiable client exports in one contract.

That is why Consultify should treat the **artifact runtime as the product core**, not the AI agent.

---

## Unified Artifact model

### Architectural principle

> **Modules become renderers, not owners.**

`/notes`, `/reports`, `/presentations`, and `/sheets` should stop owning persistence contracts. They should render the **same Artifact runtime** through different editors and views. This eliminates the copy-paste boundary between memo, deck, and sheet, and makes the artifact library searchable, versionable, and reusable from chat.

### Core schema

```ts
type ArtifactType =
  | "document"
  | "slide_deck"
  | "spreadsheet"
  | "structured_doc"
  | "rich_note"
  | "research_report";

type ReviewState =
  | "draft"
  | "ready_for_review"
  | "approved"
  | "published"
  | "archived";

type DataClassification =
  | "public"
  | "internal"
  | "confidential"
  | "client_confidential"
  | "restricted"
  | "regulated";

interface Artifact {
  id: string;
  workspaceId: string;
  type: ArtifactType;
  title: string;
  currentVersionId: string;
  owner: PrincipalRef;
  permissions: AccessPolicy;
  approvalState: ApprovalSnapshot;
  metadata: {
    tags: string[];
    classification: DataClassification;
    retentionPolicyId: string;
    clientMatterId?: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    lastEditedBy: string;
  };
  parentArtifactId?: string;
  lineage: LineageEdge[];
  content: ArtifactContent;
  moduleBindings: ModuleBinding[];
  searchProjection: SearchProjection;
}

type ArtifactContent =
  | DocumentContent
  | SlideDeckContent
  | SpreadsheetContent
  | StructuredDocContent
  | RichNoteContent
  | ResearchReportContent;
```

### Canonical representation per type (opinionated)

| Type | Canonical form |
| --- | --- |
| `document` | Block/tree AST + enhanced-markdown projection for agentic editing and plain-text search |
| `research_report` | Same as `document` (reuses canonical `research_report` object from Deep Research) |
| `slide_deck` | Deck AST with stable slide IDs, block IDs, speaker notes, layout zones, semantic object types (`text`, `table`, `chart`, `image`, `footnote`, `note`) |
| `spreadsheet` | Workbook model with sheets, cells, formulas, named ranges, pivots, charts, validations, dependency graph |
| `structured_doc` | Schema-first discriminated union: `raci`, `decision_doc`, `roadmap`, `risk_register` — AI edits domain objects, not "just text" |
| `rich_note` | Lightweight, but lives in the same runtime |

### Requirements

| ID | Pri | Requirement | Acceptance | Risk if absent |
| --- | --- | --- | --- | --- |
| **R-ARTIFACT-1** | **P0** | First-class Artifact entity — every editable deliverable persisted with id, type, currentVersionId, owner, permissions, approvalState, metadata, content, lineage | Any note/report/deck/sheet/structured doc fetched through one runtime API | Dual-write inconsistencies during migration |
| **R-ARTIFACT-2** | **P0** | Fixed taxonomy with typed content models — `document`, `slide_deck`, `spreadsheet`, `structured_doc`, `rich_note`, `research_report` each with published JSON Schema + TS type | Artifact creation fails if content does not conform to schema | Recreating the "ephemeral blob" problem |
| **R-ARTIFACT-3** | **P0** | Canonical content + renderer projections — one canonical representation per artifact; editor/view/export projections derived from it | Deck edit propagates to presentation view, export, and chat preview without manual sync | Projector bugs look like content corruption |
| **R-ARTIFACT-4** | **P0** | Immutable version graph — every applied mutation creates a new immutable version; restoring old version creates new head, doesn't rewrite history | No version payload rewritten after creation; restore v1 → new head is v3 with lineage to v1 | Save-over semantics destroys audit |
| **R-ARTIFACT-5** | **P0** | Lineage as a first-class graph — edges `derived_from`, `summarises`, `transforms_to`, `publishes_to_module`, `export_of` | System can answer "which memo produced this board deck and this CFO model?" without heuristics | Search and audit unreliable |
| **R-ARTIFACT-6** | **P0** | Ownership, permissions, classification, retention — from day one | Access/export/review differs by role + classification | Painful backfills + weak GDPR/SOC evidence |

---

## Mutation proposal contract

The mutation layer should borrow the discipline of **pull requests**, not the informality of chat completions.

### Two-layer patch contract

- **Machine layer** — typed operation list with JSON-Patch-compatible semantics (RFC 6902: `add`, `remove`, `replace`, `move`, `copy`, `test`) for tree nodes, **plus** artifact-specific selectors for markdown ranges, slide blocks, spreadsheet ranges.
- **Human layer** — review-friendly diff: before/after, inline diff, visual slide diff, cell-range delta.

A plain JSON Patch alone is insufficient because people review text as **ranges and hunks**, not opaque paths. Notion's markdown update API reaches the same conclusion by preferring targeted search-and-replace over whole-page rewrites.

### Proposal schema

```ts
interface MutationProposal {
  proposalId: string;
  artifactId: string;
  baseVersionId: string;
  state: "proposed" | "approved" | "rejected" | "applied" | "superseded";
  summary: string;
  rationale: {
    why: string;
    evidence: EvidenceRef[];
    assumptions: string[];
    confidence: number;
  };
  hunks: MutationHunk[];
  validations: ValidationResult[];
  createdBy: "ai" | PrincipalRef;
  createdAt: string;
}

interface MutationHunk {
  hunkId: string;
  label: string;
  dependencies: string[];
  ops: ArtifactOp[];
  preview: PreviewPayload;
  reversible: true;
}

type ArtifactOp =
  | { kind: "json_patch"; op: "add" | "remove" | "replace" | "move" | "copy" | "test"; path: string; value?: unknown; from?: string }
  | { kind: "replace_text"; selector: RangeSelector; before: string; after: string }
  | { kind: "move_block"; blockId: string; fromParent: string; toParent: string; toIndex: number }
  | { kind: "update_cell_formula"; sheet: string; range: string; before: string; after: string }
  | { kind: "update_chart_binding"; chartId: string; before: ChartSpec; after: ChartSpec };
```

### Rule: every AI proposal must carry machine-readable rationale

Every proposal must include **why, evidence, sources, assumptions, and validation results** — the approver is not just reviewing text but the reasoning context behind it.

### Requirements

| ID | Pri | Requirement | Acceptance | Risk if absent |
| --- | --- | --- | --- | --- |
| **R-ARTIFACT-7** | **P0** | Proposal envelope for every AI edit — bound to one `artifactId` + one `baseVersionId` | Apply path rejects AI writes not wrapped in a proposal | Hidden back doors undermine trust |
| **R-ARTIFACT-8** | **P0** | Typed operations + stable anchors — block IDs for docs/decks, slide IDs for decks, sheet/range selectors for spreadsheets | Reordering adjacent content does not break anchor resolution | Brittle positional anchors → false conflicts |
| **R-ARTIFACT-9** | **P0** | Always-on preview — side-by-side, inline diff, or artifact-native visual diff | No "Apply" control without preview payload | Weak preview UX drives users back to manual editing |
| **R-ARTIFACT-10** | **P0** | Approval before apply — canonical version ID does not change while proposal state is `proposed` | Refresh page while proposal exists → content unchanged until approval event | Silent-write bug violates core non-negotiable |
| **R-ARTIFACT-11** | **P0** | Rationale + evidence attached — natural-language reason + evidence refs + source citations | Approver inspects why without reopening chat | Uncited proposals → review fatigue + compliance objections |
| **R-ARTIFACT-12** | **P0** | Partial accept — proposals decomposable into independent hunks with dependency metadata | User approves 3 of 5 hunks; rejected hunks remain unapplied | Hidden hunk coupling → surprising side effects |
| **R-ARTIFACT-13** | **P0** | One-click undo as one transaction — applying a proposal produces exactly one undoable transaction regardless of low-level op count | 40-op deck proposal → single undo restores prior version | Micro-op undo makes AI edits unusable |
| **R-ARTIFACT-14** | **P0** | Conflict detection + rebase — if head changed after proposal was created, runtime performs three-way rebase against `baseVersionId` or surfaces conflicts | Stale proposals never apply blindly to a newer head | Last-write-wins silently destroys consultant edits |

---

## Cross-artifact and cross-module flow

The runtime should support **typed transformations across documents, decks, and spreadsheets** — not just side-by-side modules.

Consulting memo → board deck → CFO model → executive summary should flow through **typed pipeline steps**:

- `memo → deck_outline → slide_deck`
- `memo → assumptions_table → spreadsheet`
- `report → one_page_summary → presentation_card_set`

Each step creates a child artifact, records lineage, and retains traceability to the source sections or cells it came from. **Untyped transformation edges will fill the artifact library with duplicated but unauditable copies.**

### Requirements

| ID | Pri | Requirement | Acceptance | Risk if absent |
| --- | --- | --- | --- | --- |
| **R-ARTIFACT-15** | **P0** | Artifact reference resolution in chat — resolve explicit IDs, aliases, recency phrases, and semantic references ("that Q3 model") with confidence scoring | User invokes a source artifact without navigating away from chat | Ambiguous references → cross-artifact mutations on wrong source |
| **R-ARTIFACT-16** | **P0** | Typed transformation pipelines — named steps with input type, output type, assumptions, lineage edges | Every derived artifact records `sourceArtifactIds` + transformation metadata | Untyped "AI generated this from that" logs → impossible to audit |
| **R-ARTIFACT-17** | **P1** | Cross-module publish as materialised view — publishing creates a view binding, not a detached copy | Module bindings can be regenerated from canonical artifact | Copy-paste regressions return |
| **R-ARTIFACT-18** | **P0** | Library search — hybrid across full text, semantic embeddings, metadata, lineage, approvals + bookmarks + "recently used in chat" | Users find artifacts by text/topic/owner/time/type/derivation path | Weak retrieval feels slower than folders |
| **R-ARTIFACT-19** | **P1** | Template inheritance — optional inheritance from templates with `parentArtifactId` + `inheritedFromTemplateVersionId` | Template-based artifacts can be re-generated while preserving local edits as downstream versions | Standardisation stays manual |

---

## Governance and compliance

**Approval is not a UI flourish; it is a policy engine.** Review state must be explicit, approvers must be role-aware, approved versions must be immutable, and exports must be verifiable **outside** the product.

### Benchmark convergence

- **GitHub** — required reviews, stale-approval dismissal, protected-branch rules
- **Notion** — webhooks for page locks, content updates, comments, suggested edits
- **Figma** — activity logs (actor/action/entity/context), SIEM export
- **Gamma** — view/comment/edit permissions, password-protected sharing, viewer analytics
- **Adobe PDF** — certificate-based digital signatures for authenticity/integrity
- **NIST** — secure hashes to detect whether a message has changed
- **GDPR** — data minimisation, storage limitation, data protection by design/default
- **SOC 2 / AICPA** — security, availability, processing integrity, confidentiality, privacy

### Requirements

| ID | Pri | Requirement | Acceptance | Risk if absent |
| --- | --- | --- | --- | --- |
| **R-ARTIFACT-20** | **P0** | Review state machine — `draft → ready_for_review → approved → published → archived` with clear transition rules + actor permissions | Invalid transitions blocked by policy; "publish from draft" rejected | Ad hoc state changes destroy audit reliability |
| **R-ARTIFACT-21** | **P0** | Role-based approval policy engine — approval chains resolvable by artifact type, classification, client exposure, policy rules; supports distinct role gates (CFO, CEO, Legal, CISO) sequential or parallel | One artifact requires CFO + Legal; another requires only Partner | Hard-coded reviewer lists won't survive enterprise complexity |
| **R-ARTIFACT-22** | **P0** | Comments + annotations + notifications — anchored to stable locations (block / slide object / cell range); support resolve / reopen / mention / notify | Moving a block preserves comment anchor | Weak anchors lose review context |
| **R-ARTIFACT-23** | **P0** | Immutable audit trail + frozen approved versions — every mutation, comment, approval, rejection, share, export produces an immutable event. Once approved/published, content immutable; edits create new draft child version | Approve v7 → attempt direct block edit → system creates v8 draft or rejects | Mutable approved versions = direct governance failure |
| **R-ARTIFACT-24** | **P0** | External sharing + export integrity — view-only links, expiry, optional password, open tracking, **export manifests** (artifact ID, version ID, timestamp, approvers, watermark status, SHA-256 digest); PDF exports support digital signing or detached signature verification | Recipient can verify delivered file corresponds to a specific approved version | Exported files not verifiable → client delivery fragile |
| **R-ARTIFACT-25** | **P0** | Classification + retention by default — every artifact requires `dataClassification` + retention policy at creation; inherited from workspace defaults or source artifacts | No artifact with null classification or retention | GDPR + enterprise-policy blind spots |

---

## Live editing UX

### Product rule

> **Chat should always know what the user means by "this", "here", and "that section".**

The editor must **continuously emit focus context**: current artifact, active tab, slide number, selected block, selected range, visible viewport, current review mode. Without that contract, chat-driven editing degenerates into brittle prompt engineering.

With it, instructions like:
- *"move bullet 2 under 5"*
- *"extend slide 4 with a case study"*
- *"add conservative -10% scenario to Q4 opex"*

become **deterministic proposal generation tasks**.

### Requirements

| ID | Pri | Requirement | Acceptance | Risk if absent |
| --- | --- | --- | --- | --- |
| **R-ARTIFACT-26** | **P0** | Focus-aware + selection-aware edit context — editor shell streams `artifactId`, `versionId`, `editorSurface`, `focusedNodeId`, `selection`, `viewport` into chat runtime | AI resolves "this" to current semantic selection without extra disambiguation | Weak focus → edits feel random and unsafe |
| **R-ARTIFACT-27** | **P1** | Batch operations across semantic scopes — "standardise all headers", "rename all phase titles", "normalise chart colours across deck" emitted as grouped proposals | User previews and approves batched hunks by scope; approve 20 of 30 slides | Batch edits without grouping/rollback are too dangerous to trust |
| **R-ARTIFACT-28** | **P0** | Validation + safe apply — before materialisation, artifact-specific validation: schema for structured docs, layout sanity for slides, reference integrity for linked charts, formula/dependency/recalc for spreadsheets | Invalid proposals blocked with machine-readable validation errors | Users blame runtime rather than model |

---

## Real-time collaboration

### Architectural choice: CRDT-style, not OT

For V2, choose a **CRDT-style collaboration contract**, not OT.

- OT is proven for single linear text streams but becomes unwieldy for non-linear object trees.
- Figma's own engineering write-up describes classic OT as overkill for its non-text object model and adopts a centralised CRDT-inspired design.
- Peritext strengthens the case for rich-text CRDTs preserving author intent across branch/merge.

Consultify artefacts are **mixed trees** of blocks, charts, tables, comments, formulas — CRDT semantics are the right choice even more strongly than for Figma.

### Important nuance

Consultify should **not** copy Figma's exact last-writer-wins text behaviour. Simultaneous edits to the same text property collapsing to one result is acceptable for design objects but **not for consulting prose**.

The right contract:
- **CRDT semantics** for rich text and structured nodes
- **Server-authoritative** ordering + policy layer for approvals, permissions, audit

**Merge locally, converge deterministically, but server remains source of truth for governance and final applied versions.**

### Requirements

| ID | Pri | Requirement | Acceptance | Risk if absent |
| --- | --- | --- | --- | --- |
| **R-ARTIFACT-29** | **P1** | Presence + shared session context — presence, live cursors, selected ranges, active review state per collaborator | 3 users in one deck → per-user presence + selection updates | Absent presence → accidental collisions |
| **R-ARTIFACT-30** | **P1** | CRDT-based concurrent editing + server arbitration — rich text, block trees, structured objects use deterministic merge; server authoritative for ordering tied conflicts, approvals, persisted versions | Independent edits merge without manual conflict for non-overlapping regions; overlapping edits surface consistent conflict rules | Forcing OT across mixed types → overcomplicated runtime that still fails on non-linear content |
| **R-ARTIFACT-31** | **P2** | AI as a bounded participant — AI appears in live sessions as a participant that can observe context, draft proposals, summarise discussion, prepare review bundles — but **never bypasses the same approval gates as humans** | AI suggestions are visible as participant-origin proposals, not direct writes | Privileged AI editor collapses approval model in group sessions |

---

## Requirements register

| ID | Pri | Requirement | Acceptance | Risk if absent |
| --- | --- | --- | --- | --- |
| **R-ARTIFACT-1** | **P0** | First-class Artifact entity | Any note/report/deck/sheet/structured doc fetched through one runtime API | Dual-write inconsistencies |
| **R-ARTIFACT-2** | **P0** | Fixed taxonomy + typed content models | Artifact creation fails if content ≠ schema | Ephemeral blob problem |
| **R-ARTIFACT-3** | **P0** | Canonical content + renderer projections | Deck edit propagates to all views without manual sync | Projector bugs look like corruption |
| **R-ARTIFACT-4** | **P0** | Immutable version graph | No version payload rewritten; restore creates new head | Save-over destroys audit |
| **R-ARTIFACT-5** | **P0** | Lineage as first-class graph | "Which memo produced this deck and model?" without heuristics | Unreliable search + audit |
| **R-ARTIFACT-6** | **P0** | Ownership / permissions / classification / retention from day one | Access/export/review differ by role + classification | Painful backfills + weak compliance |
| **R-ARTIFACT-7** | **P0** | Proposal envelope for every AI edit | Apply path rejects AI writes not wrapped in a proposal | Hidden back doors |
| **R-ARTIFACT-8** | **P0** | Typed operations + stable anchors | Reordering content does not break anchor resolution | Brittle positional anchors |
| **R-ARTIFACT-9** | **P0** | Always-on preview | No "Apply" without preview payload | Weak preview UX |
| **R-ARTIFACT-10** | **P0** | Approval before apply | Canonical version unchanged while `proposed` | Silent-write bug |
| **R-ARTIFACT-11** | **P0** | Rationale + evidence attached | Approver inspects why without reopening chat | Review fatigue + compliance objections |
| **R-ARTIFACT-12** | **P0** | Partial accept | Approve 3 of 5 hunks | Hidden hunk coupling |
| **R-ARTIFACT-13** | **P0** | One-click undo as one transaction | 40-op deck proposal → single undo | AI edits unusable |
| **R-ARTIFACT-14** | **P0** | Conflict detection + rebase | Stale proposals never apply blindly | Silently destroys consultant edits |
| **R-ARTIFACT-15** | **P0** | Artifact reference resolution in chat | User invokes source artifact without leaving chat | Wrong-source mutations |
| **R-ARTIFACT-16** | **P0** | Typed transformation pipelines | Every derived artifact records `sourceArtifactIds` + metadata | Unauditable copies |
| **R-ARTIFACT-17** | **P1** | Cross-module publish as materialised view | Module bindings regenerable from canonical artifact | Copy-paste regressions |
| **R-ARTIFACT-18** | **P0** | Library search (hybrid) | Find by text/topic/owner/time/type/derivation | Folders feel faster |
| **R-ARTIFACT-19** | **P1** | Template inheritance | Template update → rebase options for downstream artifacts | Manual standardisation |
| **R-ARTIFACT-20** | **P0** | Review state machine | Invalid transitions blocked by policy | Audit destroyed |
| **R-ARTIFACT-21** | **P0** | Role-based approval policy engine | CFO+Legal for one, Partner-only for another | Enterprise complexity not survivable |
| **R-ARTIFACT-22** | **P0** | Comments + annotations + notifications with stable anchors | Moving a block preserves comment | Review context lost |
| **R-ARTIFACT-23** | **P0** | Immutable audit trail + frozen approved versions | Approved content edits → new draft child version | Governance failure |
| **R-ARTIFACT-24** | **P0** | External sharing + export integrity (manifest + SHA-256 + signing hook) | Recipient verifies file = approved version | Legally/operationally fragile delivery |
| **R-ARTIFACT-25** | **P0** | Classification + retention by default | No artifact with null metadata | GDPR + enterprise-policy blind spots |
| **R-ARTIFACT-26** | **P0** | Focus-aware + selection-aware edit context | AI resolves "this" to current selection | Edits feel random |
| **R-ARTIFACT-27** | **P1** | Batch operations across semantic scopes | Batch hunks per scope; partial approval | Dangerous batch writes |
| **R-ARTIFACT-28** | **P0** | Validation + safe apply | Invalid proposals blocked with machine-readable errors | Runtime blamed for model errors |
| **R-ARTIFACT-29** | **P1** | Presence + shared session context | 3 users see per-user presence + selection | Accidental collisions |
| **R-ARTIFACT-30** | **P1** | CRDT-based concurrent editing + server arbitration | Deterministic merge for non-overlapping; consistent conflict rules for overlapping | OT on mixed trees overcomplicates |
| **R-ARTIFACT-31** | **P2** | AI as bounded participant | AI suggestions = participant-origin proposals, not direct writes | Approval model collapses |

---

## Requirements inventory (flat list)

| ID | Priority | One-liner |
| --- | --- | --- |
| R-ARTIFACT-1 | P0 | First-class Artifact entity |
| R-ARTIFACT-2 | P0 | Fixed taxonomy + typed content models |
| R-ARTIFACT-3 | P0 | Canonical content + renderer projections |
| R-ARTIFACT-4 | P0 | Immutable version graph |
| R-ARTIFACT-5 | P0 | Lineage as first-class graph |
| R-ARTIFACT-6 | P0 | Ownership / permissions / classification / retention |
| R-ARTIFACT-7 | P0 | Proposal envelope for every AI edit |
| R-ARTIFACT-8 | P0 | Typed operations + stable anchors |
| R-ARTIFACT-9 | P0 | Always-on preview |
| R-ARTIFACT-10 | P0 | Approval before apply |
| R-ARTIFACT-11 | P0 | Rationale + evidence attached |
| R-ARTIFACT-12 | P0 | Partial accept |
| R-ARTIFACT-13 | P0 | One-click undo as one transaction |
| R-ARTIFACT-14 | P0 | Conflict detection + rebase |
| R-ARTIFACT-15 | P0 | Artifact reference resolution in chat |
| R-ARTIFACT-16 | P0 | Typed transformation pipelines |
| R-ARTIFACT-17 | P1 | Cross-module publish as materialised view |
| R-ARTIFACT-18 | P0 | Library search (hybrid) |
| R-ARTIFACT-19 | P1 | Template inheritance |
| R-ARTIFACT-20 | P0 | Review state machine |
| R-ARTIFACT-21 | P0 | Role-based approval policy engine |
| R-ARTIFACT-22 | P0 | Comments + annotations + notifications with stable anchors |
| R-ARTIFACT-23 | P0 | Immutable audit trail + frozen approved versions |
| R-ARTIFACT-24 | P0 | External sharing + export integrity |
| R-ARTIFACT-25 | P0 | Classification + retention by default |
| R-ARTIFACT-26 | P0 | Focus-aware + selection-aware edit context |
| R-ARTIFACT-27 | P1 | Batch operations across semantic scopes |
| R-ARTIFACT-28 | P0 | Validation + safe apply |
| R-ARTIFACT-29 | P1 | Presence + shared session context |
| R-ARTIFACT-30 | P1 | CRDT concurrent editing + server arbitration |
| R-ARTIFACT-31 | P2 | AI as bounded participant |

**Totals:** 31 requirements — 22 × P0, 8 × P1, 1 × P2.

---

## 14-day MVP roadmap (slide_deck end-to-end)

Focus on **one artifact type end to end: `slide_deck`**. It is the best proving ground because:

- consultants naturally issue location-specific commands ("slide 4")
- preview and approval UX is visually testable
- it exercises the full path: source memo → derived deck → review → export

After `slide_deck`, the next type is `document`, then `spreadsheet`.

| Day | Deliverable |
| --- | --- |
| **1** | Freeze runtime contract: `Artifact`, `ArtifactVersion`, `LineageEdge`, `ApprovalPolicy`, `MutationProposal` for `slide_deck` |
| **2** | Canonical deck AST: deck, slide, layout zone, block, chart, speaker notes, footnotes, stable IDs |
| **3** | Persistence + version creation for decks; old presentation module becomes a renderer over new runtime |
| **4** | Chat reference resolution for "current deck", "slide N", "selected block", "speaker notes" |
| **5** | Proposal service: natural-language edit requests → typed deck ops |
| **6** | Review UX: side-by-side preview, inline diff on text blocks, thumbnail diff on slide structure, per-hunk accept/reject |
| **7** | Approval-only apply, single-transaction undo, immutable version creation |
| **8** | Comments / annotations anchored to slide IDs + block IDs, notifications |
| **9** | Audit events: proposal created, previewed, approved, rejected, applied, undone, commented, shared, exported |
| **10** | Export integrity for PDF decks: watermark, export manifest, SHA-256 digest, optional digital signature hook |
| **11** | One typed transformation: `document → slide_deck` with lineage recording from source sections → generated slides |
| **12** | Search indexing: deck title, block text, speaker notes, tags, owner, approver, lineage references |
| **13** | Scenario tests across three personas: consulting partner, CFO, transformation officer |
| **14** | Stabilise; demo script; measure 4 KPIs: proposal acceptance rate, median prompt→reviewed version time, undo frequency, export verification success rate |

**Product boundary crossed:** *"AI suggests edits in chat"* → *"AI co-produces governed client deliverables on real living files."*

---

## ID reconciliation with the earlier research doc

The earlier `DEEP_RESEARCH_ARTIFACT_CONNECTORS_ROI_ONBOARDING_2026-04-18.md` contained 7 high-level R-ARTIFACT items. They are **subsumed** by this detailed document. Mapping:

| Old ID (Artifact/Connect/ROI/Onboard doc) | Old one-liner | Resolves to (this doc) | Notes |
| --- | --- | --- | --- |
| R-ARTIFACT-1 (P0) | First-class Artifact with identity, owner, permissions, classification, retention, lineage root, approval state | **R-ARTIFACT-1 + R-ARTIFACT-5 + R-ARTIFACT-6 + R-ARTIFACT-25** | Split: entity + lineage graph + permissions/classification + classification-by-default |
| R-ARTIFACT-2 (P0) | Canonical typed content + typed ops over stable node IDs | **R-ARTIFACT-2 + R-ARTIFACT-3 + R-ARTIFACT-8** | Split: taxonomy + canonical vs renderer + stable anchors |
| R-ARTIFACT-3 (P0) | MutationProposal with reason bundle, evidence, citations, reversible txn, before/after preview, partial accept | **R-ARTIFACT-7 + R-ARTIFACT-9 + R-ARTIFACT-10 + R-ARTIFACT-11 + R-ARTIFACT-12 + R-ARTIFACT-13** | Split: envelope + preview + approval + rationale + partial accept + one-txn undo |
| R-ARTIFACT-4 (P0) | Native review/governance: comments, annotations, approvals, audit, immutable approved history, external share, export integrity | **R-ARTIFACT-20 + R-ARTIFACT-21 + R-ARTIFACT-22 + R-ARTIFACT-23 + R-ARTIFACT-24** | Split: state machine + policy engine + comments + immutable audit + export integrity |
| R-ARTIFACT-5 (P1) | Cross-artifact transformation + typed lineage | **R-ARTIFACT-15 + R-ARTIFACT-16 + R-ARTIFACT-17 + R-ARTIFACT-19** | Split: chat reference resolution + typed pipelines + materialised views + template inheritance |
| R-ARTIFACT-6 (P1) | Focus-aware, selection-aware, transaction-scoped editing | **R-ARTIFACT-26 + R-ARTIFACT-27 + R-ARTIFACT-28** | Split: focus context + batch ops + validation/safe apply |
| R-ARTIFACT-7 (P2) | Real-time multi-user editing with CRDT semantics + presence + AI as participant | **R-ARTIFACT-29 + R-ARTIFACT-30 + R-ARTIFACT-31** | Split: presence + CRDT + AI as bounded participant |

**New rows with no antecedent in the earlier doc:**
- R-ARTIFACT-4 (immutable version graph — was implicit in "immutable approved history" only, now explicit for all versions)
- R-ARTIFACT-14 (three-way rebase / conflict detection — was implicit in CRDT row, now explicit for server-side apply)
- R-ARTIFACT-18 (hybrid library search)

At plan-action time the earlier 7 rows close; this doc's 31 rows become the canonical ticket seeds.

---

## Cross-document linkage

- **Reasoning (`DEEP_RESEARCH_REASONING_REQUIREMENTS_2026-04-18.md`):**
  - Every AI-authored artifact edit (R-ARTIFACT-7/11) carries rationale that maps to the Reasoning trust bundle (R-REASON-15/16): evidence refs, assumptions, confidence.
  - Validation errors (R-ARTIFACT-28) use the same machine-readable contract as Reasoning self-check failures (R-REASON-10).
  - `insufficient_evidence` path (R-REASON-12) prevents proposal emission, not just chat response.

- **Feedback / Learning (`DEEP_RESEARCH_FEEDBACK_SELF_LEARNING_2026-04-18.md`):**
  - Proposal approval/rejection (R-ARTIFACT-10/12) is a first-class feedback signal (R-LEARN-2 explicit correction + R-LEARN-3 comparative choice when partial).
  - Artifact edits to learned memory (terminology, KPI definitions) flow through proposal contract before entering `Learned` layer (R-LEARN-5).
  - Approved export manifests (R-ARTIFACT-24) are immutable evidence for SAR export (R-LEARN-6).

- **Agentic Chat / Runtime (`DEEP_RESEARCH_AGENTIC_CHAT_RUNTIME_2026-04-18.md`):**
  - `MutationProposal` (this doc) is the artifact-specialisation of the unified `ActionEnvelopeV1` (R-AGENT-2) used for module mutations.
  - `DiffPreviewV1` (R-AGENT-8) renders via this doc's `PreviewPayload` (R-ARTIFACT-9).
  - Approval-barrier execution mode (agent runtime) invokes R-ARTIFACT-21 role-based approval policy.
  - Conflict detection + rebase (R-ARTIFACT-14) implements the stale-data/optimistic-concurrency contract from R-AGENT-7.
  - One-txn undo (R-ARTIFACT-13) is the artifact-level manifestation of agent-level compensating action semantics.

- **Enterprise Integrations (`DEEP_RESEARCH_ENTERPRISE_INTEGRATIONS_DETAILED_2026-04-18.md`):**
  - Classification + retention (R-ARTIFACT-25) inherits from connector DLP policy (R-CONNECT-16) when artifact is derived from connector content.
  - Export integrity (R-ARTIFACT-24) must not leak connector-derived content to unauthorised recipients — residency engine (R-CONNECT-17) enforces jurisdiction on exported file destinations.
  - Disconnect-purge cascade (R-CONNECT-9/10) must NOT delete approved artifact versions with SOX-retention obligations — same precedence rule as ROI.
  - Artifact library search (R-ARTIFACT-18) respects source-ACL filter (R-CONNECT-7) for connector-derived content.

- **ROI (`DEEP_RESEARCH_ROI_LIFECYCLE_DETAILED_2026-04-18.md`):**
  - ROI board packs and proof assets are `slide_deck` / `research_report` artifacts (R-ARTIFACT-2) with frozen approved versions (R-ARTIFACT-23).
  - Case-study generation (R-OUTCOME-20) emits artifacts through the typed transformation pipeline (R-ARTIFACT-16) with lineage back to `Initiative` + `KpiMeasurement` records.
  - Export manifests (R-ARTIFACT-24) embed the underlying KPI provenance (R-OUTCOME-5) so recipients can verify financial claims.
  - Artifact retention (R-ARTIFACT-25) must honour SOX-defensible retention for initiatives (R-OUTCOME-12) regardless of workspace default.

- **Deep Research / Reporting (`DEEP_RESEARCH_DEEP_RESEARCH_REPORTING_2026-04-18.md`):**
  - `research_report` artifact type (R-ARTIFACT-2) **is** the canonical `research_report` object (R-RESEARCH-17) — same entity.
  - Claim-level citation binding (R-RESEARCH-10) enforced by this doc's validation-before-apply (R-ARTIFACT-28) for research artifacts.
  - Review gate for high-stakes reports (R-RESEARCH-20) uses the same policy engine as R-ARTIFACT-21.
  - Multi-format export (R-RESEARCH-25) uses R-ARTIFACT-24 export manifest + SHA-256 pipeline.
  - Executive-summary-generated-last (R-RESEARCH-18) is an invariant enforced by the renderer over the canonical research report artifact (R-ARTIFACT-3).

- **Onboarding (`DEEP_RESEARCH_ARTIFACT_CONNECTORS_ROI_ONBOARDING_2026-04-18.md` §Onboarding):**
  - First-run aha-moment (R-ONBOARD-4) is co-producing a real `slide_deck` artifact with approval loop — same primitives.
  - CISO persona aha-moment (R-ONBOARD-6) surfaces audit events (R-ARTIFACT-23) + export manifest (R-ARTIFACT-24) during onboarding.
  - No-ghost-capabilities rule from integrations (this doc's unified runtime eliminates module-specific side channels) reinforces R-ONBOARD-1/3.

---

## What this document is NOT

- Not a ticket backlog (next pass converts `R-ARTIFACT-*` into tickets, flags, tests, CI invariants).
- Not a CRDT implementation spec — library/algorithm choice (Yjs, Automerge, custom) is an implementation decision; contracts stay.
- Not an editor UX spec — editor-specific UI lives in dedicated UX docs per artifact type.
- Not a replacement for the current module dev plans — it is the **substrate** modules will become renderers over.

## Next step

Turn this document into the canonical Artifact Runtime implementation plan alongside Reasoning / Feedback / Agent Runtime / Connectors / ROI / Deep Research / Onboarding:

1. **Close** the 7 `R-ARTIFACT-*` rows from the earlier doc (see mapping table). Do not re-ticket.
2. Assign each `R-ARTIFACT-*` from this doc a ticket ID and block (likely a dedicated `artifact` block in `ChatV9Block` union or a dedicated `ChatV10Block`).
3. Register feature flags per requirement:
   - `ff.artifact_entity`, `ff.artifact_typed_content`, `ff.artifact_canonical_projections`, `ff.artifact_immutable_version_graph`, `ff.artifact_lineage_graph`, `ff.artifact_classification_retention_default`
   - `ff.artifact_proposal_envelope`, `ff.artifact_typed_ops_anchors`, `ff.artifact_always_on_preview`, `ff.artifact_approval_before_apply`, `ff.artifact_rationale_evidence`, `ff.artifact_partial_accept`, `ff.artifact_single_txn_undo`, `ff.artifact_rebase_conflict`
   - `ff.artifact_chat_reference_resolver`, `ff.artifact_typed_transformations`, `ff.artifact_materialised_view_publish`, `ff.artifact_library_search`, `ff.artifact_template_inheritance`
   - `ff.artifact_review_state_machine`, `ff.artifact_role_approval_engine`, `ff.artifact_anchored_comments`, `ff.artifact_immutable_audit`, `ff.artifact_export_integrity_manifest`
   - `ff.artifact_focus_context`, `ff.artifact_batch_ops`, `ff.artifact_safe_apply_validation`
   - `ff.artifact_presence`, `ff.artifact_crdt_editing`, `ff.artifact_ai_as_bounded_participant`
4. Draft `ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md` with per-ticket acceptance + test strategy; split by sub-surface (Model / Mutation / Transformation / Governance / UX / Collaboration).
5. Extend `CHAT_V9_TELEMETRY_CONTRACT` with `artifact.*` event families:
   - `artifact.created`, `artifact.version_committed`, `artifact.restored`
   - `artifact.proposal_created`, `artifact.proposal_previewed`, `artifact.proposal_approved`, `artifact.proposal_rejected`, `artifact.proposal_applied`, `artifact.proposal_undone`, `artifact.proposal_superseded`, `artifact.proposal_conflict_detected`, `artifact.proposal_rebased`
   - `artifact.validation_failed`, `artifact.validation_passed`
   - `artifact.comment_created`, `artifact.comment_resolved`, `artifact.comment_anchor_drift`
   - `artifact.review_state_transition`, `artifact.approval_required`, `artifact.approval_received`
   - `artifact.shared`, `artifact.exported`, `artifact.export_hash_verified`, `artifact.signature_verified`
   - `artifact.transformation_pipeline_started`, `artifact.transformation_pipeline_completed`
   - `artifact.presence_joined`, `artifact.presence_left`, `artifact.merge_conflict_surfaced`
6. Add CI invariants in `chatV9FeatureFlags.test.ts`:
   - every `R-ARTIFACT-*` → flag in registry,
   - every `artifact.*` event → section in telemetry contract,
   - every `ArtifactType` value used in code matches the taxonomy (R-ARTIFACT-2),
   - every `ReviewState` value in code matches `draft / ready_for_review / approved / published / archived`,
   - every `DataClassification` value in code matches the documented set,
   - every `ArtifactOp.kind` in code matches the documented set,
   - every `MutationProposal.state` value in code matches `proposed / approved / rejected / applied / superseded`,
   - AI-originated content mutations must route through `MutationProposal` (no direct writes — enforced by repo-wide grep or linter rule),
   - approved versions cannot be mutated in place (enforced by DB constraint + linter),
   - every export path produces an `export_manifest` with SHA-256 + version ID (enforced by integration test).
