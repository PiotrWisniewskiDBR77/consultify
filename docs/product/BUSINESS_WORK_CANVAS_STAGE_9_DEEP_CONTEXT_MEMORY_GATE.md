# Business Work Canvas Stage 9 Deep Context Memory Gate

Status: `DRAFT / STAGE 9 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 9 locks the context preservation contract between chat, Teresa and Work Canvas.

The goal is to make the active Canvas usable as working memory without leaking raw native block JSON or creating silent automation. Teresa receives a structured context packet built from Markdown projection, selected text, block summaries, workflow anchors and lineage.

## 2. Completed Scope

Stage 9 baseline includes:

- `canvas-context/v1` packet generated while Canvas is open,
- active draft anchors: `draftId`, title, kind, lifecycle, save state and projection status,
- Markdown projection truncation for safe prompt size,
- selected text snapshot when selection is active,
- block summaries with block id, kind, title, status and Markdown projection,
- workflow run anchors and step summaries,
- linked output summaries,
- memory snapshot with draft, workflow and block anchors,
- user message metadata storing the safe Canvas context summary,
- backend system-instruction injection for Teresa,
- Wave 6 context snapshot facts for Canvas draft, blocks and workflow ids,
- regression tests for active Canvas context and selected Canvas context.

## 3. Safety Contract

The Canvas context packet must not include raw native block JSON.

Allowed:

- Markdown projection,
- selected text,
- block id/kind/title/status,
- workflow id/title/status,
- linked output id/type/title/url,
- memory snapshot anchors.

Not allowed by default:

- full `block.data`,
- raw dataset rows,
- hidden proposal payloads,
- unapproved downstream mutations.

## 4. Teresa Context Contract

When chat sends a request while Canvas is open, Teresa receives:

- legacy `canvasContext` for compatibility,
- `canvasContextPacket` for structured reasoning,
- `canvasMemorySnapshot` for memory capture,
- conversation id and screen/workspace context.

Teresa should use the packet as working memory, not as permission to mutate durable state. State-changing work still requires approval through the governed flow.

## 5. Quality Gate

Stage 9 passes only when:

- open Canvas -> send chat includes active draft context,
- selected Canvas text is included in the packet,
- workflow and block anchors are preserved,
- raw native block JSON is not sent by default,
- user message metadata stores a safe memory snapshot,
- backend includes Canvas context in Teresa's instruction/memory facts,
- targeted tests pass,
- changed files have no linter errors.

Stage 9 fails if:

- Canvas context disappears when sending chat,
- selected text attaches to the wrong draft,
- Teresa receives raw native block JSON by default,
- memory snapshot loses workflow or block anchors,
- context injection creates silent execution.

## 6. Next Stage

The next stage should focus on hardening autosave/base-version conflict handling and productionizing broader rollout gates.
