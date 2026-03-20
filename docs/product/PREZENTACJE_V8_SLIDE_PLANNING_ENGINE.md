# Prezentacje v8 - Slide planning engine

> Status: Draft v8
> Cel: Zdefiniowac AI planning engine, ktory prowadzi od promptu, template i artifact context do outline, slide recipe i reviewable draft decku.

---

## 1. Zasada nadrzedna

AI planning engine nie generuje od razu dowolnych slajdow.
Najpierw planuje:
- jaki deck ma powstac,
- jakie intents powinny wystapic,
- jaka ma byc kolejnosc,
- jaki layout i block mix dostaje kazdy slide,
- jaki poziom density i visuals ma miec dany slide.

To jest warstwa, ktora zamienia:

`prompt + sources + template + mode`

na:

`outline + slide recipes + planning rationale`

---

## 2. Inputs planning engine

Planning engine dostaje:
- `promptOrBrief`
- `selectedSources`
- `ContextPack`
- `template`
- `presentationMode`
- `communicationRegister`
- `audience`
- `goal`
- `language`
- `contentDepth`
- `themeOrBrandDefaults`
- `visualSettings`

Minimalnie musi rozumiec 4 create modes:
- `library-first`
- `template-first`
- `artifact-first`
- `blank-brief`

---

## 3. Planning stages

### Stage 1 - Create interpretation

Silnik rozpoznaje:
- czy deck ma byc primarily narrative, analytical, status, workshop,
- jaka jest glowna decyzja lub message,
- czy user daje glownie text, data, artifacts czy mieszany context.

Output:
- `deckIntentSummary`
- `recommendedDeckType`
- `recommendedPresentationMode`

### Stage 2 - Source understanding

Silnik ustala:
- jakie artifacts sa glownymi zrodlami,
- jakie sa key facts, key messages, key numbers,
- co jest source-backed,
- gdzie sa luki wymagajace AI drafting.

Output:
- `sourcePriorityMap`
- `factClusters`
- `dataClusters`
- `evidenceGaps`

### Stage 3 - Outline planning

Silnik tworzy outline:
- wybiera intents,
- ustala order,
- przypisuje role slajdom,
- dobiera approximate density.

Output:
- `OutlinePlan[]`

### Stage 4 - Slide recipe planning

Dla kazdego slajdu silnik tworzy recipe:
- intent,
- layout family,
- required blocks,
- optional blocks,
- source refs,
- visual policy,
- notes policy.

Output:
- `SlideRecipe[]`

### Stage 5 - Review package

Przed full draftem user dostaje reviewable package:
- ordered outline,
- key message per slide,
- source grounding summary,
- visual hints,
- warnings.

---

## 4. Canonical planning objects

```ts
type OutlinePlan = {
  outlineId: string;
  orderIndex: number;
  intent: string;
  workingTitle: string;
  keyMessage: string;
  sourceRefs: string[];
  confidence: 'high' | 'medium' | 'low';
  reason: string;
};

type SlideRecipe = {
  outlineId: string;
  targetIntent: string;
  layoutFamily: string;
  requiredBlocks: string[];
  optionalBlocks: string[];
  density: 'minimal' | 'concise' | 'detailed' | 'extensive';
  visualPolicy: 'hero_visual' | 'supporting_visual' | 'data_first' | 'text_only' | 'diagram_first';
  notesPolicy: 'none' | 'light' | 'standard' | 'speaker_heavy';
  sourceRefs: string[];
  aiGeneratedFields: string[];
  warnings: string[];
};
```

---

## 5. Planning rules by create mode

### 5.1 Template-first

Planning behavior:
- template outline is the starting scaffold,
- AI may adapt titles, density and source mapping,
- required template intents must survive unless explicitly removed by user.

Use when:
- user wants strong default structure,
- recurring deck type,
- branded repeatable output.

### 5.2 Artifact-first

Planning behavior:
- artifact semantics drive the outline,
- source-backed slides should dominate,
- AI fills narrative glue and summary layers.

Use when:
- initiative, report, financial analysis, note or workspace is the main source.

### 5.3 Blank-brief

Planning behavior:
- prompt drives first structure,
- AI-created narrative plays bigger role,
- system must signal weaker grounding clearly.

Use when:
- user has intent but not structured artifact context.

### 5.4 Library-first quick create

Planning behavior:
- system should recommend best starting path,
- may redirect to template-first or blank-brief behavior after minimal setup.

---

## 6. Planning rules by presentation mode

### `SHOW`

Prefer:
- fewer slides than document mode,
- stronger narrative sequence,
- fewer words per slide,
- more visuals,
- stronger speaker notes.

### `DOCUMENT`

Prefer:
- denser evidence,
- tables/charts where useful,
- fewer decorative visuals,
- stronger explicit source grounding.

### `BRIEFING`

Prefer:
- concise status-like structure,
- executive summary,
- KPI/risk/next-step patterns,
- low friction and low slide count.

### `WORKSHOP`

Prefer:
- frameworks,
- process/timeline/diagram structures,
- prompts and action-oriented slides,
- less decorative polish, more facilitation utility.

---

## 7. Intent planning rules

### Required defaults

If no better reason exists:
- every deck should include a `cover`,
- most business decks should include either `executive_summary` or equivalent early synthesis,
- most delivery decks should end with `next_steps` or equivalent close.

### Conditional intents

- `kpi_dashboard` if strong KPI/data clusters exist
- `risk_overview` if RAID/risk context exists
- `comparison` if multiple options or before/after logic exists
- `timeline` if sequence in time matters
- `process` if operating model or workflow is central

### Anti-pattern

Planning engine must not:
- produce repetitive cards with the same role,
- create analytical slides without strong data reason,
- create decorative cards that do not support the story.

---

## 8. Source grounding rules

For each outline node and slide recipe, engine must classify content as:
- `source-backed`
- `source-backed with AI synthesis`
- `AI-drafted with weak grounding`

Planning review should expose this.

Rules:
- source-backed slides should be preferred when artifacts exist,
- AI-only drafting should be explicit,
- unsupported claims must not be presented as grounded facts.

---

## 9. Planning review contract

Before full draft generation user should be able to:
- reorder planned slides,
- remove slides,
- change intent,
- edit title,
- edit key message,
- request regeneration,
- inspect source mapping,
- inspect visual hint.

The review package is successful when the user can understand:
- why each slide exists,
- what it is meant to say,
- what sources justify it,
- what kind of slide it is.

---

## 10. Planning to draft handoff

Full deck generation may start only after the engine has produced:
- approved `OutlinePlan[]`
- approved or accepted `SlideRecipe[]`
- planning warnings
- visual policy per slide

Deck generation then fills:
- concrete block content,
- notes,
- visuals,
- style applications

without changing the approved planning intent silently.

---

## 11. Failure and fallback rules

If planning confidence is low:
- reduce slide count,
- prefer clearer generic intents,
- mark low-confidence nodes,
- ask for user review rather than pretending certainty.

If source coverage is weak:
- signal AI-drafted areas,
- reduce claims,
- avoid data-heavy intents.

If template and source conflict:
- preserve required template spine,
- flag mismatches for review.

---

## 12. Acceptance checklist

- The team has one canonical path from input context to outline and slide recipes.
- Every slide in a generated deck can be traced back to a planning object.
- Create modes behave differently but converge on one reviewable planning layer.
- Planning engine expresses source grounding, density and visual policy before full draft generation.
- Full deck generation no longer acts like an opaque black box.
