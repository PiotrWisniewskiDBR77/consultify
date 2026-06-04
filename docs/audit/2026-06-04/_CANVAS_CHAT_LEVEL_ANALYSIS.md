# Canvas (Chat Level) — Deep Code-Verified Analysis

**Date:** 2026-06-04
**Scope:** The "Canvas" = the chat split-view rich-document surface (TipTap editor) that Teresa collaborates on. DISTINCT from "Ideas" (My Work tools).
**Method:** Code-read of `src/components/AIChat/CanvasEditor/*`, `WorkCanvasDocumentPanel.tsx`, `UnifiedChatPanel.tsx`, `server/src/routes/ai.routes.ts`, `server/src/routes/work-canvas.routes.ts`. All `:line` refs verified against the working tree on branch `feat/wave1-foundations`.

---

## 1. Executive Summary

**Overall excellence score: 62 / 100** ("solid, shipping-grade, but not yet world-class").

The chat-level Canvas is a **genuinely functional, well-architected document collaboration surface** — not a stub. It has a real TipTap v3 editor with a sensible extension set, markdown-canonical storage, an inline accept/reject AI-diff flow, live streaming of Teresa's writing into the document, optimistic-concurrency autosave, and server-side version snapshots with restore. The Teresa↔Canvas loop is decoupled via a `canvas-stream-request` CustomEvent (clean), and the context packet (`canvas-context/v1`) is rich and schema-versioned.

What holds it back from world-class (ChatGPT Canvas / Claude Artifacts / Notion AI):

- **Two divergent AI paths** with different fidelity: the *floating menu* uses a cheap non-streaming `/chat/quick` endpoint that **does NOT receive the context packet** (only raw selected text); the *chat-driven stream* uses the full `/chat/stream` path WITH the packet. Inconsistent intelligence depending on entry point.
- **Streaming has no diff/preview** — it inserts raw chunks live with no accept/reject, no per-chunk markdown reparse, and the `aiRemoved`/`aiAdded` green-add mark is not applied to streamed text (only the simpler floating-menu path gets real diff visualization).
- **Intent detection is regex-gated** (`detectCanvasWriteIntent`) — brittle, English/Polish-only, easy to miss or mis-fire vs. a model-decided tool call.
- **No section/anchor targeting** — Teresa appends at end or replaces the current selection; she cannot target "the 2nd paragraph" or a named heading the way ChatGPT Canvas / Notion AI can.
- **Markdown round-trip lossiness** — TipTap HTML ↔ Turndown/marked conversion on every keystroke debounce and every stream-complete; custom nodes (Callout, Details) have no markdown serializer, so they degrade on round-trip.

**Strongest dimension:** Persistence & versioning (78). **Weakest:** AI floating/bubble menu fidelity + Streaming UX (both ~48–52).

---

## 2. Architecture Overview

### Component map

```
UnifiedChatPanel.tsx  (chat composer + canvas state owner)
 ├─ activeCanvasDocument / activeCanvasSelection state        :584-587
 ├─ buildCanvasContextPacket(doc, sel) → canvas-context/v1    :143-255
 ├─ detectCanvasWriteIntent(text) → 'append'|'replace'|null   :2114  (impl in canvasStreamIntentDetector.ts)
 └─ dispatch CustomEvent('canvas-stream-request', {...})      :2145-2155
        │  (decoupled bridge — no editor ref threaded through chat tree)
        ▼
WorkCanvasDocumentPanel.tsx  (the split-view document host, 3548 lines)
 ├─ window.addEventListener('canvas-stream-request', …)       :1282-1303
 ├─ useCanvasAIStream({ editor: richEditor, onComplete })     :1277-1280
 ├─ persistDraft() w/ optimistic concurrency (409 retry)      :905-1012
 ├─ autosave debounce 1400ms                                  :1578-1599
 ├─ loadVersions() / restoreVersion()                         :1983-2019
 └─ <CanvasRichEditor … onEditorReady={setRichEditor}/>       :3471-3493
        ▼
CanvasEditor/
 ├─ CanvasRichEditor.tsx     TipTap useEditor host            (287 ln)
 ├─ canvasEditorExtensions.ts  StarterKit + tables/tasks/etc  (58 ln)
 ├─ canvasAIDiffExtensions.ts  aiAdded / aiRemoved marks      (55 ln)
 ├─ canvasDiffOps.ts         apply/accept/reject diff (pure)  (103 ln)
 ├─ canvasMarkdownConversion.ts  marked ↔ turndown            (57 ln)
 ├─ CanvasAIFloatingMenu.tsx selection bubble + accept bar    (249 ln)
 ├─ CanvasEditorToolbar.tsx  formatting buttons               (201 ln)
 ├─ useCanvasAIStream.ts     SSE → editor.insertContent       (220 ln)
 └─ canvasViewMode.ts        rich|document|md persistence      (35 ln)

Backend:
 server/src/routes/ai.routes.ts
   ├─ POST /chat/stream  — reads context.canvasContextPacket  :1735-1797
   │     → builds canvasContextInstruction, prepends to prompt :1810-1813
   └─ POST /chat/quick   — inline fragment edit, NO packet    :5338-5394
 server/src/routes/work-canvas.routes.ts
   ├─ PUT/POST /drafts   — draft persistence + baseUpdatedAt
   └─ createVersionSnapshot() → work_canvas_versions table     :1886-1921
```

### Data-flow (storage model)

Markdown is **canonical** (`contentMd`). On load: `contentMd → marked → HTML → editor.setContent` (`CanvasRichEditor.tsx:71`, `:108`). On edit: debounced 300ms `editor.getHTML() → turndown → md → onContentChange` (`:72-81`). External markdown syncs use `emitUpdate:false` to avoid a save loop (`:108`). Selection is captured as `{selectedText, from, to}` (ProseMirror positions) and bubbled up with `mode:'rich'` and `startOffset/endOffset` preserved (`WorkCanvasDocumentPanel.tsx:3474-3487`) — good, positions survive to the chat side.

---

## 3. The Teresa↔Canvas Collaboration Loop

There are **two distinct loops**. Distinguishing them is the single most important finding.

### Loop A — Floating-menu inline edit (non-streaming, `/chat/quick`)

1. User selects text → `onSelectionUpdate` sets `selection` (`CanvasRichEditor.tsx:82-94`).
2. `CanvasAIFloatingMenu` renders above selection; user picks a quick action (Expand/Shorten/Rewrite/Translate EN/PL — `CanvasAIFloatingMenu.tsx:25-56`) or types a custom prompt.
3. `handleAIRequest` POSTs to **`/api/ai/chat/quick`** with `{ message: prompt + selectedText, context: { source:'canvas_selection', selectedText } }` (`CanvasRichEditor.tsx:127-152`). **No context packet, no document, no memory** — only the raw selected fragment.
4. Server `/chat/quick` (`ai.routes.ts:5338`) runs a BUDGET-tier model with a terse "return only the modified fragment" system prompt (`:5363-5368`), bypassing the governance path deliberately.
5. Response → `applyAiDiff(editor, {from,to}, replacement)` marks original `aiRemoved`, inserts replacement `aiAdded`; inserted span measured via doc-size delta, not string length (`canvasDiffOps.ts:64-85`) — correct for multi-node replacements.
6. `AIAcceptRejectBar` shows; **Accept** deletes `aiRemoved` ranges + strips `aiAdded` marks; **Reject** deletes `aiAdded` + restores original (`canvasDiffOps.ts:91-103`). Both persist via `htmlToMarkdown` → `onContentChange` (`CanvasRichEditor.tsx:177-202`).

→ This loop has **proper diff visualization + accept/reject** but **weak context** (no packet).

### Loop B — Chat-driven streaming write (`/chat/stream`)

1. In the chat composer, with a canvas open, the user message hits `detectCanvasWriteIntent(text)` (regex) → `'append'|'replace'` (`UnifiedChatPanel.tsx:2114`).
2. If matched: `buildCanvasContextPacket(activeCanvasDocument, activeCanvasSelection)` builds the `canvas-context/v1` packet (`:2134-2137`), chat history is mapped, and a `canvas-stream-request` CustomEvent is dispatched (`:2145-2155`). A placeholder "Writing in the document…" bubble is added to chat.
3. `WorkCanvasDocumentPanel` listener (`:1282-1303`) calls `streamToCanvas(prompt, mode, {history, language, canvasContextPacket})`.
4. `useCanvasAIStream` captures pre-edit doc + selection, sets insertion point (append→focus end + `\n\n`; replace→mark selection `aiRemoved`), builds a `systemInstruction` embedding the current doc (≤12k chars) + selected portion (≤4k) + mode guidance (`useCanvasAIStream.ts:69-107`), then POSTs to **`/api/ai/chat/stream`** with `context.canvasContextPacket` (`:111-130`).
5. Server `/chat/stream` reads `context.canvasContextPacket` (`ai.routes.ts:1735`), renders a `canvasContextInstruction` (schema, draft title/kind/lifecycle, selected text, memory summary, block summaries, workflow runs/events/outputs — `:1740-1796`), and prepends it to the Teresa workspace system prompt (`:1810-1813`).
6. SSE chunks stream back; each is `editor.commands.insertContent(chunk)` live (`useCanvasAIStream.ts:160-182`). On complete, for `replace` mode the `aiRemoved` original is deleted (`:194-202`), final markdown reconciled via `onComplete → updateMarkdown` (`:203-204`, panel `:1279`).

→ This loop has **rich context (full packet)** but **no accept/reject, no green-add diff on streamed text, no preview** — Teresa's output lands directly in the document and can only be undone via Ctrl-Z / version restore.

**The asymmetry is the core gap:** the smart path (B) has no safety/diff UX; the safe path (A) is context-starved.

---

## 4. Excellence Scorecard

| # | Dimension | Score | Evidence |
|---|-----------|------:|----------|
| 1 | Editor quality | **68** | TipTap v3 StarterKit (H1-3), Highlight, Link, Tables (resizable), TaskList, TextAlign, Underline, Callout/Details nodes reused from Notebook (`canvasEditorExtensions.ts:28-58`). Toolbar: undo/redo, bold/italic/strike/code, highlight, H1-3, lists, tasks, quote, link, table (`CanvasEditorToolbar.tsx`). Solid. Gaps: no slash menu (chat canvas — Notebook has one), no image/embed, no code-block language, no drag handles, custom nodes lack markdown serializers (round-trip loss). |
| 2 | Teresa↔Canvas loop | **60** | Decoupled CustomEvent bridge is clean (`UnifiedChatPanel.tsx:2145`, panel `:1282`). Pre-edit state captured correctly (`useCanvasAIStream.ts:69-73`). But two divergent paths with inconsistent context fidelity; replace-delete only fires on non-abort completion; no anchor/section targeting. |
| 3 | AI floating/bubble menu | **52** | Real menu w/ 5 quick actions + custom prompt + accept/reject diff (`CanvasAIFloatingMenu.tsx`). But: custom-positioned `div` (not TipTap BubbleMenu → can mis-position on scroll, uses `window.getSelection` rect `:88-98`); **only 5 fixed actions**; **no document context** sent (`/chat/quick`); no "ask follow-up", no tone/length presets beyond the 5. World-class has tone/grammar/length/translate + arbitrary instruction WITH full doc awareness. |
| 4 | Context fidelity | **70** | `canvas-context/v1` is genuinely rich: activeDraft (id/title/kind/lifecycle/saveState), markdownProjection (≤6k), selection w/ positions, block summaries (≤12), workflow runs/events/outputs, memorySnapshot w/ anchors + explicit `limitations` note (`UnifiedChatPanel.tsx:143-255`). Server actually consumes it (`ai.routes.ts:1735-1797`). Schema-versioned. **But** the floating-menu path bypasses it entirely, and `markdownProjection` truncation at 6k can silently drop late-document context. |
| 5 | Streaming UX | **48** | Live `insertContent` per chunk works; "Teresa is writing…" indicator + Stop button (`CanvasRichEditor.tsx:251-281`, abort wired `useCanvasAIStream.ts:50-54`). But: raw chunk insertion means **partial markdown renders as literal text mid-stream** (no incremental reparse); **no green aiAdded mark on streamed text**; **no accept/reject** — output is committed; cursor/scroll-follow not managed; replace-mode shows strikethrough original until completion only. |
| 6 | Persistence & versioning | **78** | Autosave debounce 1400ms gated on dirty state (`WorkCanvasDocumentPanel.tsx:1578-1599`); `persistDraft` with **optimistic concurrency** (`baseUpdatedAt`, 409 `CANVAS_DRAFT_CONFLICT` → refetch + retry, `:950-969`); last-draft-id in localStorage (`:986`); server `createVersionSnapshot` → `work_canvas_versions` table (`work-canvas.routes.ts:1886-1921`); version list + prev/next stepper + restore in UI (`:1983-2019`, `:3271-3320`). Strong. Gaps: no per-edit attribution (who/Teresa vs user) surfaced in version UI; no real-time multi-user/CRDT; markdown-canonical means custom-node fidelity not versioned losslessly. |
| 7 | Excellence vs world-class | **52** | See §5. Functional parity on *editing + versioning*; behind on *streaming diff UX, anchored edits, unified context, model-decided actions, slash/inline-AI ergonomics*. |

**Weighted overall: ≈62/100.**

---

## 5. Gaps & Prioritized Roadmap to World-Class

Ordered by impact / effort.

### P0 — Unify the two AI paths (impact: high, effort: medium)
The floating menu must use the same context-rich backend as the stream. Route `/chat/quick` calls through a path that accepts `canvasContextPacket` (or send the packet in the `/chat/quick` body and have `ai.routes.ts:5343` read+render it like `:1735-1797`). Without this, "Ask Teresa" on a selection is dumber than asking her in chat.
- Files: `CanvasRichEditor.tsx:127-152` (add packet to body), `ai.routes.ts:5343-5368` (consume packet).

### P0 — Add diff/accept-reject to STREAMING writes (impact: high, effort: high)
Today streamed text is committed with no preview. Wrap streamed insertions in the `aiAdded` mark and present the existing `AIAcceptRejectBar` on completion (reuse `canvasDiffOps.ts` accept/reject). For `replace`, you already mark `aiRemoved` — extend the same to `append`/`generate`.
- Files: `useCanvasAIStream.ts:160-204`, `canvasDiffOps.ts`, `CanvasRichEditor.tsx:242-248`.

### P1 — Replace regex intent detection with model-decided tool/action (impact: high, effort: medium)
`detectCanvasWriteIntent` (`canvasStreamIntentDetector.ts`) is brittle (EN/PL regex, verb+target required). Move the "write into canvas vs chat" decision to the model via a tool/function-call or a structured classifier, so phrasings like "make it punchier" or non-EN/PL languages work.
- Files: `canvasStreamIntentDetector.ts`, `UnifiedChatPanel.tsx:2114`.

### P1 — Incremental markdown reparse during streaming (impact: medium, effort: medium)
Raw `insertContent(chunk)` shows literal `##`, `**`, `|` mid-stream. Buffer at block boundaries and reparse markdown → HTML per completed block (or use a streaming markdown tokenizer), matching ChatGPT Canvas / Claude Artifacts render-as-you-go.
- Files: `useCanvasAIStream.ts:160-182`, `canvasMarkdownConversion.ts`.

### P1 — Anchored / section-targeted edits (impact: high, effort: high)
Teresa can only append-at-end or replace-selection. Add heading/section anchors (the packet already has `blockIds` + positions). Let the user (or Teresa) target "rewrite the Risks section" by mapping to a ProseMirror range.
- Files: `useCanvasAIStream.ts:75-89`, `buildCanvasContextPacket` (emit heading anchors), `ai.routes.ts:1740`.

### P2 — Markdown serializers for custom nodes (impact: medium, effort: medium)
Callout/Details nodes (`canvasEditorExtensions.ts:51-54`) have no Turndown rule → round-trip to markdown loses them (only the taskList rule exists in `canvasMarkdownConversion.ts:32-42`). Add Turndown rules or move canonical storage to ProseMirror JSON (the type system already allows `canonicalFormat:'json'`).
- Files: `canvasMarkdownConversion.ts`, `canvasEditorExtensions.ts`.

### P2 — Floating menu → TipTap BubbleMenu + richer actions (impact: medium, effort: low-medium)
Swap the hand-rolled `window.getSelection()` positioner (`CanvasAIFloatingMenu.tsx:74-99`) for TipTap's `BubbleMenu` (scroll-stable), and expand actions: tone presets, fix-grammar, change-length slider, "continue from here", arbitrary instruction with doc context.
- Files: `CanvasAIFloatingMenu.tsx`.

### P2 — Version attribution + Teresa-vs-user provenance (impact: low-medium, effort: low)
`createVersionSnapshot` stores `operation_type` + `created_by` (`work-canvas.routes.ts:1886-1921`) but the version UI (`WorkCanvasDocumentPanel.tsx:3271-3320`) doesn't surface who/what produced each version. Show "Teresa edit" vs "Manual" badges.

### P3 — Truncation safety (impact: low, effort: low)
`markdownProjection` caps at 6k (`buildCanvasContextPacket:227`) and the stream's inline doc at 12k (`useCanvasAIStream.ts:101`). For long docs Teresa silently loses the tail. Add summarization or windowing around the edit point.

---

## Appendix — Key file:line index

- Context packet builder + schema `canvas-context/v1`: `src/components/AIChat/UnifiedChatPanel.tsx:143-255`
- Intent detection: `src/components/AIChat/canvasStreamIntentDetector.ts:13-60`
- CustomEvent dispatch: `UnifiedChatPanel.tsx:2145-2155`; listener: `WorkCanvasDocumentPanel.tsx:1282-1303`
- Streaming hook (SSE→editor): `src/components/AIChat/CanvasEditor/useCanvasAIStream.ts:56-217`
- Inline diff ops (apply/accept/reject): `src/components/AIChat/CanvasEditor/canvasDiffOps.ts:64-103`
- Diff marks: `canvasAIDiffExtensions.ts`
- Editor host: `CanvasRichEditor.tsx:42-285`; extensions `canvasEditorExtensions.ts:28-58`
- Floating menu + accept bar: `CanvasAIFloatingMenu.tsx`
- Markdown round-trip: `canvasMarkdownConversion.ts`
- Backend stream + packet rendering: `server/src/routes/ai.routes.ts:1735-1813`
- Backend inline-edit (no packet): `ai.routes.ts:5338-5394`
- Draft persistence + concurrency: `WorkCanvasDocumentPanel.tsx:905-1012`; autosave `:1578-1599`
- Versions: `WorkCanvasDocumentPanel.tsx:1983-2019`; server snapshot `server/src/routes/work-canvas.routes.ts:1886-1921`
