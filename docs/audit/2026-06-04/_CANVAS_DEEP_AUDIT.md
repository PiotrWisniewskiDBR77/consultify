# Canvas (Chat Split-View) — DEEP Code-Verified Audit (Round 2)

**Date:** 2026-06-04
**Scope:** The chat split-view Canvas (TipTap editor + Teresa streaming + floating menu + autosave + versions). **Not** the My Work "Ideas" tools.
**Method:** Line-by-line read of `src/components/AIChat/CanvasEditor/*`, `WorkCanvasDocumentPanel.tsx`, `canvasStreamIntentDetector.ts`, `UnifiedChatPanel.tsx` (canvas section), `server/src/routes/work-canvas.routes.ts`, `server/src/routes/ai.routes.ts` (`/chat/stream`, `/chat/quick`), `canvasMarkdownConversion.ts`, `canvasDiffOps.ts`, `canvasAIDiffExtensions.ts`, `canvasEditorExtensions.ts`, `useCanvasAIStream.ts`, `CanvasAIFloatingMenu.tsx`, `CanvasEditorToolbar.tsx`, `MyWork/notebook/extensions.ts`, `validators/ai.validators.ts`.
**Branch:** `feat/wave1-foundations` (clean tree).
**Prior pass:** `_CANVAS_CHAT_LEVEL_ANALYSIS.md` (62/100). This pass digs deeper and **revises down**.

---

## 1. Executive summary

### Revised score: **54 / 100** (down from 62)

The first pass treated Canvas as "solid, shipping-grade, but not world-class". A closer reading exposes load-bearing **silent data-loss** and **state-coherence** failures the first audit missed. The previous "Persistence & versioning: 78" is the most over-stated dimension — autosave writes **never create a version snapshot**, and Callout/Details nodes are **lossily round-tripped on every keystroke**. The diff/accept-reject pipeline has measurable edge-case bugs. The streaming hook leaks aborts on unmount and inserts at the live cursor rather than the captured insertion point. The floating menu is fully unauthenticated against abuse (no rate-limit, no quota, no length cap on `message`).

Score moves to **54** because:
- Versioning UX is real but the backing data is empty for ~all real edits → effectively a fake feature for the rich editor path (−10 to that dimension).
- Markdown round-trip is data-lossy for two custom nodes loaded into the editor (−4 to editor quality).
- Streaming has uncontrolled insertion point + no unmount cleanup (−4 to streaming UX).
- Two AI paths still diverge (carried forward from R1).
- Two new positives: optimistic concurrency conflict path is genuinely correct; `applyAiDiff` correctly measures inserted span by doc-size delta (R1 already noted).

**Strongest:** Optimistic concurrency / 409 retry (90). **Weakest:** Effective version coverage (15), accessibility (10), abuse hardening on `/chat/quick` (20).

---

## 2. Layer A — Editor (TipTap)

### A.1 Versions / extension inventory

`package.json` → TipTap `^3.14.0`. Extensions wired in `src/components/AIChat/CanvasEditor/canvasEditorExtensions.ts:28-58`:

| Extension | Source | Notes |
|---|---|---|
| `StarterKit` (heading L1–3) | `@tiptap/starter-kit` | `link:false`, `underline:false` to avoid duplicates |
| `Highlight(multicolor:true)` | `@tiptap/extension-highlight` | |
| `Link(openOnClick:false, autolink:true)` | `@tiptap/extension-link` | |
| `Placeholder` | `@tiptap/extension-placeholder` | |
| `Table(resizable:true)` + Row/Header/Cell | `@tiptap/extension-table*` | |
| `TaskList`/`TaskItem(nested:true)` | `@tiptap/extension-task-{list,item}` | |
| `TextAlign({types:['heading','paragraph']})` | `@tiptap/extension-text-align` | |
| `Underline` | `@tiptap/extension-underline` | |
| `CalloutNode`, `DetailsNode`, `DetailsSummaryNode`, `DetailsContentNode` | Notebook reuse, `MyWork/notebook/extensions.ts:15-127` | **No markdown serializer** |
| `AIAddedMark`, `AIRemovedMark` | `canvasAIDiffExtensions.ts:9-55` | `<span data-ai-added>` / `data-ai-removed` |

**Missing vs world-class:** no `Image`, no `Color` (despite `@tiptap/extension-color` being in package.json — never loaded here), no `CodeBlockLowlight`, no `Dropcursor`, no `Gapcursor`, no `Mention`, no `BubbleMenu`/`FloatingMenu` (hand-rolled — see C), no slash menu, no drag handle, no paste-image-handler, no character count. The package.json carries `@tiptap/extension-color`/`text-style` but they are dead imports for Canvas (Notebook uses them).

### A.2 Custom serializers — **data loss path**

`canvasMarkdownConversion.ts:32-42` has exactly ONE custom Turndown rule (`taskListItem`). Round-trip behaviour for the loaded custom nodes:

- `CalloutNode` (`notebook/extensions.ts:15-53`) renders `<div data-callout data-variant="info|warning|success|critical">…</div>`. Turndown default: passes through inner text only. **The `variant` attribute is lost on every keystroke debounce (`CanvasRichEditor.tsx:75-80`).**
- `DetailsNode` renders `<details>…</details>` with `DetailsSummary` + `DetailsContent`. Turndown default: silently strips, summary/content collapsed into paragraphs. **Toggle/collapsible blocks degrade to flat text.**
- `Highlight` (`<mark>`): Turndown default strips, only the inner text survives.
- `Underline` (`<u>`): no markdown equivalent — Turndown strips silently.
- `TextAlign`: written as inline styles on `<p style="text-align:…">` — Turndown strips style attributes. **All alignment is lost on save.**
- `aiAdded` / `aiRemoved` marks: stripped (acceptable — these are transient).

`marked.parse(md, { gfm:true, breaks:false })` (`:50`) has no opposite-direction parser for the same nodes — even if you hand-write the markdown to recreate them, they will not survive the next round-trip.

The official escape hatch (`canonicalFormat: 'json'` on draft) exists in the type system and the server reads `contentJson` (`work-canvas.routes.ts:3245`, `:3283-3306`), but the rich editor never sets it — `persistDraft` (`WorkCanvasDocumentPanel.tsx:933-934`) only ever sends `content` and `contentMd`.

### A.3 Selection model

ProseMirror positions captured + propagated cleanly. `CanvasRichEditor.tsx:82-94` sets `{selectedText, from, to}` on every `onSelectionUpdate`; `WorkCanvasDocumentPanel.tsx:3474-3487` wraps as `{mode:'rich', startOffset:from, endOffset:to}` so the chat side keeps the real PM positions. ✅

### A.4 Editor commands exposed

The editor instance is leaked to the parent via `onEditorReady(editor)` (`:117`, `WorkCanvasDocumentPanel.tsx:3489`). There is NO formal API surface — the parent (and the stream hook) call `editor.commands.*` directly. No `insertAt(pos, content)`, no `replaceRange(from, to, content)`, no `applyDiff(range, replacement)` exposed as a typed seam — every consumer reinvents the call site. The stream hook actually owns the only documented usage.

### A.5 Performance

- Save debounce 300ms (`SAVE_DEBOUNCE_MS`) on every `onUpdate`, ⇒ a full `getHTML() → Turndown → string` runs even for one-character edits. On a 12k-char doc this is non-trivial work × every keystroke pause.
- `setContent` on external sync uses `emitUpdate:false` (`:108`) — good, no save loop.
- `markdownToHtml` runs synchronously on every external sync; no memoisation if the same MD comes through twice.
- `prose prose-sm` styling on the EditorContent — no virtualization. Large docs > a few thousand lines will hit DOM perf walls.
- Turndown instance is module-singletoned (`canvasMarkdownConversion.ts:14-46`) — ✅.

---

## 3. Layer B — Streaming → Canvas loop

### B.1 Full lifecycle

```
chat composer (text input)
 → UnifiedChatPanel.handleSendMessage (:2122)
 → detectCanvasWriteIntent(text)  ← regex gate, EN/PL only, ai-blind
 → buildCanvasContextPacket(activeCanvasDocument, activeCanvasSelection)  (:2142-2145)
 → addChatMessage('Writing in the document…')                              (:2133-2138)
 → window.dispatchEvent('canvas-stream-request', {prompt, mode, language,
                                                  canvasContextPacket, history}) (:2153-2163)
 ↓
WorkCanvasDocumentPanel listener  (:1282-1303)
 → streamToCanvas(prompt, mode, {history, language, canvasContextPacket})
 ↓
useCanvasAIStream.streamToCanvas (:56)
 → capture {selFrom, selTo}, selectedText, documentMarkdown                 (:70-73)
 → if 'append': editor.commands.focus('end') + insertContent('\n\n')        (:76-78)
   if 'replace': mark [selFrom,selTo] aiRemoved                              (:79-87)
 → insertPositionRef.current = editor.state.selection.to   ← captured but NEVER consulted later
 → build systemInstruction (≤12k doc + ≤4k selection + mode guidance)        (:94-107)
 → fetch /api/ai/chat/stream { message, history, systemInstruction,
                               context: { canvasContextPacket } }, abortable (:111-130)
 ↓
SSE loop (:142-184)
 → for every {data: …}:
     editor.commands.insertContent(chunk)   ← at LIVE cursor, NOT insertPositionRef
 → on complete (not aborted) + mode='replace':
     re-collectMarkedRanges(aiRemoved) → deleteRange in reverse              (:194-202)
 → onComplete(htmlToMarkdown(editor.getHTML()))                              (:203-204)
 ↓
WorkCanvasDocumentPanel.updateMarkdown(finalMd) (:1279)
 → setDocumentState({saveState:'unsaved'}) → autosave 1400ms (:1592)
 → PUT /api/work-canvas/drafts/:id with baseUpdatedAt                        (:917-948)
 → on 409 CANVAS_DRAFT_CONFLICT: refetch updatedAt, retry once               (:952-968)
```

### B.2 `canvasContextPacket` schema (`UnifiedChatPanel.tsx:144-256`)

```
canvas-context/v1 = {
  activeDraft: { draftId, researchSessionId, title, kind, lifecycleState,
                 saveState, markdownProjectionStatus },
  markdownProjection: <truncate(contentMd, 6000)>,
  selection: <truncate(text,2000)>|null,
  blockSummaries: ≤12 × {blockId, kind, title, status, projectionStatus,
                         markdownProjection:truncate(.,1200)},
  workflowRuns: ≤5 × {id, draftId, conversationId, template, title, status,
                      lifecycle, stepSummaries:≤8, approvalStatuses:≤8, …},
  workflowEventSummaries: last 12 × {…, summary:truncate(.,280)},
  workflowOutputSummaries: last 12 × {…, title:truncate(.,180)},
  linkedOutputs: as-is,
  memorySnapshot: { summary, anchors:{draftId, …, workflowRunIds, blockIds},
                    limitations:['Canvas packet uses Markdown projection …'] },
  schemaVersion: 'canvas-context/v1',
}
```

Server consumer: `ai.routes.ts:1735-1797` renders this into a system-prompt-prefixed `## ACTIVE WORK CANVAS CONTEXT` section. ✅ symmetrical, schema-versioned.

### B.3 Two paths — UNCHANGED since R1

`/chat/stream` (smart, packet-aware) vs `/chat/quick` (cheap, packet-blind). Nothing has been fixed since R1.

- `/chat/quick` Zod schema (`server/src/validators/ai.validators.ts:545-555`) accepts `context.passthrough()` — `canvasContextPacket` could be smuggled in but `ai.routes.ts:5364-5368` only destructures `{ source, selectedText }`. So even if the client sent it, the server would discard it. Fix is two-line on both sides.
- `/chat/quick` has NO rate limiter (`aiRateLimiter` is imported but never applied at `:5360`). Compare `/chat/stream` which does gate. **A rogue user can spin Ask-AI on selection forever.**
- `/chat/quick` accepts unbounded `message: z.string().min(1)` — no max length. The body literally embeds `${prompt}\n\nText to modify:\n${selectedText}` (`CanvasRichEditor.tsx:141`) so a user selecting an entire long document and clicking "Expand" sends the full doc as the message, paying full token cost.

### B.4 Stream → editor mutation — **NEW bug** (not flagged in R1)

`useCanvasAIStream.ts:48` declares `insertPositionRef`, sets it at `:89` to `editor.state.selection.to` post-anchor-marking, then **never reads it again**. Every chunk insertion at `:163` runs `editor.commands.insertContent(chunk)` against the live editor selection. Consequence: if the user clicks anywhere in the document during streaming, subsequent chunks are inserted at the new cursor position, fragmenting Teresa's output. The editor remains `editable={true}` during stream (`WorkCanvasDocumentPanel.tsx:3492`) — there is no read-only lock. The "Teresa is writing…" indicator is purely decorative.

### B.5 Cancel / abort / unmount — **NEW bug**

`stopStream` aborts the controller (`:50-54`) and is wired to the visible Stop button (`CanvasRichEditor.tsx:271-278`). But:

- The `useCanvasAIStream` hook returns no `useEffect` cleanup. If `WorkCanvasDocumentPanel` unmounts mid-stream (user closes the split view), the controller is never aborted; the network keeps running; chunks try to insert into a detached editor (`editor.commands.insertContent` on a destroyed editor in TipTap v3 is a no-op but burns CPU + bandwidth).
- The "Writing in the document…" placeholder chat bubble (`UnifiedChatPanel.tsx:2133-2138`) is never updated on completion / abort / failure. It stays as a misleading orphan message in the chat thread.
- On abort the `'replace'` flow does NOT delete the `aiRemoved` original (gated on `!abortController.signal.aborted` at `:190`) — correct — BUT the partial chunks already inserted between the marked-removed original and the rest of the doc remain, AND the original keeps its strikethrough mark. The editor now contains: `<aiRemoved>original</aiRemoved><non-marked partial chunks>`. The marks are not stripped on abort; the user is stuck with cosmetic strike-through until they manually re-edit.

### B.6 Partial markdown mid-stream — R1 known

`editor.commands.insertContent(chunk)` parses each chunk as HTML by default. A chunk arriving as `**foo` literally inserts `**foo`. A chunk `<table>` would be parsed as HTML — **potentially producing partial nodes** that mangle the editor schema. Same risk for any chunk containing `<` (rare for model output but real for code generation).

---

## 4. Layer C — AI floating menu / BubbleMenu

### C.1 Action inventory (`CanvasAIFloatingMenu.tsx:25-56`)

| ID | EN | PL | Prompt sent |
|---|---|---|---|
| `expand` | Expand | Rozwiń | "Expand this text with more detail." |
| `shorten` | Shorten | Skróć | "Make this text shorter and more concise." |
| `rewrite` | Rewrite | Przepisz | "Rewrite this text to be clearer and more professional." |
| `translate_en` | Translate → EN | Tłumacz → EN | "Translate this text to English." |
| `translate_pl` | Translate → PL | Tłumacz → PL | "Translate this text to Polish." |
| (custom) | Ask AI | Teresa | freeform input via `<input>` |

That is the **complete** list. No Fix grammar, no Tone (formal/casual/concise), no Continue, no Summarize, no Change length, no Format as list, no Action items.

### C.2 Context per action

All actions hit `POST /api/ai/chat/quick` (`CanvasRichEditor.tsx:134-144`) with:
- `message = prompt + '\n\nText to modify:\n' + selectedText`
- `context = { source:'canvas_selection', selectedText }`

**Zero document context. Zero memory. Zero canvasContextPacket. Zero RAG.** The model sees a fragment in isolation.

### C.3 Diff / accept-reject UX

Solid in this path. `applyAiDiff` (`canvasDiffOps.ts:64-85`) measures inserted span via `doc.content.size` delta (correct for multi-node replacements). `acceptAiDiff`/`rejectAiDiff` (`:91-103`) traverse via `descendants` with `node.isText` filter, merge adjacent ranges, delete in reverse order. The reject path persists the rollback (`CanvasRichEditor.tsx:192-202`) — R1's concern resolved.

**New issue:** `acceptAiDiff`/`rejectAiDiff` use `editor.chain().selectAll().unsetMark(…)` (`:93`, `:102`). On a 50k-char document this dispatches a transaction over the entire doc. For frequent inline edits this is wasteful — should be limited to the known affected range (or simply iterate the `aiAdded`/`aiRemoved` runs collected by `collectMarkedRanges`).

### C.4 Positioning — R1 known, deeper bug

Hand-rolled via `window.getSelection().getRangeAt(0).getBoundingClientRect()` (`:82-98`). Problems:
- Position is `position:fixed` based on `getBoundingClientRect`, captured ONCE per selection update. **It does not re-position on scroll.** Scroll the canvas → menu drifts off the screen, may overlay other UI.
- `top: rect.top - 48` is unconditional — if selection is at the very top of the viewport, menu renders at negative y (off-screen).
- No collision detection with right/left edges, no viewport clamping.
- No mobile/touch support (`window.getSelection` semantics differ on iOS).

### C.5 Keyboard shortcuts

- TipTap v3 default keymap: Bold (Ctrl+B), Italic (Ctrl+I), Underline (Ctrl+U), Strike (Ctrl+Shift+S), Code (Ctrl+E), Headings (Ctrl+Alt+1/2/3 with StarterKit), Undo/Redo (Ctrl+Z/Y), Lists (Ctrl+Shift+8/7).
- **No Canvas-specific shortcuts:** no Ctrl+K to open Ask-AI, no Cmd+Enter to apply custom prompt (only on the visible `<input>`), no Esc to close menu (only inside the input).
- Floating menu Quick Actions are mouse-only (no arrow-key navigation, no tabIndex on buttons).

---

## 5. Layer D — Persistence + versioning

### D.1 Tables

`server/src/routes/work-canvas.routes.ts:1928-2035`:

```sql
CREATE TABLE work_canvas_drafts (
  id TEXT PRIMARY KEY,
  organization_id TEXT, conversation_id TEXT,
  kind TEXT, title TEXT, content_json TEXT,
  -- new fields added via ALTER:
  canonical_format TEXT DEFAULT 'markdown',
  content_md TEXT, content_json_native TEXT, blocks_json TEXT,
  content_schema_version TEXT,
  markdown_projection_status TEXT DEFAULT 'synced',
  markdown_projected_at TEXT, markdown_projection_stale_at TEXT,
  projection_error TEXT,
  sources_json TEXT, provenance_json TEXT, project_id TEXT,
  owner_id TEXT, research_session_id TEXT,
  artifact_id TEXT, artifact_run_id TEXT, artifact_version TEXT,
  save_state TEXT, lifecycle_state TEXT, dirty_state TEXT,
  visibility TEXT, audit_status TEXT,
  created_at TEXT, updated_at TEXT
);

CREATE TABLE work_canvas_versions (
  id TEXT PRIMARY KEY,
  draft_id TEXT REFERENCES work_canvas_drafts(id) ON DELETE CASCADE,
  operation_type TEXT,
  summary TEXT,
  content_md TEXT,
  content_json_native TEXT,
  blocks_json TEXT,
  created_by TEXT,
  created_at TEXT
);
```

### D.2 Autosave / optimistic concurrency

`WorkCanvasDocumentPanel.tsx:1578-1599`: 1400 ms debounce on dirty content, calls `persistDraft`. `persistDraft` (`:905-1020`):

- Sends `baseUpdatedAt` = client-side last seen `updatedAt`.
- Server (`work-canvas.routes.ts:3157-3158`) compares — if mismatch, returns `409 { code:'CANVAS_DRAFT_CONFLICT' }`.
- Client (`:952-968`) refetches the current draft, picks up the server `updatedAt`, retries the save ONCE. ✅ correct.
- On second 409 it surfaces a save-failed message. No exponential backoff, no merge — last-write-wins after one retry.

### D.3 **Critical finding** — versions are NOT recorded for autosave

`createVersionSnapshot` callers (`work-canvas.routes.ts:1886-1922`):
- `:2829` workflow `run-next-step`
- `:3573` `POST /drafts/:id/operations` (block operations, not text edits)
- `:3656` `POST /drafts/:id/versions/:vid/restore`
- `:3772`, `:3830`, `:3899` (other workflow paths)

**`PUT /drafts/:draftId` (the route every TipTap autosave uses, `:3153-3318`) DOES NOT call `createVersionSnapshot`.** It just `UPDATE`s the row in place.

The rich editor also **never calls `/operations`** (no occurrence of `'/operations'` anywhere in `src/components/AIChat/`). So the TipTap path produces ZERO version history during normal text editing. The Versions panel in the UI (`:3271-3340`) will show nothing — or, worse, will show only the snapshot from an initial workflow event and nothing since, giving the user a false sense of safety.

The `restoreVersion` UI (`:1998-2018`) is therefore restoring users to a state that may pre-date hundreds of edits.

**Impact rating:** This single finding tanks the prior audit's "persistence & versioning: 78" to **~35** for the rich-editor path. The infrastructure exists; the rich editor simply doesn't use it.

### D.4 Conflict handling between tabs

Server emits 409 on `baseUpdatedAt` mismatch. Client retries once. Two tabs editing simultaneously: each save round-trip = one mass overwrite of the other's edits between flushes. There is no per-keystroke OT/CRDT, no per-section locking, no even per-paragraph last-write-wins detection. The user gets no UI warning that another tab clobbered them — the panel just silently picks up the server state on the next save retry and the local in-flight edits disappear if they hadn't been part of the request.

### D.5 Provenance — empty for rich-edit autosaves

`createVersionSnapshot` stores `operation_type` + `summary` + `created_by`. Even if we *were* snapshotting on PUT, there is no way to know whether the change came from Teresa-stream or user-typing — the `persistDraft` payload (`:940-945`) sets `provenance.source: 'chat-work-canvas-panel'` for every save. The Versions panel UI labels each row with `version.operationType` (`:3327`) — for non-workflow drafts these would all collide.

---

## 6. Layer E — Edge cases observed

| # | Scenario | What happens today | Should happen |
|---|---|---|---|
| E1 | User closes Canvas panel mid-stream | `richEditor`-ref listener removed, BUT `useCanvasAIStream`'s in-flight fetch is NEVER aborted (no cleanup useEffect). Network keeps running. Inserts target a destroyed editor → silent no-ops. Chat keeps the "Writing…" bubble. | Hook should return a cleanup that calls `stopStream` on unmount; chat bubble should resolve to a "Cancelled" state. |
| E2 | Model emits Callout / Details / Highlight / Underline / aligned text | Round-trip strips: variant attr, summary/content tags, `<mark>`, `<u>`, `text-align` style. Permanent data loss on next save. | Add Turndown rules + a `marked` extension OR move canonical to `contentJson`. |
| E3 | Chunk arrives with partial markdown (`**fo`) | Inserted as literal text. Next chunk completes the asterisks but TipTap shows two text nodes, not bold. | Buffer at block boundaries; reparse per completed block. |
| E4 | Chunk contains HTML-ish `<` | `insertContent` parses as HTML — may inject schema-invalid nodes. | Sanitise or use `editor.commands.insertContent({ type:'text', text:chunk })`. |
| E5 | RAG retrieval fails on `/chat/stream` | Stream still emits content. Canvas keeps writing. ✅ canvas remains functional. | OK. |
| E6 | User types while Teresa streams | Editor is editable, no lock. Cursor moves. Subsequent chunks insert at the new cursor — not `insertPositionRef`. Document gets fragmented. | Lock editor OR re-anchor every chunk to the captured insertion mark. |
| E7 | Two tabs editing the same draft | 409 → silent retry-once → last-write-wins. No UI signal. | Toast + diff + "Reload?" CTA. |
| E8 | Selection at very top of viewport → floating menu | `top: rect.top - 48 < 0` — menu off-screen. | Clamp to viewport, flip below if no space above. |
| E9 | Canvas scroll while menu is open | Menu does not reposition. | Listen to scroll, recompute. |
| E10 | Long doc (>12k chars) → streaming context | `documentMarkdown.slice(0,12000)` (`useCanvasAIStream.ts:101`) silently truncates the tail. | Window around insertion point. |
| E11 | Long doc (>6k chars) → packet | `markdownProjection: truncate(.,6000)` (`UnifiedChatPanel.tsx:228`) silently drops content. Same caveat. | Same. |
| E12 | User clicks "Ask AI" on the entire 50k-char document | Floating menu posts the entire selection → message body is 100k+ chars. `/chat/quick` has NO max length. Burns tokens, may time out (20 s breaker). | Cap selection length; warn user. |
| E13 | User pastes HTML from Word/Docs | TipTap default paste → HTML → Turndown converts → corrupted markdown (tables nest weirdly, font tags survive as text). | Add `transformPastedHTML`. |
| E14 | User drag-drops an image | TipTap drops it, no `Image` extension loaded → silent failure. | Wire image upload via existing attachments. |
| E15 | Mobile / narrow viewport | Toolbar is `flex-wrap` so it wraps. Floating menu has no touch handling, no min-width sanity. EditorContent has fixed `min-h-[200px]` but the parent panel has `min-h-[680px]` — on mobile this forces vertical scroll inside scroll. | Responsive toolbar collapse; touch selection rules. |
| E16 | Accessibility | No `aria-label` on toolbar buttons (`CanvasEditorToolbar.tsx` uses only `title`); no `role="toolbar"`; floating menu has no `role`/`aria-expanded`/`aria-controls`. Custom-positioned div over selection is not announced. | Add ARIA. Score for accessibility: **10/100**. |
| E17 | Floating menu Quick Action while AI processing | `handleQuickAction` guards `if (isProcessing) return` — ✅. Custom prompt likewise. | OK. |
| E18 | `/chat/quick` floods | No rate limit on `:5360`. | Apply `aiRateLimiter`. |
| E19 | Floating menu prompt input has no length cap | Free-form `<input type="text">` with no `maxLength`. User can paste 1MB into it. | Cap to e.g. 1000 chars. |
| E20 | Autosave timer fires while save in flight | `useEffect` cleanup clears the timer on next render but if a save is mid-fetch and a new edit arrives, a second `persistDraft` can race against the in-flight one. `setDocumentState` race on `saveState:'saving'`. | Track an in-flight ref; queue. |

---

## 7. Verdict matrix — every Canvas capability

✅ real / shipping · ⚠ partial · ❌ stub · 🚫 missing

| Capability | Status | Notes |
|---|---|---|
| Rich text editing (TipTap host) | ✅ | StarterKit + tables + tasks + headings |
| Markdown canonical storage | ⚠ | Lossy on Callout/Details/Highlight/Underline/TextAlign |
| Undo/redo | ✅ | Default StarterKit history |
| Bold/italic/underline/strike/code | ✅ | |
| Headings (H1–3) | ✅ | |
| Lists (bullet/ordered/task) | ✅ | |
| Blockquote | ✅ | |
| Tables (resizable) | ✅ | |
| Highlight (colored) | ⚠ | Lost on save |
| Text alignment | ⚠ | Lost on save |
| Links (manual `window.prompt`) | ⚠ | No edit/remove UI, no validation |
| Inline code | ✅ | |
| Code blocks | ⚠ | StarterKit default, no language picker |
| Callout node | ⚠ | Renders OK, lost on save |
| Details/toggle | ⚠ | Renders OK, lost on save |
| Image / embed | 🚫 | Extension not loaded |
| Slash menu | 🚫 | None |
| Drag handles | 🚫 | None |
| Paste from Word/Google Docs | ❌ | Default paste = corrupted MD |
| Drag-drop image | 🚫 | |
| Mention (@) / linked entity | 🚫 | |
| Floating BubbleMenu on selection | ⚠ | Hand-rolled, scroll-broken |
| Quick actions (Expand/Shorten/Rewrite/Translate ×2) | ✅ | But context-blind |
| Custom Ask-AI prompt | ✅ | Context-blind |
| Tone / fix-grammar / continue / summarize actions | 🚫 | Not implemented |
| Accept/reject diff (inline floating-menu path) | ✅ | Works, persists rollback |
| Accept/reject diff (chat-stream path) | 🚫 | No preview — direct commit |
| Streaming write into canvas | ⚠ | Inserts at LIVE cursor (not insertion ref); editable during; markdown literal mid-stream |
| Stream Stop button | ✅ | Wires abort controller |
| Stream cleanup on unmount | ❌ | No cleanup useEffect — fetch leaks |
| Streaming progress / token count | 🚫 | |
| Canvas context packet → `/chat/stream` | ✅ | canvas-context/v1, server consumes |
| Canvas context packet → `/chat/quick` | 🚫 | NOT forwarded, server doesn't read |
| Memory snapshot in packet | ✅ | summary + anchors + limitations |
| RAG / knowledge base usage | ⚠ | Only on `/chat/stream` path |
| Intent detection (chat → canvas write) | ⚠ | Regex EN/PL only |
| Section/heading anchor targeting | 🚫 | Append-or-replace only |
| Autosave with debounce | ✅ | 1400 ms |
| Optimistic concurrency (baseUpdatedAt) | ✅ | 409 retry-once correct |
| Multi-tab conflict UI | 🚫 | Silent overwrite |
| Real-time collab / CRDT | 🚫 | |
| **Version snapshots on autosave** | ❌ | PUT /drafts NEVER snapshots |
| Version snapshots on operations / workflow / restore | ✅ | But the rich editor doesn't call /operations |
| Version list UI | ⚠ | Real UI, empty data for the rich path |
| Version restore | ⚠ | Real, restores to potentially ancient state |
| Diff visualization between versions | ⚠ | `buildLineDiff` exists but only ad-hoc preview |
| Per-version provenance (Teresa vs user) | 🚫 | All collapse to `operationType` |
| Export (PDF / MD) | ✅ | `:3112` GET /export |
| Share via token | ✅ | `:3706`, `:3723` |
| Approval / proposals lifecycle | ✅ | `:3320`, `:3371`, `:3377`, `:3412` |
| Workflow run integration | ✅ | Embedded in packet |
| Rate-limit on `/chat/quick` | 🚫 | Imported but never applied |
| Length cap on quick-edit message | 🚫 | `min(1)` only |
| Accessibility (ARIA / tab order / keyboard) | ❌ | None on toolbar or floating menu |
| Mobile / touch | ❌ | Hand-rolled menu breaks on touch |
| Tests (editor / stream / diff) | 🚫 | Zero `*.test.*` under CanvasEditor/ |

---

## 8. Top 10 most painful issues, ranked

1. **Autosave never creates a version snapshot.** The rich editor PUTs `/drafts/:id`; that route updates in place and never inserts into `work_canvas_versions`. The Versions panel is decorative for normal text editing. `work-canvas.routes.ts:3153-3317`. Fix: call `createVersionSnapshot(draft, 'manual_edit', summary, userId)` inside the PUT handler, throttled (e.g. ≥ 60 s between snapshots OR on content-hash change).

2. **Streaming inserts at the live cursor, not the captured insertion point.** `insertPositionRef` is set but never used. Any user click during stream fragments Teresa's output. The editor is `editable=true` throughout. `useCanvasAIStream.ts:48, 89, 163`. Fix: either lock the editor (`setEditable(false)`) for the stream OR re-position via a stored ProseMirror Mark/Node before each insert.

3. **No unmount cleanup on the streaming hook.** Closing the panel mid-stream leaves the network call running, chunks fire into a destroyed editor, the chat "Writing…" placeholder stays. `useCanvasAIStream.ts` (entire file — missing `useEffect(() => () => stopStream(), [])`). Fix: add cleanup; also resolve the chat placeholder.

4. **Custom node markdown lossy round-trip.** Callout variant, Details summary/content, Highlight, Underline, TextAlign all silently degrade on every keystroke. `canvasMarkdownConversion.ts:14-46` (only taskList rule), `notebook/extensions.ts:15-127`. Fix: add Turndown rules + matching `marked` extension OR migrate Canvas drafts to `canonicalFormat: 'json'` and store `contentJson` directly.

5. **`/chat/quick` has no rate limit, no length cap, and no context packet.** `ai.routes.ts:5360` skips `aiRateLimiter`, accepts unbounded `message`. Floating menu sends the raw selection regardless of size. Abuse + quality both lose. Fix: apply `aiRateLimiter`, cap message ≤ 8 k chars, accept + render `canvasContextPacket` like `/chat/stream`.

6. **`acceptAiDiff` / `rejectAiDiff` run `selectAll().unsetMark()` on the entire document.** Quadratic in doc length × inline edits. `canvasDiffOps.ts:93, 102`. Fix: iterate the collected ranges and `unsetMark` per range.

7. **Floating menu has no scroll/viewport awareness.** Captured once on selection; drifts on scroll; clips off top when selection near viewport top. `CanvasAIFloatingMenu.tsx:74-99`. Fix: use TipTap `BubbleMenu` (auto-anchors via Tippy/Floating UI) OR add scroll listener + clamping.

8. **Multi-tab conflict has no UI.** Two tabs → silent overwrite after one 409 retry. `WorkCanvasDocumentPanel.tsx:950-968`. Fix: on 409 retry success, diff local vs server, show "Another session edited this — reload to see / keep mine?" prompt.

9. **Zero accessibility.** No ARIA on toolbar / floating menu / accept-reject bar; no role="toolbar"; no aria-label (only `title`); no keyboard nav for floating menu actions; floating menu input has no `maxLength`. `CanvasEditorToolbar.tsx`, `CanvasAIFloatingMenu.tsx`. Fix: add roles, aria-label, tabIndex, keyboard handlers, length caps.

10. **Zero tests for the editor / stream / diff layer.** `find … -name '*.test.*'` under `CanvasEditor/` returns nothing. The diff ops file itself documents "previously buggy" mechanics — and is untested. Fix: at minimum, headless-editor tests for `applyAiDiff`, `acceptAiDiff`, `rejectAiDiff`, `collectMarkedRanges`, and a mocked-SSE test for `useCanvasAIStream`'s replace-then-cleanup flow.

---

## Appendix — Key file:line index (deep pass)

- TipTap host + onUpdate + onSelectionUpdate: `src/components/AIChat/CanvasEditor/CanvasRichEditor.tsx:42-95`
- External MD sync: `CanvasRichEditor.tsx:97-110`
- Floating-menu AI request (no packet): `CanvasRichEditor.tsx:127-152`
- Accept/reject persistence: `CanvasRichEditor.tsx:177-202`
- Streaming hook (whole): `src/components/AIChat/CanvasEditor/useCanvasAIStream.ts:1-220`
- `insertPositionRef` never re-read: `useCanvasAIStream.ts:48, 89, 163`
- Chunk insertion: `useCanvasAIStream.ts:160-182`
- Replace-mode delete on complete: `useCanvasAIStream.ts:190-202`
- Diff ops: `src/components/AIChat/CanvasEditor/canvasDiffOps.ts:29-103`
- Diff marks: `canvasAIDiffExtensions.ts:9-55`
- Extensions list: `canvasEditorExtensions.ts:28-58`
- Markdown round-trip rules: `canvasMarkdownConversion.ts:14-57`
- Floating menu positioning: `CanvasAIFloatingMenu.tsx:74-99`
- Quick actions table: `CanvasAIFloatingMenu.tsx:25-56`
- Custom nodes (Callout/Details): `src/components/MyWork/notebook/extensions.ts:15-127`
- Context packet builder: `src/components/AIChat/UnifiedChatPanel.tsx:144-256`
- Intent detector regex: `src/components/AIChat/canvasStreamIntentDetector.ts:13-60`
- `canvas-stream-request` dispatch: `UnifiedChatPanel.tsx:2153-2163`
- `canvas-stream-request` listener: `WorkCanvasDocumentPanel.tsx:1282-1303`
- `persistDraft` + 409 retry: `WorkCanvasDocumentPanel.tsx:905-1020`
- Autosave debounce: `WorkCanvasDocumentPanel.tsx:1578-1599`
- Version list/restore UI: `WorkCanvasDocumentPanel.tsx:1983-2018, 3271-3340`
- Server `/chat/stream` packet render: `server/src/routes/ai.routes.ts:1735-1797`
- Server `/chat/quick` handler (no packet, no rate-limit): `ai.routes.ts:5360-5429`
- `ChatQuickRequestSchema`: `server/src/validators/ai.validators.ts:545-555`
- Draft PUT (no version snapshot): `server/src/routes/work-canvas.routes.ts:3153-3317`
- `createVersionSnapshot`: `work-canvas.routes.ts:1886-1922`
- `createVersionSnapshot` call sites: `work-canvas.routes.ts:2829, 3573, 3656, 3772, 3830, 3899` (none under PUT /drafts)
- `hasDraftConflict`/`sendDraftConflict`: `work-canvas.routes.ts:200-237`
- Tables DDL: `work-canvas.routes.ts:1928-2035`
