# Business Work Canvas Stage 45 - Revise Selection Edit Before Apply

Status: `PASSED`
Date: 2026-05-03
Owner: Product + Engineering

## Purpose

Stage 45 completes the first practical DocumentCanvas selection-edit loop. After seeing a preview, a user can now return to the replacement draft, adjust the proposed Markdown, and preview again before applying.

## Completed Scope

- Selection edit previews now expose `Revise edit`.
- `Revise edit` appears only for `replace_selection` previews.
- Revising closes the preview without mutating the draft.
- The replacement Markdown draft remains intact.
- The user can run `Preview edit` again after revising.
- `Apply` and `Reject` remain explicit choices.

## Safety Contract

- Revise is not apply.
- Revise is not reject.
- Revise does not call a mutation endpoint.
- The replacement draft stays in the Markdown-first editor flow.
- Non-selection operations do not show misleading selection-edit controls.

## Quality Gate

Stage 45 passes because:

- preview includes a revise action for selection edits,
- revising preserves the replacement Markdown,
- revising does not mutate the Canvas draft,
- a second preview can be generated after revision,
- targeted validation passes.

Stage 45 would fail if:

- revise implicitly saved or applied an edit,
- replacement content was lost after leaving preview,
- generic block/output operations displayed the selection-edit revise action.
