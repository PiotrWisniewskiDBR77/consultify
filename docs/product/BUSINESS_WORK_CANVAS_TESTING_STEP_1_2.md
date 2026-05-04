# Business Work Canvas Testing - Steps 1 and 2

Status: `ACTIVE TESTING CONTRACT`
Date: 2026-05-03
Owner: Product + Engineering

## Step 1 - User Flows

These flows define what must work before Canvas can be treated as a product surface rather than a component demo.

### Flow A - Chat Opens Canvas

1. User enters the authenticated Teresa chat.
2. User sends an explicit Canvas command, for example `/canvas document`.
3. The command opens the right-side Canvas in the same conversation.
4. The command is acknowledged locally and is not treated as a Teresa stream prompt.
5. The default DocumentCanvas is visible and editable.

Pass condition: chat remains on the left, Canvas opens on the right, and no separate runtime or navigation is created.

### Flow B - Selection Edit Loop

1. User switches Canvas to Markdown view.
2. User selects existing Markdown text.
3. Canvas shows selection actions and the selected-text edit panel.
4. User writes replacement Markdown.
5. User previews the edit.
6. Canvas shows visible diff preview.
7. User can revise the edit without losing replacement text.
8. User previews again and applies explicitly.

Pass condition: the draft mutates only after `Apply edit suggestion`; preview/revise do not mutate the draft.

### Flow C - Writing Shortcuts

1. User selects Markdown text.
2. User chooses a writing shortcut such as `Action list`.
3. Canvas fills replacement Markdown.
4. User must still click `Preview edit`.

Pass condition: shortcuts are deterministic draft helpers and never bypass preview/apply.

## Step 2 - Playwright Coverage

The first Playwright gate for the modern Canvas editor flow lives in:

```text
tests/e2e/smoke/work-canvas-editor-flow.spec.ts
```

It verifies:

- authenticated Teresa chat loads,
- the right-side DocumentCanvas can be opened from the chat UI,
- Markdown view is reachable,
- selected text opens the edit panel,
- replacement Markdown can be previewed,
- visible diff preview appears,
- `Revise edit` preserves replacement Markdown,
- second preview can be generated,
- apply mutates the Canvas draft only after explicit approval,
- no raw internals leak into the UI.

The `/canvas document` command route remains covered by focused component tests because the current E2E mock auth can reject best-effort chat message persistence for team conversations. The Playwright gate therefore exercises the same Canvas editor surface through the stable UI open action.

## Local Command

Run only the new editor-flow gate:

```bash
E2E_USE_WEB_SERVER=true E2E_MODE=true E2E_BACKEND_RUNNER=tsx playwright test --config playwright.config.ts tests/e2e/smoke/work-canvas-editor-flow.spec.ts --project=chromium --workers=1
```

Run the V10 Canvas Playwright pack:

```bash
npm run test:v10:canvas:playwright
```

## Known Limits

- This is a smoke/e2e gate, not full visual regression.
- It tests the current Markdown-first editor loop, not a future TipTap/ProseMirror runtime.
- Existing `/ai/work-canvas` smoke specs remain as legacy split-screen coverage until the modern chat-integrated Canvas fully replaces them.

## GA Expansion Gates

The production GA program extends this testing contract with:

- role matrix tests for proposal approval capability enforcement,
- artifact promotion read-back tests for `save-as-artifact`,
- Research Canvas tests for evidence/source degraded states and final report handoff,
- interactive block tests for table filter/sort/export, chart fallback and Mermaid export,
- refresh/persistence tests for draft, artifact ids and ResearchSession ids,
- observability checks for save failures, conflicts, approval denials and promotion failures.

These GA gates are tracked in `BUSINESS_WORK_CANVAS_GA_READINESS_AUDIT.md` and Stage 47-54 of `BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`.
