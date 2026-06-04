# Canvas — Two-Mode Coexistence Audit

**Date:** 2026-06-04
**Branch:** `feat/wave1-foundations`
**Scope:** The differentiator — Mode A (Teresa-driven streaming/quick-AI) vs Mode B (manual TipTap editing) coexisting in the same surface without conflict.
**Verdict:** Working for the happy path, but several real conflict surfaces still leak data or feel rough on the edge. The chat-shell (`WorkCanvasDocumentPanel`) is the only place the two-mode dance actually exists; the older `WorkCanvasShell` is read-only `ReactMarkdown` — i.e. zero parity.

---

## Score: 62 / 100

One-line justification: the recent C1/C2/C5/C6 fixes solve the most embarrassing race (stream collisions, accept/reject quadratic mark unsets, markdown round-trip drop, provenance hooks), but the system still has (a) an unresolved-AI-diff vs incoming-stream collision that silently destroys the diff and stomps over `aiAdded` marks in saved markdown, (b) a 300 ms / 1 400 ms double-debounce race where the editor saves *during* a Teresa-write completion, (c) a `provenanceScope` that disappears on the very first apply (no draft yet) and orphans logs forever, and (d) `WorkCanvasShell` shipping under the same name as the chat-shell surface despite being a static viewer with no two-mode story at all.

A B2B consulting platform under regulated conditions can survive (a)/(c)/(d) only until a customer asks for a real audit. (b) is the one I'd patch this week.

---

## 1. What happens when Teresa is streaming and the user starts typing?

### Code path verified

`useCanvasAIStream.streamToCanvas`
- L113-114: snapshots `editor.isEditable` into `wasEditableRef`, then calls `editor.setEditable(false)`. ✅ Editor IS truly read-only during stream.
- L222-225 / L252-255 / L59-62: restores editability on stream complete, on error, and on `stopStream()` — three exits cover.
- L109: captures `insertPositionRef = editor.state.selection.to` BEFORE setEditable(false), so even if user managed to move cursor in the tiny window before lock, output still goes contiguous because every chunk inserts at the tracked position (L190-193, L210-212), not the live selection.

`CanvasRichEditor`
- L117-118: `editor.setEditable(editable)` is mirrored from the `editable` prop. The panel passes `editable={true}` unconditionally (panel L3564). So the *only* path that flips editable is `useCanvasAIStream`'s direct `setEditable(false)`.

### What actually happens

| Sub-case | Behavior |
|---|---|
| User clicks/types while streaming | ✅ Blocked. TipTap `setEditable(false)` rejects DOM input. |
| User clicks Stop | ✅ `stopStream()` calls `abort()` and restores editability synchronously. SSE chunks already in flight will hit `abortController.signal.aborted` and skip insertion (L187, L207). |
| User already had a selection (e.g. opened floating menu) before stream started in 'append' mode | ⚠️ **Bug — `editor.commands.focus('end')` (L97) jumps the cursor to end of doc, destroying the user's range selection. The CanvasAIFloatingMenu unmounts (because `selection` state in `CanvasRichEditor` was set on `onSelectionUpdate` which now sees `from === to`). Acceptable for "append", but no UI breadcrumb tells the user "you lost your selection". |
| User already had a selection in 'replace' mode | OK — `replace` re-applies the selection on L100-107 and marks the original `aiRemoved`. |
| Browser closed mid-stream | ✅ C1.3 cleanup effect (L69-74) aborts. |
| Panel unmounted mid-stream | ✅ Same cleanup. |
| Hot reload during dev | ❓ The abort fires once; second mount works because `abortControllerRef` is per hook instance. |

### Sharp edge: the `useEffect` race on `editable` mirror

`CanvasRichEditor` L116-118:
```ts
useEffect(() => {
  if (editor) editor.setEditable(editable);
}, [editable, editor]);
```

The panel passes `editable={true}` as a literal. React's effect dependency comparator sees `true === true` so it never re-runs after first mount — **but** if a parent ever conditionally toggles `editable` (e.g. for read-only sharing mode), that effect would fire while a stream is in progress and **stomp** `useCanvasAIStream`'s `setEditable(false)`. The stream hook has no observer for this; nothing forces it back to `false`. **Recommendation:** the stream hook should re-assert `setEditable(false)` on every editor state change while `isStreaming`, OR `editable` should be a derived prop `editable && !isStreaming` in the panel. Currently neither.

---

## 2. What happens when user has a pending AI diff and Teresa starts a new stream?

### Code path

`CanvasRichEditor`
- `hasPendingDiff` is local state — `true` between `applyAiDiff(...)` (L183) and `acceptAiDiff/rejectAiDiff` (L205/224).
- L259: hides floating menu while diff is pending. ✅ Good — user can't stack a second selection-edit.
- L87: `onSelectionUpdate` early-returns while `hasPendingDiff`, so `setCanvasSelection` is **not called** while a diff is open. (Good for keeping `activeCanvasSelection` clean, but see #4.)

`useCanvasAIStream.streamToCanvas`
- **Has zero awareness of `hasPendingDiff`.** It reads the editor, finds `aiRemoved`/`aiAdded` marked text, captures the selection, calls `editor.commands.focus('end')`, locks editable, and starts inserting chunks at end of doc.

### What actually happens

A user could:
1. Select a paragraph, open floating menu, "Final polish" → AI returns a replacement → red strikethrough + green added text appear; Accept/Reject bar is shown.
2. In the chat panel (left), type "dopisz akapit o ryzyku" → `detectCanvasWriteIntent` returns `'append'` → `canvas-stream-request` event fires → `streamToCanvas('…', 'append')`.

What breaks:
- The pending diff stays in the document as raw `aiAdded`/`aiRemoved` marks.
- Stream locks the editor (`setEditable(false)`), and the user **cannot click Accept or Reject because those buttons render through `AIAcceptRejectBar` which only show iff `hasPendingDiff`** — they render, but pressing them calls `acceptAiDiff(editor)` which runs commands like `chain().deleteRange(...).run()` against a `setEditable(false)` editor. TipTap's `editor.commands` and direct chains do bypass the `editable` flag (they go through transactions, not DOM input), so this *actually* works — but the result is dramatic and unintended: the user accepts/rejects an old diff DURING a new stream, the diff's markdown change reconciles to `lastExternalMdRef` via the panel's `updateMarkdown`, and the stream's `onComplete` then writes its own `finalMd` that **does NOT include the user's accept/reject because the stream captured `documentMarkdown` (L93) BEFORE the user clicked Accept**. Net effect: **the accept is silently overwritten by the stream's `onComplete` write**.
- If user just lets the stream finish and the diff stays in the doc: `onComplete → updateMarkdown(finalMd)` calls `htmlToMarkdown(editor.getHTML())`. Turndown has no rule for `span[data-ai-added]` / `span[data-ai-removed]` so those become plain `<span>` runs that go through GFM's default handling — meaning **the markdown stored on the server will contain the text of both `aiRemoved` AND `aiAdded` runs concatenated.** This is the "lossy persisted diff" data-loss case. **P0.**
- On reload (hydration → `markdownToHtml` → TipTap), there's no `<span data-ai-removed>` HTML to parse back into marks, so the marks are gone — the document permanently contains the old + new text glued together with no way to tell them apart.

### P0 finding 2.1: pending diff is unguarded when Teresa is asked to write

**File:line:** `src/components/AIChat/CanvasEditor/useCanvasAIStream.ts:82` — `streamToCanvas` should early-return or force-reject the pending diff when `aiAdded`/`aiRemoved` marks are present.

Fix sketch (S):
```ts
// Inside streamToCanvas, before setIsStreaming(true):
const hasPending =
  collectMarkedRanges(editor, AI_ADDED_MARK).length > 0 ||
  collectMarkedRanges(editor, AI_REMOVED_MARK).length > 0;
if (hasPending) {
  onError?.('Document has unresolved Teresa suggestions. Accept or reject them first.');
  return;
}
```

Plus a UI guard in the panel: when `hasPendingDiff` is true, the chat composer should display "Teresa proponuje zmianę — zaakceptuj lub odrzuć, zanim napiszę dalej." This requires the panel to know about `hasPendingDiff`, which it currently does **not** — that flag is private inside `CanvasRichEditor`. Lift it (e.g. add `onPendingDiffChange` callback) and forward to `onActiveDocumentChange` so the chat panel can disable the stream-intent route.

### P0 finding 2.2: Turndown has no rule for `aiAdded`/`aiRemoved` marks

**File:line:** `src/components/AIChat/CanvasEditor/canvasMarkdownConversion.ts` (Turndown rules block, no rule for `span[data-ai-added]` / `span[data-ai-removed]`).

Without a rule, Turndown emits the inner text of both spans, concatenated. Any autosave during a pending diff will write a corrupted markdown to the server. The autosave debounce is 300 ms in the rich editor (L43) and 1400 ms in the panel — so a user who hovers Accept for 2 seconds is statistically guaranteed to ship a corrupted snapshot.

Fix sketch (S):
```ts
td.addRule('aiRemovedMark', {
  filter: (node) => node.nodeName === 'SPAN' && (node as HTMLElement).hasAttribute('data-ai-removed'),
  replacement: () => '',  // drop entirely from persisted markdown
});
td.addRule('aiAddedMark', {
  filter: (node) => node.nodeName === 'SPAN' && (node as HTMLElement).hasAttribute('data-ai-added'),
  replacement: (content) => content,  // keep text, strip mark
});
```

The semantic choice here is intentional: **the persisted markdown should reflect the user's intent if they walked away mid-flow** — and the user's last *committed* state is the pre-AI document, so drop the `aiAdded` text too. The above keeps `aiAdded` text but strips marker; the safer regulated-industry choice is to drop both:
```ts
filter: (node) => node.nodeName === 'SPAN' && ((node as HTMLElement).hasAttribute('data-ai-added') || (node as HTMLElement).hasAttribute('data-ai-removed')),
replacement: () => '',
```
…and require an explicit accept to commit. That's safer; coordinate with product on which one ships.

### P1 finding 2.3: Accept/Reject during stream silently clobbers the accept

Even with the guard above, the inverse race remains (user accepts the OLD diff between the stream firing and the SSE first chunk arriving). The `streamToCanvas` snapshot of `documentMarkdown` (L93) is captured up front and used for the `systemInstruction` only — but `finalMd = htmlToMarkdown(editor.getHTML())` at `onComplete` (L240) IS captured from the live document, so the accept does survive in the final write. The actual conflict is in **the order of writes between `useCanvasAIStream.onComplete` and the debounced editor save**, see #3.

---

## 3. Simultaneous saves — debounced editor save vs Teresa save-to-workspace vs autosnapshot

### Code path

Three save initiators:
1. **CanvasRichEditor onUpdate** (L76-85): on any TipTap update, debounce 300 ms, then `onContentChangeRef.current(md)` → `updateMarkdown(md)` in the panel.
2. **Panel autosave** (panel L1604-1625): on `documentState` change with `saveState === 'unsaved'`, debounce 1400 ms, then `persistDraft(snapshot)` → PUT `/api/work-canvas/drafts/:draftId`.
3. **`useCanvasAIStream.onComplete`** (L241): calls `onComplete?.(finalMd)` which the panel binds to `updateMarkdown(finalMd)` → sets `saveState: 'unsaved'` → triggers (2).

Plus **save-to-workspace** (`runWorkspaceAction`, panel L1747) calls `Api.workCanvasSaveToWorkspace(draft.draftId, ...)`; the server route reads from `work_canvas_drafts` directly, then writes a linked resource. So save-to-workspace **does not write** to the draft row (just reads + handoff), so there's no draft-row contention with it. ✅

### What actually happens

#### Race A: stream completes while a manual edit is mid-debounce

1. User types a character → `onUpdate` schedules a 300 ms save timer with current HTML.
2. 50 ms later, Teresa's stream `onComplete` fires `updateMarkdown(finalMd)` based on **the editor's current HTML at that moment**, which already includes the user's mid-typed character because the editor was just unlocked.
3. 250 ms later, the 300 ms `onUpdate` debounce fires and runs `htmlToMarkdown(ed.getHTML())` AGAIN. Same content (the user didn't type again) → idempotent write. Safe.

Wait — there's a subtle bug. **The user can type AS SOON AS `setEditable(true)` is restored, which happens BEFORE `updateMarkdown(finalMd)` runs** (stream hook L222-225 restores editable, THEN L240 reads getHTML, THEN L241 calls onComplete). If the user types between L223 and L240, the `finalMd` contains their character. If they type between L240 and the panel's `setDocumentState` flush, no harm. Race-free in practice.

#### Race B: external sync vs debounced save

`CanvasRichEditor` L102-114: when `contentMd` prop changes externally, it sets `isExternalUpdateRef = true` and calls `editor.commands.setContent(html, { emitUpdate: false })`. ✅ Correctly avoids the loop.

But the panel's `persistDraft` flow updates `documentState.contentMd` from the server response (L1014-1028: `mapDraftResponseToCanvasDocumentState(savedDraft, ...)`). If the server normalizes the markdown (it doesn't seem to, but it could via `contentEnvelope`), the editor would have its HTML overwritten **even though the user already typed a new character after the request fired**. Specifically:

- T=0: user types "X", local `contentMd` = "ABCX"
- T=300ms: debounced save fires with "ABCX"
- T=300ms: user types "Y", local editor HTML now has "ABCXY", `contentMd` state still "ABCX"
- T=300ms-onUpdate: another 300 ms timer scheduled with "ABCXY"
- T=1700ms: server responds with normalized "ABCX" → `setDocumentState(...contentMd: 'ABCX')` → `lastExternalMdRef.current = 'ABCX'` → `editor.commands.setContent(markdownToHtml('ABCX'))` → **"Y" is lost.**

The current `mapDraftResponseToCanvasDocumentState` does seem to use the server's `contentMd`, and the panel's `persistDraft` callback has a guard at L1014-1021:
```ts
if (current.contentMd !== draftToPersist.contentMd) {
  return { ...current, ... saveState: 'unsaved' };  // KEEP the in-memory contentMd
}
```
That keeps `documentState.contentMd` as the user's "ABCXY" and only updates draftId/saveState. ✅ So the actual race outcome: "Y" survives, even though the server has "ABCX". Eventually the 300 ms debounce fires again with "ABCXY" and a new save happens.

**Verdict:** the panel's guard is correct, but it's **load-bearing and fragile**. A reviewer adding `mapDraftResponseToCanvasDocumentState(savedDraft, current)` to the success branch in the future would silently break this. Add a comment + a unit test pinning the "second typed char survives debounced save" behavior.

#### Race C: PUT autosnapshot fires inside the same transaction window

Server route L3422-3451 (the C1.1 autosnapshot block):
- Reads `lastVersion` from `work_canvas_versions` after the UPDATE has run.
- If `sinceMs >= 5min OR charDelta >= 500`, calls `createVersionSnapshot(updated, ...)`.

Two PUTs landing within ~50 ms of each other (user typing fast + autosave 1400 ms still running + Teresa onComplete triggering immediate save):
- Both pass `hasDraftConflict` because they share `baseUpdatedAt` from the same hydration.
- Wait — `hasDraftConflict` (L204-205) compares `baseUpdatedAt !== draft.updatedAt`. Second PUT sees the updated_at from the first PUT, fails 409, falls into the panel's retry block (panel L978-995) which re-fetches the draft and retries.
- The retry is fine for content, but **the autosnapshot may run twice** (once per successful PUT) — and both will probably hit the 500-char rule. Result: duplicate version rows. Not corrupting, just noisy.

#### Race D: save-to-workspace mid-stream

If the user clicks "Send to Idea" while Teresa is streaming:
- `runWorkspaceAction` calls `ensurePersistedDraft` (panel L1741-1745) which returns `documentState` if `draftId` exists, otherwise calls `persistDraft(documentState)`.
- `persistDraft` reads `documentState.contentMd` — which during a stream is **stale** (the live edits are in the TipTap editor, not yet propagated). The 300 ms debounce hasn't flushed because the editor is `setEditable(false)` so `onUpdate` may not even fire on programmatic `insertContentAt` calls.

Let me check: TipTap's `insertContentAt` does fire `onUpdate` (it's a transaction). So the 300 ms debounce DOES schedule. But save-to-workspace reads from `documentState.contentMd` which is React state, last updated by `updateMarkdown` (panel L1287) — which is only called from the rich editor's onUpdate callback. The 300 ms debounce means `documentState.contentMd` could lag actual editor by up to 300 ms + render time.

Result: save-to-workspace during a stream captures a **partial stream** as the saved-to-workspace artifact. Worse, the chunk arriving 50 ms later changes the document but `documentState.contentMd` still reflects pre-stream until the next 300 ms debounce. Saving to workspace mid-stream is therefore non-deterministic: you get whatever Teresa had written up to the last 300 ms tick.

The "right" UX is to **disable workspace actions while `isStreaming`**. The panel has `isStreaming` in scope (L1303). The toolbar handlers do **not** check it.

### P1 finding 3.1: workspace + output actions are enabled during stream

**File:line:** `src/components/AIChat/WorkCanvasDocumentPanel.tsx:1747` (`runWorkspaceAction`), `:1788` (`runOutputAction`), `:1168` (`saveToOutputs`).

Fix sketch (S):
```ts
// At top of runWorkspaceAction / runOutputAction / saveToOutputs:
if (isStreaming) {
  setAlertFeedback('Wait for Teresa to finish writing before this action.');
  return;
}
```

### P1 finding 3.2: 300 ms editor debounce + 1400 ms panel debounce = up-to-1.7 s window where state lags

For a manually-typing user, the chain is:
1. User types char → editor onUpdate schedules 300 ms timer
2. 300 ms later → `updateMarkdown(md)` → `setDocumentState({...contentMd, saveState: 'unsaved'})`
3. Effect at panel L1604 schedules 1400 ms timer
4. 1400 ms later → `persistDraft(snapshot)`

Total: 1.7 s from last keystroke to network. That's borderline OK for autosave but problematic if the user closes the tab. There is no `beforeunload` handler in the panel (verified by grep — none present). **A user who types a paragraph and closes the tab within 1.7 s loses it.** This is the highest-probability data-loss case in this audit.

Fix sketch (M): add `useEffect(() => { const h = () => persistDraft(); window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); })`. Use `navigator.sendBeacon` for guaranteed delivery.

---

## 4. Selection-conflict synchronization (rich editor selection ↔ chat-shell selection)

### Code path

`CanvasRichEditor` L86-99: on every selection change, computes `{selectedText, from, to}` and calls `onSelectionChangeRef.current?.(sel)` UNLESS `hasPendingDiff` is true.

Panel L3546-3560: maps that to `CanvasSelection` with `mode: 'rich'`, preserves `startOffset/endOffset` as ProseMirror positions, calls `setCanvasSelection(sel)`.

Panel L927-929: `onCanvasSelectionChange` (passed to UnifiedChatPanel) is fired on every `canvasSelection` change.

UnifiedChatPanel: receives via `setActiveCanvasSelection` (L588), used to build `canvasContextPacket` for chat sends (L2144).

### Issue 4.1: selection is muted while a diff is pending

When `hasPendingDiff = true`, `CanvasRichEditor.onSelectionUpdate` early-returns, so the panel's `canvasSelection` is **NOT cleared** when the user changes selection elsewhere or clicks away. The last known selection from before the diff stays in `activeCanvasSelection` and is sent to Teresa on the next chat message. **The chat shell thinks the user has the original (pre-diff) text selected even though the document state has moved on.**

Severity: P1 — it's a Teresa context bug, not a data-loss bug. Teresa will reason against stale selection text.

Fix sketch (S): clear `selection` to null when entering pending-diff state in `CanvasRichEditor`:
```ts
useEffect(() => {
  if (hasPendingDiff) {
    setSelection(null);
    onSelectionChangeRef.current?.(null);
  }
}, [hasPendingDiff]);
```

### Issue 4.2: floating menu and chat selection use the SAME selection object

There's no separate "AI-menu selection" vs "chat selection". They share `canvasSelection`. So:
- User selects "Q3 revenue" → floating menu appears → also dispatched to chat.
- User opens chat composer (left) and types "@selection summarize this" → the chat reads `activeCanvasSelection.selectedText = 'Q3 revenue'`.
- User then clicks "Final polish" in the floating menu → calls `handleAIRequest` against the same selection.

Both code paths now race to mutate the same range. The floating menu's `applyAiDiff` runs synchronously when the AI quick endpoint returns, while the chat path dispatches `canvas-stream-request` and goes through `streamToCanvas`. If both fire concurrently:
- Floating menu finishes first: applies inline diff, sets `hasPendingDiff = true`, selection muted.
- Stream hook starts: doesn't check `hasPendingDiff` (#2.1), proceeds to lock + insert. The pending diff marks survive in the doc, and we hit P0 finding 2.2 again.

Or reverse order:
- Stream starts, `setEditable(false)`.
- Quick AI endpoint returns, `applyAiDiff` is called on a `setEditable(false)` editor. TipTap's chained commands still go through (transactions bypass DOM editability), so the diff IS applied DURING the stream insertion. Chunks continue arriving at `insertPositionRef` which was captured pre-stream — so chunks are inserted at the OLD `to` position, NOT after the freshly-inserted diff. The diff and chunks interleave randomly in the doc.

### P0 finding 4.3: floating-menu AI request and chat-stream are not mutually exclusive

**Files:** `CanvasRichEditor.handleAIRequest` (L131-192), `useCanvasAIStream.streamToCanvas` (L76).

Neither checks the other's state. The right architecture is a single "Canvas AI activity" flag in the panel that both code paths consult. Fix sketch (M):
- Lift a `canvasAiActivity: 'idle' | 'streaming' | 'pending-diff'` state into the panel (or a context).
- Pass down to `CanvasRichEditor` so `handleAIRequest` refuses while streaming, and `useCanvasAIStream` refuses while pending-diff.

---

## 5. Markdown round-trip integrity

### Code path traced

Mode-A produced markdown → `markdownToHtml(md)` (L144-150):
- `marked.parse(md, { async:false, gfm:true, breaks:false })` → HTML.
- `rehydrateCanvasExtensions(html)`: regex-converts `==text==` → `<mark>`, `:::callout variant\n...\n:::` → `<div data-type="callout" data-variant="...">`, `:::details Summary\n...\n:::` → `<details data-type="details"><summary>...`.

Then `editor.commands.setContent(html, { emitUpdate: false })` (rich editor L112). TipTap parses HTML using extension `parseHTML` rules:
- `Highlight` (`@tiptap/extension-highlight`) parses `<mark>` by default.
- `Underline` (`@tiptap/extension-underline`) parses `<u>` by default.
- `TextAlign` parses `style="text-align: …"` on heading/paragraph.
- `CalloutNode` (from `@/components/MyWork/notebook/extensions`) — assumed to parse `div[data-type="callout"]`.
- `DetailsNode` — assumed to parse `details[data-type="details"]`.

User edits in rich mode, debounce fires, `htmlToMarkdown(html)` runs:
- Turndown's `headingStyle: 'atx'`, fences, etc.
- Custom rules for highlight (`<mark>` → `==text==`), underline (`<u>` → `<u>`), textAlign (raw HTML for non-default), callout (`div[data-type=callout]` → `:::callout variant`), details (`details[data-type=details]` → `:::details Summary`), taskList (preserves `- [x]`).

### Round-trip checks

| Extension | Markdown → HTML | HTML → Markdown | Round-trip |
|---|---|---|---|
| `<mark>` Highlight | `==x==` → `<mark>x</mark>` (regex L125) | `<mark>x</mark>` → `==x==` (rule L50) | ✅ |
| `<u>` Underline | `<u>x</u>` passes through `marked` (raw HTML allowed in GFM) | `<u>x</u>` → `<u>x</u>` (rule L57) | ✅ |
| TextAlign | `<p style="text-align:center">x</p>` passes through `marked` | rule L65 emits `outerHTML` verbatim | ✅ but ugly. The persisted markdown contains raw HTML, which is jarring if anyone reads the .md outside the app. |
| Callout `:::` | regex L128 → `<div data-type="callout" data-variant>` | rule L79 → `:::callout variant\n...\n:::` | ✅ |
| Details `:::` | regex L135 → `<details data-type="details">` | rule L91 → `:::details Summary\n...\n:::` | ✅ |
| TaskList | `marked` handles `- [x]` via GFM | rule L33 preserves | ✅ |
| Tables | `marked` GFM → HTML table | turndown-plugin-gfm → markdown table | ✅ |

### Subtle finding: `==` collides with code

`out.replace(/==([^=\n]+?)==/g, '<mark>$1</mark>')` runs AFTER `marked.parse`. `marked` already turned fenced/inline code into `<code>`/`<pre>` HTML, so plain regex over `==` in code IS protected — the code content is inside `<code>` tags and any `==` inside them is just text. Re-checking: `==x==` inside `<code>==x==</code>` would still match the regex and become `<code><mark>x</mark></code>`, **which is wrong**. The current regex is HTML-naive.

Edge case: someone writes a code block containing `==`:
```
`use ==flag== syntax`
```
After `marked`: `<p><code>use ==flag== syntax</code></p>` → after regex: `<p><code>use <mark>flag</mark> syntax</code></p>`. **The mark is now inside a `<code>` element.** TipTap's `Code` mark in StarterKit excludes other marks by default, so this might render as plain `use flag syntax` or as a `<mark>` inside `<code>` depending on TipTap parsing. Either way it's wrong.

Severity: P2 — unlikely in business docs, but a real footgun for technical content. Fix by tokenizing OR by switching to a markdown extension instead of post-regex (marked-extensions has a way to add inline tokens).

### Subtle finding: details summary regex doesn't handle nested marks

`/:::details\s+([^\n]+)\n([\s\S]*?)\n:::/g` — summary captured as everything until newline. If the summary contains markdown bold (`**foo**`), it's emitted to `<summary>**foo**</summary>` directly, which renders literally as `**foo**` because we don't re-render the summary through `marked`. Round-trip is therefore **lossy for formatted summaries**: rich-mode user bolds the summary text → save → reload → `<summary>` content shows `**foo**` text.

Severity: P2.

### Subtle finding 5.x: `==` regex requires same-line content

`/==([^=\n]+?)==/g` — `[^=\n]` means a highlighted span CANNOT contain `=` or cross a newline. If a user highlights "ROI = 12%" inline, the markdown would emit `==ROI = 12%==` and the regex would not match. The persisted form is `==ROI = 12%==` but on reload it shows literally because `marked` won't transform it. Round-trip silently fails.

Fix sketch (S): switch to `==([^\n]+?)==` and either consume balanced `=` or rely on the non-greedy match; or escape `=` in the saved form.

---

## 6. Provenance scope correctness

### Code path

Panel L3567: `provenanceScope={documentState.draftId ?? undefined}`.

`recordProvenanceEvent(scope, ...)`:
- L31-33: `storageKey(scope)` = `canvas.provenance.${scope || 'unknown'}`.
- If `provenanceScope` is `undefined`, the rich editor's L171-181 check `if (provenanceScope)` skips recording. So on a brand-new draft (no draftId yet), AI applies are NOT logged. ⚠️
- After the panel's `persistDraft` runs once, `documentState.draftId` is set, and subsequent applies log under that key.

### Issues

#### Issue 6.1: Events between AI apply and first draft persist are silently dropped

Sequence:
1. User opens panel → `createDocumentState` → no draftId.
2. User selects text → floating menu → "Rewrite" → `applyAiDiff` runs, but `provenanceScope === undefined` → **no event recorded**.
3. User accepts → `acceptAiDiff` runs → `updateMarkdown(md)` → `saveState: 'unsaved'` → 1400 ms later `persistDraft` → draftId now exists.
4. Subsequent AI events are logged.

**The very first AI edit on a new canvas is not in the provenance log.** For a regulated-industry audit, this is a hole.

Fix sketch (S): in the panel's apply path, ensure the draft is persisted BEFORE AI edits — already done via `ensurePersistedDraft` for workspace/output actions, but **NOT** for the floating menu AI request. Wrap `handleAIRequest` to first ensure draftId. OR generate a stable client-side `canvas-${uuid}` as `provenanceScope` from creation and migrate to draftId on persist.

#### Issue 6.2: scope changes mid-session → split log

If draftId is assigned mid-session (after the first save), pre-save events are nowhere (per 6.1). If a draft is duplicated/renamed/reassigned a new ID (the routes do this in `versions/restore`), the logs split across two keys with no merge.

#### Issue 6.3: orphan logs

`clearProvenanceLog` is exported but **never called** in `WorkCanvasDocumentPanel.tsx` (verified by grep). When a draft is deleted server-side, the localStorage key persists forever. `localStorage.setItem` in `recordProvenanceEvent` keeps growing — `MAX_EVENTS_PER_DRAFT = 200` per draft caps individual logs, but the number of keys is unbounded.

For a heavy user with hundreds of canvases over a year, this is hundreds of stale keys. Not a crisis, but not regulated-clean either.

Fix sketch (M):
- On panel mount, when hydrating drafts, GC any `canvas.provenance.*` key whose draft ID is not returned by `/api/work-canvas/drafts?conversationId=...`.
- Move provenance to the server (PR claims "Server-side persistence ... is a richer step left for a future session") — for B2B regulated, this is the right home anyway. localStorage is per-device; an auditor on a different machine sees nothing.

#### Issue 6.4: provenance is per-device

Two consultants editing the same canvas from two laptops — neither sees the other's AI apply log. A "Teresa wrote this paragraph at 14:32" entry exists only on the device of the user who triggered it. The "differentiator vs Claude/ChatGPT/Gemini/Antigravity" claim in the source comment is only true *for that single browser*. Server persistence is the right fix; until then, this is a marketing problem more than a technical one.

---

## 7. WorkCanvasShell — the other shell

### Diagnosis

`WorkCanvasShell.tsx` (1216 lines) imports `ReactMarkdown` (L19) and uses it in `MarkdownCanvas` (L336-341) which renders markdown as read-only HTML. **No TipTap, no editable text area, no rich editor, no floating menu, no inline diff, no streaming hook, no provenance.**

The "edit" path in this shell is: the chat composer (`UnifiedChatPanel`) sends a message → a proposal is generated → `handleAcceptProposal` (somewhere in the shell — verified by grep results showing proposal acceptance flow) → the proposal replaces `draft.content` wholesale. That's "AI proposes, user accepts the whole change" — single-mode, Claude/ChatGPT-style.

### Two-mode parity matrix

| Feature | WorkCanvasDocumentPanel | WorkCanvasShell |
|---|---|---|
| TipTap rich editor with inline editing | ✅ | ❌ — ReactMarkdown read-only |
| Manual user typing | ✅ | ❌ |
| Toolbar (Bold/Italic/Headings/Tables) | ✅ via `CanvasEditorToolbar` | ❌ |
| Floating AI menu on selection | ✅ via `CanvasAIFloatingMenu` | ❌ |
| Inline AI diff (accept/reject) | ✅ via `applyAiDiff`/`acceptAiDiff` | ❌ |
| Teresa streaming into the doc | ✅ via `useCanvasAIStream` + `canvas-stream-request` event | ❌ — no listener |
| Editor read-only lock during stream | ✅ C1.2 | ❌ N/A |
| Stop button for streaming | ✅ | ❌ N/A |
| Selection sync to chat | ✅ via `onSelectionChange` → `setCanvasSelection` | ⚠️ DOM `window.getSelection` only, no anchor to canvas content |
| Quick AI actions (Expand/Shorten/Polish/Translate) | ✅ (10 presets, C5) | ❌ |
| Markdown round-trip with extensions (highlight/callout/details) | ✅ C2 | N/A — read-only renderer |
| AI provenance log per span | ⚠️ (localStorage only, C6) | ❌ |
| Workspace handoff (Idea/Note/Initiative/Decision/Task) | ✅ (C3, C4.1) | ✅ (different code path via proposal acceptance) |
| Autosnapshot on PUT | ✅ C1.1 (server-side) | ✅ (same server route, but the shell rarely hits PUT — proposal-based writes go through `/operations` and explicit save) |
| Output handoff (Presentation/Table/Report) | ✅ | ⚠️ partial (different action set) |
| Versions list with prev/next stepper | ✅ | ❌ |
| Conflict resolution (409 retry) | ✅ | ⚠️ unverified |
| Mobile-friendly floating menu | ⚠️ see #8 | N/A |
| Document/MD/Rich view-mode switcher | ✅ | ❌ (different `preview`/`source` toggle) |

### Verdict

`WorkCanvasShell` is effectively a different product surface masquerading as a sibling of `WorkCanvasDocumentPanel`. The C3 convergence work documented in code comments (`menuWorkspaceActionIds` etc.) only touched workspace action vocabulary; the **editing model is fundamentally divergent**. Users entering Canvas through routes that mount `WorkCanvasShell` (the `/work-canvas` standalone route, e.g. when navigating from My Work without a chat) get the one-mode experience the user explicitly said competitors have — which is the opposite of the differentiator.

### Recommendation (L)

Either:
1. **Delete `WorkCanvasShell` entirely**, route everything through `WorkCanvasDocumentPanel` (or a `WorkCanvasDocumentPanel`-without-chat-side wrapper). Risk: `WorkCanvasShell` has its own proposal flow and research/decision/checklist renderers that aren't in the chat panel.
2. **Replace `MarkdownCanvas` and `KimiLaneCanvas` in `WorkCanvasShell` with `CanvasRichEditor`**, port the `useCanvasAIStream` hook + `CanvasAIFloatingMenu` + provenance, and reuse the same `canvas-stream-request` event so its chat composer can stream. Risk: the proposal flow in `WorkCanvasShell` writes wholesale content replacements; need to reconcile with TipTap's transactional model (probably resolve via `editor.commands.setContent(markdownToHtml(proposalMd))`).

Option 2 is the right one IF the standalone `/work-canvas` route is kept; option 1 is cleaner if you can route everyone through chat (which fits the "Canvas IS chat+canvas" framing the user articulated).

---

## 8. Mobile / keyboard edge cases

### Mobile floating menu positioning

`CanvasAIFloatingMenu` L140-143:
```ts
setPosition({
  top: rect.top - 48,
  left: rect.left + rect.width / 2,
});
```

- `rect.top - 48` — if the selection is at the top of the viewport (e.g. on mobile where you scrolled), `top` becomes negative. The menu is `position: fixed`, so it goes above the viewport and is invisible. **No clamping.**
- `left: rect.left + rect.width/2` then `transform: translateX(-50%)`. On a narrow phone (320 px), a selection near the right edge (`left + width/2 > 280px`) makes the centered menu spill off the right side. **No clamping to viewport width.**

P1 finding 8.1: floating menu clipping on mobile. Fix sketch (S):
```ts
const menuTop = Math.max(8, rect.top - 48);
const menuLeftRaw = rect.left + rect.width / 2;
const menuLeft = Math.min(Math.max(menuLeftRaw, 80), window.innerWidth - 80);
```

Also: the menu has a 256 px-wide input when `showPromptInput` is true (`w-64` Tailwind class). On a 320 px viewport, 256 + padding overflows even when centered. Should switch to `w-full max-w-[260px]` and constrain horizontally.

### Esc handling

Floating menu prompt input (L189-194): handles `Escape` to close the input and clear `customPrompt`. ✅

But **`Escape` does NOT reject a pending diff.** The `AIAcceptRejectBar` has Accept/Reject buttons but no keyboard handler. Users expect Esc to dismiss the AI suggestion. ⚠️

Also: while streaming, Esc does NOT call `stopStream`. The Stop button is the only path. Power users expect Esc.

Fix sketch (S) — add to `CanvasRichEditor`:
```ts
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (isStreaming) { onStopStream?.(); return; }
    if (hasPendingDiff) { handleRejectDiff(); return; }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [isStreaming, hasPendingDiff, handleRejectDiff, onStopStream]);
```

### iOS virtual keyboard

When the floating menu's prompt input is focused on iOS, the keyboard pushes the viewport up and the `position: fixed` menu can be hidden behind the keyboard. The menu uses `rect.top - 48` which doesn't account for visual viewport changes. Use `window.visualViewport.height` if available.

P1 finding 8.2: iOS visual viewport not handled.

### Tab order with floating menu

`CanvasAIFloatingMenu` is a child of `EditorContent`'s wrapping `div` (rich editor L255-256). Tab from the editor goes into the menu first if it's open. But once `hasPendingDiff` becomes true, the menu disappears and `AIAcceptRejectBar` appears. Tab from the editor lands... where? `AIAcceptRejectBar` has no `tabIndex` constraint. Accept/Reject buttons are reachable, but the order isn't deliberate. Acceptable.

---

## What's working well (genuinely)

1. **C1.2 read-only-during-stream**: textbook correct. `wasEditableRef` snapshot/restore pattern is right; abort cleanup is wired in three exits. This kills the worst "user types over Teresa" race.
2. **C1.5 range-only `unsetMark`**: avoids the quadratic full-doc scan and preserves cursor. The `savedFrom/savedTo` restore is a thoughtful touch most editors get wrong.
3. **`applyAiDiff` document-size delta**: measuring `insertedSpan` from `doc.content.size` delta instead of `to + replacement.length` is correct for multi-node insertions. This is a class of bug TipTap newbies hit every time.
4. **C1.1 autosnapshot**: server-side, gated by 5min OR 500-char delta. Sensible cadence. Non-fatal on failure. The right shape.
5. **CustomEvent decoupling** (`canvas-stream-request`): the chat composer doesn't need to know about the editor instance. Clean enough that you could replace the panel without touching the composer.
6. **C2 round-trip**: highlight / callout / details / textAlign / underline survive a round-trip for normal business content. This is the kind of detail that competitors get wrong (Notion exports as `<mark>`, Obsidian as `==`, neither imports the other — Consultify supports both directions).
7. **The 409 conflict retry** in `persistDraft` (L978-995) handles the most common multi-tab race correctly.
8. **`isExternalUpdateRef` guard** + `emitUpdate: false` in `setContent`: prevents the classic infinite save loop. The comment on L110-111 documents the reasoning.
9. **C6 provenance schema** (per-event prompt+original+replacement+kind+at) is the right shape for an audit log even if the storage layer is wrong (#6).
10. **C5 QUICK_ACTIONS** with Polish translations: the 10 presets are well-chosen (executive/expert/beginner is the lift competitors don't bother with).

---

## Recommended fixes — ranked by effort

### S — small, ship this week

1. **(P0)** Add Turndown rules for `aiAdded`/`aiRemoved` marks → see §2.2 sketch.
2. **(P0)** Guard `streamToCanvas` against pending diff → see §2.1 sketch.
3. **(P1)** Disable workspace/output/save-to-outputs actions during `isStreaming` → see §3.1 sketch.
4. **(P1)** Clear `selection` and propagate `null` when `hasPendingDiff` becomes true → see §4.1 sketch.
5. **(P1)** Esc handler for stream-stop and diff-reject → see §8 sketch.
6. **(P1)** Floating menu viewport clamping → see §8.1 sketch.
7. **(P2)** Switch `==` regex to a `marked` extension (or pre-tokenize before `marked.parse` to avoid the code-collision case) → see §5 subtle.

### M — medium, plan a week

1. **(P0)** Lift `hasPendingDiff` from `CanvasRichEditor` to the panel; thread it into the chat composer to disable the canvas-stream-intent route while a diff is unresolved. Pass `onPendingDiffChange` callback from `CanvasRichEditor`.
2. **(P1)** Unified `canvasAiActivity` state (idle/streaming/pending-diff) consumed by both `handleAIRequest` and `streamToCanvas` → see §4.3 sketch.
3. **(P1)** `beforeunload` save handler in the panel with `navigator.sendBeacon` → see §3.2.
4. **(P1)** Provenance scope from client-side UUID until draftId is assigned, then migrate keys → see §6.1.
5. **(P2)** Provenance GC on panel mount → see §6.3.

### L — large, plan a release

1. **(P0)** Server-side provenance persistence (write into `work_canvas_drafts.provenance_json` per event). Requires DB migration + API + client refactor. This is the one that converts the "differentiator" from a marketing claim into a real audit feature.
2. **(P0)** Decide `WorkCanvasShell` fate: either delete + redirect routes to the chat panel, or replace its read-only viewer with `CanvasRichEditor` + `useCanvasAIStream` so it has parity → see §7.
3. **(P1)** Replace the 300 ms + 1400 ms debounce double with a single coordinated save state machine. The current double-debounce is a thinko — having both is strictly worse than one tuned debounce + an immediate save on blur/idle.
4. **(P2)** Move markdown↔HTML conversion to a worker. `marked.parse` + Turndown round-trips on every keystroke can spike main-thread for documents > 50k chars.

---

## Specific bug list (file:line)

| # | Severity | Where | Bug |
|---|---|---|---|
| 1 | P0 | `useCanvasAIStream.ts:82` | `streamToCanvas` does not check for pending `aiAdded`/`aiRemoved` marks; collides with pending diff |
| 2 | P0 | `canvasMarkdownConversion.ts:32-104` | No Turndown rule for `aiAdded`/`aiRemoved` marks; saving during pending diff corrupts persisted markdown |
| 3 | P0 | `CanvasRichEditor.tsx:166` (`applyAiDiff`) | No guard against `isStreaming`; floating-menu request can race with active stream |
| 4 | P0 | `WorkCanvasShell.tsx` (entire file) | No two-mode parity; read-only viewer where the differentiator should be |
| 5 | P0 | `CanvasRichEditor.tsx:171` | When `provenanceScope === undefined` (new draft, no draftId yet), AI events silently dropped |
| 6 | P1 | `WorkCanvasDocumentPanel.tsx:1747` (`runWorkspaceAction`), `:1788` (`runOutputAction`) | Allowed during stream; reads stale `documentState.contentMd` |
| 7 | P1 | `CanvasRichEditor.tsx:87` | `onSelectionUpdate` early-returns while `hasPendingDiff`; `activeCanvasSelection` stays stale for chat |
| 8 | P1 | `WorkCanvasDocumentPanel.tsx` (no `beforeunload`) | Up to 1.7 s of unsaved keystrokes lost on tab close |
| 9 | P1 | `CanvasAIFloatingMenu.tsx:140` | No viewport clamping; menu clipped off-screen on mobile/edge selections |
| 10 | P1 | `CanvasRichEditor.tsx` (no Esc handler) | Esc does not stop stream nor reject pending diff |
| 11 | P1 | `canvasProvenanceLog.ts` (no GC, no server persist) | Orphan logs forever; logs are per-device, not auditable from a different machine |
| 12 | P2 | `canvasMarkdownConversion.ts:125` | `==` regex matches inside `<code>`; mark inserted into code |
| 13 | P2 | `canvasMarkdownConversion.ts:125` | `[^=\n]` makes `==ROI = 12%==` silently fail to rehydrate |
| 14 | P2 | `canvasMarkdownConversion.ts:135` | `<summary>` content not re-rendered through marked; bold/italic in summary literalized |
| 15 | P2 | `CanvasEditorToolbar.tsx` | No keyboard shortcuts beyond TipTap defaults; mismatch with Notebook toolbar |
| 16 | P2 | `useCanvasAIStream.ts:97` | `editor.commands.focus('end')` for 'append' mode destroys user's range selection without warning |
| 17 | P2 | server `work-canvas.routes.ts:3443` | Autosnapshot can fire twice in close PUT-PUT pairs after a 409 retry; duplicate version rows |
| 18 | P3 | `canvasMarkdownConversion.ts:71` | TextAlign rule emits raw HTML; persisted .md ugly outside the app |

---

## Sub-questions answered (compact)

**1. Stream + user typing:** Editor is locked via `setEditable(false)` (C1.2). Lock is restored on complete/abort/stop. Stop button correctly aborts. Pre-existing selection in 'append' mode is destroyed by `focus('end')` — not a bug, but no user notification.

**2. Pending diff + new stream:** Unguarded. The diff marks survive into the stream's output, and the autosave during the diff persists corrupted markdown (no Turndown rule for the marks). Both P0.

**3. Simultaneous saves:** 300 ms editor debounce + 1400 ms panel debounce + onComplete-triggered save + autosnapshot. The 409 retry handles cross-tab. The in-app race is mostly safe because `persistDraft` has the L1014-1021 guard that keeps in-memory contentMd when server-returned differs. Save-to-workspace mid-stream reads stale `documentState.contentMd` → ships a partial-stream artifact (P1). No `beforeunload` handler (P1, up to 1.7 s of typing lost on close).

**4. Selection conflicts:** Floating menu and chat use the same `canvasSelection`. While `hasPendingDiff`, selection updates are muted, so chat sees stale selection (P1). Floating-menu apply and chat-stream are not mutually exclusive (P0).

**5. Markdown round-trip:** Works for highlight/callout/details/underline/textAlign/tables/tasks normally. Three subtle holes: `==` regex naive about `<code>` and `=` characters; `<summary>` content not re-rendered. AND **no rule for aiAdded/aiRemoved marks** — when those exist in the editor (mid-diff), the markdown is corrupted (P0, see §5/§2.2).

**6. Provenance scope:** Keyed by `draftId`. First AI edit on a new canvas (before first persist) is dropped (P0/P1 depending on regulation needs). No orphan cleanup. Per-device localStorage — not actually auditable across users/machines. The C6 comment acknowledges server persistence as future work; for B2B regulated, that's a "must" not "nice-to-have".

**7. WorkCanvasShell parity:** Effectively zero. It's `ReactMarkdown` read-only with a proposal-based replace flow. None of the inline editing, streaming, floating menu, diff, or provenance ship there. Parity table in §7.

**8. Mobile/keyboard:** Floating menu doesn't clamp to viewport; iOS virtual keyboard not handled; Esc doesn't stop stream or reject diff.

---

## Final note for the owner

The two-mode dance **is real** and **is the differentiator** the user described — `CanvasRichEditor` + `useCanvasAIStream` + the `canvas-stream-request` CustomEvent bridge genuinely do what no competitor ships. But there are exactly **two coexistence cases that lose data**: (1) pending-diff persisted while corrupted, (2) stream colliding with pending diff. Both are P0, both are S-effort to fix, both will absolutely happen in real usage. Fix them this week and the story is honest. Until then, the differentiator is one customer demo away from a reputational hit.

`WorkCanvasShell` is a separate problem: the routes that mount it are giving users the one-mode experience the differentiator is supposed to refute. Pick option 1 or option 2 in §7 before GA.
