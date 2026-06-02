# Business Work Canvas Stage 0 Baseline

Status: `DRAFT / STAGE 0 QUALITY BASELINE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 0 freezes the current Work Canvas behavior before native blocks, richer renderers and business workflow runtime are added.

The baseline protects the most important invariant:

```text
chat context + Canvas draft + versions + downstream actions must stay connected
```

No later implementation stage should pass if it breaks any item in this document.

## 2. Current Runtime Inventory

Primary frontend files:

- `src/components/AIChat/UnifiedChatPanel.tsx`
- `src/components/AIChat/WorkCanvasDocumentPanel.tsx`
- `src/components/AIChat/CanvasMarkdownRenderer.tsx`
- `src/types/canvasWorkspace.ts`
- `src/utils/canvas/canvasDraftAdapter.ts`
- `src/utils/canvas/canvasActionAvailability.ts`
- `src/services/api.ts`

Primary backend files:

- `server/src/routes/work-canvas.routes.ts`

Primary tests:

- `tests/components/AIChat/UnifiedChatPanel.test.tsx`
- `tests/components/AIChat/WorkCanvasDocumentPanel.test.tsx`
- `tests/integration/routes/work-canvas.routes.test.ts`
- `tests/unit/utils/canvasWorkspace.test.ts`

## 3. Current Data Flow

### 3.1 Opening Canvas

The user opens Canvas from `UnifiedChatPanel`. The left side remains the existing Teresa chat. The right side mounts `WorkCanvasDocumentPanel`.

Required context:

- existing `activeConversationId` is passed as `conversationId`,
- Canvas reports active document state through `onActiveDocumentChange`,
- Canvas reports current selection through `onCanvasSelectionChange`,
- no second chat is created.

### 3.2 Sending Chat While Canvas Is Open

When the user sends a message, `UnifiedChatPanel` builds the stream context.

Required context packet:

- `conversationId`,
- `workspaceContext`,
- `canvasContext`,
- active draft id when persisted,
- active title,
- selected text when present.

If a selection exists, selected Canvas context takes priority over generic document context.

### 3.3 Draft Save And Autosave

`WorkCanvasDocumentPanel` persists drafts through Work Canvas API methods.

Required invariants:

- new drafts receive a stable `draftId`,
- existing drafts update through the persisted draft endpoint,
- title and Markdown content survive read-back,
- save state returns to `saved`,
- autosave does not overwrite newer local content with stale responses.

### 3.4 Version History And Restore

Canvas version operations use:

- `GET /api/work-canvas/drafts/:draftId/versions`,
- `POST /api/work-canvas/drafts/:draftId/versions/:versionId/restore`.

Required invariants:

- restore creates a snapshot before overwriting current content,
- restored draft keeps the same `draftId`,
- restored content returns with synced Markdown projection,
- UI updates to restored Markdown content,
- version history remains available after restore.

### 3.5 Workspace And Output Actions

Current actions:

- save to idea,
- save as note,
- create initiative,
- create presentation,
- create table,
- create report,
- share,
- copy,
- upload,
- close.

Required invariants:

- actions ensure draft persistence before durable conversion,
- action responses include read-back,
- linked resources preserve source draft context,
- action availability is honest.

## 4. Stage 0 Context Preservation Checklist

Every later implementation stage must preserve:

| Context | Required behavior |
| --- | --- |
| `conversationId` | Chat stream context still points to the active conversation. |
| `draftId` | Persisted Canvas draft remains stable across save, restore and actions. |
| document title | User-edited title persists and is used by downstream actions. |
| Markdown content | User-authored Markdown survives save, autosave, restore and renderer failures. |
| selected text | Selected Canvas text is passed to Teresa without noisy persistent UI. |
| versions | Every mutation that changes durable content can create or preserve a version snapshot. |
| projection state | Business UI shows `synced`, `stale`, `failed` or `missing` honestly. |
| linked resources | Idea, Note, Initiative, Report, Table and Presentation outputs keep lineage. |
| degraded renderer | Failure does not blank the Canvas or expose raw JSON. |

## 5. Stage 0 Baseline Tests

Stage 0 adds or reinforces tests for:

- opening Canvas without creating a second chat,
- passing active Canvas document context into Teresa stream,
- passing selected Canvas text into Teresa stream,
- hiding selected-context chrome in the chat side,
- save/manual save preserving draft state,
- autosave preserving draft state,
- loading version history,
- restoring a version while preserving active draft context,
- backend restore endpoint creating a snapshot and synced projection,
- workspace/output actions preserving read-back.

## 6. Known Non-Canvas Build Risk

The repository has existing backend TypeScript/build issues in non-Canvas areas. Stage 0 validation should separate:

- Canvas targeted tests and lints,
- backend Work Canvas route tests,
- broader backend build/typecheck failures unrelated to Canvas.

Do not let unrelated build noise hide Canvas regressions.

## 7. Stage 0 Quality Gate

Stage 0 passes only when:

- targeted `UnifiedChatPanel` Canvas tests pass,
- targeted `WorkCanvasDocumentPanel` tests pass,
- targeted Work Canvas route tests pass,
- edited files have no linter errors,
- the baseline checklist is documented,
- the implementation plan remains linked from `CANVAS_SOURCE_OF_TRUTH.md`.

Stage 0 fails if:

- chat stream loses active Canvas context,
- restoring a version changes or loses the draft identity,
- any existing save/share/version/workspace action regresses,
- raw JSON appears in the business document view,
- a future stage would lack a documented context checklist.

