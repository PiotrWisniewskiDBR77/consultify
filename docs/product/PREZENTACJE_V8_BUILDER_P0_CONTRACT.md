# Prezentacje v8 - Builder P0 contract

> Status: Draft v8
> Cel: Zdefiniowac build-ready kontrakt dla buildera jako drugiej polowy Gamma-primary workflow, bez odrywania go od `consultify` shell i traceability modelu.

---

## 1. Rola buildera

Builder nie jest osobnym produktem i nie jest swobodnym edytorem slajdow.
W `v8` builder ma jedna role:

`przejac wygenerowany lub otwarty deck i doprowadzic go do present/share/export-ready state`

To oznacza:
- wizard tworzy draft,
- builder dopracowuje draft,
- deliver dzieje sie z tego samego deck context.

---

## 2. P0 success criteria

Builder P0 jest domkniety, gdy:
- otwiera deck bezposrednio po generacji bez utraty outline i source context,
- user widzi outline, canvas i tools/actions w jednym flow,
- card-level i deck-level AI operacje sa reviewable,
- share/export nie wymagaja wychodzenia do innego "swiata produktu",
- traceability i refresh sa widoczne, ale nie psuja prostoty edycji.

---

## 3. Builder layout contract

P0 builder ma trzy stale strefy pracy:

### 3.1 Left rail - Outline rail

Obowiazkowe elementy:
- lista cards/slides w kolejnosci decku,
- slide title,
- slide intent badge,
- state marker:
  - selected
  - has AI proposal
  - has refreshable content
  - has validation issue
- reorder capability
- quick add / duplicate / delete entry points

P0 behaviors:
- single select slide,
- drag reorder,
- click jumps canvas to selected slide,
- outline reflects generated order from wizard.

### 3.2 Center - Canvas / active card surface

Obowiazkowe elementy:
- active slide render,
- editable blocks,
- preview close enough to delivery output,
- selected block state,
- card notes / card metadata access without leaving deck context.

P0 behaviors:
- edit current card content,
- add/remove/reorder blocks in current card,
- change card title and key message,
- preserve stable identifiers.

### 3.3 Right rail - Tools and actions

Obowiazkowe elements:
- card actions,
- deck actions,
- AI actions,
- theme/page setup,
- traceability / refresh,
- quality/share/export entry points.

P0 groups:
- `AI`
- `Style`
- `Traceability`
- `Delivery`

No fourth competing workflow surface should exist outside this builder contract.

---

## 4. Builder state model

### 4.1 Required state objects

- `selectedCardId`
- `selectedBlockId`
- `deckDocument`
- `outlineState`
- `pendingAiProposals`
- `qualityGateSummary`
- `shareState`
- `refreshState`
- `dirtyState`

### 4.2 Required derived states

- `hasUnsavedChanges`
- `hasPendingAiReview`
- `hasRefreshableSelection`
- `hasDeliveryBlockingIssues`
- `isGeneratedButUnreviewed`

### 4.3 Required loading entry paths

Builder must support:
- open after wizard generation,
- open from library,
- open from shared/deep-link safe route if user has permissions,
- open from artifact-triggered create flow.

---

## 5. Wizard -> builder continuity contract

### 5.1 Required handoff payload

Builder must receive or load:
- canonical `deckId`,
- canonical deck document,
- resolved outline,
- generation settings,
- selected sources,
- source refs,
- context pack snapshot reference,
- initial warnings / quality hints.

### 5.2 What must survive the handoff

The following may not be lost after generation:
- card ordering from outline,
- card intents,
- source-backed semantics,
- notes if already generated,
- AI-generated vs source-backed distinction,
- deck-level metadata,
- warnings from generation.

### 5.3 What builder may add after handoff

- manual edits,
- AI proposals,
- theme changes,
- share configuration,
- refresh decisions,
- delivery preparation state.

---

## 6. P0 actions by area

### 6.1 Outline rail actions

- select slide
- reorder slide
- add slide after current
- duplicate slide
- delete slide
- mark unresolved issue presence

### 6.2 Canvas actions

- edit block content
- add block
- remove block
- reorder blocks
- edit card title
- edit key message
- edit notes

### 6.3 Right rail AI actions

- propose rewrite of selected block
- propose shorten of selected block
- propose notes for selected card
- propose summary card
- propose deck-wide tighten tone
- propose refreshable updates

All AI actions must enter proposal review, not direct mutation.

### 6.4 Right rail Style actions

- theme switch
- page/background setup
- typography/color defaults
- layout recommendation visibility

### 6.5 Right rail Traceability actions

- inspect source refs for card/block
- inspect deck origin
- refresh current refreshable block
- inspect what is source-backed vs AI-only

### 6.6 Right rail Delivery actions

- run quality gates
- create/update share link
- export PPTX
- export PDF
- export HTML
- export PNG
- inspect analytics summary

---

## 7. P0 card model expectations in UI

Each card shown in builder must expose:
- title
- intent
- order position
- notes state
- source-backed state
- AI proposal state
- quality issue state

Each block shown in builder must expose:
- block type
- content
- source-backed or AI-only marker when relevant
- refreshable marker when relevant
- quick AI edit entry point when allowed

---

## 8. Quality and review contract inside builder

Builder P0 must visually preserve the distinction between:
- current accepted deck content,
- pending AI proposal,
- rejected proposal history if surfaced later,
- validation/quality issue.

P0 does not require full comment/collab editor.
It does require:
- visible review state,
- no silent mutation,
- no ambiguity about what changed.

---

## 9. Delivery continuity contract

Share/export must operate on the same deck context the user is editing.

That means:
- no separate export-only reconstruction step in UI,
- no separate share-only surface with a different deck interpretation,
- quality gates must evaluate the same canonical deck document,
- analytics summary belongs to the same deck object.

---

## 10. P0 route and runtime implications

Builder P0 depends on:
- `GET /api/presentations/decks/:id`
- `PUT /api/presentations/decks/:deckId/autosave`
- quality/share/export endpoints from `/api/presentations`
- canonical deck normalization bridge
- future AI proposal endpoints or equivalent target contract

Builder P0 must not depend on `/api/presentations-v4` to render the standard authoring experience.

---

## 11. Out of scope for builder P0

- full realtime multi-user editing,
- full design-tool freedom,
- advanced template authoring studio,
- enterprise-only governance dashboards,
- PPTX import editing flow,
- presence cursors as a baseline requirement.

---

## 12. Acceptance checklist

- Generated deck opens in builder with preserved outline order.
- Left rail, center canvas and right rail are all present in one continuous workflow.
- Card-level quick AI edits exist as proposals, not silent mutations.
- Theme/page setup is accessible without leaving builder.
- Share/export actions are available from the same deck context.
- Traceability and refresh are visible but do not dominate the editing flow.
- Builder can be the default second step after generation for Gamma-like usage.
