# ADR-V10-004: CRDT vendor choice deferred to Wave C; design leans Yjs

- **Status:** Accepted (2026-04-18)
- **Decision-makers:** CTO, product lead
- **Master plan row:** D-4 · [§10](../CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md#sec-10-open-decisions)

## Context

The Artifact Runtime block (master plan §1.1 · block 2) specifies an
`Artifact` abstraction with collaborative editing as a Wave C goal.
CRDTs (Conflict-free Replicated Data Types) are the canonical substrate
for multi-user live editing and offline reconciliation. The two
mainstream options today are Yjs and Automerge; a third in-house
option (bespoke OT) was briefly floated.

The decision is whether we lock the vendor now (scaffolding bakes in
Yjs-specific APIs) or defer (abstract behind a vendor-neutral
interface and pick at Wave C start).

## Options considered

- **Option A (chosen):** Defer vendor pick to Wave C start. Artifact
  Runtime dev plan (§MVP..§Wave B) uses a vendor-neutral
  `CollaborativeDocument` interface; the concrete CRDT lives behind
  a single implementation file. Design notes lean Yjs.
- **Option B:** Commit to Yjs now. Dev plan references `Y.Doc`,
  `Y.Map`, `Y.Array` directly. No abstraction layer.
- **Option C:** Commit to Automerge now.

## Decision

Vendor selection is deferred. The artifact dev plan's abstraction
surface (`CollaborativeDocument`, `DocumentPatch`, `ReviewState`) has
no vendor-specific types. The concrete binding ships in Wave C and
triggers a follow-up ADR that supersedes this one.

Design leaning is documented as Yjs, to be confirmed at Wave C gate.

## Rationale

- **MVP and Wave A + B do not need live collaboration.** The artifact
  surface is single-user-edit-then-propose-review up through Wave B
  (see Artifact Runtime dev plan §MVP). Writing Yjs-specific code now
  would be dead-weight until Wave C.
- **Ecosystem & enterprise track record favour Yjs.** Yjs has the
  larger plugin ecosystem (prosemirror, monaco, quill, tiptap), mature
  provider implementations (y-websocket, y-indexeddb), and multiple
  enterprise references. Automerge has a cleaner data model (document
  as JSON patch history) but a smaller production footprint. Neither
  gap is critical at MVP, but both favour Yjs when the choice must be
  made.
- **Asymmetric reversal cost.** Picking Yjs now and switching later is
  expensive (rewriting every `Y.Doc` reference). Deferring costs
  nothing — the abstraction layer is 1 file.
- **Option C rejected:** Automerge 2's performance story is compelling
  but the ecosystem gap remains material; deferring keeps Automerge
  in the running without committing.

## Consequences

- Artifact Runtime dev plan (Wave A..B) uses only the vendor-neutral
  interface. No CRDT vendor appears in `package.json` until Wave C.
- A new ADR (planned as ADR-V10-0NN, number TBD at Wave C start) will
  supersede this one with the concrete vendor pick. That ADR will
  include the Wave C review findings (latency, memory, bundle size
  measurements).
- Wave A + B bring their own, simpler reconciliation (last-write-wins
  with server-side optimistic locking) behind the same abstraction,
  sufficient for the single-user edit workflow.
- If Wave C opens with the CRDT vendor still unpicked, the Wave C
  gate check fails. This is intentional — CRDT binding is on the
  critical path for Wave C multi-user artifacts.

## Execution notes

- The abstraction lives in `src/services/artifacts/collaboration/`
  (not yet created).
- The Yjs leaning is captured in the Artifact Runtime dev plan
  §"Vendor assessment" section for convenience, but has no binding
  force until the Wave C ADR lands.
