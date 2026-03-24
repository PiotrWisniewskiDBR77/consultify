# Prezentacje v8 - AI operations spec

> Status: Draft v8
> Cel: Zamknac implementacyjny kontrakt operacji AI dla prezentacji, tak aby `AI suggest`, `AI draft` i `AI apply after acceptance` byly jednoznaczne na poziomie runtime, UX i danych.

---

## 1. Po co istnieje ten dokument

`PREZENTACJE_V8_AI_GOVERNANCE.md` ustawia zasady.
Ten dokument ustawia wykonanie:
- scope operacji,
- shape proposal,
- state machine,
- relacje proposal -> accepted mutation,
- bridge z wizarda do buildera,
- mapowanie obecnych mechanizmow na target runtime.

---

## 2. Zasada nadrzedna

Kazda istotna operacja AI w decku nalezy do jednej klasy:
- `AI suggest`
- `AI draft`
- `AI apply after acceptance`

Kazda mutacja decku musi byc:
- identyfikowalna,
- reviewable,
- odwolywalna przez zrozumienie diffu,
- przypisana do konkretnego scope.

---

## 3. Scope operacji

### 3.1 Deck scope

Operacja dotyczy calego decku, np.:
- generate full deck draft,
- tighten whole narrative,
- create executive summary card,
- propose audience-specific variant,
- quality rewrite across multiple cards.

Target:
- `target.scope = 'deck'`
- `target.deckId = ...`

### 3.2 Card scope

Operacja dotyczy jednej karty/slajdu, np.:
- rewrite slide,
- generate notes for slide,
- change intent of slide,
- refresh slide-level source-backed content.

Target:
- `target.scope = 'card'`
- `target.deckId = ...`
- `target.cardId = ...`

### 3.3 Block scope

Operacja dotyczy jednego bloku, np.:
- shorten paragraph,
- rewrite bullets,
- regenerate chart explanation,
- refresh one KPI block.

Target:
- `target.scope = 'block'`
- `target.deckId = ...`
- `target.cardId = ...`
- `target.blockId = ...`

---

## 4. Operation classes

### 4.1 AI suggest

Charakter:
- bez zapisu do decku,
- analiza albo rekomendacja,
- moze byc transient, ale jesli ma znaczenie produktowe, powinna miec audit trace.

Przyklady:
- "this deck is too long"
- "slide 4 should move earlier"
- "consider executive summary"
- "this block lacks source grounding"

### 4.2 AI draft

Charakter:
- tworzy proposal content lub structure,
- nie mutuje zaakceptowanego decku,
- musi byc reviewable jako proposal.

Przyklady:
- draft outline,
- draft deck,
- draft summary slide,
- draft block rewrite,
- draft notes,
- draft refresh proposal.

### 4.3 AI apply after acceptance

Charakter:
- mutuje canonical deck dopiero po akceptacji usera,
- musi wskazywac, jaki proposal zostal przyjety,
- musi zapisac mutation result.

Przyklady:
- apply accepted rewrite,
- apply accepted deck-wide tighten,
- apply accepted refresh,
- apply accepted generated notes.

---

## 5. Canonical operation payload

```ts
type PresentationAiOperation = {
  operationId: string;
  deckId: string;
  organizationId: string;
  actorId: string;

  class: 'suggest' | 'draft' | 'apply_after_acceptance';
  kind:
    | 'outline_proposal'
    | 'deck_generation'
    | 'deck_rewrite'
    | 'card_rewrite'
    | 'block_rewrite'
    | 'notes_generation'
    | 'visual_plan'
    | 'refresh_proposal'
    | 'quality_suggestion'
    | 'ordering_suggestion';

  target: {
    scope: 'deck' | 'card' | 'block';
    cardId?: string | null;
    blockId?: string | null;
  };

  input: {
    userPrompt?: string | null;
    sourceContextRefs?: string[];
    generationSettingsSnapshot?: Record<string, unknown> | null;
    currentDeckVersionRef?: string | null;
  };

  proposal: {
    summary: string;
    rationale?: string | null;
    diffPreview?: DiffPreview | null;
    proposedContent?: unknown;
    warnings?: string[];
  };

  state:
    | 'drafted'
    | 'pending_review'
    | 'accepted'
    | 'rejected'
    | 'applied'
    | 'failed';

  resolution: {
    resolvedAt?: string | null;
    resolvedBy?: string | null;
    rejectionReason?: string | null;
    appliedMutationRef?: string | null;
  };

  createdAt: string;
  updatedAt: string;
};
```

---

## 6. Diff preview contract

Every `AI draft` that can affect persisted deck content must expose a diff preview.

### 6.1 Deck scope diff

Must show:
- cards added,
- cards removed,
- cards reordered,
- cards changed.

### 6.2 Card scope diff

Must show:
- title change,
- key message change,
- blocks added/removed/reordered,
- notes change,
- source-backed risk if any.

### 6.3 Block scope diff

Must show:
- before text/content summary,
- after text/content summary,
- whether source grounding changed,
- whether refreshable state changed.

### 6.4 Minimum requirement

Even if full structural diff is unavailable,
the system must provide a normalized patch summary:
- `what changes`
- `where it changes`
- `why AI proposes it`

Current in-place `agent-edit` behavior does not satisfy this target contract.

---

## 7. State machine

Canonical state flow:

`drafted -> pending_review -> accepted -> applied`

Alternative endings:
- `drafted -> pending_review -> rejected`
- `drafted -> failed`
- `accepted -> failed`

Rules:
- only `accepted` operations may produce deck mutation,
- only `applied` operations may update canonical deck content,
- `rejected` operations must not mutate deck state,
- `failed` operations must preserve audit trail.

---

## 8. Proposal to mutation bridge

### 8.1 Required relation

Every applied mutation must reference:
- source `operationId`
- target deck version before apply
- target deck version after apply

### 8.2 Required mutation record

```ts
type DeckMutationRecord = {
  mutationId: string;
  deckId: string;
  operationId: string;
  scope: 'deck' | 'card' | 'block';
  beforeVersionRef: string;
  afterVersionRef: string;
  patchSummary: string[];
  appliedAt: string;
  appliedBy: string;
};
```

### 8.3 Why this matters

Without this bridge:
- review cannot be trusted,
- wizard output and builder output can diverge silently,
- analytics and audit cannot explain what AI changed.

---

## 9. Wizard -> builder AI continuity

### 9.1 Wizard phase

Wizard may create:
- outline proposals,
- deck draft proposals,
- generated notes proposals,
- visual planning proposals.

### 9.2 Builder phase

Builder must receive:
- accepted generated draft as baseline deck state,
- unresolved proposals if user proceeds before resolving all,
- operation references needed for audit and re-opened review.

### 9.3 Required continuity rule

If AI produced the first deck draft in wizard,
builder must know:
- which cards were AI-generated,
- which content is source-backed,
- which proposals are still pending,
- which operations have already been accepted and applied.

---

## 10. Mapping current runtime to target contract

### 10.1 Current `generate/outline`

As-is:
- creates outline result for review

Target mapping:
- `AI draft`
- `kind = outline_proposal`
- `scope = deck`

### 10.2 Current `generate/deck`

As-is:
- builds deck from outline and setup

Target mapping:
- `AI draft`
- `kind = deck_generation`
- `scope = deck`

Important:
- generation output should become accepted baseline only after explicit user progression or acceptance step defined by UX.

### 10.3 Current `agent-edit`

As-is:
- direct in-place mutation after keyword interpretation

Target mapping:
- not acceptable as final contract

Required refactor:
- reinterpret `agent-edit` intent as proposal generation,
- return diff preview,
- apply only after acceptance.

### 10.4 Current block refresh

As-is:
- returns refreshed content for one refreshable block

Target mapping:
- `AI draft` or governed refresh proposal depending on source

Rule:
- refresh must not silently overwrite accepted content.

---

## 11. Operation kinds that P0 must support

### Deck-level

- `outline_proposal`
- `deck_generation`
- `deck_rewrite`
- `quality_suggestion`

### Card-level

- `card_rewrite`
- `notes_generation`
- `visual_plan`
- `refresh_proposal`

### Block-level

- `block_rewrite`
- `refresh_proposal`

Anything beyond this is optional for later phases.

---

## 12. UX resolution contract

Every reviewable proposal must support:
- accept
- reject
- regenerate
- inspect source context
- edit manually instead

Optional later:
- partial accept
- compare multiple proposals
- batch accept

P0 does not require every advanced review pattern.
P0 does require one consistent review contract.

---

## 13. Data storage recommendation

Short-term rollout-safe approach:
- persist operation metadata separately from canonical deck document,
- store only applied results in canonical deck,
- preserve proposal payload and diff preview for audit,
- keep unresolved proposals queryable by `deckId`.

Do not:
- serialize raw pending proposals into accepted deck content as if they were already applied.

---

## 14. Acceptance checklist

- Every important AI action can be classified as suggest, draft or apply-after-acceptance.
- Every mutation-capable proposal has a target scope: deck, card or block.
- Every reviewable proposal exposes at least a normalized patch summary.
- Every applied deck mutation references a prior accepted proposal.
- Wizard-generated AI output can move into builder without losing review context.
- Current direct `agent-edit` behavior is treated as transitional, not canonical.
