# Chat V10 / ARTIFACT — development plan (2026-04-18)

> **Scope note:** this plan is **design-phase** only. It documents the 31
> tickets `V10-ART-001..031` that implement the Artifact Runtime block of
> Chat V10. **No ticket here is shipped yet.** The block defines the unified
> output model that every other V10 block writes to: a typed `Artifact`
> interface, a reviewable `MutationProposal` envelope, approval gates,
> export manifests with SHA-256, and eventually CRDT-based real-time
> collaboration.
>
> Authoritative input: [`DEEP_RESEARCH_ARTIFACT_RUNTIME_DETAILED_2026-04-18.md`](./DEEP_RESEARCH_ARTIFACT_RUNTIME_DETAILED_2026-04-18.md)
> (R-ARTIFACT-1..31). Master plan: [`CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md`](./CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md).

> **Cross-refs**
> - Kill-switches & incident response → [`CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md`](./CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md)
> - Adding a new artifact type → [`CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md`](./CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md)
> - Telemetry payloads → [`CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md`](./CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md)

## Block summary

Artifact Runtime is the **output backbone** of Chat V10. Every enterprise
deliverable — memo, slide deck, spreadsheet, structured doc, research
report, RICH note — is modelled as an `Artifact` with stable identity,
typed content, `ReviewState`, `DataClassification`, export manifest, and
version lineage. Every AI-originated change is a `MutationProposal`: the
runtime enforces the "no silent writes" invariant that makes the rest of
the V10 governance surface credible.

**Architectural principle.** Modules become **renderers**, not owners. The
`slide_deck` editor, the `spreadsheet` grid, and the `decision_doc` surface
are all views over the same Artifact model. No module owns its own writes.

**Design inputs (from research doc):**
- Unified `Artifact` model with `ArtifactType`, `ReviewState`, `DataClassification`.
- Canonical typed representation per type (slide tree, cell graph, block list, etc.).
- `MutationProposal` two-layer patch contract (`json_patch`, `replace_text`, `move_block`, `update_cell_formula`, `update_chart_binding`).
- Governance gates on first external share, first export, first write-back, any Confidential / Restricted artifact.
- Live editing UX with selection-aware, range-scoped mutations.
- Real-time collaboration via CRDT (post-MVP in Wave C).
- Export integrity chain: version lineage + SHA-256 + signed manifest.

**MVP focus (Wave A):** `slide_deck` end-to-end — create → mutate → approve →
export → manifest + SHA-256. CFO-critical types (`memo`, `spreadsheet`) land
in Wave B. `research_report` lands alongside the Deep Research block. CRDT
real-time collaboration is explicitly **Wave C** (post-MVP).

## Backlog

| ID | Requirement | Priority | Effort | Risk | Wave | Status |
|---|---|---|---|---|---|---|
| [V10-ART-001](#v10-art-001) | R-ARTIFACT-1: unified `Artifact` interface with stable identity | P0 | 1.5 d | low | A | 📐 design |
| [V10-ART-002](#v10-art-002) | R-ARTIFACT-2: `ArtifactType` enum and canonical type registry | P0 | 1 d | low | A | 📐 design |
| [V10-ART-003](#v10-art-003) | R-ARTIFACT-3: `ReviewState` state machine (draft → ready_for_review → approved → published → archived) | P0 | 1.5 d | medium | A | 📐 design |
| [V10-ART-004](#v10-art-004) | R-ARTIFACT-4: `DataClassification` (Public / Internal / Confidential / Restricted) | P0 | 0.5 d | low | A | 📐 design |
| [V10-ART-005](#v10-art-005) | R-ARTIFACT-5: version lineage graph (parent, children, derivedFromVersionId) | P0 | 1.5 d | medium | A | 📐 design |
| [V10-ART-006](#v10-art-006) | R-ARTIFACT-6: per-type canonical schema (slide tree, cell graph, block list) | P0 | 3 d | high | A + B | 📐 design |
| [V10-ART-007](#v10-art-007) | R-ARTIFACT-7: `MutationProposal` envelope with intent, source set, preview | P0 | 2 d | high | A | 📐 design |
| [V10-ART-008](#v10-art-008) | R-ARTIFACT-8: typed operation list (`json_patch`, `replace_text`, `move_block`, `update_cell_formula`, `update_chart_binding`) | P0 | 2.5 d | high | A + B | 📐 design |
| [V10-ART-009](#v10-art-009) | R-ARTIFACT-9: rationale + citations + evidenceRefs bundle on every proposal | P0 | 1 d | medium | A | 📐 design |
| [V10-ART-010](#v10-art-010) | R-ARTIFACT-10: no-silent-writes runtime invariant (lint + runtime) | P0 | 1 d | medium | A | 📐 design |
| [V10-ART-011](#v10-art-011) | R-ARTIFACT-11: approve / edit / reject as the only three proposal outcomes | P0 | 1 d | low | A | 📐 design |
| [V10-ART-012](#v10-art-012) | R-ARTIFACT-12: partial acceptance (per-op granularity) | P0 | 1.5 d | medium | A | 📐 design |
| [V10-ART-013](#v10-art-013) | R-ARTIFACT-13: one-step undo per approved proposal (reversibleTxnId) | P0 | 1.5 d | medium | A | 📐 design |
| [V10-ART-014](#v10-art-014) | R-ARTIFACT-14: selection-aware mutation scoping | P0 | 1.5 d | medium | B | 📐 design |
| [V10-ART-015](#v10-art-015) | R-ARTIFACT-15: cross-artifact transformation with lineage preservation | P1 | 2 d | medium | B | 📐 design |
| [V10-ART-016](#v10-art-016) | R-ARTIFACT-16: `slide_deck` canonical schema + renderer | P0 | 3 d | medium | A | 📐 design |
| [V10-ART-017](#v10-art-017) | R-ARTIFACT-17: `memo` / rich-doc canonical schema + renderer | P0 | 2 d | low | B | 📐 design |
| [V10-ART-018](#v10-art-018) | R-ARTIFACT-18: `spreadsheet` canonical schema + cell-level lineage | P0 | 3 d | high | B | 📐 design |
| [V10-ART-019](#v10-art-019) | R-ARTIFACT-19: `decision_doc` canonical schema + renderer | P0 | 1.5 d | low | B | 📐 design |
| [V10-ART-020](#v10-art-020) | R-ARTIFACT-20: `research_report` canonical schema + typed content blocks | P0 | 2.5 d | medium | B | 📐 design |
| [V10-ART-021](#v10-art-021) | R-ARTIFACT-21: comments + annotations + mentions | P0 | 2 d | low | B | 📐 design |
| [V10-ART-022](#v10-art-022) | R-ARTIFACT-22: ArtifactStore (persistence, retrieval, search) | P0 | 2 d | medium | A | 📐 design |
| [V10-ART-023](#v10-art-023) | R-ARTIFACT-23: immutable audit trail on approved versions | P0 | 1.5 d | medium | A | 📐 design |
| [V10-ART-024](#v10-art-024) | R-ARTIFACT-24: export manifest + version lineage + SHA-256 + signature | P0 | 2 d | high | A | 📐 design |
| [V10-ART-025](#v10-art-025) | R-ARTIFACT-25: external-share watermark + provenance footer | P0 | 1 d | low | A | 📐 design |
| [V10-ART-026](#v10-art-026) | R-ARTIFACT-26: library folders (Drafts / Approved / Exported / Templates) | P0 | 1 d | low | A | 📐 design |
| [V10-ART-027](#v10-art-027) | R-ARTIFACT-27: template fingerprint + reuse | P1 | 1.5 d | low | B | 📐 design |
| [V10-ART-028](#v10-art-028) | R-ARTIFACT-28: role-based approval gates (CFO / CEO / Legal / CISO) | P0 | 1.5 d | medium | B | 📐 design |
| [V10-ART-029](#v10-art-029) | R-ARTIFACT-29: CRDT replicated state model (design + serde) | P1 | 2 d | high | C | 📐 design |
| [V10-ART-030](#v10-art-030) | R-ARTIFACT-30: real-time multiplayer presence + cursors | P2 | 3 d | high | C | 📐 design |
| [V10-ART-031](#v10-art-031) | R-ARTIFACT-31: cross-replica merge semantics + conflict markers | P1 | 3 d | high | C | 📐 design |

**Totals:** 31 tickets (24 × P0, 5 × P1, 2 × P2). Estimated effort ≈50 engineer-days (≈2 engineers × 5 weeks for Wave A+B; Wave C adds 4 more weeks).

**Proposed flag namespace:** `ff.artifact_*` (see master plan §4).

---

<a id="v10-art-001"></a>

## V10-ART-001 — unified Artifact interface

**Requirement:** R-ARTIFACT-1 (P0) — every editable object resolves to a first-class Artifact with stable identity.

**Design.** Core TypeScript type in `src/models/artifact/Artifact.ts` (new):

```ts
export type Artifact = {
  id: ArtifactId;                      // globally unique, tenant-scoped
  tenantId: TenantId;
  type: ArtifactType;                  // slide_deck | spreadsheet | memo | decision_doc | raci | research_report | rich_note
  ownerId: UserId;
  permissionPolicyId: PolicyId;
  dataClassification: DataClassification;
  retentionPolicyId: RetentionPolicyId;
  reviewState: ReviewState;
  currentVersionId: ArtifactVersionId;
  lineageRootId: ArtifactId | null;    // self if root
  parentArtifactId: ArtifactId | null; // for derived artifacts
  derivedFromVersionId: ArtifactVersionId | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  archivedAt: Timestamp | null;
  exportRecords: ExportRecordId[];     // every export stored in manifest log
  evidenceRefs: EvidenceRef[];         // TrustBundle refs from reasoning
  content: ArtifactContent;            // typed per ArtifactType
};
```

Every editable object in the system — created in any module — becomes an `Artifact` row. A memo created by Chat, a slide created by the deck builder, and a RACI produced by the ops workspace all share this type. Module views are **renderers** of this model.

**Acceptance criteria.**
- A memo, deck, or RACI created in any module appears in one artifact library and remains searchable and versionable everywhere.
- `artifact.id` is stable across renames, exports, and version bumps.
- No module bypasses `ArtifactStore` to persist editable content (CI invariant — lint rule).

**Test strategy.**
- Unit: Artifact schema serde round-trip.
- Integration: create artifact via Chat → find same artifact via Library search.

**Failure modes.**
- Legacy modules continue writing to their own stores. Mitigation: lint rule forbids non-ArtifactStore writes from `src/modules/*`; migrations move existing data under ArtifactStore ownership.

**Cross-refs.** V10-ART-002, V10-ART-022, V10-ONB-014.

---

<a id="v10-art-002"></a>

## V10-ART-002 — ArtifactType enum + type registry

**Requirement:** R-ARTIFACT-2 (P0) — each artifact type stores canonical typed content.

**Design.** Enum + registry:

```ts
export type ArtifactType =
  | "slide_deck"
  | "spreadsheet"
  | "memo"
  | "decision_doc"
  | "raci"
  | "research_report"
  | "rich_note";

export type ArtifactTypeSpec = {
  type: ArtifactType;
  canonicalSchemaPath: string;   // "src/models/artifact/schemas/slideDeck.ts"
  renderer: string;              // "SlideDeckRenderer"
  supportedOps: OpType[];        // subset of json_patch | replace_text | move_block | update_cell_formula | update_chart_binding
  defaultClassification: DataClassification;
  exportFormats: ExportFormat[]; // pdf, pptx, xlsx, docx, md, json
};

export const ARTIFACT_TYPE_REGISTRY: Record<ArtifactType, ArtifactTypeSpec>;
```

CI invariant 37 (master plan §6) asserts every `ArtifactType` has a registry entry, a flag, and a schema file.

**Acceptance criteria.**
- Registry is complete for all 7 types.
- A type without a registry entry causes TypeScript compile failure.
- Adding a new type is a single-file change (registry entry + schema file).

**Test strategy.**
- Unit: registry completeness test (every `ArtifactType` union member has registry entry).
- CI invariant: no ghost types.

**Cross-refs.** V10-ART-006, V10-ART-016..020.

---

<a id="v10-art-003"></a>

## V10-ART-003 — ReviewState state machine

**Requirement:** R-ARTIFACT-3 (P0) — review and governance native: state machine with approval gates.

**Design.** Finite state machine:

```
draft → ready_for_review → approved → published → archived
          ↑                   ↓
          └───── rejected ────┘
```

Transitions require explicit events; every transition writes an immutable audit entry. Once `approved`, the version is frozen; further edits create a new version (not in-place rewrite). `published` indicates external share has occurred. `archived` is terminal.

**Acceptance criteria.**
- FSM rejects invalid transitions (e.g. `draft → published` directly).
- Approved versions are immutable (write attempts throw `FrozenVersionError`).
- Audit trail contains every transition with reviewer, timestamp, trust bundle hash.

**Test strategy.**
- Unit: 100% state transition coverage (every edge tested, every invalid edge rejected).
- Integration: approve artifact → second edit creates new version, old version stays intact.

**Cross-refs.** V10-ART-023, V10-ONB-013.

---

<a id="v10-art-004"></a>

## V10-ART-004 — DataClassification

**Requirement:** R-ARTIFACT-4 (P0) — classification drives governance.

**Design.** Enum:

```ts
export type DataClassification =
  | "Public"
  | "Internal"
  | "Confidential"
  | "Restricted";
```

Classification determines:
- Default retention (Public: 90d; Internal: 365d; Confidential: 730d; Restricted: tenant policy).
- Export gates (Confidential + Restricted require approval).
- Share surface (Restricted cannot be externally shared; Confidential requires audit event).

Auto-escalation on content detection (SSN, credit card, PII) escalates to Confidential / Restricted; manual downgrade requires admin approval.

**Acceptance criteria.**
- Every artifact has non-null classification.
- Escalation is automatic and non-reversible without admin.
- Restricted artifacts cannot trigger external share UI.

**Test strategy.**
- Unit: classification escalator table-driven test.
- Integration: create artifact with SSN-containing content → auto-escalates to Restricted.

**Cross-refs.** V10-ART-024, V10-ONB-019.

---

<a id="v10-art-005"></a>

## V10-ART-005 — version lineage graph

**Requirement:** R-ARTIFACT-5 (P0) — cross-artifact lineage and version graph.

**Design.** Every `Artifact` has:
- `lineageRootId` — the root ancestor (self if root).
- `parentArtifactId` — immediate parent (e.g. slide deck derived from memo).
- `derivedFromVersionId` — specific version of parent at derivation time.
- `ArtifactVersion[]` — list of immutable version snapshots.

Queries: "find all artifacts derived from version X", "find lineage root", "find siblings". A graph visualiser (V10-ART-021 comments UI reuses it) shows the lineage on demand.

**Acceptance criteria.**
- Lineage queries return correct ancestors / descendants.
- Version snapshots are immutable and addressable by ID.
- Deriving a new artifact records the source version, not just source ID (survives source editing).

**Test strategy.**
- Unit: lineage graph operations (root, ancestors, descendants, siblings).

**Cross-refs.** V10-ART-013, V10-ART-015.

---

<a id="v10-art-006"></a>

## V10-ART-006 — per-type canonical schema

**Requirement:** R-ARTIFACT-6 (P0) — each type stores typed canonical content, not rendered text.

**Design.** Per-type schema modules in `src/models/artifact/schemas/`:

- `slideDeck.ts` — tree of `Slide` nodes, each with `layout`, `blocks[]` (text, image, chart, table), stable node IDs.
- `spreadsheet.ts` — cell graph with formulas, dependencies, named ranges, charts bound to ranges.
- `memo.ts` / `richNote.ts` — block list (paragraph, heading, list, quote, code, image, table) with block IDs.
- `decisionDoc.ts` — structured sections (context, options, recommendation, rationale, unresolved).
- `raci.ts` — rows with (task, owner, dates, dependencies) + RACI matrix.
- `researchReport.ts` — typed content blocks (summary, finding, claim, citation, hedging, assumption, appendix).

Stable node IDs enable diffs, partial acceptance, formula validation, and cross-artifact transformation.

**Acceptance criteria.**
- Every schema has a JSON Schema definition + TypeScript type.
- Schemas are versioned; old versions remain parseable.
- Stable node IDs survive edit / move / rename.

**Test strategy.**
- Unit per schema: serde round-trip, node ID stability under mutations.
- Contract: schema version migration (v1 → v2) preserves all content.

**Cross-refs.** V10-ART-008, V10-ART-016..020.

---

<a id="v10-art-007"></a>

## V10-ART-007 — MutationProposal envelope

**Requirement:** R-ARTIFACT-7 (P0) — every AI edit is a MutationProposal with reason + evidence + reversible transaction.

**Design.** Core type in `src/models/artifact/MutationProposal.ts` (new):

```ts
export type MutationProposal = {
  id: MutationProposalId;
  artifactId: ArtifactId;
  baseVersionId: ArtifactVersionId;   // optimistic concurrency
  intent: "create_artifact" | "update_artifact" | "derive_artifact" | "archive";
  sourceSet: EvidenceRef[];           // sources used for the mutation
  ops: ArtifactOp[];                  // typed operation list (V10-ART-008)
  rationale: string;                  // human-readable reason
  citations: Citation[];              // typed citations with source + span
  trustBundleHash: TrustBundleHash;   // link to reasoning TrustBundle
  reversibleTxnId: TxnId;             // for one-step undo (V10-ART-013)
  preview: ArtifactContent;           // post-mutation preview
  createdAt: Timestamp;
  proposedBy: ActorId;                // user or agent
  approvalRequired: boolean;
  approvalMode: ApprovalMode;         // inline | side_by_side | explicit_form
};
```

Every AI-originated change MUST create a proposal. Direct writes are forbidden (V10-ART-010).

**Acceptance criteria.**
- Every AI mutation has a MutationProposal row in `ArtifactStore`.
- `baseVersionId` enables optimistic concurrency — stale proposals rejected.
- User sees rationale, source set, preview before deciding.

**Test strategy.**
- Integration: mutation flow — propose → approve → apply → version bump; propose → reject → no write.
- Contract: proposal with missing rationale rejected at type level.

**Cross-refs.** V10-ART-008, V10-ART-009, V10-ART-010, V10-ART-011, V10-AGT-* (Agent Runtime's ExecutionProposalV1 is a sibling envelope).

---

<a id="v10-art-008"></a>

## V10-ART-008 — typed operation list

**Requirement:** R-ARTIFACT-8 (P0) — operations are typed against stable node IDs, not text-replace.

**Design.** Discriminated union:

```ts
export type ArtifactOp =
  | JsonPatchOp
  | ReplaceTextOp
  | MoveBlockOp
  | UpdateCellFormulaOp
  | UpdateChartBindingOp;

export type JsonPatchOp = { kind: "json_patch"; path: string; value: unknown; before?: unknown };
export type ReplaceTextOp = { kind: "replace_text"; nodeId: string; before: string; after: string };
export type MoveBlockOp = { kind: "move_block"; nodeId: string; fromIndex: number; toIndex: number; parentId: string };
export type UpdateCellFormulaOp = { kind: "update_cell_formula"; cellId: string; before: string; after: string; dependencies: string[] };
export type UpdateChartBindingOp = { kind: "update_chart_binding"; chartId: string; before: CellRange; after: CellRange };
```

Each op carries `before` / `after` for reversibility. Ops operate on stable node IDs, not offsets or paths that break under edits.

**Acceptance criteria.**
- Every op type has a pure `apply(content, op)` function.
- Every op type has a pure `reverse(op)` function that is its exact inverse.
- Op list can be replayed on a base version to produce a target version deterministically.

**Test strategy.**
- Unit: `apply + reverse = identity` for every op type.
- Property: random op sequences are reversible.

**Cross-refs.** V10-ART-012, V10-ART-013.

---

<a id="v10-art-009"></a>

## V10-ART-009 — rationale + citations + evidence

**Requirement:** R-ARTIFACT-9 (P0) — every proposal carries reason + citations + evidence refs.

**Design.** The proposal envelope (V10-ART-007) requires non-empty `rationale`, and for every `ReplaceTextOp` / `JsonPatchOp` that inserts factual content, at least one `Citation` linking to an `EvidenceRef`.

A compile-time constraint and a runtime assertion enforce this: proposals from AI agents must have citations for factual insertions. Empty-rationale proposals from user-initiated mutations are allowed (user accepts responsibility).

**Acceptance criteria.**
- AI-originated proposal with factual op but missing citation → rejected at mutation time.
- Rationale field is user-visible on every approval screen.

**Test strategy.**
- Unit: proposal validator rejects missing citations for AI-origin factual ops.

**Cross-refs.** V10-ART-007, V10-RSN-* (TrustBundle).

---

<a id="v10-art-010"></a>

## V10-ART-010 — no silent writes

**Requirement:** R-ARTIFACT-10 (P0) — no-silent-writes is a runtime invariant.

**Design.** Two enforcement layers:

1. **Lint** — `eslint-plugin-consultify-artifact/no-direct-write` forbids any direct call to `ArtifactStore.writeVersion` or its SQL equivalents from outside `src/services/artifact/mutationApplier.ts`. All writes must go through `applyProposal(proposal)`.
2. **Runtime** — `ArtifactStore.writeVersion` asserts the caller is `mutationApplier` (via explicit bound argument or internal token). Direct callers throw `SilentWriteForbiddenError`.

CI invariant 42 (master plan §6) codifies the expectation.

**Acceptance criteria.**
- **0** direct-write imports outside proposal paths (lint-enforced).
- Runtime assertion present in ArtifactStore.
- Legacy modules migrated to `applyProposal` before they can write.

**Test strategy.**
- Lint: runs on every PR.
- Runtime: direct call in test → throws.

**Cross-refs.** V10-ART-007, V10-AGT-* (Agent Runtime's ExecutionProposalV1 shares the contract).

---

<a id="v10-art-011"></a>

## V10-ART-011 — approve / edit / reject

**Requirement:** R-ARTIFACT-11 (P0) — the only three outcomes.

**Design.** Proposal decision UI exposes exactly three buttons. No "skip review" option exists. `edit` opens the proposal in an editable form (pre-populated with the AI's version); saving the edit creates a **new** proposal (the user's edit) and rejects the original. `reject` records the rejection reason for telemetry but does not apply any op.

**Acceptance criteria.**
- UI never shows a fourth option.
- `edit` produces a distinct proposal ID; the original proposal is marked `rejected`.
- Telemetry records the three outcomes distinctly.

**Test strategy.**
- Playwright: click each button → correct outcome.

**Cross-refs.** V10-ART-007.

---

<a id="v10-art-012"></a>

## V10-ART-012 — partial acceptance

**Requirement:** R-ARTIFACT-12 (P0) — user can accept one op, a range of ops, or all ops.

**Design.** The approval UI renders the op list with per-op checkboxes. User can select a subset; the applier applies only selected ops, producing a new version. Skipped ops are recorded in a "rejected ops" log on the proposal for learning (V10-LRN-*).

**Acceptance criteria.**
- User can accept any subset of ops.
- Rejected-ops log is populated for learning signal.
- Partial acceptance produces a valid version (no dangling references).

**Test strategy.**
- Unit: applier with ops [1, 3, 5] out of [1..5] produces expected content.
- Playwright: multi-select approve — selected ops applied, others skipped.

**Cross-refs.** V10-ART-008, V10-LRN-*.

---

<a id="v10-art-013"></a>

## V10-ART-013 — one-step undo

**Requirement:** R-ARTIFACT-13 (P0) — every approved proposal becomes exactly one undo transaction.

**Design.** On approval, `applyProposal` wraps the op list in a `ReversibleTxn` record. User can trigger undo within the retention window; undo applies the reverse ops and creates a new version marked `undo_of: <proposal_id>`. Redo is the inverse.

**Acceptance criteria.**
- Every approved proposal is undoable within its retention window.
- Undo preserves audit trail (a new version is created; history is not rewritten).
- Undo across multiple proposals works in LIFO order.

**Test strategy.**
- Unit: apply + undo = original content.
- Integration: approve 3 proposals → undo 2 → state matches first approval.

**Cross-refs.** V10-ART-008, V10-ART-023.

---

<a id="v10-art-014"></a>

## V10-ART-014 — selection-aware mutations

**Requirement:** R-ARTIFACT-14 (P0) — focus-aware, selection-aware, transaction-scoped edits.

**Design.** The editor surfaces expose selection state via a `SelectionContext` hook. Chat commands like "change this selection", "move bullet two under bullet five", and "standardise all slide headers" are translated into op lists scoped to the selection. If selection is empty, commands apply to the whole artifact.

**Acceptance criteria.**
- Selection-scoped commands produce ops only within the selection.
- Ambiguous commands ("this bullet") without selection are rejected with a clarification prompt.

**Test strategy.**
- Unit: selection → op scope mapping for 10 canonical commands.

**Cross-refs.** V10-ART-007, V10-RSN-* (reasoning's command parser).

---

<a id="v10-art-015"></a>

## V10-ART-015 — cross-artifact transformation

**Requirement:** R-ARTIFACT-15 (P1) — a memo can generate a slide deck + appendix preserving lineage.

**Design.** `transformArtifact(source, targetType, options)` generates a new artifact with `parentArtifactId = source.id`, `derivedFromVersionId = source.currentVersionId`, and a MutationProposal that synthesises the target schema from the source. Lineage graph (V10-ART-005) records the relationship.

**Acceptance criteria.**
- Memo → deck preserves lineage (`parentArtifactId` points to memo).
- Re-running transformation on edited source creates a new derived artifact (not in-place update of old).
- Source refs of target include source artifact's evidence.

**Test strategy.**
- Integration: memo → deck → appendix spreadsheet — lineage chain queryable.

**Cross-refs.** V10-ART-005, V10-ART-007.

---

<a id="v10-art-016"></a>

## V10-ART-016 — slide_deck schema + renderer

**Requirement:** R-ARTIFACT-16 (P0) — slide_deck is the MVP type.

**Design.** Schema in `src/models/artifact/schemas/slideDeck.ts`. Renderer in `src/components/artifact/SlideDeckRenderer.tsx`. Supports text, image, chart, table blocks. Layouts: title, section, two-column, comparison, chart-with-caption, table. Ops supported: `json_patch`, `replace_text`, `move_block`.

**Acceptance criteria.**
- Deck roundtrips serde identity.
- Renderer handles all 6 layouts.
- Move-block op preserves block IDs.

**Test strategy.**
- Unit: schema + renderer per layout.
- E2E: create deck via Chat → approve → export PPTX → reopen → content intact.

**Cross-refs.** V10-ART-006, V10-ART-024 (export).

---

<a id="v10-art-017"></a>

## V10-ART-017 — memo / rich-doc schema + renderer

**Requirement:** R-ARTIFACT-17 (P0) — long-form docs.

**Design.** Block-based schema (paragraph, heading, list, quote, code, image, table). Ops: `json_patch`, `replace_text`, `move_block`. Renderer supports print-to-PDF with pagination rules.

**Acceptance criteria.**
- Memo with ≥20 blocks renders correctly and paginates predictably.
- Heading levels 1–4 supported.

**Cross-refs.** V10-ART-006, V10-ART-024.

---

<a id="v10-art-018"></a>

## V10-ART-018 — spreadsheet schema + cell-level lineage

**Requirement:** R-ARTIFACT-18 (P0) — finance-grade integrity.

**Design.** Cell graph with formulas, named ranges, charts bound to ranges. Every cell carries `lineage: CellLineage` showing which source cells / external refs fed its current value. Lineage panel is surfaced in the UI; export includes per-cell lineage in the manifest.

**Acceptance criteria.**
- Formula dependency graph is acyclic.
- Cell lineage is queryable per cell.
- Chart bindings survive row / column insertions correctly.

**Test strategy.**
- Unit: formula evaluator + lineage propagator on 20 canonical scenarios.
- E2E: CFO variance memo's supporting spreadsheet — cell lineage visible + exportable.

**Cross-refs.** V10-ART-024, V10-ONB-015 (CFO export).

---

<a id="v10-art-019"></a>

## V10-ART-019 — decision_doc schema + renderer

**Requirement:** R-ARTIFACT-19 (P0) — executive decision briefs.

**Design.** Structured sections: `context`, `options[]`, `recommendation`, `rationale`, `unresolved_assumptions[]`, `evidence_refs[]`. Renderer produces a one-pager by default with drill-down on each section.

**Acceptance criteria.**
- All 6 sections are addressable as stable nodes.
- Unresolved assumptions panel auto-surfaces when non-empty.

**Cross-refs.** V10-ART-006.

---

<a id="v10-art-020"></a>

## V10-ART-020 — research_report schema

**Requirement:** R-ARTIFACT-20 (P0) — research output as first-class artifact.

**Design.** Typed content blocks: `summary`, `finding`, `claim`, `citation`, `hedging`, `assumption`, `appendix`, `method_note`. Every `claim` has at least one `citation`. Hedging is typed (`certain` / `likely` / `plausible` / `speculative`).

**Acceptance criteria.**
- Every claim has ≥1 citation (enforced at schema level).
- Hedging is explicit; un-hedged claims only allowed for `certain` findings.

**Cross-refs.** V10-RSR-* (Deep Research block writes into this schema).

---

<a id="v10-art-021"></a>

## V10-ART-021 — comments + annotations

**Requirement:** R-ARTIFACT-21 (P0) — review is native.

**Design.** `Comment` model with anchor (nodeId + range), author, body (markdown), mentions (@user), resolved/unresolved state. Annotations are typed (`question`, `suggestion`, `issue`, `approval_note`). Comments render in side-panel + inline indicators.

**Acceptance criteria.**
- Comments survive anchor node mutations (anchor re-attaches or marks as orphan).
- Mentions trigger notifications to mentioned users.

**Cross-refs.** V10-ART-005.

---

<a id="v10-art-022"></a>

## V10-ART-022 — ArtifactStore

**Requirement:** R-ARTIFACT-22 (P0) — persistence, retrieval, search.

**Design.** Postgres-backed service (`src/services/artifact/ArtifactStore.ts`) with:

- `create`, `findById`, `findByTenant`, `search(query)`, `writeVersion` (internal), `loadVersion`.
- Full-text search over content + metadata.
- Per-tenant row-level security.
- Versions stored as immutable blobs; deltas computed on read if needed.

**Acceptance criteria.**
- Artifact CRUD + search latency P90 ≤ 200 ms.
- Row-level security passes tenant isolation test.

**Test strategy.**
- Integration: create → search → find → load.
- Security: tenant A cannot see tenant B's artifacts.

**Cross-refs.** V10-ART-001, V10-ART-010.

---

<a id="v10-art-023"></a>

## V10-ART-023 — immutable audit trail

**Requirement:** R-ARTIFACT-23 (P0) — approved versions are immutable.

**Design.** Audit log append-only table `artifact_audit_events`. Every proposal, approval, rejection, export, share writes one row. Rows are immutable (no UPDATE, no DELETE). Retention per DataClassification (V10-ART-004).

**Acceptance criteria.**
- Audit log rejects update / delete.
- Every governance event (V10-ART-003 state transition, V10-ART-024 export, V10-ART-028 external share) writes a row.

**Cross-refs.** V10-ART-003, V10-ART-024.

---

<a id="v10-art-024"></a>

## V10-ART-024 — export manifest + SHA-256

**Requirement:** R-ARTIFACT-24 (P0) — export integrity chain.

**Design.** Every export produces an `ExportManifest`:

```ts
export type ExportManifest = {
  artifactId: ArtifactId;
  versionId: ArtifactVersionId;
  format: ExportFormat;            // pdf | pptx | xlsx | docx
  exportedAt: Timestamp;
  exportedBy: UserId;
  sha256: string;                  // hash of payload
  signature?: string;              // optional ECDSA signature
  lineage: VersionRef[];           // all ancestor versions
  sources: EvidenceRef[];          // every source that contributed
  watermark?: WatermarkSpec;
  confidentialityTags: string[];
  destination: ExportDestination;  // email | link | download
};
```

Manifest preview is shown to the user before download enables (gated by V10-ONB-015). SHA-256 is computed after serialisation; manifest is stored server-side + embedded as `.manifest.json` sidecar.

**Acceptance criteria.**
- Every export has a manifest.
- Client-side hash equals server-side hash (integrity verifiable).
- Manifest is human-readable JSON.

**Test strategy.**
- Integration: export PDF → SHA-256 matches server → re-export same version produces same hash.

**Cross-refs.** V10-ONB-015, V10-ART-025.

---

<a id="v10-art-025"></a>

## V10-ART-025 — watermark + provenance footer

**Requirement:** R-ARTIFACT-25 (P0) — external share carries verifiable provenance.

**Design.** External shares embed a footer (PDF footer / last slide / last row) with artifact ID, version, reviewer, date, SHA-256 prefix (first 12 chars). Watermark is optional per tenant policy (e.g. "CONFIDENTIAL — Client X").

**Acceptance criteria.**
- Every externally shared artifact has a provenance footer.
- Watermark respects tenant policy.

**Cross-refs.** V10-ART-024, V10-ART-028.

---

<a id="v10-art-026"></a>

## V10-ART-026 — library folders

**Requirement:** R-ARTIFACT-26 (P0) — standard library destinations.

**Design.** Per-tenant library with four folders: `Drafts`, `Approved`, `Exported`, `Templates`. Artifacts transition between folders based on ReviewState + export events. Templates are user-saved for reuse (V10-ART-027).

**Cross-refs.** V10-ART-003, V10-ONB-014.

---

<a id="v10-art-027"></a>

## V10-ART-027 — template fingerprint + reuse

**Requirement:** R-ARTIFACT-27 (P1) — reusable templates from approved artifacts.

**Design.** On approval, `computeTemplateFingerprint(artifact)` hashes the canonical structure (minus content). Next session can suggest "reuse this template" based on fingerprint match. User can save-as-template explicitly.

**Cross-refs.** V10-ART-005.

---

<a id="v10-art-028"></a>

## V10-ART-028 — role-based approval gates

**Requirement:** R-ARTIFACT-28 (P0) — reviewer type varies by context.

**Design.** Approval routing table: CFO artifact types require Finance reviewer; Legal-tagged content requires Legal reviewer; Restricted artifacts require CISO reviewer. Routing table is tenant-configurable. Default routes for standard personas.

**Cross-refs.** V10-ART-004, V10-ART-003.

---

<a id="v10-art-029"></a>

## V10-ART-029 — CRDT replicated state (design)

**Requirement:** R-ARTIFACT-29 (P1) — V2 collaboration model.

**Design.** Wave C only. Choose between Yjs and Automerge (master plan §10 D-4). Define serde, document identity, presence protocol. Do not ship in Wave A or B.

**Cross-refs.** V10-ART-030, V10-ART-031.

---

<a id="v10-art-030"></a>

## V10-ART-030 — real-time presence + cursors

**Requirement:** R-ARTIFACT-30 (P2) — multiplayer UI.

**Design.** Wave C only. Presence channel (awareness protocol). Cursor rendering + user colour + name tag.

**Cross-refs.** V10-ART-029.

---

<a id="v10-art-031"></a>

## V10-ART-031 — cross-replica merge + conflict markers

**Requirement:** R-ARTIFACT-31 (P1) — concurrent editing correctness.

**Design.** Wave C only. Automatic merge on convergence; explicit conflict markers when CRDT cannot resolve (e.g. both replicas delete the same node). User resolves via approval UI.

**Cross-refs.** V10-ART-029.

---

## Test strategy (aggregate)

**Layers.** Each ticket has unit + integration + E2E where applicable. The suite covers:

- 31 tickets × unit (≥80 unit tests)
- Per-type schema serde tests (7 types × ≥3 tests each)
- Per-op reversibility tests (5 op types × property-based)
- ArtifactStore CRUD + search latency benchmarks
- E2E: `slide_deck` full lifecycle (create → mutate → approve → export → SHA-256 verify)
- Chaos: optimistic concurrency conflict, version collision, orphan anchors
- Security: tenant isolation, ACL inheritance

**Pre-release gate.** Before ARTIFACT block ships in Wave A, `slide_deck` end-to-end is ≥99% green in E2E, SHA-256 matches across 1000 export samples, no-silent-write lint catches 100% of synthetic violations.

## MVP exit criteria (Wave A slice)

Artifact block ships in Wave A only if:

1. `slide_deck` full lifecycle works end-to-end (create → mutate → approve → export → manifest + SHA-256).
2. `Artifact` + `MutationProposal` + `ArtifactVersion` persisted in Postgres.
3. No-silent-writes lint + runtime assertion active.
4. ReviewState FSM enforces approved immutability.
5. Export manifest format finalised and includes SHA-256 + lineage.
6. ArtifactStore search P90 ≤ 200 ms.
7. Library folders exist; CFO workspace seeds them on bootstrap.
8. Audit trail append-only.
9. `ff.artifact_slide_deck`, `ff.artifact_mutation_proposal`, `ff.artifact_export_manifest` flags registered and default-off.
10. All 24 P0 tickets marked ✅ for Wave A scope (V10-ART-001..013, 016, 022..026).

## Rollout order

1. **Core model** (V10-ART-001 → 002 → 004 → 005) — identity, type, classification, lineage.
2. **FSM + store** (V10-ART-003 → 022 → 023) — state machine, persistence, audit.
3. **Mutation contract** (V10-ART-007 → 008 → 009 → 010 → 011) — proposal envelope, typed ops, lint-enforced writes.
4. **Partial + undo** (V10-ART-012 → 013) — per-op approval, reversible txn.
5. **Slide deck type** (V10-ART-006 → 016) — Wave A MVP target.
6. **Export chain** (V10-ART-024 → 025) — manifest + watermark.
7. **Library** (V10-ART-026) — drafts/approved/exported/templates.
8. **Wave B additions** — V10-ART-014, 015, 017..021, 027, 028.
9. **Wave C — CRDT** — V10-ART-029 → 030 → 031.

## Cross-refs to sibling dev plans

| Depends on | What's needed from the other block |
|---|---|
| `REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md` | TrustBundle hash (for MutationProposal evidence binding) |
| `AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md` | ExecutionProposalV1 severity ladder (MutationProposal is a sibling envelope for content mutations) |
| — | Onboarding (V10-ONB-011, 014, 015) consumes Artifact block; Artifact doesn't depend on Onboarding. |
| `DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md` | research_report schema consumer (V10-ART-020) |
| `ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md` | Investor pack as artifact; KPI snapshots stored as spreadsheet artifacts |
| `ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md` | Source evidenceRefs come from Connectors' retrieval pipeline |

Artifact is one of two **foundation** blocks (along with Reasoning); the other 6 blocks depend on it.

## Flags to register at implementation time

31 flags total (`ff.artifact_*`). Key flags for Wave A MVP:

- `ff.artifact_unified_model` (V10-ART-001)
- `ff.artifact_type_registry` (V10-ART-002)
- `ff.artifact_review_state_machine` (V10-ART-003)
- `ff.artifact_classification` (V10-ART-004)
- `ff.artifact_lineage_graph` (V10-ART-005)
- `ff.artifact_mutation_proposal` (V10-ART-007)
- `ff.artifact_typed_ops` (V10-ART-008)
- `ff.artifact_no_silent_writes` (V10-ART-010) — **on-by-construction**
- `ff.artifact_approve_edit_reject` (V10-ART-011)
- `ff.artifact_partial_accept` (V10-ART-012)
- `ff.artifact_one_step_undo` (V10-ART-013)
- `ff.artifact_slide_deck` (V10-ART-016)
- `ff.artifact_store` (V10-ART-022)
- `ff.artifact_audit_trail` (V10-ART-023) — **on-by-construction**
- `ff.artifact_export_manifest` (V10-ART-024)
- `ff.artifact_watermark_footer` (V10-ART-025)
- `ff.artifact_library_folders` (V10-ART-026)

Wave B flags: `ff.artifact_memo`, `ff.artifact_spreadsheet`, `ff.artifact_decision_doc`, `ff.artifact_research_report`, `ff.artifact_comments`, `ff.artifact_selection_aware`, `ff.artifact_cross_transform`, `ff.artifact_template_reuse`, `ff.artifact_role_approvals`.

Wave C flags: `ff.artifact_crdt_design`, `ff.artifact_presence`, `ff.artifact_merge_conflicts`.

All default-off except `ff.artifact_no_silent_writes` and `ff.artifact_audit_trail` (safety invariants).
