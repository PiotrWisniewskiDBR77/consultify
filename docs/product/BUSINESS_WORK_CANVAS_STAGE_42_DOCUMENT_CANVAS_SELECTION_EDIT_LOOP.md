# Business Work Canvas Stage 42 - DocumentCanvas Selection Edit Loop

Status: `PASSED`
Date: 2026-05-03
Owner: Product + Engineering

## Purpose

Stage 42 adds the first governed DocumentCanvas editing loop:

```text
select text -> draft replacement -> preview -> apply/reject -> versioned draft
```

This is intentionally not a full TipTap/ProseMirror migration. The runtime remains Markdown-first, and the edit loop reuses the existing Canvas operation approval model.

## Completed Scope

- Selected Canvas text now exposes an edit panel next to the existing block generation actions.
- The user can write replacement Markdown for the selected text.
- Empty replacements cannot be previewed from the UI.
- Preview runs through the governed `replace_selection` operation with `previewOnly: true`.
- Apply reuses the existing `pendingOperation` approval path and only mutates the draft after explicit approval.
- The same version/diff/read-back behavior used by other Canvas transformations remains in force.
- A focused component test verifies the selected-text edit loop.

## Safety Contract

- Markdown remains the canonical document source.
- Selection edits do not mutate the draft during preview.
- Reject keeps the draft unchanged.
- Apply sends `approved: true` through the existing Canvas operation route.
- The UI does not claim full rich-text editor capabilities.

## Quality Gate

Stage 42 passes because:

- selected text exposes a clear edit affordance,
- empty replacement text is blocked,
- preview uses `replace_selection`,
- apply requires explicit user approval,
- targeted component coverage exists,
- validation for the changed Canvas files passes.

Stage 42 would fail if:

- selected edits bypassed preview/approval,
- replacement editing created a parallel non-Markdown document runtime,
- the product documentation implied the full TipTap/ProseMirror editor was already shipped.
