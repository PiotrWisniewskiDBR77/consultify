# Business Work Canvas Stage 44 - DocumentCanvas Writing Shortcuts

Status: `PASSED`
Date: 2026-05-03
Owner: Product + Engineering

## Purpose

Stage 44 adds the first safe writing shortcuts to DocumentCanvas. This moves the editor closer to the ChatGPT/Gemini Canvas pattern while staying honest: these shortcuts are deterministic Markdown draft helpers, not AI rewriting and not a full rich-text editor.

## Completed Scope

- The selected-text edit panel now includes writing shortcut buttons.
- `Use selection` copies the selected text into the replacement draft.
- `Action list` converts selected lines into Markdown checklist items.
- `Bullet summary` converts selected lines into Markdown bullets.
- Shortcuts only fill the replacement draft.
- Preview still runs through the governed `replace_selection` operation.
- Apply still requires explicit user approval.
- A focused component test verifies shortcuts do not bypass preview.

## Safety Contract

- Markdown remains the only replacement format.
- Shortcuts do not call the backend.
- Shortcuts do not mutate the Canvas draft.
- The draft changes only after preview and explicit apply.
- The UI must not describe these helpers as AI rewriting.

## Quality Gate

Stage 44 passes because:

- selected text exposes writing shortcuts,
- shortcuts populate replacement Markdown,
- preview/apply remains the only mutation path,
- shortcut behavior is covered by a targeted test,
- validation passes for the changed files.

Stage 44 would fail if:

- a shortcut saved or applied content directly,
- shortcuts claimed AI behavior without AI execution,
- shortcut output bypassed the Markdown-first contract.
