# Business Work Canvas Stage 1 Premium Surface Gate

Status: `DRAFT / STAGE 1 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 1 makes the existing Work Canvas feel like a premium, persistent, Claude-like business artifact surface before native artifact blocks are introduced.

This stage does not introduce the block model. It locks the current shell, topbar, diagnostics, empty/start state, save/action states and split layout so Stage 2 can add blocks without changing the user's mental model.

## 2. Completed Scope

Stage 1 baseline includes:

- compact editable title topbar,
- grouped output/workspace/file/view/diagnostics actions,
- DBR77-oriented start/template menu,
- quiet selected-context behavior,
- diagnostics menu with lifecycle, format, projection, save and action state,
- version controls and show-changes controls in diagnostics,
- subtle action feedback region,
- stable Canvas edge resize in split chat,
- document and Markdown views reading the same source.

## 3. Context Preservation Rules

Stage 1 must continue to preserve all Stage 0 context anchors:

- active `conversationId`,
- active Canvas document title,
- active `draftId` after persistence,
- selected Canvas text,
- Markdown projection,
- save state,
- version state,
- downstream action read-back.

No UI polish task may create a second chat, remove stream context, or hide failed save/projection states.

## 4. Quality Gate

Stage 1 passes only when:

- Canvas topbar action groups render and remain accessible,
- template/start menu explains DBR77 business work templates,
- save state is visible in diagnostics without showing noisy status text in the topbar,
- action state is visible in diagnostics,
- action feedback is available as a status region,
- selected Canvas context is still passed quietly,
- resize edge and chat input alignment remain stable,
- targeted Canvas tests pass,
- changed files have no linter errors.

Stage 1 fails if:

- Canvas feels like a temporary sidebar rather than a work surface,
- topbar actions become decorative or unavailable without honest state,
- save/action/projection state becomes invisible,
- selected context chrome reappears persistently,
- Stage 0 context tests regress.

## 5. Next Stage

The next implementation stage is Stage 2: Artifact Block Contract.

Stage 2 may add typed artifact blocks only after preserving this Stage 1 surface contract:

```text
stable shell + quiet context + diagnostics + save/action/version visibility
```

